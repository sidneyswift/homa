/**
 * Deterministic page-geometry feedback for printables (gh#349, the
 * smallest slice of the materials layout program).
 *
 * The composer authors page HTML blind into an exact-height page box
 * (page-shell.ts: 8.5x11in, overflow hidden) with no measured feedback
 * about where its content actually landed. The result is the recurring
 * blank-bottom / overflow oscillation (F1, third occurrence 2026-07-28,
 * the Carolyng family): the model pads or trims by feel, the QC reviewer
 * eyeballs a shrunken JPEG, and nobody holds a number. This module turns
 * the renderer's raw pixel measurements (render-page.ts takes them while
 * Chromium still holds the laid-out document) into per-page facts and
 * into wording the composing agent and the QC reviewer can act on.
 *
 * The 07-28 council's accepted objection is load-bearing: a naive fill
 * metric "Goodharts into padded, content-light pages". So fill is never
 * a target to maximize. Fill measures where content ENDS down the page
 * (whitespace between items counts as filled; only the trailing dead
 * band reads as empty), and no note ever asks for more items on its own
 * authority.
 *
 * What a note asks for is set by founder ruling 2026-07-29
 * (`worksheet-scale-to-fill`): the fix for a dead band is to SCALE the
 * existing items up until they reach the bottom, and that needs no
 * permission from the age-density band. Only ADDING items is gated on
 * that band. The ruling came from the co-founder complaint these notes
 * exist to prevent, and it named the misreading precisely: the problem
 * was space where things could have been scaled to fit, never
 * simplicity versus complexity.
 */

/** CSS pixels per inch at the render viewport (LETTER_PX, render-page.ts). */
const PX_PER_IN = 96;

/**
 * The printable interior height: the 11in page box minus the shell's
 * 0.55in top and 0.95in bottom padding. page-geometry.test.ts guards
 * this against the real shell CSS so the wording cannot drift.
 */
export const PRINTABLE_HEIGHT_IN = 9.5;

/** Overflow below this is sub-pixel rounding noise, not a finding. */
const OVERFLOW_NOTE_MIN_IN = 0.05;

/**
 * A trailing blank band this deep gets an actionable note. Two inches is
 * roughly the quarter-page dead band a real parent complained about
 * ("there is still 1/4 of the page open on bottom of page 1 and 2",
 * 2026-07-29), which a 3in floor would have passed silently, and it is
 * still deep enough that ordinary design air below the last item does
 * not trip a note.
 */
const UNDERFILL_NOTE_MIN_BLANK_IN = 2;

/**
 * One generous child-facing exercise row (big type plus writing space),
 * used only to translate blank inches into a count the composer can act
 * on. An estimate, clearly worded as one.
 */
const EXERCISE_ROW_IN = 1.5;

/** A drawn box in CSS pixels at the render viewport. */
export interface MeasuredBoxPx {
  width: number;
  height: number;
}

/** The same box in inches, the way a parent would measure the paper. */
export interface MeasuredBoxIn {
  widthIn: number;
  heightIn: number;
}

/** Raw per-page pixel measurements from the browser (render-page.ts). */
export interface SheetBodyMeasurement {
  /** Bottom edge of the lowest rendered descendant, measured from the
   * top of the printable area (below the shell's top padding). */
  contentPx: number;
  /** The printable interior height: page box minus vertical padding. */
  usablePx: number;
  /** How far layout runs past the exact page box; cut in print. */
  overflowPx: number;
  /**
   * Size-floor signals (size-floor.ts, 2026-09-02): the largest picture
   * (an IMG at its drawn object-fit box, an inline SVG, a CANVAS), the
   * largest computed font size among the page's text runs, and the
   * largest bordered box (a trace box, a card, a practice frame), each
   * null when the page has none of that kind. Absent on measurements
   * taken before the signals existed.
   */
  largestImagePx?: MeasuredBoxPx | null;
  largestTextPx?: number | null;
  largestBoxPx?: MeasuredBoxPx | null;
}

