import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PageGeometry } from "./page-geometry";
import {
  compareSizeFloor,
  evaluateSizeFloor,
  loadRevisedPageGeometry,
  SIZE_FLOOR_MIN_BOX_IN,
  SIZE_FLOOR_MIN_IMAGE_IN,
  SIZE_FLOOR_MIN_TEXT_PX,
  SIZE_FLOOR_REFUSAL_PREFIX,
  sizeCheckSkippedNote,
  sizeFloorAllowedNote,
  sizeFloorRefusalNote,
  type RevisedGeometryReader,
} from "./size-floor";

/**
 * The size floor for revisions (2026-09-02): a letter-formation page
 * shipped too small to trace after an overflow fix shrank its letters,
 * and nothing measured it. These tests pin the comparison (which pages,
 * which signals, which thresholds), every status under which the check
 * does not run (so silence is never mistaken for a held floor), and the
 * wording that sends Homa back to fix the real problem or ask the parent.
 */

function page(
  number: number,
  overrides: Partial<PageGeometry> = {},
): PageGeometry {
  return {
    page: number,
    contentHeightIn: 9,
    overflowIn: 0,
    fillPercent: 95,
    largestImageIn: { widthIn: 5, heightIn: 3.4 },
    largestTextPx: 48,
    largestBoxIn: { widthIn: 1.2, heightIn: 1.2 },
    ...overrides,
  };
}

const LEGACY_PAGE: PageGeometry = {
  page: 1,
  contentHeightIn: 9,
  overflowIn: 0,
  fillPercent: 95,
};

const ALL_FRESH = new Set([1, 2, 3]);

describe("compareSizeFloor", () => {
  it("finds nothing when the geometry is unchanged", () => {
    assert.deepEqual(compareSizeFloor([page(1)], [page(1)], ALL_FRESH), []);
  });

  it("flags a picture that came out 15% smaller on each side, with both dimensions", () => {
    const findings = compareSizeFloor(
      [page(1)],
      [page(1, { largestImageIn: { widthIn: 5 * 0.85, heightIn: 3.4 * 0.85 } })],
      ALL_FRESH,
    );
    assert.equal(findings.length, 1);
    const [finding] = findings;
    assert.equal(finding.signal, "image");
    assert.equal(finding.page, 1);
    assert.deepEqual(finding.before, { widthIn: 5, heightIn: 3.4 });
    assert.ok(Math.abs(finding.ratio - 0.85) < 0.001);
  });

  it("lets a 5% reflow through: the floor is a tenth, not any change at all", () => {
    const findings = compareSizeFloor(
      [page(1)],
      [
        page(1, {
          largestImageIn: { widthIn: 5 * 0.95, heightIn: 3.4 * 0.95 },
          largestTextPx: 48 * 0.95,
          largestBoxIn: { widthIn: 1.2 * 0.95, heightIn: 1.2 * 0.95 },
        }),
      ],
      ALL_FRESH,
    );
    assert.deepEqual(findings, []);
  });

  it("measures pictures by area, so a height-only cut still counts", () => {
    // 3.4in tall to 2.1in tall at the same width: sqrt(2.1 / 3.4) = 0.786.
    const findings = compareSizeFloor(
      [page(1)],
      [page(1, { largestImageIn: { widthIn: 5, heightIn: 2.1 } })],
      ALL_FRESH,
    );
    assert.equal(findings.length, 1);
    assert.ok(findings[0].ratio < 0.8);
  });

  it("flags text and boxes on their own signals", () => {
    const findings = compareSizeFloor(
      [page(1)],
      [
        page(1, {
          largestTextPx: 36,
          largestBoxIn: { widthIn: 1, heightIn: 1 },
        }),
      ],
      ALL_FRESH,
    );
    assert.deepEqual(
      findings.map((finding) => finding.signal),
      ["text", "box"],
    );
    assert.equal(findings[0].before, 48);
    assert.equal(findings[0].after, 36);
    assert.equal(findings[0].ratio, 0.75);
  });

  it("ignores a signal that was tiny before, per signal", () => {
    const previous = [
      page(1, {
        largestImageIn: { widthIn: 0.5, heightIn: SIZE_FLOOR_MIN_IMAGE_IN - 0.1 },
        largestTextPx: SIZE_FLOOR_MIN_TEXT_PX - 1,
        largestBoxIn: { widthIn: 0.5, heightIn: SIZE_FLOOR_MIN_BOX_IN - 0.05 },
      }),
    ];
    const next = [
      page(1, {
        largestImageIn: { widthIn: 0.25, heightIn: 0.4 },
        largestTextPx: 8,
        largestBoxIn: { widthIn: 0.2, heightIn: 0.2 },
      }),
    ];
    assert.deepEqual(compareSizeFloor(previous, next, ALL_FRESH), []);
  });

  it("skips carried pages, which were already final once", () => {
    const shrunk = page(1, { largestTextPx: 20 });
    assert.deepEqual(compareSizeFloor([page(1)], [shrunk], new Set([2])), []);
    assert.equal(compareSizeFloor([page(1)], [shrunk], new Set([1])).length, 1);
  });

  it("treats a removed picture as not a finding", () => {
    assert.deepEqual(
      compareSizeFloor([page(1)], [page(1, { largestImageIn: null })], ALL_FRESH),
      [],
    );
  });

  it("does not invent a floor for a page that had no picture before", () => {
    assert.deepEqual(
      compareSizeFloor(
        [page(1, { largestImageIn: null })],
        [page(1, { largestImageIn: { widthIn: 1, heightIn: 1 } })],
        ALL_FRESH,
      ),
      [],
    );
  });
});

