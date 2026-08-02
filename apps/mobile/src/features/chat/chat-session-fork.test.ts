import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("./chat-session.tsx", import.meta.url),
  "utf8",
);

/**
 * GH #170, ported from the web twin (apps/web/app/app/chat-client.tsx):
 * a stream that dies mid-turn without a closing boundary event makes
 * eve's own client forget its session id (advanceSession in eve's
 * session-utils; no fix available from this repo), so `busy` reads false
 * while lost-turn recovery (lib/turn-recovery.ts) is still finding out
 * whether the interrupted turn already finished server-side, which can
 * take up to RECOVERY_DEADLINE_MS. A manual send in that window used to
 * read the line as free and start a brand new eve session racing the
 * old one. Confirmed live on web; this app has the identical
 * `recoveryRef`/`recovering`/busy shape and had not been reported for it
 * yet only because it is new. These are structural checks
 * (chat-session.tsx is a React Native screen, not mountable in a node
 * test; see question-card-model.test.ts for the same convention of
 * testing the pure logic this screen wires up) proving the fix is
 * actually wired, not just present as a helper nobody calls.
 */
describe("ChatSession session-fork fix (GH #170, mobile twin)", () => {
  it("imports the shared occupied-check from chat-send-policy rather than re-deriving it", () => {
    assert.match(
      source,
      /isSendLineOccupied,\s*takeNextQueuedTurn,/u,
    );
  });

  it("folds recovering into the send-line-occupied decision for a manual send", () => {
    assert.match(
      source,
      /if \(restoringSession \|\| isSendLineOccupied\(\{ busy, recovering \}\)\) \{/u,
    );
  });

  it("blocks first-send controls while the shared server binding is unresolved", () => {
    assert.match(source, /restoringSession: boolean;/u);
    assert.match(source, /disabled=\{restoringSession \|\| draft\.trim\(\)\.length === 0\}/u);
    assert.match(source, /recovering \|\| restoringSession/u);
  });

  it("no longer relies on a manual send aborting the running recovery as its fork guard", () => {
    // The abort call may still exist as a defensive no-op for the
    // narrow same-tick race, but the comment above it must no longer
    // claim it is what keeps sessions from forking (that job now
    // belongs to isSendLineOccupied, checked before send() is ever
    // reached).
    assert.doesNotMatch(
      source,
      /stands down \(its reply would land into a/u,
    );
  });

  it("flushes whatever queued while recovery was undecided, on every one of its exits", () => {
    const recoveryEffect = source.slice(
      source.indexOf("useEffect(() => {\n    if (!agentError"),
      source.indexOf("}, [agentError, agentReset, emitTurnCompleted, flushQueued"),
    );
    const flushCount = (recoveryEffect.match(/flushQueued\(\)/gu) ?? []).length;
    // Aborted-early-return, and the shared recovered/failed tail.
    assert.equal(flushCount, 2);
  });

  it("keeps flushQueued in the recovery effect's own dependency list", () => {
    assert.match(
      source,
      /\}, \[agentError, agentReset, emitTurnCompleted, flushQueued, liveTimes, storageKey\]\);/u,
    );
  });

  it("reuses the one flush helper from onFinish instead of a second inline copy", () => {
    assert.match(source, /if \(!snapshot\.error\) flushQueued\(\);/u);
  });

  it("mirrors queued into a ref so the long-lived recovery effect never reads a stale queue", () => {
    assert.match(source, /queuedRef\.current = queued;/u);
    assert.match(source, /takeNextQueuedTurn\(queuedRef\.current\)/u);
    assert.match(source, /queuedRef\.current = next\.remaining;/u);
  });
});

/**
 * GH #170 part 2 (web twin: message-parts.tsx's retry affordance): no
 * pending/failed affordance existed at all before this fix, so a dropped
 * send left no trace on screen beyond the generic error banner. Wiring
 * checks for the retry path, which routes back through sendMessage (and
 * so through the same isSendLineOccupied gate covered above) rather than
 * calling eve directly.
 */
describe("ChatSession retry-failed-message wiring (GH #170 part 2, mobile twin)", () => {
  it("only offers retry on the live session's own messages", () => {
    assert.match(
      source,
      /onRetryFailedMessage=\{\s*liveMessageSet\.has\(item\.message\)\s*\?\s*retryFailedMessage\s*:\s*undefined\s*\}/u,
    );
  });

  it("retries as a card send, not a composer send, so an unrelated in-progress draft is left alone", () => {
    assert.match(
      source,
      /function retryFailedMessage\(text: string\): void \{\s*sendMessage\(text, "card"\);\s*\}/u,
    );
  });
});
