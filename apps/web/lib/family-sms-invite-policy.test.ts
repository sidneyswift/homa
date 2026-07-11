import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getFamilySmsInviteSendBlockReason } from "./family-sms-invite-policy";

const BASE_INPUT = {
  familyId: "family-a",
  sourcePhoneE164: "+15550000001",
  destinationPhoneE164: "+15550000002",
  destinationOwnerFamilyId: null,
  pendingFamilyId: null,
  recentFamilySendCount: 0,
  recentDestinationSendCount: 0,
};

describe("family SMS invitation send policy", () => {
  it("allows an unlinked number with no competing invitation", () => {
    assert.equal(getFamilySmsInviteSendBlockReason(BASE_INPUT), null);
  });

  it("refuses inviting the current texter's own number", () => {
    assert.equal(
      getFamilySmsInviteSendBlockReason({
        ...BASE_INPUT,
        destinationPhoneE164: BASE_INPUT.sourcePhoneE164,
      }),
      "same-number",
    );
  });

  it("never moves a number that is already linked", () => {
    assert.equal(
      getFamilySmsInviteSendBlockReason({
        ...BASE_INPUT,
        destinationOwnerFamilyId: BASE_INPUT.familyId,
      }),
      "already-linked",
    );
    assert.equal(
      getFamilySmsInviteSendBlockReason({
        ...BASE_INPUT,
        destinationOwnerFamilyId: "family-b",
      }),
      "number-in-use",
    );
  });

  it("does not replace another family's pending invitation", () => {
    assert.equal(
      getFamilySmsInviteSendBlockReason({
        ...BASE_INPUT,
        pendingFamilyId: "family-b",
      }),
      "pending-elsewhere",
    );
  });

  it("permits the same family to supersede its own pending invitation", () => {
    assert.equal(
      getFamilySmsInviteSendBlockReason({
        ...BASE_INPUT,
        pendingFamilyId: BASE_INPUT.familyId,
      }),
      null,
    );
  });

  it("enforces both durable send limits", () => {
    assert.equal(
      getFamilySmsInviteSendBlockReason({
        ...BASE_INPUT,
        recentFamilySendCount: 5,
      }),
      "send-limit",
    );
    assert.equal(
      getFamilySmsInviteSendBlockReason({
        ...BASE_INPUT,
        recentDestinationSendCount: 2,
      }),
      "send-limit",
    );
  });
});
