import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

import { guidedRow, GuidedRowError, type GuidedRowInput } from "./row";
import { handwritingPredecessorSchema, type HandwritingPredecessor } from "./revision-reference";

export type HandwritingRowDeclaration = GuidedRowInput & { predecessor?: HandwritingPredecessor };

export const handwritingRowSchema = z.object({
  predecessor: handwritingPredecessorSchema,
  id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/).describe("Unique row ID across the document. Place exactly <!-- homa:handwriting ID --> in that fresh HTML page."),
  text: z.string().max(32).describe("Literal NFC spelling and case. Supported: A-Z, a-z, space, straight apostrophe, hyphen, À à È è. Empty only for independent guides. No normalization or font fallback."),
  style: z.enum(["model", "pale", "dotted", "independent"]).describe("Dark example, pale tracing, dotted outline tracing, or empty writing guides. Dots do not indicate stroke order."),
  capHeight: z.number().min(64).max(128).describe("Top guide to baseline in CSS px, 96 px per printed inch. Row height is capHeight × 1.9375 including accent and descender space. Never shrink to fit."),
  width: z.number().min(240).max(700).optional().describe("Printed row width in CSS px; defaults to 700. Choose layout or fewer repetitions if the exact text cannot fit."),
}).strict();

export const handwritingRowsSchema = z.array(handwritingRowSchema).min(1).max(24)
  .optional().describe("Server-composed guided writing rows for this fresh HTML page. One exact placeholder per ID. Do not draw replacement text, paths, guides, or starting dots by hand.");

export class HandwritingDocumentError extends Error {}
const reject = (message: string): never => { throw new HandwritingDocumentError(message); };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const escapeAttribute = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const reserved = /data-homa-handwriting-row\b|homa:handwriting/i;

export function composeHandwritingRow(input: GuidedRowInput) {
  const parsed = handwritingRowSchema.safeParse(input);
  if (!parsed.success) return reject("Use a supported handwriting row with literal text and bounded dimensions.");
  const row = guidedRow(parsed.data);
  const src = `data:image/svg+xml;base64,${Buffer.from(row.svg).toString("base64")}`;
  // An SVG image is a separate, script-free image document. Page selectors
  // cannot rewrite its paths, guides, fills, or stroke widths.
  const markup = `<img data-homa-handwriting-row="${input.id}" src="${src}" alt="${escapeAttribute(input.style === "independent" ? "Independent writing guides" : input.text)}" width="${row.receipt.width}" height="${row.receipt.height}" style="display:block;width:${row.receipt.width}px;height:${row.receipt.height}px;max-width:none;object-fit:fill" />`;
  return { ...row, src, markup };
}
export interface HandwritingReceipt {
  version: 1;
  documentRowId: string;
  carriedFrom?: { materialId: string; page: number; rowId: string };
  page: number;
  input: HandwritingRowDeclaration;
  composition: ReturnType<typeof guidedRow>["receipt"];
  markupSha256: string;
}
export interface HandwritingPage {
  body: string;
  fresh: boolean;
  handwritingRows?: readonly HandwritingRowDeclaration[];
  carriedRows?: unknown;
  carriedPage?: number;
  carriedMaterialId?: string;
}
export interface HandwritingExpectation {
  page: number;
  id: string;
  documentRowId: string;
  src: string;
  width: number;
  height: number;
  capHeight: number;
}

/** The caller supplies only the generation field from an authenticated row. */
export function selectCarriedHandwritingRows(raw: unknown, pageIndex?: number): unknown[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 96) return reject("The saved handwriting record could not be verified. Reopen the original material; no replacement was made.");
  return raw.filter((item) => {
    if (!item || typeof item !== "object" || !Number.isInteger(item.page) || item.page < 1 || item.page > 12) return reject("The saved handwriting page record is invalid.");
    return pageIndex === undefined || item.page === pageIndex;
  });
}

