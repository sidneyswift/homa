import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import type { ChildProgressView } from "../../lib/child-progress/types";
import { ProgressView } from "./progress-view";

const ROUTER = {
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch: async () => {},
};
const todayTopic = {
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

const progressView: ChildProgressView = {
  childId: "child-1",
  childName: "Maya",
  birthDate: "2019-07-01",
  timeZone: "America/Los_Angeles",
  projectedAt: "2026-07-11T18:00:00.000Z",
  scores: {
    subjects: [],
    strengthOrder: [],
    mappedCount: 0,
    totalSubjects: 0,
    observationCount: 0,
  },
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
            todayTopic,
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
                "Two adults shared different observations. Both answers are kept for confirmation.",
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

describe("ProgressView", () => {
  it("renders the accessible subject, domain, and topic hierarchy", () => {
    const viewWithInternalData = {
      ...progressView,
      history: [{ label: "PRIVATE HISTORY" }],
      snapshots: [{ label: "PRIVATE SNAPSHOT" }],
    };
    const html = renderToStaticMarkup(
      <ProgressView
        view={viewWithInternalData}
        reportHref="/onboarding/r/tok-abc123"
      />,
    );

    assert.match(
      html,
      /<a[^>]*href="\/onboarding\/r\/tok-abc123"[^>]*>Open the full report<\/a>/,
    );

    assert.match(html, /Maya(?:&#x27;|')s progress/);
    assert.match(
      html,
      /These are the skills you have shared with HOMA\. Journal notes, check-in answers, and corrections update them here\./,
    );
    assert.match(html, /Latest information/);
    assert.match(
      html,
      /4 observations · Elena and Jordan shared different answers on Jul 11, 2026\. Both answers are saved\./,
    );
    assert.match(
      html,
      /1 observation · Journal note · Jul 11, 2026/,
    );
    assert.match(html, /Conversation · Jul 9, 2026/u);
    assert.match(html, /Check-in · Jul 11, 2026/u);
    assert.match(
      html,
      /<section aria-labelledby="progress-subject-math"/,
    );
    assert.match(
      html,
      /<h2 id="progress-subject-math"/,
    );
    assert.match(
      html,
      /<section aria-labelledby="progress-domain-math\.number-sense"/,
    );
    assert.ok(html.indexOf("Math") < html.indexOf("Number sense"));
    assert.ok(
      html.indexOf("Number sense") <
        html.indexOf("Counts five objects accurately"),
    );
    for (const label of [
      "Observed today",
      "Older",
      "Ask me later",
      "Please confirm",
    ]) {
      assert.match(html, new RegExp(label));
    }
    for (const detail of [
      "Recorded in a check-in.",
      "Jul 11, 2026",
      "Elena",
      "Jordan",
      "Easily",
      "Not yet",
      "Jul 9, 2026",
      "Jul 11, 2026",
    ]) {
      assert.match(html, new RegExp(detail));
    }
    assert.doesNotMatch(html, /PRIVATE JOURNAL QUOTE/);
    assert.doesNotMatch(html, /PRIVATE HISTORY/);
    assert.doesNotMatch(html, /PRIVATE SNAPSHOT/);
    assert.doesNotMatch(html, /historical report/i);
    assert.match(
      html,
      /background:var\(--info-soft\);color:var\(--pop-navy\)/,
    );
    assert.match(
      html,
      /max-w-\[var\(--container-md\)\]/,
    );
  });

  it("renders an honest empty state without fake zero metrics", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={ROUTER}>
        <ProgressView
          view={{ ...progressView, subjects: [], conflicts: [] }}
          reportHref={null}
        />
      </AppRouterContext.Provider>,
    );

    assert.match(html, /This page is ready for Maya\./);
    assert.match(
      html,
      /You have not shared any specific skills for Maya yet\./,
    );
    assert.match(html, /Ask HOMA about Maya/);
    assert.doesNotMatch(html, /Open the full report/);
    assert.doesNotMatch(html, /0 skills|0 observations|0%/i);
    assert.match(html, /min-h-11/);
    assert.match(html, /bg-\[var\(--brand-active\)\]/);
    assert.match(html, /text-on-brand/);
    assert.match(html, /hover:bg-\[var\(--clay-600\)\]/);
  });
});
