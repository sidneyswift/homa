import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("./chat-client.tsx", import.meta.url),
  "utf8",
);

describe("ChatClient recovered-session reattachment (GH #493 / #702)", () => {
  const recoveredCloseout = source.slice(
    source.indexOf("const applyRecoveredTurn = useCallback"),
    source.indexOf("const startLostTurnRecovery = useCallback"),
  );

  it("adopts and persists the recovered cursor before resetting projection", () => {
    const adoptAt = recoveredCloseout.indexOf(
      "reattachableSession.adopt(recovered.session)",
    );
    const resetAt = recoveredCloseout.indexOf("agentReset()");

    assert.ok(adoptAt >= 0);
    assert.ok(resetAt > adoptAt);
    assert.match(recoveredCloseout, /session: recovered\.session/u);
    assert.match(
      recoveredCloseout,
      /durableCursorRef\.current = recovered\.session\.streamIndex/u,
    );
  });

  it("blocks every tab until the authenticated server binding resolves", () => {
    assert.match(source, /restoreServerBoundEveSession\(\{/u);
    assert.match(source, /withChatTurnLock\(storageKey,/u);
    assert.match(
      source,
      /recovering:\s+recovering \|\|\s+restoringBoundSession \|\|\s+bindingSyncFailure \|\|\s+authorizationParked/u,
    );
    assert.match(source, /await withChatTurnLock\(storageKey,/u);
    assert.match(
      source,
      /current: \{\s*sessionId: current\.sessionId,\s*continuationToken: current\.continuationToken,\s*latestSequence: localLatestSequence/u,
    );
  });

  it("reconciles a non-null local cursor before every new send", () => {
    const sendStart = source.indexOf("const sendAcrossTabs = useCallback");
    const sendEnd = source.indexOf(
      "useEffect(() => {\n    sendRef.current = sendAcrossTabs",
      sendStart,
    );
    const sendAcrossTabs = source.slice(sendStart, sendEnd);
    const reconcileAt = sendAcrossTabs.indexOf(
      "restoreServerBoundEveSession({",
    );
    const sendAt = sendAcrossTabs.indexOf("await agentSend(input)");

    assert.ok(reconcileAt >= 0);
    assert.ok(sendAt > reconcileAt);
    assert.match(
      sendAcrossTabs,
      /sessionId: current\.sessionId,[\s\S]*?latestSequence: localLatestSequence/u,
    );
    assert.match(sendAcrossTabs, /revealServerRestoredEvents/u);
    assert.doesNotMatch(sendAcrossTabs, /else if \(!current\.sessionId\)/u);
    assert.match(
      sendAcrossTabs,
      /restored\.kind === "fresh" && current\.sessionId[\s\S]*?adoptFreshEveSession\(\)/u,
    );
    assert.match(
      sendAcrossTabs,
      /restored\.kind === "replayed" \|\| restored\.kind === "parked"[\s\S]*?stageLocalForServerReconciliation: true,[\s\S]*?revealServerRestoredEvents/u,
    );
    assert.doesNotMatch(sendAcrossTabs, /reattachableSession\.adopt\(restored/u);
  });

  it("retains a blocked input and exposes retry for unavailable or parked reconciliation", () => {
    assert.match(
      source,
      /restored\.kind === "unavailable"[\s\S]*?pendingBoundSendRef\.current = input/u,
    );
    assert.match(
      source,
      /restored\.kind === "parked"[\s\S]*?pendingBoundSendRef\.current = input/u,
    );
    assert.match(source, /function retryBindingSync\(\): void/u);
    assert.match(source, /Not sent\./u);
    assert.match(
      source,
      /if \(restored\.kind !== "parked"\) setAuthorizationParked\(false\);/u,
    );
  });

  it("persists a daily rotation before an old saved session can be re-adopted", () => {
    assert.match(source, /const persistPreparedRotation = useCallback/u);
    assert.match(
      source,
      /persistPreparedRotation\(\);\s*let current = reattachableSession\.session\.state/u,
    );
    assert.match(
      source,
      /const next = appendRecoveredArchiveState\(\{/u,
    );
  });
});
