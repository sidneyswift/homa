import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { studioAnchorIds } from "./anchors";
import { loadReviewAnchor, REVIEW_ANCHOR_MAX_BYTES } from "./review-anchor";

/**
 * The reviewer's anchor loads fail open (2026-09-02). A reference image
 * exists to make the reviewer's size comparison honest; it must never be
 * the reason a family's page is not reviewed or not delivered. Every
 * test here is one way a load can go wrong, and the assertion is the
 * same each time: a skip reason comes back, nothing throws.
 */

const REAL_ANCHOR_ID = "letter-number-formation-practice";

describe("loadReviewAnchor", () => {
  it("returns the registered anchor's bytes, title, and media type on success", async () => {
    const result = await loadReviewAnchor(REAL_ANCHOR_ID);
    assert.ok(result.anchor, "the embedded anchor loads");
    assert.equal(result.anchor.id, REAL_ANCHOR_ID);
    assert.equal(result.anchor.mediaType, "image/jpeg");
    assert.ok(result.anchor.title.length > 0);
    assert.ok(result.anchor.data.byteLength > 1024);
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

  it("skips as missing when the loader has no bytes", async () => {
    const result = await loadReviewAnchor(REAL_ANCHOR_ID, async () => null);
    assert.deepEqual(result, { anchor: null, skipped: "missing" });
    const empty = await loadReviewAnchor(REAL_ANCHOR_ID, async () => new Uint8Array(0));
    assert.deepEqual(empty, { anchor: null, skipped: "missing" });
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

  it("loads every registered anchor under the byte cap, so the cap never silently hides one", async () => {
    for (const id of studioAnchorIds()) {
      const result = await loadReviewAnchor(id);
      assert.ok(result.anchor, `anchor ${id} loads for the reviewer (${result.skipped ?? "ok"})`);
    }
  });
});
