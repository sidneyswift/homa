import assert from "node:assert/strict";
import test from "node:test";

import { fetchBoundedAssetBytes, fetchFamilyAssetBytes } from "./family-asset-bytes";
import { FAMILY_PDF_MAX_BYTES, FAMILY_PDF_EXTRACTION_VERSION, familyAssetReadableByteLimit } from "./family-asset-read-contract";
import { familyAssetProcessingRetryAvailable } from "./family-assets";

function stream(size: number, declared?: number) {
  let remaining = size;
  let cancelled = false;
  return {
    fetch: (async () => new Response(new ReadableStream({
      pull(controller) {
        if (!remaining) { controller.close(); return; }
        const count = Math.min(1024 * 1024, remaining); remaining -= count;
        controller.enqueue(new Uint8Array(count));
      }, cancel() { cancelled = true; },
    }), { headers: declared === undefined ? {} : { "Content-Length": String(declared) } })) as typeof fetch,
    cancelled: () => cancelled,
  };
}

test("PDFs accept the observed originals and exact 64 MiB, while other files stay 32 MiB", async () => {
  assert.equal(familyAssetReadableByteLimit("application/pdf; version=1.7"), FAMILY_PDF_MAX_BYTES);
  assert.equal(familyAssetReadableByteLimit("text/plain"), 32 * 1024 * 1024);
  for (const size of [32 * 1024 * 1024, 43_261_422, 49_496_583, FAMILY_PDF_MAX_BYTES]) {
    const result = await fetchBoundedAssetBytes("https://fixture.invalid", FAMILY_PDF_MAX_BYTES, AbortSignal.timeout(10_000), stream(size).fetch);
    assert.ok(result.ok); assert.equal(result.bytes.length, size); assert.match(result.sha256, /^[a-f0-9]{64}$/);
  }
});

test("actual streamed count rejects lying headers and early headers cancel oversized bodies", async () => {
  for (const declared of [undefined, 1, FAMILY_PDF_MAX_BYTES + 1]) {
    const source = stream(FAMILY_PDF_MAX_BYTES + 1, declared);
    const result = await fetchBoundedAssetBytes("https://fixture.invalid", FAMILY_PDF_MAX_BYTES, AbortSignal.timeout(10_000), source.fetch);
    assert.deepEqual(result, { ok: false, reason: "too_large" });
    if (declared !== undefined && declared > FAMILY_PDF_MAX_BYTES) assert.equal(source.cancelled(), true);
  }
  assert.deepEqual(await fetchBoundedAssetBytes("https://fixture.invalid", 32 * 1024 * 1024,
    AbortSignal.timeout(10_000), stream(43_261_422).fetch), { ok: false, reason: "too_large" });
});

test("zero bytes, interrupted reads and foreign URLs never become readable", async () => {
  assert.deepEqual(await fetchBoundedAssetBytes("https://fixture.invalid", 10, AbortSignal.timeout(1000), stream(0).fetch), { ok: false, reason: "corrupt" });
  const controller = new AbortController();
  const pending = fetchBoundedAssetBytes("https://fixture.invalid", 10, controller.signal,
    (async () => new Response(new ReadableStream({ pull: () => new Promise(() => {}) }))) as typeof fetch);
  setTimeout(() => controller.abort(), 5);
  assert.deepEqual(await pending, { ok: false, reason: "transient" });
  assert.deepEqual(await fetchFamilyAssetBytes({ familyId: "family-a", url: "https://attacker.invalid/original.pdf", mediaType: "application/pdf" }, AbortSignal.timeout(100)), { ok: false, reason: "corrupt" });
});

test("only the upgraded PDF capability reopens historic too-large and unreadable retries", () => {
  const asset = { status: "needs_attention" as const, processingErrorCode: "content_too_large_to_process", updatedAt: "2026-09-01", mediaType: "application/pdf", byteSize: 49_496_583, processingVersion: null as string | null };
  assert.equal(familyAssetProcessingRetryAvailable(asset), true);
  assert.equal(familyAssetProcessingRetryAvailable({ ...asset, processingErrorCode: "content_unreadable" }), true);
  assert.equal(familyAssetProcessingRetryAvailable({ ...asset, processingVersion: FAMILY_PDF_EXTRACTION_VERSION }), false);
  assert.equal(familyAssetProcessingRetryAvailable({ ...asset, byteSize: 500 * 1024 * 1024 }), false);
  assert.equal(familyAssetProcessingRetryAvailable({ ...asset, mediaType: "application/zip" }), false);
  assert.equal(familyAssetProcessingRetryAvailable({ ...asset, processingErrorCode: "content_encrypted" }), false);
});
