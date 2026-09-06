import { PRINT_STALE_MESSAGE, requestedAnswerKey, samePrintSelection, type PreparedPrintRequest } from "@homa/core";
import type { MaterialSummary } from "./library";
import type { ResolvedActiveMaterial } from "../voice/active-material";
import { selectedPrintPages } from "./print-preparation";
import { subsetPrintPdf } from "./print-pdf";

export interface PrintDownloadAccess {
  active(): Promise<ResolvedActiveMaterial | null>;
  material(): Promise<MaterialSummary | null>;
  bytes(url: string, signal: AbortSignal): Promise<Uint8Array | null>;
}
function currentSelection(active: ResolvedActiveMaterial | null, material: MaterialSummary | null, expected: PreparedPrintRequest): boolean {
  if (!active || !material || active.id !== expected.materialId || material.id !== expected.materialId || active.status !== "final" || material.status !== "final" || material.pageCount !== active.pageCount) return false;
  const indexes = selectedPrintPages({ ...active, includeAnswerKey: requestedAnswerKey(expected) });
  return indexes !== null && samePrintSelection(expected, {
    ...expected, pageCount: active.pageCount, pageIndexes: indexes, answerKeyExcluded: indexes.length < active.pageCount,
  });
}
/** Read-only: download never approves a draft or chooses a newer revision. */
export async function downloadPreparedPrint(input: {
  request: PreparedPrintRequest; access: PrintDownloadAccess; signal: AbortSignal;
}): Promise<{ ready: true; bytes: Uint8Array } | { ready: false; note: string }> {
  const { request, access, signal } = input;
  signal.throwIfAborted();
  const material = await access.material();
  const active = await access.active();
  if (!currentSelection(active, material, request)) return { ready: false, note: PRINT_STALE_MESSAGE };
  const bytes = await access.bytes(material!.pdfUrl, signal);
  if (!bytes) return { ready: false, note: "I could not download this PDF safely. Try preparing it again." };
  const subset = await subsetPrintPdf(bytes, request, signal);
  // Verify again after fetch/parse. A revision during this work gets no bytes.
  const afterMaterial = await access.material();
  const after = await access.active();
  signal.throwIfAborted();
  if (afterMaterial?.pdfUrl !== material!.pdfUrl || !currentSelection(after, afterMaterial, request)) return { ready: false, note: PRINT_STALE_MESSAGE };
  return { ready: true, bytes: subset };
}
