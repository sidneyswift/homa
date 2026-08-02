import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  nextReplyCutoffRecoveryState,
  type ReplyCutoffRecoveryEvent,
  type ReplyCutoffRecoveryState,
} from "./reply-cutoff-recovery";

describe("reply cutoff recovery state", () => {
  it("surfaces a detected cutoff while durable replay runs", () => {
    assert.equal(
      nextReplyCutoffRecoveryState("idle", "detected"),
      "recovering",
    );
  });

  it("offers another read-only replay after failure or timeout", () => {
    for (const event of ["failed", "aborted"] as const) {
      assert.equal(
        nextReplyCutoffRecoveryState("recovering", event),
        "available",
      );
    }
    assert.equal(
      nextReplyCutoffRecoveryState("available", "retry"),
      "recovering",
    );
  });

  it("clears only after recovery succeeds or a newer turn supersedes it", () => {
    for (const event of ["recovered", "superseded"] as const) {
      assert.equal(
        nextReplyCutoffRecoveryState("available", event),
        "idle",
      );
    }
  });

  it("does not invent a cutoff when ordinary recovery fails", () => {
    const terminalEvents: ReplyCutoffRecoveryEvent[] = ["failed", "aborted"];
    for (const event of terminalEvents) {
      assert.equal(nextReplyCutoffRecoveryState("idle", event), "idle");
    }
  });

  it("keeps every state and event exhaustive", () => {
    const states: ReplyCutoffRecoveryState[] = [
      "idle",
      "recovering",
      "available",
    ];
    const events: ReplyCutoffRecoveryEvent[] = [
      "detected",
      "retry",
      "recovered",
      "failed",
      "aborted",
      "superseded",
    ];
    for (const state of states) {
      for (const event of events) {
        assert.doesNotThrow(() => nextReplyCutoffRecoveryState(state, event));
      }
    }
  });
});

describe("reply cutoff recovery wiring", () => {
  const source = readFileSync(
    new URL("./chat-client.tsx", import.meta.url),
    "utf8",
  );

  it("captures the interrupted turn before either automatic stop", () => {
    const automaticStops = source.match(
      /captureReplyCutoffTarget\(\);\s*autoStoppedRef\.current = true;\s*agentStop\(\);/gu,
    );
    assert.equal(automaticStops?.length, 2);
  });

  it("retries the captured target through durable replay", () => {
    assert.match(
      source,
      /const target = replyCutoffTargetRef\.current \?\? currentRecoveryTarget\(\);[\s\S]*?recoverTurn\(target, controller\.signal\)/u,
    );
    assert.match(
      source,
      /function continueCutoffRecovery\(\): void \{[\s\S]*?startLostTurnRecovery\(\);/u,
    );
  });

  it("recovers before flushing a follow-up queued during the cutoff", () => {
    assert.match(
      source,
      /if \(!snapshot\.error && !autoStopped\) flushQueuedMessages\(\);/u,
    );
  });

  it("shows an explicit status and retry action instead of a silent ending", () => {
    assert.match(source, /Homa got cut off\. Reconnecting/u);
    assert.match(source, /Homa got cut off\. Your conversation is safe\./u);
    assert.match(source, /onClick=\{continueCutoffRecovery\}/u);
    assert.match(source, />\s*Reconnect and continue\s*</u);
  });
});
