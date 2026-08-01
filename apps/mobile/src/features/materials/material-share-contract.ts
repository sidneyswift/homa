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

export interface MaterialShareRuntime {
  accessToken(): Promise<string | null>;
  appState(): string;
  networkState(): Promise<{ isConnected?: boolean | null; isInternetReachable?: boolean | null } | null>;
  download(input: {
    authorizedPdfPath: string;
    materialId: string;
    token: string;
  }): Promise<{ uri: string }>;
  share(input: {
    fileUri: string;
    message: string;
    title: string;
  }): Promise<{ dismissed: boolean }>;
}

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
    return "The PDF is in your chosen app. Check that app to finish or confirm sending.";
  }
  if (result.status === "canceled") return "Sharing canceled. Nothing was handed off.";
  switch (result.reason) {
    case "no-session":
      return "Your session expired. Nothing was sent. Sign in again before sharing.";
    case "app-backgrounded":
      return "Sharing did not start while Homa was in the background. Nothing was sent. Open Homa and try again.";
    case "offline":
      return "You're offline. The printable is still safe in your Binder, so try again when you're connected.";
    case "missing-material":
      return "That version is no longer available. Nothing was sent. Open the current version in your Binder and try again.";
    case "expired-material":
      return "This share expired. Nothing was sent. Open the printable again and try once more.";
    case "unsupported-destination":
      return "No app on this phone could open the PDF. It is still safe in your Binder, or you can email it from Homa.";
    case "download-failed":
      return "The PDF did not download. Nothing was sent. Check your connection and try again.";
    default:
      return "Homa could not tell whether the PDF opened in the other app. Check that app before trying again.";
  }
}

export function materialShareFailureFromDownload(error: unknown): MaterialShareFailureReason {
  const message = error instanceof Error ? error.message : "";
  if (/\b401\b|\b403\b/u.test(message)) return "no-session";
  if (/\b404\b/u.test(message)) return "missing-material";
  if (/\b410\b/u.test(message)) return "expired-material";
  return "download-failed";
}

function withMessage(result: MaterialShareResult): MaterialShareResult & { message: string } {
  return { ...result, message: materialShareResultMessage(result) };
}

export async function runMaterialShareWithRuntime(
  request: PreparedMaterialShareRequest,
  message: string,
  runtime: MaterialShareRuntime,
): Promise<MaterialShareResult & { message: string }> {
  const token = await runtime.accessToken();
  if (!token) return withMessage({ status: "failed", reason: "no-session" });
  if (runtime.appState() !== "active") {
    return withMessage({ status: "failed", reason: "app-backgrounded" });
  }
  const network = await runtime.networkState().catch(() => null);
  if (network?.isConnected === false || network?.isInternetReachable === false) {
    return withMessage({ status: "failed", reason: "offline" });
  }

  let file: { uri: string };
  try {
    file = await runtime.download({
      authorizedPdfPath: request.authorizedPdfPath,
      materialId: request.materialId,
      token,
    });
  } catch (error) {
    return withMessage({ status: "failed", reason: materialShareFailureFromDownload(error) });
  }
  if (runtime.appState() !== "active") {
    return withMessage({ status: "failed", reason: "app-backgrounded" });
  }

  try {
    const outcome = await runtime.share({
      fileUri: file.uri,
      message: message.trim(),
      title: request.title,
    });
    return withMessage(outcome.dismissed ? { status: "canceled" } : { status: "handed-off" });
  } catch (error) {
    const reason: MaterialShareFailureReason = error instanceof Error && /not available|unsupported|no activity/iu.test(error.message)
      ? "unsupported-destination"
      : "share-failed";
    return withMessage({ status: "failed", reason });
  }
}
