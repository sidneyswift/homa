import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { narrativeSettled, reportRevealCopy } from "./report-reveal-card";

describe("narrativeSettled", () => {
  // Founder, 2026-07-22: "it says its ready, but when you click it
  // starts the generation... it does not say its ready until it
  // actually is." This predicate is the whole fix: the reveal card
  // shows "ready" only once this is true.
  it("is not settled while the narrative is actively writing", () => {
    assert.equal(narrativeSettled("writing"), false);
  });

  it("is settled when there is nothing to wait for", () => {
    // "off": the narrative flag is disabled, so the report was never
    // going to grow words. "none": no attempt exists yet, which the
    // status route itself turns into a self-healing "writing" response
    // rather than ever handing back to a caller, but the predicate must
    // not block on it either way.
    assert.equal(narrativeSettled("off"), true);
    assert.equal(narrativeSettled("none"), true);
  });

  it("is settled on a finished attempt, successful or not", () => {
    // A failed write still means the wait is over: the report page
    // falls back to template sentences, it does not keep polling.
    assert.equal(narrativeSettled("ready"), true);
    assert.equal(narrativeSettled("failed"), true);
  });
});

describe("reportRevealCopy", () => {
  it("does not present a zero-evidence report as a complete progress report", () => {
    const copy = reportRevealCopy({
      childName: "Avery",
      mappedSubjects: 0,
      answered: 16,
      skipped: 0,
    });

    assert.equal(copy.coverage, "No subjects mapped yet");
    assert.match(copy.heading, /starting point is saved/i);
    assert.match(copy.summary, /enough subject evidence/i);
    assert.doesNotMatch(copy.summary, /Built from your 16 answers/i);
  });
});
