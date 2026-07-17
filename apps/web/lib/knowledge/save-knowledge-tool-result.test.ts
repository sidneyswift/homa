import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canSaveFleetKnowledge,
  saveKnowledgeToolResult,
} from "../../agent/tools/save_knowledge";

describe("save_knowledge tool result", () => {
  it("allows fleet research and rejects every family dispatch", () => {
    assert.equal(canSaveFleetKnowledge({ channel: "research" }), true);
    assert.equal(canSaveFleetKnowledge({ channel: "dispatch" }), false);
    assert.equal(canSaveFleetKnowledge({ channel: "web" }), false);
    assert.equal(canSaveFleetKnowledge({}), false);
  });

  it("returns the merged knowledge row id after a successful save", () => {
    assert.deepEqual(
      saveKnowledgeToolResult({
        merged: true,
        rowId: "knowledge-1",
        note: "Merged into the shared knowledge bank.",
      }),
      {
        saved: true,
        knowledgeId: "knowledge-1",
        note: "Merged into the shared knowledge bank.",
      },
    );
  });

  it("returns no knowledge id when the gate rejects the save", () => {
    assert.deepEqual(
      saveKnowledgeToolResult({
        merged: false,
        rowId: "should-not-leak",
        note: "Research row was rejected.",
      }),
      {
        saved: false,
        knowledgeId: null,
        note: "Research row was rejected.",
      },
    );
  });

  it("does not report success when a merged result has no row id", () => {
    assert.deepEqual(
      saveKnowledgeToolResult({
        merged: true,
        note: "Unexpected incomplete merge result.",
      }),
      {
        saved: false,
        knowledgeId: null,
        note: "Unexpected incomplete merge result.",
      },
    );
  });
});
