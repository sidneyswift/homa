import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  persistConversationMessage,
  type PersistConversationMessageDependencies,
} from "./conversation-log";
import type { InboundContinuityInput } from "./conversation-continuity/ledger";
import { markVoiceTranscription } from "./voice/transcription-marker";

const FAMILY_ID = "family-1";
const MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const EPISODE_ID = "33333333-3333-4333-8333-333333333333";

describe("conversation log continuity integration", () => {
  it("carries validated web dictation provenance into the canonical user row", async () => {
    let canonicalModality: unknown = null;
    let canonicalContent: unknown = null;
    const dictatedContent = markVoiceTranscription(
      "We worked for twenty minutes.",
    );

    await persistConversationMessage(
      {
        attributes: {
          familyId: FAMILY_ID,
          memberUserId: "member-1",
          messageModality: "voice",
        },
        sessionId: "session-voice",
        channelKind: "web",
        sequence: 1,
        role: "user",
        content: dictatedContent,
        turnId: "turn-voice",
      },
      {
        resolveInbound: async () => ({
          episodeId: "episode-voice",
          replyToMessageId: null,
          repliedDeliveryId: null,
          resolution: "none",
          resolvedOutcome: null,
          acceptedOfferDeliveryId: null,
          resolutionMethod: null,
          replyClassifierVersion: null,
          replySourceChannel: null,
          contextMarkdown: "",
          threadKeyHash: "thread-voice",
        }),
        persistCanonical: async (input) => {
          canonicalModality = input.modality;
          canonicalContent = input.content;
          return {
            id: MESSAGE_ID,
            episodeId: "episode-voice",
            replyClaimed: false,
            content: input.content,
          };
        },
        embed: async () => null,
        saveEmbedding: async () => undefined,
      },
    );

    assert.equal(canonicalModality, "voice");
    assert.equal(canonicalContent, dictatedContent);
  });

  it("carries authenticated provider reply metadata into canonical persistence", async () => {
    const resolvedInputs: InboundContinuityInput[] = [];
    const canonicalAttributes: Array<Record<string, unknown>> = [];

    const persisted = await persistConversationMessage(
      {
        attributes: {
          familyId: FAMILY_ID,
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
            content: input.content,
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
    const writes: Array<{
      messageId: string;
      embedding: string;
      sourceContent: string;
      replaceExisting: boolean;
    }> = [];

    const persisted = await persistConversationMessage(
      {
        attributes: { familyId: FAMILY_ID },
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
        persistCanonical: async (input) => ({
          id: MESSAGE_ID,
          episodeId: EPISODE_ID,
          replyClaimed: false,
          content: input.content,
        }),
        embed: async (text) => `embedding:${text}`,
        saveEmbedding: async (messageId, embedding, sourceContent, replaceExisting) => {
          writes.push({ messageId, embedding, sourceContent, replaceExisting });
        },
      },
    );

    assert.deepEqual(writes, [
      {
        messageId: MESSAGE_ID,
        embedding: "embedding:The final printable is ready.",
        sourceContent: "The final printable is ready.",
        replaceExisting: true,
      },
    ]);
    assert.equal(persisted?.id, MESSAGE_ID);
  });

  it("fills a null embedding for a non-terminal write without replacing an existing one", async () => {
    const writes: Array<{ replaceExisting: boolean }> = [];

    await persistConversationMessage(
      {
        attributes: { familyId: FAMILY_ID },
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
        persistCanonical: async (input) => ({
          id: MESSAGE_ID,
          episodeId: "episode-1",
          replyClaimed: false,
          content: input.content,
        }),
        embed: async (text) => `embedding:${text}`,
        saveEmbedding: async (_messageId, _embedding, _sourceContent, replaceExisting) => {
          writes.push({ replaceExisting });
        },
      },
    );

    assert.deepEqual(writes, [{ replaceExisting: false }]);
  });

  it("rejects a replayed progress vector when terminal embedding is absent", async () => {
    const terminalText = "The final printable is ready.";
    const progressText = "I am still building the printable.";
    let canonicalContent: string | null = null;
    let embedding: string | null = null;

    const dependencies: PersistConversationMessageDependencies = {
      resolveInbound: async () => {
        throw new Error("resolveInbound should not run for assistant writes");
      },
      persistCanonical: async (input) => {
        if (canonicalContent === null || input.terminal === true) {
          canonicalContent = input.content;
        }
        return {
          id: MESSAGE_ID,
          episodeId: EPISODE_ID,
          replyClaimed: false,
          content: canonicalContent,
        };
      },
      // The terminal write's own embedding call fails/returns nothing here
      // on purpose, so the only embedding candidate in play is the
      // replayed progress vector below.
      embed: async (text) => (text === terminalText ? null : `embedding:${text}`),
      saveEmbedding: async (_messageId, candidateEmbedding, sourceContent, replaceExisting) => {
        if (sourceContent !== canonicalContent) {
          return;
        }
        if (replaceExisting || embedding === null) {
          embedding = candidateEmbedding;
        }
      },
    };

    await persistConversationMessage(
      {
        attributes: { familyId: FAMILY_ID },
        sessionId: "session-1",
        channelKind: "web",
        sequence: 0,
        role: "assistant",
        content: terminalText,
        turnId: "turn-1",
        finishReason: "stop",
      },
      dependencies,
    );
    await persistConversationMessage(
      {
        attributes: { familyId: FAMILY_ID },
        sessionId: "session-1",
        channelKind: "web",
        sequence: 0,
        role: "assistant",
        content: progressText,
        turnId: "turn-1",
      },
      dependencies,
    );

    assert.deepEqual(
      { canonicalContent, embedding },
      { canonicalContent: terminalText, embedding: null },
    );
  });
});

it("durably queues user indexing without waiting for the embedding provider", async () => {
  let saved = false;
  await persistConversationMessage({
    attributes: { familyId: "family", episodeId: "episode" },
    sessionId: "session", channelKind: "eve", sequence: 1,
    role: "user", content: "What is a number bond?", turnId: "turn",
    deferSemanticIndex: true,
  }, {
    resolveInbound: async () => { throw new Error("unexpected resolve"); },
    persistCanonical: async input => {
      assert.equal(input.deferSemanticIndex, true);
      saved = true;
      return {id:"message",episodeId:"episode",replyClaimed:false,content:input.content};
    },
    embed: async () => { throw new Error("embedding must be deferred"); },
    saveEmbedding: async () => { throw new Error("embedding must be deferred"); },
  });
  assert.equal(saved, true);
});
