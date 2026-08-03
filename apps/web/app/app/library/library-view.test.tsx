import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { FamilyAssetUploadView } from "../../../lib/library/family-asset-uploads";
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
    authors: [],
    publisher: null,
    language: null,
    status: "ready",
    processingErrorCode: null,
    processingNote: null,
    sourceUploadId: "11111111-1111-4111-8111-111111111111",
    sourceAttachmentId: null,
    parentAssetId: null,
    children: [],
    subjects: [],
    processedAt: "2026-08-01T12:00:00.000Z",
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
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
    authors: [],
    publisher: null,
    language: null,
    status: "ready",
    processingErrorCode: null,
    processingNote: null,
    sourceUploadId: "22222222-2222-4222-8222-222222222222",
    sourceAttachmentId: null,
    parentAssetId: null,
    children: [],
    subjects: [],
    processedAt: "2026-08-01T12:00:00.000Z",
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
  },
];

function renderLibrary(
  initialAssets: FamilyAssetView[],
  initialUploads: FamilyAssetUploadView[] = [],
  canUpload = true,
  initialSelectedAssetId: string | null = null,
): string {
  return renderToStaticMarkup(
    <LibraryView
      initialAssets={initialAssets}
      initialUploads={initialUploads}
      childOptions={[{ id: "33333333-3333-4333-8333-333333333333", name: "Mia" }]}
      subjectOptions={[{ id: "math", label: "Math" }]}
      canUpload={canUpload}
      initialSelectedAssetId={initialSelectedAssetId}
    />,
  );
}

