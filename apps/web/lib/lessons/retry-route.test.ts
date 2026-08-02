import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createLessonRetryHandler,
  type LessonRetryRouteDependencies,
} from "./retry-route";

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOREIGN_FAMILY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LESSON_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function request(body?: unknown): Request {
  return new Request(`https://homa.example/api/lessons/${LESSON_ID}/retry`, {
    method: "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function dependencies(
  overrides: Partial<LessonRetryRouteDependencies> = {},
): LessonRetryRouteDependencies {
  return {
    authorize: async () => ({ status: "ok", familyId: FAMILY_ID }),
    requestRetry: async () => ({ status: "queued", attempts: 1 }),
    runAnalysis: async () => ({ status: "ready" }),
    getRetryState: async () => ({ status: "ready", attempts: 2 }),
    ...overrides,
  };
}

async function run(
  handler: ReturnType<typeof createLessonRetryHandler>,
  lessonId = LESSON_ID,
  body?: unknown,
): Promise<Response> {
  return await handler(request(body), {
    params: Promise.resolve({ lessonId }),
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("recorded lesson retry route", () => {
  it("uses only the authorized family and ignores forged body authority", async () => {
    const calls: Array<{ lessonId: string; familyId: string }> = [];
    const handler = createLessonRetryHandler(
      dependencies({
        requestRetry: async (lessonId, familyId) => {
          calls.push({ lessonId, familyId });
          return { status: "not_found" };
        },
      }),
    );
    const response = await run(handler, LESSON_ID, {
      familyId: FOREIGN_FAMILY_ID,
      attempts: 0,
    });
    assert.equal(response.status, 404);
    assert.deepEqual(calls, [{ lessonId: LESSON_ID, familyId: FAMILY_ID }]);
  });

  it("passes through the shared authentication refusal", async () => {
    let effects = 0;
    const handler = createLessonRetryHandler(
      dependencies({
        authorize: async () => ({
          status: "refused",
          response: Response.json({ ok: false, reason: "no-session" }, { status: 401 }),
        }),
        requestRetry: async () => {
          effects += 1;
          return { status: "queued", attempts: 1 };
        },
      }),
    );
    assert.equal((await run(handler)).status, 401);
    assert.equal(effects, 0);
  });

  it("rejects an invalid lesson id before durable work", async () => {
    let effects = 0;
    const handler = createLessonRetryHandler(
      dependencies({
        requestRetry: async () => {
          effects += 1;
          return { status: "queued", attempts: 1 };
        },
      }),
    );
    assert.equal((await run(handler, "not-a-uuid")).status, 400);
    assert.equal(effects, 0);
  });

  it("runs one accepted retry and reports ready", async () => {
    let analyses = 0;
    const handler = createLessonRetryHandler(
      dependencies({
        runAnalysis: async () => {
          analyses += 1;
          return { status: "ready" };
        },
      }),
    );
    const response = await run(handler);
    assert.equal(response.status, 200);
    assert.deepEqual(await json(response), {
      ok: true,
      status: "ready",
      retryable: false,
    });
    assert.equal(analyses, 1);
  });

  it("reports processing when worker kickoff fails after durable acceptance", async () => {
    const handler = createLessonRetryHandler(
      dependencies({
        runAnalysis: async () => {
          throw new Error("claim connection dropped");
        },
      }),
    );
    const response = await run(handler);
    assert.equal(response.status, 202);
    assert.deepEqual(await json(response), {
      ok: true,
      status: "processing",
      retryable: false,
    });
  });

  it("reports refusal when durable retry acceptance itself fails", async () => {
    let analyses = 0;
    const handler = createLessonRetryHandler(
      dependencies({
        requestRetry: async () => {
          throw new Error("database unavailable");
        },
        runAnalysis: async () => {
          analyses += 1;
          return { status: "ready" };
        },
      }),
    );
    const response = await run(handler);
    assert.equal(response.status, 502);
    assert.deepEqual(await json(response), {
      ok: false,
      reason: "retry-failed",
    });
    assert.equal(analyses, 0);
  });

  it("keeps a newly failed attempt retryable when capacity remains", async () => {
    const handler = createLessonRetryHandler(
      dependencies({
        runAnalysis: async () => ({ status: "failed" }),
        getRetryState: async () => ({ status: "available", attempts: 2 }),
      }),
    );
    const response = await run(handler);
    assert.equal(response.status, 200);
    assert.deepEqual(await json(response), {
      ok: true,
      status: "review_failed",
      reason: "review-failed",
      retryable: true,
    });
  });

  it("does no analysis for exhausted or unavailable source states", async () => {
    for (const current of ["exhausted", "source_unavailable"] as const) {
      let analyses = 0;
      const handler = createLessonRetryHandler(
        dependencies({
          requestRetry: async () => ({ status: current, attempts: 4 }),
          runAnalysis: async () => {
            analyses += 1;
            return { status: "ready" };
          },
        }),
      );
      const response = await run(handler);
      assert.equal(response.status, 409);
      assert.equal((await json(response)).retryable, false);
      assert.equal(analyses, 0);
    }
  });

  it("lets duplicate requests converge on one analysis claim", async () => {
    let requested = 0;
    let claimed = false;
    let claims = 0;
    const handler = createLessonRetryHandler(
      dependencies({
        requestRetry: async () => {
          requested += 1;
          return requested === 1
            ? { status: "queued", attempts: 1 }
            : { status: "processing", attempts: 1 };
        },
        runAnalysis: async () => {
          if (claimed) return { status: "not_claimable" };
          claimed = true;
          claims += 1;
          return { status: "requeued" };
        },
        getRetryState: async () => ({ status: "processing", attempts: 2 }),
      }),
    );
    const responses = await Promise.all([run(handler), run(handler)]);
    assert.deepEqual(responses.map((response) => response.status), [202, 202]);
    assert.equal(claims, 1);
  });
});
