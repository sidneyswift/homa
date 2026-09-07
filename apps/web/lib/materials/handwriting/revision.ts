import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

import { splitPageBodies } from "../page-shell";
import type { PageGeometry } from "../page-geometry";
import { compareSizeFloor, type SizeFloorFinding } from "../size-floor";
import { composeHandwritingRow, HandwritingDocumentError, prepareHandwritingDocument, type HandwritingPage, type HandwritingReceipt } from "./document";
import type { HandwritingPredecessor } from "./revision-reference";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const refuse = (message: string): never => { throw new HandwritingDocumentError(message); };
const savedRenderSchema = z.object({
  status: z.literal("verified"), pdfSha256: z.string().regex(/^[a-f0-9]{64}$/),
  pageCount: z.int().min(1).max(12), pageWidthPoints: z.literal(612), pageHeightPoints: z.literal(792),
  placements: z.array(z.object({
    page: z.int().min(1).max(12), id: z.string(), documentRowId: z.string(),
    x: z.number().finite(), y: z.number().finite(), width: z.number().positive(), height: z.number().positive(), guideHeightPoints: z.number().positive(),
  })).max(96),
});
export interface HandwritingRevisionSource {
  /** Supplied only by the existing authenticated material reader. */
  id: string; html: string; handwritingRows?: unknown; handwritingRender?: unknown;
}
export interface LegacyRowTarget {
  page: number; svgOrdinal: number; source: string; sourceSha256: string;
  nextRowId: string; nextText: string; nextCapHeight: number;
}
export interface RowBandComparison {
  predecessor: HandwritingPredecessor;
  nextDocumentRowId: string;
  before: { cap: number; body: number; descender: number | null };
  after: { cap: number; body: number; descender: number };
  reduced: boolean;
}
export interface HandwritingRevisionPlan {
  version: 1; sourceMaterialId: string; sourceHtmlSha256: string;
  sourceBodies: string[]; legacyTargets: LegacyRowTarget[];
  guided: RowBandComparison[]; omittedGuidedRows: string[];
  reductionAllowedByModel: boolean;
}

/** Exact bounded source tokenization, never a classifier of what a row means.
 * Browser verification separately requires matching DOM structure. Nested SVG,
 * strings in comments/styles and parser repair cannot become approved evidence. */
export function legacySvgSources(body: string) {
  if (body.length > 120_000) return refuse("The saved page is too large for a bounded handwriting comparison.");
  const items = [...body.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg\s*>/gi)];
  if (items.length > 96 || items.some((item) => /<svg\b/i.test(item[0].slice(4)))) return refuse("The saved SVG structure cannot be matched safely.");
  return items.map((item, index) => ({ ordinal: index + 1, source: item[0], sourceSha256: hash(item[0]), start: item.index! }));
}

function compareBands(predecessor: HandwritingPredecessor, next: HandwritingReceipt, cap: number, body: number, descender: number | null): RowBandComparison {
  const guides = next.composition.guides;
  const after = { cap: guides.baseline - guides.cap, body: guides.baseline - guides.xHeight, descender: guides.descender - guides.baseline };
  // No generic 10% area allowance here: these are explicit physical bands.
  const reduced = after.cap + 0.01 < cap || after.body + 0.01 < body || descender !== null && after.descender + 0.01 < descender;
  return { predecessor, nextDocumentRowId: next.documentRowId, before: { cap, body, descender }, after, reduced };
}

