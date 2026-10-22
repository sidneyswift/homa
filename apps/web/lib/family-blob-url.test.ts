import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalFamilyBlobUrl,
  familyBlobBrowserUrl,
  familyBlobPathname,
  isFamilyBlobUrl,
  isPrivateFamilyBlobUrl,
} from "./family-blob-url";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_FAMILY_ID = "22222222-2222-4222-8222-222222222222";
const PUBLIC_URL = `https://store.public.blob.vercel-storage.com/families/${FAMILY_ID}/chat/math%20page.png`;
const PRIVATE_URL = `https://store.private.blob.vercel-storage.com/families/${FAMILY_ID}/library/math%20page.pdf`;

test("accepts only the exact family and upload space on Vercel Blob", () => {
  assert.equal(isFamilyBlobUrl(PUBLIC_URL, FAMILY_ID, "chat"), true);
  assert.equal(isFamilyBlobUrl(PRIVATE_URL, FAMILY_ID, "library"), true);
  assert.equal(isFamilyBlobUrl(PUBLIC_URL, OTHER_FAMILY_ID, "chat"), false);
  assert.equal(isFamilyBlobUrl(PUBLIC_URL, FAMILY_ID, "library"), false);
  assert.equal(
    isFamilyBlobUrl(
      `https://store.public.blob.vercel-storage.com/families/${FAMILY_ID}-extra/chat/file.png`,
      FAMILY_ID,
      "chat"
    ),
    false
  );
  assert.equal(
    isFamilyBlobUrl(
      `https://example.com/families/${FAMILY_ID}/chat/file.png`,
      FAMILY_ID,
      "chat"
    ),
    false
  );
});

test("recognizes private hosts and preserves public transition URLs", () => {
  assert.equal(isPrivateFamilyBlobUrl(PRIVATE_URL), true);
  assert.equal(isPrivateFamilyBlobUrl(PUBLIC_URL), false);
  assert.equal(familyBlobBrowserUrl(PUBLIC_URL), PUBLIC_URL);
  assert.equal(
    familyBlobBrowserUrl(PRIVATE_URL),
    `/api/family-files?url=${encodeURIComponent(PRIVATE_URL)}`
  );
});

test("returns the decoded object pathname without query parameters", () => {
  assert.equal(
    familyBlobPathname(`${PRIVATE_URL}?download=1`),
    `families/${FAMILY_ID}/library/math page.pdf`
  );
  assert.equal(familyBlobPathname("https://example.com/file.pdf"), null);
});

test("a signed read link canonicalizes to the stored URL", () => {
  assert.equal(
    canonicalFamilyBlobUrl(
      `${PRIVATE_URL}?cache=0&vercel-blob-delegation=abc.def&vercel-blob-signature=xyz#page=2`
    ),
    PRIVATE_URL
  );
  assert.equal(canonicalFamilyBlobUrl(PUBLIC_URL), PUBLIC_URL);
  assert.equal(canonicalFamilyBlobUrl("not a url"), null);
});
