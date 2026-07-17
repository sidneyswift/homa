import type {
  TaskDispatchPreflightResult,
} from "./dispatch-input";
import type { TaskDeliveryVersion } from "./delivery-version";
import type {
  BeginTaskRunOptions,
  DueFamilyTask,
  FinishTaskRunOutcome,
  RecordSkippedScheduledTaskRunResult,
  StartedTaskRun,
} from "./store";

export interface ScheduledTaskDispatchDependencies {
  withinDeliveryWindow(task: DueFamilyTask, now: Date): boolean;
  selectDeliveryVersion(task: DueFamilyTask): TaskDeliveryVersion;
  preflight(task: DueFamilyTask): Promise<TaskDispatchPreflightResult>;
  beginRun(
    task: DueFamilyTask,
    now: Date,
    options: BeginTaskRunOptions,
  ): Promise<StartedTaskRun | null>;
  recordSkippedRun(
    task: DueFamilyTask,
    now: Date,
    preflight: Extract<TaskDispatchPreflightResult, { outcome: "skip" }>,
  ): Promise<RecordSkippedScheduledTaskRunResult>;
  createEpisode(task: DueFamilyTask): Promise<string>;
  receive(input: {
    message: string;
    task: DueFamilyTask;
    run: StartedTaskRun;
    episodeId: string;
    deliveryVersion: TaskDeliveryVersion;
  }): Promise<{ id: string }>;
  setRuntimeSession(runId: string, sessionId: string): Promise<void>;
  finishRun(runId: string, outcome: FinishTaskRunOutcome): Promise<boolean>;
  advanceSchedule(task: DueFamilyTask, now: Date): Promise<void>;
  releaseSchedule(task: DueFamilyTask): Promise<void>;
  logFailure(error: unknown): void;
}

/**
 * Preflights in-window work before creating a running row. A no-candidate
 * result is stored as one final row together with its schedule advance.
 */
export async function dispatchScheduledTask(
  task: DueFamilyTask,
  now: Date,
  dependencies: ScheduledTaskDispatchDependencies,
): Promise<void> {
  let runId: string | null = null;
  let sessionStarted = false;
  try {
    if (!dependencies.withinDeliveryWindow(task, now)) {
      const deliveryVersion = dependencies.selectDeliveryVersion(task);
      await dependencies.beginRun(task, now, {
        deliveryVersion,
        status: "skipped",
        error: "missed the delivery window",
      });
      await dependencies.advanceSchedule(task, now);
      return;
    }

    const preflight = await dependencies.preflight(task);
    if (preflight.outcome === "skip") {
      await dependencies.recordSkippedRun(task, now, preflight);
      return;
    }

    const startedRun = await dependencies.beginRun(task, now, {
      deliveryVersion: preflight.deliveryVersion,
    });
    if (!startedRun) {
      await dependencies.advanceSchedule(task, now);
      return;
    }
    runId = startedRun.id;
    const episodeId = await dependencies.createEpisode(task);
    const session = await dependencies.receive({
      message: preflight.message,
      task,
      run: startedRun,
      episodeId,
      deliveryVersion: preflight.deliveryVersion,
    });
    sessionStarted = true;
    await dependencies.setRuntimeSession(runId, session.id);
    await dependencies.advanceSchedule(task, now);
  } catch (error) {
    dependencies.logFailure(error);
    if (runId && !sessionStarted) {
      await dependencies.finishRun(runId, {
        familyId: task.familyId,
        kind: task.kind,
        status: "failed",
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "session startup failed",
      });
    }
    await dependencies.releaseSchedule(task);
  }
}
