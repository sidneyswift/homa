import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { validCanvasSize } from "../materials/rasterize-pdf";
import { readFamilyPdf, type FamilyPdfReaderDependencies } from "./family-pdf-reader";
import { curriculumPdfFixture } from "./pdf-read-fixture";
import type { PdfPageRead } from "./family-asset-read-contract";
import { PdfTranscriptionError } from "./pdf-page-transcription";

const asset = { id: "11111111-1111-4111-8111-111111111111", familyId: "22222222-2222-4222-8222-222222222222", url: "https://fixture.invalid/original.pdf", mediaType: "application/pdf" };
function fixture(bytes: Buffer) {
  const pages = new Map<string, PdfPageRead>(); const leases = new Map<string, string>();
  const key = (sha: string, ordinal: number) => `${sha}:${ordinal}`;
  let modelCalls = 0;
  const deps: FamilyPdfReaderDependencies = {
    download: async () => ({ ok: true, bytes, sha256: createHash("sha256").update(bytes).digest("hex") }),
    cache: {
      bind: async () => true,
      get: async (source, ordinal) => pages.get(key(source.sha256, ordinal)) ?? null,
      claim: async (source, ordinal) => { const k = key(source.sha256, ordinal); if (leases.has(k)) return null; leases.set(k, "lease"); return "lease"; },
      complete: async (source, page) => { pages.set(key(source.sha256, page.ordinal), page); return true; },
      release: async (source, ordinal) => { leases.delete(key(source.sha256, ordinal)); },
    },
    transcribe: async ({ jpeg }) => { assert.equal(jpeg.readUInt16BE(), 0xffd8); modelCalls++; return { text: "Lesson 7: Count six shells.", state: "readable", method: "vision", model: "fixture", gaps: [] }; },
  };
  const read = (startOrdinal = 1, maxPages = 8, extra = {}) => readFamilyPdf(asset, {
    startOrdinal, maxPages, maxChars: 32_000, maxUncachedOcr: 1, signal: AbortSignal.timeout(10_000), ...extra,
  }, deps);
  return { read, deps, calls: () => modelCalls, cached: () => [...pages.values()], leases: () => leases.size };
}

const timeout = () => new PdfTranscriptionError({ reason: "timeout", elapsedMs: 40_000, providerStatus: null });

test("a later transcription timeout returns only completed evidence and keeps the missing page retryable", async () => {
  const f = fixture(curriculumPdfFixture([{ text: "Teacher guide" }, { text: "Reading list" }, { scan: "Dense lesson" }, { scan: "Later lesson" }]));
  const transcribe = f.deps.transcribe;
  let attempted = 0;
  f.deps.transcribe = async () => { attempted++; throw timeout(); };
  const partial = await f.read(); assert.ok(partial.ok);
  assert.deepEqual(partial.segments.map(page => page.ordinal), [1, 2]);
  assert.equal(partial.nextCursor, 3); assert.equal(partial.truncated, true);
  assert.deepEqual(partial.stoppedAt, { ordinal: 3, failure: timeout().failure });
  assert.match(partial.coverageNote, /could not finish reading PDF page 3/);
  assert.equal(attempted, 1); assert.equal(f.leases(), 0);
  assert.deepEqual(f.cached().map(page => page.ordinal), [1, 2]);
  f.deps.transcribe = transcribe;
  const recovered = await f.read(3, 1); assert.ok(recovered.ok);
  assert.equal(recovered.segments[0].ordinal, 3);
  const replay = await f.read(3, 1); assert.ok(replay.ok);
  assert.deepEqual(replay.segments, recovered.segments); assert.equal(f.calls(), 1);
});

test("an exact-page timeout fails without claiming that page was read", async () => {
  const f = fixture(curriculumPdfFixture([{ scan: "Dense lesson" }]));
  f.deps.transcribe = async () => { throw timeout(); };
  assert.deepEqual(await f.read(), { ok: false, reason: "transient", failure: timeout().failure });
  assert.equal(f.cached().length, 0); assert.equal(f.leases(), 0);
});

