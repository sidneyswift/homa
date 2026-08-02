import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { requestLessonReviewRetry } from "./retry-client";

const LESSON_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("web lesson retry client", () => {
  it("posts only to the dedicated retry route", async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const result = await requestLessonReviewRetry(async (input, init) => {
      calls.push({ input, init });
      return Response.json({ ok: true, status: "processing", retryable: false }, { status: 202 });
    }, LESSON_ID);
    assert.deepEqual(result, { status: "refresh" });
    assert.equal(calls[0]?.input, `/api/lessons/${LESSON_ID}/retry`);
    assert.deepEqual(calls[0]?.init, { method: "POST" });
  });

  it("does not refresh after a server refusal", async () => {
    const result = await requestLessonReviewRetry(
      async () => Response.json(
        { ok: false, reason: "attempts-exhausted", retryable: false },
        { status: 409 },
      ),
      LESSON_ID,
    );
    assert.equal(result.status, "refused");
    assert.match(result.status === "refused" ? result.message : "", /every safe pass/u);
  });

  it("keeps the retry control after another retryable review failure", async () => {
    const result = await requestLessonReviewRetry(
      async () => Response.json({
        ok: true,
        status: "review_failed",
        reason: "review-failed",
        retryable: true,
      }),
      LESSON_ID,
    );
    assert.equal(result.status, "stayed_failed");
  });

  it("shows a stable inline refusal when the network misses", async () => {
    const result = await requestLessonReviewRetry(
      async () => {
        throw new Error("offline");
      },
      LESSON_ID,
    );
    assert.equal(result.status, "refused");
    assert.match(result.status === "refused" ? result.message : "", /connection/u);
  });
});
