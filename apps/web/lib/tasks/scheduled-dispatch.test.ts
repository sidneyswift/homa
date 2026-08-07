import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TaskDispatchPreflightResult } from "./dispatch-input";
import { dispatchScheduledTask } from "./scheduled-dispatch";
import type {
  BeginTaskRunOptions,
  DueFamilyTask,
  FinishTaskRunOutcome,
} from "./store";

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
  sourceOfferDeliveryId: null,
};

const readyPreflight: TaskDispatchPreflightResult = {
  outcome: "ready",
  deliveryVersion: "research_brief_v2",
  message: "prepared model prompt",
};

const skipPreflight: TaskDispatchPreflightResult = {
  outcome: "skip",
  deliveryVersion: "research_brief_v2",
  reason: "no eligible morning brief candidate",
};

describe("scheduled task dispatch", () => {
  it("records an in-window no-candidate skip without a running row or Eve side effect", async () => {
    const calls: string[] = [];

    await dispatchScheduledTask(task, new Date("2026-07-17T13:00:00.000Z"), {
      withinDeliveryWindow: () => true,
      selectDeliveryVersion: () =>
        assert.fail("in-window work selects its version through preflight"),
      preflight: async () => {
        calls.push("preflight");
        return skipPreflight;
      },
      beginRun: async () => assert.fail("a skip has no running row"),
      recordSkippedRun: async (_task, _now, preflight) => {
        calls.push(`skip:${preflight.deliveryVersion}:${preflight.reason}`);
        return { inserted: true, runId: "run-1" };
      },
      createEpisode: async () => assert.fail("a skip has no episode"),
      receive: async () => assert.fail("a skip has no session"),
      setRuntimeSession: async () => assert.fail("a skip has no session"),
      finishRun: async () => assert.fail("a skip is final at insertion"),
      advanceSchedule: async () =>
        assert.fail("the atomic skip owns schedule advance"),
      releaseSchedule: async () => assert.fail("a successful skip clears its lease"),
      logFailure: () => assert.fail("a successful skip is not a failure"),
    });

    assert.deepEqual(calls, [
      "preflight",
      "skip:research_brief_v2:no eligible morning brief candidate",
    ]);
  });

  it("logs and releases a preflight failure without creating a run", async () => {
    const calls: string[] = [];

    await dispatchScheduledTask(task, new Date("2026-07-17T13:00:00.000Z"), {
      withinDeliveryWindow: () => true,
      selectDeliveryVersion: () =>
        assert.fail("in-window work selects its version through preflight"),
      preflight: async () => {
        calls.push("preflight");
        throw new Error("context unavailable");
      },
      beginRun: async () => assert.fail("preflight failure has no run"),
      recordSkippedRun: async () => assert.fail("preflight did not classify a skip"),
      createEpisode: async () => assert.fail("preflight failure has no episode"),
      receive: async () => assert.fail("preflight failure has no session"),
      setRuntimeSession: async () => assert.fail("preflight failure has no session"),
      finishRun: async () => assert.fail("preflight failure has no run"),
      advanceSchedule: async () => assert.fail("preflight failure must retry"),
      releaseSchedule: async () => {
        calls.push("release");
      },
      logFailure: () => {
        calls.push("log");
      },
    });

    assert.deepEqual(calls, ["preflight", "log", "release"]);
  });

  it("uses the ready preflight message and explicit version for run, auth, and target", async () => {
    const calls: string[] = [];
    let beginOptions: BeginTaskRunOptions | null = null;

    await dispatchScheduledTask(task, new Date("2026-07-17T13:00:00.000Z"), {
      withinDeliveryWindow: () => true,
      selectDeliveryVersion: () =>
        assert.fail("in-window work selects its version through preflight"),
      preflight: async () => {
        calls.push("preflight");
        return readyPreflight;
      },
      beginRun: async (_task, _now, options) => {
        calls.push("begin");
        beginOptions = options;
        return {
          id: "run-1",
          deliveryVersion: options.deliveryVersion,
        };
      },
      recordSkippedRun: async () => assert.fail("ready work must not skip"),
      createEpisode: async () => {
        calls.push("episode");
        return "episode-1";
      },
      receive: async ({ message, run, deliveryVersion }) => {
        calls.push(`receive:${message}:${run.deliveryVersion}:${deliveryVersion}`);
        return { id: "session-1" };
      },
      setRuntimeSession: async () => {
        calls.push("runtime");
      },
      finishRun: async () => assert.fail("successful setup stays running"),
      advanceSchedule: async () => {
        calls.push("advance");
      },
      releaseSchedule: async () => assert.fail("successful setup advances"),
      logFailure: () => assert.fail("successful setup does not log"),
    });

    assert.deepEqual(beginOptions, {
      deliveryVersion: "research_brief_v2",
    });
    assert.deepEqual(calls, [
      "preflight",
      "begin",
      "episode",
      "receive:prepared model prompt:research_brief_v2:research_brief_v2",
      "runtime",
      "advance",
    ]);
  });

  it("selects a missed-window version without loading task context", async () => {
    const calls: string[] = [];
    let beginOptions: BeginTaskRunOptions | null = null;

    await dispatchScheduledTask(task, new Date("2026-07-17T18:00:00.000Z"), {
      withinDeliveryWindow: () => false,
      selectDeliveryVersion: () => {
        calls.push("select-version");
        return "research_brief_v2";
      },
      preflight: async () => assert.fail("a window miss must not load context"),
      beginRun: async (_task, _now, options) => {
        calls.push("begin");
        beginOptions = options;
        return {
          id: "run-1",
          deliveryVersion: options.deliveryVersion,
        };
      },
      recordSkippedRun: async () =>
        assert.fail("window misses preserve their existing path"),
      createEpisode: async () => assert.fail("a window miss has no episode"),
      receive: async () => assert.fail("a window miss has no session"),
      setRuntimeSession: async () => assert.fail("a window miss has no session"),
      finishRun: async () => assert.fail("a window miss starts final"),
      advanceSchedule: async () => {
        calls.push("advance");
      },
      releaseSchedule: async () => assert.fail("a window miss advances"),
      logFailure: () => assert.fail("a window miss is not a failure"),
    });

    assert.deepEqual(beginOptions, {
      deliveryVersion: "research_brief_v2",
      status: "skipped",
      error: "missed the delivery window",
    });
    assert.deepEqual(calls, ["select-version", "begin", "advance"]);
  });

  it("preserves generic setup failure finalization after a ready preflight", async () => {
    const calls: string[] = [];
    const finishes: FinishTaskRunOutcome[] = [];

    await dispatchScheduledTask(task, new Date("2026-07-17T13:00:00.000Z"), {
      withinDeliveryWindow: () => true,
      selectDeliveryVersion: () =>
        assert.fail("in-window work selects its version through preflight"),
      preflight: async () => readyPreflight,
      beginRun: async (_task, _now, options) => ({
        id: "run-1",
        deliveryVersion: options.deliveryVersion,
      }),
      recordSkippedRun: async () => assert.fail("ready work must not skip"),
      createEpisode: async () => {
        throw new Error("episode setup failed");
      },
      receive: async () => assert.fail("episode setup failed first"),
      setRuntimeSession: async () => assert.fail("no session exists"),
      finishRun: async (_runId, outcome) => {
        calls.push("finish");
        finishes.push(outcome);
        return true;
      },
      advanceSchedule: async () => assert.fail("failed setup does not advance"),
      releaseSchedule: async () => {
        calls.push("release");
      },
      logFailure: () => {
        calls.push("log");
      },
    });

    assert.equal(finishes.length, 1);
    assert.equal(finishes[0]?.status, "failed");
    assert.deepEqual(calls, ["log", "finish", "release"]);
  });
});
