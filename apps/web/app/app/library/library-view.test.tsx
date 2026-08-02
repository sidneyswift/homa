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

function renderLibrary(
  initialAssets: FamilyAssetView[],
  initialUploads: FamilyAssetUploadView[] = [],
): string {
  return renderToStaticMarkup(
    <LibraryView
      initialAssets={initialAssets}
      initialUploads={initialUploads}
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
    assert.match(html, />Document file<\/span>/);
    assert.match(html, />Ebook file<\/span>/);
    assert.doesNotMatch(html, /These files are not private/);
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
    assert.match(html, /The connection stopped before the file finished uploading/);
    assert.match(html, />Choose file to resume<\/button>/);
    assert.match(html, />Restart upload<\/button>/);
    assert.match(html, />Remove upload<\/button>/);
    assert.match(html, />Add another resource<\/button>/);
    assert.doesNotMatch(html, />Add resources<\/button>/);
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

    assert.match(html, />Try remove again<\/button>/);
    assert.match(html, /The file on your device was not changed/);
    assert.doesNotMatch(html, />Choose file to resume<\/button>/);
    assert.doesNotMatch(html, />Restart upload<\/button>/);
  });
});
