import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFamilySmsAcceptanceText,
  buildFamilySmsDeclineText,
  buildFamilySmsExpiredText,
  buildFamilySmsInvitationText,
  buildFamilySmsInviterCanceledText,
  buildFamilySmsInviterConfirmedText,
  buildFamilySmsInviterConfirmationText,
  buildFamilySmsInviterExpiredText,
  buildFamilySmsNoActiveInviteText,
  buildFamilySmsNumberInUseText,
  buildFamilySmsRecipientAcceptedText,
  buildFamilySmsRecipientConfirmationUnavailableText,
  buildFamilySmsRecipientConfirmationUnknownText,
  normalizeFamilySmsLearningUpdate,
} from "./family-sms-invite-copy";

describe("family SMS invitation copy", () => {
  it("keeps child information out of the pre-consent invitation", () => {
    const text = buildFamilySmsInvitationText();

    assert.match(text, /homeschool assistant/u);
    assert.match(text, /Someone entered this number/u);
    assert.match(text, /text Homa about the kids/u);
    assert.match(text, /Nothing is shared unless both phones confirm/u);
    assert.match(text, /reply "yes"/u);
    assert.doesNotMatch(text, /Sidney|Story|counted to 20/u);
  });

  it("keeps the recipient waiting after their yes", () => {
    const text = buildFamilySmsRecipientAcceptedText();

    assert.match(text, /asked the parent.*confirm the phone number/u);
    assert.match(text, /does not have access to the family's Homa account yet/u);
    assert.match(text, /text you again after they confirm/u);
    assert.doesNotMatch(text, /Story|counted to 20/u);
  });

  it("keeps child information private when parent notification fails", () => {
    assert.match(
      buildFamilySmsRecipientConfirmationUnavailableText(),
      /could not reach the parent/u,
    );
    assert.match(
      buildFamilySmsRecipientConfirmationUnknownText(),
      /request to confirm this number/u,
    );
    assert.match(
      buildFamilySmsRecipientConfirmationUnknownText(),
      /contact the parent directly/u,
    );
    assert.doesNotMatch(
      buildFamilySmsRecipientConfirmationUnavailableText(),
      /Story|counted to 20/u,
    );
  });

  it("reveals the saved update only in the post-consent reply", () => {
    const text = buildFamilySmsAcceptanceText({
      inviterName: "Sidney",
      childName: "Story",
      learningUpdate: "counted to 20 on their own today",
    });

    assert.match(text, /access to the family's Homa account through this number/u);
    assert.match(text, /Story counted to 20 on their own today\./u);
    assert.match(text, /Sidney confirmed this access/u);
    assert.match(text, /Sidney can remove this number in Homa settings/u);
    assert.match(text, /"Stop" ends texts from Homa/u);
    assert.match(text, /does not remove access to the family's Homa account/u);
  });

  it("still confirms access when the saved child no longer exists", () => {
    const text = buildFamilySmsAcceptanceText({
      inviterName: null,
      childName: null,
      learningUpdate: "counted to 20 on their own today",
    });

    assert.match(text, /access to the family's Homa account/u);
    assert.doesNotMatch(text, /counted to 20|Learning update/u);
  });

  it("states the no-access outcome after decline or expiry", () => {
    assert.equal(
      buildFamilySmsDeclineText(),
      "No problem. This number does not have access to the family's Homa account. I did not share child information.",
    );
    assert.equal(
      buildFamilySmsExpiredText(),
      "That invitation has expired. Your number does not have access to the family's Homa account. No child information was shared. You can ask the person who invited you to send a new invitation.",
    );
  });

  it("asks the inviter to confirm the full number with a bound code", () => {
    const text = buildFamilySmsInviterConfirmationText({
      confirmationCode: "482193",
      recipientPhoneE164: "+19545551234",
    });

    assert.match(text, /\(954\) 555-1234/u);
    assert.match(text, /"confirm 482193"/u);
    assert.match(text, /"cancel 482193"/u);
    assert.match(text, /No child information has been shared/u);
  });

  it("states that inviter cancellation shared nothing", () => {
    assert.equal(
      buildFamilySmsInviterCanceledText(),
      "Canceled. That number does not have access to your family's Homa account. I did not share child information.",
    );
    assert.equal(
      buildFamilySmsInviterExpiredText(),
      "That confirmation has expired. The number does not have access to your family's Homa account. No child information was shared. You can send a new invitation.",
    );
  });

  it("tells the inviter whether the final update delivery was confirmed", () => {
    assert.equal(
      buildFamilySmsInviterConfirmedText({
        recipientPhoneE164: "+19545551234",
        updateDelivery: "submitted",
      }),
      "Confirmed. (954) 555-1234 now has access to your family's Homa account. I sent the saved learning update to that number.",
    );
    assert.equal(
      buildFamilySmsInviterConfirmedText({
        recipientPhoneE164: "+19545551234",
        updateDelivery: "unconfirmed",
      }),
      "Confirmed. (954) 555-1234 now has access to your family's Homa account. I could not confirm the learning update reached that number. You can send the learning update yourself. The person using that number can text Homa now.",
    );
  });

  it("explains invitation conflicts without changing either family", () => {
    assert.equal(
      buildFamilySmsNumberInUseText(),
      "This number is already connected to another Homa account. I did not change either account.",
    );
    assert.equal(
      buildFamilySmsNoActiveInviteText(),
      "There is no active family invitation for this number. You can ask the family to send a new one.",
    );
  });

  it("collapses whitespace before storing a learning update", () => {
    assert.equal(
      normalizeFamilySmsLearningUpdate("  counted\nto   20 on their own today.  "),
      "counted to 20 on their own today.",
    );
  });
});