describe("evaluateSizeFloor", () => {
  const okLoad = (geometry: PageGeometry[]) => ({ status: "ok" as const, geometry });

  it("reports no-revision for a first version", () => {
    assert.deepEqual(
      evaluateSizeFloor({ revised: null, imagePage: false, next: [page(1)], freshPages: ALL_FRESH }),
      { status: "no-revision", findings: [] },
    );
  });

  it("skips a whole-page image as image-page, even when the geometry shrank", () => {
    const result = evaluateSizeFloor({
      revised: okLoad([page(1)]),
      imagePage: true,
      next: [page(1, { largestTextPx: 10 })],
      freshPages: ALL_FRESH,
    });
    assert.deepEqual(result, { status: "image-page", findings: [] });
  });

  it("records a failed read as read-failed even on an image-direct revision", () => {
    // A double read failure is worth counting on its own; image-page would
    // hide it behind a page shape that was never going to compare.
    const result = evaluateSizeFloor({
      revised: { status: "read-failed" },
      imagePage: true,
      next: [page(1)],
      freshPages: ALL_FRESH,
    });
    assert.deepEqual(result, { status: "read-failed", findings: [] });
  });

  it("passes a load status straight through", () => {
    for (const status of ["not-found", "read-failed", "unparseable", "pre-signal"] as const) {
      const result = evaluateSizeFloor({
        revised: { status },
        imagePage: false,
        next: [page(1)],
        freshPages: ALL_FRESH,
      });
      assert.deepEqual(result, { status, findings: [] });
    }
  });

  it("skips with page-count-mismatch instead of comparing new page 1 with old page 1", () => {
    // Inserting a cover page shifts every page by one; matching by number
    // would compare the cover with the old first page.
    const result = evaluateSizeFloor({
      revised: okLoad([page(1), page(2)]),
      imagePage: false,
      next: [page(1, { largestTextPx: 20 }), page(2), page(3)],
      freshPages: ALL_FRESH,
    });
    assert.deepEqual(result, { status: "page-count-mismatch", findings: [] });
  });

  it("reports pre-signal when the revised version carries none of the signals", () => {
    const result = evaluateSizeFloor({
      revised: okLoad([LEGACY_PAGE]),
      imagePage: false,
      next: [page(1, { largestTextPx: 20 })],
      freshPages: ALL_FRESH,
    });
    assert.deepEqual(result, { status: "pre-signal", findings: [] });
  });

  it("reports measurement-error when a fresh page could not be measured on either side", () => {
    const broken = page(1, {
      largestImageIn: null,
      largestTextPx: null,
      largestBoxIn: null,
      measurementError: true,
    });
    assert.equal(
      evaluateSizeFloor({ revised: okLoad([page(1)]), imagePage: false, next: [broken], freshPages: ALL_FRESH }).status,
      "measurement-error",
    );
    assert.equal(
      evaluateSizeFloor({ revised: okLoad([broken]), imagePage: false, next: [page(1)], freshPages: ALL_FRESH }).status,
      "measurement-error",
    );
  });

  it("compares when everything lines up, and carries the findings", () => {
    const result = evaluateSizeFloor({
      revised: okLoad([page(1)]),
      imagePage: false,
      next: [page(1, { largestTextPx: 30 })],
      freshPages: ALL_FRESH,
    });
    assert.equal(result.status, "compared");
    assert.deepEqual(result.findings.map((finding) => finding.signal), ["text"]);
  });
});

