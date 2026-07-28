import assert from "node:assert/strict";
import test from "node:test";

import {
  CHANNEL_GATE_SMS_LINE,
  CHANNEL_GATE_VOICE_LINE,
  channelAccessDecision,
  type ChannelAccessRow,
} from "./channel-access";

const BASE: ChannelAccessRow = {
  planTier: "regular",
  billingExempt: false,
  createdAtMs: Date.parse("2026-08-01T00:00:00Z"),
  subscriptionStatus: "active",
};

const CUTOFF = Date.parse("2026-07-28T00:00:00Z");

test("a web-only plan does not carry text, phone, or email", () => {
  assert.equal(channelAccessDecision(BASE, CUTOFF), null);
});

test("the two paid tiers carry them", () => {
  assert.equal(channelAccessDecision({ ...BASE, planTier: "plus" }, CUTOFF), "entitled_tier");
  assert.equal(channelAccessDecision({ ...BASE, planTier: "elite" }, CUTOFF), "entitled_tier");
});

test("families who had the channels before the cutoff keep them", () => {
  // 78 families had been texting and calling for weeks on no plan at
  // all, because the channels were free and open. Taking a working
  // phone number away from someone using it is a different act from
  // declining to give it to someone new.
  const existing = { ...BASE, createdAtMs: Date.parse("2026-07-01T00:00:00Z") };
  assert.equal(channelAccessDecision(existing, CUTOFF), "grandfathered");
});

test("no cutoff configured gates everyone, existing families included", () => {
  // Deliberate: leaving HOMA_CHANNEL_GATE_SINCE unset is how a founder
  // says "gate everybody". It must not silently behave like an
  // grandfather-all.
  assert.equal(channelAccessDecision(BASE, null), null);
});

test("the comp switch outranks everything, including a missing tier", () => {
  assert.equal(
    channelAccessDecision({ ...BASE, planTier: null, billingExempt: true }, CUTOFF),
    "billing_exempt",
  );
});

test("a lapsed subscription loses the channel even on a paid tier", () => {
  // plan_tier records what was bought and never clears itself when the
  // card stops working, so it cannot be the only thing consulted.
  for (const status of ["canceled", "unpaid", "past_due", "incomplete_expired", "paused"]) {
    assert.equal(
      channelAccessDecision({ ...BASE, planTier: "plus", subscriptionStatus: status }, CUTOFF),
      null,
      `${status} should not keep the channel`,
    );
  }
});

test("a paid tier with no subscription status yet still carries them", () => {
  // The confirm route stamps plan_tier before any webhook mirrors a
  // status. A family who just bought Plus must not be refused on her
  // first text because a webhook has not landed.
  assert.equal(
    channelAccessDecision({ ...BASE, planTier: "plus", subscriptionStatus: null }, CUTOFF),
    "entitled_tier",
  );
});

test("a family with no created_at is judged on her plan, never grandfathered", () => {
  // A null timestamp must not read as "before the cutoff", which would
  // hand every unreadable row a free pass.
  assert.equal(channelAccessDecision({ ...BASE, createdAtMs: null }, CUTOFF), null);
  assert.equal(
    channelAccessDecision({ ...BASE, createdAtMs: null, planTier: "plus" }, CUTOFF),
    "entitled_tier",
  );
});

test("the refusal lines offer a door and never apologise or command", () => {
  for (const line of [CHANNEL_GATE_SMS_LINE, CHANNEL_GATE_VOICE_LINE]) {
    // Reassure before inform: what is still true comes before the limit.
    assert.match(line, /waiting for you on the web/i);
    assert.match(line, /Homa Plus/);
    assert.match(line, /whenever you like/i);
    // Offers never commands, and nothing broke, so nothing apologises.
    assert.doesNotMatch(line, /\bsorry\b|\bunfortunately\b|\bcannot\b|\bcan't\b/i);
    assert.doesNotMatch(line, /\bmust\b|\bneed to\b|\bupgrade\b/i);
    assert.doesNotMatch(line, /—/);
  }
});
