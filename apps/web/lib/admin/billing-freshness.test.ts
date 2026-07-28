import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  billingFreshness,
  billingFreshnessLine,
  type BillingMirrorRow,
} from "./billing-freshness";

const NOW = Date.parse("2026-08-01T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const row = (overrides: Partial<BillingMirrorRow> = {}): BillingMirrorRow => ({
  status: "active",
  currentPeriodEndMs: NOW + 20 * DAY,
  trialStartedAtMs: NOW - 30 * DAY,
  hasSubscriptionId: true,
  billingExempt: false,
  ...overrides,
});

describe("billingFreshness", () => {
  it("says nothing to compare before any family has a Stripe record", () => {
    const f = billingFreshness([row({ status: null, hasSubscriptionId: false, trialStartedAtMs: null })], null, NOW);
    assert.equal(f.verdict, "no-billing-yet");
    assert.equal(f.familiesWithBilling, 0);
    assert.match(billingFreshnessLine(f), /nothing to compare/);
  });

  it("never reads an empty system as a healthy one", () => {
    // The whole point of the separate verdict: zero drift because nothing
    // has happened must not look like zero drift because all is well.
    const empty = billingFreshness([], null, NOW);
    assert.notEqual(empty.verdict, "healthy");
    assert.equal(empty.verdict, "no-billing-yet");
  });

  it("is healthy when everyone paid through a future date", () => {
    const f = billingFreshness([row(), row()], NOW - 1000, NOW);
    assert.equal(f.verdict, "healthy");
    assert.equal(f.stalePayers, 0);
    assert.equal(f.familiesWithBilling, 2);
  });

  it("flags a family still reading as paying past their paid-through date", () => {
    const f = billingFreshness([row({ currentPeriodEndMs: NOW - 10 * DAY })], NOW - 1000, NOW);
    assert.equal(f.verdict, "stale");
    assert.equal(f.stalePayers, 1);
    assert.match(billingFreshnessLine(f), /past the date they were paid through/);
    assert.match(billingFreshnessLine(f), /stopped reaching the billing webhook/);
  });

  it("leaves a day-old lapse alone, because Stripe's own retries take days", () => {
    const f = billingFreshness([row({ currentPeriodEndMs: NOW - 1 * DAY })], NOW - 1000, NOW);
    assert.equal(f.stalePayers, 0);
    assert.equal(f.verdict, "healthy");
  });

  it("flags a trial past its window with no subscription recorded", () => {
    const f = billingFreshness(
      [row({ status: null, hasSubscriptionId: false, trialStartedAtMs: NOW - 20 * DAY })],
      null,
      NOW,
    );
    assert.equal(f.verdict, "stale");
    assert.equal(f.trialsWithoutSubscription, 1);
    assert.match(billingFreshnessLine(f), /no subscription on file/);
  });

  it("leaves a trial still inside its window alone", () => {
    const f = billingFreshness(
      [row({ status: null, hasSubscriptionId: false, trialStartedAtMs: NOW - 3 * DAY })],
      null,
      NOW,
    );
    assert.equal(f.trialsWithoutSubscription, 0);
    assert.equal(f.verdict, "no-billing-yet");
  });

  it("ignores comped families entirely", () => {
    // billing_exempt is the founder's own switch; a comped family has no
    // Stripe record by design and is not evidence of drift.
    const f = billingFreshness(
      [row({ billingExempt: true, status: null, hasSubscriptionId: false, trialStartedAtMs: NOW - 90 * DAY })],
      null,
      NOW,
    );
    assert.equal(f.verdict, "no-billing-yet");
    assert.equal(f.trialsWithoutSubscription, 0);
    assert.equal(f.familiesWithBilling, 0);
  });

  it("counts a cancelled family as settled, not stale", () => {
    // accountAccessDecision already walls these; they are not drift.
    const f = billingFreshness([row({ status: "canceled", currentPeriodEndMs: NOW - 40 * DAY })], NOW - 1000, NOW);
    assert.equal(f.stalePayers, 0);
    assert.equal(f.verdict, "healthy");
  });

  it("reports how long the webhook has been quiet", () => {
    const f = billingFreshness([row()], NOW - 5 * DAY, NOW);
    assert.equal(f.lastUpdateAgeMs, 5 * DAY);
    // Carried as an instant too, so the console never reaches for
    // Date.now() inside a component (react-hooks purity).
    assert.equal(f.lastUpdateAtIso, new Date(NOW - 5 * DAY).toISOString());
    const never = billingFreshness([row()], null, NOW);
    assert.equal(never.lastUpdateAgeMs, null);
    assert.equal(never.lastUpdateAtIso, null);
  });

  it("names both problems in one line when both apply", () => {
    const f = billingFreshness(
      [
        row({ currentPeriodEndMs: NOW - 10 * DAY }),
        row({ status: null, hasSubscriptionId: false, trialStartedAtMs: NOW - 20 * DAY }),
      ],
      NOW - 1000,
      NOW,
    );
    assert.equal(f.stalePayers, 1);
    assert.equal(f.trialsWithoutSubscription, 1);
    const line = billingFreshnessLine(f);
    assert.match(line, /paid through/);
    assert.match(line, /no subscription on file/);
  });

  it("carries no em dash", () => {
    for (const f of [
      billingFreshness([], null, NOW),
      billingFreshness([row()], NOW, NOW),
      billingFreshness([row({ currentPeriodEndMs: NOW - 10 * DAY })], NOW, NOW),
    ]) {
      assert.doesNotMatch(billingFreshnessLine(f), /—/);
    }
  });
});