describe("sizeFloorRefusalNote", () => {
  const findings = compareSizeFloor(
    [page(1, { largestImageIn: { widthIn: 3, heightIn: 3 } })],
    [page(1, { largestImageIn: { widthIn: 1.5, heightIn: 4 }, largestTextPx: 36 })],
    ALL_FRESH,
  );

  it("starts with the stable prefix and reports both dimensions", () => {
    const note = sizeFloorRefusalNote(findings, "letter-number-formation-practice");
    assert.ok(note.startsWith(`${SIZE_FLOOR_REFUSAL_PREFIX} `));
    assert.match(note, /largest picture went from 3in x 3in to 1\.5in x 4in/);
    assert.match(note, /\d+% smaller/);
    assert.match(note, /48px to 36px/);
    assert.match(note, /letter-number-formation-practice recipe/);
  });

  it("points at the consent flag and at asking her, never at an aspect-ratio dodge", () => {
    const note = sizeFloorRefusalNote(findings, null);
    assert.match(note, /allowSizeReduction: true/);
    assert.match(note, /ask her one plain question/);
    assert.match(note, /never shrink silently/);
    assert.match(note, /never call this a technical problem/);
    assert.doesNotMatch(note, /aspect ratio/, "an aspect change re-trips the check");
  });

  it("names removing the largest element as a legitimate reason when the parent asked", () => {
    const note = sizeFloorRefusalNote(findings, null);
    assert.match(note, /Removing the largest element/);
    assert.match(note, /legitimate reason for allowSizeReduction/);
  });

  it("reads without a recipe too", () => {
    const note = sizeFloorRefusalNote(findings, null);
    assert.doesNotMatch(note, /recipe\)/);
    assert.match(note, /floor for every later revision of the same material\./);
  });
});

describe("sizeFloorAllowedNote", () => {
  it("records the change and the flag that let it through", () => {
    const findings = compareSizeFloor([page(1)], [page(1, { largestTextPx: 30 })], ALL_FRESH);
    const note = sizeFloorAllowedNote(findings);
    assert.match(note, /^Size floor: /);
    assert.match(note, /48px to 30px/);
    assert.match(note, /allowSizeReduction was set/);
    assert.match(note, /requestSummary/);
  });
});

describe("sizeCheckSkippedNote", () => {
  it("says nothing for a real comparison or a first version", () => {
    assert.equal(sizeCheckSkippedNote("compared"), null);
    assert.equal(sizeCheckSkippedNote("no-revision"), null);
  });

  it("tells Homa to compare by eye for every other status, naming the reason", () => {
    for (const status of [
      "pre-signal",
      "not-found",
      "read-failed",
      "unparseable",
      "page-count-mismatch",
      "image-page",
      "measurement-error",
    ] as const) {
      const note = sizeCheckSkippedNote(status);
      assert.ok(note, status);
      assert.match(note, /^The size check did not run on this version \(/);
      assert.match(note, /compare the new page against the previous version yourself before sending/);
    }
  });
});

describe("loadRevisedPageGeometry", () => {
  const ids = { familyId: "family-a", materialId: "material-1" };
  const stored = [page(1)];

  it("returns the parsed geometry when the row reads cleanly", async () => {
    const result = await loadRevisedPageGeometry(ids, async () => ({
      found: true,
      pageGeometry: stored,
    }));
    assert.equal(result.status, "ok");
    assert.deepEqual(result.status === "ok" ? result.geometry : null, stored);
  });

  it("reports not-found when no row matched inside the family", async () => {
    const result = await loadRevisedPageGeometry(ids, async () => ({ found: false }));
    assert.deepEqual(result, { status: "not-found" });
  });

  it("reports pre-signal when the row predates stored geometry", async () => {
    const result = await loadRevisedPageGeometry(ids, async () => ({
      found: true,
      pageGeometry: null,
    }));
    assert.deepEqual(result, { status: "pre-signal" });
  });

  it("reports unparseable, not ok, for a shape that does not match", async () => {
    const result = await loadRevisedPageGeometry(ids, async () => ({
      found: true,
      pageGeometry: [{ page: "one", fill: "lots" }],
    }));
    assert.deepEqual(result, { status: "unparseable" });
  });

  it("retries a throwing read once, then reports read-failed and names the row in the log", async () => {
    let calls = 0;
    const alwaysThrows: RevisedGeometryReader = async () => {
      calls += 1;
      throw new Error("pooler hiccup");
    };
    const logged: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    };
    try {
      const result = await loadRevisedPageGeometry(ids, alwaysThrows);
      assert.deepEqual(result, { status: "read-failed" });
    } finally {
      console.error = originalError;
    }
    assert.equal(calls, 2, "exactly one retry");
    assert.equal(logged.length, 1);
    assert.match(logged[0], /material material-1 in family family-a/);
    assert.match(logged[0], /pooler hiccup/);
  });

  it("succeeds when the retry succeeds", async () => {
    let calls = 0;
    const flaky: RevisedGeometryReader = async () => {
      calls += 1;
      if (calls === 1) throw new Error("first try fails");
      return { found: true, pageGeometry: stored };
    };
    const result = await loadRevisedPageGeometry(ids, flaky);
    assert.equal(result.status, "ok");
    assert.equal(calls, 2);
  });

  it("never rejects", async () => {
    await assert.doesNotReject(() =>
      loadRevisedPageGeometry(ids, () => Promise.reject(new TypeError("boom"))),
    );
  });
});
