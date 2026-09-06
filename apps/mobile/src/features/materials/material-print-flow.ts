import { printPdfPath, refreshPrintHandoff, type PreparedPrintRequest } from "@homa/core";
import type { NativePrintResult } from "../../../modules/homa-print";
import { printResultMessage } from "./material-print-contract";

/** No module effects: only a caller's explicit activation runs these ports. */
export async function runPrintHandoff(
  request: PreparedPrintRequest,
  ports: {
    prepare: (id: string, options: { copies: number; includeAnswerKey: boolean }) => Promise<unknown>;
    present: (input: { path: string; title: string; pageIndexes: number[]; requestedCopies: number }) => Promise<NativePrintResult>;
  },
): Promise<NativePrintResult & { message: string }> {
  const fresh = await refreshPrintHandoff(request, ports.prepare);
  if (!fresh.ready) return { status: "failed", reason: "expired-material", message: fresh.note };
  try {
    const native = await ports.present({
      path: printPdfPath(fresh.request), title: fresh.request.title,
      // The authenticated response already contains only selected pages.
      pageIndexes: fresh.request.pageIndexes.map((_index, position) => position),
      requestedCopies: fresh.request.copies,
    });
    return { ...native, message: printResultMessage(native) };
  } catch { return { status: "failed", reason: "printer-error", message: "I could not open the print options. Please try again." }; }
}
