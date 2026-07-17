import {
  buildDispatchAuth,
  buildDispatchTarget,
  type TaskDispatchPreflightResult,
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
const MANUAL_NO_CANDIDATE_NOTE =
  "There isn't new research to share right now. Nothing needs your attention. Homa will check again at your next morning brief.";
const MANUAL_BOOKKEEPING_ATTEMPTS = 3;
const MANUAL_BOOKKEEPING_WARNING =
  operationalDiagnostic(
    "manual_dispatch",
    "manual_bookkeeping",
    "runtime_session_unrecorded",
  );
const MANUAL_SETUP_FAILURE_WARNING =
  operationalDiagnostic(
    "manual_dispatch",
    "manual_bookkeeping",
    "setup_failure_unrecorded",
  );

export interface ManualTaskDispatchDependencies {
  preflight(task: DueFamilyTask): Promise<TaskDispatchPreflightResult>;
  beginRun(
    task: DueFamilyTask,
    deliveryVersion: TaskDeliveryVersion,
  ): Promise<StartedTaskRun>;
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
  | { ok: false; status: 409 | 503; note: string };

function logManualSetupFailure(
  dependencies: ManualTaskDispatchDependencies,
): void {
  (dependencies.logWarning ?? console.error)(MANUAL_SETUP_FAILURE_WARNING);
}

/**
 * Preflights before creating a manual run. Once Eve accepts a session,
 * bookkeeping retries cannot stop that already-running durable work.
 */
export async function startManualTaskDispatch(
  task: DueFamilyTask,
  dependencies: ManualTaskDispatchDependencies,
): Promise<ManualTaskDispatchResult> {
  let preflight: TaskDispatchPreflightResult;
  try {
    preflight = await dependencies.preflight(task);
  } catch {
    logManualSetupFailure(dependencies);
    return { ok: false, status: 503, note: MANUAL_RUN_NOTE };
  }
  if (preflight.outcome === "skip") {
    return { ok: false, status: 409, note: MANUAL_NO_CANDIDATE_NOTE };
  }

  let startedRun: StartedTaskRun | null = null;
  let session: { id: string };
  try {
    startedRun = await dependencies.beginRun(
      task,
      preflight.deliveryVersion,
    );
    const episodeId = await dependencies.createEpisode(task);
    session = await dependencies.sendSession({
      message: preflight.message,
      auth: buildDispatchAuth(
        task,
        startedRun.id,
        episodeId,
        preflight.deliveryVersion,
      ),
      target: buildDispatchTarget(
        task,
        startedRun.id,
        episodeId,
        preflight.deliveryVersion,
      ),
    });
  } catch {
    if (startedRun) {
      try {
        await dependencies.finishRun(startedRun.id, {
          familyId: task.familyId,
          kind: task.kind,
          status: "failed",
          error: MANUAL_RUN_ERROR,
          onlyIfRunning: true,
        });
      } catch {
        logManualSetupFailure(dependencies);
      }
    } else {
      logManualSetupFailure(dependencies);
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