test("an actual later API failure preserves prior text, while blank earlier pages cannot hide a failure", async () => {
  const providerFailure = new PdfTranscriptionError({ reason: "provider", elapsedMs: 100, providerStatus: 503 });
  const readable = fixture(curriculumPdfFixture([{ text: "Prior evidence" }, { scan: "Next page" }]));
  readable.deps.transcribe = async () => { throw providerFailure; };
  const result = await readable.read(); assert.ok(result.ok);
  assert.deepEqual(result.stoppedAt, { ordinal: 2, failure: providerFailure.failure });
  assert.equal(result.nextCursor, 2); assert.equal(readable.leases(), 0);
  const blank = fixture(curriculumPdfFixture([{}, { scan: "Next page" }]));
  let attempts = 0;
  blank.deps.transcribe = async () => {
    if (attempts++ === 0) return { text: "", state: "blank", method: "vision", model: "fixture", gaps: [] };
    throw providerFailure;
  };
  assert.deepEqual(await blank.read(1, 8, { maxUncachedOcr: 2 }), { ok: false, reason: "transient", failure: providerFailure.failure });
  assert.deepEqual(blank.cached().map(page => page.state), ["blank"]); assert.equal(blank.leases(), 0);
});

test("partial evidence does not hide parent abort, invalid output, source loss, storage errors or parser limits", async () => {
  for (const failure of ["abort", "recheck-abort", "invalid", "unknown", "source", "release", "complete", "parser"] as const) {
    const f = fixture(curriculumPdfFixture([{ text: "Prior evidence" }, { scan: "Next page", ...(failure === "parser" ? { width: 100_000 } : {}) }]));
    const controller = new AbortController();
    const get = f.deps.cache.get;
    let stopped = false;
    f.deps.cache.get = async (source, ordinal) => {
      if (failure === "recheck-abort" && stopped) controller.abort();
      return failure === "source" && stopped ? null : get(source, ordinal);
    };
    if (failure === "release") {
      const release = f.deps.cache.release;
      f.deps.cache.release = async (source, ordinal, lease) => {
        if (ordinal === 2) throw new Error("Database unavailable");
        await release(source, ordinal, lease);
      };
    }
    if (failure === "complete") {
      const complete = f.deps.cache.complete;
      f.deps.cache.complete = async (source, page, lease) => page.ordinal === 2 ? false : complete(source, page, lease);
    } else f.deps.transcribe = async () => {
      stopped = true;
      if (failure === "abort") controller.abort();
      if (failure === "unknown") throw new Error("Unexpected failure");
      throw new PdfTranscriptionError({ reason: failure === "invalid" ? "invalid-output" : "timeout", elapsedMs: 1, providerStatus: null });
    };
    const result = await f.read(1, 8, { signal: controller.signal });
    assert.equal(result.ok, false, failure);
    assert.deepEqual(f.cached().map(page => page.ordinal), [1], failure);
  }
});

test("mixed PDF reads preserve ordinals, bound new OCR, and repeat canonical text", async () => {
  const f = fixture(curriculumPdfFixture([{ text: "Contents" }, { scan: "Lesson 7: Count six shells." }, { scan: "Lesson 8: Sort shells." }]));
  const first = await f.read(); assert.ok(first.ok);
  assert.deepEqual(first.segments.map(page => [page.ordinal, page.method]), [[1, "embedded"], [2, "vision"]]);
  assert.equal(first.nextCursor, 3); assert.equal(f.calls(), 1);
  const again = await f.read(1, 2); assert.ok(again.ok);
  assert.deepEqual(again.segments, first.segments); assert.equal(f.calls(), 1);
  const later = await f.read(3); assert.ok(later.ok); assert.equal(later.segments[0].ordinal, 3); assert.equal(f.calls(), 2);
});

