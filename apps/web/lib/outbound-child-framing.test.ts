import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OUTBOUND_CHILD_FRAMING_FALLBACK,
  findOutboundChildFramingCandidate,
  outboundChildFramingProposalSchema,
  protectOutboundChildFraming,
  validateOutboundChildFramingProposal,
} from "./outbound-child-framing";

describe("outbound child-framing candidate detection", () => {
  it("reuses the report copy-law vocabulary as a trigger", () => {
    assert.equal(findOutboundChildFramingCandidate("She is not behind him."), "behind");
    assert.equal(findOutboundChildFramingCandidate("No assessment is needed."), "assessment");
    assert.equal(findOutboundChildFramingCandidate("The skyline is clear."), null);
  });
});

describe("outbound child-framing proposal verification", () => {
  it("preserves measured safe senses byte for byte", () => {
    const safeMessages = [
      "Here is the actual chain of prerequisites behind it.",
      "I found the real research behind something you're already doing.",
      "The skyline is fading behind her in the picture.",
      "Handwriting speed usually lags behind the ideas going onto the page.",
      "These are the real exhibits behind the movie.",
    ];

    for (const intendedText of safeMessages) {
      const result = validateOutboundChildFramingProposal({
        intendedText,
        verdict: "safe",
        reason: "non_deficit_sense",
        evidenceQuote: "behind",
        repairedText: null,
      });
      assert.deepEqual(result, {
        accepted: true,
        text: intendedText,
        outcome: "judged_safe",
        candidate: "behind",
      });
    }
  });

  it("accepts a verified repair for the observed negating form", () => {
    const result = validateOutboundChildFramingProposal({
      intendedText: "Maya is not behind Finn. They are simply on different timelines.",
      verdict: "repair",
      reason: "child_deficit_denial",
      evidenceQuote: "not behind",
      repairedText:
        "Maya and Finn are on different timelines, and comparing them will not show what Maya needs next.",
    });

    assert.deepEqual(result, {
      accepted: true,
      text: "Maya and Finn are on different timelines, and comparing them will not show what Maya needs next.",
      outcome: "repaired",
      candidate: "behind",
    });
  });

  it("normalizes a repaired em dash through the existing runtime copy law", () => {
    const result = validateOutboundChildFramingProposal({
      intendedText: "She is not behind.",
      verdict: "repair",
      reason: "child_deficit_denial",
      evidenceQuote: "not behind",
      repairedText: "She is learning steadily\u2014on her own timeline.",
    });

    assert.equal(result.accepted, true);
    if (result.accepted) {
      assert.equal(result.text, "She is learning steadily, on her own timeline.");
    }
  });

  it("rejects an invented evidence quote", () => {
    const result = validateOutboundChildFramingProposal({
      intendedText: "She is not behind.",
      verdict: "safe",
      reason: "non_deficit_sense",
      evidenceQuote: "the research behind it",
      repairedText: null,
    });

    assert.deepEqual(result, {
      accepted: false,
      failure: "evidence_not_verbatim",
      candidate: "behind",
    });
  });

  it("rejects a repair that still carries report vocabulary", () => {
    const result = validateOutboundChildFramingProposal({
      intendedText: "She is not behind.",
      verdict: "repair",
      reason: "child_deficit_denial",
      evidenceQuote: "not behind",
      repairedText: "She is definitely not behind anyone.",
    });

    assert.deepEqual(result, {
      accepted: false,
      failure: "invalid_repair",
      candidate: "behind",
    });
  });

  it("rejects inconsistent verdict fields", () => {
    const result = validateOutboundChildFramingProposal({
      intendedText: "The research behind this is solid.",
      verdict: "safe",
      reason: "child_deficit_assertion",
      evidenceQuote: "behind",
      repairedText: null,
    });

    assert.equal(result.accepted, false);
  });

  it("rejects malformed structured input at the schema boundary", () => {
    assert.equal(
      outboundChildFramingProposalSchema.safeParse({
        intendedText: "She is behind.",
        verdict: "maybe",
        evidenceQuote: "behind",
      }).success,
      false,
    );
  });
});

describe("outbound child-framing channel boundary", () => {
  it("does no approval work when report vocabulary is absent", () => {
    const text = "Maya and Finn are learning on their own timelines.";
    assert.deepEqual(
      protectOutboundChildFraming({ text, approvedText: null, channel: "sms" }),
      { text, outcome: "no_candidate", candidate: null },
    );
  });

  it("delivers an exact current-turn safe approval", () => {
    const text = "The research behind this activity is solid.";
    assert.deepEqual(
      protectOutboundChildFraming({
        text,
        approvedText: text,
        channel: "email",
      }),
      { text, outcome: "judged_safe", candidate: "behind" },
    );
  });

  it("fails closed without an exact current-turn approval", () => {
    assert.deepEqual(
      protectOutboundChildFraming({
        text: "She is not behind.",
        approvedText: "The research behind this activity is solid.",
        channel: "dispatch",
      }),
      {
        text: OUTBOUND_CHILD_FRAMING_FALLBACK.dispatch,
        outcome: "fallback",
        candidate: "behind",
      },
    );
  });
});
