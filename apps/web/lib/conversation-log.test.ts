import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { persistConversationMessage } from "./conversation-log";
import type { InboundContinuityInput } from "./conversation-continuity/ledger";

describe("conversation log continuity integration", () => {
  it("carries authenticated provider reply metadata into canonical persistence", async () => {
    const resolvedInputs: InboundContinuityInput[] = [];
    const canonicalAttributes: Array<Record<string, unknown>> = [];

    const persisted = await persistConversationMessage(
      {
        attributes: {
          familyId: "family-1",
          memberUserId: "member-1",
          channel: "email",
          email: "parent@example.com",
          providerMessageId: "provider-inbound-1",
          providerReplyTo: "provider-outbound-1",
        },
        sessionId: "session-1",
        channelKind: "email",
        sequence: 1,
        role: "user",
        content: "providerReplyTo: forged-from-model-text",
        turnId: "turn-1",
      },
      {
        resolveInbound: async (input) => {
          resolvedInputs.push(input);
          return {
            episodeId: "episode-1",
            replyToMessageId: "message-outbound-1",
            repliedDeliveryId: "delivery-1",
            resolution: "matched",
            resolvedOutcome: "answered",
            acceptedOfferDeliveryId: null,
            resolutionMethod: "provider_reply",
            replyClassifierVersion: "reply-intent-v3",
            replySourceChannel: "email",
            contextMarkdown: "",
            threadKeyHash: "thread-hash",
          };
        },
        persistCanonical: async (input) => {
          canonicalAttributes.push(
            input.attributes as Record<string, unknown>,
          );
          return {
            id: "message-inbound-1",
            episodeId: "episode-1",
            replyClaimed: true,
          };
        },
        embed: async () => null,
        saveEmbedding: async () => undefined,
      },
    );

    assert.equal(
      resolvedInputs[0]?.providerReplyTo,
      "provider-outbound-1",
    );
    assert.equal(
      canonicalAttributes[0]?.repliedDeliveryId,
      "delivery-1",
    );
    assert.equal(canonicalAttributes[0]?.resolvedOutcome, "answered");
    assert.equal(canonicalAttributes[0]?.resolutionMethod, "provider_reply");
    assert.equal(
      canonicalAttributes[0]?.replyClassifierVersion,
      "reply-intent-v3",
    );
    assert.equal(persisted?.replyClaimed, true);
  });

  it("embeds terminal assistant text and replaces the earlier draft vector", async () => {
    const MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
    const EPISODE_ID = "33333333-3333-4333-8333-333333333333";
    const writes: Array<{ messageId: string; embedding: string; replaceExisting: boolean }> = [];

    const persisted = await persistConversationMessage(
      {
        attributes: { familyId: "family-1" },
        sessionId: "session-1",
        channelKind: "web",
        sequence: 0,
        role: "assistant",
        content: "The final printable is ready.",
        turnId: "turn-1",
        finishReason: "stop",
      },
      {
        resolveInbound: async () => {
          throw new Error("resolveInbound should not run for assistant writes");
        },
        persistCanonical: async () => ({
          id: MESSAGE_ID,
          episodeId: EPISODE_ID,
          replyClaimed: false,
        }),
        embed: async (text) => `embedding:${text}`,
        saveEmbedding: async (messageId, embedding, replaceExisting) => {
          writes.push({ messageId, embedding, replaceExisting });
        },
      },
    );

    assert.deepEqual(writes, [
      {
        messageId: MESSAGE_ID,
        embedding: "embedding:The final printable is ready.",
        replaceExisting: true,
      },
    ]);
    assert.equal(persisted?.id, MESSAGE_ID);
  });

  it("fills a null embedding for a non-terminal write without replacing an existing one", async () => {
    const MESSAGE_ID = "44444444-4444-4444-8444-444444444444";
    const writes: Array<{ replaceExisting: boolean }> = [];

    await persistConversationMessage(
      {
        attributes: { familyId: "family-1" },
        sessionId: "session-1",
        channelKind: "web",
        sequence: 0,
        role: "assistant",
        content: "Working on it...",
        turnId: "turn-1",
        finishReason: undefined,
      },
      {
        resolveInbound: async () => {
          throw new Error("resolveInbound should not run for assistant writes");
        },
        persistCanonical: async () => ({
          id: MESSAGE_ID,
          episodeId: "episode-1",
          replyClaimed: false,
        }),
        embed: async (text) => `embedding:${text}`,
        saveEmbedding: async (_messageId, _embedding, replaceExisting) => {
          writes.push({ replaceExisting });
        },
      },
    );

    assert.deepEqual(writes, [{ replaceExisting: false }]);
  });
});
