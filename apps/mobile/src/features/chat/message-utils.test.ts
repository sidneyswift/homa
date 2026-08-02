import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import type { EveMessage, EveMessagePart } from "eve/react";

import {
  partIsRenderable,
  toolOnlyFallback,
  userMessageSendState,
} from "./message-utils";

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

function completedTool(
  toolName: string,
  output: Record<string, unknown>,
): EveMessagePart {
  return {
    type: "dynamic-tool",
    toolName,
    state: "output-available",
    toolCallId: `call-${toolName}`,
    input: {},
    output,
  } as unknown as EveMessagePart;
}

function assistantWith(...parts: EveMessagePart[]): EveMessage {
  return {
    id: "turn_2:assistant",
    role: "assistant",
    parts,
  } as unknown as EveMessage;
}

describe("mobile tool rendering", () => {
  it("allows the planner card through the same renderability gate as its view", () => {
    assert.equal(partIsRenderable(completedTool("open_planner", { opened: true })), true);
    assert.equal(partIsRenderable(completedTool("open_planner", { opened: false })), false);
  });

  it("names a checklist result when the native card cannot render it yet", () => {
    assert.equal(
      toolOnlyFallback(
        assistantWith(
          completedTool("start_checklist", {
            started: true,
            childName: "Mia",
          }),
        ),
      ),
      "Mia's questions are ready, but that checklist cannot open in the phone app yet.",
    );
  });

  it("keeps internal tool work quiet when the assistant also wrote a reply", () => {
    assert.equal(
      toolOnlyFallback(
        assistantWith(
          completedTool("get_children", { children: [] }),
          { type: "text", text: "What should we try next?" } as EveMessagePart,
        ),
      ),
      null,
    );
  });

  it("shows an honest generic fallback instead of dropping an unknown tool-only turn", () => {
    assert.equal(
      toolOnlyFallback(assistantWith(completedTool("future_card", { opened: true }))),
      "I could not show a result for that in the phone app.",
    );
  });

  it("does not invent a fallback while a tool is still running", () => {
    assert.equal(
      toolOnlyFallback(
        assistantWith({
          type: "dynamic-tool",
          toolName: "future_card",
          state: "input-available",
          toolCallId: "call-future-card",
          input: {},
        } as unknown as EveMessagePart),
      ),
      null,
    );
  });

  it("wires the message-level fallback into the React Native transcript", async () => {
    const source = await readFile(new URL("./message-view.tsx", import.meta.url), "utf8");
    assert.match(source, /const fallback = toolOnlyFallback\(message\)/u);
    assert.match(source, /\{fallback\}/u);
  });
});