test("late pages render exactly the requested scan and page 241 is an explicit limit", async () => {
  const f = fixture(curriculumPdfFixture(Array.from({ length: 241 }, (_, index) => index === 120 || index === 239 ? { scan: "Lesson 7" } : { text: `Page ${index + 1}` })));
  for (const ordinal of [121, 240]) {
    const result = await f.read(ordinal, 1); assert.ok(result.ok);
    assert.equal(result.segments[0].ordinal, ordinal); assert.equal(result.segments[0].method, "vision");
  }
  assert.equal(f.calls(), 2);
  const limited = await f.read(241); assert.ok(limited.ok);
  assert.deepEqual(limited.segments, []); assert.equal(limited.truncated, true); assert.match(limited.coverageNote, /outside the readable scope/);
});

test("cached quote verification includes read later pages but marks missing pages incomplete", async () => {
  const f = fixture(curriculumPdfFixture([{ scan: "First" }, { scan: "Second" }, { scan: "Lesson 7" }]));
  await f.read(3, 1);
  const verified = await f.read(1, 240, { cachedOnly: true }); assert.ok(verified.ok);
  assert.deepEqual(verified.segments.map(page => page.ordinal), [3]); assert.equal(verified.truncated, true);
  assert.equal(verified.nextCursor, 1); assert.equal(f.calls(), 1);
});

test("dense embedded pages stop at the text limit and retain an explicit gap", async () => {
  const f = fixture(curriculumPdfFixture([{ text: "Dense source text with exact words.", textRepeats: 2_000 }]));
  const result = await f.read(); assert.ok(result.ok);
  assert.equal(result.segments[0].text.length, 32_000);
  assert.equal(result.segments[0].state, "partial"); assert.equal(result.truncated, true);
  assert.equal(f.calls(), 0);
});

test("verification stays partial when its text budget omits cached or unknown pages", async () => {
  const f = fixture(curriculumPdfFixture(Array.from({ length: 40 }, () => ({ text: "Source" }))));
  f.deps.cache.get = async (_source, ordinal) => ordinal === 40 ? null : ({
    ordinal, locator: `Page ${ordinal}`, text: "a".repeat(30_000), state: "readable",
    method: "embedded", model: null, gaps: [],
  });
  const result = await f.read(1, 240, { cachedOnly: true, maxChars: 1_000_000 });
  assert.ok(result.ok); assert.equal(result.segments.length, 33);
  assert.equal(result.nextCursor, 34); assert.equal(result.truncated, true);
  assert.equal(f.calls(), 0);
});

test("blank and unreadable scans retain explicit states rather than successful empty text", async () => {
  const f = fixture(curriculumPdfFixture([{}]));
  f.deps.transcribe = async () => ({ text: "", state: "blank", method: "vision", model: "fixture", gaps: [] });
  const blank = await f.read(); assert.ok(blank.ok); assert.equal(blank.segments[0].state, "blank");
  assert.equal(blank.segments[0].text, "");
  const unreadableFixture = fixture(curriculumPdfFixture([{ scan: "Blurred" }]));
  unreadableFixture.deps.transcribe = async () => ({ text: "", state: "unreadable", method: "vision", model: "fixture", gaps: ["Page is too blurred to read."] });
  const unreadable = await unreadableFixture.read(); assert.ok(unreadable.ok);
  assert.equal(unreadable.segments[0].state, "unreadable"); assert.equal(unreadable.truncated, true);
});

test("rotated scans render a landscape page and preserve PDF ordinal", async () => {
  const f = fixture(curriculumPdfFixture([{ scan: "Rotate this lesson", rotation: 90 }]));
  f.deps.transcribe = async ({ jpeg }) => {
    // JPEG SOF carries the actual rendered orientation, not a mocked page API.
    let dimensions: [number, number] | undefined;
    for (let index = 0; index < jpeg.length - 9; index++) {
      if (jpeg[index] === 0xff && (jpeg[index + 1] === 0xc0 || jpeg[index + 1] === 0xc2)) {
        dimensions = [jpeg.readUInt16BE(index + 7), jpeg.readUInt16BE(index + 5)]; break;
      }
    }
    assert.ok(dimensions); assert.ok(dimensions[0] > dimensions[1]);
    return { text: "Rotated lesson", state: "readable", method: "vision", model: "fixture", gaps: [] };
  };
  const result = await f.read(); assert.ok(result.ok); assert.equal(result.segments[0].ordinal, 1);
});

