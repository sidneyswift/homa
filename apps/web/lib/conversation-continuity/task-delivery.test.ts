import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deliverTaskMessage,
  type TaskDeliveryLedger,
  type TaskDeliveryTransports,
} from "./task-delivery";
import type {
  DeliveryAttempt,
  FamilyDeliveryRecipient,
} from "./delivery-ledger";

class FakeLedger implements TaskDeliveryLedger {
  attempts: DeliveryAttempt[] = [];
  finished: Array<{ id: string; delivered: boolean }> = [];
  openedLoops: string[] = [];
  reuseSentAttempt = false;
  reusePendingAttempt = false;

  async beginAttempt(
    input: Omit<
      DeliveryAttempt,
      "id" | "existingStatus" | "shouldSend"
    >,
  ): Promise<DeliveryAttempt> {
    const attempt = {
      ...input,
      id: `attempt-${this.attempts.length + 1}`,
      existingStatus: this.reuseSentAttempt
        ? ("sent" as const)
        : ("pending" as const),
      shouldSend: !this.reuseSentAttempt && !this.reusePendingAttempt,
    };
    this.attempts.push(attempt);
    return attempt;
  }

  async finishAttempt(
    attempt: DeliveryAttempt,
    outcome: { delivered: boolean; uncertain?: boolean },
  ): Promise<void> {
    this.finished.push({ id: attempt.id, delivered: outcome.delivered });
    if (!outcome.delivered && !outcome.uncertain) {
      this.openedLoops = this.openedLoops.filter((id) => id !== attempt.id);
    }
  }

  async openLoop(attempt: DeliveryAttempt): Promise<void> {
    this.openedLoops.push(attempt.id);
  }
}

const recipients: FamilyDeliveryRecipient[] = [
  {
    recipientKey: "member:sidney",
    memberUserId: "sidney",
    displayName: "Sidney",
    phoneNumbers: ["+15550000001"],
    email: "sidney@example.com",
  },
  {
    recipientKey: "member:alessa",
    memberUserId: "alessa",
    displayName: "Alessa",
    phoneNumbers: ["+15550000002"],
    email: "alessa@example.com",
  },
];

function input() {
  return {
    familyId: "family-1",
    episodeId: "episode-1",
    messageId: "message-1",
    taskRunId: "run-1",
    kind: "morning_brief" as const,
    text: "Want a quick game?",
    recipients,
  };
}

describe("per-recipient task delivery", () => {
  it("falls back to each adult's own email and opens one loop per successful recipient", async () => {
    const ledger = new FakeLedger();
    const transports: TaskDeliveryTransports = {
      async sendSms(phone) {
        return phone.endsWith("1");
      },
      async sendEmail(email) {
        return email === "alessa@example.com";
      },
    };

    const result = await deliverTaskMessage(input(), {
      ledger,
      transports,
    });

    assert.equal(result.status, "done");
    assert.equal(result.deliveredCount, 2);
    assert.deepEqual(
      ledger.attempts.map((attempt) => [
        attempt.memberUserId,
        attempt.channel,
        attempt.destination,
      ]),
      [
        ["sidney", "sms", "+15550000001"],
        ["alessa", "sms", "+15550000002"],
        ["alessa", "email", "alessa@example.com"],
      ],
    );
    assert.deepEqual(ledger.openedLoops, ["attempt-1", "attempt-3"]);
  });

  it("reports partial when one adult cannot be reached by either transport", async () => {
    const ledger = new FakeLedger();
    const transports: TaskDeliveryTransports = {
      async sendSms(phone) {
        return phone.endsWith("1");
      },
      async sendEmail() {
        return false;
      },
    };

    const result = await deliverTaskMessage(input(), {
      ledger,
      transports,
    });

    assert.equal(result.status, "partial");
    assert.equal(result.deliveredCount, 1);
    assert.equal(result.failedCount, 1);
    assert.deepEqual(ledger.openedLoops, ["attempt-1"]);
  });

  it("sends a save-only custom task to the ledger without a reply loop", async () => {
    const ledger = new FakeLedger();
    const result = await deliverTaskMessage(
      { ...input(), kind: "custom", recipients: [], text: "Saved result" },
      {
        ledger,
        transports: {
          async sendSms() {
            throw new Error("not called");
          },
          async sendEmail() {
            throw new Error("not called");
          },
        },
        saveOnly: true,
      },
    );

    assert.equal(result.status, "done");
    assert.equal(result.deliveredChannel, "none");
    assert.equal(ledger.openedLoops.length, 0);
  });

  it("does not resend a destination whose delivery already succeeded", async () => {
    const ledger = new FakeLedger();
    ledger.reuseSentAttempt = true;
    let transportCalls = 0;

    const result = await deliverTaskMessage(
      { ...input(), recipients: [recipients[0]] },
      {
        ledger,
        transports: {
          async sendSms() {
            transportCalls += 1;
            return true;
          },
          async sendEmail() {
            transportCalls += 1;
            return true;
          },
        },
      },
    );

    assert.equal(transportCalls, 0);
    assert.equal(result.status, "done");
    assert.equal(result.deliveredCount, 1);
  });

  it("does not email-fallback or replay when SMS submission is uncertain", async () => {
    const ledger = new FakeLedger();
    let emailCalls = 0;

    const result = await deliverTaskMessage(
      { ...input(), recipients: [recipients[0]] },
      {
        ledger,
        transports: {
          async sendSms() {
            return { status: "unknown" };
          },
          async sendEmail() {
            emailCalls += 1;
            return true;
          },
        },
      },
    );

    assert.equal(emailCalls, 0);
    assert.equal(result.status, "uncertain");
    assert.equal(result.deliveredCount, 0);
    assert.equal(ledger.openedLoops.length, 1);
  });

  it("reports a replayed in-flight attempt as uncertain, never failed", async () => {
    const ledger = new FakeLedger();
    ledger.reusePendingAttempt = true;
    let transportCalls = 0;

    const result = await deliverTaskMessage(
      { ...input(), recipients: [recipients[0]] },
      {
        ledger,
        transports: {
          async sendSms() {
            transportCalls += 1;
            return true;
          },
          async sendEmail() {
            transportCalls += 1;
            return true;
          },
        },
      },
    );

    assert.equal(transportCalls, 0);
    assert.equal(result.status, "uncertain");
  });
});
