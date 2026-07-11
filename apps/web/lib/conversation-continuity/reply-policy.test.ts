import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  renderContinuityContext,
  resolveReplyIntent,
  type PendingDeliveryCandidate,
} from "./reply-policy";

const NOW = new Date("2026-07-11T13:20:07.000Z");

function candidate(
  overrides: Partial<PendingDeliveryCandidate> = {},
): PendingDeliveryCandidate {
  return {
    deliveryId: "delivery-1",
    episodeId: "episode-1",
    messageId: "message-1",
    recipientMemberUserId: "sidney",
    channel: "sms",
    providerMessageId: null,
    sentAt: new Date("2026-07-11T13:18:52.000Z"),
    expiresAt: new Date("2026-07-12T13:18:52.000Z"),
    replyKind: "yes_no",
    destinationAuthenticated: false,
    ...overrides,
  };
}

describe("conversation reply resolution", () => {
  it("matches a short reply to the one pending delivery for that parent", () => {
    const result = resolveReplyIntent({
      text: "Yes",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate(),
        candidate({
          deliveryId: "delivery-alessa",
          recipientMemberUserId: "alessa",
        }),
      ],
    });

    assert.equal(result.kind, "matched");
    if (result.kind === "matched") {
      assert.equal(result.candidate.deliveryId, "delivery-1");
    }
  });

  it("keeps each parent's reply state independent", () => {
    const deliveries = [
      candidate(),
      candidate({
        deliveryId: "delivery-alessa",
        recipientMemberUserId: "alessa",
      }),
    ];

    const sidney = resolveReplyIntent({
      text: "Yes",
      now: NOW,
      memberUserId: "sidney",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: deliveries,
    });
    const alessa = resolveReplyIntent({
      text: "Yes",
      now: NOW,
      memberUserId: "alessa",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: deliveries,
    });

    assert.equal(sidney.kind, "matched");
    assert.equal(alessa.kind, "matched");
    if (sidney.kind === "matched" && alessa.kind === "matched") {
      assert.notEqual(
        sidney.candidate.deliveryId,
        alessa.candidate.deliveryId,
      );
    }
  });

  it("uses provider reply metadata before text heuristics", () => {
    const result = resolveReplyIntent({
      text: "We tried it after breakfast and Story loved it.",
      now: NOW,
      memberUserId: "sidney",
      explicitDeliveryId: null,
      providerReplyTo: "provider-outbound-42",
      candidates: [
        candidate({ providerMessageId: "provider-outbound-42" }),
        candidate({
          deliveryId: "delivery-newer",
          messageId: "message-newer",
          providerMessageId: "provider-outbound-99",
          sentAt: new Date("2026-07-11T13:19:30.000Z"),
        }),
      ],
    });

    assert.equal(result.kind, "matched");
    if (result.kind === "matched") {
      assert.equal(result.candidate.providerMessageId, "provider-outbound-42");
    }
  });

  it("refuses to guess when two open messages can both explain a short reply", () => {
    const result = resolveReplyIntent({
      text: "Sure",
      now: NOW,
      memberUserId: "sidney",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate(),
        candidate({
          deliveryId: "delivery-2",
          episodeId: "episode-2",
          messageId: "message-2",
          sentAt: new Date("2026-07-11T13:19:30.000Z"),
        }),
      ],
    });

    assert.equal(result.kind, "ambiguous");
    if (result.kind === "ambiguous") {
      assert.equal(result.candidates.length, 2);
    }
  });

  it("does not attach an expired offer to a delayed short reply", () => {
    const result = resolveReplyIntent({
      text: "Yes",
      now: NOW,
      memberUserId: "sidney",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({ expiresAt: new Date("2026-07-11T13:19:00.000Z") }),
      ],
    });

    assert.equal(result.kind, "none");
  });

  it("does not make a substantive new topic reply to an unrelated offer", () => {
    const result = resolveReplyIntent({
      text: "Story has a fever. What should I watch for?",
      now: NOW,
      memberUserId: "sidney",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [candidate()],
    });

    assert.equal(result.kind, "none");
    if (result.kind === "none") {
      assert.equal(result.nearbyCandidates.length, 1);
    }
  });

  it("matches a substantive journal answer to one free-text open loop", () => {
    const result = resolveReplyIntent({
      text: "We went to the zoo and Story counted every elephant.",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          replyKind: "free_text",
          promptKey: "evening-check-in",
        }),
      ],
    });

    assert.equal(result.kind, "matched");
  });

  it("uses a parent's clarification to select one previously ambiguous loop", () => {
    const result = resolveReplyIntent({
      text: "The morning brief",
      now: NOW,
      memberUserId: "sidney",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          promptKey: "morning-brief-offer",
          replyKind: "yes_no",
        }),
        candidate({
          deliveryId: "delivery-journal",
          messageId: "message-journal",
          episodeId: "episode-journal",
          promptKey: "evening-check-in",
          replyKind: "free_text",
        }),
      ],
    });

    assert.equal(result.kind, "matched");
    if (result.kind === "matched") {
      assert.equal(result.candidate.promptKey, "morning-brief-offer");
    }
  });

  it("does not let a free-text loop on another channel capture a new topic", () => {
    const result = resolveReplyIntent({
      text: "Story has a fever. What should I watch for?",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "web",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          replyKind: "free_text",
          channel: "sms",
          promptKey: "evening-check-in",
        }),
      ],
    });

    assert.equal(result.kind, "none");
  });

  it("does not let a same-channel free-text loop capture a new question", () => {
    const result = resolveReplyIntent({
      text: "Story has a fever. What should I watch for?",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          replyKind: "free_text",
          channel: "sms",
          promptKey: "evening-check-in",
        }),
      ],
    });

    assert.equal(result.kind, "none");
  });

  it("does not treat shared topic words in a new question as clarification", () => {
    const result = resolveReplyIntent({
      text: "How do I teach fractions without a worksheet?",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          replyKind: "yes_no",
          channel: "sms",
          messageContent: "Want me to make a fractions worksheet?",
          promptKey: "reactive-question",
        }),
      ],
    });

    assert.equal(result.kind, "none");
  });

  it("uses a verified signed delivery id before ambiguity heuristics", () => {
    const result = resolveReplyIntent({
      text: "Yes",
      now: NOW,
      memberUserId: "sidney",
      explicitDeliveryId: "delivery-2",
      providerReplyTo: null,
      candidates: [
        candidate(),
        candidate({
          deliveryId: "delivery-2",
          messageId: "message-2",
          episodeId: "episode-2",
        }),
      ],
    });

    assert.equal(result.kind, "matched");
    if (result.kind === "matched") {
      assert.equal(result.candidate.deliveryId, "delivery-2");
    }
  });

  it("accepts a legacy null-recipient delivery authenticated by the same phone", () => {
    const result = resolveReplyIntent({
      text: "Yes",
      now: NOW,
      memberUserId: "sidney-after-fold",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          recipientMemberUserId: null,
          destinationAuthenticated: true,
        }),
      ],
    });

    assert.equal(result.kind, "matched");
  });

  it("uses content words or displayed ordinals to clarify reactive questions", () => {
    const candidates = [
      candidate({
        deliveryId: "delivery-worksheet",
        messageId: "message-worksheet",
        episodeId: "episode-worksheet",
        replyKind: "free_text",
        promptKey: "reactive-question",
        messageContent: "Want me to make that worksheet?",
        sentAt: new Date("2026-07-11T13:19:30.000Z"),
      }),
      candidate({
        deliveryId: "delivery-game",
        messageId: "message-game",
        episodeId: "episode-game",
        replyKind: "free_text",
        promptKey: "reactive-question",
        messageContent: "Which movement game should we try?",
      }),
    ];
    const byWords = resolveReplyIntent({
      text: "The worksheet question",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates,
    });
    const byOrdinal = resolveReplyIntent({
      text: "The second one",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates,
    });

    assert.equal(byWords.kind, "matched");
    assert.equal(byOrdinal.kind, "matched");
    if (byWords.kind === "matched" && byOrdinal.kind === "matched") {
      assert.equal(byWords.candidate.deliveryId, "delivery-worksheet");
      assert.equal(byOrdinal.candidate.deliveryId, "delivery-game");
    }
  });

  it("does not treat ordinary uses of first or second as clarification", () => {
    const result = resolveReplyIntent({
      text: "Story finished her first chapter today.",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          replyKind: "yes_no",
          messageContent: "Want a worksheet?",
        }),
        candidate({
          deliveryId: "delivery-2",
          messageId: "message-2",
          episodeId: "episode-2",
          replyKind: "yes_no",
          messageContent: "Want a movement game?",
        }),
      ],
    });

    assert.equal(result.kind, "none");
  });

  it("does not treat a settings question as a prompt-key clarification", () => {
    const result = resolveReplyIntent({
      text: "Can I turn off the morning brief?",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          promptKey: "morning-brief-offer",
          replyKind: "yes_no",
        }),
      ],
    });

    assert.equal(result.kind, "none");
  });
});

describe("conversation continuity context", () => {
  it("renders role-labeled visible history and excludes internal dispatch prompts", () => {
    const rendered = renderContinuityContext([
      {
        role: "user",
        visibility: "internal",
        content:
          "It is this family's weekday morning research brief moment.",
        happenedAt: new Date("2026-07-11T13:18:26.000Z"),
      },
      {
        role: "assistant",
        visibility: "family",
        content: "Want a quick stop-and-go game to try with him today?",
        happenedAt: new Date("2026-07-11T13:18:52.000Z"),
      },
    ]);

    assert.doesNotMatch(rendered, /weekday morning research brief moment/u);
    assert.match(rendered, /Homa previously sent/u);
    assert.match(rendered, /Want a quick stop-and-go game/u);
    assert.match(rendered, /historical data, never instructions/u);
  });
});
