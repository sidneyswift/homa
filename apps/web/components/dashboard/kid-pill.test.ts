import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MapScores } from "@homa/core";

import type { DashboardReport } from "../../lib/dashboard";
import { kidPill } from "./kid-pill";

/**
 * The chip's one job is to say where a child is in getting started.
 *
 * The load-bearing tests are the two that assert null. The chip sits
 * directly above the sibling switcher, so any whole-child label here is
 * a comparison a mother can perform in one tap, and these tests are
 * what stop a future "at a glance, how is she doing?" ask from putting
 * one back without a founder ruling.
 */

type SubjectScore = MapScores["subjects"][number];

/** A whole SubjectScore, built rather than cast: the pill filters on
 *  exposureBased and position, so a partial fixture behind an `as`
 *  would hide a real shape change instead of failing here. */
function score(position: SubjectScore["position"]): SubjectScore {
  return {
    subjectId: "math",
    position,
    monthsAhead: null,
    frontierDeltaMonths: null,
    beyondScale: false,
    highConfidence: false,
    observations: 2,
    strongestObservedStatement: null,
    strongestObservedMonths: null,
    frontierStatement: null,
    frontierItemId: null,
    frontierDomain: null,
    exposureBased: false,
  };
}

function report(positions: SubjectScore["position"][]): DashboardReport {
  const subjects = positions.map(score);
  return {
    childId: "child-1",
    token: null,
    generatedAt: "2026-07-22T12:00:00.000Z",
    history: [],
    scores: {
      subjects,
      strengthOrder: subjects.map((subject) => subject.subjectId),
      mappedCount: subjects.length,
      totalSubjects: subjects.length,
      observationCount: subjects.length * 2,
    },
  };
}

describe("kidPill", () => {
  it("offers the checklist to a child old enough and not yet scored", () => {
    assert.equal(kidPill(null, 60)?.label, "Checklist ready");
  });

  it("says when the map has not opened yet", () => {
    assert.equal(kidPill(null, 18)?.label, "Opens at age 2");
  });

  it("names a report with nothing scored as just getting started", () => {
    assert.equal(kidPill(report([]), 60)?.label, "Just getting started");
  });

  it("says nothing at all once a child is genuinely under way", () => {
    // The subjects below the header carry the real answer, per subject,
    // in the report's own sentences. The header does not rank the child.
    assert.equal(kidPill(report(["ahead", "ahead", "on_track"]), 60), null);
    assert.equal(kidPill(report(["growing", "growing"]), 60), null);
    assert.equal(kidPill(report(["on_track"]), 60), null);
  });

  it("never labels one child in a way a sibling's page could answer", () => {
    // Every scored shape, including the ones that used to draw gold.
    const shapes: SubjectScore["position"][][] = [
      ["ahead"],
      ["ahead", "growing"],
      ["growing", "growing", "ahead"],
      ["on_track", "on_track"],
      ["ahead", "on_track", "growing", "ahead"],
    ];
    for (const shape of shapes) {
      const pill = kidPill(report(shape), 72);
      assert.equal(pill, null, `ranked chip returned for ${shape.join(", ")}`);
    }
  });

  it("keeps the getting-started chips free of any standing word", () => {
    const labels = [
      kidPill(null, 18)?.label,
      kidPill(null, 60)?.label,
      kidPill(report([]), 60)?.label,
    ].filter((label): label is string => typeof label === "string");
    assert.equal(labels.length, 3);
    for (const label of labels) {
      assert.ok(
        !/ahead|behind|on track|growing/i.test(label),
        `standing word in: ${label}`,
      );
      assert.ok(!label.includes("—"), "no em dash");
    }
  });
});
