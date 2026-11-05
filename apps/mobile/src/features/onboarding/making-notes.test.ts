import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAKING_NOTES_SHOWN, withMakingNote } from "./making-notes";

describe("withMakingNote", () => {
  it("appends a new note as the live line", () => {
    assert.deepEqual(withMakingNote(["Reading the guide"], "Drawing"), [
      "Reading the guide",
      "Drawing",
    ]);
  });

  it("keeps the list unchanged when the live note repeats", () => {
    assert.deepEqual(withMakingNote(["A", "B"], "B"), ["A", "B"]);
  });

  it("moves a retried note to the end instead of showing it twice", () => {
    const notes = withMakingNote(["A", "B", "In line at the drawing table"], "A");
    assert.deepEqual(notes, ["B", "In line at the drawing table", "A"]);
    assert.equal(new Set(notes).size, notes.length);
  });

  it("keeps only the most recent notes", () => {
    let notes: string[] = [];
    for (const note of ["1", "2", "3", "4", "5", "6"]) notes = withMakingNote(notes, note);
    assert.equal(notes.length, MAKING_NOTES_SHOWN);
    assert.deepEqual(notes, ["3", "4", "5", "6"]);
  });
});
