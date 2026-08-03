import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("./onboarding-card-api.ts", import.meta.url),
  "utf8",
);

describe("mobile onboarding card API contract", () => {
  it("authenticates JSON routes with the fresh mobile bearer token", () => {
    assert.match(source, /supabase\.auth\.getSession\(\)/u);
    assert.match(source, /Authorization: `Bearer \$\{token\}`/u);
    assert.match(source, /\.\.\.EVE_CHANNEL_HEADER/u);
  });

  it("never accepts or sends a client-selected family id", () => {
    assert.doesNotMatch(source, /familyId/u);
  });

  it("gives every checklist answer a UUID idempotency key", () => {
    assert.match(source, /idempotencyKey: createIdempotencyKey\(\)/u);
  });

  it("opens reports by token instead of exposing child or family identity", () => {
    assert.match(source, /\/onboarding\/r\/\$\{encodeURIComponent\(token\)\}/u);
  });

  it("polls the family-scoped first-making status endpoint", () => {
    assert.match(source, /\/api\/onboarding\/making-status\?jobId=/u);
    assert.match(source, /fetchMakingStatus/u);
  });
});
