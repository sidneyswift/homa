import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import {
  PROGRESS_FIXTURE_ERAS,
  PROGRESS_FIXTURE_KIDS,
  PROGRESS_FIXTURE_REPORT,
  PROGRESS_FIXTURE_VIEW,
} from "./progress-view.fixture";
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

describe("ProgressView", () => {
  it("renders the refined header, chart, and subject map", () => {
    const viewWithInternalData = {
      ...PROGRESS_FIXTURE_VIEW,
      history: [{ label: "PRIVATE HISTORY" }],
      snapshots: [{ label: "PRIVATE SNAPSHOT" }],
    };
    const html = renderToStaticMarkup(
      <ProgressView
        view={viewWithInternalData}
        reportHref="/onboarding/r/tok-abc123"
        report={PROGRESS_FIXTURE_REPORT}
        eras={PROGRESS_FIXTURE_ERAS}
        kids={PROGRESS_FIXTURE_KIDS}
      />,
    );

    // The bare header: freshness line and title, no intro sentence.
    // The line dates the visit (rendered with the real clock here), not
    // the newest evidence: no fixed date to assert, only the shape.
    assert.match(html, /Maya(?:&#x27;|')s progress/);
    assert.match(html, /As of [A-Z][a-z]{2} \d{1,2}, \d{4}/);
    assert.doesNotMatch(html, /Updated Jul 1[12], 2026/);
    assert.doesNotMatch(html, /skills you have shared/i);
    assert.doesNotMatch(html, /Latest information/i);
    assert.match(
      html,
      /<a[^>]*href="\/onboarding\/r\/tok-abc123"[^>]*>Open the full report<\/a>/,
    );

    // The in-page kid switcher: the sibling one tap away.
    assert.match(html, /aria-label="Switch kid"/);
    assert.match(html, /href="\/app\/child-2\/progress"/);
    assert.match(html, /Leo/);

    // ONE subject card (founder ask 2026-07-13): the snapshot chart
    // whose legend rows are the subject-by-subject list. No second
    // grid, no meaning box, no separate heading.
    assert.match(html, /Maya(?:&#x27;|')s snapshot/);
    assert.match(html, /<svg[^>]*subject pattern over time/);
    assert.match(html, /Math&#x27;s picture updated this week\./);
    assert.doesNotMatch(html, /Subject by subject/);

    // Legend rows are doors: they open the detail panel, strongest
    // first, with the conflict chip carried over from the retired tile grid.
    assert.match(
      html,
      /<button[^>]*aria-haspopup="dialog"[^>]*>/,
    );
    assert.doesNotMatch(html, /aria-pressed/);
    assert.ok(html.indexOf(">Math<") !== -1);
    assert.ok(html.indexOf(">Math<") < html.indexOf(">Literacy<"));
    assert.match(html, />A clear strength</);
    assert.match(html, />Solid footing</);
    assert.match(html, /Please confirm/);
    // The dated movement chip retired from this surface (2026-07-13).
    assert.doesNotMatch(html, /since Jun 10/);
    // The meaning box retired with the merge: a row opens the panel
    // instead of pinning a translation card above the legend.
    assert.doesNotMatch(html, /typical around age/);

    // The panel starts closed: topic detail stays out of first paint.
    assert.doesNotMatch(html, /Counts five objects accurately/);
    assert.doesNotMatch(html, /role="dialog"/);

    // Internal data never leaks.
    assert.doesNotMatch(html, /PRIVATE JOURNAL QUOTE/);
    assert.doesNotMatch(html, /PRIVATE HISTORY/);
    assert.doesNotMatch(html, /PRIVATE SNAPSHOT/);
    assert.match(html, /max-w-\[var\(--container-md\)\]/);
  });

  it("keeps the switcher out of single-kid families and the chart out of report-less ones", () => {
    const html = renderToStaticMarkup(
      <ProgressView
        view={PROGRESS_FIXTURE_VIEW}
        reportHref={null}
        report={null}
        eras={[]}
        kids={[{ id: "child-1", name: "Maya", avatarUrl: null }]}
      />,
    );

    assert.doesNotMatch(html, /aria-label="Switch kid"/);
    assert.doesNotMatch(html, /Open the full report/);
    assert.doesNotMatch(html, /Maya(?:&#x27;|')s snapshot/);
    assert.match(html, /Subject by subject/);
  });

  it("renders an honest empty state without fake zero metrics", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={ROUTER}>
        <ProgressView
          view={{ ...PROGRESS_FIXTURE_VIEW, subjects: [], conflicts: [] }}
          reportHref={null}
          report={PROGRESS_FIXTURE_REPORT}
          eras={PROGRESS_FIXTURE_ERAS}
          kids={PROGRESS_FIXTURE_KIDS}
        />
      </AppRouterContext.Provider>,
    );

    assert.match(html, /This page is ready for Maya\./);
    assert.match(
      html,
      /You have not shared any specific skills for Maya yet\./,
    );
    assert.match(html, /Ask Homa about Maya/);
    assert.doesNotMatch(html, /Open the full report/);
    assert.doesNotMatch(html, /Maya(?:&#x27;|')s snapshot/);
    assert.doesNotMatch(html, /Subject by subject/);
    assert.doesNotMatch(html, /0 skills|0 observations|0 answers|0%/i);
    assert.match(html, /min-h-11/);
    assert.match(html, /bg-\[var\(--brand-active\)\]/);
    assert.match(html, /text-on-brand/);
    assert.match(html, /hover:bg-\[var\(--clay-600\)\]/);
  });

  it("offers the first check-in when the child has never been assessed", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={ROUTER}>
        <ProgressView
          view={{ ...PROGRESS_FIXTURE_VIEW, subjects: [], conflicts: [] }}
          reportHref={null}
          report={null}
          eras={[]}
          kids={PROGRESS_FIXTURE_KIDS}
          lessons={{
            recordHref: "/app/child-1/lessons/record",
            lessons: [],
          }}
        />
      </AppRouterContext.Provider>,
    );

    // No report and nothing shared: the assessment CTA, not the
    // waiting-for-answers empty state.
    assert.match(html, /See where Maya is today\./);
    assert.doesNotMatch(html, /This page is ready for Maya\./);

    // The primary CTA deep-links to this child's onboarding checklist.
    assert.match(
      html,
      /<a[^>]*href="\/onboarding\?start=child-1"[^>]*>Start Maya(?:&#x27;|')s check-in<\/a>/,
    );
    // On a never-assessed child the check-in keeps the top spot; the
    // recording door waits below it rather than competing.
    assert.ok(
      html.indexOf("Start Maya") < html.indexOf('aria-label="Lessons"'),
      "the first check-in must outrank the recording door when unassessed",
    );
    // Ask Homa stays as the quieter second door.
    assert.match(html, /Ask Homa about Maya/);

    assert.doesNotMatch(html, /Open the full report/);
    assert.doesNotMatch(html, /Maya(?:&#x27;|')s snapshot/);
    assert.doesNotMatch(html, /Subject by subject/);
  });

  it("carries the lesson recording door and this child's reviews", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={ROUTER}>
        <ProgressView
          view={PROGRESS_FIXTURE_VIEW}
          reportHref={null}
          report={PROGRESS_FIXTURE_REPORT}
          eras={PROGRESS_FIXTURE_ERAS}
          kids={PROGRESS_FIXTURE_KIDS}
          lessons={{
            recordHref: "/app/child-1/lessons/record",
            lessons: [
              { id: "lesson-1", status: "ready", startedAt: "2026-07-18T15:00:00.000Z" },
              { id: "lesson-2", status: "transcribing", startedAt: "2026-07-17T15:00:00.000Z" },
              { id: "lesson-3", status: "failed", startedAt: "2026-07-16T15:00:00.000Z" },
            ],
          }}
        />
      </AppRouterContext.Provider>,
    );

    assert.match(html, /aria-label="Lessons"/);
    assert.match(
      html,
      /<a[^>]*href="\/app\/child-1\/lessons\/record"[^>]*>[\s\S]*Record a lesson[\s\S]*<\/a>/,
    );
    assert.match(html, /href="\/app\/lessons\/lesson-1"/);

    // Above the chart, not below it. Shipped below first and a founder
    // could not find it on a scored child: the chart plus a dozen
    // subject rows put it a full screen down (2026-07-21).
    assert.ok(
      html.indexOf('aria-label="Lessons"') <
        html.indexOf("Every subject here comes from your answers"),
      "the recording door must render above the subject content",
    );

    // Status reads in the parent's words, never a pipeline stage.
    assert.match(html, /Review ready/);
    assert.match(html, /Review on the way/);
    assert.match(html, /Homa couldn(?:&#x27;|')t finish/);
    assert.doesNotMatch(html, /transcribing/);
  });

  it("offers no recording door when the caller passes no lessons", () => {
    // Both the flag-off page and the founder console's read-only mirror
    // land here: a mirror must never offer to start a recording.
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={ROUTER}>
        <ProgressView
          view={PROGRESS_FIXTURE_VIEW}
          reportHref={null}
          report={PROGRESS_FIXTURE_REPORT}
          eras={PROGRESS_FIXTURE_ERAS}
          kids={PROGRESS_FIXTURE_KIDS}
          deeperChecks={false}
        />
      </AppRouterContext.Provider>,
    );

    assert.doesNotMatch(html, /aria-label="Lessons"/);
    assert.doesNotMatch(html, /Record a lesson/);
    assert.doesNotMatch(html, /lessons\/record/);
  });

  it("shows the firsts door when hasFirsts is true and the child is assessed", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={ROUTER}>
        <ProgressView
          view={PROGRESS_FIXTURE_VIEW}
          reportHref={null}
          report={PROGRESS_FIXTURE_REPORT}
          eras={PROGRESS_FIXTURE_ERAS}
          kids={PROGRESS_FIXTURE_KIDS}
          hasFirsts
        />
      </AppRouterContext.Provider>,
    );
    assert.match(html, /href="\/app\/child-1\/firsts"[^>]*>See the firsts</);
  });

  it("hides the firsts door when hasFirsts is false, even with the abilities card", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={ROUTER}>
        <ProgressView
          view={PROGRESS_FIXTURE_VIEW}
          reportHref={null}
          report={PROGRESS_FIXTURE_REPORT}
          eras={PROGRESS_FIXTURE_ERAS}
          kids={PROGRESS_FIXTURE_KIDS}
          hasFirsts={false}
        />
      </AppRouterContext.Provider>,
    );
    assert.doesNotMatch(html, /See the firsts/);
    assert.doesNotMatch(html, /\/firsts"/);
  });

  it("hides the firsts door for a never-assessed child", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={ROUTER}>
        <ProgressView
          view={{ ...PROGRESS_FIXTURE_VIEW, subjects: [], conflicts: [] }}
          reportHref={null}
          report={null}
          eras={[]}
          kids={PROGRESS_FIXTURE_KIDS}
          hasFirsts
        />
      </AppRouterContext.Provider>,
    );
    assert.doesNotMatch(html, /See the firsts/);
  });

  it("adds no count, percentage, or banned word with the door", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={ROUTER}>
        <ProgressView
          view={PROGRESS_FIXTURE_VIEW}
          reportHref={null}
          report={PROGRESS_FIXTURE_REPORT}
          eras={PROGRESS_FIXTURE_ERAS}
          kids={PROGRESS_FIXTURE_KIDS}
          hasFirsts
        />
      </AppRouterContext.Provider>,
    );
    // The door text itself carries no number and no deficit word.
    const doorText = "See the firsts";
    assert.ok(html.includes(doorText));
    assert.ok(!/\bbehind\b/i.test(doorText));
    assert.ok(!/\d/.test(doorText));
  });
});
