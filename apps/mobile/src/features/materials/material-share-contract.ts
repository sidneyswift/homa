export interface PreparedMaterialShareRequest {
  materialId: string;
  title: string;
  authorizedPdfPath: string;
  suggestedMessage: string;
}

export type MaterialShareFailureReason =
  | "no-session"
  | "app-backgrounded"
  | "offline"
  | "missing-material"
  | "expired-material"
  | "download-failed"
  | "unsupported-destination"
  | "share-failed";

export type MaterialShareResult =
  | { status: "handed-off" }
  | { status: "canceled" }
  | { status: "failed"; reason: MaterialShareFailureReason };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePreparedMaterialShareRequest(value: unknown): PreparedMaterialShareRequest | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.materialId !== "string" ||
    !UUID.test(value.materialId) ||
    typeof value.title !== "string" ||
    value.title.trim().length === 0 ||
    value.title.length > 180 ||
    value.authorizedPdfPath !== `/api/materials/${value.materialId}/pdf` ||
    typeof value.suggestedMessage !== "string" ||
    value.suggestedMessage.trim().length === 0 ||
    value.suggestedMessage.length > 500
  ) return null;
  return {
    materialId: value.materialId,
    title: value.title,
    authorizedPdfPath: value.authorizedPdfPath,
    suggestedMessage: value.suggestedMessage,
  };
}

export function materialShareResultMessage(result: MaterialShareResult): string {
  if (result.status === "handed-off") {
    return "Handed to your chosen app. That app handles sending and delivery.";
  }
  if (result.status === "canceled") return "Sharing canceled. Nothing was handed off.";
  switch (result.reason) {
    case "no-session":
      return "Your session expired. Sign in again before sharing.";
    case "app-backgrounded":
      return "Sharing did not start while Homa was in the background. Bring Homa forward and try again.";
    case "offline":
      return "You're offline. The printable is still safe in your Binder, so try again when you're connected.";
    case "missing-material":
      return "That version is no longer available. Open the current version in your Binder and try again.";
    case "expired-material":
      return "That printable link expired. Open the material again and Homa will make a fresh handoff.";
    case "unsupported-destination":
      return "This device cannot open a share destination for the PDF. You can still open it from your Binder.";
    case "download-failed":
      return "The printable could not reach the phone. Check the connection and try again.";
    default:
      return "Sharing did not finish. Nothing was handed off.";
  }
}
