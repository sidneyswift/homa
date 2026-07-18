import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifySubjectLessonMessageCompletion,
  failSubjectLessonAttempt,
  finishSubjectLessonAttempt,
  startSubjectLessonAttempt,
  type SubjectLessonChannelState,
  type SubjectLessonEventEmitter,
  type SubjectLessonRunDependencies,
} from "./channel-run";
import { type SubjectLessonClaimedSessionInput } from "./dispatch-input";

const LESSON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FAMILY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function sessionInput(
  overrides: Partial<SubjectLessonClaimedSessionInput> = {},
): SubjectLessonClaimedSessionInput {
  return {
    lessonId: LESSON_ID,
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    childName: "Maya",
    subjectId: "literacy",
    subjectName: "Literacy",
    targetItemId: "literacy.reads-short-vowel-words",
    targetStatement: "Reads short-vowel words",
    startingLine: "Names each short-vowel sound",
    attempt: 2,
    hasContent: false,
    materialId: null,
    ...overrides,
  };
}

function runningState(): SubjectLessonChannelState {
  return {
    familyId: FAMILY_ID,
    lessonId: LESSON_ID,
    childId: CHILD_ID,
    subjectId: "literacy",
    attempt: 2,
    terminal: false,
  };
}

function eventCollector() {
  const events: Array<{ name: string; props: unknown }> = [];
  const emitEvent: SubjectLessonEventEmitter = async (event) => {
    events.push(event);
  };
  return { events, emitEvent };
}

describe("startSubjectLessonAttempt", () => {
  it("claims once, starts one task session, and records the matching attempt", async () => {
    const calls: string[] = [];
    const { events, emitEvent } = eventCollector();
    let captured:
      | {
          message: string;
          options: Parameters<
            SubjectLessonRunDependencies["startSession"]
          >[1];
        }
      | undefined;
    let runtimeWrite: unknown;

    const result = await startSubjectLessonAttempt(
      {
        familyId: FAMILY_ID,
        lessonId: LESSON_ID,
        retry: false,
        modelUsageSurface: "subject_lesson",
      },
      {
        claimSessionInput: async (familyId, lessonId, retry) => {
          calls.push("claim");
          assert.deepEqual({ familyId, lessonId, retry }, {
            familyId: FAMILY_ID,
            lessonId: LESSON_ID,
            retry: false,
          });
          return sessionInput();
        },
        startSession: async (message, options) => {
          calls.push("start");
          captured = { message, options };
          return { id: "session-2" };
        },
        setRuntimeSession: async (
          familyId,
          lessonId,
          attempt,
          sessionId,
        ) => {
          calls.push("record");
          runtimeWrite = { familyId, lessonId, attempt, sessionId };
          return true;
        },
        finishRun: async () => {
          throw new Error("finish should not run");
        },
        emitEvent,
      },
    );

    assert.deepEqual(calls, ["claim", "start", "record"]);
    assert.deepEqual(result, {
      status: "started",
      attempt: 2,
      sessionId: "session-2",
      sessionRecorded: true,
    });
    assert.ok(captured);
    assert.match(captured.message, /Reads short-vowel words/u);
    assert.equal(
      captured.options.continuationToken,
      `subject-lesson:${LESSON_ID}:attempt:2`,
    );
    assert.equal(captured.options.mode, "task");
    assert.equal(
      captured.options.auth.attributes.modelUsageSurface,
      "subject_lesson",
    );
    assert.deepEqual(runtimeWrite, {
      familyId: FAMILY_ID,
      lessonId: LESSON_ID,
      attempt: 2,
      sessionId: "session-2",
    });
    assert.deepEqual(events, [
      {
        name: "map.subject_lesson_started",
        props: {
          family_id: FAMILY_ID,
          child_id: CHILD_ID,
          subject: "literacy",
          attempt: 2,
        },
      },
    ]);
  });

  it("does not start another session when the row cannot be claimed", async () => {
    let sessions = 0;
    const result = await startSubjectLessonAttempt(
      {
        familyId: FAMILY_ID,
        lessonId: LESSON_ID,
        retry: false,
        modelUsageSurface: "subject_lesson",
      },
      {
        claimSessionInput: async () => null,
        startSession: async () => {
          sessions += 1;
          return { id: "unexpected" };
        },
        setRuntimeSession: async () => false,
        finishRun: async () => null,
        emitEvent: async () => undefined,
      },
    );
    assert.deepEqual(result, { status: "not_started" });
    assert.equal(sessions, 0);
  });

  it("forwards an explicit retry exactly once", async () => {
    let claims = 0;
    await startSubjectLessonAttempt(
      {
        familyId: FAMILY_ID,
        lessonId: LESSON_ID,
        retry: true,
        modelUsageSurface: "subject_lesson",
      },
      {
        claimSessionInput: async (_familyId, _lessonId, retry) => {
          claims += 1;
          assert.equal(retry, true);
          return sessionInput();
        },
        startSession: async () => ({ id: "session-retry" }),
        setRuntimeSession: async () => true,
        finishRun: async () => null,
        emitEvent: async () => undefined,
      },
    );
    assert.equal(claims, 1);
  });

  it("marks and emits a failed attempt when session startup fails", async () => {
    const { events, emitEvent } = eventCollector();
    let finishInput: unknown;
    const result = await startSubjectLessonAttempt(
      {
        familyId: FAMILY_ID,
        lessonId: LESSON_ID,
        retry: false,
        modelUsageSurface: "subject_lesson",
      },
      {
        claimSessionInput: async () => sessionInput(),
        startSession: async () => {
          throw new Error("session startup failed");
        },
        setRuntimeSession: async () => false,
        finishRun: async (input) => {
          finishInput = input;
          return {
            lesson: {
              buildStatus: "failed",
              errorCode: "session_start_failed",
            },
            transitioned: true,
          };
        },
        emitEvent,
      },
    );
    assert.deepEqual(finishInput, {
      familyId: FAMILY_ID,
      lessonId: LESSON_ID,
      attempt: 2,
      status: "failed",
      errorCode: "session_start_failed",
    });
    assert.equal(result.status, "failed");
    assert.deepEqual(
      events.map((event) => event.name),
      ["map.subject_lesson_started", "map.subject_lesson_failed"],
    );
  });
});

