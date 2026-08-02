import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OUTBOUND_CHILD_FRAMING_FALLBACK } from "@homa/core";
import type { EveMessagePart } from "eve/react";

import {
  approvedOutboundChildFramingTexts,
  visibleWebChildFramingText,
} from "./outbound-child-framing-display";

function reviewResult(output: unknown, toolCallId: string): EveMessagePart {
  return {
    type: "dynamic-tool",
    toolName: "review_child_framing",
    toolCallId,
    state: "output-available",
    input: {},
    output,
  } as EveMessagePart;
}

describe("web child-framing display", () => {
  it("reads only accepted validator output as approval", () => {
    const approved = approvedOutboundChildFramingTexts([
      reviewResult(
        { accepted: false, text: "The research behind it." },
        "review-1",
      ),
      reviewResult(
        { accepted: true, text: "The evidence behind it." },
        "review-2",
      ),
    ]);
    assert.deepEqual([...approved], ["The evidence behind it."]);
  });

  it("hides an unapproved candidate while the message streams", () => {
    assert.equal(
      visibleWebChildFramingText({
        text: "She is not behind.",
        approvedTexts: new Set(),
        streaming: true,
      }),
      null,
    );
  });

  it("shows the fallback when an unapproved message completes", () => {
    assert.equal(
      visibleWebChildFramingText({
        text: "She is not behind.",
        approvedTexts: new Set(),
        streaming: false,
      }),
      OUTBOUND_CHILD_FRAMING_FALLBACK.web,
    );
  });

  it("shows an exact safe approval unchanged", () => {
    const text = "The research behind this activity is solid.";
    assert.equal(
      visibleWebChildFramingText({
        text,
        approvedTexts: new Set([text]),
        streaming: true,
      }),
      text,
    );
  });
});
