import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { FamilyAssetView } from "../../../lib/library/family-assets";
import { LibraryView } from "./library-view";

const ASSETS: FamilyAssetView[] = [
  {
    id: "asset-pdf",
    title: "Math practice",
    originalName: "math-practice.pdf",
    url: "https://example.public.blob.vercel-storage.com/math-practice.pdf",
    downloadUrl: "https://example.public.blob.vercel-storage.com/math-practice.pdf",
    mediaType: "application/pdf",
    byteSize: 1024,
    fileKind: "document",
    resourceKind: "worksheet",
    status: "ready",
    processingNote: null,
    createdAt: "2026-08-01T12:00:00.000Z",
  },
  {
    id: "asset-ebook",
    title: "Nature reader",
    originalName: "nature-reader.epub",
    url: "https://example.public.blob.vercel-storage.com/nature-reader.epub",
    downloadUrl: "https://example.public.blob.vercel-storage.com/nature-reader.epub",
    mediaType: "application/epub+zip",
    byteSize: 2048,
    fileKind: "archive",
    resourceKind: "book",
    status: "ready",
    processingNote: null,
    createdAt: "2026-08-01T12:00:00.000Z",
  },
];

function renderLibrary(initialAssets: FamilyAssetView[]): string {
  return renderToStaticMarkup(
    <LibraryView
      familyId="11111111-1111-4111-8111-111111111111"
      initialAssets={initialAssets}
    />,
  );
}

describe("LibraryView", () => {
  it("starts an empty Library with one clear action", () => {
    const html = renderLibrary([]);
    assert.match(html, /Add your first resource/);
    assert.match(html, />Add a resource<\/button>/);
    assert.doesNotMatch(html, />Add resources<\/button>/);
  });

  it("renders a compact shelf without showing the privacy warning until upload", () => {
    const html = renderLibrary(ASSETS);
    assert.match(html, />Add resources<\/button>/);
    assert.match(html, />Download file<\/a>/);
    assert.match(html, />Document<\/span>/);
    assert.match(html, />Ebook<\/span>/);
    assert.doesNotMatch(html, /These files are not private/);
  });
});
