import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatTrialCharge,
  formatTrialEndDate,
  trialReminderContent,
  trialReminderVerdict,
  type TrialReminderFamily,
  type TrialReminderSubscription,
} from "./trial-reminder";

const family = (overrides: Partial<TrialReminderFamily> = {}): TrialReminderFamily => ({
  id: "11111111-1111-1111-1111-111111111111",
  email: "parent@example.com",
  firstName: "Dana",
  planName: "Homa",
  timeZone: "America/New_York",
  billingExempt: false,
  ...overrides,
});

const subscription = (
  overrides: Partial<TrialReminderSubscription> = {},
): TrialReminderSubscription => ({
  status: "trialing",
  cancelAtPeriodEnd: false,
  trialEndSec: Date.parse("2026-08-03T14:00:00Z") / 1000,
  amountCents: 1900,
  currency: "usd",
  interval: "month",
  ...overrides,
});

describe("trialReminderVerdict", () => {
  it("sends for a trialing family with an email", () => {
    assert.deepEqual(trialReminderVerdict(family(), subscription(), false), {
      send: true,
      to: "parent@example.com",
    });
  });

  it("trims the address it hands the sender", () => {
    const verdict = trialReminderVerdict(family({ email: "  parent@example.com " }), subscription(), false);
    assert.deepEqual(verdict, { send: true, to: "parent@example.com" });
  });

  it("skips when no family matched the Stripe customer", () => {
    assert.deepEqual(trialReminderVerdict(null, subscription(), false), {
      send: false,
      reason: "no-family",
    });
  });

  it("skips a family with no email on file", () => {
    assert.deepEqual(trialReminderVerdict(family({ email: null }), subscription(), false), {
      send: false,
      reason: "no-email",
    });
  });

  it("skips a blank email rather than posting it to Resend", () => {
    assert.deepEqual(trialReminderVerdict(family({ email: "   " }), subscription(), false), {
      send: false,
      reason: "no-email",
    });
  });

  it("skips when the subscription is no longer trialing", () => {
    assert.deepEqual(
      trialReminderVerdict(family(), subscription({ status: "active" }), false),
      { send: false, reason: "not-trialing" },
    );
  });

  it("never promises a charge to a family who already canceled", () => {
    assert.deepEqual(
      trialReminderVerdict(family(), subscription({ cancelAtPeriodEnd: true }), false),
      { send: false, reason: "canceling" },
    );
  });

  it("never promises a charge to a comped family", () => {
    assert.deepEqual(
      trialReminderVerdict(family({ billingExempt: true }), subscription(), false),
      { send: false, reason: "billing-exempt" },
    );
  });

  it("sends once even though Stripe retries the event", () => {
    assert.deepEqual(trialReminderVerdict(family(), subscription(), true), {
      send: false,
      reason: "already-sent",
    });
  });

  it("reports the structural reason first when several apply", () => {
    assert.deepEqual(
      trialReminderVerdict(family({ email: null, billingExempt: true }), subscription(), true),
      { send: false, reason: "no-email" },
    );
  });
});

describe("formatTrialEndDate", () => {
  it("formats in the family's own zone", () => {
    assert.equal(formatTrialEndDate(Date.parse("2026-08-03T14:00:00Z") / 1000, "America/New_York"), "August 3");
  });

  it("respects a zone that moves the calendar day", () => {
    // 01:00 UTC on the 4th is still the 3rd in Los Angeles.
    const sec = Date.parse("2026-08-04T01:00:00Z") / 1000;
    assert.equal(formatTrialEndDate(sec, "America/Los_Angeles"), "August 3");
    assert.equal(formatTrialEndDate(sec, "UTC"), "August 4");
  });

  it("falls back to UTC for a missing zone", () => {
    assert.equal(formatTrialEndDate(Date.parse("2026-08-03T14:00:00Z") / 1000, null), "August 3");
  });

  it("falls back to UTC instead of throwing on a junk zone", () => {
    assert.equal(
      formatTrialEndDate(Date.parse("2026-08-03T14:00:00Z") / 1000, "Not/AZone"),
      "August 3",
    );
  });

  it("returns null when Stripe sent no trial end", () => {
    assert.equal(formatTrialEndDate(null, "UTC"), null);
  });
});

describe("formatTrialCharge", () => {
  it("drops the cents on a whole amount", () => {
    assert.equal(formatTrialCharge(1900, "usd", "month"), "$19 a month");
  });

  it("keeps the cents when there are any", () => {
    assert.equal(formatTrialCharge(1950, "usd", "month"), "$19.50 a month");
  });

  it("names an annual plan by its year", () => {
    assert.equal(formatTrialCharge(18200, "usd", "year"), "$182 a year");
  });

  it("returns null on an interval it cannot name", () => {
    assert.equal(formatTrialCharge(1900, "usd", "week"), null);
    assert.equal(formatTrialCharge(1900, "usd", null), null);
  });

  it("returns null when Stripe sent no amount", () => {
    assert.equal(formatTrialCharge(null, "usd", "month"), null);
  });
});

describe("trialReminderContent", () => {
  const manageUrl = "https://thankshoma.com/api/billing/portal";

  it("reassures before it informs", () => {
    const content = trialReminderContent({
      firstName: "Dana",
      planName: "Homa Plus",
      endDate: "August 3",
      charge: "$49 a month",
      manageUrl,
    });
    assert.equal(content.subject, "Your Homa trial ends August 3");
    assert.match(content.bodyLines[0], /^Hi Dana, nothing has been charged yet\./);
    assert.match(content.bodyLines[1], /Homa Plus plan starts then, at \$49 a month\./);
    assert.equal(content.cta.url, manageUrl);
  });

  it("greets a family with no first name without an empty slot", () => {
    const content = trialReminderContent({
      firstName: null,
      planName: null,
      endDate: "August 3",
      charge: null,
      manageUrl,
    });
    assert.match(content.bodyLines[0], /^Hi, nothing has been charged yet\./);
    assert.equal(content.bodyLines[1], "Your Homa plan starts then.");
  });

  it("drops the date rather than shipping a placeholder", () => {
    const content = trialReminderContent({
      firstName: "Dana",
      planName: "Homa",
      endDate: null,
      charge: "$19 a month",
      manageUrl,
    });
    assert.equal(content.subject, "Your Homa trial ends in three days");
    assert.match(content.bodyLines[0], /end in three days\./);
    for (const line of content.bodyLines) {
      assert.doesNotMatch(line, /null|undefined|\{/);
    }
  });

  it("names the door out without commanding it", () => {
    const content = trialReminderContent({
      firstName: "Dana",
      planName: "Homa",
      endDate: "August 3",
      charge: "$19 a month",
      manageUrl,
    });
    const body = content.bodyLines.join(" ");
    assert.match(body, /you can cancel before then and pay nothing/);
    assert.doesNotMatch(body, /must|hurry|act now|don't miss/i);
  });

  it("carries no em dash, anywhere", () => {
    const content = trialReminderContent({
      firstName: "Dana",
      planName: "Homa Max",
      endDate: "August 3",
      charge: "$199 a month",
      manageUrl,
    });
    const all = [
      content.subject,
      content.preview,
      content.heading,
      content.footerNote,
      content.cta.label,
      ...content.bodyLines,
    ].join(" ");
    assert.doesNotMatch(all, /—/);
  });
});
