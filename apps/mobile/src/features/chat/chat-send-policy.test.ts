import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSendLineOccupied } from "./chat-send-policy";

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
