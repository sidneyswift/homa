import { z } from "zod";

import { mapDb } from "../map/db";
import type { MeasuredBoxIn, PageGeometry } from "./page-geometry";

/**
 * The size floor for revisions (2026-09-02). A letter-formation worksheet
 * shipped too small to trace after a revision fixing page overflow
 * shrank the embedded letters to make room; nobody asked for smaller and
 * nothing measured it. The recipe already said "size is a floor, not a
 * target"; this module makes the renderer enforce it.
 *
 * The rule: for every FRESH page of a revision, the largest picture, the
 * largest text, and the largest bordered box may not come out more than
 * a tenth smaller than on the version being revised. A finding is a
 * renderer proof, the same class founder ruling `cutoff-page-is-a-block`
 * (2026-07-29) treats as never-deliver, so create_printable refuses the
 * revision unless `allowSizeReduction` is set, which records that the
 * model claims the parent asked for or agreed to it. The refusal tells
 * Homa to fix the original problem without shrinking, or to ask her,
 * never to shrink silently.
 *
 * Fail open on the data, but never silently: every reason the comparison
 * did not run is a SizeFloorStatus, persisted on the row and said out
 * loud in the tool result, so a floor that quietly compares nothing
 * cannot pass for one that held.
 */

/** A fresh page's signal below this fraction of the revised version is a finding. */
export const SIZE_FLOOR_SHRINK_RATIO = 0.9;
/** Pictures shorter than this before the revision are decoration, not a floor. */
export const SIZE_FLOOR_MIN_IMAGE_IN = 1;
/** Text smaller than this before the revision is fine print, not a floor. */
export const SIZE_FLOOR_MIN_TEXT_PX = 14;
/** Boxes shorter than this before the revision are checkboxes, not practice space. */
export const SIZE_FLOOR_MIN_BOX_IN = 0.75;

export type SizeFloorSignal = "image" | "text" | "box";

export type SizeFloorFinding =
  | {
      page: number;
      signal: "image" | "box";
      before: MeasuredBoxIn;
      after: MeasuredBoxIn;
      /** sqrt of the area ratio: the linear shrink. */
      ratio: number;
    }
  | {
      page: number;
      signal: "text";
      /** Font size in CSS px at the render viewport. */
      before: number;
      after: number;
      ratio: number;
    };

/**
 * Why the floor did or did not compare. `compared` is the only status
 * under which findings can exist; every other status is a reason the
 * check did not run, persisted so it can be counted, and (except
 * `no-revision`) reported to Homa so she compares by eye.
 */
export type SizeFloorStatus =
  | "compared"
  | "no-revision"
  | "pre-signal"
  | "not-found"
  | "read-failed"
  | "unparseable"
  | "page-count-mismatch"
  | "image-page"
  | "measurement-error";

