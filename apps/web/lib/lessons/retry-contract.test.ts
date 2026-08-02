import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const storeSource = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
const retryRouteSource = readFileSync(
  new URL("../../app/api/lessons/[lessonId]/retry/route.ts", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL("../../app/app/lessons/[lessonId]/page.tsx", import.meta.url),
  "utf8",
);
const clientSource = readFileSync(
  new URL("../../app/app/lessons/[lessonId]/review-client.tsx", import.meta.url),
  "utf8",
);

describe("recorded lesson retry wiring contract", () => {
  it("serializes requeue under a family-scoped row lock without resetting attempts", () => {
    const start = storeSource.indexOf(
      "export async function requestLessonAnalysisRetry",
    );
    const end = storeSource.indexOf("export async function claimLessonAnalysis", start);
    const retrySource = storeSource.slice(start, end);
    assert.match(retrySource, /sql\.begin/u);
    assert.match(retrySource, /family_id = \$\{familyId\}[\s\S]*?for update/u);
    assert.match(retrySource, /status = 'failed'/u);
    assert.match(retrySource, /attempts < \$\{MAX_ANALYSIS_ATTEMPTS\}/u);
    assert.match(retrySource, /set status = 'uploaded', analysis_claimed_at = null/u);
    assert.doesNotMatch(retrySource, /set[\s\S]*?attempts\s*=/u);
  });

  it("never re-emits the original recording event", () => {
    assert.doesNotMatch(retryRouteSource, /from .*map\/events/u);
    assert.doesNotMatch(retryRouteSource, /emitMapEvent\(/u);
  });

  it("renders the button only from durable eligibility and exposes refusals", () => {
    assert.match(
      pageSource,
      /retryState\.status === "available"[\s\S]*?<RetryLessonAnalysis/u,
    );
    assert.match(clientSource, /requestLessonReviewRetry\(fetch, lessonId\)/u);
    assert.match(clientSource, /role="alert"/u);
    assert.doesNotMatch(clientSource, /\/finish/u);
  });
});
