import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SidePanel } from "./side-panel";

/**
 * Static-markup coverage only, matching this codebase's existing
 * convention for these dialog components (progress-detail-panel.test.tsx):
 * renderToStaticMarkup never runs effects, so the focus trap and
 * Escape/scrim listeners are proven by extraction (ProgressDetailPanel's
 * own dialog tests still pass unchanged after the refactor) rather than
 * re-asserted here. This file proves the chassis's shape and props wiring.
 */
describe("SidePanel", () => {
  it("renders an accessible dialog labelled by the caller's own heading id", () => {
    const html = renderToStaticMarkup(
      <SidePanel labelledBy="test-heading" onClose={() => {}}>
        <h2 id="test-heading">Test panel</h2>
        <p>Body content</p>
      </SidePanel>,
    );
    assert.match(html, /role="dialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /aria-labelledby="test-heading"/);
    assert.match(html, /<h2 id="test-heading">Test panel<\/h2>/);
    assert.match(html, /Body content/);
  });

  it("carries the mobile bottom-sheet and desktop right-sheet geometry classes", () => {
    const html = renderToStaticMarkup(
      <SidePanel labelledBy="h" onClose={() => {}}>
        <span id="h" />
      </SidePanel>,
    );
    assert.match(html, /max-h-\[78dvh\]/);
    assert.match(html, /lg:w-\[min\(440px,92vw\)\]/);
  });

  it("renders the scrim and the mobile-only grabber", () => {
    const html = renderToStaticMarkup(
      <SidePanel labelledBy="h" onClose={() => {}}>
        <span id="h" />
      </SidePanel>,
    );
    assert.match(html, /rgba\(51,42,33,0\.42\)/);
    assert.match(html, /bg-\[var\(--stone-300\)\]/);
  });
});
