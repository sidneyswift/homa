import { printPageSummary, type PreparedPrintRequest } from "@homa/core";
import type { NativePrintResult } from "../../../modules/homa-print";
export { parsePreparedPrintRequest, type PreparedPrintRequest } from "@homa/core";

export function readyPrintMessage(request: PreparedPrintRequest): string {
  return `${printPageSummary(request)} Checking the material before opening print options. Confirm the copies in Apple's print sheet.`;
}

export function printResultMessage(result: NativePrintResult): string {
  if (result.status === "completed") return "The print job was sent to the printer.";
  if (result.status === "canceled") return "Printing canceled.";
  switch (result.reason) {
    case "app-backgrounded":
      return "Printing did not start while Homa was in the background. Bring Homa forward and try again.";
    case "expired-material":
      return "This version could not be verified before printing. Show the material again and ask Homa to prepare it.";
    case "download-failed":
      return "The printable could not reach the phone. Check the connection and try again.";
    case "printing-unavailable":
      return "Printing is not available on this device. You can still open or share the PDF.";
    case "printer-error":
      return "The system reported a printing error. Check the printer before trying again.";
    default:
      return "The system could not finish the print handoff. Check the printer before trying again.";
  }
}
