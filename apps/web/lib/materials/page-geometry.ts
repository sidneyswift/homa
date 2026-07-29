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
 * band reads as empty), every underfill note conditions on the
 * age-density band in the materials-studio skill, and every note offers
 * spreading existing content as an alternative to adding more.
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
 * A trailing blank band this deep gets an actionable note. Three inches
 * is about two generous child-size exercise rows; smaller bands are
 * design air, not the F1 dead band.
 */
const UNDERFILL_NOTE_MIN_BLANK_IN = 3;

/**
 * One generous child-facing exercise row (big type plus writing space),
 * used only to translate blank inches into a count the composer can act
 * on. An estimate, clearly worded as one.
 */
const EXERCISE_ROW_IN = 1.5;

/** Raw per-page pixel measurements from the browser (render-page.ts). */
export interface SheetBodyMeasurement {
  /** Bottom edge of the lowest rendered descendant, measured from the
   * top of the printable area (below the shell's top padding). */
  contentPx: number;
  /** The printable interior height: page box minus vertical padding. */
  usablePx: number;
  /** How far layout runs past the exact page box; cut in print. */
  overflowPx: number;
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
}

function roundIn(px: number): number {
  return Math.round((px / PX_PER_IN) * 100) / 100;
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
    return {
      page: index + 1,
      contentHeightIn: roundIn(contentPx),
      overflowIn: roundIn(Math.max(0, measurement.overflowPx)),
      fillPercent: Math.round((contentPx / usablePx) * 100),
    };
  });
}

function blankBandIn(page: PageGeometry): number {
  return Math.max(0, PRINTABLE_HEIGHT_IN - page.contentHeightIn);
}

/**
 * geometryToolNotes(pages): actionable wording for the create_printable
 * result, one note per problem page, nothing for pages that fit. An
 * overflowing page gets only the overflow note (its fill number is a
 * side effect of the same defect).
 */
export function geometryToolNotes(pages: readonly PageGeometry[]): string[] {
  const notes: string[] = [];
  for (const page of pages) {
    if (page.overflowIn >= OVERFLOW_NOTE_MIN_IN) {
      notes.push(
        `Page ${page.page} runs ${formatIn(page.overflowIn)}in past the printable area; everything past the 11in page box is cut in print, not shrunk. Tighten spacing or type, or move content to its own page.`,
      );
      continue;
    }
    const blankIn = blankBandIn(page);
    if (blankIn >= UNDERFILL_NOTE_MIN_BLANK_IN) {
      const rows = Math.max(1, Math.round(blankIn / EXERCISE_ROW_IN));
      notes.push(
        `Page ${page.page} fill is ${page.fillPercent}%: content ends ${formatIn(page.contentHeightIn)}in down the ${PRINTABLE_HEIGHT_IN}in printable area, leaving about ${formatIn(blankIn)}in blank at the bottom (room for roughly ${rows} more exercise ${rows === 1 ? "row" : "rows"}). Weigh this against this child's age band in the page-density table (materials-studio skill): add rows or scale type and spacing up only when that band calls for more items, or spread the existing items down the page. Never pad with filler content to raise the number.`,
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
): string | null {
  if (pages.length === 0) return null;
  const lines = pages.map((page) => {
    if (page.overflowIn >= OVERFLOW_NOTE_MIN_IN) {
      return `- page ${page.page}: content overflows the page box by ${formatIn(page.overflowIn)}in; anything past 11in is cut in print`;
    }
    const blankIn = blankBandIn(page);
    if (blankIn >= UNDERFILL_NOTE_MIN_BLANK_IN) {
      return `- page ${page.page}: content ends ${formatIn(page.contentHeightIn)}in down the ${PRINTABLE_HEIGHT_IN}in printable area (${page.fillPercent}% fill, about ${formatIn(blankIn)}in blank at the bottom)`;
    }
    return `- page ${page.page}: ${page.fillPercent}% fill, fits the page`;
  });
  return `Measured page geometry, deterministic from the renderer (trust these numbers over your own estimate of the image):\n${lines.join("\n")}`;
}
