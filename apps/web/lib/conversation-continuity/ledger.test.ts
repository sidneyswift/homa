import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TransactionSql } from "postgres";

import {
  claimReplyResolutionWithTransaction,
  emitClaimedReplyResolvedEvent,
} from "./ledger";

describe("continuity reply claim", () => {
  it("writes the typed outcome before marking the claimed delivery replied", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const tx = async <T>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<T> => {
      calls.push({ sql: strings.join("?"), values });
      return (calls.length === 1 ? [{ id: "loop-1" }] : []) as T;
    };

    const claimed = await claimReplyResolutionWithTransaction(
      tx as unknown as TransactionSql,
      {
      familyId: "family-1",
      deliveryId: "delivery-1",
      messageId: "message-1",
      replyToMessageId: "message-outbound-1",
      outcome: "accepted",
      resolutionMethod: "bounded_polarity",
      classifierVersion: "reply-intent-v2",
      },
    );

    assert.equal(claimed, true);
    assert.match(calls[0]?.sql ?? "", /resolved_outcome/u);
    assert.match(calls[0]?.sql ?? "", /resolution_method/u);
    assert.match(calls[0]?.sql ?? "", /classifier_version/u);
    assert.ok(calls[0]?.values.includes("accepted"));
    assert.ok(calls[0]?.values.includes("bounded_polarity"));
    assert.ok(calls[0]?.values.includes("reply-intent-v2"));
    assert.match(calls[1]?.sql ?? "", /replied_at/u);
  });

  it("does not emit a resolved event when canonical persistence fails to claim", async () => {
    let eventCount = 0;

    await emitClaimedReplyResolvedEvent(
      {
        replyClaimed: false,
        familyId: "00000000-0000-4000-8000-000000000001",
        channel: "email",
        resolvedOutcome: "answered",
        replySourceChannel: "email",
        resolutionMethod: "provider_reply",
        classifierVersion: "reply-intent-v2",
      },
      async () => {
        eventCount += 1;
      },
    );

    assert.equal(eventCount, 0);
  });

  it("emits only once when duplicate persistence repeats a claimed reply", async () => {
    const events: unknown[] = [];
    const emit = async (_name: string, props: unknown) => {
      events.push(props);
    };
    const input = {
      familyId: "00000000-0000-4000-8000-000000000001",
      channel: "email" as const,
      resolvedOutcome: "answered" as const,
      replySourceChannel: "sms" as const,
      resolutionMethod: "provider_reply" as const,
      classifierVersion: "reply-intent-v2",
    };

    await emitClaimedReplyResolvedEvent(
      { ...input, replyClaimed: true },
      emit,
    );
    await emitClaimedReplyResolvedEvent(
      { ...input, replyClaimed: false },
      emit,
    );

    assert.deepEqual(events, [
      {
        family_id: input.familyId,
        channel: "email",
        resolution: "matched",
        resolved_outcome: "answered",
        cross_channel: true,
        resolution_method: "provider_reply",
        classifier_version: "reply-intent-v2",
      },
    ]);
  });
});
