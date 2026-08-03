import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { EveMessage } from "eve/react";

import { MessageView, userMessageSendState } from "./message-parts";

/**
 * GH #170 part 2: a message the client could not confirm used to vanish
 * with no sign anything went wrong (a co-founder's turn arrived
 * truncated mid-sentence with no warning, and dropped-connection sends
 * left no trace at all). eve's own optimistic projection already carries
 * this state (message-reducer.js: `metadata.optimistic` +
 * `metadata.status`); these tests cover reading it, not a parallel
 * tracker.
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
      userMessageSendState(userMessage("Girls want to go to fao still", {
        status: "complete",
        turnId: "turn_1",
      })),
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

describe("MessageView send-state rendering", () => {
  it("shows a quiet Sending state for a message still awaiting confirmation", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        message={userMessage("Can I cab without car seats?", {
          optimistic: true,
          status: "submitted",
        })}
      />,
    );
    assert.match(html, /Sending/u);
    assert.doesNotMatch(html, /Not sent/u);
  });

  it("renders a parked authorization challenge as an actionable sign-in card", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        message={{
          id: "turn_2:assistant",
          role: "assistant",
          metadata: { status: "streaming", turnId: "turn_2" },
          parts: [
            {
              type: "authorization",
              state: "required",
              name: "calendar",
              displayName: "Calendar",
              description: "Calendar needs permission.",
              stepIndex: 0,
              turnId: "turn_2",
              authorization: {
                url: "https://homa.test/connect",
                userCode: "CODE-123",
                instructions: "Use the same account as your calendar.",
              },
            },
          ],
        } as unknown as EveMessage}
      />,
    );

    assert.match(html, /Connect Calendar/u);
    assert.match(html, /Sign in with Calendar/u);
    assert.match(html, /CODE-123/u);
    assert.match(html, /https:\/\/homa\.test\/connect/u);
  });

  it("shows Not sent plus a Retry control for a failed message when a handler is given", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        message={userMessage("To see empire at night", {
          optimistic: true,
          status: "failed",
        })}
        onRetryFailedMessage={() => {}}
      />,
    );
    assert.match(html, /Not sent/u);
    assert.match(html, />Retry</u);
  });

  it("still shows Not sent, honestly, even with no retry handler wired up", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        message={userMessage("To see empire at night", {
          optimistic: true,
          status: "failed",
        })}
      />,
    );
    assert.match(html, /Not sent/u);
    assert.doesNotMatch(html, />Retry</u);
  });

  it("shows neither state for an ordinary confirmed message", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        message={userMessage("Girls want to go to fao still", {
          status: "complete",
          turnId: "turn_1",
        })}
        onRetryFailedMessage={() => {}}
      />,
    );
    assert.doesNotMatch(html, /Sending/u);
    assert.doesNotMatch(html, /Not sent/u);
    assert.doesNotMatch(html, />Retry</u);
  });
});
