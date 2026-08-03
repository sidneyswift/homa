import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  PlanActivityCheckRequest,
  PlanActivityCheckResponse,
} from "@homa/core";

import type { DashboardPlan } from "./plan-week";
import {
  AuthenticatedPlanCheckController,
  authenticatedPlanCheckSeeds,
  requestPlanActivityCheck,
} from "./use-authenticated-plan-checks";

const CHILD_A = "11111111-1111-4111-8111-111111111111";
const CHILD_B = "22222222-2222-4222-8222-222222222222";
const PLAN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function eventually(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }
  throw lastError;
}

function seed(
  overrides: Partial<{
    childId: string;
    subjectId: string;
    planRevision: number;
    progressRevision: number;
    progress: Record<string, boolean>;
  }> = {},
) {
  return {
    childId: CHILD_A,
    subjectId: "math",
    planRevision: 1,
    progressRevision: 0,
    progress: {},
    ...overrides,
  };
}

function applied(
  request: PlanActivityCheckRequest,
  progressRevision: number,
  progress: Record<string, boolean>,
): PlanActivityCheckResponse {
  return {
    status: "applied",
    planId: PLAN_ID,
    planRevision: request.planRevision,
    progressRevision,
    progress,
    checkKey: request.checkKey,
    done: request.done,
  };
}

function toggle(
  controller: AuthenticatedPlanCheckController,
  checkKey: string,
  overrides: Partial<{ childId: string; subjectId: string }> = {},
): void {
  controller.toggle({
    childId: CHILD_A,
    subjectId: "math",
    checkKey,
    expectedText: `Activity ${checkKey}`,
    ...overrides,
  });
}

