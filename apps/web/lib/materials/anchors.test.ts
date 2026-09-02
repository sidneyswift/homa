import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { mock, test } from "node:test";

import { ANCHOR_MANIFEST } from "./anchor-manifest.generated";
import {
  getStudioAnchor,
  listStudioAnchors,
  loadStudioAnchorBytes,
  manifestAnchorIds,
  studioAnchorIds,
  studioAnchorUrl,
} from "./anchors";
import { FLEET_ANCHOR_BLOB_PATH_PREFIX, isFleetAnchorUrl } from "./artifact-store";
import { MAX_REFERENCE_BYTES } from "./reference-limits";

const SOURCES_DIR = path.join(import.meta.dirname, "anchor-sources");

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

test("anchor ids are unique", () => {
  const ids = studioAnchorIds();
  assert.equal(new Set(ids).size, ids.length);
});

test("registry and manifest are in exact parity", () => {
  // No registry entry without a manifest row, no orphan row without a
  // registry entry. A drifting pair would let an id resolve to nothing (or
  // hide an unlisted asset), so keep them locked together.
  const registry = [...studioAnchorIds()].sort();
  const manifest = [...manifestAnchorIds()].sort();
  assert.deepEqual(manifest, registry);
});

test("every manifest entry is well-formed and content-addressed", () => {
  for (const [id, entry] of Object.entries(ANCHOR_MANIFEST)) {
    assert.match(entry.sha256, /^[0-9a-f]{64}$/, `${id} sha256 is 64 lowercase hex`);
    assert.ok(Number.isInteger(entry.bytes) && entry.bytes > 1024, `${id} is non-trivial`);
    assert.ok(entry.bytes <= MAX_REFERENCE_BYTES, `${id} fits the reference byte cap`);
    assert.equal(entry.mediaType, "image/jpeg");
    assert.ok(isFleetAnchorUrl(entry.url), `${id} url passes isFleetAnchorUrl: ${entry.url}`);
    // The key carries the first 12 hex of the sha256, so a replaced anchor
    // is a new key and a deployed build keeps resolving its own manifest.
    assert.equal(
      new URL(entry.url).pathname,
      `${FLEET_ANCHOR_BLOB_PATH_PREFIX}${id}-${entry.sha256.slice(0, 12)}.jpg`,
      `${id} url is content-addressed`,
    );
    assert.equal(studioAnchorUrl(id), entry.url);
  }
});

