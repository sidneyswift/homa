import {
  buildSubjectLessonAuth,
  buildSubjectLessonMessage,
  type SubjectLessonClaimedSessionInput,
  type SubjectLessonModelUsageSurface,
  type SubjectLessonSessionInput,
} from "./dispatch-input";
import { type SubjectLessonBuildStatus } from "./types";

export interface SubjectLessonStartRequest {
  familyId: string;
  lessonId: string;
  retry: boolean;
  modelUsageSurface: SubjectLessonModelUsageSurface;
}

export interface SubjectLessonChannelState {
  familyId: string;
  lessonId: string;
  childId: string;
  subjectId: string;
  attempt: number;
  terminal: boolean;
}

interface SubjectLessonEventProps {
  "map.subject_lesson_started": {
    family_id: string;
    child_id: string;
    subject: string;
    attempt: number;
  };
  "map.subject_lesson_ready": {
    family_id: string;
    child_id: string;
    subject: string;
    attempt: number;
  };
  "map.subject_lesson_failed": {
    family_id: string;
    child_id: string;
    subject: string;
    attempt: number;
    error_code: string;
  };
}

type SubjectLessonEvent = {
  [Name in keyof SubjectLessonEventProps]: {
    name: Name;
    props: SubjectLessonEventProps[Name];
  };
}[keyof SubjectLessonEventProps];

export type SubjectLessonEventEmitter = (
  event: SubjectLessonEvent,
) => Promise<void>;

interface SubjectLessonTerminalRecord {
  buildStatus: SubjectLessonBuildStatus;
  errorCode: string | null;
}

interface FinishSubjectLessonRunResult {
  lesson: SubjectLessonTerminalRecord;
  transitioned: boolean;
}

interface FinishSubjectLessonRunInput {
  familyId: string;
  lessonId: string;
  attempt: number;
  status: "ready" | "failed";
  errorCode?: string | null;
}

interface SubjectLessonSessionStartOptions {
  auth: ReturnType<typeof buildSubjectLessonAuth>;
  continuationToken: string;
  mode: "task";
  state: SubjectLessonChannelState;
  title: string;
}

export interface SubjectLessonRunDependencies {
  claimSessionInput(
    familyId: string,
    lessonId: string,
    retry: boolean,
  ): Promise<SubjectLessonClaimedSessionInput | null>;
  startSession(
    message: string,
    options: SubjectLessonSessionStartOptions,
  ): Promise<{ id: string }>;
  setRuntimeSession(
    familyId: string,
    lessonId: string,
    attempt: number,
    sessionId: string,
  ): Promise<boolean>;
  finishRun(
    input: FinishSubjectLessonRunInput,
  ): Promise<FinishSubjectLessonRunResult | null>;
  emitEvent: SubjectLessonEventEmitter;
}

export interface SubjectLessonFailureDependencies {
  finishRun(
    input: FinishSubjectLessonRunInput,
  ): Promise<FinishSubjectLessonRunResult | null>;
  emitEvent: SubjectLessonEventEmitter;
}

export interface SubjectLessonTerminalDependencies
  extends SubjectLessonFailureDependencies {
  recoverMaterial(input: {
    familyId: string;
    lessonId: string;
    attempt: number;
  }): Promise<string | null>;
}

export type SubjectLessonFinishReason =
  | "content-filter"
  | "error"
  | "length"
  | "other"
  | "stop"
  | "tool-calls";

export type SubjectLessonMessageCompletion =
  | { kind: "ignore" }
  | { kind: "complete" }
  | {
      kind: "fail";
      errorCode:
        | "message_content_filter"
        | "message_error"
        | "message_length"
        | "message_other";
    };

export type SubjectLessonStartResult =
  | { status: "not_started" }
  | {
      status: "started";
      attempt: number;
      sessionId: string;
      sessionRecorded: boolean;
    }
  | {
      status: "failed";
      attempt: number;
      errorCode: "session_start_failed";
    };

function channelStateFromSessionInput(
  input: SubjectLessonSessionInput,
): SubjectLessonChannelState {
  return {
    familyId: input.familyId,
    lessonId: input.lessonId,
    childId: input.childId,
    subjectId: input.subjectId,
    attempt: input.attempt,
    terminal: false,
  };
}

function eventIdentity(state: SubjectLessonChannelState) {
  return {
    family_id: state.familyId,
    child_id: state.childId,
    subject: state.subjectId,
    attempt: state.attempt,
  };
}

function boundedErrorCode(errorCode: string | null): string {
  const candidate = errorCode?.trim() ?? "";
  return /^[a-z0-9_:-]{1,80}$/u.test(candidate)
    ? candidate
    : "build_failed";
}

