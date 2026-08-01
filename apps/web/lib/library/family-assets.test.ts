import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  familyAssetFileKind,
  formatFamilyAssetBytes,
  isFamilyLibraryUrl,
  libraryUploadMediaType,
  safeLibraryPathName,
  titleFromLibraryFileName,
} from "./family-assets";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";

describe("family asset exact metadata helpers", () => {
  it("classifies the file container without guessing resource meaning", () => {
    assert.equal(familyAssetFileKind("application/pdf"), "document");
    assert.equal(familyAssetFileKind("image/heic"), "image");
    assert.equal(familyAssetFileKind("application/epub+zip"), "archive");
    assert.equal(familyAssetFileKind("application/octet-stream"), "other");
  });

  it("keeps Library paths safe while preserving a useful filename", () => {
    assert.equal(safeLibraryPathName("  My Math / Week 1.pdf  "), "My-Math-Week-1.pdf");
    assert.equal(titleFromLibraryFileName("My Math Week 1.pdf"), "My Math Week 1");
  });

  it("accepts only this family's exact Library Blob prefix", () => {
    const valid = `https://assets.public.blob.vercel-storage.com/families/${FAMILY_ID}/library/math.pdf`;
    const chat = `https://assets.public.blob.vercel-storage.com/families/${FAMILY_ID}/chat/math.pdf`;
    const foreign = "https://assets.public.blob.vercel-storage.com/families/22222222-2222-4222-8222-222222222222/library/math.pdf";
    assert.equal(isFamilyLibraryUrl(valid, FAMILY_ID), true);
    assert.equal(isFamilyLibraryUrl(chat, FAMILY_ID), false);
    assert.equal(isFamilyLibraryUrl(foreign, FAMILY_ID), false);
    assert.equal(isFamilyLibraryUrl("https://example.com/math.pdf", FAMILY_ID), false);
  });

  it("formats the stored byte count for the shelf", () => {
    assert.equal(formatFamilyAssetBytes(900), "900 B");
    assert.equal(formatFamilyAssetBytes(2048), "2 KB");
    assert.equal(formatFamilyAssetBytes(5 * 1024 * 1024), "5.0 MB");
    assert.equal(formatFamilyAssetBytes(25 * 1024 * 1024), "25 MB");
  });

  it("fills only exact missing browser media types", () => {
    assert.equal(libraryUploadMediaType("reader.epub", ""), "application/epub+zip");
    assert.equal(
      libraryUploadMediaType("lesson.pages", ""),
      "application/vnd.apple.pages",
    );
    assert.equal(
      libraryUploadMediaType("reader.epub", "application/octet-stream"),
      "application/epub+zip",
    );
    assert.equal(libraryUploadMediaType("slides.key", ""), "");
    assert.equal(libraryUploadMediaType("photo.jpg", "image/custom"), "image/custom");
  });
});
