import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  delegatedSessionLineage,
  isParentedEveSession,
} from "./session-lineage";

const parent = {
  callId: "call-1",
  rootSessionId: "root-session",
  sessionId: "parent-session",
  turn: { id: "turn-1", sequence: 0 },
};

describe("delegated Eve session lineage", () => {
  it("treats only a real parent descriptor as delegated", () => {
    assert.equal(isParentedEveSession(undefined), false);
    assert.equal(isParentedEveSession(parent), true);
  });

  it("emits hashes and never raw session identifiers", () => {
    const result = delegatedSessionLineage({
      childSessionId: "child-session",
      parent,
    });

    assert.match(result.childSessionHash, /^[a-f0-9]{64}$/u);
    assert.match(result.parentSessionHash, /^[a-f0-9]{64}$/u);
    assert.match(result.rootSessionHash, /^[a-f0-9]{64}$/u);
    assert.doesNotMatch(
      JSON.stringify(result),
      /child-session|parent-session|root-session/u,
    );
  });
});
