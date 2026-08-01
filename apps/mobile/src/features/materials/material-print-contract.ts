import type { NativePrintResult } from "../../../modules/homa-print";

export interface PreparedPrintRequest {
  materialId: string;
  title: string;
  authorizedPdfPath: string;
  pageIndexes: number[];
  pageCount: number;
  copies: number;
  answerKeyExcluded: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Treat Eve tool output as untrusted transport data. The app opens the native
 * sheet only for one exact same-origin material route and bounded PDF pages.
 */
export function parsePreparedPrintRequest(value: unknown): PreparedPrintRequest | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.materialId !== "string" ||
    !UUID.test(value.materialId) ||
    typeof value.title !== "string" ||
    value.title.trim().length === 0 ||
    typeof value.authorizedPdfPath !== "string" ||
    value.authorizedPdfPath !== `/api/materials/${value.materialId}/pdf` ||
    !Number.isInteger(value.pageCount) ||
    (value.pageCount as number) < 1 ||
    !Number.isInteger(value.copies) ||
    (value.copies as number) < 1 ||
    (value.copies as number) > 20 ||
    typeof value.answerKeyExcluded !== "boolean" ||
    !Array.isArray(value.pageIndexes) ||
    value.pageIndexes.length < 1 ||
    !value.pageIndexes.every(
      (index) =>
        Number.isInteger(index) &&
        (index as number) >= 0 &&
        (index as number) < (value.pageCount as number),
    )
  ) {
    return null;
  }
  const pageIndexes = [...new Set(value.pageIndexes as number[])];
  if (pageIndexes.length !== value.pageIndexes.length) return null;
  return {
    materialId: value.materialId,
    title: value.title,
    authorizedPdfPath: value.authorizedPdfPath,
    pageIndexes,
    pageCount: value.pageCount as number,
    copies: value.copies as number,
    answerKeyExcluded: value.answerKeyExcluded,
  };
}

export function readyPrintMessage(request: PreparedPrintRequest): string {
  const pages = request.answerKeyExcluded
    ? "The answer key is left out."
    : `${request.pageIndexes.length} ${request.pageIndexes.length === 1 ? "page" : "pages"}.`;
  const copies = `${request.copies} ${request.copies === 1 ? "copy" : "copies"} requested.`;
  return `Ready to print. ${pages} ${copies} Choose your printer and confirm the copies in Apple's print sheet.`;
}

export function printResultMessage(result: NativePrintResult): string {
  if (result.status === "completed") return "The print job completed.";
  if (result.status === "canceled") return "Printing canceled. Nothing was sent.";
  switch (result.reason) {
    case "app-backgrounded":
      return "Printing did not start while Homa was in the background. Bring Homa forward and try again.";
    case "expired-material":
      return "That printable link expired before the sheet opened. Ask Homa to get this version ready again.";
    case "download-failed":
      return "The printable could not reach the phone. Check the connection and try again.";
    case "printing-unavailable":
      return "Printing is not available on this device. You can still open or share the PDF.";
    case "printer-error":
      return "The printer did not finish that job. Check that it is online, then try again.";
    default:
      return "Printing did not finish. Nothing else changed.";
  }
}
