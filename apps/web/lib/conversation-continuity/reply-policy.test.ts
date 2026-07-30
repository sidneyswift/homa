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
      providerReplyTo: " provider-outbound-42@example.com ",
      candidates: [
        candidate({
          providerMessageId: "<provider-outbound-42@example.com>",
        }),
        candidate({
          deliveryId: "delivery-newer",
          messageId: "message-newer",
          providerMessageId: "<provider-outbound-99@example.com>",
          sentAt: new Date("2026-07-11T13:19:30.000Z"),
        }),
      ],
    });

    assert.equal(result.kind, "matched");
    if (result.kind === "matched") {
      assert.equal(
        result.candidate.providerMessageId,
        "<provider-outbound-42@example.com>",
      );
      assert.equal(result.outcome, "answered");
      assert.equal(result.method, "provider_reply");
      assert.equal(result.classifierVersion, "reply-intent-v3");
    }
  });

  it("does not let a long worksheet request close a yes or no offer by shared words", () => {
    const result = resolveReplyIntent({
      text: "Please make a long worksheet about fractions for Story.",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          replyKind: "yes_no",
          promptKey: "morning-brief:run-1",
          messageContent: "Want me to make a fractions worksheet?",
        }),
      ],
    });

    assert.equal(result.kind, "none");
  });

  it("classifies short yes or no replies to one yes or no offer", () => {
    const input = {
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms" as const,
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [candidate({ promptKey: "morning-brief:run-1" })],
    };

    for (const text of [
      "Yes",
      "Yes please",
      "Yes, please",
      "  YES,\tPLEASE!!  ",
    ]) {
      const result = resolveReplyIntent({ ...input, text });
      assert.equal(result.kind, "matched", text);
      if (result.kind === "matched") {
        assert.equal(result.outcome, "accepted", text);
      }
    }
    for (const text of [
      "No",
      "Not now",
      "No, thanks",
      "Nope",
      "  nO,\nThAnKs.  ",
    ]) {
      const result = resolveReplyIntent({ ...input, text });
      assert.equal(result.kind, "matched", text);
      if (result.kind === "matched") {
        assert.equal(result.outcome, "declined", text);
      }
    }
  });

  it("matches natural yes or no decisions without weakening ambiguity", () => {
    const input = {
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms" as const,
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [candidate({ promptKey: "morning-brief:run-1" })],
    };

    for (const [text, outcome] of [
      ["Yes, make it", "accepted"],
      ["I'd love that", "accepted"],
      ["Not today", "declined"],
      ["Maybe later", "declined"],
    ] as const) {
      const result = resolveReplyIntent({ ...input, text });
      assert.equal(result.kind, "matched", text);
      if (result.kind === "matched") {
        assert.equal(result.outcome, outcome, text);
        assert.equal(result.method, "bounded_polarity", text);
        assert.equal(result.classifierVersion, "reply-intent-v3", text);
      }
    }
  });

  it("does not treat non-polarity text as a yes or no reply", () => {
    for (const text of ["Why?", "Tell me more"]) {
      const result = resolveReplyIntent({
        text,
        now: NOW,
        memberUserId: "sidney",
        currentChannel: "sms",
        explicitDeliveryId: null,
        providerReplyTo: null,
        candidates: [candidate({ promptKey: "morning-brief:run-1" })],
      });

      assert.equal(result.kind, "none", text);
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
    if (result.kind === "matched") {
      assert.equal(result.outcome, "answered");
    }
  });

  it("matches a natural check-in answer to one same-channel choice loop", () => {
    const result = resolveReplyIntent({
      text: "She can do it with a little help.",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          replyKind: "choice",
          promptKey:
            "progress-check-in:check-in-1:revision:3",
          messageContent: "Can Story count up to five?",
        }),
      ],
    });

    assert.equal(result.kind, "matched");
    if (result.kind === "matched") {
      assert.equal(result.candidate.deliveryId, "delivery-1");
      assert.equal(result.outcome, "answered");
    }
  });

  it("uses the newest revision when repeated progress prompts are still open", () => {
    const result = resolveReplyIntent({
      text: "The Maya small group question.",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          deliveryId: "delivery-revision-4",
          replyKind: "choice",
          promptKey:
            "progress-check-in:check-in-1:revision:4",
          messageContent:
            "Does Maya tell you how many things are in a small group of 1 to 3 without counting them?",
          sentAt: new Date("2026-07-11T13:19:30.000Z"),
        }),
        candidate({
          deliveryId: "delivery-revision-3",
          replyKind: "choice",
          promptKey:
            "progress-check-in:check-in-1:revision:3",
          messageContent:
            "Does Maya tell you how many things are in a small group of 1 to 3 without counting them?",
          sentAt: new Date("2026-07-11T13:18:30.000Z"),
        }),
      ],
    });

    assert.equal(result.kind, "matched");
    if (result.kind === "matched") {
      assert.equal(result.candidate.deliveryId, "delivery-revision-4");
    }
  });

  it("does not let a choice loop capture an unrelated statement", () => {
    const result = resolveReplyIntent({
      text: "We switched to science and built a paper bridge.",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          replyKind: "choice",
          promptKey:
            "progress-check-in:check-in-1:revision:3",
          messageContent: "Can Story count up to five?",
        }),
      ],
    });

    assert.equal(result.kind, "none");
  });

  it("matches a clear cannot answer to the current choice loop", () => {
    const result = resolveReplyIntent({
      text: "She can't do that yet.",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          replyKind: "choice",
          promptKey:
            "progress-check-in:check-in-1:revision:3",
        }),
      ],
    });

    assert.equal(result.kind, "matched");
  });

  it("matches an exact answer-chip phrase across channels", () => {
    const result = resolveReplyIntent({
      text: "Getting there",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "web",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          replyKind: "choice",
          channel: "sms",
          promptKey:
            "progress-check-in:check-in-1:revision:3",
        }),
      ],
    });

    assert.equal(result.kind, "matched");
  });

  it("keeps a short sometimes answer but rejects a sometimes tangent", () => {
    const choice = candidate({
      replyKind: "choice",
      promptKey:
        "progress-check-in:check-in-1:revision:3",
    });
    const base = {
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms" as const,
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [choice],
    };

    assert.equal(
      resolveReplyIntent({
        ...base,
        text: "Sometimes.",
      }).kind,
      "matched",
    );
    assert.equal(
      resolveReplyIntent({
        ...base,
        text: "Sometimes we switch to science instead.",
      }).kind,
      "none",
    );
  });

  it("keeps generic yes and progress answers on their own loop kinds", () => {
    const yesNo = candidate({
      deliveryId: "delivery-yes-no",
      replyKind: "yes_no",
      promptKey: "morning-brief-offer",
    });
    const choice = candidate({
      deliveryId: "delivery-progress",
      replyKind: "choice",
      promptKey:
        "progress-check-in:dddddddd-dddd-4ddd-8ddd-dddddddddddd:revision:2",
    });
    const base = {
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms" as const,
      explicitDeliveryId: null,
      providerReplyTo: null,
    };

    const yes = resolveReplyIntent({
      ...base,
      text: "Yes",
      candidates: [choice],
    });
    const progressOnYesNo = resolveReplyIntent({
      ...base,
      text: "Getting there",
      candidates: [yesNo],
    });
    const mixed = resolveReplyIntent({
      ...base,
      text: "Getting there",
      candidates: [yesNo, choice],
    });

    assert.equal(yes.kind, "none");
    assert.equal(progressOnYesNo.kind, "none");
    assert.equal(mixed.kind, "matched");
    if (mixed.kind === "matched") {
      assert.equal(mixed.candidate.deliveryId, "delivery-progress");
    }
  });

  it("rejects a subject-changing progress-shaped sentence", () => {
    const result = resolveReplyIntent({
      text: "She needs help with reading instead",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          replyKind: "choice",
          promptKey:
            "progress-check-in:dddddddd-dddd-4ddd-8ddd-dddddddddddd:revision:2",
          messageContent: "Can Maya count out loud from 1 to 5?",
        }),
      ],
    });

    assert.equal(result.kind, "none");
  });

  it("treats plain negative replies as bounded progress choices", () => {
    const choice = candidate({
      deliveryId: "delivery-progress-negative",
      replyKind: "choice",
      promptKey:
        "progress-check-in:dddddddd-dddd-4ddd-8ddd-dddddddddddd:revision:2",
    });
    for (const text of ["No", "Nope", "No, not yet"]) {
      const result = resolveReplyIntent({
        text,
        now: NOW,
        memberUserId: "sidney",
        currentChannel: "sms",
        explicitDeliveryId: null,
        providerReplyTo: null,
        candidates: [choice],
      });
      assert.equal(result.kind, "matched", text);
    }
  });

  it("keeps a plain negative ambiguous across yes/no and progress loops", () => {
    const result = resolveReplyIntent({
      text: "No",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          deliveryId: "delivery-yes-no",
          replyKind: "yes_no",
          promptKey: "morning-brief-offer",
        }),
        candidate({
          deliveryId: "delivery-progress",
          replyKind: "choice",
          promptKey:
            "progress-check-in:dddddddd-dddd-4ddd-8ddd-dddddddddddd:revision:2",
        }),
      ],
    });

    assert.equal(result.kind, "ambiguous");
  });

  it("does not resolve a yes or no loop from prompt-key word overlap", () => {
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

    assert.equal(result.kind, "none");
  });

  it("does not resolve an approval loop from content-word overlap", () => {
    const result = resolveReplyIntent({
      text: "The fractions worksheet",
      now: NOW,
      memberUserId: "sidney",
      currentChannel: "sms",
      explicitDeliveryId: null,
      providerReplyTo: null,
      candidates: [
        candidate({
          replyKind: "approval",
          messageContent: "Approve the fractions worksheet?",
          promptKey: "worksheet-approval",
        }),
      ],
    });

    assert.equal(result.kind, "none");
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
      assert.equal(result.method, "explicit_delivery");
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

  it("reports an in-app voice turn as spoken, not sent", () => {
    // This is how a voice conversation reaches the next thing the parent
    // TYPES (founder direction 2026-07-29): no eve turn runs for a spoken
    // turn, so per-turn continuity context is the whole path. It has to
    // say what actually happened, or Homa will refer to having "sent" her
    // a message the parent only ever heard.
    const rendered = renderContinuityContext([
      {
        role: "user",
        visibility: "family",
        content: "Finn finished the whole page of fractions today.",
        happenedAt: new Date("2026-07-29T15:00:00.000Z"),
        memberName: "Carolyng",
        modality: "voice",
      },
      {
        role: "assistant",
        visibility: "family",
        content: "That is a real jump from last week.",
        happenedAt: new Date("2026-07-29T15:00:20.000Z"),
        modality: "voice",
      },
    ]);

    assert.match(rendered, /Carolyng previously said out loud/u);
    assert.match(rendered, /Homa previously said out loud/u);
    assert.doesNotMatch(rendered, /previously sent/u);
  });

  it("still says sent and said for typed history", () => {
    const rendered = renderContinuityContext([
      {
        role: "user",
        visibility: "family",
        content: "typed question",
        happenedAt: new Date("2026-07-29T15:00:00.000Z"),
      },
      {
        role: "assistant",
        visibility: "family",
        content: "typed reply",
        happenedAt: new Date("2026-07-29T15:00:20.000Z"),
      },
    ]);

    assert.match(rendered, /previously said: /u);
    assert.match(rendered, /previously sent: /u);
    assert.doesNotMatch(rendered, /out loud/u);
  });
});
