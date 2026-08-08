import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CHECKOUT_INTENT_MAX_TTL_MS,
  mintCheckoutIntent,
  verifyCheckoutIntent,
} from "./checkout-intent";

const FAMILY_ID = "00000000-0000-4000-8000-000000000411";
const OTHER_FAMILY_ID = "00000000-0000-4000-8000-000000000412";
const SECRET = "checkout-intent-test-secret-at-least-32-bytes";
const NOW_MS = Date.UTC(2026, 7, 8, 18, 0, 0);

describe("checkout intent", () => {
  it("round-trips only the exact family and purchase choice", () => {
    const token = mintCheckoutIntent(
      { familyId: FAMILY_ID, tier: "plus", billingPeriod: "annual" },
      { secret: SECRET, nowMs: NOW_MS },
    );

    assert.deepEqual(
      verifyCheckoutIntent(token, {
        secret: SECRET,
        expected: { familyId: FAMILY_ID, tier: "plus", billingPeriod: "annual" },
        nowMs: NOW_MS + 1_000,
      }),
      {
        familyId: FAMILY_ID,
        tier: "plus",
        billingPeriod: "annual",
        expiresAtMs: NOW_MS + CHECKOUT_INTENT_MAX_TTL_MS,
      },
    );

    const [encodedPayload] = token.split(".");
    assert.ok(encodedPayload);
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as object;
    assert.deepEqual(Object.keys(payload).sort(), ["e", "f", "i", "p", "t", "v"]);
    assert.doesNotMatch(JSON.stringify(payload), /email|@/iu);
  });

  it("rejects expired, tampered, and cross-boundary intents", () => {
    const token = mintCheckoutIntent(
      { familyId: FAMILY_ID, tier: "regular", billingPeriod: "monthly" },
      { secret: SECRET, nowMs: NOW_MS },
    );
    const expected = {
      familyId: FAMILY_ID,
      tier: "regular" as const,
      billingPeriod: "monthly" as const,
    };

    assert.equal(
      verifyCheckoutIntent(token, {
        secret: SECRET,
        expected,
        nowMs: NOW_MS + CHECKOUT_INTENT_MAX_TTL_MS,
      }),
      null,
    );

    const [payload, signature] = token.split(".");
    assert.ok(payload && signature);
    const replacement = signature.endsWith("A") ? "B" : "A";
    assert.equal(
      verifyCheckoutIntent(`${payload}.${signature.slice(0, -1)}${replacement}`, {
        secret: SECRET,
        expected,
        nowMs: NOW_MS + 1,
      }),
      null,
    );

    assert.equal(
      verifyCheckoutIntent(token, {
        secret: SECRET,
        expected: { ...expected, tier: "plus" },
        nowMs: NOW_MS + 1,
      }),
      null,
    );
    assert.equal(
      verifyCheckoutIntent(token, {
        secret: SECRET,
        expected: { ...expected, billingPeriod: "annual" },
        nowMs: NOW_MS + 1,
      }),
      null,
    );
    assert.equal(
      verifyCheckoutIntent(token, {
        secret: SECRET,
        expected: { ...expected, familyId: OTHER_FAMILY_ID },
        nowMs: NOW_MS + 1,
      }),
      null,
    );
  });

  it("requires an explicit strong secret and a bounded lifetime", () => {
    assert.throws(
      () =>
        mintCheckoutIntent(
          { familyId: FAMILY_ID, tier: "regular", billingPeriod: "monthly" },
          { secret: "short", nowMs: NOW_MS },
        ),
      /at least 32 bytes/u,
    );
    assert.throws(
      () =>
        mintCheckoutIntent(
          { familyId: FAMILY_ID, tier: "regular", billingPeriod: "monthly" },
          {
            secret: SECRET,
            nowMs: NOW_MS,
            ttlMs: CHECKOUT_INTENT_MAX_TTL_MS + 1,
          },
        ),
      /ttl/u,
    );
  });
});
