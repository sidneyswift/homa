import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("./chat-client.tsx", import.meta.url),
  "utf8",
);

describe("ChatClient recovered-session reattachment (GH #493)", () => {
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

  it("blocks a cursorless tab until the authenticated server binding resolves", () => {
    assert.match(source, /restoreServerBoundEveSession\(\{/u);
    assert.match(source, /withChatTurnLock\(storageKey,/u);
    assert.match(
      source,
      /recovering: recovering \|\| restoringBoundSession/u,
    );
    assert.match(
      source,
      /reattachableSession\.adopt\(restored\.session\)/u,
    );
    assert.match(
      source,
      /durableCursorRef\.current = restored\.session\.streamIndex/u,
    );
  });
});
