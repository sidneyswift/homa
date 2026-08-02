import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  OpenProgressConflictView,
  ProgressSubjectView,
} from "../../lib/child-progress";
import {
  progressAssessmentCta,
  progressAssessmentDraft,
  progressConflictAnswerLine,
  progressSubjectHeadline,
  progressSubjectSummary,
  progressSubjectTakeaway,
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
      progressSubjectSummary(subject(), "America/New_York")?.accessibilityLabel,
      "Lesson recording · Aug 1, 2026",
    );
    assert.deepEqual(
      progressSubjectSummary(subject(), "America/New_York"),
      {
        sourceLabel: "Lesson recording",
        dateLabel: "Aug 1, 2026",
        note: null,
        accessibilityLabel: "Lesson recording · Aug 1, 2026",
      },
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
      progressSubjectSummary(conflictSubject, "America/New_York", conflicts)
        ?.accessibilityLabel,
      "Journal note and conversation · Aug 1, 2026. Homa kept both answers.",
    );
    assert.equal(
      progressConflictAnswerLine(conflicts[0].adultAnswers[0], "America/New_York"),
      "Elena: Easily · Journal note · Aug 1, 2026.",
    );
  });

  it("names future questions and the empty state without promising unavailable actions", () => {
    assert.equal(progressSubjectHeadline("conflict"), "Two answers saved");
    assert.equal(progressTopicStateLabel("ask_next"), "Not shared yet");
    assert.equal(progressTopicStateLabel("conflict"), "Two answers saved");
    assert.deepEqual(progressAssessmentCta("Maya"), {
      heading: "Start Maya’s progress",
      body:
        "Tell Homa about a lesson, a worksheet, or something Maya tried. " +
        "One sentence is enough to begin.",
    });
    assert.equal(
      progressAssessmentDraft("Maya"),
      "I want to tell you something Maya tried: ",
    );
  });

  it("puts one concrete skill and answer on the collapsed card", () => {
    assert.deepEqual(
      progressSubjectTakeaway(
        subject({
          domains: [
            {
              domainId: "math.number",
              displayName: "Numbers",
              topics: [
                {
                  itemId: "math.counts-to-20",
                  statement: "Counts to 20 without help",
                  detail: "Shared by Elena.",
                  state: "older",
                  answer: "easily",
                  source: {
                    kind: "lesson_listen",
                    adultDisplayName: "Elena",
                    checkInId: null,
                  },
                  observedAt,
                },
              ],
            },
          ],
        }),
      ),
      { statement: "Counts to 20 without help", stateLabel: "Easily" },
    );
  });

  it("keeps a conflict headline and its conflict summary on the same skill", () => {
    const sameTime = "2026-08-01T12:00:00.000Z";
    const conflicts: OpenProgressConflictView[] = [
      {
        id: "conflict-z",
        childId: "child-1",
        familyId: "family-1",
        itemId: "reading.skill-a",
        adultAnswers: [
          {
            evidenceId: "evidence-a1",
            adultDisplayName: "Elena",
            answer: "easily",
            observedAt: sameTime,
            source: {
              kind: "journal",
              adultDisplayName: "Elena",
              checkInId: null,
            },
          },
          {
            evidenceId: "evidence-a2",
            adultDisplayName: "Jordan",
            answer: "getting_there",
            observedAt: sameTime,
            source: {
              kind: "journal",
              adultDisplayName: "Jordan",
              checkInId: null,
            },
          },
        ],
        observedAt: sameTime,
        state: "open",
        resolvedAnswer: null,
        resolvedEvidenceId: null,
        resolvedAt: null,
      },
      {
        id: "conflict-a",
        childId: "child-1",
        familyId: "family-1",
        itemId: "reading.skill-b",
        adultAnswers: [
          {
            evidenceId: "evidence-b1",
            adultDisplayName: "Elena",
            answer: "not_yet",
            observedAt: sameTime,
            source: {
              kind: "conversation",
              adultDisplayName: "Elena",
              checkInId: null,
            },
          },
          {
            evidenceId: "evidence-b2",
            adultDisplayName: "Jordan",
            answer: "getting_there",
            observedAt: sameTime,
            source: {
              kind: "check_in",
              adultDisplayName: "Jordan",
              checkInId: "check-in-1",
            },
          },
        ],
        observedAt: sameTime,
        state: "open",
        resolvedAnswer: null,
        resolvedEvidenceId: null,
        resolvedAt: null,
      },
    ];
    const conflictSubject = subject({
      state: "conflict",
      summary: {
        kind: "conflict",
        observedAt: sameTime,
        adultDisplayNames: ["Elena", "Jordan"],
      },
      domains: [
        {
          domainId: "reading.comprehension",
          displayName: "Comprehension",
          topics: [
            {
              itemId: "reading.skill-a",
              statement: "Skill A",
              detail: "Two adults shared different answers.",
              state: "conflict",
              answer: null,
              source: null,
              observedAt: sameTime,
            },
            {
              itemId: "reading.skill-b",
              statement: "Skill B",
              detail: "Two adults shared different answers.",
              state: "conflict",
              answer: null,
              source: null,
              observedAt: sameTime,
            },
            {
              itemId: "reading.skill-c",
              statement: "Newer ordinary evidence",
              detail: "Shared by Elena.",
              state: "observed_today",
              answer: "easily",
              source: {
                kind: "conversation",
                adultDisplayName: "Elena",
                checkInId: null,
              },
              observedAt: "2026-08-02T12:00:00.000Z",
            },
          ],
        },
      ],
    });
    assert.deepEqual(
      progressSubjectTakeaway(conflictSubject, conflicts),
      {
        statement: "Skill B",
        stateLabel: "Two answers saved",
      },
    );
    assert.deepEqual(
      progressSubjectSummary(
        conflictSubject,
        "America/New_York",
        conflicts,
      ),
      {
        sourceLabel: "Conversation and check-in",
        dateLabel: "Aug 1, 2026",
        note: "Homa kept both answers.",
        accessibilityLabel:
          "Conversation and check-in · Aug 1, 2026. Homa kept both answers.",
      },
    );
  });

  it("preserves sub-millisecond ordering when selecting ordinary evidence", () => {
    assert.deepEqual(
      progressSubjectTakeaway(
        subject({
          domains: [
            {
              domainId: "math.number",
              displayName: "Numbers",
              topics: [
                {
                  itemId: "math.a-older",
                  statement: "Older within the millisecond",
                  detail: "Shared by Elena.",
                  state: "older",
                  answer: "getting_there",
                  source: {
                    kind: "journal",
                    adultDisplayName: "Elena",
                    checkInId: null,
                  },
                  observedAt: "2026-08-01T12:00:00.000001Z",
                },
                {
                  itemId: "math.z-newer",
                  statement: "Newer within the millisecond",
                  detail: "Shared by Elena.",
                  state: "older",
                  answer: "easily",
                  source: {
                    kind: "conversation",
                    adultDisplayName: "Elena",
                    checkInId: null,
                  },
                  observedAt: "2026-08-01T12:00:00.000002Z",
                },
              ],
            },
          ],
        }),
      ),
      {
        statement: "Newer within the millisecond",
        stateLabel: "Easily",
      },
    );
  });
});
