import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  legacyProgressTransportIdempotencyKey,
} from "./child-progress/legacy-adapters";
import {
  trustedSmsInboundIdentityAttributes,
} from "./sms-inbound-auth";

describe("trusted SMS inbound identity", () => {
  it("stamps provider and receipt identity before family linkage", () => {
    const identity = trustedSmsInboundIdentityAttributes({
      providerMessageId: "telnyx-message-1",
      inboundReceiptId:
        "11111111-1111-4111-8111-111111111111",
    });

    for (const familyId of [null, "family-1"]) {
      const attributes = {
        ...identity,
        ...(familyId ? { familyId } : {}),
      };
      assert.equal(
        attributes.providerMessageId,
        "telnyx-message-1",
      );
      assert.equal(
        attributes.inboundReceiptId,
        "11111111-1111-4111-8111-111111111111",
      );
    }
  });

  it("keeps a reclaimed receipt stable across runtime rotation", () => {
    const first = legacyProgressTransportIdempotencyKey({
      operation: "signup-answer",
      channel: "sms",
      providerMessageId: null,
      inboundReceiptId:
        "22222222-2222-4222-8222-222222222222",
      runtimeSessionId: "session-before-reclaim",
      turnId: "turn-before-reclaim",
    });
    const reclaimed = legacyProgressTransportIdempotencyKey({
      operation: "signup-answer",
      channel: "sms",
      providerMessageId: null,
      inboundReceiptId:
        "22222222-2222-4222-8222-222222222222",
      runtimeSessionId: "session-after-reclaim",
      turnId: "turn-after-reclaim",
    });

    assert.equal(reclaimed, first);
  });

  it("stamps the active progress identity as one trusted pair", () => {
    assert.deepEqual(
      trustedSmsInboundIdentityAttributes({
        providerMessageId: "telnyx-message-1",
        inboundReceiptId:
          "11111111-1111-4111-8111-111111111111",
        activeProgressContext: {
          checkInId:
            "22222222-2222-4222-8222-222222222222",
          deliveryId:
            "33333333-3333-4333-8333-333333333333",
        },
      }),
      {
        providerMessageId: "telnyx-message-1",
        inboundReceiptId:
          "11111111-1111-4111-8111-111111111111",
        activeProgressCheckInId:
          "22222222-2222-4222-8222-222222222222",
        activeProgressDeliveryId:
          "33333333-3333-4333-8333-333333333333",
      },
    );
  });

  it("passes trusted SMS provenance into signup evidence", async () => {
    const source = await readFile(
      new URL("../agent/tools/signup_record_answer.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /channel: "sms"/u);
    assert.match(
      source,
      /messageId: attributes\.canonicalInboundMessageId/u,
    );
    assert.match(
      source,
      /providerMessageId: attributes\.providerMessageId/u,
    );
  });
});
