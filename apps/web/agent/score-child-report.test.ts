import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { reportHandoffNote } from "./tools/score_child_report";

describe("reportHandoffNote", () => {
  it("keeps a zero-evidence report candid even after every question was answered", () => {
    const note = reportHandoffNote({ mappedSubjects: 0, growingEdgeCount: 0 });

    assert.match(note, /no subject evidence yet/i);
    assert.match(note, /not enough to label a strength or next step/i);
    assert.match(note, /Do not call this a full read/i);
    assert.match(note, /Do not say nothing is a guess/i);
  });

  it("keeps the ordinary no-growing-edge handoff for a report with evidence", () => {
    const note = reportHandoffNote({ mappedSubjects: 4, growingEdgeCount: 0 });

    assert.match(note, /She answered "not yet" to nothing/i);
    assert.doesNotMatch(note, /no subject evidence yet/i);
  });
});