describe("terminal subject lesson handling", () => {
  it("recovers before a complete run transitions ready", async () => {
    const order: string[] = [];
    const { events, emitEvent } = eventCollector();
    const state = runningState();
    const result = await finishSubjectLessonAttempt(state, {
      recoverMaterial: async () => {
        order.push("recover");
        return "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
      },
      finishRun: async (input) => {
        order.push("finish");
        assert.equal(input.status, "ready");
        return {
          lesson: { buildStatus: "ready", errorCode: null },
          transitioned: true,
        };
      },
      emitEvent: async (event) => {
        order.push("emit");
        await emitEvent(event);
      },
    });
    assert.equal(result, "ready");
    assert.equal(state.terminal, true);
    assert.deepEqual(order, ["recover", "finish", "emit"]);
    assert.equal(events[0]?.name, "map.subject_lesson_ready");
  });

  it("marks incomplete stopped work failed", async () => {
    const { events, emitEvent } = eventCollector();
    const result = await finishSubjectLessonAttempt(runningState(), {
      recoverMaterial: async () => null,
      finishRun: async () => ({
        lesson: { buildStatus: "failed", errorCode: "incomplete_build" },
        transitioned: true,
      }),
      emitEvent,
    });
    assert.equal(result, "failed");
    assert.equal(events[0]?.name, "map.subject_lesson_failed");
  });

  it("does not emit when completion replays an existing terminal row", async () => {
    const { events, emitEvent } = eventCollector();
    const state = runningState();
    const result = await finishSubjectLessonAttempt(state, {
      recoverMaterial: async () => null,
      finishRun: async () => ({
        lesson: { buildStatus: "ready", errorCode: null },
        transitioned: false,
      }),
      emitEvent,
    });
    assert.equal(result, "ready");
    assert.equal(state.terminal, true);
    assert.deepEqual(events, []);
  });

  it("uses one idempotent failure finalizer and suppresses replay events", async () => {
    const firstEvents = eventCollector();
    const first = await failSubjectLessonAttempt(
      runningState(),
      "turn_failed",
      {
        finishRun: async () => ({
          lesson: { buildStatus: "failed", errorCode: "turn_failed" },
          transitioned: true,
        }),
        emitEvent: firstEvents.emitEvent,
      },
    );
    assert.equal(first, "failed");
    assert.equal(firstEvents.events.length, 1);

    const replayEvents = eventCollector();
    const replayState = runningState();
    const replay = await failSubjectLessonAttempt(
      replayState,
      "session_failed",
      {
        finishRun: async () => ({
          lesson: { buildStatus: "failed", errorCode: "turn_failed" },
          transitioned: false,
        }),
        emitEvent: replayEvents.emitEvent,
      },
    );
    assert.equal(replay, "failed");
    assert.equal(replayState.terminal, true);
    assert.deepEqual(replayEvents.events, []);
  });
});

describe("classifySubjectLessonMessageCompletion", () => {
  it("ignores only tool-calls and classifies every terminal finish", () => {
    assert.deepEqual(classifySubjectLessonMessageCompletion("tool-calls"), {
      kind: "ignore",
    });
    assert.deepEqual(classifySubjectLessonMessageCompletion("stop"), {
      kind: "complete",
    });
    assert.deepEqual(
      [
        "content-filter",
        "error",
        "length",
        "other",
      ].map((finishReason) =>
        classifySubjectLessonMessageCompletion(
          finishReason as
            | "content-filter"
            | "error"
            | "length"
            | "other",
        ),
      ),
      [
        { kind: "fail", errorCode: "message_content_filter" },
        { kind: "fail", errorCode: "message_error" },
        { kind: "fail", errorCode: "message_length" },
        { kind: "fail", errorCode: "message_other" },
      ],
    );
  });
});
