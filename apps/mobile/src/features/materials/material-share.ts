import { File, Paths } from "expo-file-system";
import * as Network from "expo-network";
import { AppState, Share } from "react-native";

import { env, EVE_CHANNEL_HEADER } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import {
  materialShareResultMessage,
  parsePreparedMaterialShareRequest,
  type MaterialShareResult,
  type MaterialShareFailureReason,
  type PreparedMaterialShareRequest,
} from "./material-share-contract";

export { materialShareResultMessage, type PreparedMaterialShareRequest } from "./material-share-contract";

export async function prepareMaterialShareFromApp(materialId: string): Promise<PreparedMaterialShareRequest | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const response = await fetch(`${env.apiUrl.replace(/\/+$/, "")}/api/materials/${materialId}/share`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...EVE_CHANNEL_HEADER },
  });
  const body = (await response.json().catch(() => null)) as { shareRequest?: unknown } | null;
  return response.ok ? parsePreparedMaterialShareRequest(body?.shareRequest) : null;
}

function failureFromDownload(error: unknown): MaterialShareResult {
  const message = error instanceof Error ? error.message : "";
  if (/\b401\b|\b403\b/u.test(message)) return { status: "failed", reason: "no-session" };
  if (/\b404\b/u.test(message)) return { status: "failed", reason: "missing-material" };
  if (/\b410\b/u.test(message)) return { status: "failed", reason: "expired-material" };
  return { status: "failed", reason: "download-failed" };
}

export async function runPreparedMaterialShare(
  request: PreparedMaterialShareRequest,
  message: string,
): Promise<MaterialShareResult & { message: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    const result = { status: "failed" as const, reason: "no-session" as const };
    return { ...result, message: materialShareResultMessage(result) };
  }
  if (AppState.currentState !== "active") {
    const result = { status: "failed" as const, reason: "app-backgrounded" as const };
    return { ...result, message: materialShareResultMessage(result) };
  }
  const network = await Network.getNetworkStateAsync().catch(() => null);
  if (network?.isConnected === false || network?.isInternetReachable === false) {
    const result = { status: "failed" as const, reason: "offline" as const };
    return { ...result, message: materialShareResultMessage(result) };
  }

  const destination = new File(Paths.cache, `homa-share-${request.materialId}.pdf`);
  let file: File;
  try {
    file = await File.downloadFileAsync(
      `${env.apiUrl.replace(/\/+$/, "")}${request.authorizedPdfPath}`,
      destination,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/pdf",
          ...EVE_CHANNEL_HEADER,
        },
        idempotent: true,
      },
    );
  } catch (error) {
    const result = failureFromDownload(error);
    return { ...result, message: materialShareResultMessage(result) };
  }
  if (AppState.currentState !== "active") {
    const result = { status: "failed" as const, reason: "app-backgrounded" as const };
    return { ...result, message: materialShareResultMessage(result) };
  }

  try {
    const outcome = await Share.share(
      { title: request.title, message: message.trim(), url: file.uri },
      { subject: `${request.title} from Homa`, dialogTitle: `Share ${request.title}` },
    );
    const result: MaterialShareResult = outcome.action === Share.dismissedAction
      ? { status: "canceled" }
      : { status: "handed-off" };
    return { ...result, message: materialShareResultMessage(result) };
  } catch (error) {
    const reason: MaterialShareFailureReason = error instanceof Error && /not available|unsupported|no activity/iu.test(error.message)
      ? "unsupported-destination"
      : "share-failed";
    const result = { status: "failed" as const, reason };
    return { ...result, message: materialShareResultMessage(result) };
  }
}
