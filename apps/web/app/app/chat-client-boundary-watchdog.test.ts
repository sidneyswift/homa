import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./chat-client.tsx", import.meta.url),
  "utf8",
);

test("chat starts a read-only boundary witness before the hard stall abort", () => {
  assert.match(
    source,
    /const BOUNDARY_PROBE_STALL_MS = 30_000;/u,
  );
  assert.match(
    source,
    /const recoverTurn = useCallback\([\s\S]*?recoverLostTurn\(\{[\s\S]*?signal,[\s\S]*?const recoverLastTurn = useCallback\([\s\S]*?recoverTurn\(target, signal\)/u,
  );
  assert.match(
    source,
    /createTurnBoundaryWatchdog<RecoveredTurn>\(\{[\s\S]*?probe: recoverLastTurn,[\s\S]*?onRecovered: applyRecoveredTurn,[\s\S]*?\}\)/u,
  );
});

test("primary activity and finish cancel the boundary witness", () => {
  const eventStart = source.indexOf("onEvent(event) {");
  const finishStart = source.indexOf("onFinish(snapshot) {");
  const hookEnd = source.indexOf("  });", finishStart);
  assert.ok(eventStart >= 0 && finishStart > eventStart && hookEnd > finishStart);

  const eventBranch = source.slice(eventStart, finishStart);
  const finishBranch = source.slice(finishStart, hookEnd);
  assert.match(eventBranch, /boundaryWatchdogRef\.current\?\.noteActivity/u);
  assert.match(finishBranch, /boundaryWatchdogRef\.current\?\.finish\(\)/u);
});

test("the witness runs only while Eve reports an active turn", () => {
  assert.match(
    source,
    /if \(!busy\) return;[\s\S]*?watchdog\.begin\(currentTimeMs\(\)\);[\s\S]*?watchdog\.check\(currentTimeMs\(\)\);[\s\S]*?return \(\) => \{[\s\S]*?watchdog\.finish\(\);/u,
  );
});
