import type { MapScores } from "@homa/core";

import type { ChildProgressView } from "../../lib/child-progress/types";
import type { TrajectoryEra } from "../../lib/map/trajectory-eras";

/**
 * Shared Progress fixtures (test-only): one two-subject live view with a
 * conflict, plus the report row that feeds the chart and movement.
 */

export const PROGRESS_FIXTURE_SCORES: MapScores = {
  subjects: [
    {
      subjectId: "math",
      position: "ahead",
      monthsAhead: 8,
      frontierDeltaMonths: 8,
      beyondScale: false,
      highConfidence: true,
      observations: 4,
      strongestObservedStatement: "Counts five objects accurately",
      strongestObservedMonths: 48,
      frontierStatement: null,
      frontierItemId: null,
      frontierDomain: null,
      exposureBased: false,
    },
    {
      subjectId: "literacy",
      position: "on_track",
      monthsAhead: 0,
      frontierDeltaMonths: 0,
      beyondScale: false,
      highConfidence: false,
      observations: 1,
      strongestObservedStatement: "Reads a short early reader",
      strongestObservedMonths: 72,
      frontierStatement: null,
      frontierItemId: null,
      frontierDomain: null,
      exposureBased: false,
    },
  ],
  strengthOrder: ["math", "literacy"],
  mappedCount: 2,
  totalSubjects: 16,
  observationCount: 5,
};

const PRIOR_SCORES: MapScores = {
  ...PROGRESS_FIXTURE_SCORES,
  subjects: PROGRESS_FIXTURE_SCORES.subjects.map((score) =>
    score.subjectId === "math"
      ? { ...score, monthsAhead: 7, frontierDeltaMonths: 7 }
      : score,
  ),
};

export const PROGRESS_FIXTURE_REPORT = {
  scores: PROGRESS_FIXTURE_SCORES,
  generatedAt: "2026-07-11T16:00:00.000Z",
  history: [
    { scores: PRIOR_SCORES, generated_at: "2026-06-10T16:00:00.000Z" },
  ],
};

/** The report row's scorings as the server-side re-normalization hands
 * them to the chart: one shared basis, so no dotted stretches. */
export const PROGRESS_FIXTURE_ERAS: TrajectoryEra[] = [
  {
    generated_at: "2026-06-10T16:00:00.000Z",
    scores: PRIOR_SCORES,
    renormalized: false,
    basisKey: "fixture",
  },
  {
    generated_at: "2026-07-11T16:00:00.000Z",
    scores: PROGRESS_FIXTURE_SCORES,
    renormalized: false,
    basisKey: "fixture",
  },
];

export const PROGRESS_FIXTURE_TODAY_TOPIC = {
  itemId: "math.counts-to-5",
  statement: "Counts five objects accurately",
  detail: "Recorded in a check-in.",
  state: "observed_today" as const,
  answer: "easily" as const,
  source: {
    kind: "check_in" as const,
    adultDisplayName: "Elena",
    checkInId: "check-in-1",
  },
  observedAt: "2026-07-11T17:30:00.123456Z",
  quote: "PRIVATE JOURNAL QUOTE",
};

export const PROGRESS_FIXTURE_VIEW: ChildProgressView = {
  childId: "child-1",
  childName: "Maya",
  birthDate: "2019-07-01",
  timeZone: "America/Los_Angeles",
  projectedAt: "2026-07-11T18:00:00.000Z",
  scores: PROGRESS_FIXTURE_SCORES,
  subjects: [
    {
      subjectId: "math",
      displayName: "Math",
      evidenceCount: 4,
      latestObservedAt: "2026-07-12T00:30:00.123456Z",
      state: "conflict",
      summary: {
        kind: "conflict",
        observedAt: "2026-07-12T00:30:00.123456Z",
        adultDisplayNames: ["Elena", "Jordan"],
      },
      domains: [
        {
          domainId: "math.number-sense",
          displayName: "Number sense",
          topics: [
            PROGRESS_FIXTURE_TODAY_TOPIC,
            {
              itemId: "math.counts-past-20",
              statement: "Counts past twenty",
              detail: "Observed in a journal note.",
              state: "older",
              answer: "getting_there",
              source: {
                kind: "journal",
                adultDisplayName: "Elena",
                checkInId: null,
              },
              observedAt: "2026-06-02T15:00:00.000000Z",
            },
            {
              itemId: "math.compares-small-groups",
              statement: "Compares two small groups",
              detail: "An age-eligible skill Homa can ask about next.",
              state: "ask_next",
              answer: null,
              source: null,
              observedAt: null,
            },
            {
              itemId: "math.one-to-one",
              statement: "Matches one number to each object",
              detail:
                "Two adults shared different answers. Both are kept for confirmation.",
              state: "conflict",
              answer: null,
              source: null,
              observedAt: "2026-07-12T00:30:00.123456Z",
            },
          ],
        },
      ],
    },
    {
      subjectId: "literacy",
      displayName: "Literacy",
      evidenceCount: 1,
      latestObservedAt: "2026-07-12T00:30:00.123456Z",
      state: "older",
      summary: {
        kind: "evidence",
        observedAt: "2026-07-12T00:30:00.123456Z",
        source: {
          kind: "journal",
          adultDisplayName: "Elena",
          checkInId: null,
        },
      },
      domains: [
        {
          domainId: "literacy.reading",
          displayName: "Reading",
          topics: [
            {
              itemId: "literacy.emergent-reader",
              statement: "Reads a short early reader",
              detail: "Observed in a journal note.",
              state: "older",
              answer: "easily",
              source: {
                kind: "journal",
                adultDisplayName: "Elena",
                checkInId: null,
              },
              observedAt: "2026-07-12T00:30:00.123456Z",
            },
          ],
        },
      ],
    },
  ],
  conflicts: [
    {
      id: "conflict-1",
      childId: "child-1",
      familyId: "family-1",
      itemId: "math.one-to-one",
      adultAnswers: [
        {
          evidenceId: "evidence-1",
          adultDisplayName: "Elena",
          answer: "easily",
          observedAt: "2026-07-09T14:00:00.000000Z",
          source: {
            kind: "conversation",
            adultDisplayName: "Elena",
            checkInId: null,
          },
        },
        {
          evidenceId: "evidence-2",
          adultDisplayName: "Jordan",
          answer: "not_yet",
          observedAt: "2026-07-12T00:30:00.123456Z",
          source: {
            kind: "check_in",
            adultDisplayName: "Jordan",
            checkInId: "check-in-1",
          },
        },
      ],
      observedAt: "2026-07-12T00:30:00.123456Z",
      state: "open",
      resolvedAnswer: null,
      resolvedEvidenceId: null,
      resolvedAt: null,
    },
  ],
};

export const PROGRESS_FIXTURE_KIDS = [
  { id: "child-1", name: "Maya", avatarUrl: null },
  { id: "child-2", name: "Leo", avatarUrl: null },
];
