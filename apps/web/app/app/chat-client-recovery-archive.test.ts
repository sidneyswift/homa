import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("./chat-client.tsx", import.meta.url),
  "utf8",
);

/**
 * GH #466: when lost-turn recovery hit RECOVERY_DEADLINE_MS without the
 * server ever confirming what happened, the aborted branch of
 * startLostTurnRecovery gave up with no archive and no reset. The turn's
 * own messages stayed live forever, un-cleared, so a later send appended
 * past them (the disclosure's ordering bug) and eve's own session-cursor
 * wipe on the dead stream meant a later page load asked the server for
 * the wrong session (the message read as gone). These are structural
 * checks (chat-client.tsx is not straightforwardly mountable in a unit
 * test; see chat-client-session-fork.test.ts for the same convention)
 * proving the fix is actually wired, not just present as a helper nobody
 * calls. buildTranscript's archived-before-live guarantee this relies on
 * is covered with a real, executed test in transcript-days.test.ts.
 */
describe("ChatClient recovery-timeout archiving fix (GH #466)", () => {
  const abortedBranch = source.slice(
    source.indexOf("if (controller.signal.aborted) {"),
    source.indexOf("if (recovered) {"),
  );

  it("folds whatever is still live into the archive on abort, not just on a confirmed recovery", () => {
    assert.match(abortedBranch, /const stillLive = messagesRef\.current;/u);
    assert.match(abortedBranch, /archiveMessages\(stillLive, stamped\)/u);
  });

  it("resets the live store on abort, mirroring the recovered branch, so nothing renders twice", () => {
    assert.match(abortedBranch, /agentReset\(\);/u);
    assert.match(abortedBranch, /durableCursorRef\.current = 0;/u);
  });

  it("persists the archive on abort so a reload does not lose what the client already knew", () => {
    assert.match(abortedBranch, /saveChat\(storageKey, \{/u);
  });

  it("only runs the archive/reset fold when there is something live to save", () => {
    assert.match(abortedBranch, /if \(stillLive\.length > 0\) \{/u);
  });

  it("still flushes the queue on every exit from the abort branch (GH #170 behavior preserved)", () => {
    const flushCount =
      abortedBranch.match(/flushQueuedMessages\(\)/gu)?.length ?? 0;
    assert.equal(flushCount, 1);
  });
});
