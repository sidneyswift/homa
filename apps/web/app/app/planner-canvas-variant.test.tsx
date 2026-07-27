import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { PlannerCanvasPanel } from "./planner-canvas";

/**
 * Static-markup coverage of the variant split
 * (plans/2026-07-21-chat-first-onboarding.md §2.7): "app" must render
 * byte-for-byte the same shape it always has (every live call site but
 * the new onboarding one is this variant), "onboarding" must come down
 * to the shared SidePanel chassis instead. renderToStaticMarkup never
 * runs effects, so every render lands in the loading phase, which is
 * exactly the state the new board skeleton replaces.
 */
describe("PlannerCanvasPanel variant", () => {
  it("defaults to the existing full-screen app shell, not a dialog", () => {
    const html = renderToStaticMarkup(
      <PlannerCanvasPanel childId={null} refreshSignal={0} onClose={() => {}} />,
    );
    assert.match(html, /aria-label="Week planner"/);
    assert.doesNotMatch(html, /role="dialog"/);
    assert.match(html, /fixed inset-0/);
  });

  it("variant=\"app\" is identical to the default", () => {
    const withVariant = renderToStaticMarkup(
      <PlannerCanvasPanel
        childId={null}
        refreshSignal={0}
        onClose={() => {}}
        variant="app"
      />,
    );
    const withoutVariant = renderToStaticMarkup(
      <PlannerCanvasPanel childId={null} refreshSignal={0} onClose={() => {}} />,
    );
    assert.equal(withVariant, withoutVariant);
  });

  it("variant=\"onboarding\" comes down to the SidePanel chassis", () => {
    const html = renderToStaticMarkup(
      <PlannerCanvasPanel
        childId={null}
        refreshSignal={0}
        onClose={() => {}}
        variant="onboarding"
      />,
    );
    assert.match(html, /role="dialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /max-h-\[78dvh\]/);
    assert.doesNotMatch(html, /fixed inset-0 z-40 flex flex-col bg-page/);
  });

  it("shows the board skeleton, not bare loading text, while the board is loading", () => {
    const html = renderToStaticMarkup(
      <PlannerCanvasPanel childId={null} refreshSignal={0} onClose={() => {}} />,
    );
    assert.doesNotMatch(html, /Setting up the week/);
    assert.match(html, /animate-pulse/);
  });

  it("keeps the full-page escape hatch in both variants", () => {
    for (const variant of ["app", "onboarding"] as const) {
      const html = renderToStaticMarkup(
        <PlannerCanvasPanel
          childId={null}
          refreshSignal={0}
          onClose={() => {}}
          variant={variant}
        />,
      );
      assert.match(html, /href="\/app\/planner"/);
    }
  });
});