export function prepareHandwritingRevision(input: {
  source: HandwritingRevisionSource; pages: readonly HandwritingPage[];
  current: ReturnType<typeof prepareHandwritingDocument>; allowSizeReduction: boolean;
}): HandwritingRevisionPlan {
  const { source, pages, current, allowSizeReduction } = input;
  if (!source.html || source.html.length > 120_000) return refuse("The exact saved source is unavailable for a handwriting size comparison.");
  const sourceBodies = splitPageBodies(source.html);
  if (sourceBodies.length < 1 || sourceBodies.length > 12) return refuse("The saved page count cannot be verified.");
  const old = prepareHandwritingDocument(sourceBodies.map((body, index) => ({ body, fresh: false, carriedRows: source.handwritingRows, carriedPage: index + 1 })));
  const oldRows = new Map(old.receipts.map((row) => [row.documentRowId, row]));
  if (oldRows.size) {
    const render = savedRenderSchema.safeParse(source.handwritingRender);
    if (!render.success || render.data.pageCount !== sourceBodies.length || render.data.placements.length !== oldRows.size) return refuse("The saved handwriting print receipt is missing. Keep the original; its physical size was not verified.");
    const seen = new Set<string>();
    for (const placement of render.data.placements) {
      const row = oldRows.get(placement.documentRowId);
      if (!row || seen.has(placement.documentRowId) || placement.id !== row.input.id || placement.page !== row.page || Math.abs(placement.width - row.composition.width) > 0.1 || Math.abs(placement.height - row.composition.height) > 0.1 || Math.abs(placement.guideHeightPoints - row.composition.guideHeightPoints) > 0.01) return refuse("The saved handwriting print receipt differs from its composition.");
      seen.add(placement.documentRowId);
    }
  }
  const covered = new Set<string>();
  const guided: RowBandComparison[] = [];
  const legacyTargets: LegacyRowTarget[] = [];
  for (const row of current.receipts) {
    const declared = pages[row.page - 1].handwritingRows?.find((item) => item.id === row.input.id);
    const predecessor = declared?.predecessor;
    if (!pages[row.page - 1].fresh) {
      if (row.carriedFrom?.materialId === source.id) {
        const key = `${row.carriedFrom.page}/${row.carriedFrom.rowId}`;
        const oldRow = oldRows.get(key);
        if (!oldRow || composeHandwritingRow(oldRow.input).markup !== composeHandwritingRow(row.input).markup) return refuse("A carried row does not match this revision's predecessor.");
        covered.add(key);
      }
      continue;
    }
    if (!predecessor) continue;
    if (predecessor.kind === "guided") {
      const key = `${predecessor.page}/${predecessor.rowId}`;
      const oldRow = oldRows.get(key);
      if (!oldRow) return refuse("The selected predecessor row does not exist in this saved material.");
      const guides = oldRow.composition.guides;
      guided.push(compareBands(predecessor, row, guides.baseline - guides.cap, guides.baseline - guides.xHeight, guides.descender - guides.baseline));
      covered.add(key);
    } else {
      if (predecessor.page !== row.page || sourceBodies.length !== pages.length) return refuse("A legacy guide conversion must keep its page correspondence. Preserve the original and explain when a different layout needs a separate revision.");
      const oldPage = sourceBodies[predecessor.page - 1];
      if (!oldPage) return refuse("The selected old page does not exist.");
      const svg = legacySvgSources(oldPage)[predecessor.svgOrdinal - 1];
      if (!svg || legacyTargets.some((item) => item.page === predecessor.page && item.svgOrdinal === predecessor.svgOrdinal)) return refuse("The selected old SVG is missing or was selected twice.");
      legacyTargets.push({ page: predecessor.page, svgOrdinal: predecessor.svgOrdinal, source: svg.source, sourceSha256: svg.sourceSha256, nextRowId: row.input.id, nextText: row.input.text, nextCapHeight: row.composition.capHeight });
    }
  }
  for (const pageNumber of new Set(legacyTargets.map((item) => item.page))) {
    let expected = sourceBodies[pageNumber - 1];
    const sources = legacySvgSources(expected);
    // Exact offsets avoid ambiguity when two old rows have identical bytes.
    for (const target of legacyTargets.filter((item) => item.page === pageNumber).sort((a, b) => b.svgOrdinal - a.svgOrdinal)) {
      const svg = sources[target.svgOrdinal - 1];
      expected = expected.slice(0, svg.start) + `<!-- homa:handwriting ${target.nextRowId} -->` + expected.slice(svg.start + svg.source.length);
    }
    if (pages[pageNumber - 1].body.trim() !== expected) return refuse("A legacy conversion must preserve the exact surrounding saved HTML. Replace only the selected SVG rows with their declared placeholders; change other content in a separate revision.");
  }
  const omittedGuidedRows = [...oldRows.keys()].filter((key) => !covered.has(key));
  if (omittedGuidedRows.length && !allowSizeReduction) return refuse("Every saved guided row needs an exact replacement or carried page. A new ID or extra page does not prove the old letter size was preserved.");
  if (current.receipts.length && !oldRows.size && !legacyTargets.length) return refuse("This older material has no verified guided-row receipt. Select an exact legacy SVG predecessor; do not guess its physical size.");
  if (guided.some((row) => row.reduced) && !allowSizeReduction) return refuse("A replacement reduced a saved cap, small-letter body or descender band. Keep those physical sizes and change the layout instead.");
  return { version: 1, sourceMaterialId: source.id, sourceHtmlSha256: hash(source.html), sourceBodies, legacyTargets, guided, omittedGuidedRows, reductionAllowedByModel: allowSizeReduction };
}