test("every anchor-sources/*.jpg matches its manifest entry (a stale manifest fails)", () => {
  const sourceFiles = readdirSync(SOURCES_DIR)
    .filter((name) => !name.startsWith("."))
    .sort();
  const sourceIds = sourceFiles.map((name) => {
    const match = /^([a-z0-9-]+)\.jpg$/.exec(name);
    assert.ok(match, `anchor-sources/${name} is a lowercase <id>.jpg`);
    return match[1];
  });
  assert.deepEqual(sourceIds, [...manifestAnchorIds()].sort());

  for (const [index, name] of sourceFiles.entries()) {
    const id = sourceIds[index];
    const bytes = readFileSync(path.join(SOURCES_DIR, name));
    const entry = ANCHOR_MANIFEST[id];
    // JPEG magic number: FF D8.
    assert.equal(bytes[0], 0xff, `anchor ${id} starts with JPEG marker`);
    assert.equal(bytes[1], 0xd8, `anchor ${id} starts with JPEG marker`);
    assert.equal(bytes.length, entry.bytes, `anchor ${id} byte count matches the manifest`);
    assert.equal(
      sha256Hex(bytes),
      entry.sha256,
      `anchor ${id} sha256 matches the manifest (run pnpm build:material-anchors)`,
    );
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

test("the expected anchors exist (guards renames and dropped folds)", () => {
  for (const id of [
    "order-of-operations-chart",
    "five-paragraph-essay-outline",
    "foldable",
    "hive-puzzle",
    "singapore-workbook-page",
    "unit-study-packet",
  ]) {
    assert.ok(getStudioAnchor(id), `anchor ${id} is registered`);
  }
  // The folded-in library should not silently shrink.
  assert.ok(studioAnchorIds().length >= 19, "at least 19 anchors registered");
});

test("an unknown id resolves to nothing (only registry ids are trusted)", async () => {
  for (const id of [
    "not-a-real-anchor",
    // A URL-shaped id must never resolve through the anchor path.
    "https://evil.example.com/x.png",
    "",
    // Prototype keys are not anchors either.
    "constructor",
  ]) {
    assert.equal(getStudioAnchor(id), undefined);
    assert.equal(studioAnchorUrl(id), null);
    assert.equal(await loadStudioAnchorBytes(id), null);
  }
});

/**
 * A fetch stand-in for the loader tests: `respond` decides what one call
 * returns (or throws), and the mock honors the loader's abort signal so a
 * timeout test can run against a real AbortSignal.timeout with a tiny
 * budget. Registered anchors that no other test has loaded successfully
 * are used below, because the loader memoizes successes module-wide.
 */
function mockAnchorFetch(
  respond: (init: RequestInit | undefined) => Promise<Response> | Response,
) {
  return mock.method(
    globalThis,
    "fetch",
    (_input: string | URL | Request, init?: RequestInit) => respond(init),
  );
}

test("a non-ok response returns null and is not memoized", async () => {
  const warn = mock.method(console, "warn", () => {});
  let status = 404;
  const fetchMock = mockAnchorFetch(() => new Response(null, { status }));
  try {
    assert.equal(await loadStudioAnchorBytes("hive-puzzle"), null, "404 is null");
    status = 500;
    assert.equal(await loadStudioAnchorBytes("hive-puzzle"), null, "500 is null");
    // Not memoized: the second call fetched again instead of replaying.
    assert.equal(fetchMock.mock.callCount(), 2);
    assert.equal(warn.mock.callCount(), 2);
    assert.equal(await loadStudioAnchorBytes("hive-puzzle"), null);
    assert.equal(fetchMock.mock.callCount(), 3, "a failure is retried on the next call");
  } finally {
    fetchMock.mock.restore();
    warn.mock.restore();
  }
});

test("a fetch that throws or times out returns null and never throws out of the loader", async () => {
  const warn = mock.method(console, "warn", () => {});
  const throwing = mockAnchorFetch(() => {
    throw new TypeError("fetch failed");
  });
  try {
    assert.equal(await loadStudioAnchorBytes("geometry-maze"), null);
    assert.equal(throwing.mock.callCount(), 1);
  } finally {
    throwing.mock.restore();
  }

  // A fetch that only settles when the loader's own signal aborts: with a
  // 5 ms budget the loader gives up deterministically and reports it.
  const hanging = mockAnchorFetch(
    (init) =>
      new Promise<Response>((_resolve, rejectFetch) => {
        const signal = init?.signal;
        assert.ok(signal, "the loader passes an abort signal");
        signal.addEventListener("abort", () => rejectFetch(signal.reason), { once: true });
      }),
  );
  try {
    assert.equal(
      await loadStudioAnchorBytes("geometry-maze", { timeoutMs: 5 }),
      null,
    );
    assert.equal(hanging.mock.callCount(), 1);
    assert.match(String(warn.mock.calls.at(-1)?.arguments[0]), /fetch failed: .*[Tt]imeout/);
  } finally {
    hanging.mock.restore();
    warn.mock.restore();
  }
});

test("an oversize body returns null, whether Content-Length says so or the bytes do", async () => {
  const warn = mock.method(console, "warn", () => {});
  const declared = mockAnchorFetch(
    () =>
      new Response(new Uint8Array(16), {
        status: 200,
        headers: { "content-length": String(MAX_REFERENCE_BYTES + 1) },
      }),
  );
  try {
    assert.equal(await loadStudioAnchorBytes("decimal-path-puzzle"), null);
    assert.match(String(warn.mock.calls.at(-1)?.arguments[0]), /Content-Length/);
  } finally {
    declared.mock.restore();
  }

  // A streamed body carries no Content-Length, so only the post-read
  // length check can catch it.
  const oversize = new Uint8Array(MAX_REFERENCE_BYTES + 1);
  const streamed = mockAnchorFetch(() => {
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(oversize);
          controller.close();
        },
      }),
      { status: 200 },
    );
    assert.equal(response.headers.get("content-length"), null);
    return response;
  });
  try {
    assert.equal(await loadStudioAnchorBytes("decimal-path-puzzle"), null);
    assert.match(String(warn.mock.calls.at(-1)?.arguments[0]), /over the reference cap/);
    assert.equal(streamed.mock.callCount(), 1);
  } finally {
    streamed.mock.restore();
    warn.mock.restore();
  }
});

test("the loader verifies fetched bytes against the manifest and memoizes a success", async () => {
  const id = "foldable";
  const entry = ANCHOR_MANIFEST[id];
  const real = readFileSync(path.join(SOURCES_DIR, `${id}.jpg`));
  const warn = mock.method(console, "warn", () => {});
  let served: Uint8Array = real.subarray(0, real.length - 1);
  const fetchMock = mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    assert.equal(String(input), entry.url);
    return new Response(new Uint8Array(served), { status: 200 });
  });
  try {
    // Wrong byte count: dropped, never softened.
    assert.equal(await loadStudioAnchorBytes(id), null);
    // Right length, wrong content: the sha256 check catches it.
    served = new Uint8Array(real.length);
    assert.equal(await loadStudioAnchorBytes(id), null);
    assert.equal(fetchMock.mock.callCount(), 2);
    assert.equal(warn.mock.callCount(), 2);

    served = real;
    const bytes = await loadStudioAnchorBytes(id);
    assert.ok(bytes);
    assert.equal(sha256Hex(bytes), entry.sha256);
    assert.equal(fetchMock.mock.callCount(), 3);

    // Memoized: a warm instance fetches each anchor once.
    assert.equal(await loadStudioAnchorBytes(id), bytes);
    assert.equal(fetchMock.mock.callCount(), 3);
  } finally {
    fetchMock.mock.restore();
    warn.mock.restore();
  }
});
