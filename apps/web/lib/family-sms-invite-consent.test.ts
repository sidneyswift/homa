import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyFamilySmsInviteConsent,
  classifyFamilySmsInviteParentConfirmation,
} from "./family-sms-invite-consent";

describe("family SMS invite consent classification", () => {
  it("accepts only the complete word yes", () => {
    assert.equal(
      classifyFamilySmsInviteConsent({ text: "YES", hasAttachments: false }),
      "accept",
    );
    assert.equal(
      classifyFamilySmsInviteConsent({
        text: " yes! ",
        hasAttachments: false,
      }),
      "accept",
    );
  });

  it("accepts only complete, unambiguous declines", () => {
    assert.equal(
      classifyFamilySmsInviteConsent({ text: "no", hasAttachments: false }),
      "decline",
    );
    assert.equal(
      classifyFamilySmsInviteConsent({
        text: "No thanks.",
        hasAttachments: false,
      }),
      "decline",
    );
  });

  it("does not infer consent from questions, quotes, or longer messages", () => {
    for (const text of [
      '"yes"',
      "yes?",
      "yes please",
      "I accept.",
      "accept",
      "yes, but what can I see?",
      "Did Sidney say yes?",
      "My answer might be no later",
    ]) {
      assert.equal(
        classifyFamilySmsInviteConsent({ text, hasAttachments: false }),
        null,
      );
    }
  });

  it("does not treat a message with attachments as consent", () => {
    assert.equal(
      classifyFamilySmsInviteConsent({ text: "yes", hasAttachments: true }),
      null,
    );
  });
});

describe("family SMS invite parent confirmation", () => {
  it("requires an exact confirmation action and six-digit code", () => {
    assert.deepEqual(
      classifyFamilySmsInviteParentConfirmation({
        text: "Confirm 482193.",
        hasAttachments: false,
      }),
      { decision: "confirm", confirmationCode: "482193" },
    );
    assert.deepEqual(
      classifyFamilySmsInviteParentConfirmation({
        text: "cancel 482193",
        hasAttachments: false,
      }),
      { decision: "cancel", confirmationCode: "482193" },
    );
  });

  it("does not accept bare yes, extra text, or attachments", () => {
    for (const input of [
      { text: "yes", hasAttachments: false },
      { text: "confirm", hasAttachments: false },
      { text: "confirm 482193 but wait", hasAttachments: false },
      { text: "confirm 482193", hasAttachments: true },
    ]) {
      assert.equal(classifyFamilySmsInviteParentConfirmation(input), null);
    }
  });
});