export interface LegacyRowMeasurement { page: number; svgOrdinal: number; text: string; cap: number; body: number; fontSha256: string; fontSize: number; }
export interface LegacyComparisonProof {
  sourceHtmlSha256: string; rows: LegacyRowMeasurement[];
  originalGeometry: PageGeometry[]; ordinaryGeometry: PageGeometry[];
}

/** Only the exact authenticated source replay can qualify a representation
 * change. All raw geometry remains persisted; no derived font size replaces it. */
export function evaluateHandwritingRevision(input: {
  plan: HandwritingRevisionPlan; current: ReturnType<typeof prepareHandwritingDocument>;
  proof?: LegacyComparisonProof; previousGeometry: readonly PageGeometry[];
  currentOrdinaryGeometry: readonly PageGeometry[]; genericFindings: readonly SizeFloorFinding[];
}) {
  const { plan, proof } = input;
  if (!plan.legacyTargets.length) return { comparisons: plan.guided, findings: [...input.genericFindings], legacyProof: null };
  if (!proof || proof.sourceHtmlSha256 !== plan.sourceHtmlSha256 || proof.rows.length !== plan.legacyTargets.length || proof.originalGeometry.length !== input.previousGeometry.length) return refuse("The exact old guide/font proof is unavailable. The normal size floor remains in force.");
  for (const old of input.previousGeometry) {
    const replay = proof.originalGeometry.find((item) => item.page === old.page);
    // A replay with different maxima cannot attribute the old 174px signal.
    if (!replay || old.measurementError || replay.measurementError || old.largestTextPx !== replay.largestTextPx || !isDeepStrictEqual(old.largestImageIn, replay.largestImageIn) || !isDeepStrictEqual(old.largestBoxIn, replay.largestBoxIn)) return refuse("The replay differs from the saved size signals. No legacy text comparison was waived.");
  }
  const comparisons = [...plan.guided];
  for (const target of plan.legacyTargets) {
    const measured = proof.rows.filter((item) => item.page === target.page && item.svgOrdinal === target.svgOrdinal);
    const next = input.current.receipts.find((row) => row.page === target.page && row.input.id === target.nextRowId)!;
    if (measured.length !== 1 || measured[0].text !== next.input.text) return refuse("The selected legacy text or row differs from its replacement.");
    comparisons.push(compareBands({ kind: "legacy-svg", page: target.page, svgOrdinal: target.svgOrdinal }, next, measured[0].cap, measured[0].body, null));
  }
  if (comparisons.some((row) => row.reduced) && !plan.reductionAllowedByModel) return refuse("The correction reduced the old writing-guide cap or body height. Keep the measured guide targets and give the row its full frame.");
  const pages = new Set(plan.legacyTargets.map((item) => item.page));
  if (proof.ordinaryGeometry.length !== proof.originalGeometry.length || input.currentOrdinaryGeometry.length !== proof.originalGeometry.length) return refuse("The surrounding-content comparison is incomplete.");
  for (const page of pages) {
    const before = proof.ordinaryGeometry.find((item) => item.page === page);
    const after = input.currentOrdinaryGeometry.find((item) => item.page === page);
    if (!before || !after || before.measurementError || after.measurementError || before.largestTextPx === undefined || after.largestTextPx === undefined || before.largestImageIn === undefined || after.largestImageIn === undefined || before.largestBoxIn === undefined || after.largestBoxIn === undefined) return refuse("The surrounding-content size signals are unavailable.");
    if (before.largestTextPx !== null && after.largestTextPx === null || before.largestImageIn !== null && after.largestImageIn === null || before.largestBoxIn !== null && after.largestBoxIn === null) return refuse("The legacy conversion removed surrounding printed content. Preserve it in this correction.");
  }
  const ordinary = compareSizeFloor(proof.ordinaryGeometry, input.currentOrdinaryGeometry, pages);
  // Only the incomparable text finding on exactly proven converted pages is
  // replaced by the ordinary-text check. Raw image and box floors still apply.
  const findings = [...input.genericFindings.filter((finding) => finding.signal !== "text" || !pages.has(finding.page)), ...ordinary];
  return { comparisons, findings, legacyProof: proof };
}
