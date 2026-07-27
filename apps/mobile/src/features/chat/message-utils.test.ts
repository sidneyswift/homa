import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EveMessage } from "eve/react";

import { userMessageSendState } from "./message-utils";

/**
 * The mobile twin of apps/web/app/app/message-parts-send-state.test.tsx's
 * userMessageSendState cases (GH #170 part 2). eve's own optimistic
 * projection already carries this state (message-reducer.js:
 * `metadata.optimistic` + `metadata.status`); these tests cover reading
 * it, not a parallel tracker. RN rendering itself is not covered here
 * (no component-test harness in this app yet); message-view.tsx wires
 * this function's result the same way chat-client-session-fork.test.ts's
 * source-matching covers chat-session.tsx's wiring for part 1.
 */

function userMessage(
  text: string,
  metadata?: EveMessage["metadata"],
): EveMessage {
  return {
    id: "optimistic:sub-1:user",
    role: "user",
    parts: [{ type: "text", text }],
    metadata,
  } as unknown as EveMessage;
}

function assistantMessage(): EveMessage {
  return {
    id: "turn_1:assistant",
    role: "assistant",
    parts: [{ type: "text", text: "Sure thing.", state: "done" }],
  } as unknown as EveMessage;
}

describe("userMessageSendState", () => {
  it("reads a submitted optimistic message as sending", () => {
    assert.equal(
      userMessageSendState(
        userMessage("Can I cab without car seats?", {
          optimistic: true,
          status: "submitted",
        }),
      ),
      "sending",
    );
  });

  it("reads a failed optimistic message as failed", () => {
    assert.equal(
      userMessageSendState(
        userMessage("To see empire at night", {
          optimistic: true,
          status: "failed",
        }),
      ),
      "failed",
    );
  });

  it("has nothing to say about a plain confirmed message", () => {
    assert.equal(
      userMessageSendState(
        userMessage("Girls want to go to fao still", {
          status: "complete",
          turnId: "turn_1",
        }),
      ),
      null,
    );
  });

  it("has nothing to say about a message with no metadata at all (archived history)", () => {
    assert.equal(userMessageSendState(userMessage("hi")), null);
  });

  it("never applies to an assistant message", () => {
    assert.equal(
      userMessageSendState({
        ...assistantMessage(),
        metadata: { optimistic: true, status: "submitted" },
      } as unknown as EveMessage),
      null,
    );
  });
});
