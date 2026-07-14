import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { ProgressDetailPanel } from "./progress-detail-panel";
import { PROGRESS_FIXTURE_VIEW } from "./progress-view.fixture";

const ROUTER = {
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch: async () => {},
};

const MATH = PROGRESS_FIXTURE_VIEW.subjects[0];
const TILE = {
  subjectId: "math",
  displayName: "Math",
  badge: {
    label: "Ahead \u00b7 +8 mo",
    background: "var(--gold-100)",
    color: "var(--gold-ink)",
  },
  freshness: { kind: "today" as const, label: "Updated today" },
  needsConfirm: true,
  deeperCheck: true,
};

describe("ProgressDetailPanel", () => {
  it("renders one subject's full hierarchy as an accessible dialog", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={ROUTER}>
        <ProgressDetailPanel
          childId="child-1"
          subject={MATH}
          tile={TILE}
          conflicts={PROGRESS_FIXTURE_VIEW.conflicts}
          timeZone={PROGRESS_FIXTURE_VIEW.timeZone}
          allowDeeperCheck
          onClose={() => {}}
        />
      </AppRouterContext.Provider>,
    );

    assert.match(html, /role="dialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /aria-labelledby="progress-panel-math"/);
    assert.match(html, /<h2 id="progress-panel-math"/);
    assert.match(html, /Ahead \u00b7 \+8 mo/);
    // The validate-the-reading door (founder ask 2026-07-14): the deep
    // dive link for this child and subject.
    assert.match(html, /Answer a few deeper questions/);
    assert.match(html, /\/onboarding\?dd=child-1\.math/);
    // The dated movement chip retired from this surface (2026-07-13).
    assert.doesNotMatch(html, /since Jun 10/);
    assert.match(
      html,
      /4 answers \u00b7 Elena and Jordan shared different answers on Jul 11, 2026\. Both are saved\./,
    );

    // The domain and topic hierarchy, moved here from the old page body.
    assert.match(
      html,
      /<section aria-labelledby="progress-domain-math\.number-sense"/,
    );
    assert.ok(
      html.indexOf("Number sense") <
        html.indexOf("Counts five objects accurately"),
    );
    for (const label of [
      "Shared today",
      "Shared earlier",
      "HOMA asks later",
      "Please confirm",
    ]) {
      assert.match(html, new RegExp(label));
    }
    for (const detail of [
      "Recorded in a check-in.",
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

    // The panel's doors: closing it, tapping a saved answer to settle
    // the disagreement, and the correction path the page promises.
    assert.match(html, /<button[^>]*>Close<\/button>/);
    assert.match(
      html,
      /<button[^>]*aria-label="Confirm Elena(?:&#x27;|')s answer: Easily"/,
    );
    assert.match(
      html,
      /<button[^>]*aria-label="Confirm Jordan(?:&#x27;|')s answer: Not yet"/,
    );
    assert.match(html, /tap the answer that fits today/);
    assert.match(html, /Tell HOMA something looks wrong/);

    // Bottom sheet on phones, side panel on desktop, house motion rules.
    assert.match(html, /max-h-\[78dvh\]/);
    assert.match(html, /lg:w-\[min\(440px,92vw\)\]/);
    assert.match(html, /starting:translate-y-full/);
    assert.match(html, /motion-reduce:transition-none/);
  });

  it("keeps the conflict door out of settled subjects", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={ROUTER}>
        <ProgressDetailPanel
          childId="child-1"
          subject={PROGRESS_FIXTURE_VIEW.subjects[1]}
          tile={null}
          conflicts={[]}
          timeZone={PROGRESS_FIXTURE_VIEW.timeZone}
          allowDeeperCheck={false}
          onClose={() => {}}
        />
      </AppRouterContext.Provider>,
    );

    assert.doesNotMatch(html, /Answer a few deeper questions/);

    assert.match(html, /aria-labelledby="progress-panel-literacy"/);
    assert.doesNotMatch(html, /Confirm (?:Elena|Jordan)/);
    assert.doesNotMatch(html, /tap the answer that fits today/);
    assert.match(html, /Tell HOMA something looks wrong/);
  });
});
