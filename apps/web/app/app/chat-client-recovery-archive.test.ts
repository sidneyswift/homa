import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { EveMessage } from "eve/client";

import {
  appendRecoveredArchiveState,
  localMessagesForServerReconciliation,
  messagesMissingFromDurableHistory,
  type ArchivedMessage,
} from "./chat-storage";

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
    assert.match(
      abortedBranch,
      /archiveMessages\(stillLive, stamped, liveSessionId\)/u,
    );
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

  it("keeps a later recovered turn visible after stale-cursor reconciliation", () => {
    const archived = (id: string): ArchivedMessage => ({
      at: 0,
      message: { id, role: "user", parts: [] } as EveMessage,
      sessionId: "current-session",
    });
    const next = appendRecoveredArchiveState({
      persisted: [archived("local-before-replay")],
      replayed: [archived("missed-server-turn")],
      additions: [archived("later-recovered-turn")],
      persistedArchiveHidden: true,
    });

    assert.deepEqual(
      next.persisted.map((entry) => entry.message.id),
      ["local-before-replay", "later-recovered-turn"],
    );
    assert.deepEqual(
      next.replayed.map((entry) => entry.message.id),
      ["missed-server-turn", "later-recovered-turn"],
    );
  });

  it("wires both confirmed and timed-out recovery through the visible archive helper", () => {
    const appendCount = source.match(/appendRecoveredArchive\(/gu)?.length ?? 0;
    assert.ok(appendCount >= 2);
  });

  it("keeps local turns newer than a mount-time server history snapshot", () => {
    const restored = Array.from({ length: 61 }, (_, index) => ({
      id: `turn-${index + 1}:user`,
      role: "user" as const,
      parts: [],
    })) as EveMessage[];
    const durableAtMount = new Set(
      Array.from({ length: 50 }, (_, index) => `turn-${index + 1}:user`),
    );

    assert.deepEqual(
      messagesMissingFromDurableHistory(restored, durableAtMount).map(
        (message) => message.id,
      ),
      Array.from({ length: 11 }, (_, index) => `turn-${index + 51}:user`),
    );
    assert.match(
      source,
      /messagesMissingFromDurableHistory\(\s*foldEventsToMessages\(events\),\s*durableMessageIds/u,
    );
    assert.match(
      source,
      /localMessagesForServerReconciliation\(\s*saved\.events \?\? \[\],\s*savedSessionId,\s*durableMessageIds/u,
    );
  });

  it("drops a sessionless partial once an authoritative replay succeeds", () => {
    const events = [
      {
        type: "message.received",
        meta: { at: "2026-09-13T00:00:00.000Z", ...{ id: "fixture-received-event" } },
        data: {
          message: "A partial local turn",
          sequence: 1,
          turnId: "turn-1",
        },
      },
    ] as Parameters<typeof localMessagesForServerReconciliation>[0];

    assert.deepEqual(
      localMessagesForServerReconciliation(events, undefined, new Set()),
      [],
    );
    assert.deepEqual(
      localMessagesForServerReconciliation(
        events,
        "known-session",
        new Set(),
      ).map((message) => message.id),
      ["turn-1:user"],
    );
  });

  it("keeps a displaced session's snapshot-new turns beside the authoritative replay", () => {
    const message = (id: string) => ({
      id,
      role: "user" as const,
      parts: [],
    }) as EveMessage;
    const local = [message("turn-1:user"), message("turn-2:user")];
    const localMissing = messagesMissingFromDurableHistory(
      local,
      new Set(["turn-1:user"]),
    ).map((entry) => ({
      at: 2,
      message: entry,
      sessionId: "local-session",
    }));
    const staged = appendRecoveredArchiveState({
      persisted: [],
      replayed: [],
      additions: localMissing,
      persistedArchiveHidden: true,
    });
    const reconciled = appendRecoveredArchiveState({
      persisted: staged.persisted,
      replayed: staged.replayed,
      additions: [
        {
          at: 3,
          message: message("turn-1:user"),
          sessionId: "authoritative-session",
        },
      ],
      persistedArchiveHidden: true,
    });

    assert.deepEqual(
      reconciled.replayed.map(
        (entry) => `${entry.sessionId}:${entry.message.id}`,
      ),
      [
        "local-session:turn-2:user",
        "authoritative-session:turn-1:user",
      ],
    );
  });

  it("does not archive a rotated session twice when the saved events are folded again", () => {
    const message = {
      id: "rotated-turn:user",
      role: "user" as const,
      parts: [],
    } as EveMessage;
    const next = appendRecoveredArchiveState({
      persisted: [{ at: 1, message, sessionId: "rotated-session" }],
      replayed: [],
      additions: [{ at: 1, message, sessionId: "rotated-session" }],
      persistedArchiveHidden: false,
    });

    assert.equal(next.persisted.length, 1);
  });

  it("keeps equal Eve message ids from different sessions", () => {
    const message = {
      id: "turn-1:user",
      role: "user" as const,
      parts: [],
    } as EveMessage;
    const next = appendRecoveredArchiveState({
      persisted: [{ at: 1, message, sessionId: "yesterday" }],
      replayed: [],
      additions: [{ at: 2, message, sessionId: "today" }],
      persistedArchiveHidden: false,
    });

    assert.equal(next.persisted.length, 2);
    assert.equal(next.replayed.length, 0);
  });
});
