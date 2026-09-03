import { z } from "zod";

import { mapDb } from "../map/db";
import type { PageGeometry } from "./page-geometry";

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
 * revision unless `allowSizeReduction` records that the parent asked
 * for smaller or agreed to it. The refusal tells Homa to fix the original
 * problem without shrinking, or to ask her, never to shrink silently.
 *
 * Fail open on the data: geometry stored before the signals existed, a
 * revised row that cannot be read, or a page with nothing of a kind to
 * compare, all compare nothing. Carried pages (fromMaterialId) are never
 * compared; they were already final once.
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

export interface SizeFloorFinding {
  page: number;
  signal: SizeFloorSignal;
  /** Height in inches for image and box, font size in px for text. */
  before: number;
  after: number;
  /** Linear shrink: sqrt of the area ratio for image and box, the plain
   * ratio for text. Below SIZE_FLOOR_SHRINK_RATIO is a finding. */
  ratio: number;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * compareSizeFloor(previous, next, freshPages): every fresh page whose
 * largest picture, text, or bordered box came out more than a tenth
 * smaller than the same page of the revised version. Pages are matched
 * by number; a signal that is null after (the picture was removed) is
 * not a finding, and a previous entry without the signals compares
 * nothing.
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
      const beforeArea = before.largestImageIn.widthIn * before.largestImageIn.heightIn;
      const afterArea = page.largestImageIn.widthIn * page.largestImageIn.heightIn;
      if (before.largestImageIn.heightIn >= SIZE_FLOOR_MIN_IMAGE_IN && beforeArea > 0) {
        const ratio = Math.sqrt(afterArea / beforeArea);
        if (ratio < SIZE_FLOOR_SHRINK_RATIO) {
          findings.push({
            page: page.page,
            signal: "image",
            before: before.largestImageIn.heightIn,
            after: page.largestImageIn.heightIn,
            ratio: round(ratio, 3),
          });
        }
      }
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
      const beforeArea = before.largestBoxIn.widthIn * before.largestBoxIn.heightIn;
      const afterArea = page.largestBoxIn.widthIn * page.largestBoxIn.heightIn;
      if (before.largestBoxIn.heightIn >= SIZE_FLOOR_MIN_BOX_IN && beforeArea > 0) {
        const ratio = Math.sqrt(afterArea / beforeArea);
        if (ratio < SIZE_FLOOR_SHRINK_RATIO) {
          findings.push({
            page: page.page,
            signal: "box",
            before: before.largestBoxIn.heightIn,
            after: page.largestBoxIn.heightIn,
            ratio: round(ratio, 3),
          });
        }
      }
    }
  }
  return findings;
}

/** "3.4", "2", never "2.0": inches the way a person says them. */
function formatIn(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

function percentSmaller(finding: SizeFloorFinding): number {
  return Math.max(1, Math.round((1 - finding.ratio) * 100));
}

function describeFinding(finding: SizeFloorFinding): string {
  const smaller = `${percentSmaller(finding)}% smaller`;
  switch (finding.signal) {
    case "image":
      return `page ${finding.page}'s largest picture about ${formatIn(finding.after)}in tall where the version it revises had it at ${formatIn(finding.before)}in (${smaller} overall)`;
    case "box":
      return `page ${finding.page}'s largest practice box about ${formatIn(finding.after)}in tall where the version it revises had it at ${formatIn(finding.before)}in (${smaller} overall)`;
    case "text":
      return `the biggest text on page ${finding.page} went from ${finding.before}px to ${finding.after}px (${smaller})`;
    default: {
      const exhaustive: never = finding.signal;
      throw new Error(`Unhandled size-floor signal: ${String(exhaustive)}`);
    }
  }
}

function joinFindings(findings: readonly SizeFloorFinding[]): string {
  const parts = findings.map(describeFinding);
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

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
  return `Not sent: this revision made ${joinFindings(findings)}. ${scope} Fix the problem you were solving without shrinking: regenerate the art at another aspect ratio, drop something else on the page, or move content to its own page. If the parent asked for smaller, or you asked her and she agreed, call again with allowSizeReduction: true and quote her words in requestSummary. Otherwise ask her one plain question before trading size away; never shrink silently, and never call this a technical problem.`;
}

/**
 * sizeFloorAllowedNote(findings): appended to a successful result when
 * allowSizeReduction let a smaller revision through, so the size change
 * is on the record beside the consent that permitted it.
 */
export function sizeFloorAllowedNote(findings: readonly SizeFloorFinding[]): string {
  return `Size floor: this version made ${joinFindings(findings)}; allowed because allowSizeReduction recorded the parent's choice. Her words asking for smaller belong in requestSummary if they are not there yet.`;
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
  }),
);

/**
 * loadRevisedPageGeometry({ familyId, materialId }): the stored geometry
 * of the version being revised, or null when there is nothing usable to
 * compare against (foreign or unknown id, a row from before geometry was
 * stored, an unparseable shape, or a read failure). The family predicate
 * is the tenancy wall: a model-supplied revisesId from another family
 * reads as nothing, the same posture as family-asset-provenance.ts.
 * Never throws; the floor fails open on data.
 */
export async function loadRevisedPageGeometry(input: {
  familyId: string;
  materialId: string;
}): Promise<PageGeometry[] | null> {
  try {
    const sql = mapDb();
    const rows = await sql<{ page_geometry: unknown }[]>`
      select generation->'pageGeometry' as page_geometry
      from public.materials
      where id = ${input.materialId}
        and family_id = ${input.familyId}
      limit 1
    `;
    const parsed = storedPageGeometrySchema.safeParse(rows[0]?.page_geometry);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    console.error(
      "size floor: reading the revised version's geometry failed (comparing nothing):",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}
