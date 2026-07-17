import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TaskDispatchPreflightResult } from "./dispatch-input";
import { startManualTaskDispatch } from "./manual-dispatch";
import type { DueFamilyTask, FinishTaskRunOutcome } from "./store";

const task: DueFamilyTask = {
  scheduleId: "schedule-1",
  familyId: "family-1",
  familySandbox: true,
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

const readyPreflight: TaskDispatchPreflightResult = {
  outcome: "ready",
  deliveryVersion: "research_brief_v2",
  message: "prepared model prompt",
};

describe("manual task dispatch setup", () => {
  it("returns the approved no-candidate note without creating a run or Eve side effect", async () => {
    const calls: string[] = [];

    const result = await startManualTaskDispatch(task, {
      preflight: async () => {
        calls.push("preflight");
        return {
          outcome: "skip",
          deliveryVersion: "research_brief_v2",
          reason: "no eligible morning brief candidate",
        };
      },
      beginRun: async () => assert.fail("manual skip must create no run"),
      createEpisode: async () => assert.fail("manual skip has no episode"),
      sendSession: async () => assert.fail("manual skip has no session"),
      setRuntimeSession: async () => assert.fail("manual skip has no session"),
      finishRun: async () => assert.fail("manual skip has no run to finish"),
    });

    assert.deepEqual(result, {
      ok: false,
      status: 409,
      note: "There isn't new research to share right now. Nothing needs your attention. Homa will check again at your next morning brief.",
    });
    assert.deepEqual(calls, ["preflight"]);
  });

  it("returns the operational fallback when preflight fails before run creation", async () => {
    const calls: string[] = [];
    const warnings: string[] = [];

    const result = await startManualTaskDispatch(task, {
      preflight: async () => {
        calls.push("preflight");
        throw new Error("context database unavailable");
      },
      beginRun: async () => assert.fail("preflight failure has no run"),
      createEpisode: async () => assert.fail("preflight failure has no episode"),
      sendSession: async () => assert.fail("preflight failure has no session"),
      setRuntimeSession: async () => assert.fail("preflight failure has no session"),
      finishRun: async () => assert.fail("preflight failure has no run"),
      logWarning: (warning) => {
        calls.push("log");
        warnings.push(warning);
      },
    });

    assert.deepEqual(result, {
      ok: false,
      status: 503,
      note: "Homa couldn't start this run. Try again in a bit.",
    });
    assert.deepEqual(calls, ["preflight", "log"]);
    assert.deepEqual(warnings, [
      "[manual_dispatch] phase=manual_bookkeeping result=setup_failure_unrecorded",
    ]);
  });

  it("uses the ready preflight message and explicit version for run, auth, and target", async () => {
    const calls: string[] = [];

    const result = await startManualTaskDispatch(task, {
      preflight: async () => {
        calls.push("preflight");
        return readyPreflight;
      },
      beginRun: async (_task, deliveryVersion) => {
        calls.push(`begin:${deliveryVersion}`);
        return { id: "run-1", deliveryVersion };
      },
      createEpisode: async () => {
        calls.push("episode");
        return "episode-1";
      },
      sendSession: async (input) => {
        calls.push(
          `send:${input.message}:${input.auth.attributes.deliveryVersion}:${input.target.deliveryVersion}`,
        );
        return { id: "session-1" };
      },
      setRuntimeSession: async (runId, sessionId) => {
        calls.push(`runtime:${runId}:${sessionId}`);
      },
      finishRun: async () => assert.fail("successful setup stays running"),
    });

    assert.deepEqual(result, { ok: true, runId: "run-1" });
    assert.deepEqual(calls, [
      "preflight",
      "begin:research_brief_v2",
      "episode",
      "send:prepared model prompt:research_brief_v2:research_brief_v2",
      "runtime:run-1:session-1",
    ]);
  });

  it("preserves generic setup failure after the explicit run is created", async () => {
    const finished: FinishTaskRunOutcome[] = [];

    const result = await startManualTaskDispatch(task, {
      preflight: async () => readyPreflight,
      beginRun: async (_task, deliveryVersion) => ({
        id: "run-1",
        deliveryVersion,
      }),
      createEpisode: async () => {
        throw new Error("parent@example.test appeared in provider error");
      },
      sendSession: async () => assert.fail("session must not start"),
      setRuntimeSession: async () => assert.fail("session must not persist"),
      finishRun: async (_runId, outcome) => {
        finished.push(outcome);
        return true;
      },
    });

    assert.deepEqual(result, {
      ok: false,
      status: 503,
      note: "Homa couldn't start this run. Try again in a bit.",
    });
    assert.equal(finished.length, 1);
    assert.equal(finished[0]?.status, "failed");
    assert.equal(finished[0]?.error, "manual task session setup failed");
  });

  it("returns started after bounded bookkeeping retries once the session exists", async () => {
    let sessionSends = 0;
    let bookkeepingAttempts = 0;
    const warnings: string[] = [];

    const result = await startManualTaskDispatch(task, {
      preflight: async () => readyPreflight,
      beginRun: async (_task, deliveryVersion) => ({
        id: "run-1",
        deliveryVersion,
      }),
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
