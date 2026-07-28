import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TRIAL_REMINDER_OUTER_NOTE,
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
    assert.equal(content.subject, "Your free days with Homa end August 3");
    assert.match(content.bodyLines[0], /^Hi Dana, nothing has been charged yet\./);
    assert.match(content.bodyLines[1], /Homa Plus plan starts that day\./);
    assert.equal(content.cta.url, manageUrl);
  });

  it("heads the email with a fact, never vaguer than the subject line", () => {
    const dated = trialReminderContent({
      firstName: "Dana",
      planName: "Homa",
      endDate: "August 3",
      charge: "$19 a month",
      manageUrl,
    });
    assert.equal(dated.heading, "Your first charge is on August 3");
    const undated = trialReminderContent({
      firstName: "Dana",
      planName: "Homa",
      endDate: null,
      charge: "$19 a month",
      manageUrl,
    });
    assert.equal(undated.heading, "Your first charge is in three days");
  });

  it("names the charge in the affirmative, not just as a thing not yet done", () => {
    const content = trialReminderContent({
      firstName: "Dana",
      planName: "Homa",
      endDate: "August 3",
      charge: "$19 a month",
      manageUrl,
    });
    // A required disclosure says money will leave the card. "Your plan
    // starts" alone is a euphemism for the event the email exists for.
    assert.match(content.bodyLines[1], /We will charge your card \$19 a month\./);
    assert.match(content.heading, /charge/i);
  });

  it("never points at the deadline with a pronoun", () => {
    for (const endDate of ["August 3", null]) {
      const content = trialReminderContent({
        firstName: "Dana",
        planName: "Homa",
        endDate,
        charge: "$19 a month",
        manageUrl,
      });
      const body = content.bodyLines.join(" ");
      assert.match(body, /cancel before your first charge and pay nothing\./);
      // The undated variant used to read "starts then... before then",
      // two pronouns pointing at a moment nothing had named.
      assert.doesNotMatch(body, /before then/);
    }
  });

  it("calls them free days everywhere, the way the gate did", () => {
    const content = trialReminderContent({
      firstName: "Dana",
      planName: "Homa",
      endDate: "August 3",
      charge: "$19 a month",
      manageUrl,
    });
    const all = [content.subject, content.heading, content.footerNote, ...content.bodyLines].join(" ");
    assert.match(all, /free days/);
    assert.doesNotMatch(all, /trial/i);
  });

  it("says cancel on the button, not just in the paragraph", () => {
    const content = trialReminderContent({
      firstName: "Dana",
      planName: "Homa",
      endDate: "August 3",
      charge: "$19 a month",
      manageUrl,
    });
    // The reader gate stopped here: a paragraph that names cancelling
    // over a button that will not reads as a buried cancel link. The
    // portal really does cancel and change a card, so the label is true.
    assert.match(content.cta.label, /cancel/i);
  });

  it("promises the work is saved without promising it stays open", () => {
    const content = trialReminderContent({
      firstName: "Dana",
      planName: "Homa",
      endDate: "August 3",
      charge: "$19 a month",
      manageUrl,
    });
    const body = content.bodyLines.join(" ");
    assert.match(body, /Everything you and Homa have made is saved to your account\./);
    // accountAccessDecision walls a canceled family, so the email must
    // never imply she can keep opening what she made.
    assert.doesNotMatch(body, /either way|keep using|still use|always have access/i);
  });

  it("points at the billing page when Stripe sent no amount", () => {
    const content = trialReminderContent({
      firstName: "Dana",
      planName: "Homa",
      endDate: "August 3",
      charge: null,
      manageUrl,
    });
    assert.equal(
      content.bodyLines[1],
      "Your Homa plan starts that day. We will charge your card, and your billing page shows the amount.",
    );
  });

  it("drops the greeting rather than rendering a bare Hi", () => {
    const content = trialReminderContent({
      firstName: null,
      planName: null,
      endDate: "August 3",
      charge: null,
      manageUrl,
    });
    // "Hi, nothing has been charged yet" reads as a merge field that
    // failed to fill, in the one email where that costs the most.
    assert.match(content.bodyLines[0], /^Nothing has been charged yet\./);
    assert.doesNotMatch(content.bodyLines[0], /^Hi,/);
    assert.equal(
      content.bodyLines[1],
      "Your Homa plan starts that day. We will charge your card, and your billing page shows the amount.",
    );
  });

  it("drops the date rather than shipping a placeholder", () => {
    const content = trialReminderContent({
      firstName: "Dana",
      planName: "Homa",
      endDate: null,
      charge: "$19 a month",
      manageUrl,
    });
    assert.equal(content.subject, "Your free days with Homa end in three days");
    assert.match(content.bodyLines[0], /end in three days\./);
    assert.match(content.bodyLines[1], /^Your Homa plan starts then\. We will charge your card \$19 a month\.$/);
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
    assert.match(body, /you can cancel before your first charge and pay nothing/);
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

describe("TRIAL_REMINDER_OUTER_NOTE", () => {
  it("never promises an off switch this email does not have", () => {
    // The shared shell default in lib/map/email.ts ends "Every kind of
    // email has an off switch." This notice ships without unsubscribe
    // headers on purpose, so inheriting that default would put a
    // checkably false sentence in the one email that must not carry one.
    assert.doesNotMatch(TRIAL_REMINDER_OUTER_NOTE, /off switch\.$/);
    assert.match(TRIAL_REMINDER_OUTER_NOTE, /no off switch/i);
  });

  it("does not claim Homa never emails about money", () => {
    // The default says "never promotions", which reads oddly on a charge
    // notice; this override drops the claim rather than reframing it.
    assert.doesNotMatch(TRIAL_REMINDER_OUTER_NOTE, /never promotions/i);
  });

  it("carries no em dash", () => {
    assert.doesNotMatch(TRIAL_REMINDER_OUTER_NOTE, /—/);
  });
});
