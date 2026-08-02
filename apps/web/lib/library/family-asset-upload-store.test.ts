import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseFamilyAssetUploadParts,
  toFamilyAssetView,
  toFamilyAssetUploadView,
  type FamilyAssetRow,
  type FamilyAssetUploadRow,
} from "./family-asset-upload-store";
import { LIBRARY_MULTIPART_CHUNK_BYTES } from "./family-asset-uploads";

describe("family asset upload persistence mapping", () => {
  it("drops malformed or wrong-size persisted multipart claims", () => {
    const byteSize = LIBRARY_MULTIPART_CHUNK_BYTES + 25;
    assert.deepEqual(
      parseFamilyAssetUploadParts(
        {
          "1": {
            etag: "part-one",
            partNumber: 1,
            byteSize: LIBRARY_MULTIPART_CHUNK_BYTES,
            sha256: "a".repeat(64),
          },
          "2": {
            etag: "wrong-size",
            partNumber: 2,
            byteSize: 24,
            sha256: "b".repeat(64),
          },
          "3": {
            etag: "out-of-range",
            partNumber: 3,
            byteSize: 25,
            sha256: "c".repeat(64),
          },
          bad: "not-an-object",
        },
        byteSize,
      ),
      [
        {
          etag: "part-one",
          partNumber: 1,
          byteSize: LIBRARY_MULTIPART_CHUNK_BYTES,
          sha256: "a".repeat(64),
        },
      ],
    );
  });

  it("maps database numbers and sorts completed parts for the browser", () => {
    const row: FamilyAssetUploadRow = {
      id: "upload-id",
      family_id: "family-id",
      initiated_by_user_id: "user-id",
      original_name: "reader.pdf",
      pathname: "families/family-id/library/request-id/reader.pdf",
      media_type: "application/pdf",
      byte_size: String(LIBRARY_MULTIPART_CHUNK_BYTES + 25),
      last_modified: "123",
      fingerprint_sha256: "a".repeat(64),
      blob_upload_id: "blob-upload-id",
      blob_key: "blob-key",
      completed_parts: {
        "2": {
          etag: "two",
          partNumber: 2,
          byteSize: 25,
          sha256: "b".repeat(64),
        },
        "1": {
          etag: "one",
          partNumber: 1,
          byteSize: LIBRARY_MULTIPART_CHUNK_BYTES,
          sha256: "a".repeat(64),
        },
      },
      status: "uploading",
      status_note: null,
      error_code: null,
      created_at: "2026-08-01T12:00:00.000Z",
      updated_at: "2026-08-01T12:01:00.000Z",
    };
    const view = toFamilyAssetUploadView(row);
    assert.equal(view.byteSize, LIBRARY_MULTIPART_CHUNK_BYTES + 25);
    assert.equal(view.lastModified, 123);
    assert.equal(view.errorCode, null);
    assert.deepEqual(
      view.completedParts.map((part) => part.partNumber),
      [1, 2],
    );
  });

  it("cleans a legacy chat Blob suffix without replacing an improved title", () => {
    const row: FamilyAssetRow = {
      id: "asset-id",
      title: "IMG_6203-7T4Cg8XgYfJhL3SR8IExfYK44q7AbC",
      original_name: "IMG_6203-7T4Cg8XgYfJhL3SR8IExfYK44q7AbC.jpg",
      url: "https://assets.public.blob.vercel-storage.com/families/family-id/library/photo.jpg",
      download_url: "https://assets.public.blob.vercel-storage.com/families/family-id/library/photo.jpg?download=1",
      media_type: "image/jpeg",
      byte_size: 1024,
      file_kind: "image",
      resource_kind: "worksheet",
      authors: [],
      publisher: null,
      language: "en",
      status: "ready",
      processing_error_code: null,
      processing_note: null,
      source_upload_id: null,
      source_attachment_id: "attachment-id",
      parent_asset_id: null,
      processed_at: "2026-08-02T12:01:00.000Z",
      created_at: "2026-08-02T12:00:00.000Z",
      updated_at: "2026-08-02T12:01:00.000Z",
    };

    assert.deepEqual(
      {
        title: toFamilyAssetView(row).title,
        originalName: toFamilyAssetView(row).originalName,
      },
      { title: "IMG_6203", originalName: "IMG_6203.jpg" },
    );
    assert.equal(
      toFamilyAssetView({ ...row, title: "Botany field notes" }).title,
      "Botany field notes",
    );
  });
});