export interface PageGeometry {
  /** 1-based, the way the parent counts pages. */
  page: number;
  /** Where the composed content ends, inches down the printable area. */
  contentHeightIn: number;
  /** Inches of content past the 11in page box; cut in print, not shrunk. */
  overflowIn: number;
  /** contentHeightIn over the printable height; past 100 means cut off. */
  fillPercent: number;
  /**
   * Size-floor signals, see SheetBodyMeasurement. Null when the page has
   * none of that kind; absent on rows stored before 2026-09-02, which the
   * floor reads as "nothing to compare against" rather than as zero.
   */
  largestImageIn?: MeasuredBoxIn | null;
  largestTextPx?: number | null;
  largestBoxIn?: MeasuredBoxIn | null;
}

function roundIn(px: number): number {
  return Math.round((px / PX_PER_IN) * 100) / 100;
}

function boxIn(box: MeasuredBoxPx | null | undefined): MeasuredBoxIn | null {
  if (!box || !(box.width > 0) || !(box.height > 0)) return null;
  return { widthIn: roundIn(box.width), heightIn: roundIn(box.height) };
}

/** "0.4", "5.1", "3" (never "3.0"): inches the way a person says them. */
function formatIn(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

/**
 * summarizePageGeometry(measurements): the structured per-page facts,
 * pixels to inches at the render viewport's 96dpi, pages numbered the
 * way the parent counts them.
 */
export function summarizePageGeometry(
  measurements: readonly SheetBodyMeasurement[],
): PageGeometry[] {
  return measurements.map((measurement, index) => {
    const usablePx = measurement.usablePx > 0 ? measurement.usablePx : 1;
    const contentPx = Math.max(0, measurement.contentPx);
    const textPx = measurement.largestTextPx;
    return {
      page: index + 1,
      contentHeightIn: roundIn(contentPx),
      overflowIn: roundIn(Math.max(0, measurement.overflowPx)),
      fillPercent: Math.round((contentPx / usablePx) * 100),
      largestImageIn: boxIn(measurement.largestImagePx),
      largestTextPx:
        typeof textPx === "number" && textPx > 0 ? Math.round(textPx * 10) / 10 : null,
      largestBoxIn: boxIn(measurement.largestBoxPx),
    };
  });
}

function blankBandIn(page: PageGeometry): number {
  return Math.max(0, PRINTABLE_HEIGHT_IN - page.contentHeightIn);
}

/** Inches of content sitting below the printable area but above the page
 * edge: it prints inside the bottom margin band rather than being cut. */
function marginBandIn(page: PageGeometry): number {
  return Math.max(0, page.contentHeightIn - PRINTABLE_HEIGHT_IN);
}

/**
 * Formats whose page is a grid of real-world-dimension pieces, where the
 * dead band at the bottom is the correct leftover of a fixed card size
 * and scaling to fill would destroy the thing the parent asked for.
 * Following the skill's own flash-card rule (2.5x3.5in cards, four per
 * page, gh#356 / PR #456) lands at about 77% fill, so without this the
 * instrument tells Homa to undo the parent's own correction.
 */
export function underfillNotesApplyTo(kind: string): boolean {
  return kind !== "flashcards";
}

/**
 * provenCutoffPages(pages): the pages a deterministic measurement PROVES
 * print cut off, for founder ruling `cutoff-page-is-a-block`
 * (2026-07-29): a proof is never delivered, it is rebuilt. Suspicion is
 * explicitly not covered, so this reads geometry only and never the
 * vision reviewer's doubts.
 */
export function provenCutoffPages(pages: readonly PageGeometry[]): number[] {
  return pages
    .filter((page) => page.overflowIn >= OVERFLOW_NOTE_MIN_IN)
    .map((page) => page.page);
}

/**
 * geometryToolNotes(pages): actionable wording for the create_printable
 * result, one note per problem page, nothing for pages that fit. An
 * overflowing page gets only the overflow note (its fill number is a
 * side effect of the same defect).
 */
export function geometryToolNotes(
  pages: readonly PageGeometry[],
  options: { underfillNotes?: boolean } = {},
): string[] {
  const underfillNotes = options.underfillNotes ?? true;
  const notes: string[] = [];
  for (const page of pages) {
    if (page.overflowIn >= OVERFLOW_NOTE_MIN_IN) {
      notes.push(
        `Page ${page.page} runs ${formatIn(page.overflowIn)}in past the printable area; everything past the 11in page box is cut in print, not shrunk. Tighten spacing or type, or move content to its own page.`,
      );
      continue;
    }
    // Content below the printable area but above the paper edge prints
    // inside the bottom margin band: not cut, but past the margin every
    // other page keeps, and invisible to both other branches (its blank
    // band is zero and its overflow is zero).
    const marginIn = marginBandIn(page);
    if (marginIn >= OVERFLOW_NOTE_MIN_IN) {
      notes.push(
        `Page ${page.page} fill is ${page.fillPercent}%: content runs ${formatIn(marginIn)}in past the ${PRINTABLE_HEIGHT_IN}in printable area into the bottom margin band. It is not cut off, but it crowds the paper edge; pull the last items up or move them to their own page.`,
      );
      continue;
    }
    if (!underfillNotes) continue;
    const blankIn = blankBandIn(page);
    if (blankIn >= UNDERFILL_NOTE_MIN_BLANK_IN) {
      const rows = Math.max(1, Math.round(blankIn / EXERCISE_ROW_IN));
      notes.push(
        `Page ${page.page} fill is ${page.fillPercent}%: content ends ${formatIn(page.contentHeightIn)}in down the ${PRINTABLE_HEIGHT_IN}in printable area, leaving about ${formatIn(blankIn)}in blank at the bottom. Scale the items already on the page up until they reach the bottom (bigger type, taller answer blanks, larger pictures, more room per row); that is the fix, and it needs no permission from the age band. Add MORE items only when this child's age band in the page-density table (materials-studio skill) calls for more than the page shows, which would be about ${rows} further exercise ${rows === 1 ? "row" : "rows"} of room. Never pad with filler content to raise the number.`,
      );
    }
  }
  return notes;
}

/**
 * geometryReviewBlock(pages): the same numbers for the QC reviewer's
 * brief, one line per measured page (including pages past the preview
 * cap, which have no image anywhere), or null when nothing was measured.
 */
export function geometryReviewBlock(
  pages: readonly PageGeometry[],
  options: { underfillNotes?: boolean } = {},
): string | null {
  if (pages.length === 0) return null;
  const underfillNotes = options.underfillNotes ?? true;
  const lines = pages.map((page) => {
    if (page.overflowIn >= OVERFLOW_NOTE_MIN_IN) {
      return `- page ${page.page}: content overflows the page box by ${formatIn(page.overflowIn)}in; anything past 11in is cut in print`;
    }
    const marginIn = marginBandIn(page);
    if (marginIn >= OVERFLOW_NOTE_MIN_IN) {
      return `- page ${page.page}: content runs ${formatIn(marginIn)}in past the ${PRINTABLE_HEIGHT_IN}in printable area into the bottom margin band (${page.fillPercent}% fill); not cut, but crowding the paper edge`;
    }
    const blankIn = blankBandIn(page);
    if (underfillNotes && blankIn >= UNDERFILL_NOTE_MIN_BLANK_IN) {
      return `- page ${page.page}: content ends ${formatIn(page.contentHeightIn)}in down the ${PRINTABLE_HEIGHT_IN}in printable area (${page.fillPercent}% fill, about ${formatIn(blankIn)}in blank at the bottom)`;
    }
    return `- page ${page.page}: ${page.fillPercent}% fill, fits the page`;
  });
  return `Measured page geometry, deterministic from the renderer (trust these numbers over your own estimate of sizes and positions in a shrunken image; they say nothing about whether the page is any good):\n${lines.join("\n")}`;
}
