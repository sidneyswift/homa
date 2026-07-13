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

    // ONE subject card (founder ask 2026-07-13): the snapshot chart
    // whose legend rows are the subject-by-subject list. No second
    // grid, no meaning box, no separate heading.
    assert.match(html, /Maya(?:&#x27;|')s snapshot/);
    assert.match(html, /<svg[^>]*months ahead by subject over time/);
    assert.match(html, /Math climbed from \+7 to \+8 this week\./);
    assert.doesNotMatch(html, /Subject by subject/);

    // Legend rows are doors: they open the detail panel, strongest
    // first, values visible at rest, the conflict chip carried over
    // from the retired tile grid.
    assert.match(
      html,
      /<button[^>]*aria-haspopup="dialog"[^>]*>/,
    );
    assert.doesNotMatch(html, /aria-pressed/);
    assert.ok(html.indexOf(">Math<") !== -1);
    assert.ok(html.indexOf(">Math<") < html.indexOf(">Literacy<"));
    assert.match(html, />\+8</);
    assert.match(html, />\+0</);
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
