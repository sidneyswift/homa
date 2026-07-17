import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DeliveryAttempt } from "./delivery-ledger";
import { deliverReactiveEmailWithRetry } from "./reactive-email-delivery";

describe("reactive email delivery retry", () => {
  it("retries accepted postprocessing without sending the outbound email twice", async () => {
    let status: DeliveryAttempt["existingStatus"] = "pending";
    let providerSubmissionId: string | null = null;
    let providerMessageId: string | null = null;
    let sends = 0;
    let finalizations = 0;
    let completedReceipts = 0;

    const dependencies = {
      beginAttempt: async (): Promise<DeliveryAttempt> => ({
        id: "delivery-1",
        familyId: "family-1",
        episodeId: "episode-1",
        messageId: "message-1",
        taskRunId: null,
        memberUserId: "member-1",
        channel: "email",
        destination: "parent@example.test",
        providerThreadKey: "email:parent@example.test",
        existingStatus: status,
        shouldSend: status !== "sent",
        providerSubmissionId,
        providerMessageId,
      }),
      sendEmail: async () => {
        sends += 1;
        return {
          status: "submitted" as const,
          providerSubmissionId: "submission-1",
          retrieveProviderMessageId: async () => "<reply-1@example.test>",
        };
      },
      finishAttempt: async (
        _attempt: DeliveryAttempt,
        outcome:
          | {
              delivered: true;
              providerSubmissionId?: string | null;
              providerMessageId?: string | null;
            }
          | { delivered: false; error?: string | null; uncertain?: boolean },
      ) => {
        if (outcome.delivered) {
          status = "sent";
          providerSubmissionId = outcome.providerSubmissionId ?? null;
          providerMessageId = outcome.providerMessageId ?? null;
        } else {
          status = outcome.uncertain ? "uncertain" : "failed";
        }
      },
      enrichProviderMessageId: async (
        _attempt: DeliveryAttempt,
        expectedSubmissionId: string,
        messageId: string,
      ) => {
        if (providerSubmissionId === expectedSubmissionId) {
          providerMessageId = messageId;
        }
      },
      retrieveProviderMessageId: async () => providerMessageId,
      finalizeOutcome: async () => {
        finalizations += 1;
        if (finalizations === 1) {
          throw new Error("visibility write exposed private data");
        }
      },
      completeInboundReceipt: async () => {
        completedReceipts += 1;
      },
    };

    await assert.rejects(
      deliverReactiveEmailWithRetry(dependencies),
      /phase=reactive_email_postprocess/u,
    );
    assert.equal(sends, 1);
    assert.equal(completedReceipts, 0);
    assert.equal(status, "sent");

    assert.equal(
      await deliverReactiveEmailWithRetry(dependencies),
      "sent",
    );
    assert.equal(sends, 1);
    assert.equal(finalizations, 2);
    assert.equal(completedReceipts, 1);
    assert.equal(providerSubmissionId, "submission-1");
    assert.equal(providerMessageId, "<reply-1@example.test>");
  });
});