describe("authenticated Planner check controller", () => {
  it("serializes true then false for the same key and ends at the second intent", async () => {
    const calls: PlanActivityCheckRequest[] = [];
    const first = deferred<PlanActivityCheckResponse>();
    const second = deferred<PlanActivityCheckResponse>();
    const controller = new AuthenticatedPlanCheckController(
      [seed()],
      async (request) => {
        calls.push(request);
        return calls.length === 1 ? await first.promise : await second.promise;
      },
    );

    toggle(controller, "1.0");
    toggle(controller, "1.0");
    await eventually(() => assert.equal(calls.length, 1));
    assert.equal(calls[0].done, true);
    assert.equal(controller.isChecked(CHILD_A, "math", "1.0"), false);
    assert.equal(controller.isPending(CHILD_A, "math", "1.0"), true);

    first.resolve(applied(calls[0], 1, { "1.0": true }));
    await eventually(() => assert.equal(calls.length, 2));
    assert.equal(calls[1].done, false);
    second.resolve(applied(calls[1], 2, { "1.0": false }));
    await controller.settled();

    assert.equal(controller.isChecked(CHILD_A, "math", "1.0"), false);
    assert.equal(controller.isPending(CHILD_A, "math", "1.0"), false);
  });

  it("runs different keys concurrently and ignores a delayed older snapshot", async () => {
    const calls: PlanActivityCheckRequest[] = [];
    const receipts = new Map<string, Deferred<PlanActivityCheckResponse>>([
      ["1.0", deferred<PlanActivityCheckResponse>()],
      ["1.1", deferred<PlanActivityCheckResponse>()],
    ]);
    const controller = new AuthenticatedPlanCheckController(
      [seed()],
      async (request) => {
        calls.push(request);
        return await receipts.get(request.checkKey)!.promise;
      },
    );

    toggle(controller, "1.0");
    toggle(controller, "1.1");
    await eventually(() => assert.equal(calls.length, 2));

    const first = calls.find((call) => call.checkKey === "1.0")!;
    const second = calls.find((call) => call.checkKey === "1.1")!;
    receipts.get("1.1")!.resolve(
      applied(second, 12, { "1.0": true, "1.1": true }),
    );
    receipts.get("1.0")!.resolve(applied(first, 11, { "1.0": true }));
    await controller.settled();

    assert.equal(controller.isChecked(CHILD_A, "math", "1.0"), true);
    assert.equal(controller.isChecked(CHILD_A, "math", "1.1"), true);
  });

  it("keeps a refreshed newer server seed over a delayed response", async () => {
    const receipt = deferred<PlanActivityCheckResponse>();
    let request!: PlanActivityCheckRequest;
    const controller = new AuthenticatedPlanCheckController(
      [seed({ progressRevision: 11 })],
      async (input) => {
        request = input;
        return await receipt.promise;
      },
    );

    toggle(controller, "1.0");
    await eventually(() => assert.ok(request));
    controller.replaceSeeds([
      seed({ progressRevision: 13, progress: { "1.0": false } }),
    ]);
    receipt.resolve(applied(request, 12, { "1.0": true }));
    await controller.settled();

    assert.equal(controller.isChecked(CHILD_A, "math", "1.0"), false);
  });

  it("rejects a delayed lower-revision refresh seed", () => {
    const controller = new AuthenticatedPlanCheckController([
      seed({ progressRevision: 13, progress: { "1.0": true } }),
    ]);

    controller.replaceSeeds([
      seed({ progressRevision: 12, progress: { "1.0": false } }),
    ]);

    assert.equal(controller.isChecked(CHILD_A, "math", "1.0"), true);
  });

  it("treats a response whose snapshot contradicts done as uncertain", async () => {
    let refreshes = 0;
    const controller = new AuthenticatedPlanCheckController(
      [seed()],
      async (request) => ({
        ...applied(request, 1, { "1.0": false }),
        done: true,
      }),
      () => {
        refreshes += 1;
      },
      { reconciliationDelaysMs: [] },
    );

    toggle(controller, "1.0");
    await controller.settled();

    assert.equal(refreshes, 1);
    assert.equal(controller.isChecked(CHILD_A, "math", "1.0"), false);
    assert.match(controller.getMessage() ?? "", /refreshing from the server/u);
  });

  it("clears every echo and reconciles after each in-flight completion", async () => {
    const calls: PlanActivityCheckRequest[] = [];
    const receipts = new Map<string, Deferred<PlanActivityCheckResponse>>([
      ["1.0", deferred<PlanActivityCheckResponse>()],
      ["1.1", deferred<PlanActivityCheckResponse>()],
    ]);
    let refreshes = 0;
    const controller = new AuthenticatedPlanCheckController(
      [seed()],
      async (request) => {
        calls.push(request);
        return await receipts.get(request.checkKey)!.promise;
      },
      () => {
        refreshes += 1;
      },
      { reconciliationDelaysMs: [] },
    );

    toggle(controller, "1.0");
    toggle(controller, "1.1");
    await eventually(() => assert.equal(calls.length, 2));
    receipts.get("1.0")!.resolve({
      status: "conflict",
      reason: "revision-mismatch",
      planId: PLAN_ID,
      planRevision: 2,
      progressRevision: 3,
      checkKey: "1.0",
    });
    await eventually(() => assert.equal(refreshes, 1));

    assert.equal(controller.isPending(CHILD_A, "math", "1.0"), false);
    assert.equal(controller.isPending(CHILD_A, "math", "1.1"), false);
    assert.equal(controller.isWritable(CHILD_A, "math"), false);
    assert.match(controller.getMessage() ?? "", /check was not changed/u);

    const callsBeforeBlockedTap = calls.length;
    toggle(controller, "1.0");
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(calls.length, callsBeforeBlockedTap);

    const delayed = calls.find((call) => call.checkKey === "1.1")!;
    receipts.get("1.1")!.resolve(applied(delayed, 4, { "1.1": true }));
    await controller.settled();
    assert.equal(controller.isChecked(CHILD_A, "math", "1.1"), false);
    assert.equal(refreshes, 2);
    controller.replaceSeeds([
      seed({ planRevision: 2, progressRevision: 0, progress: {} }),
    ]);
    assert.equal(controller.isWritable(CHILD_A, "math"), true);
  });

  it("refreshes again when a valid in-flight key finishes after a conflict", async () => {
    const calls: PlanActivityCheckRequest[] = [];
    const receipts = new Map<string, Deferred<PlanActivityCheckResponse>>([
      ["1.0", deferred<PlanActivityCheckResponse>()],
      ["1.1", deferred<PlanActivityCheckResponse>()],
    ]);
    let refreshes = 0;
    const controller = new AuthenticatedPlanCheckController(
      [seed()],
      async (request) => {
        calls.push(request);
        return await receipts.get(request.checkKey)!.promise;
      },
      () => {
        refreshes += 1;
      },
      { reconciliationDelaysMs: [] },
    );

    toggle(controller, "1.0");
    toggle(controller, "1.1");
    await eventually(() => assert.equal(calls.length, 2));
    receipts.get("1.0")!.resolve({
      status: "conflict",
      reason: "activity-mismatch",
      planId: PLAN_ID,
      planRevision: 1,
      progressRevision: 0,
      checkKey: "1.0",
    });
    await eventually(() => assert.equal(refreshes, 1));

    const valid = calls.find((call) => call.checkKey === "1.1")!;
    receipts.get("1.1")!.resolve(applied(valid, 1, { "1.1": true }));
    await controller.settled();
    assert.equal(refreshes, 2);
  });

  it("bounds a hung request, refreshes uncertainty, and drains the same-key queue", async () => {
    let refreshes = 0;
    const neverResolvingFetch: typeof fetch = async (_url, init) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true },
        );
      });
    const controller = new AuthenticatedPlanCheckController(
      [seed()],
      async (request) =>
        await requestPlanActivityCheck(request, {
          fetcher: neverResolvingFetch,
          timeoutMs: 5,
        }),
      () => {
        refreshes += 1;
      },
      { reconciliationDelaysMs: [] },
    );

    toggle(controller, "1.0");
    toggle(controller, "1.0");
    await controller.settled();

    assert.equal(refreshes, 1);
    assert.equal(controller.isPending(CHILD_A, "math", "1.0"), false);
    assert.match(controller.getMessage() ?? "", /refreshing from the server/u);
  });

  it("keeps the deadline active while a response body is stalled", async () => {
    let refreshes = 0;
    const stalledBodyFetch: typeof fetch = async (_url, init) =>
      ({
        ok: true,
        status: 200,
        json: async () =>
          await new Promise<unknown>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new Error("body aborted")),
              { once: true },
            );
          }),
      }) as Response;
    const controller = new AuthenticatedPlanCheckController(
      [seed()],
      async (request) =>
        await requestPlanActivityCheck(request, {
          fetcher: stalledBodyFetch,
          timeoutMs: 5,
        }),
      () => {
        refreshes += 1;
      },
      { reconciliationDelaysMs: [] },
    );

    toggle(controller, "1.0");
    await controller.settled();

    assert.equal(refreshes, 1);
    assert.equal(controller.isPending(CHILD_A, "math", "1.0"), false);
    assert.match(controller.getMessage() ?? "", /refreshing from the server/u);
  });

  it("refreshes after network ambiguity instead of claiming a rollback", async () => {
    let refreshes = 0;
    const controller = new AuthenticatedPlanCheckController(
      [seed()],
      async () => {
        throw new Error("response lost after commit");
      },
      () => {
        refreshes += 1;
      },
      { reconciliationDelaysMs: [] },
    );

    toggle(controller, "1.0");
    await controller.settled();

    assert.equal(refreshes, 1);
    assert.equal(controller.isPending(CHILD_A, "math", "1.0"), false);
    assert.match(controller.getMessage() ?? "", /refreshing from the server/u);
  });

  it("never replays an uncertain write and reconciles a later cross-device state", async () => {
    const calls: PlanActivityCheckRequest[] = [];
    let serverProgress = true;
    let refreshes = 0;
    const controller = new AuthenticatedPlanCheckController(
      [seed()],
      async (request) => {
        calls.push(request);
        // This device may have committed true, then another device committed
        // false before the first receipt was lost. Replaying true here would
        // overwrite the newer parent intent.
        serverProgress = false;
        throw new Error("receipt lost after a later device write");
      },
      () => {
        refreshes += 1;
        controller.replaceSeeds([
          seed({
            progressRevision: refreshes,
            progress: { "1.0": serverProgress },
          }),
        ]);
      },
      { reconciliationDelaysMs: [1, 5] },
    );

    toggle(controller, "1.0");
    await controller.settled();
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    assert.equal(calls.length, 1);
    assert.equal(refreshes, 3);
    assert.equal(controller.isChecked(CHILD_A, "math", "1.0"), false);
    assert.equal(controller.isPending(CHILD_A, "math", "1.0"), false);
    assert.match(controller.getMessage() ?? "", /refreshing from the server/u);
    controller.dispose();
  });

  it("deduplicates simultaneous uncertain keys into one plan reconciliation", async () => {
    const requests = new Map<string, Deferred<PlanActivityCheckResponse>>([
      ["1.0", deferred<PlanActivityCheckResponse>()],
      ["1.1", deferred<PlanActivityCheckResponse>()],
    ]);
    let refreshes = 0;
    const controller = new AuthenticatedPlanCheckController(
      [seed()],
      async (request) => await requests.get(request.checkKey)!.promise,
      () => {
        refreshes += 1;
      },
      { reconciliationDelaysMs: [1, 5] },
    );

    toggle(controller, "1.0");
    toggle(controller, "1.1");
    requests.get("1.0")!.reject(new Error("offline"));
    requests.get("1.1")!.reject(new Error("offline"));
    await controller.settled();
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    assert.equal(refreshes, 3);
    assert.equal(controller.isWritable(CHILD_A, "math"), false);
    controller.dispose();
  });

  it("invalidates an in-flight request when the plan meaning changes", async () => {
    const receipt = deferred<PlanActivityCheckResponse>();
    let request!: PlanActivityCheckRequest;
    let refreshes = 0;
    const controller = new AuthenticatedPlanCheckController(
      [seed()],
      async (input) => {
        request = input;
        return await receipt.promise;
      },
      () => {
        refreshes += 1;
      },
    );

    toggle(controller, "1.0");
    await eventually(() => assert.ok(request));
    controller.replaceSeeds([
      seed({ planRevision: 2, progressRevision: 0, progress: {} }),
    ]);
    assert.equal(controller.isPending(CHILD_A, "math", "1.0"), false);
    assert.equal(refreshes, 0);
    assert.match(controller.getMessage() ?? "", /server copy/u);

    receipt.resolve(applied(request, 1, { "1.0": true }));
    await controller.settled();
    assert.equal(controller.isChecked(CHILD_A, "math", "1.0"), false);
  });

  it("isolates child and subject scopes", async () => {
    const controller = new AuthenticatedPlanCheckController(
      [
        seed(),
        seed({ subjectId: "reading" }),
        seed({ childId: CHILD_B }),
      ],
      async (request) => applied(request, 1, { [request.checkKey]: true }),
    );

    toggle(controller, "1.0");
    await controller.settled();

    assert.equal(controller.isChecked(CHILD_A, "math", "1.0"), true);
    assert.equal(controller.isChecked(CHILD_A, "reading", "1.0"), false);
    assert.equal(controller.isChecked(CHILD_B, "math", "1.0"), false);
  });

  it("makes tokenless persisted plans writable and provisional plans read-only", () => {
    const base: DashboardPlan = {
      childId: CHILD_A,
      subjectId: "math",
      planRevision: 1,
      progressRevision: 0,
      done: 0,
      total: 1,
      retestAt: "2026-08-31T00:00:00.000Z",
      weeks: [{ week: 1, focus: "counting", activities: ["Count buttons"] }],
      progress: {},
      activitySources: {},
    };
    const seeds = authenticatedPlanCheckSeeds([
      base,
      {
        ...base,
        childId: CHILD_B,
        planRevision: null,
        progressRevision: null,
        provisional: true,
      },
    ]);
    const controller = new AuthenticatedPlanCheckController(seeds);

    assert.equal(controller.isWritable(CHILD_A, "math"), true);
    assert.equal(controller.isWritable(CHILD_B, "math"), false);
  });
});
