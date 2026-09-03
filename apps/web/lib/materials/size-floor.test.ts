import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PageGeometry } from "./page-geometry";
import {
  compareSizeFloor,
  SIZE_FLOOR_MIN_BOX_IN,
  SIZE_FLOOR_MIN_IMAGE_IN,
  SIZE_FLOOR_MIN_TEXT_PX,
  sizeFloorAllowedNote,
  sizeFloorRefusalNote,
} from "./size-floor";

/**
 * The size floor for revisions (2026-09-02): a letter-formation page
 * shipped too small to trace after an overflow fix shrank its letters,
 * and nothing measured it. These tests pin the comparison (which pages,
 * which signals, which thresholds) and the wording that sends Homa back
 * to fix the real problem or ask the parent, never to shrink silently.
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

const ALL_FRESH = new Set([1, 2, 3]);

describe("compareSizeFloor", () => {
  it("finds nothing when the geometry is unchanged", () => {
    assert.deepEqual(compareSizeFloor([page(1)], [page(1)], ALL_FRESH), []);
  });

  it("flags a picture that came out 15% smaller on each side", () => {
    const findings = compareSizeFloor(
      [page(1)],
      [page(1, { largestImageIn: { widthIn: 5 * 0.85, heightIn: 3.4 * 0.85 } })],
      ALL_FRESH,
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].signal, "image");
    assert.equal(findings[0].page, 1);
    assert.equal(findings[0].before, 3.4);
    assert.ok(Math.abs(findings[0].ratio - 0.85) < 0.001);
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
    assert.equal(findings[0].after, 2.1);
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

  it("compares nothing against a version stored before the signals existed", () => {
    const legacy: PageGeometry = {
      page: 1,
      contentHeightIn: 9,
      overflowIn: 0,
      fillPercent: 95,
    };
    assert.deepEqual(compareSizeFloor([legacy], [page(1, { largestTextPx: 20 })], ALL_FRESH), []);
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

  it("compares only the overlap when the page counts differ", () => {
    const previous = [page(1), page(2)];
    const next = [page(1), page(2, { largestTextPx: 20 }), page(3, { largestTextPx: 10 })];
    const findings = compareSizeFloor(previous, next, ALL_FRESH);
    assert.deepEqual(findings.map((finding) => finding.page), [2]);
  });
});

describe("sizeFloorRefusalNote", () => {
  const findings = compareSizeFloor(
    [page(1)],
    [page(1, { largestImageIn: { widthIn: 5, heightIn: 2.1 }, largestTextPx: 36 })],
    ALL_FRESH,
  );

  it("names the page, the inches, the percent, the flag, and asking her", () => {
    const note = sizeFloorRefusalNote(findings, "letter-number-formation-practice");
    assert.match(note, /^Not sent: /);
    assert.match(note, /page 1's largest picture about 2\.1in tall/);
    assert.match(note, /had it at 3\.4in/);
    assert.match(note, /\d+% smaller/);
    assert.match(note, /48px to 36px/);
    assert.match(note, /letter-number-formation-practice recipe/);
    assert.match(note, /allowSizeReduction: true/);
    assert.match(note, /ask her one plain question/);
    assert.match(note, /never shrink silently/);
    assert.match(note, /never call this a technical problem/);
  });

  it("reads without a recipe too", () => {
    const note = sizeFloorRefusalNote(findings, null);
    assert.doesNotMatch(note, /recipe\)/);
    assert.match(note, /floor for every later revision of the same material\./);
  });
});

describe("sizeFloorAllowedNote", () => {
  it("records the change and the consent that let it through", () => {
    const findings = compareSizeFloor(
      [page(1)],
      [page(1, { largestTextPx: 30 })],
      ALL_FRESH,
    );
    const note = sizeFloorAllowedNote(findings);
    assert.match(note, /^Size floor: /);
    assert.match(note, /48px to 30px/);
    assert.match(note, /allowSizeReduction recorded the parent's choice/);
    assert.match(note, /requestSummary/);
  });
});
