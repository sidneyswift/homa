import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { buildAbilitiesExplorerPayload } from "../../lib/child-progress/abilities-explorer";
import { AbilitiesExplorer } from "./abilities-explorer";
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

function render(): string {
  const payload = buildAbilitiesExplorerPayload(
    PROGRESS_FIXTURE_VIEW,
    new Date("2026-08-03T12:00:00.000Z"),
  );
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={ROUTER}>
      <AbilitiesExplorer payload={payload} />
    </AppRouterContext.Provider>,
  );
}

describe("AbilitiesExplorer", () => {
  it("renders the plain status key, age axis, and dense graph", () => {
    const html = render();

    assert.match(html, /Every dot is one ability/);
    assert.match(html, /CURRICULUM AGE WINDOW/);
    assert.match(html, /age 4/);
    assert.match(html, /age 14/);
    assert.match(html, /Maya(?:&#x27;|')s progress/);
    assert.doesNotMatch(html, /var\(--midnight\)|var\(--support\)/);
    assert.match(html, /w-full rounded-pill/);
    for (const label of ["Knows", "Working on now", "Up next"]) {
      assert.match(html, new RegExp(label));
    }
    assert.ok(
      (html.match(/<circle/gu) ?? []).length > 100,
      "the first render should keep the full subject graph visible",
    );
  });

  it("does not carry the retired status vocabulary or a write-like practice action", () => {
    const html = render();

    assert.doesNotMatch(html, /You noticed|Taking shape|Homa connection/);
    assert.doesNotMatch(html, /Preview a next idea/);
    assert.match(html, /Show a practice idea/);
    assert.match(html, /This preview does not send or save anything/);
    assert.ok(!html.includes("—"), "the surface must not contain an em dash");
  });
});