export function prepareHandwritingDocument(pages: readonly HandwritingPage[], requireGuidedRows = false) {
  const ids = new Set<string>();
  const freshIds = new Set<string>();
  const receipts: HandwritingReceipt[] = [];
  const expectations: HandwritingExpectation[] = [];
  const bodies = pages.map((page, index) => {
    let body = page.body;
    const carried = selectCarriedHandwritingRows(page.carriedRows, page.carriedPage);
    if (page.fresh && (carried.length || reserved.test(body.replace(/<!-- homa:handwriting [a-z][a-z0-9-]{0,39} -->/g, "")))) return reject("Fresh handwriting HTML must use declared placeholders, not reserved row markup.");
    if (!page.fresh && page.handwritingRows?.length) return reject("An unchanged page cannot also declare new handwriting rows.");
    const pageIds = new Set<string>();
    const entries = page.fresh ? (page.handwritingRows ?? []).map((input) => ({ input })) : carried;
    if (entries.length > 24) return reject("Use at most 24 handwriting rows per page.");
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || !("input" in entry)) return reject("The saved handwriting row is missing its input receipt.");
      const row = composeHandwritingRow(entry.input as GuidedRowInput);
      const { id } = row.receipt;
      if (pageIds.has(id) || (page.fresh ? ids.has(id) : freshIds.has(id))) return reject(`Handwriting row ID ${id} is repeated. Fresh declarations must be unique across the document; carried rows must be unique within their page.`);
      pageIds.add(id);
      ids.add(id);
      if (page.fresh) freshIds.add(id);
      const receipt: HandwritingReceipt = { version: 1, documentRowId: `${index + 1}/${id}`, ...(page.carriedMaterialId ? { carriedFrom: { materialId: page.carriedMaterialId, page: (entry as HandwritingReceipt).page, rowId: id } } : {}), page: index + 1, input: entry.input as GuidedRowInput, composition: row.receipt, markupSha256: hash(row.markup) };
      if (page.fresh) {
        const token = `<!-- homa:handwriting ${id} -->`;
        if (body.split(token).length !== 2) return reject(`Handwriting row ${id} needs exactly one matching placeholder on its page.`);
        body = body.replace(token, () => row.markup);
      } else {
        const stored = entry as HandwritingReceipt;
        if (stored.version !== 1 || stored.documentRowId !== `${stored.page}/${id}` || stored.markupSha256 !== receipt.markupSha256 || !isDeepStrictEqual(stored.composition, receipt.composition) || body.split(row.markup).length !== 2) return reject("The saved handwriting row differs from its server receipt. No replacement was made.");
      }
      receipts.push(receipt);
      expectations.push({ page: index + 1, id, documentRowId: receipt.documentRowId, src: row.src, width: row.receipt.width, height: row.receipt.height, capHeight: row.receipt.capHeight });
    }
    // Remove only exact validated rows before checking for any undeclared or
    // forged reserved element. Source page bodies themselves remain unchanged.
    let remainder = body;
    for (const entry of entries) remainder = remainder.replace(composeHandwritingRow((entry as { input: GuidedRowInput }).input).markup, "");
    if (reserved.test(remainder)) return reject("A handwriting placeholder or reserved row has no matching declaration or server receipt.");
    return body;
  });
  if (receipts.length > 96) return reject("Use at most 96 handwriting rows per document.");
  if (requireGuidedRows && receipts.length === 0) return reject("The name-tracing-page recipe requires declared handwritingRows. Do not substitute manual lettering or a different font.");
  return { bodies, receipts, expectations };
}

export function handwritingFailureNote(error: unknown): string | null {
  if (!(error instanceof GuidedRowError) && !(error instanceof HandwritingDocumentError)) return null;
  return `Not created: ${error.message} Keep the exact spelling and guide height. Change the layout, or explain the supported-character limit and offer another activity. Do not substitute hand-drawn or font-based tracing.`;
}