export interface SizeFloorEvaluation {
  status: SizeFloorStatus;
  findings: SizeFloorFinding[];
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function boxShrink(
  page: number,
  signal: "image" | "box",
  before: MeasuredBoxIn,
  after: MeasuredBoxIn,
  minHeightIn: number,
): SizeFloorFinding | null {
  const beforeArea = before.widthIn * before.heightIn;
  const afterArea = after.widthIn * after.heightIn;
  if (before.heightIn < minHeightIn || beforeArea <= 0) return null;
  const ratio = Math.sqrt(afterArea / beforeArea);
  if (ratio >= SIZE_FLOOR_SHRINK_RATIO) return null;
  return { page, signal, before, after, ratio: round(ratio, 3) };
}

/**
 * compareSizeFloor(previous, next, freshPages): every fresh page whose
 * largest picture, text, or bordered box came out more than a tenth
 * smaller than the same page of the revised version. Pages are matched
 * by number (evaluateSizeFloor refuses to call this when the page counts
 * differ); a signal that is null after (the picture was removed) is not
 * a finding, and a previous entry without the signal compares nothing.
 */
export function compareSizeFloor(
  previous: readonly PageGeometry[],
  next: readonly PageGeometry[],
  freshPages: ReadonlySet<number>,
): SizeFloorFinding[] {
  const previousByPage = new Map(previous.map((page) => [page.page, page]));
  const findings: SizeFloorFinding[] = [];
  for (const page of next) {
    if (!freshPages.has(page.page)) continue;
    const before = previousByPage.get(page.page);
    if (!before) continue;

    if (before.largestImageIn && page.largestImageIn) {
      const finding = boxShrink(
        page.page,
        "image",
        before.largestImageIn,
        page.largestImageIn,
        SIZE_FLOOR_MIN_IMAGE_IN,
      );
      if (finding) findings.push(finding);
    }

    if (
      typeof before.largestTextPx === "number"
      && typeof page.largestTextPx === "number"
      && before.largestTextPx >= SIZE_FLOOR_MIN_TEXT_PX
    ) {
      const ratio = page.largestTextPx / before.largestTextPx;
      if (ratio < SIZE_FLOOR_SHRINK_RATIO) {
        findings.push({
          page: page.page,
          signal: "text",
          before: before.largestTextPx,
          after: page.largestTextPx,
          ratio: round(ratio, 3),
        });
      }
    }

    if (before.largestBoxIn && page.largestBoxIn) {
      const finding = boxShrink(
        page.page,
        "box",
        before.largestBoxIn,
        page.largestBoxIn,
        SIZE_FLOOR_MIN_BOX_IN,
      );
      if (finding) findings.push(finding);
    }
  }
  return findings;
}

function carriesSignals(page: PageGeometry): boolean {
  return (
    page.largestImageIn !== undefined
    || page.largestTextPx !== undefined
    || page.largestBoxIn !== undefined
  );
}

/**
 * evaluateSizeFloor(input): the status and findings for one revision.
 * Decides, in order: no revision to compare against; a whole-page image
 * (nothing measurable inside; the checklist and the anchor carry that
 * format); a load that did not produce geometry; a renderer that could
 * not measure a page on either side; a page count that changed (a new
 * cover page must not compare new page 1 with old page 1); a revised
 * version stored before the signals existed; and only then the real
 * comparison.
 */
export function evaluateSizeFloor(input: {
  revised: RevisedGeometryLoad | null;
  imagePage: boolean;
  next: readonly PageGeometry[];
  freshPages: ReadonlySet<number>;
}): SizeFloorEvaluation {
  const { revised } = input;
  if (revised === null) return { status: "no-revision", findings: [] };
  // A load that produced nothing is reported before the image-page skip:
  // a double read failure on an image-direct revision is a read failure
  // worth counting, not a page shape that was never going to compare.
  if (revised.status !== "ok") return { status: revised.status, findings: [] };
  if (input.imagePage) return { status: "image-page", findings: [] };
  const previous = revised.geometry;
  const freshNext = input.next.filter((page) => input.freshPages.has(page.page));
  const previousByPage = new Map(previous.map((page) => [page.page, page]));
  if (
    freshNext.some(
      (page) => page.measurementError || previousByPage.get(page.page)?.measurementError,
    )
  ) {
    return { status: "measurement-error", findings: [] };
  }
  if (previous.length !== input.next.length) {
    return { status: "page-count-mismatch", findings: [] };
  }
  if (!previous.some(carriesSignals)) return { status: "pre-signal", findings: [] };
  return {
    status: "compared",
    findings: compareSizeFloor(previous, input.next, input.freshPages),
  };
}

/** "3.4", "2", never "2.0": inches the way a person says them. */
function formatIn(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

function formatBox(box: MeasuredBoxIn): string {
  return `${formatIn(box.widthIn)}in x ${formatIn(box.heightIn)}in`;
}

function percentSmaller(ratio: number): number {
  return Math.max(1, Math.round((1 - ratio) * 100));
}

function describeFinding(finding: SizeFloorFinding): string {
  const smaller = `${percentSmaller(finding.ratio)}% smaller`;
  switch (finding.signal) {
    case "image":
      return `page ${finding.page}'s largest picture went from ${formatBox(finding.before)} to ${formatBox(finding.after)} (${smaller} overall)`;
    case "box":
      return `page ${finding.page}'s largest bordered box went from ${formatBox(finding.before)} to ${formatBox(finding.after)} (${smaller} overall)`;
    case "text":
      return `the biggest text on page ${finding.page} went from ${finding.before}px to ${finding.after}px (${smaller})`;
    default: {
      const exhaustive: never = finding;
      throw new Error(`Unhandled size-floor finding: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function joinFindings(findings: readonly SizeFloorFinding[]): string {
  const parts = findings.map(describeFinding);
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** The stable prefix every refusal starts with, so refusals are countable
 * in agent_tool_calls. */
export const SIZE_FLOOR_REFUSAL_PREFIX = "Not sent (size floor):";

/**
 * sizeFloorRefusalNote(findings, recipe): the model-readable reason a
 * revision was not made, and what to do instead. It names the parent's
 * consent as the only way past, never a technical excuse.
 */
export function sizeFloorRefusalNote(
  findings: readonly SizeFloorFinding[],
  recipe: string | null,
): string {
  const scope = recipe
    ? `A size that has already rendered acceptably is a floor for every later revision of the same material (${recipe} recipe).`
    : "A size that has already rendered acceptably is a floor for every later revision of the same material.";
  return `${SIZE_FLOOR_REFUSAL_PREFIX} in this revision, ${joinFindings(findings)}. ${scope} Fix the problem you were solving without shrinking: drop something else on the page, or move content to its own page. Removing the largest element (a header, a frame, an answer key moved to its own page) also reads as shrinking; when the parent asked for that change, that is a legitimate reason for allowSizeReduction. If the parent asked for smaller, or you asked her and she agreed, call again with allowSizeReduction: true and quote her words in requestSummary. Otherwise ask her one plain question before trading size away; never shrink silently, and never call this a technical problem.`;
}

/**
 * sizeFloorAllowedNote(findings): appended to a successful result when
 * allowSizeReduction let a smaller revision through, so the size change
 * is on the record beside the request that permitted it.
 */
export function sizeFloorAllowedNote(findings: readonly SizeFloorFinding[]): string {
  return `Size floor: in this version, ${joinFindings(findings)}; allowed because allowSizeReduction was set, with requestSummary as the record of what she asked for.`;
}

const SKIP_REASONS: Record<Exclude<SizeFloorStatus, "compared" | "no-revision">, string> = {
  "pre-signal": "the version it revises was made before size signals were recorded",
  "not-found": "the version it revises could not be found in this family",
  "read-failed": "the revised version's geometry could not be read",
  unparseable: "the revised version's stored geometry did not parse",
  "page-count-mismatch": "the page count changed, so pages cannot be matched",
  "image-page": "a whole-page image cannot be measured inside",
  "measurement-error": "the renderer could not measure this page",
};

/**
 * sizeCheckSkippedNote(status): one sentence for the tool result whenever
 * a revision's size check did not run, so Homa compares by eye instead of
 * assuming the floor held. Null for the two statuses that need no
 * sentence: a real comparison, and a first version with nothing to
 * compare against.
 */
export function sizeCheckSkippedNote(status: SizeFloorStatus): string | null {
  if (status === "compared" || status === "no-revision") return null;
  return `The size check did not run on this version (${SKIP_REASONS[status]}); compare the new page against the previous version yourself before sending.`;
}

const measuredBoxInSchema = z
  .object({ widthIn: z.number(), heightIn: z.number() })
  .nullable()
  .optional();

const storedPageGeometrySchema = z.array(
  z.object({
    page: z.number().int().positive(),
    contentHeightIn: z.number(),
    overflowIn: z.number(),
    fillPercent: z.number(),
    largestImageIn: measuredBoxInSchema,
    largestTextPx: z.number().nullable().optional(),
    largestBoxIn: measuredBoxInSchema,
    measurementError: z.boolean().optional(),
  }),
);

export type RevisedGeometryLoad =
  | { status: "ok"; geometry: PageGeometry[] }
  | { status: "not-found" | "read-failed" | "unparseable" | "pre-signal" };

/** One read of the revised row: absent when no row matched the id inside
 * this family, otherwise whatever generation.pageGeometry holds. */
export type RevisedGeometryReader = (input: {
  familyId: string;
  materialId: string;
}) => Promise<{ found: false } | { found: true; pageGeometry: unknown }>;

const defaultReader: RevisedGeometryReader = async (input) => {
  const sql = mapDb();
  const rows = await sql<{ page_geometry: unknown }[]>`
    select generation->'pageGeometry' as page_geometry
    from public.materials
    where id = ${input.materialId}
      and family_id = ${input.familyId}
    limit 1
  `;
  if (rows.length === 0) return { found: false };
  return { found: true, pageGeometry: rows[0].page_geometry };
};

/**
 * loadRevisedPageGeometry({ familyId, materialId }): the stored geometry
 * of the version being revised, or the reason there is none. The family
 * predicate is the tenancy wall: a model-supplied revisesId from another
 * family reads as not-found, the same posture as
 * family-asset-provenance.ts. A read that throws is retried once, then
 * recorded as read-failed; a row whose geometry does not parse is logged
 * and recorded as unparseable; a row from before geometry was stored is
 * pre-signal. Never throws.
 */
export async function loadRevisedPageGeometry(
  input: { familyId: string; materialId: string },
  reader: RevisedGeometryReader = defaultReader,
): Promise<RevisedGeometryLoad> {
  let row: Awaited<ReturnType<RevisedGeometryReader>> | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2 && row === null; attempt += 1) {
    try {
      row = await reader(input);
    } catch (error) {
      lastError = error;
    }
  }
  if (row === null) {
    console.error(
      `size floor: reading the revised version's geometry failed twice (comparing nothing) for material ${input.materialId} in family ${input.familyId}:`,
      lastError instanceof Error ? lastError.message : "unknown",
    );
    return { status: "read-failed" };
  }
  if (!row.found) return { status: "not-found" };
  if (row.pageGeometry === null || row.pageGeometry === undefined) {
    return { status: "pre-signal" };
  }
  const parsed = storedPageGeometrySchema.safeParse(row.pageGeometry);
  if (!parsed.success) {
    console.warn(
      `size floor: revised material ${input.materialId} has unparseable pageGeometry (comparing nothing): ${parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
    return { status: "unparseable" };
  }
  return { status: "ok", geometry: parsed.data };
}
