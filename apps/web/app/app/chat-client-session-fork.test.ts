import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("./chat-client.tsx", import.meta.url),
  "utf8",
);

/**
 * GH #170: two eve sessions ran for the same family within 17 seconds of
 * each other (2026-07-24), reproduced again 2026-07-25. Root cause: a
 * stream that dies mid-turn without a closing boundary event makes eve's
 * own client forget its session id (advanceSession in eve's
 * session-utils; no fix available from this repo), so `agent.status`
 * reads "error" (not busy) and `agent.session?.sessionId` reads
 * undefined while lost-turn recovery (turn-recovery.ts) is still finding
 * out whether the interrupted turn already finished server-side, which
 * can take up to RECOVERY_DEADLINE_MS. A manual send in that window used
 * to read the line as free and start a brand new eve session racing the
 * old one. These are structural checks (chat-client.tsx is not
 * straightforwardly mountable in a unit test; see
 * chat-client-progress-wiring.test.ts for the same convention) proving
 * the fix is actually wired, not just present as a helper nobody calls.
 */
describe("ChatClient session-fork fix (GH #170)", () => {
  it("folds recovering into the send-line-occupied decision for a plain composer send", () => {
    assert.match(
      source,
      /busy: isSendLineOccupied\(\{[\s\S]*?busy,[\s\S]*?recovering:\s+recovering \|\|\s+restoringBoundSession \|\|\s+bindingSyncFailure \|\|\s+authorizationParked,[\s\S]*?\}\)/u,
    );
  });

  it("folds recovering into the same gate for the attachment send path", () => {
    assert.match(
      source,
      /if \(\s*isSendLineOccupied\(\{[\s\S]*?busy,[\s\S]*?recovering:\s+recovering \|\|\s+restoringBoundSession \|\|\s+bindingSyncFailure \|\|\s+authorizationParked,[\s\S]*?\}\) \|\| preparingAttachments\s*\)/u,
    );
  });

  it("imports the shared occupied-check from chat-send-policy rather than re-deriving it", () => {
    assert.match(source, /isSendLineOccupied,\s*\n\s*prepareChatSend,/u);
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
    const recoveryStart = source.indexOf(
      "const startLostTurnRecovery = useCallback",
    );
    const recoveryBody = source.slice(
      recoveryStart,
      source.indexOf("useEffect(() => {\n    startRecoveryRef", recoveryStart),
    );
    const flushCount = recoveryBody.match(/flushQueuedMessages\(\)/gu)?.length ?? 0;
    // Aborted early return and failed-recovery tail. The recovered path
    // delegates to applyRecoveredTurn, whose shared close-out also flushes.
    assert.equal(flushCount, 2);
    assert.match(
      recoveryBody,
      /if \(recovered\) \{\s*applyRecoveredTurn\(recovered\);\s*return;/u,
    );
  });

  it("keeps flushQueuedMessages in startLostTurnRecovery's own dependency list", () => {
    assert.match(
      source,
      /const startLostTurnRecovery = useCallback\([\s\S]*?\}, \[[\s\S]*?flushQueuedMessages,[\s\S]*?\]\);/u,
    );
  });

  it("reuses the flush helper after normal finish and defers it for cutoff recovery", () => {
    assert.match(
      source,
      /if \(!snapshot\.error && !autoStopped\) flushQueuedMessages\(\);/u,
    );
  });
});

/**
 * GH #170 part 2: no pending/failed affordance existed at all before
 * this fix, so a dropped send left no trace on screen. Wiring checks for
 * the retry path, which routes back through sendMessage (and so through
 * the same isSendLineOccupied gate covered above) rather than calling
 * eve directly.
 */
describe("ChatClient retry-failed-message wiring (GH #170)", () => {
  it("only offers retry on the live session's own messages", () => {
    assert.match(
      source,
      /onRetryFailedMessage=\{\s*isLiveMessage \? retryFailedMessage : undefined\s*\}/u,
    );
  });

  it("retries as a card answer, not a composer send, so an unrelated in-progress draft is left alone", () => {
    assert.match(
      source,
      /function retryFailedMessage\(text: string\): void \{\s*sendMessage\(text, \{ kind: "card_answer" \}\);\s*\}/u,
    );
  });
});
