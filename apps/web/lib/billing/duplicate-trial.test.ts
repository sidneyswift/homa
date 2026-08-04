import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { stripeTrialCardFingerprint } from "./duplicate-trial";

describe("stripeTrialCardFingerprint", () => {
  it("uses an exact card fingerprint from the subscription's payment method", async () => {
    const fingerprint = await stripeTrialCardFingerprint(
      {
        paymentMethods: {
          retrieve: async () => ({
            id: "pm_card",
            type: "card",
            card: { fingerprint: "fp_exact" },
          }),
        },
      } as never,
      {
        default_payment_method: "pm_card",
      } as never,
    );

    assert.equal(fingerprint, "fp_exact");
  });

  it("does not treat a non-card payment method as an identity signal", async () => {
    const fingerprint = await stripeTrialCardFingerprint(
      {
        paymentMethods: {
          retrieve: async () => ({ id: "pm_link", type: "link" }),
        },
      } as never,
      {
        default_payment_method: "pm_link",
      } as never,
    );

    assert.equal(fingerprint, null);
  });

  it("uses the customer's default method when Stripe leaves the subscription default empty", async () => {
    const fingerprint = await stripeTrialCardFingerprint(
      {
        customers: {
          retrieve: async () => ({
            id: "cus_card",
            deleted: false,
            invoice_settings: { default_payment_method: "pm_card" },
          }),
        },
        paymentMethods: {
          retrieve: async () => ({
            id: "pm_card",
            type: "card",
            card: { fingerprint: "fp_customer_default" },
          }),
        },
      } as never,
      {
        customer: "cus_card",
        default_payment_method: null,
      } as never,
    );

    assert.equal(fingerprint, "fp_customer_default");
  });

  it("runs the duplicate guard before either Stripe entry point starts Homa's local trial", () => {
    const root = path.resolve(import.meta.dirname, "..", "..", "..", "..");
    for (const file of [
      "apps/web/app/api/billing/confirm/route.ts",
      "apps/web/app/api/billing/webhook/route.ts",
    ]) {
      const source = readFileSync(path.join(root, file), "utf8");
      const guard = source.indexOf("enforceStripeTrialCardUniqueness");
      const stamp = source.indexOf("startFamilyTrial(");
      assert.ok(guard >= 0, `${file} must use the Stripe duplicate-trial guard`);
      assert.ok(stamp > guard, `${file} must guard before starting the Homa trial`);
    }
  });
});
