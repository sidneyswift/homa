import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  OpenProgressConflictView,
  ProgressSubjectView,
} from "../../lib/child-progress";
import {
  progressAssessmentCta,
  progressConflictAnswerLine,
  progressSubjectHeadline,
  progressSubjectSummary,
  progressTopicStateLabel,
} from "./view-copy";

const observedAt = "2026-08-01T16:30:00.000Z";

function subject(
  overrides: Partial<ProgressSubjectView> = {},
): ProgressSubjectView {
  return {
    subjectId: "math",
    displayName: "Math",
    evidenceCount: 3,
    latestObservedAt: observedAt,
    state: "older",
    summary: {
      kind: "evidence",
      observedAt,
      source: {
        kind: "lesson_listen",
        adultDisplayName: "Elena",
        checkInId: null,
      },
    },
    domains: [],
    ...overrides,
  };
}

describe("native Progress collapsed summary", () => {
  it("leads with the latest source and family-local date", () => {
    assert.equal(
      progressSubjectSummary(subject(), "America/New_York"),
      "Latest evidence: Lesson recording · Aug 1, 2026",
    );
  });

  it("shows both sources and keeps both adults' conflicting answers", () => {
    const conflictSubject = subject({
      evidenceCount: 2,
      state: "conflict",
      summary: {
        kind: "conflict",
        observedAt,
        adultDisplayNames: ["Elena", "Jordan"],
      },
      domains: [
        {
          domainId: "math.number",
          displayName: "Numbers",
          topics: [
            {
              itemId: "math.counts-to-20",
              statement: "Counts to 20",
              detail: "",
              state: "conflict",
              answer: null,
              source: null,
              observedAt,
            },
          ],
        },
      ],
    });
    const conflicts: OpenProgressConflictView[] = [
      {
        id: "conflict-1",
        childId: "child-1",
        familyId: "family-1",
        itemId: "math.counts-to-20",
        adultAnswers: [
          {
            evidenceId: "evidence-1",
            adultDisplayName: "Elena",
            answer: "easily",
            observedAt,
            source: {
              kind: "journal",
              adultDisplayName: "Elena",
              checkInId: null,
            },
          },
          {
            evidenceId: "evidence-2",
            adultDisplayName: "Jordan",
            answer: "getting_there",
            observedAt,
            source: {
              kind: "conversation",
              adultDisplayName: "Jordan",
              checkInId: null,
            },
          },
        ],
        observedAt,
        state: "open",
        resolvedAnswer: null,
        resolvedEvidenceId: null,
        resolvedAt: null,
      },
    ];

    assert.equal(
      progressSubjectSummary(conflictSubject, "America/New_York", conflicts),
      "Latest evidence: Journal note and conversation · Aug 1, 2026. Elena and Jordan shared different answers, so Homa saved both.",
    );
    assert.equal(
      progressConflictAnswerLine(conflicts[0].adultAnswers[0], "America/New_York"),
      "Answer from Elena: Easily · Aug 1, 2026.",
    );
  });

  it("names future questions and the empty state without promising unavailable actions", () => {
    assert.equal(progressSubjectHeadline("conflict"), "Different answers");
    assert.equal(progressTopicStateLabel("ask_next"), "Homa will ask");
    assert.equal(progressTopicStateLabel("conflict"), "Different answers");
    assert.deepEqual(progressAssessmentCta("Maya"), {
      heading: "See where Maya is today.",
      body:
        "Tell Homa about a lesson, a worksheet, or something Maya tried. " +
        "Homa will use what you share to start this progress page.",
    });
  });
});
