import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatProgressDate,
  progressAnswerLabel,
  progressAssessmentCta,
  progressEmptyState,
  progressSourceLabel,
  progressSubjectHeadline,
  progressSubjectSummary,
  progressTopicStateLabel,
} from "./view-copy";

describe("live Progress copy", () => {
  it("labels every subject state", () => {
    assert.deepEqual(
      [
        "conflict",
        "updated_recently",
        "older",
      ].map((state) =>
        progressSubjectHeadline(
          state as Parameters<typeof progressSubjectHeadline>[0],
        )
      ),
      ["Please confirm", "Updated today", "Older information"],
    );
  });

  it("labels every topic state", () => {
    assert.deepEqual(
      [
        "observed_today",
        "older",
        "ask_next",
        "conflict",
      ].map((state) =>
        progressTopicStateLabel(
          state as Parameters<typeof progressTopicStateLabel>[0],
        )
      ),
      ["Shared today", "Shared earlier", "HOMA asks later", "Please confirm"],
    );
  });

  it("labels every saved answer", () => {
    assert.deepEqual(
      ["easily", "getting_there", "not_yet"].map((answer) =>
        progressAnswerLabel(
          answer as Parameters<typeof progressAnswerLabel>[0],
        )
      ),
      ["Easily", "Getting there", "Not yet"],
    );
  });

  it("labels every safe evidence source", () => {
    assert.deepEqual(
      [
        "journal",
        "conversation",
        "check_in",
        "checklist",
        "deep_dive",
        "correction",
        "report_correction",
        "report_probe",
        "recheck",
        "onboarding_walk",
        "legacy",
      ].map((source) =>
        progressSourceLabel(
          source as Parameters<typeof progressSourceLabel>[0],
        )
      ),
      [
        "Journal note",
        "Conversation",
        "Check-in",
        "Progress checklist",
        "Focused check-in",
        "Correction",
        "Report correction",
        "Report follow-up",
        "Follow-up check",
        "Onboarding",
        "Earlier progress answer",
      ],
    );
  });

  it("builds a reassuring empty state without counts or history links", () => {
    const copy = progressEmptyState("Maya");

    assert.deepEqual(copy, {
      heading: "This page is ready for Maya.",
      body:
        "You have not shared any specific skills for Maya yet. Journal notes, check-in answers, and corrections will appear here.",
    });
  });

  it("offers the first check-in when a child has no report yet", () => {
    const copy = progressAssessmentCta("Maya");

    assert.deepEqual(copy, {
      heading: "See where Maya is today.",
      body:
        "You have not done a check-in for Maya yet. A few quick questions about what Maya is doing build their first progress report. It takes about five minutes, and you can add to it any time.",
      cta: "Start Maya's check-in",
    });
  });

  it("formats observation dates in the family IANA time zone", () => {
    assert.equal(
      formatProgressDate(
        "2026-07-12T00:30:00.123456Z",
        "America/Los_Angeles",
      ),
      "Jul 11, 2026",
    );
    assert.equal(
      formatProgressDate(
        "2026-07-11T10:30:00.123456Z",
        "Pacific/Kiritimati",
      ),
      "Jul 12, 2026",
    );
  });

  it("rejects invalid timestamps and time zones", () => {
    assert.throws(() =>
      formatProgressDate(
        "2026-07-11",
        "America/Chicago",
      )
    );
    assert.throws(() =>
      formatProgressDate(
        "2026-07-11T17:30:00.000000Z",
        "Mars/Olympus_Mons",
      )
    );
  });

  it("summarizes the latest source with count and family-local date", () => {
    assert.equal(
      progressSubjectSummary(
        {
          subjectId: "math",
          displayName: "Math",
          evidenceCount: 3,
          latestObservedAt: "2026-07-12T00:30:00.000000Z",
          state: "older",
          summary: {
            kind: "evidence",
            observedAt: "2026-07-12T00:30:00.000000Z",
            source: {
              kind: "journal",
              adultDisplayName: "Elena",
              checkInId: null,
            },
          },
          domains: [],
        },
        "America/Los_Angeles",
      ),
      "3 answers · latest: Journal note · Jul 11, 2026",
    );
  });

  it("summarizes conflicts with both saved adult answers", () => {
    assert.equal(
      progressSubjectSummary(
        {
          subjectId: "math",
          displayName: "Math",
          evidenceCount: 2,
          latestObservedAt: "2026-07-12T00:30:00.000000Z",
          state: "conflict",
          summary: {
            kind: "conflict",
            observedAt: "2026-07-12T00:30:00.000000Z",
            adultDisplayNames: ["Elena", "Jordan"],
          },
          domains: [],
        },
        "America/Los_Angeles",
      ),
      "2 answers · Elena and Jordan shared different answers on Jul 11, 2026. Both are saved.",
    );
  });

  it("uses numbered adult fallbacks for legacy conflicts", () => {
    assert.equal(
      progressSubjectSummary(
        {
          subjectId: "math",
          displayName: "Math",
          evidenceCount: 2,
          latestObservedAt: "2026-07-12T00:30:00.000000Z",
          state: "conflict",
          summary: {
            kind: "conflict",
            observedAt: "2026-07-12T00:30:00.000000Z",
            adultDisplayNames: [null, null],
          },
          domains: [],
        },
        "America/Los_Angeles",
      ),
      "2 answers · Adult 1 and Adult 2 shared different answers on Jul 11, 2026. Both are saved.",
    );
  });
});
