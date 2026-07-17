import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveInboundTurn,
  type ContinuityRepository,
  type EpisodeBinding,
  type EpisodeMessage,
} from "./continuity-service";
import type { PendingDeliveryCandidate } from "./reply-policy";

const NOW = new Date("2026-07-11T13:20:07.000Z");

class FakeContinuityRepository implements ContinuityRepository {
  pending: PendingDeliveryCandidate[] = [];
  bindings: EpisodeBinding[] = [];
  messages = new Map<string, EpisodeMessage[]>();
  createdEpisodes: string[] = [];

  async listPendingDeliveries(): Promise<PendingDeliveryCandidate[]> {
    return this.pending;
  }

  async findBinding(
    _familyId: string,
    channel: EpisodeBinding["channel"],
    threadKeyHash: string,
  ): Promise<EpisodeBinding | null> {
    return (
      this.bindings.find(
        (binding) =>
          binding.channel === channel &&
          binding.threadKeyHash === threadKeyHash,
      ) ?? null
    );
  }

  async findRecentEpisode(): Promise<string | null> {
    return null;
  }

  async createEpisode(): Promise<string> {
    const id = `episode-created-${this.createdEpisodes.length + 1}`;
    this.createdEpisodes.push(id);
    return id;
  }

  async upsertBinding(binding: EpisodeBinding): Promise<void> {
    this.bindings = this.bindings.filter(
      (current) =>
        !(
          current.channel === binding.channel &&
          current.threadKeyHash === binding.threadKeyHash
        ),
    );
    this.bindings.push(binding);
  }

  async listEpisodeMessages(
    _familyId: string,
    episodeId: string,
  ): Promise<EpisodeMessage[]> {
    return this.messages.get(episodeId) ?? [];
  }
}

function pendingFor(
  memberUserId: string,
  overrides: Partial<PendingDeliveryCandidate> = {},
): PendingDeliveryCandidate {
  return {
    deliveryId: `delivery-${memberUserId}`,
    episodeId: "episode-brief",
    messageId: "message-brief",
    recipientMemberUserId: memberUserId,
    channel: "sms",
    providerMessageId: null,
    sentAt: new Date("2026-07-11T13:18:52.000Z"),
    expiresAt: new Date("2026-07-12T13:18:52.000Z"),
    replyKind: "yes_no",
    destinationAuthenticated: false,
    messageContent: "Want a quick stop-and-go game?",
    ...overrides,
  };
}

describe("conversation continuity service", () => {
  it("attaches an SMS affirmative to the exact parent delivery and episode", async () => {
    const repository = new FakeContinuityRepository();
    repository.pending = [pendingFor("sidney"), pendingFor("alessa")];
    repository.messages.set("episode-brief", [
      {
        role: "user",
        visibility: "internal",
        content: "Compose the morning brief.",
        happenedAt: new Date("2026-07-11T13:18:26.000Z"),
        runtimeSessionId: "dispatch-session",
      },
      {
        role: "assistant",
        // The provider can accept a text before the dispatch event finishes
        // promoting the canonical row from internal to family-visible.
        visibility: "internal",
        content: "Want a quick stop-and-go game?",
        happenedAt: new Date("2026-07-11T13:18:52.000Z"),
        runtimeSessionId: "dispatch-session",
      },
    ]);

    const result = await resolveInboundTurn(repository, {
      familyId: "family-1",
      memberUserId: "sidney",
      channel: "sms",
      transportThreadKey: "telnyx:homa:sidney",
      runtimeSessionId: null,
      providerReplyTo: null,
      text: "Yes",
      now: NOW,
    });

    assert.equal(result.episodeId, "episode-brief");
    assert.equal(result.replyToMessageId, "message-brief");
    assert.equal(result.repliedDeliveryId, "delivery-sidney");
    assert.equal(result.resolution, "matched");
    assert.equal(result.resolvedOutcome, "accepted");
    assert.match(result.contextMarkdown, /Want a quick stop-and-go game/u);
    assert.doesNotMatch(result.contextMarkdown, /Compose the morning brief/u);
  });

  it("continues an existing transport binding for a substantive message", async () => {
    const repository = new FakeContinuityRepository();
    const threadKey = "telnyx:homa:sidney";
    const first = await resolveInboundTurn(repository, {
      familyId: "family-1",
      memberUserId: "sidney",
      channel: "sms",
      transportThreadKey: threadKey,
      runtimeSessionId: "runtime-1",
      providerReplyTo: null,
      text: "Tell me about fractions.",
      now: NOW,
    });
    const second = await resolveInboundTurn(repository, {
      familyId: "family-1",
      memberUserId: "sidney",
      channel: "sms",
      transportThreadKey: threadKey,
      runtimeSessionId: "runtime-1",
      providerReplyTo: null,
      text: "Can you make that simpler?",
      now: new Date(NOW.getTime() + 60_000),
    });

    assert.equal(first.episodeId, second.episodeId);
    assert.equal(repository.createdEpisodes.length, 1);
  });

  it("starts a new episode for a new thread with no reply candidate", async () => {
    const repository = new FakeContinuityRepository();

    const result = await resolveInboundTurn(repository, {
      familyId: "family-1",
      memberUserId: "sidney",
      channel: "web",
      transportThreadKey: "web:runtime-new",
      runtimeSessionId: "runtime-new",
      providerReplyTo: null,
      text: "What should Story work on this week?",
      now: NOW,
    });

    assert.equal(result.resolution, "none");
    assert.equal(result.episodeId, "episode-created-1");
    assert.equal(repository.createdEpisodes.length, 1);
  });

  it("returns all plausible open messages without choosing when a short reply is ambiguous", async () => {
    const repository = new FakeContinuityRepository();
    repository.pending = [
      pendingFor("sidney"),
      pendingFor("sidney", {
        deliveryId: "delivery-journal",
        episodeId: "episode-journal",
        messageId: "message-journal",
        sentAt: new Date("2026-07-11T13:19:30.000Z"),
      }),
    ];

    const result = await resolveInboundTurn(repository, {
      familyId: "family-1",
      memberUserId: "sidney",
      channel: "sms",
      transportThreadKey: "telnyx:homa:sidney",
      runtimeSessionId: null,
      providerReplyTo: null,
      text: "Sure",
      now: NOW,
    });

    assert.equal(result.resolution, "ambiguous");
    assert.equal(result.replyToMessageId, null);
    assert.equal(result.repliedDeliveryId, null);
    assert.match(result.contextMarkdown, /Two recent Homa messages/u);
    assert.match(result.contextMarkdown, /message-brief/u);
    assert.match(result.contextMarkdown, /message-journal/u);
  });
});
