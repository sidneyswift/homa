import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import {
  geometryReviewBlock,
  geometryToolNotes,
  PRINTABLE_HEIGHT_IN,
  summarizePageGeometry,
} from "./page-geometry";

/**
 * Deterministic page-geometry feedback (gh#349): the composer authors
 * HTML blind into an exact-height page box with no measured fill
 * feedback, which produced the recurring blank-bottom/overflow
 * oscillation (F1). These tests cover the pixel math, the wording rules
 * (overflow always wins over an underfill note), and that a naive fill
 * metric never gets treated as something to maximize.
 */

const here = import.meta.dirname;

const PX_PER_IN = 96;

describe("summarizePageGeometry", () => {
  it("converts pixels to inches at the render viewport's 96dpi", () => {
    const [page] = summarizePageGeometry([
      { contentPx: 5 * PX_PER_IN, usablePx: 9.5 * PX_PER_IN, overflowPx: 0 },
    ]);
    assert.equal(page.page, 1);
    assert.equal(page.contentHeightIn, 5);
    assert.equal(page.overflowIn, 0);
    assert.equal(page.fillPercent, Math.round((5 / 9.5) * 100));
  });

  it("numbers pages the way the parent counts them, starting at 1", () => {
    const pages = summarizePageGeometry([
      { contentPx: 100, usablePx: 912, overflowPx: 0 },
      { contentPx: 200, usablePx: 912, overflowPx: 0 },
    ]);
    assert.deepEqual(pages.map((page) => page.page), [1, 2]);
  });

  it("never reports a negative fill or overflow from a rounding quirk", () => {
    const [page] = summarizePageGeometry([
      { contentPx: -5, usablePx: 912, overflowPx: -3 },
    ]);
    assert.equal(page.contentHeightIn, 0);
    assert.equal(page.overflowIn, 0);
  });

  it("guards divide-by-zero when a body measures with zero usable height", () => {
    const [page] = summarizePageGeometry([
      { contentPx: 100, usablePx: 0, overflowPx: 0 },
    ]);
    assert.ok(Number.isFinite(page.fillPercent));
  });
});

describe("geometryToolNotes", () => {
  it("flags overflow with actionable wording, and skips the fill note on that page", () => {
    const notes = geometryToolNotes([
      { page: 2, contentHeightIn: 9.9, overflowIn: 0.4, fillPercent: 104 },
    ]);
    assert.equal(notes.length, 1);
    assert.match(notes[0], /page 2/i);
    assert.match(notes[0], /0\.4in past the printable area/);
    assert.match(notes[0], /cut in print, not shrunk/);
  });

  it("flags a deep blank bottom band with the fill percent and a row estimate", () => {
    const notes = geometryToolNotes([
      { page: 1, contentHeightIn: 5, overflowIn: 0, fillPercent: 53 },
    ]);
    assert.equal(notes.length, 1);
    assert.match(notes[0], /page 1 fill is 53%/i);
    assert.match(notes[0], /blank at the bottom/);
    assert.match(notes[0], /age band/i);
    assert.match(notes[0], /never pad with filler/i);
  });

  it("asks for scaling unconditionally and gates only adding items on the age band", () => {
    // Founder ruling 2026-07-29 (worksheet-scale-to-fill): the fix for a
    // dead band is scaling the existing items up, which needs no
    // permission from the density band; only MORE items is gated on it.
    // The shipped wording gated both remedies on the band, which would
    // have called a 4-year-old's half-empty page correct.
    const notes = geometryToolNotes([
      { page: 1, contentHeightIn: 5, overflowIn: 0, fillPercent: 53 },
    ]);
    assert.match(notes[0], /needs no permission from the age band/i);
    assert.match(notes[0], /add more items only when/i);
    assert.match(notes[0], /bigger type, taller answer blanks/i);
  });

  it("flags the quarter-page dead band a real parent complained about", () => {
    // "There is still 1/4 of the page open on bottom of page 1 and 2"
    // (2026-07-29): a quarter of 9.5in is ~2.4in, which the original 3in
    // floor passed silently on the very complaint it was built for.
    const notes = geometryToolNotes([
      {
        page: 1,
        contentHeightIn: PRINTABLE_HEIGHT_IN * 0.75,
        overflowIn: 0,
        fillPercent: 75,
      },
    ]);
    assert.equal(notes.length, 1);
    assert.match(notes[0], /blank at the bottom/);
  });

  it("says nothing about a page that simply fits", () => {
    const notes = geometryToolNotes([
      { page: 1, contentHeightIn: 8.2, overflowIn: 0, fillPercent: 86 },
    ]);
    assert.deepEqual(notes, []);
  });

  it("says nothing about a small, deliberate design margin", () => {
    // A 1.2in band below the last item is ordinary design air, under the
    // 2in threshold: not the F1 dead zone a parent reads as unfinished.
    const notes = geometryToolNotes([
      {
        page: 1,
        contentHeightIn: PRINTABLE_HEIGHT_IN - 1.2,
        overflowIn: 0,
        fillPercent: 87,
      },
    ]);
    assert.deepEqual(notes, []);
  });

  it("reports overflow before underfill would even apply, since they cannot both fire", () => {
    // A page cannot be both critically overfull and critically underfull;
    // this asserts the two branches stay mutually exclusive per page.
    const notes = geometryToolNotes([
      { page: 1, contentHeightIn: 12, overflowIn: 1, fillPercent: 126 },
    ]);
    assert.equal(notes.length, 1);
    assert.match(notes[0], /past the printable area/);
  });

  it("only notes the affected pages of a multi-page packet", () => {
    const notes = geometryToolNotes([
      { page: 1, contentHeightIn: 8.5, overflowIn: 0, fillPercent: 89 },
      { page: 2, contentHeightIn: 4, overflowIn: 0, fillPercent: 42 },
      { page: 3, contentHeightIn: 11.5, overflowIn: 2, fillPercent: 121 },
    ]);
    assert.equal(notes.length, 2);
    assert.match(notes[0], /page 2/i);
    assert.match(notes[1], /page 3/i);
  });
});

