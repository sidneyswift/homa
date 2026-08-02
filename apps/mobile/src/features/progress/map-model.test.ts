import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ChildProgressView, ProgressSubjectView } from "../../lib/child-progress";
import { progressUpdatedLine, subjectFreshness } from "./map-model";

const subject: ProgressSubjectView = {
  subjectId: "math",
  displayName: "Math",
  evidenceCount: 1,
  latestObservedAt: "2026-08-01T16:30:00.000Z",
  state: "updated_recently",
  summary: null,
  domains: [],
};

function view(subjects: ProgressSubjectView[]): ChildProgressView {
  return {
    childId: "child-1",
    childName: "Maya",
    birthDate: "2020-01-02",
    timeZone: "America/New_York",
    projectedAt: "2026-08-01T16:31:00.000Z",
    scores: {
      subjects: [],
      strengthOrder: [],
      mappedCount: 0,
      totalSubjects: 0,
      observationCount: 0,
    },
    subjects,
    conflicts: [],
  };
}

describe("native Progress dates", () => {
  it("never trusts a projection-time today state after the date has passed", () => {
    const result = subjectFreshness(
      subject,
      "America/New_York",
      new Date("2026-09-05T16:30:00.000Z"),
    );
    assert.equal(result?.kind, "quiet");
    assert.equal(result?.label, "Latest answer shared Aug 1, 2026");
  });

  it("uses the newest evidence date instead of formatting the current clock", () => {
    const reading: ProgressSubjectView = {
      ...subject,
      subjectId: "reading_writing",
      displayName: "Reading and writing",
      latestObservedAt: "2026-07-28T12:00:00.000Z",
    };
    assert.deepEqual(
      progressUpdatedLine(
        view([reading, subject]),
        new Date("2026-09-05T16:30:00.000Z"),
      ),
      { label: "Latest answer shared Aug 1, 2026", today: false },
    );
  });

  it("compares today in the family's calendar zone", () => {
    assert.equal(
      subjectFreshness(
        { ...subject, latestObservedAt: "2026-08-02T03:30:00.000Z" },
        "America/Los_Angeles",
        new Date("2026-08-02T06:00:00.000Z"),
      )?.kind,
      "today",
    );
  });

  it("keeps yesterday recent instead of turning midnight into a warning", () => {
    assert.equal(
      subjectFreshness(
        { ...subject, latestObservedAt: "2026-08-01T16:30:00.000Z" },
        "America/New_York",
        new Date("2026-08-02T16:30:00.000Z"),
      )?.kind,
      "recent",
    );
  });

  it("marks evidence quiet only after the 30-day threshold", () => {
    assert.equal(
      subjectFreshness(
        { ...subject, latestObservedAt: "2026-07-01T16:30:00.000Z" },
        "America/New_York",
        new Date("2026-08-02T16:30:00.000Z"),
      )?.kind,
      "quiet",
    );
  });
});
