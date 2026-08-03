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

test("Library detail exposes editable organization fields without a second edit mode", () => {
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
  assert.match(html, /data-brand-surface="library-detail"/u);
  assert.match(html, /quiet-context-sheet/u);
  assert.match(html, /quiet-status quiet-status--error/u);
  assert.match(html, /Saved from chat/);
  assert.match(html, /Could not organize/);
  assert.match(html, /aria-label="Resource details"/);
  assert.match(html, /name="title"[^>]*value="Backyard bird guide"/);
  assert.match(html, /name="resourceKind"/);
  assert.match(html, /name="childIds"/);
  assert.match(html, /name="subjectIds"/);
  assert.match(html, />Ebook</);
  assert.match(html, /A\. Reader/);
  assert.match(html, /Field House/);
  assert.match(html, /Mia/);
  assert.match(html, /Science/);
  assert.match(html, /\/api\/library\/assets\/11111111-1111-4111-8111-111111111111\/download\?surface=detail/);
  assert.doesNotMatch(html, /assets\.public\.blob/);
  assert.doesNotMatch(html, />Edit details<\/button>/);
  assert.match(html, /disabled=""[^>]*>[\s\S]*?Save changes<\/span>/u);
  assert.match(html, /Remove from Library<\/span>/u);
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
  assert.match(html, /Try organizing again<\/span>/u);
  assert.match(
    html,
    /\/api\/library\/assets\/11111111-1111-4111-8111-111111111111\/download\?surface=detail/,
  );
});
