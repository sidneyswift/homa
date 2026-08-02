import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("./chat-client.tsx", import.meta.url),
  "utf8",
);

describe("ChatClient recovered-session reattachment (GH #493)", () => {
  const recoveredBranch = source.slice(
    source.indexOf("if (recovered) {"),
    source.indexOf("} else {", source.indexOf("if (recovered) {")),
  );

  it("adopts and persists the recovered cursor before resetting projection", () => {
    const adoptAt = recoveredBranch.indexOf(
      "reattachableSession.adopt(recovered.session)",
    );
    const resetAt = recoveredBranch.indexOf("agentReset()");

    assert.ok(adoptAt >= 0);
    assert.ok(resetAt > adoptAt);
    assert.match(recoveredBranch, /session: recovered\.session/u);
    assert.match(
      recoveredBranch,
      /durableCursorRef\.current = recovered\.session\.streamIndex/u,
    );
  });
});
