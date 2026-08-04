import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  geometryReviewBlock,
  geometryToolNotes,
  PRINTABLE_HEIGHT_IN,
  provenCutoffPages,
  summarizePageGeometry,
  underfillNotesApplyTo,
} from "./page-geometry";
import { wrapPrintableDocument } from "./page-shell";

/**
 * Deterministic page-geometry feedback (gh#349): the composer authors
 * HTML blind into an exact-height page box with no measured fill
 * feedback, which produced the recurring blank-bottom/overflow
 * oscillation (F1). These tests cover the pixel math, the wording rules
 * (overflow always wins over an underfill note), and that a naive fill
 * metric never gets treated as something to maximize.
 */

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

  it("scopes that trust to sizes and positions, never to page quality", () => {
    // An unqualified "trust these numbers" let a measurement override a
    // correct visual read: while fill counted any full-height wrapper as
    // content, the reviewer was told to believe 100% over its own view
    // of a three-quarters-empty page (2026-07-30).
    const block = geometryReviewBlock([
      { page: 1, contentHeightIn: 8, overflowIn: 0, fillPercent: 84 },
    ]);
    assert.match(block ?? "", /sizes and positions/i);
    assert.match(block ?? "", /say nothing about whether the page is any good/i);
  });
});

describe("content in the bottom margin band", () => {
  // Content past the 9.5in printable area but inside the 11in page box
  // is neither cut nor blank, so both other branches stayed silent and
  // the crowded page was reported as fitting.
  it("gets its own note instead of falling through both branches", () => {
    const pages = [
      { page: 1, contentHeightIn: 10.2, overflowIn: 0, fillPercent: 107 },
    ];
    const [note] = geometryToolNotes(pages);
    assert.match(note ?? "", /past the 9.5in printable area into the bottom margin band/);
    assert.match(note ?? "", /not cut off/);
    assert.match(geometryReviewBlock(pages) ?? "", /bottom margin band/);
  });

  it("still reports a real cut as a cut, not as margin crowding", () => {
    const [note] = geometryToolNotes([
      { page: 1, contentHeightIn: 11.4, overflowIn: 0.9, fillPercent: 120 },
    ]);
    assert.match(note ?? "", /cut in print/);
  });

  it("stays silent on sub-pixel margin noise instead of saying a page runs 0in past itself", () => {
    // formatIn(0.02) prints "0", so an unguarded threshold produced the
    // nonsensical "content runs 0in past the printable area" (observed
    // 2026-07-30, fill-convergence-overflow-equations eval).
    const pages = [
      { page: 1, contentHeightIn: 9.52, overflowIn: 0, fillPercent: 100 },
    ];
    assert.deepEqual(geometryToolNotes(pages), []);
    assert.match(geometryReviewBlock(pages) ?? "", /fits the page/);
  });
});

describe("fixed-dimension formats", () => {
  // Following the skill's own flash-card rule (2.5x3.5in cards, four per
  // page, gh#356) lands near 77% fill, so an underfill note would tell
  // Homa to scale the cards up and undo the parent's own correction.
  it("skips underfill notes when the format's dimensions are the point", () => {
    const pages = [
      { page: 1, contentHeightIn: 7.3, overflowIn: 0, fillPercent: 77 },
    ];
    assert.equal(geometryToolNotes(pages, { underfillNotes: false }).length, 0);
    assert.doesNotMatch(
      geometryReviewBlock(pages, { underfillNotes: false }) ?? "",
      /blank at the bottom/,
    );
  });

  it("still blocks a card sheet that runs off the paper", () => {
    const [note] = geometryToolNotes(
      [{ page: 1, contentHeightIn: 11.6, overflowIn: 1.1, fillPercent: 122 }],
      { underfillNotes: false },
    );
    assert.match(note ?? "", /cut in print/);
  });

  it("exempts flash cards and nothing else", () => {
    assert.equal(underfillNotesApplyTo("flashcards"), false);
    assert.equal(underfillNotesApplyTo("worksheet"), true);
    assert.equal(underfillNotesApplyTo("packet"), true);
  });
});

describe("provenCutoffPages", () => {
  // Founder ruling `cutoff-page-is-a-block` (2026-07-29) applies to a
  // proof and never to a suspicion, so this reads geometry only.
  it("names every page measured off the paper", () => {
    assert.deepEqual(
      provenCutoffPages([
        { page: 1, contentHeightIn: 9, overflowIn: 0, fillPercent: 95 },
        { page: 2, contentHeightIn: 11.5, overflowIn: 0.6, fillPercent: 121 },
        { page: 3, contentHeightIn: 12, overflowIn: 1.4, fillPercent: 126 },
      ]),
      [2, 3],
    );
  });

  it("ignores sub-pixel rounding noise, which is not a proof", () => {
    assert.deepEqual(
      provenCutoffPages([
        { page: 1, contentHeightIn: 9.5, overflowIn: 0.01, fillPercent: 100 },
      ]),
      [],
    );
  });

  it("says nothing about a page that merely crowds the margin band", () => {
    assert.deepEqual(
      provenCutoffPages([
        { page: 1, contentHeightIn: 10.2, overflowIn: 0, fillPercent: 107 },
      ]),
      [],
    );
  });
});

describe("PRINTABLE_HEIGHT_IN stays true to the shell CSS", () => {
  // Mirrored from render-provenance.test.ts's approach: a hand-picked
  // constant that silently drifts from the real shell CSS records a lie
  // about where the printable area actually ends, so read the CSS back
  // out of page-shell.ts rather than trusting the number in isolation.
  it("equals the page box height minus the body's own top and bottom padding", async () => {
    const rendered = wrapPrintableDocument(["<p>geometry probe</p>"], "", "letter");
    const pageHeight = rendered.match(/\.homa-sheet-page \{[^}]*height:\s*(\d+(?:\.\d+)?)in/);
    const bodyPadding = rendered.match(
      /\.homa-sheet-body \{[^}]*padding:\s*(\d+(?:\.\d+)?)in\s+(\d+(?:\.\d+)?)in\s+(\d+(?:\.\d+)?)in/,
    );
    assert.ok(pageHeight, "rendered page box height not found; update this guard");
    assert.ok(bodyPadding, "rendered body padding shorthand not found; update this guard");
    const expected =
      Number(pageHeight[1]) - Number(bodyPadding[1]) - Number(bodyPadding[3]);
    assert.equal(PRINTABLE_HEIGHT_IN, expected);
  });
});