async function emitSubjectLessonTerminalEvent(
  state: SubjectLessonChannelState,
  result: FinishSubjectLessonRunResult,
  emitEvent: SubjectLessonEventEmitter,
): Promise<"ready" | "failed" | null> {
  const record = result.lesson;
  if (record.buildStatus === "ready") {
    if (result.transitioned) {
      await emitEvent({
        name: "map.subject_lesson_ready",
        props: eventIdentity(state),
      });
    }
    return "ready";
  }
  if (record.buildStatus === "failed") {
    if (result.transitioned) {
      await emitEvent({
        name: "map.subject_lesson_failed",
        props: {
          ...eventIdentity(state),
          error_code: boundedErrorCode(record.errorCode),
        },
      });
    }
    return "failed";
  }
  return null;
}

export function classifySubjectLessonMessageCompletion(
  finishReason: SubjectLessonFinishReason,
): SubjectLessonMessageCompletion {
  switch (finishReason) {
    case "tool-calls":
      return { kind: "ignore" };
    case "stop":
      return { kind: "complete" };
    case "content-filter":
      return { kind: "fail", errorCode: "message_content_filter" };
    case "error":
      return { kind: "fail", errorCode: "message_error" };
    case "length":
      return { kind: "fail", errorCode: "message_length" };
    case "other":
      return { kind: "fail", errorCode: "message_other" };
    default: {
      const exhaustive: never = finishReason;
      throw new Error(
        `Unhandled subject lesson finish reason: ${String(exhaustive)}`,
      );
    }
  }
}

export async function failSubjectLessonAttempt(
  state: SubjectLessonChannelState,
  errorCode: string,
  dependencies: SubjectLessonFailureDependencies,
): Promise<"ready" | "failed" | null> {
  if (state.terminal) return null;
  const finished = await dependencies.finishRun({
    familyId: state.familyId,
    lessonId: state.lessonId,
    attempt: state.attempt,
    status: "failed",
    errorCode: boundedErrorCode(errorCode),
  });
  if (!finished) {
    state.terminal = true;
    return null;
  }
  const terminalStatus = await emitSubjectLessonTerminalEvent(
    state,
    finished,
    dependencies.emitEvent,
  );
  if (terminalStatus !== null) state.terminal = true;
  return terminalStatus;
}

/**
 * Claims the database row before starting Eve. A null claim covers repeated
 * running and ready starts, so no second session or event is created.
 */
export async function startSubjectLessonAttempt(
  request: SubjectLessonStartRequest,
  dependencies: SubjectLessonRunDependencies,
): Promise<SubjectLessonStartResult> {
  const claimedInput = await dependencies.claimSessionInput(
    request.familyId,
    request.lessonId,
    request.retry,
  );
  if (!claimedInput) return { status: "not_started" };
  const input: SubjectLessonSessionInput = {
    ...claimedInput,
    modelUsageSurface: request.modelUsageSurface,
  };

  const state = channelStateFromSessionInput(input);
  await dependencies.emitEvent({
    name: "map.subject_lesson_started",
    props: eventIdentity(state),
  });

  let session: { id: string };
  try {
    session = await dependencies.startSession(
      buildSubjectLessonMessage(input),
      {
        auth: buildSubjectLessonAuth(input),
        continuationToken:
          `subject-lesson:${input.lessonId}:attempt:${input.attempt}`,
        mode: "task",
        state,
        title: `Subject lesson ${input.lessonId} attempt ${input.attempt}`,
      },
    );
  } catch {
    await failSubjectLessonAttempt(
      state,
      "session_start_failed",
      dependencies,
    );
    return {
      status: "failed",
      attempt: input.attempt,
      errorCode: "session_start_failed",
    };
  }

  let sessionRecorded = false;
  try {
    sessionRecorded = await dependencies.setRuntimeSession(
      input.familyId,
      input.lessonId,
      input.attempt,
      session.id,
    );
  } catch {
    // The durable Eve session is already running. Keep the database claim
    // locked so a retry cannot start a second billed attempt.
  }
  return {
    status: "started",
    attempt: input.attempt,
    sessionId: session.id,
    sessionRecorded,
  };
}

/**
 * Handles one successful terminal task message. Recovery runs first so an
 * already-made family-scoped worksheet is attached instead of regenerated.
 */
export async function finishSubjectLessonAttempt(
  state: SubjectLessonChannelState,
  dependencies: SubjectLessonTerminalDependencies,
): Promise<"ready" | "failed" | null> {
  if (state.terminal) return null;

  try {
    await dependencies.recoverMaterial({
      familyId: state.familyId,
      lessonId: state.lessonId,
      attempt: state.attempt,
    });
    const finished = await dependencies.finishRun({
      familyId: state.familyId,
      lessonId: state.lessonId,
      attempt: state.attempt,
      status: "ready",
    });
    if (!finished) {
      state.terminal = true;
      return null;
    }
    const terminalStatus = await emitSubjectLessonTerminalEvent(
      state,
      finished,
      dependencies.emitEvent,
    );
    if (terminalStatus !== null) state.terminal = true;
    return terminalStatus;
  } catch {
    return await failSubjectLessonAttempt(
      state,
      "terminal_processing_failed",
      dependencies,
    );
  }
}
