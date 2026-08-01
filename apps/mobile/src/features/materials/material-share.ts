import { File, Paths } from "expo-file-system";
import * as Network from "expo-network";
import { AppState, Share } from "react-native";

import { env, EVE_CHANNEL_HEADER } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import {
  parsePreparedMaterialShareRequest,
  runMaterialShareWithRuntime,
  type MaterialShareResult,
  type MaterialShareRuntime,
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

const nativeShareRuntime: MaterialShareRuntime = {
  async accessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
  appState: () => AppState.currentState,
  networkState: () => Network.getNetworkStateAsync(),
  async download({ authorizedPdfPath, materialId, token }) {
    const destination = new File(Paths.cache, `homa-share-${materialId}.pdf`);
    return File.downloadFileAsync(
      `${env.apiUrl.replace(/\/+$/, "")}${authorizedPdfPath}`,
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
  },
  async share({ fileUri, message, title }) {
    const outcome = await Share.share(
      { title, message, url: fileUri },
      { subject: `${title} from Homa`, dialogTitle: `Share ${title}` },
    );
    return { dismissed: outcome.action === Share.dismissedAction };
  },
};

export async function runPreparedMaterialShare(
  request: PreparedMaterialShareRequest,
  message: string,
): Promise<MaterialShareResult & { message: string }> {
  return runMaterialShareWithRuntime(request, message, nativeShareRuntime);
}
