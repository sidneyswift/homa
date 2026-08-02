import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { FamilyAssetView } from "../../../lib/library/family-assets";
import { LibraryDetailPanel } from "./library-detail-panel";

const ASSET: FamilyAssetView = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Backyard bird guide",
  originalName: "birds.epub",
  url: "https://assets.public.blob.vercel-storage.com/families/family/library/birds.epub",
  downloadUrl: "https://assets.public.blob.vercel-storage.com/families/family/library/birds.epub?download=1",
  mediaType: "application/epub+zip",
  byteSize: 4096,
  fileKind: "archive",
  resourceKind: "book",
  authors: ["A. Reader"],
  publisher: "Field House",
  language: "en",
  status: "failed",
  processingErrorCode: "content_format_unsupported",
  processingNote: null,
  sourceUploadId: null,
  sourceAttachmentId: "22222222-2222-4222-8222-222222222222",
  parentAssetId: null,
  children: [{ id: "33333333-3333-4333-8333-333333333333", name: "Mia" }],
  subjects: [{ id: "science", label: "Science", source: "model" }],
  processedAt: null,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:01:00.000Z",
};

test("Library detail names source, processing, associations, and authenticated actions", () => {
  const html = renderToStaticMarkup(
    <LibraryDetailPanel
      asset={ASSET}
      childOptions={[{ id: ASSET.children[0].id, name: "Mia" }]}
      subjectOptions={[{ id: "science", label: "Science" }]}
      onClose={() => undefined}
      onUpdated={() => undefined}
      onDeleted={() => undefined}
    />,
  );
  assert.match(html, /Saved from chat/);
  assert.match(html, /Could not organize/);
  assert.match(html, /Use Edit details to add or change/);
  assert.match(html, />Ebook</);
  assert.match(html, /A\. Reader/);
  assert.match(html, /Field House/);
  assert.match(html, /Mia/);
  assert.match(html, /Science/);
  assert.match(html, /\/api\/library\/assets\/11111111-1111-4111-8111-111111111111\/download\?surface=detail/);
  assert.doesNotMatch(html, /assets\.public\.blob/);
  assert.match(html, />Edit details<\/button>/);
  assert.match(html, />Remove from Library<\/button>/);
  assert.doesNotMatch(html, /Try organizing again/);
});

test("Library detail retries only transient processing failures", () => {
  const html = renderToStaticMarkup(
    <LibraryDetailPanel
      asset={{
        ...ASSET,
        status: "failed",
        processingErrorCode: "processing_failed",
        processingNote: "Your original is still in your Library.",
      }}
      childOptions={[]}
      subjectOptions={[]}
      onClose={() => undefined}
      onUpdated={() => undefined}
      onDeleted={() => undefined}
    />,
  );
  assert.match(html, />Try organizing again<\/button>/);
  assert.match(
    html,
    /\/api\/library\/assets\/11111111-1111-4111-8111-111111111111\/download\?surface=detail/,
  );
});
