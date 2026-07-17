import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { startManualTaskDispatch } from "./manual-dispatch";
import type { DueFamilyTask, FinishTaskRunOutcome } from "./store";

const task: DueFamilyTask = {
  scheduleId: "schedule-1",
  familyId: "family-1",
  kind: "morning_brief",
  timeZone: "America/New_York",
  localHour: 9,
  weekdays: [1, 2, 3, 4, 5],
  deliveryPref: "text",
  label: null,
  prompt: null,
  parentFirstName: "Parent",
  kidPhrase: "Child",
  phoneNumbers: [],
  email: "parent@example.test",
  recipientMemberUserId: "member-1",
};

describe("manual task dispatch setup", () => {
  it("finishes a created run with a PII-free error when episode setup fails", async () => {
    const finished: Array<{
      runId: string;
      outcome: FinishTaskRunOutcome;
    }> = [];

    const result = await startManualTaskDispatch(task, {
      beginRun: async () => ({
        id: "run-1",
        deliveryVersion: "research_brief_v2",
      }),
      buildMessage: async () => "private model prompt",
      createEpisode: async () => {
        throw new Error("parent@example.test appeared in provider error");
      },
      sendSession: async () => assert.fail("session must not start"),
      setRuntimeSession: async () => assert.fail("session must not persist"),
      finishRun: async (runId, outcome) => {
        finished.push({ runId, outcome });
        return true;
      },
    });

    assert.deepEqual(result, {
      ok: false,
      status: 503,
      note: "Homa couldn't start this run. Try again in a bit.",
    });
    assert.deepEqual(finished, [{
      runId: "run-1",
      outcome: {
        familyId: "family-1",
        kind: "morning_brief",
        status: "failed",
        error: "manual task session setup failed",
        onlyIfRunning: true,
      },
    }]);
  });

  it("seeds the pinned version into message, auth, target, and session setup", async () => {
    const calls: string[] = [];
    const result = await startManualTaskDispatch(task, {
      beginRun: async () => ({
        id: "run-1",
        deliveryVersion: "research_brief_v2",
      }),
      buildMessage: async (_task, deliveryVersion) => {
        calls.push(`message:${deliveryVersion}`);
        return "prompt";
      },
      createEpisode: async () => {
        calls.push("episode");
        return "episode-1";
      },
      sendSession: async (input) => {
        calls.push(
          `send:${input.auth.attributes.deliveryVersion}:${input.target.deliveryVersion}`,
        );
        return { id: "session-1" };
      },
      setRuntimeSession: async (runId, sessionId) => {
        calls.push(`runtime:${runId}:${sessionId}`);
      },
      finishRun: async () => assert.fail("successful setup must stay running"),
    });

    assert.deepEqual(result, { ok: true, runId: "run-1" });
    assert.deepEqual(calls, [
      "message:research_brief_v2",
      "episode",
      "send:research_brief_v2:research_brief_v2",
      "runtime:run-1:session-1",
    ]);
  });

  it("returns started after bounded bookkeeping retries once the session exists", async () => {
    let sessionSends = 0;
    let bookkeepingAttempts = 0;
    const warnings: string[] = [];

    const result = await startManualTaskDispatch(task, {
      beginRun: async () => ({
        id: "run-1",
        deliveryVersion: "research_brief_v2",
      }),
      buildMessage: async () => "prompt",
      createEpisode: async () => "episode-1",
      sendSession: async () => {
        sessionSends += 1;
        return { id: "session-1" };
      },
      setRuntimeSession: async () => {
        bookkeepingAttempts += 1;
        throw new Error("provider error included parent@example.test");
      },
      finishRun: async () =>
        assert.fail("a durable session must keep the run active"),
      logWarning: (warning) => warnings.push(warning),
    });

    assert.deepEqual(result, { ok: true, runId: "run-1" });
    assert.equal(sessionSends, 1);
    assert.equal(bookkeepingAttempts, 3);
    assert.deepEqual(warnings, [
      "[manual_dispatch] phase=manual_bookkeeping result=runtime_session_unrecorded",
    ]);
  });
});