test("abort stops model work and releases the unfinished lease for a fresh read", async () => {
  const f = fixture(curriculumPdfFixture([{ scan: "Lesson 7" }]));
  const controller = new AbortController();
  const original = f.deps.transcribe;
  f.deps.transcribe = async ({ signal }) => {
    controller.abort();
    signal.throwIfAborted();
    throw new Error("Aborted transcription must not return text");
  };
  assert.deepEqual(await f.read(1, 8, { signal: controller.signal }), { ok: false, reason: "transient" });
  f.deps.transcribe = original;
  const result = await f.read(); assert.ok(result.ok); assert.equal(f.calls(), 1);
  assert.deepEqual(await f.read(1, 8, { signal: AbortSignal.abort() }), { ok: false, reason: "transient" });
  assert.equal(f.calls(), 1);
});

test("encrypted, corrupt and oversized PDF inputs fail without OCR", async () => {
  for (const [bytes, expected] of [
    [curriculumPdfFixture([{ text: "Protected" }], true), "encrypted"],
    [Buffer.from("not a PDF"), "corrupt"],
    [curriculumPdfFixture([{ width: 100_000, scan: "Huge page" }]), "transient"],
    [curriculumPdfFixture([{ scan: "Huge image", imageWidth: 60_000 }]), "transient"],
    [curriculumPdfFixture([{ scan: "JPEG header contradicts PDF dimensions", imageHeaderWidth: 60_000 }]), "transient"],
  ] as const) {
    const f = fixture(bytes); const result = await f.read();
    assert.deepEqual(result, { ok: false, reason: expected }); assert.equal(f.calls(), 0);
  }
  assert.equal(validCanvasSize(Infinity, 5), false); assert.equal(validCanvasSize(8000, 8000), false);
});

test("compressed giant literal text fails before expansion can exhaust the process", async () => {
  const bytes = curriculumPdfFixture([{ text: "A".repeat(24_000_000), compressed: true }]);
  assert.ok(bytes.length < 30_000, "the regression is a tiny compressed original");
  const f = fixture(bytes);
  assert.deepEqual(await f.read(), { ok: false, reason: "transient" });
  assert.equal(f.calls(), 0);
});

test("decoded streams and aggregate in-bound images fail closed at their allocation budgets", async () => {
  const sharedDecoded = Buffer.alloc(24 * 1024 * 1024, 32);
  for (const bytes of [
    curriculumPdfFixture([{ rawContent: Buffer.alloc(33 * 1024 * 1024, 32), compressed: true }]),
    curriculumPdfFixture([{ contentStreams: Array(8).fill(sharedDecoded) }]),
    curriculumPdfFixture([{ scan: "Seventeen distinct image objects", imageCopies: 17 }]),
  ]) {
    const f = fixture(bytes);
    assert.deepEqual(await f.read(), { ok: false, reason: "transient" });
    assert.equal(f.calls(), 0);
  }
});

test("a failed OCR is retryable and never commits made-up page text", async () => {
  const f = fixture(curriculumPdfFixture([{ scan: "Lesson 7" }]));
  const original = f.deps.transcribe;
  f.deps.transcribe = async () => { throw new Error("Synthetic provider failure"); };
  assert.deepEqual(await f.read(), { ok: false, reason: "transient" });
  f.deps.transcribe = original;
  const retried = await f.read(); assert.ok(retried.ok); assert.equal(retried.segments[0].text, "Lesson 7: Count six shells.");
});
