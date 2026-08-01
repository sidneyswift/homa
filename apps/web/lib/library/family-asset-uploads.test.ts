import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  familyAssetUploadFingerprint,
  familyAssetUploadPartByteSize,
  familyAssetUploadPartCount,
  familyAssetUploadPartSha256,
  familyAssetUploadPath,
  familyAssetUploadProgress,
  isFamilyAssetUploadFingerprint,
  LIBRARY_MULTIPART_CHUNK_BYTES,
  mergeFamilyAssetUploadParts,
} from "./family-asset-uploads";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";

describe("family asset upload recovery helpers", () => {
  it("gives each reservation one stable family-scoped pathname", () => {
    assert.equal(
      familyAssetUploadPath(FAMILY_ID, REQUEST_ID, "Math / Week 1.pdf"),
      `families/${FAMILY_ID}/library/${REQUEST_ID}/Math-Week-1.pdf`,
    );
  });

  it("splits a file into exact retryable parts", () => {
    const byteSize = LIBRARY_MULTIPART_CHUNK_BYTES * 2 + 19;
    assert.equal(familyAssetUploadPartCount(byteSize), 3);
    assert.equal(
      familyAssetUploadPartByteSize(byteSize, 1),
      LIBRARY_MULTIPART_CHUNK_BYTES,
    );
    assert.equal(familyAssetUploadPartByteSize(byteSize, 2), LIBRARY_MULTIPART_CHUNK_BYTES);
    assert.equal(familyAssetUploadPartByteSize(byteSize, 3), 19);
    assert.equal(familyAssetUploadPartByteSize(byteSize, 4), null);
  });

  it("counts only exact unique completed parts toward progress", () => {
    const byteSize = LIBRARY_MULTIPART_CHUNK_BYTES + 100;
    assert.equal(
      familyAssetUploadProgress(byteSize, [
        {
          etag: "first",
          partNumber: 1,
          byteSize: LIBRARY_MULTIPART_CHUNK_BYTES,
          sha256: "a".repeat(64),
        },
        {
          etag: "duplicate",
          partNumber: 1,
          byteSize: LIBRARY_MULTIPART_CHUNK_BYTES,
          sha256: "b".repeat(64),
        },
        { etag: "wrong", partNumber: 2, byteSize: 99, sha256: "c".repeat(64) },
      ]),
      99,
    );
    assert.equal(
      familyAssetUploadProgress(byteSize, [
        {
          etag: "first",
          partNumber: 1,
          byteSize: LIBRARY_MULTIPART_CHUNK_BYTES,
          sha256: "a".repeat(64),
        },
        { etag: "last", partNumber: 2, byteSize: 100, sha256: "b".repeat(64) },
      ]),
      100,
    );
  });

  it("keeps progress when worker responses arrive out of order", () => {
    const first = {
      etag: "first",
      partNumber: 1,
      byteSize: LIBRARY_MULTIPART_CHUNK_BYTES,
      sha256: "a".repeat(64),
    };
    const second = {
      etag: "second",
      partNumber: 2,
      byteSize: LIBRARY_MULTIPART_CHUNK_BYTES,
      sha256: "b".repeat(64),
    };

    assert.deepEqual(
      mergeFamilyAssetUploadParts([first, second], [first]),
      [first, second],
    );
  });

  it("fingerprints file identity with content samples and metadata", async () => {
    const first = new File(["same content"], "lesson.txt", {
      type: "text/plain",
      lastModified: 123,
    });
    const same = new File(["same content"], "lesson.txt", {
      type: "text/plain",
      lastModified: 123,
    });
    const renamed = new File(["same content"], "other.txt", {
      type: "text/plain",
      lastModified: 123,
    });
    const fingerprint = await familyAssetUploadFingerprint(first);
    assert.equal(fingerprint, await familyAssetUploadFingerprint(same));
    assert.notEqual(fingerprint, await familyAssetUploadFingerprint(renamed));
    assert.equal(isFamilyAssetUploadFingerprint(fingerprint), true);
    assert.equal(isFamilyAssetUploadFingerprint("not-a-fingerprint"), false);
  });

  it("hashes each persisted part so resume cannot mix two files", async () => {
    const first = await familyAssetUploadPartSha256(new Blob(["part one"]));
    const same = await familyAssetUploadPartSha256(new Blob(["part one"]));
    const different = await familyAssetUploadPartSha256(new Blob(["part two"]));
    assert.equal(first, same);
    assert.notEqual(first, different);
  });
});
