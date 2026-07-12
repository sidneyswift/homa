import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { ProgressUnavailable } from "./progress-unavailable";

const ROUTER = {
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch: async () => {},
};

describe("ProgressUnavailable", () => {
  it("keeps the child Progress URL and offers safe next steps", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={ROUTER}>
        <ProgressUnavailable
          childId="child-1"
          childName="Maya"
        />
      </AppRouterContext.Provider>,
    );

    assert.match(html, /Maya(?:&#x27;|')s progress is still safe/u);
    assert.match(
      html,
      /<button[^>]*type="button"[^>]*>Retry<\/button>/u,
    );
    assert.match(html, /Ask HOMA about Maya/u);
    assert.doesNotMatch(html, /\/report|\/onboarding/u);
  });
});
