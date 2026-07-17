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
});
