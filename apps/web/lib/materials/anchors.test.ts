import assert from "node:assert/strict";
import { test } from "node:test";

import {
  decodeStudioAnchorBytes,
  embeddedAnchorIds,
  getStudioAnchor,
  listStudioAnchors,
  studioAnchorIds,
} from "./anchors";

test("anchor ids are unique", () => {
  const ids = studioAnchorIds();
  assert.equal(new Set(ids).size, ids.length);
});

test("registry and embedded bytes are in exact parity", () => {
  // No registry entry without bytes, no orphan bytes without a registry
  // entry. A drifting pair would let an id resolve to nothing (or hide an
  // unlisted asset), so keep them locked together.
  const registry = [...studioAnchorIds()].sort();
  const embedded = [...embeddedAnchorIds()].sort();
  assert.deepEqual(embedded, registry);
});

test("every anchor decodes to non-empty JPEG bytes", () => {
  for (const id of studioAnchorIds()) {
    const bytes = decodeStudioAnchorBytes(id);
    assert.ok(bytes, `anchor ${id} decodes to bytes`);
    assert.ok(bytes.byteLength > 1024, `anchor ${id} is non-trivial`);
    // JPEG magic number: FF D8.
    assert.equal(bytes[0], 0xff, `anchor ${id} starts with JPEG marker`);
    assert.equal(bytes[1], 0xd8, `anchor ${id} starts with JPEG marker`);
  }
});

test("metadata is well-formed for every anchor", () => {
  for (const anchor of listStudioAnchors()) {
    assert.ok(anchor.title.length > 0, `${anchor.id} has a title`);
    assert.ok(anchor.useWhen.length > 0, `${anchor.id} has a useWhen`);
    assert.ok(
      anchor.register === "playful" || anchor.register === "restrained",
      `${anchor.id} has a valid register`,
    );
    assert.equal(anchor.mediaType, "image/jpeg");
  }
});

test("the expected anchors exist (guards renames)", () => {
  assert.ok(getStudioAnchor("order-of-operations-chart"));
  assert.ok(getStudioAnchor("five-paragraph-essay-outline"));
});

test("an unknown id resolves to nothing (only registry ids are trusted)", () => {
  assert.equal(getStudioAnchor("not-a-real-anchor"), undefined);
  assert.equal(decodeStudioAnchorBytes("not-a-real-anchor"), null);
  // A URL-shaped id must never resolve through the anchor path.
  assert.equal(
    decodeStudioAnchorBytes("https://evil.example.com/x.png"),
    null,
  );
  assert.equal(decodeStudioAnchorBytes(""), null);
});
