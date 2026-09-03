import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ANCHOR_MANIFEST } from "./anchor-manifest.generated";
import { getStudioAnchor, manifestAnchorIds, studioAnchorIds } from "./anchors";
import { loadReviewAnchor, REVIEW_ANCHOR_MAX_BYTES } from "./review-anchor";

/**
 * The reviewer's anchor loads fail open (2026-09-02). A reference image
 * exists to make the reviewer's size comparison honest; it must never be
 * the reason a family's page is not reviewed or not delivered. Every
 * test here is one way a load can go wrong, and the assertion is the
 * same each time: a skip reason comes back, nothing throws. Anchors live
 * in Blob now, so every case injects its loader; nothing here touches
 * the network.
 */

const REAL_ANCHOR_ID = "letter-number-formation-practice";
const FAKE_JPEG = new Uint8Array(2048).fill(0x42);

describe("loadReviewAnchor", () => {
  it("returns the loader's bytes with the registry's title and media type on success", async () => {
    const result = await loadReviewAnchor(REAL_ANCHOR_ID, async () => FAKE_JPEG);
    assert.ok(result.anchor, "a registered anchor with bytes loads");
    assert.equal(result.anchor.id, REAL_ANCHOR_ID);
    assert.equal(result.anchor.mediaType, "image/jpeg");
    assert.equal(result.anchor.title, getStudioAnchor(REAL_ANCHOR_ID)?.title);
    assert.equal(result.anchor.data, FAKE_JPEG);
    assert.equal(result.skipped, undefined);
  });

  it("skips as missing when the id is not a registered anchor, without calling the loader", async () => {
    let called = false;
    const result = await loadReviewAnchor("https://evil.example.com/x.png", async () => {
      called = true;
      return new Uint8Array([1]);
    });
    assert.deepEqual(result, { anchor: null, skipped: "missing" });
    assert.equal(called, false, "an unregistered id never reaches storage");
  });

  it("skips as load-failed, not missing, when a registered anchor's loader has no bytes", async () => {
    // loadStudioAnchorBytes never throws; a fetch, size, or digest
    // failure comes back as null. Reading that as "missing" would make
    // every Blob outage look like an unregistered id in the record.
    const result = await loadReviewAnchor(REAL_ANCHOR_ID, async () => null);
    assert.deepEqual(result, { anchor: null, skipped: "load-failed" });
    const empty = await loadReviewAnchor(REAL_ANCHOR_ID, async () => new Uint8Array(0));
    assert.deepEqual(empty, { anchor: null, skipped: "load-failed" });
  });

  it("skips as load-failed when the loader throws, instead of rejecting", async () => {
    const result = await loadReviewAnchor(REAL_ANCHOR_ID, async () => {
      throw new Error("blob store unreachable");
    });
    assert.deepEqual(result, { anchor: null, skipped: "load-failed" });
  });

  it("skips as timeout when the loader is slower than the deadline", async () => {
    const result = await loadReviewAnchor(
      REAL_ANCHOR_ID,
      () => new Promise((resolve) => setTimeout(() => resolve(new Uint8Array([1, 2, 3])), 200)),
      10,
    );
    assert.deepEqual(result, { anchor: null, skipped: "timeout" });
  });

  it("skips as too-large when the bytes are past the reviewer's cap", async () => {
    const result = await loadReviewAnchor(
      REAL_ANCHOR_ID,
      async () => new Uint8Array(REVIEW_ANCHOR_MAX_BYTES + 1),
    );
    assert.deepEqual(result, { anchor: null, skipped: "too-large" });
  });

  it("never rejects, whichever way the loader misbehaves", async () => {
    const loaders = [
      async () => null,
      async () => {
        throw new Error("boom");
      },
      () => Promise.reject(new TypeError("not even an Error path")),
      () => new Promise<Uint8Array | null>(() => undefined),
    ];
    for (const loader of loaders) {
      await assert.doesNotReject(() => loadReviewAnchor(REAL_ANCHOR_ID, loader, 10));
    }
  });

  it("has a manifest entry under the reviewer's byte cap for every registered anchor", () => {
    // Manifest parity instead of a live fetch: the registry says which
    // anchors exist, the manifest says what Blob holds and how big each
    // is. A registered anchor with no manifest entry, or one past the
    // reviewer's cap, would be skipped as missing or too-large on every
    // review of that format without anything failing loudly.
    const manifest = new Set(manifestAnchorIds());
    for (const id of studioAnchorIds()) {
      assert.ok(manifest.has(id), `anchor ${id} has no manifest entry`);
      assert.ok(
        ANCHOR_MANIFEST[id].bytes <= REVIEW_ANCHOR_MAX_BYTES,
        `anchor ${id} is ${ANCHOR_MANIFEST[id].bytes} bytes, past the reviewer's cap`,
      );
    }
  });
});
