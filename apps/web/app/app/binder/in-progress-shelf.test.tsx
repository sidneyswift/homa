import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { BinderMaterial } from "../../../lib/materials/binder";
import { InProgressShelf } from "./in-progress-shelf";

/**
 * The shelf that ends draft stranding (gh#197). Renders server-side so
 * the copy laws are testable without a browser: no red framing, no
 * "unfinished", nothing that reads as a chore she is behind on.
 */

function material(overrides: Partial<BinderMaterial> = {}): BinderMaterial {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Amalia's Casa de Muñecas",
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

describe("InProgressShelf", () => {
  it("renders nothing at all when everything has been kept", () => {
    assert.equal(renderToStaticMarkup(<InProgressShelf materials={[]} />), "");
  });

  it("shows the material with its preview, child, and a keep action", () => {
    const html = renderToStaticMarkup(
      <InProgressShelf materials={[material()]} />,
    );
    assert.match(html, /Amalia&#x27;s Casa de Mu/u);
    assert.match(html, /https:\/\/example\.test\/preview\.jpg/u);
    assert.match(html, /Keep this one/u);
    assert.match(html, /for Amalia/u);
    assert.match(html, /quiet-frame/u);
    assert.match(html, /quiet-action/u);
    assert.doesNotMatch(html, /clay|bg-brand|text-brand/u);
  });

  it("counts in the singular for one item and the plural for several", () => {
    const one = renderToStaticMarkup(
      <InProgressShelf materials={[material()]} />,
    );
    assert.match(one, /One thing we made together/u);

    const many = renderToStaticMarkup(
      <InProgressShelf
        materials={[material(), material({ id: "22222222-2222-2222-2222-222222222222" })]}
      />,
    );
    assert.match(many, /2 things we made together/u);
  });

  it("never frames the parent as behind (no red, no 'unfinished', no chore voice)", () => {
    const html = renderToStaticMarkup(
      <InProgressShelf materials={[material()]} />,
    );
    for (const banned of [
      /unfinished/iu,
      /incomplete/iu,
      /behind/iu,
      /you forgot/iu,
      /action required/iu,
      /text-red/u,
      /danger/u,
    ]) {
      assert.ok(!banned.test(html), `copy must not use ${banned}`);
    }
  });
});
