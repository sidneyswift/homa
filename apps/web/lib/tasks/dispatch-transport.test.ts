import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  DeliveryAttempt,
  FamilyDeliveryRecipient,
} from "../conversation-continuity/delivery-ledger";
import { buildSignedReplyAddress } from "../conversation-continuity/email-reply-auth";
import type {
  TaskDeliveryLedger,
} from "../conversation-continuity/task-delivery";
import { deliverLiveDispatchTask } from "./dispatch-transport";

class DispatchTransportLedger implements TaskDeliveryLedger {
  attempts: DeliveryAttempt[] = [];

  async beginAttempt(
    input: Omit<
      DeliveryAttempt,
      "id" | "existingStatus" | "shouldSend"
    >,
  ): Promise<DeliveryAttempt> {
    const attempt: DeliveryAttempt = {
      ...input,
      id: "delivery-1",
      existingStatus: "pending",
      shouldSend: true,
    };
    this.attempts.push(attempt);
    return attempt;
  }

  async finishAttempt(): Promise<void> {}
  async openLoop(): Promise<void> {}
}

describe("live dispatch transport adapter", () => {
  it("shares recipient scoping, ledger delivery, and signed email behavior", async () => {
    const recipients: FamilyDeliveryRecipient[] = [
      {
        recipientKey: "member:owner",
        memberUserId: "owner",
        displayName: "Owner",
        phoneNumbers: [],
        email: "owner@example.test",
      },
      {
        recipientKey: "member:recipient",
        memberUserId: "recipient",
        displayName: "Recipient",
        phoneNumbers: [],
        email: "recipient@example.test",
      },
    ];
    const ledger = new DispatchTransportLedger();
    const submissions: Array<{
      kind: string;
      label: string | null;
      email: string;
      body: string;
      replyTo: string | undefined;
      deliveryVersion: string;
    }> = [];
    const secret = "dispatch-transport-secret";

    const result = await deliverLiveDispatchTask(
      {
        familyId: "family-1",
        episodeId: "episode-1",
        messageId: "message-1",
        taskRunId: "run-1",
        kind: "morning_brief",
        text: "Prepared brief",
        deliveryMode: "email",
        recipientMemberUserId: "recipient",
        label: null,
        deliveryVersion: "research_brief_v2",
      },
      {
        listRecipients: async () => recipients,
        ledger,
        sendSms: async () => assert.fail("email mode must not send SMS"),
        sendEmail: async (submission) => {
          submissions.push(submission);
          return true;
        },
        inboundSecret: secret,
        markSmsRegionUnsupported: async () => 0,
      },
    );

    assert.equal(result.status, "done");
    assert.equal(result.deliveredChannel, "email");
    assert.equal(ledger.attempts[0]?.memberUserId, "recipient");
    assert.deepEqual(submissions, [{
      kind: "morning_brief",
      label: null,
      email: "recipient@example.test",
      body: "Prepared brief",
      replyTo: buildSignedReplyAddress("delivery-1", secret),
      deliveryVersion: "research_brief_v2",
    }]);
  });

  it("switches the family to email-only when the SMS region is unsupported", async () => {
    const recipients: FamilyDeliveryRecipient[] = [
      {
        recipientKey: "member:owner",
        memberUserId: "owner",
        displayName: "Owner",
        phoneNumbers: ["+12368462036"],
        email: "owner@example.test",
      },
    ];
    const ledger = new DispatchTransportLedger();
    const switchedFamilies: string[] = [];

    const result = await deliverLiveDispatchTask(
      {
        familyId: "family-1",
        episodeId: "episode-1",
        messageId: "message-1",
        taskRunId: "run-1",
        kind: "morning_brief",
        text: "Morning brief",
        deliveryMode: "text",
        recipientMemberUserId: "owner",
        label: null,
        deliveryVersion: "legacy",
      },
      {
        listRecipients: async () => recipients,
        ledger,
        sendSms: async () => ({
          status: "rejected",
          reason:
            "Telnyx rejected the send: 40309 Invalid destination region",
          unsupportedRegion: true,
        }),
        sendEmail: async () => true,
        inboundSecret: undefined,
        markSmsRegionUnsupported: async (familyId) => {
          switchedFamilies.push(familyId);
          return 2;
        },
      },
    );

    // Today's brief still reaches the family by email; the family is
    // switched to email-only so tomorrow skips the un-textable number.
    assert.equal(result.deliveredChannel, "email");
    assert.deepEqual(switchedFamilies, ["family-1"]);
  });

  it("fails closed when an exact recovery recipient is no longer current", async () => {
    const ledger = new DispatchTransportLedger();
    const result = await deliverLiveDispatchTask(
      {
        familyId: "family-1",
        episodeId: "episode-1",
        messageId: "message-1",
        taskRunId: null,
        kind: "custom",
        text: "Recovered artifact",
        deliveryMode: "text",
        recipientMemberUserId: "departed-recipient",
        requireExactRecipient: true,
        label: null,
        deliveryVersion: "legacy",
      },
      {
        listRecipients: async () => [
          {
            recipientKey: "member:other-adult",
            memberUserId: "other-adult",
            displayName: "Other adult",
            phoneNumbers: ["+15550000009"],
            email: "other@example.test",
          },
        ],
        ledger,
        sendSms: async () => assert.fail("must not send to another adult"),
        sendEmail: async () => assert.fail("must not email another adult"),
        inboundSecret: undefined,
        markSmsRegionUnsupported: async () => 0,
      },
    );

    assert.equal(result.status, "failed");
    assert.equal(result.deliveredCount, 0);
    assert.deepEqual(ledger.attempts, []);
  });

  it("revalidates a legacy recovery session at the final transport boundary", async () => {
    const ledger = new DispatchTransportLedger();
    const submissions: string[] = [];
    const result = await deliverLiveDispatchTask(
      {
        familyId: "family-1",
        episodeId: "episode-1",
        messageId: "message-1",
        taskRunId: null,
        kind: "custom",
        text: "Recovered artifact",
        deliveryMode: "email",
        recipientMemberUserId: null,
        requireExactRecipient: false,
        sourceOfferDeliveryId: "source-delivery-1",
        label: null,
        deliveryVersion: "legacy",
      },
      {
        listRecipients: async () => [
          {
            recipientKey: "member:accepted-recipient",
            memberUserId: "accepted-recipient",
            displayName: "Accepted recipient",
            phoneNumbers: [],
            email: "accepted@example.test",
          },
          {
            recipientKey: "member:other-adult",
            memberUserId: "other-adult",
            displayName: "Other adult",
            phoneNumbers: [],
            email: "other@example.test",
          },
        ],
        ledger,
        sendSms: async () => assert.fail("email mode must not send SMS"),
        sendEmail: async (submission) => {
          submissions.push(submission.email);
          return true;
        },
        inboundSecret: undefined,
        markSmsRegionUnsupported: async () => 0,
        resolveRecoveryRecipient: async (input) => {
          assert.deepEqual(input, {
            familyId: "family-1",
            sourceDeliveryId: "source-delivery-1",
          });
          return "accepted-recipient";
        },
      },
    );

    assert.equal(result.status, "done");
    assert.deepEqual(submissions, ["accepted@example.test"]);
    assert.deepEqual(
      ledger.attempts.map((attempt) => attempt.memberUserId),
      ["accepted-recipient"],
    );
  });

  it("sends nothing when final recovery revalidation has no exact recipient", async () => {
    const ledger = new DispatchTransportLedger();
    const result = await deliverLiveDispatchTask(
      {
        familyId: "family-1",
        episodeId: "episode-1",
        messageId: "message-1",
        taskRunId: null,
        kind: "custom",
        text: "Recovered artifact",
        deliveryMode: "email",
        recipientMemberUserId: "stale-state-recipient",
        requireExactRecipient: false,
        sourceOfferDeliveryId: "source-delivery-1",
        label: null,
        deliveryVersion: "legacy",
      },
      {
        listRecipients: async () => [
          {
            recipientKey: "member:other-adult",
            memberUserId: "other-adult",
            displayName: "Other adult",
            phoneNumbers: [],
            email: "other@example.test",
          },
        ],
        ledger,
        sendSms: async () => assert.fail("must not send SMS"),
        sendEmail: async () => assert.fail("must not send email"),
        inboundSecret: undefined,
        markSmsRegionUnsupported: async () => 0,
        resolveRecoveryRecipient: async () => null,
      },
    );

    assert.equal(result.status, "failed");
    assert.equal(result.deliveredCount, 0);
    assert.deepEqual(ledger.attempts, []);
  });

  it("does not accept save-only recovery when final recipient proof is gone", async () => {
    const ledger = new DispatchTransportLedger();
    let accepted = false;
    const result = await deliverLiveDispatchTask(
      {
        familyId: "family-1",
        episodeId: "episode-1",
        messageId: "message-1",
        taskRunId: "run-1",
        kind: "custom",
        text: "Private saved result",
        deliveryMode: "none",
        recipientMemberUserId: "stale-state-recipient",
        sourceOfferDeliveryId: "source-delivery-1",
        label: null,
        deliveryVersion: "legacy",
      },
      {
        listRecipients: async () => [
          {
            recipientKey: "member:other-adult",
            memberUserId: "other-adult",
            displayName: "Other adult",
            phoneNumbers: [],
            email: "other@example.test",
          },
        ],
        ledger,
        sendSms: async () => assert.fail("must not send SMS"),
        sendEmail: async () => assert.fail("must not send email"),
        inboundSecret: undefined,
        markSmsRegionUnsupported: async () => 0,
        resolveRecoveryRecipient: async () => null,
      },
      () => {
        accepted = true;
      },
    );

    assert.deepEqual(result, {
      status: "failed",
      deliveredChannel: null,
      deliveredCount: 0,
      failedCount: 1,
    });
    assert.equal(accepted, false);
    assert.deepEqual(ledger.attempts, []);
  });
});
