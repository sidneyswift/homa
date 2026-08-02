import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeComposerDraft, parseComposerDraftRequest } from "./composer-draft";

describe("Progress Chat draft handoff", () => {
  it("parses one bounded reviewable draft request", () => {
    assert.deepEqual(
      parseComposerDraftRequest("child-1:1", "Here's what Maya tried: "),
      {
        id: "child-1:1",
        text: "Here's what Maya tried: ",
      },
    );
    assert.equal(parseComposerDraftRequest("", "Draft"), null);
    assert.equal(parseComposerDraftRequest("request", " "), null);
    assert.equal(parseComposerDraftRequest("request", "x".repeat(501)), null);
  });

  it("preserves an existing unsent message when adding the Progress draft", () => {
    assert.equal(
      mergeComposerDraft("Remember the library books", "Here's what Maya tried: "),
      "Remember the library books\n\nHere's what Maya tried: ",
    );
    assert.equal(
      mergeComposerDraft("", "Here's what Maya tried: "),
      "Here's what Maya tried: ",
    );
  });
});
