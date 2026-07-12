import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import {
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
        plans={[]}
        kids={PROGRESS_FIXTURE_KIDS}
      />,
    );

    // The bare header: freshness line and title, no intro sentence.
    assert.match(html, /Maya(?:&#x27;|')s progress/);
    assert.match(html, /Updated Jul 11, 2026/);
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

    // The chart card is the report's own snapshot.
    assert.match(html, /Maya(?:&#x27;|')s snapshot/);
    assert.match(
      html,
      /<svg[^>]*months ahead by subject across 2 check-ins/,
    );

    // The subject map: tiles that open a panel, strongest first (the
    // chart above also names subjects, so order is asserted inside the
    // grid section only).
    assert.match(html, /Subject by subject/);
    assert.match(
      html,
      /<button[^>]*aria-haspopup="dialog"[^>]*>/,
    );
    const grid = html.slice(html.indexOf("Subject by subject"));
    assert.ok(grid.indexOf(">Math<") !== -1);
    assert.ok(grid.indexOf(">Math<") < grid.indexOf(">Literacy<"));
    assert.match(html, /Ahead \u00b7 \+8 mo/);
    assert.match(html, /On track/);
    assert.match(html, /\+1 mo since Jun 10/);
    assert.match(html, /Please confirm/);

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
        plans={[]}
        kids={[{ id: "child-1", name: "Maya" }]}
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
          plans={[]}
          kids={PROGRESS_FIXTURE_KIDS}
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
    assert.doesNotMatch(html, /Maya(?:&#x27;|')s snapshot/);
    assert.doesNotMatch(html, /Subject by subject/);
    assert.doesNotMatch(html, /0 skills|0 observations|0%/i);
    assert.match(html, /min-h-11/);
    assert.match(html, /bg-\[var\(--brand-active\)\]/);
    assert.match(html, /text-on-brand/);
    assert.match(html, /hover:bg-\[var\(--clay-600\)\]/);
  });
});
