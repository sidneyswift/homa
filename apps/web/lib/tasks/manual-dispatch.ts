import {
  buildDispatchAuth,
  buildDispatchTarget,
} from "./dispatch-input";
import { operationalDiagnostic } from "../operational-diagnostics";
import type { TaskDeliveryVersion } from "./delivery-version";
import type {
  DueFamilyTask,
  FinishTaskRunOutcome,
  StartedTaskRun,
} from "./store";

const MANUAL_RUN_ERROR = "manual task session setup failed";
const MANUAL_RUN_NOTE = "Homa couldn't start this run. Try again in a bit.";
const MANUAL_BOOKKEEPING_ATTEMPTS = 3;
const MANUAL_BOOKKEEPING_WARNING =
  operationalDiagnostic(
    "manual_dispatch",
    "manual_bookkeeping",
    "runtime_session_unrecorded",
  );

export interface ManualTaskDispatchDependencies {
  beginRun(task: DueFamilyTask): Promise<StartedTaskRun>;
  buildMessage(
    task: DueFamilyTask,
    deliveryVersion: TaskDeliveryVersion,
  ): Promise<string>;
  createEpisode(task: DueFamilyTask): Promise<string>;
  sendSession(input: {
    message: string;
    auth: ReturnType<typeof buildDispatchAuth>;
    target: ReturnType<typeof buildDispatchTarget>;
  }): Promise<{ id: string }>;
  setRuntimeSession(runId: string, sessionId: string): Promise<void>;
  finishRun(
    runId: string,
    outcome: FinishTaskRunOutcome,
  ): Promise<boolean>;
  logWarning?(warning: string): void;
}

export type ManualTaskDispatchResult =
  | { ok: true; runId: string }
  | { ok: false; status: 503; note: string };

/**
 * Owns every setup step after the durable manual run row exists. Failures
 * before Eve accepts the session finish the run. Bookkeeping failures after
 * acceptance cannot stop the already-running durable session.
 */
export async function startManualTaskDispatch(
  task: DueFamilyTask,
  dependencies: ManualTaskDispatchDependencies,
): Promise<ManualTaskDispatchResult> {
  const startedRun = await dependencies.beginRun(task);
  let session: { id: string };
  try {
    const message = await dependencies.buildMessage(
      task,
      startedRun.deliveryVersion,
    );
    const episodeId = await dependencies.createEpisode(task);
    session = await dependencies.sendSession({
      message,
      auth: buildDispatchAuth(
        task,
        startedRun.id,
        episodeId,
        startedRun.deliveryVersion,
      ),
      target: buildDispatchTarget(
        task,
        startedRun.id,
        episodeId,
        startedRun.deliveryVersion,
      ),
    });
  } catch {
    try {
      await dependencies.finishRun(startedRun.id, {
        familyId: task.familyId,
        kind: task.kind,
        status: "failed",
        error: MANUAL_RUN_ERROR,
        onlyIfRunning: true,
      });
    } catch {
      console.error(
        operationalDiagnostic(
          "manual_dispatch",
          "manual_bookkeeping",
          "setup_failure_unrecorded",
        ),
      );
    }
    return { ok: false, status: 503, note: MANUAL_RUN_NOTE };
  }

  for (let attempt = 0; attempt < MANUAL_BOOKKEEPING_ATTEMPTS; attempt += 1) {
    try {
      await dependencies.setRuntimeSession(startedRun.id, session.id);
      return { ok: true, runId: startedRun.id };
    } catch {
      // The durable Eve session is already running. Retry only bookkeeping.
    }
  }
  (dependencies.logWarning ?? console.error)(MANUAL_BOOKKEEPING_WARNING);
  return { ok: true, runId: startedRun.id };
}
