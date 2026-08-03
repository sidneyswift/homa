import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

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
      <MaterialDetailOverlay
        material={material()}
        timeZone="UTC"
        onClose={() => undefined}
      />,
    );

    assert.match(html, /role="dialog"/u);
    assert.match(html, /aria-modal="true"/u);
    assert.match(html, /quiet-artifact-backdrop/u);
    assert.match(html, /quiet-artifact-dialog/u);
    assert.match(html, /Print it/u);
    assert.doesNotMatch(html, /rgba\(51,42,33|clay|bg-brand/u);
  });
});