describe("geometryReviewBlock", () => {
  it("returns null when nothing was measured", () => {
    assert.equal(geometryReviewBlock([]), null);
  });

  it("lines up one line per page, fitting pages included", () => {
    const block = geometryReviewBlock([
      { page: 1, contentHeightIn: 8.5, overflowIn: 0, fillPercent: 89 },
      { page: 2, contentHeightIn: 4, overflowIn: 0, fillPercent: 42 },
      { page: 3, contentHeightIn: 11.5, overflowIn: 2, fillPercent: 121 },
    ]);
    assert.ok(block);
    assert.match(block, /page 1: 89% fill, fits the page/);
    assert.match(block, /page 2: content ends 4in down/);
    assert.match(block, /page 3: content overflows the page box by 2in/);
  });

  it("tells the reviewer to trust the measurement over its own read of the image", () => {
    const block = geometryReviewBlock([
      { page: 1, contentHeightIn: 8, overflowIn: 0, fillPercent: 84 },
    ]);
    assert.match(block ?? "", /trust these numbers/i);
  });
});

describe("PRINTABLE_HEIGHT_IN stays true to the shell CSS", () => {
  // Mirrored from render-provenance.test.ts's approach: a hand-picked
  // constant that silently drifts from the real shell CSS records a lie
  // about where the printable area actually ends, so read the CSS back
  // out of page-shell.ts rather than trusting the number in isolation.
  it("equals the page box height minus the body's own top and bottom padding", async () => {
    const source = await readFile(path.join(here, "page-shell.ts"), "utf8");
    const pageHeight = source.match(/\.homa-sheet-page \{[^}]*height:\s*(\d+(?:\.\d+)?)in/);
    const bodyPadding = source.match(
      /\.homa-sheet-body \{[^}]*padding:\s*(\d+(?:\.\d+)?)in\s+(\d+(?:\.\d+)?)in\s+(\d+(?:\.\d+)?)in/,
    );
    assert.ok(pageHeight, "page box height not found; update this guard");
    assert.ok(bodyPadding, "body padding shorthand not found; update this guard");
    const expected =
      Number(pageHeight[1]) - Number(bodyPadding[1]) - Number(bodyPadding[3]);
    assert.equal(PRINTABLE_HEIGHT_IN, expected);
  });
});
