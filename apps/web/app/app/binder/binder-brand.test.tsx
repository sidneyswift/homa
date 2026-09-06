import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import type { BinderMaterial } from "../../../lib/materials/binder";
import { BinderView } from "./binder-view";
import { MaterialDetailOverlay } from "./material-detail-overlay";

function material(overrides: Partial<BinderMaterial> = {}): BinderMaterial {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    title: "A quiet page",
    kind: "worksheet",
    subject: "phonics",
    theme: null,
    skill: null,
    childId: null,
    childName: "Amalia",
    previewUrl: "https://example.test/preview.jpg",
    pdfUrl: "https://example.test/material.pdf",
    createdAt: new Date(Date.UTC(2026, 6, 28, 12)).toISOString(),
    pageCount: 1,
    pagePreviewUrls: null,
    sources: [],
    ...overrides,
  };
}

describe("Binder Quiet authority projection", () => {
  it("does not mistake a complete default cover for a failed search", () => {
    for (const count of [1, 3]) {
      const html = renderToStaticMarkup(<BinderView
        materials={Array.from({ length: count }, (_, index) => material({ id: `material-${index}` }))}
        scopeChildName={null} timeZone="UTC" now={new Date(Date.UTC(2026, 6, 28, 12))}
      />);
      assert.match(html, /quiet-artifact-card/u);
      assert.doesNotMatch(html, /Everything else|Nothing matches/u);
    }
  });

  it("keeps the remaining materials below a full cover", () => {
    const html = renderToStaticMarkup(<BinderView
      materials={Array.from({ length: 4 }, (_, index) => material({ id: `material-${index}`, title: `Page ${index}` }))}
      scopeChildName={null} timeZone="UTC" now={new Date(Date.UTC(2026, 6, 28, 12))}
    />);
    assert.match(html, /Everything else/u);
    for (let index = 0; index < 4; index++) assert.match(html, new RegExp(`Page ${index}`));
    assert.doesNotMatch(html, /Nothing matches/u);
  });

  it("names the selected child's empty collection and the actual keep action", () => {
    const html = renderToStaticMarkup(<BinderView materials={[]} scopeChildName="Maya" timeZone="UTC" now={new Date()} />);
    assert.match(html, /Nothing kept for Maya or the whole family yet\./u);
    assert.match(html, /Keep this on a draft/u);
  });

  it("keeps the browse surface on the shared artifact primitives", () => {
    const html = renderToStaticMarkup(
      <BinderView
        materials={[
          material(),
          material({
            id: "22222222-2222-2222-2222-222222222222",
            title: "Another page",
            kind: "coloring",
            subject: "math",
          }),
        ]}
        scopeChildName={null}
        timeZone="UTC"
        now={new Date(Date.UTC(2026, 6, 28, 12))}
      />,
    );

    assert.match(html, /data-brand-surface="binder"/u);
    assert.match(html, /quiet-search/u);
    assert.match(html, /quiet-filter/u);
    assert.match(html, /quiet-artifact-card/u);
    assert.match(html, /quiet-frame/u);
    assert.doesNotMatch(html, /clay|bg-brand|text-brand|HOMA/u);
  });

  it("uses the same Quiet action for an empty binder next move", () => {
    const html = renderToStaticMarkup(
      <BinderView
        materials={[]}
        scopeChildName={null}
        timeZone="UTC"
        now={new Date(Date.UTC(2026, 6, 28, 12))}
      />,
    );

    assert.match(html, /Nothing kept yet\./u);
    assert.match(html, /quiet-action quiet-action--primary/u);
    assert.match(html, />Ask Homa</u);
  });

  it("keeps the preview dialog semantic and keyboard-oriented", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={{
        back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch: async () => {},
      }}>
      <MaterialDetailOverlay
        material={material()}
        timeZone="UTC"
        onClose={() => undefined}
      />
      </AppRouterContext.Provider>,
    );

    assert.match(html, /role="dialog"/u);
    assert.match(html, /aria-modal="true"/u);
    assert.match(html, /quiet-artifact-backdrop/u);
    assert.match(html, /quiet-artifact-dialog/u);
    assert.match(html, /Open PDF to print/u);
    assert.doesNotMatch(html, /rgba\(51,42,33|clay|bg-brand/u);
  });
});
