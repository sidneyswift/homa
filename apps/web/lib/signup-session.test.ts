import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { resolveSignupSession } from "./signup-session";

const originalPaywallFlag = process.env.HOMA_SIGNUP_PAYWALL_ENABLED;

afterEach(() => {
  if (originalPaywallFlag === undefined) delete process.env.HOMA_SIGNUP_PAYWALL_ENABLED;
  else process.env.HOMA_SIGNUP_PAYWALL_ENABLED = originalPaywallFlag;
});

describe("text signup session resolution", () => {
  it("refuses every text signup while the signup paywall is on", async () => {
    process.env.HOMA_SIGNUP_PAYWALL_ENABLED = "true";
    const result = await resolveSignupSession({
      channel: "sms",
      phoneNumber: "+15551234567",
    });

    assert.equal(result, null);
  });
  it("refuses a phone while it is handling a family invitation", async () => {
    const pending = await resolveSignupSession({
      channel: "sms",
      familyId: "must-not-be-used",
      familySmsInviteId: "invite-a",
      familySmsInviteState: "pending",
      phoneNumber: "+15551234567",
    });
    const expired = await resolveSignupSession({
      channel: "sms",
      familyId: "must-not-be-used",
      familySmsInviteId: "invite-b",
      familySmsInviteState: "expired",
      phoneNumber: "+15551234567",
    });

    assert.equal(pending, null);
    assert.equal(expired, null);
  });

  it("refuses signup when invitation status could not be verified", async () => {
    const result = await resolveSignupSession({
      channel: "sms",
      familyId: "must-not-be-used",
      familySmsInviteLookupFailed: "true",
      phoneNumber: "+15551234567",
    });

    assert.equal(result, null);
  });
});
