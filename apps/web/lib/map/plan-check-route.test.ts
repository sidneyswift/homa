import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PlanActivityCheckRequest } from "@homa/core";

import {
  createPlanActivityCheckHandler,
  type PlanActivityCheckRouteDependencies,
  type PlanActivityCheckRpcResult,
} from "./plan-check-route";

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECOND_FAMILY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD_ID = "11111111-1111-4111-8111-111111111111";
const PLAN_ID = "22222222-2222-4222-8222-222222222222";

const INPUT: PlanActivityCheckRequest = {
  childId: CHILD_ID,
  subjectId: "math",
  checkKey: "1.0",
  done: true,
  expectedText: "Count buttons",
  planRevision: 7,
};

function appliedReceipt(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    status: "applied",
    reason: null,
    family_id: FAMILY_ID,
    plan_id: PLAN_ID,
    plan_revision: "7",
    progress_revision: "12",
    progress_snapshot: { "1.0": true },
    progress_key: "1.0",
    done: true,
    changed: true,
    ...overrides,
  };
}

function request(body: unknown = INPUT): Request {
  return new Request("https://homa.example/api/map/plan/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function dependencies(
  overrides: Partial<PlanActivityCheckRouteDependencies> = {},
): PlanActivityCheckRouteDependencies {
  return {
    isRateLimited: () => false,
    authorize: async () => ({
      execute: async () => ({ data: [appliedReceipt()], error: null }),
    }),
    emitProgress: async () => undefined,
    ...overrides,
  };
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("atomic Planner check route", () => {
  it("passes the validated meaning to the authorized actor and returns a typed snapshot", async () => {
    const calls: PlanActivityCheckRequest[] = [];
    const events: unknown[] = [];
    const handler = createPlanActivityCheckHandler(
      dependencies({
        authorize: async () => ({
          execute: async (input) => {
            calls.push(input);
            return { data: [appliedReceipt()], error: null };
          },
        }),
        emitProgress: async (event) => {
          events.push(event);
        },
      }),
    );

    const response = await handler(request());
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [INPUT]);
    assert.deepEqual(await json(response), {
      status: "applied",
      planId: PLAN_ID,
      planRevision: 7,
      progressRevision: 12,
      progress: { "1.0": true },
      checkKey: "1.0",
      done: true,
    });
    assert.deepEqual(events, [
      {
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        subjectId: "math",
        doneCount: 1,
      },
    ]);
  });

  it("rejects rate limits, missing auth, invalid JSON, and forged authority before a write", async () => {
    let writes = 0;
    const actor = {
      execute: async (): Promise<PlanActivityCheckRpcResult> => {
        writes += 1;
        return { data: [appliedReceipt()], error: null };
      },
    };

    const limited = createPlanActivityCheckHandler(
      dependencies({ isRateLimited: () => true, authorize: async () => actor }),
    );
    assert.equal((await limited(request())).status, 429);

    const unauthenticated = createPlanActivityCheckHandler(
      dependencies({ authorize: async () => null }),
    );
    assert.equal((await unauthenticated(request())).status, 401);

    const invalidJson = new Request("https://homa.example/api/map/plan/check", {
      method: "POST",
      body: "{",
    });
    const handler = createPlanActivityCheckHandler(
      dependencies({ authorize: async () => actor }),
    );
    assert.equal((await handler(invalidJson)).status, 400);
    assert.equal(
      (
        await handler(
          request({ ...INPUT, familyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await handler(
          request({ ...INPUT, checkKey: `1.${"9".repeat(1_000)}` }),
        )
      ).status,
      400,
    );
    assert.equal(writes, 0);
  });

  it("maps a typed conflict to 409 and never returns a stale progress map", async () => {
    let events = 0;
    const handler = createPlanActivityCheckHandler(
      dependencies({
        authorize: async () => ({
          execute: async () => ({
            data: [
              {
                status: "conflict",
                reason: "revision-mismatch",
                family_id: FAMILY_ID,
                plan_id: PLAN_ID,
                plan_revision: 8,
                progress_revision: 13,
                progress_snapshot: null,
                progress_key: "1.0",
                done: null,
                changed: null,
              },
            ],
            error: null,
          }),
        }),
        emitProgress: async () => {
          events += 1;
        },
      }),
    );

    const response = await handler(request());
    const body = await json(response);
    assert.equal(response.status, 409);
    assert.equal(body.status, "conflict");
    assert.equal("progress" in body, false);
    assert.equal(events, 0);
  });

  it("fails closed on thrown, missing, duplicate, malformed, or mismatched receipts", async () => {
    const results: Array<() => Promise<PlanActivityCheckRpcResult>> = [
      async () => {
        throw new Error("connection lost");
      },
      async () => ({ data: [], error: null }),
      async () => ({ data: [appliedReceipt(), appliedReceipt()], error: null }),
      async () => ({ data: [{ status: "applied" }], error: null }),
      async () => ({
        data: [appliedReceipt({ progress_key: "1.1" })],
        error: null,
      }),
      async () => ({ data: [appliedReceipt({ done: false })], error: null }),
      async () => ({
        data: [appliedReceipt({ progress_snapshot: { "1.0": false } })],
        error: null,
      }),
      async () => ({
        data: [appliedReceipt({ plan_revision: 8 })],
        error: null,
      }),
    ];

    for (const execute of results) {
      const handler = createPlanActivityCheckHandler(
        dependencies({
          authorize: async () => ({ execute }),
        }),
      );
      assert.equal((await handler(request())).status, 502);
    }
  });

  it("keeps the committed success when analytics fails", async () => {
    const handler = createPlanActivityCheckHandler(
      dependencies({
        emitProgress: async () => {
          throw new Error("analytics unavailable");
        },
      }),
    );
    const response = await handler(request());
    assert.equal(response.status, 200);
    assert.equal((await json(response)).status, "applied");
  });

  it("attributes a multi-family write only from the database receipt", async () => {
    const events: Array<{ familyId: string }> = [];
    const handler = createPlanActivityCheckHandler(
      dependencies({
        authorize: async () => ({
          execute: async () => ({
            data: [appliedReceipt({ family_id: SECOND_FAMILY_ID })],
            error: null,
          }),
        }),
        emitProgress: async (event) => {
          events.push(event);
        },
      }),
    );

    assert.equal((await handler(request())).status, 200);
    assert.deepEqual(events.map((event) => event.familyId), [SECOND_FAMILY_ID]);
  });

  it("does not emit for an idempotent no-op receipt", async () => {
    let events = 0;
    const handler = createPlanActivityCheckHandler(
      dependencies({
        authorize: async () => ({
          execute: async () => ({
            data: [appliedReceipt({ changed: false })],
            error: null,
          }),
        }),
        emitProgress: async () => {
          events += 1;
        },
      }),
    );

    assert.equal((await handler(request())).status, 200);
    assert.equal(events, 0);
  });

  it("returns the committed receipt when analytics never resolves", async () => {
    const handler = createPlanActivityCheckHandler(
      dependencies({
        analyticsTimeoutMs: 5,
        emitProgress: async () => await new Promise<void>(() => undefined),
      }),
    );
    const response = await Promise.race([
      handler(request()),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error("route waited for analytics")), 100);
      }),
    ]);

    assert.equal(response.status, 200);
    assert.equal((await json(response)).status, "applied");
  });
});
