import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSendLineOccupied, takeNextQueuedTurn } from "./chat-send-policy";

/**
 * The mobile twin of apps/web/app/app/chat-send-policy.test.ts's
 * isSendLineOccupied suite. GH #170: a stream that dies mid-turn wipes
 * eve's local session id (status flips to "error", not
 * "streaming"/"submitted"), while lost-turn recovery is still finding
 * out whether the interrupted turn already finished server-side. A send
 * in that window used to read as free (busy: false) and started a brand
 * new eve session, forking the conversation. Recovering must occupy the
 * line the same way busy does.
 */
describe("isSendLineOccupied", () => {
  it("treats an in-flight recovery as occupying the line even though nothing is streaming", () => {
    assert.equal(isSendLineOccupied({ busy: false, recovering: true }), true);
  });

  it("still treats an active stream as occupying the line", () => {
    assert.equal(isSendLineOccupied({ busy: true, recovering: false }), true);
  });

  it("frees the line once neither a stream nor a recovery is running", () => {
    assert.equal(
      isSendLineOccupied({ busy: false, recovering: false }),
      false,
    );
  });

  it("stays occupied if both happen to be true at once", () => {
    assert.equal(isSendLineOccupied({ busy: true, recovering: true }), true);
  });
});

describe("takeNextQueuedTurn", () => {
  it("batches adjacent parent messages", () => {
    assert.deepEqual(takeNextQueuedTurn([
      { text: "First", lane: "parent" },
      { text: "Second", lane: "parent" },
    ]), { message: "First\n\nSecond", remaining: [] });
  });

  it("keeps a directive out of the parent's turn", () => {
    assert.deepEqual(takeNextQueuedTurn([
      { text: "Her words", lane: "parent" },
      { text: "[[homa:onboarding details_saved summary=Mia]]", lane: "directive" },
      { text: "Later", lane: "parent" },
    ]), {
      message: "Her words",
      remaining: [
        { text: "[[homa:onboarding details_saved summary=Mia]]", lane: "directive" },
        { text: "Later", lane: "parent" },
      ],
    });
  });

  it("sends a leading directive by itself", () => {
    assert.deepEqual(takeNextQueuedTurn([
      { text: "[[homa:onboarding kickoff]]", lane: "directive" },
      { text: "Her words", lane: "parent" },
    ]), {
      message: "[[homa:onboarding kickoff]]",
      remaining: [{ text: "Her words", lane: "parent" }],
    });
  });

  it("keeps an exact-child context attached to only its parent message", () => {
    const context = {
      source: "progress" as const,
      intent: "share_progress_evidence" as const,
      progressChildId: "child-maya",
    };
    assert.deepEqual(takeNextQueuedTurn([
      { text: "Maya read a page", lane: "parent", clientContext: context },
      { text: "Also help with lunch", lane: "parent" },
    ]), {
      message: "Maya read a page",
      clientContext: context,
      remaining: [{ text: "Also help with lunch", lane: "parent" }],
    });
  });

  it("stops a plain parent batch before a contextual Progress message", () => {
    const contextual = {
      text: "Maya read a page",
      lane: "parent" as const,
      clientContext: {
        source: "progress" as const,
        intent: "share_progress_evidence" as const,
        progressChildId: "child-maya",
      },
    };
    assert.deepEqual(takeNextQueuedTurn([
      { text: "First", lane: "parent" },
      contextual,
    ]), {
      message: "First",
      remaining: [contextual],
    });
  });

  it("keeps verified proposal headers on exactly one queued parent message", () => {
    const headers = {
      "x-homa-progress-next-move-child": "child-maya",
      "x-homa-progress-next-move-fingerprint": "a".repeat(64),
    };
    assert.deepEqual(
      takeNextQueuedTurn([
        { text: "Adjust this idea", lane: "parent", headers },
        { text: "Also help with lunch", lane: "parent" },
      ]),
      {
        message: "Adjust this idea",
        headers,
        remaining: [{ text: "Also help with lunch", lane: "parent" }],
      },
    );
  });
});
