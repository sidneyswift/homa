import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  idleSuggestions,
  MAX_SUGGESTION_CHIPS,
  suggestionChipsVisible,
} from "./suggestion-chips-model";

const quiet = {
  retired: false,
  turnActive: false,
  composerEmpty: true,
  overlayOpen: false,
  assistantHasReplied: false,
};

describe("suggestionChipsVisible", () => {
  it("shows the chips on a genuinely quiet surface", () => {
    assert.equal(suggestionChipsVisible(quiet), true);
  });

  it("hides while a turn is running", () => {
    assert.equal(suggestionChipsVisible({ ...quiet, turnActive: true }), false);
  });

  it("hides while she is typing", () => {
    assert.equal(
      suggestionChipsVisible({ ...quiet, composerEmpty: false }),
      false,
    );
  });

  it("hides under any overlay, receipt included", () => {
    assert.equal(suggestionChipsVisible({ ...quiet, overlayOpen: true }), false);
  });

  it("hides once Homa has already replied this visit", () => {
    assert.equal(
      suggestionChipsVisible({ ...quiet, assistantHasReplied: true }),
      false,
    );
  });

  it("stays retired after a turn even when quiet returns", () => {
    assert.equal(suggestionChipsVisible({ ...quiet, retired: true }), false);
  });
});

describe("idleSuggestions", () => {
  it("caps the whisper at three chips, in the shared order", () => {
    const all = ["one", "two", "three", "four"];
    assert.deepEqual(idleSuggestions(all), ["one", "two", "three"]);
  });

  it("offers a short list whole", () => {
    assert.deepEqual(idleSuggestions(["only"]), ["only"]);
    assert.ok(MAX_SUGGESTION_CHIPS >= 1);
  });
});
