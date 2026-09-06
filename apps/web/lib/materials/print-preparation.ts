import { MAX_PRINT_PAGES, PRINT_STALE_MESSAGE, isPrintMaterialId, parsePreparedPrintRequest, type PreparedPrintRequest } from "@homa/core";
import type { MaterialSummary } from "./library";
import type { MaterialPageRole, ResolvedActiveMaterial } from "../voice/active-material";

export type MaterialPrintRequest = PreparedPrintRequest;
export interface PreparedMaterialPrint {
  ready: true;
  finalizedNow: boolean;
  versionsSuperseded: number;
  material: MaterialSummary;
  activeMaterial: ResolvedActiveMaterial;
  printRequest: MaterialPrintRequest;
}
export interface RefusedMaterialPrint { ready: false; note: string }
export type PrepareMaterialPrintResult = PreparedMaterialPrint | RefusedMaterialPrint;

export function selectedPrintPages(input: {
  pageCount: number; pageRoles: readonly MaterialPageRole[] | null; includeAnswerKey: boolean;
}): number[] | null {
  if (!Number.isInteger(input.pageCount) || input.pageCount < 1 || input.pageCount > MAX_PRINT_PAGES) return null;
  const all = Array.from({ length: input.pageCount }, (_value, index) => index);
  if (input.includeAnswerKey) return all;
  if (input.pageRoles === null) return input.pageCount === 1 ? all : null;
  if (input.pageRoles.length !== input.pageCount || input.pageRoles.some((role) => !["child", "answer_key", "parent_guide", "other"].includes(role))) return null;
  return all.filter((index) => input.pageRoles![index] !== "answer_key");
}
function selectionFailure(pages: number[] | null): RefusedMaterialPrint | null {
  if (pages === null) return { ready: false, note: "I could not verify the requested pages in this file. Ask me to prepare the whole PDF or make a new version with labelled pages." };
  if (pages.length === 0) return { ready: false, note: "This file contains only answer-key pages, so excluding them leaves nothing to print. Ask me to include the answer key or make a child worksheet." };
  return null;
}
export interface PrintAccess {
  active(): Promise<ResolvedActiveMaterial | null>;
  material(): Promise<MaterialSummary | null>;
  finalize(): Promise<{ finalized: boolean; transitioned: boolean; versionsSuperseded: number; note: string }>;
}
export async function prepareWithAccess(input: {
  access: PrintAccess; materialId: string; copies: number; includeAnswerKey: boolean;
}): Promise<PrepareMaterialPrintResult> {
  if (!isPrintMaterialId(input.materialId) || !Number.isInteger(input.copies) || input.copies < 1 || input.copies > 20 || typeof input.includeAnswerKey !== "boolean") return { ready: false, note: "I could not verify the print options. Nothing was prepared." };
  const before = await input.access.active();
  if (!before || before.id !== input.materialId) return { ready: false, note: PRINT_STALE_MESSAGE };
  // A selection that cannot work must not approve a draft as a side effect.
  const beforePages = selectedPrintPages({ ...before, includeAnswerKey: input.includeAnswerKey });
  const beforeFailure = selectionFailure(beforePages);
  if (beforeFailure) return beforeFailure;
  let finalizedNow = false;
  let versionsSuperseded = 0;
  if (before.status === "draft") {
    const finalization = await input.access.finalize();
    if (!finalization.finalized) return { ready: false, note: finalization.note };
    finalizedNow = finalization.transitioned;
    versionsSuperseded = finalization.versionsSuperseded;
  }
  const material = await input.access.material();
  const after = await input.access.active();
  if (!after || after.id !== input.materialId || after.status !== "final" || !material || material.id !== input.materialId || material.status !== "final") return { ready: false, note: PRINT_STALE_MESSAGE };
  const pageIndexes = selectedPrintPages({ ...after, includeAnswerKey: input.includeAnswerKey });
  const afterFailure = selectionFailure(pageIndexes);
  if (afterFailure) return afterFailure;
  if (after.pageCount !== before.pageCount || JSON.stringify(pageIndexes) !== JSON.stringify(beforePages) || material.pageCount !== after.pageCount) return { ready: false, note: "The pages changed while I was preparing them. Show the material again before printing." };
  const printRequest = parsePreparedPrintRequest({
    materialId: after.id, title: after.title, authorizedPdfPath: `/api/materials/${after.id}/pdf`,
    pageIndexes, pageCount: after.pageCount, copies: input.copies,
    includeAnswerKey: input.includeAnswerKey, answerKeyExcluded: pageIndexes!.length < after.pageCount,
  });
  if (!printRequest) return { ready: false, note: "I could not verify the print details. Nothing was prepared." };
  return { ready: true, finalizedNow, versionsSuperseded, material, activeMaterial: after, printRequest };
}
