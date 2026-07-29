import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  tierForStripeProduct,
  tierForStripeProductRecognized,
} from "./wall";

/**
 * A family gets the tier she paid for, even if she closes the tab (gh#298).
 *
 * The checkout webhook used to pass no tier at all, leaving plan_tier to
 * the confirm route the buyer lands on after Stripe. That is a promise
 * the buyer does not have to keep. While nothing read plan_tier this was
 * harmless; the moment the channel gate turns on it means denying text,
 * phone, and email to someone who just bought exactly those.
 *
 * The fix has a trap in it, which these tests exist to hold shut.
 * plan_tier is written with `coalesce(tier, plan_tier)`, so null leaves
 * the row alone and any non-null value overwrites it. Resolving an
 * unmapped product to "regular", which is the right answer for a confirm
 * page, would therefore DOWNGRADE a Plus family from an unattended
 * handler.
 */

const PLUS_PRODUCT = "prod_Uq3Syk3GadgBVg";
const REGULAR_PRODUCT = "prod_Uq02Zo8DUidRnH";
const ELITE_PRODUCT = "prod_Ux4oRdW3a7ug6H";

describe("tierForStripeProductRecognized", () => {
  it("resolves each sold tier from its product id", () => {
    assert.equal(tierForStripeProductRecognized(REGULAR_PRODUCT), "regular");
    assert.equal(tierForStripeProductRecognized(PLUS_PRODUCT), "plus");
    assert.equal(tierForStripeProductRecognized(ELITE_PRODUCT), "elite");
  });

  it("returns null for a product it has never heard of, so plan_tier is left alone", () => {
    assert.equal(tierForStripeProductRecognized("prod_not_in_the_map"), null);
  });

  it("returns null for a missing product rather than guessing a plan", () => {
    assert.equal(tierForStripeProductRecognized(null), null);
    assert.equal(tierForStripeProductRecognized(undefined), null);
    assert.equal(tierForStripeProductRecognized(""), null);
  });

  it("differs from the confirm-route resolver exactly where it matters", () => {
    // The lenient twin answers "regular" for an unknown id, which is
    // right in front of a human and wrong in a writer.
    assert.equal(tierForStripeProduct("prod_not_in_the_map"), "regular");
    assert.equal(tierForStripeProductRecognized("prod_not_in_the_map"), null);
  });
});

describe("the checkout webhook", () => {
  const source = readFileSync(
    path.join(
      path.resolve(import.meta.dirname, "..", "..", "app", "api", "billing", "webhook"),
      "route.ts",
    ),
    "utf8",
  );

  it("passes a purchased tier to startFamilyTrial", () => {
    assert.match(
      source,
      /startFamilyTrial\(familyId, customerId, purchasedTier\)/u,
      "the webhook must stamp the tier the family actually bought",
    );
  });

  it("resolves that tier with the recognized-only variant, never the lenient one", () => {
    assert.match(source, /tierForStripeProductRecognized\(/u);
    assert.ok(
      !/[^d]tierForStripeProduct\(/u.test(source),
      "the lenient resolver would downgrade a Plus family on an unmapped id",
    );
  });

  it("retrieves the subscription before stamping, since that is where the product is", () => {
    const retrieveAt = source.indexOf("stripe.subscriptions.retrieve");
    const stampAt = source.indexOf("startFamilyTrial(familyId, customerId, purchasedTier)");
    assert.ok(retrieveAt > 0 && stampAt > 0);
    assert.ok(
      retrieveAt < stampAt,
      "resolving the tier after the stamp would leave plan_tier unset again",
    );
  });
});