describe("LibraryView", () => {
  it("starts an empty Library with one clear action", () => {
    const html = renderLibrary([]);
    assert.match(html, /data-brand-surface="library"/u);
    assert.match(html, /quiet-frame quiet-frame--paper/u);
    assert.match(html, /quiet-action quiet-action--primary/u);
    assert.match(html, /Add your first resource/);
    assert.match(html, /Add a resource<\/span>/u);
    assert.doesNotMatch(html, /Add resources<\/span>/u);
  });

  it("renders a visual shelf without showing storage controls or privacy copy", () => {
    const html = renderLibrary(ASSETS);
    assert.match(html, /Add resources<\/span>/u);
    assert.match(html, /quiet-search/u);
    assert.match(html, /quiet-filter/u);
    assert.match(html, /quiet-artifact-card/u);
    assert.match(html, /quiet-library-cover/u);
    assert.match(html, /Search title, child, or subject/);
    assert.match(html, />All 2<\/button>/);
    assert.match(html, />Worksheet 1<\/button>/);
    assert.match(html, />Book 1<\/button>/);
    assert.match(html, /aria-label="Open Math practice"/);
    assert.match(html, /quiet-library-cover/u);
    assert.doesNotMatch(html, />Download<\/a>/);
    assert.doesNotMatch(html, />View details/);
    assert.doesNotMatch(html, /surface=shelf/);
    assert.doesNotMatch(html, /math-practice\.pdf|nature-reader\.epub/);
    assert.doesNotMatch(html, /example\.public\.blob/);
    assert.doesNotMatch(html, /Before you choose files/);
    assert.doesNotMatch(html, /These files are not private/);
  });

  it("renders an image resource as a visual shelf item instead of a storage record", () => {
    const html = renderLibrary([
      {
        ...ASSETS[0],
        id: "asset-image",
        title: "Botany field notes",
        originalName: "IMG_6203-random-storage-suffix.jpg",
        url: "https://example.public.blob.vercel-storage.com/botany.jpg",
        mediaType: "image/jpeg",
        fileKind: "image",
      },
    ]);

    assert.match(html, /<img\b[^>]*alt="Botany field notes"/u);
    assert.doesNotMatch(html, /IMG_6203-random-storage-suffix/u);
  });

  it("opens an exact source passed through a Library deep link", () => {
    const html = renderLibrary(ASSETS, [], true, "asset-pdf");
    assert.match(html, /data-brand-surface="library-detail"/u);
    assert.match(html, /quiet-context-sheet/u);
    assert.match(html, /Library resource/u);
    assert.match(html, /Close resource details/u);
    assert.match(html, /Math practice/u);
    assert.match(html, /Download<\/span>/u);
  });

  it("shows every processing state on the shelf", () => {
    const html = renderLibrary([
      ASSETS[0],
      { ...ASSETS[0], id: "processing", title: "Processing", status: "processing" },
      { ...ASSETS[0], id: "attention", title: "Attention", status: "needs_attention" },
      { ...ASSETS[0], id: "failed", title: "Failed", status: "failed" },
    ]);
    assert.doesNotMatch(html, /<p[^>]*>Ready<\/p>/);
    assert.match(html, /Organizing details/u);
    assert.match(html, /Needs attention/u);
    assert.match(html, /Could not organize/u);
  });

  it("restores an interrupted upload with explicit resume and cleanup actions", () => {
    const html = renderLibrary(ASSETS, [
      {
        id: "11111111-1111-4111-8111-111111111111",
        originalName: "big-curriculum.zip",
        pathname:
          "families/family-id/library/request-id/big-curriculum.zip",
        mediaType: "application/zip",
        byteSize: 10 * 1024 * 1024,
        lastModified: 123,
        fingerprintSha256: "a".repeat(64),
        blobUploadId: "blob-upload-id",
        blobKey: "families/family-id/library/request-id/big-curriculum.zip",
        completedParts: [
          {
            etag: "part-one",
            partNumber: 1,
            byteSize: 8 * 1024 * 1024,
            sha256: "b".repeat(64),
          },
        ],
        status: "needs_attention",
        statusNote: "The connection stopped before the file finished uploading.",
        errorCode: null,
        createdAt: "2026-08-01T12:00:00.000Z",
        updatedAt: "2026-08-01T12:01:00.000Z",
      },
    ]);
    assert.match(html, /80% uploaded/);
    assert.match(html, /1 unfinished upload/);
    assert.match(html, /Everything already on your shelf is still available/);
    assert.match(html, /The connection stopped before the file finished uploading/);
    assert.match(html, /Choose same file to resume<\/span>/u);
    assert.match(html, /Restart upload<\/span>/u);
    assert.match(html, /Remove upload<\/span>/u);
    assert.match(html, /Add another resource<\/span>/u);
    assert.doesNotMatch(html, /Add resources<\/span>/u);
    assert.match(html, /Neither changes the file on your device/);
    assert.doesNotMatch(html, /Choose the same file to continue/);
  });

  it("keeps a failed cleanup actionable without reopening the upload", () => {
    const html = renderLibrary(ASSETS, [
      {
        id: "11111111-1111-4111-8111-111111111111",
        originalName: "old-reader.pdf",
        pathname: "families/family-id/library/request-id/old-reader.pdf",
        mediaType: "application/pdf",
        byteSize: 1024,
        lastModified: 123,
        fingerprintSha256: "a".repeat(64),
        blobUploadId: "blob-upload-id",
        blobKey: "families/family-id/library/request-id/old-reader.pdf",
        completedParts: [],
        status: "needs_attention",
        statusNote: "Homa did not remove this unfinished upload. Try again.",
        errorCode: "blob_delete_failed",
        createdAt: "2026-08-01T12:00:00.000Z",
        updatedAt: "2026-08-01T12:01:00.000Z",
      },
    ]);

    assert.match(html, /Try removing again<\/span>/u);
    assert.match(html, /The file on your device was not changed/);
    assert.doesNotMatch(html, />Choose same file to resume<\/button>/);
    assert.doesNotMatch(html, />Restart upload<\/button>/);
  });

  it("keeps existing records manageable after membership ends", () => {
    const html = renderLibrary(
      ASSETS,
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          originalName: "unfinished.pdf",
          pathname: "families/family-id/library/request-id/unfinished.pdf",
          mediaType: "application/pdf",
          byteSize: 1024,
          lastModified: 123,
          fingerprintSha256: "a".repeat(64),
          blobUploadId: null,
          blobKey: null,
          completedParts: [],
          status: "needs_attention",
          statusNote: "Upload paused.",
          errorCode: null,
          createdAt: "2026-08-01T12:00:00.000Z",
          updatedAt: "2026-08-01T12:01:00.000Z",
        },
      ],
      false,
      "asset-pdf",
    );
    assert.match(html, /Your Library stays with you/);
    assert.match(html, /Download<\/span>/u);
    assert.match(html, /Remove upload<\/span>/u);
    assert.doesNotMatch(html, /Add resources<\/span>/u);
    assert.doesNotMatch(html, /Add another resource<\/span>/u);
    assert.doesNotMatch(html, /Choose file to resume<\/span>/u);
    assert.doesNotMatch(html, /Restart upload<\/span>/u);
  });
});
