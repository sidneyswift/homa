import { printWithSystemSheet, type NativePrintResult } from "../../../modules/homa-print";
import { env, EVE_CHANNEL_HEADER } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import {
  parsePreparedPrintRequest,
  printResultMessage,
  type PreparedPrintRequest,
} from "./material-print-contract";

export {
  readyPrintMessage,
  type PreparedPrintRequest,
} from "./material-print-contract";

export interface MaterialPrintResult extends NativePrintResult {
  message: string;
}

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function runPreparedMaterialPrint(
  request: PreparedPrintRequest,
): Promise<MaterialPrintResult> {
  const token = await accessToken();
  if (!token) {
    const native = { status: "failed" as const, reason: "no-session" };
    return { ...native, message: "Your session expired. Sign in again before printing." };
  }
  const uri = `${env.apiUrl.replace(/\/+$/, "")}${request.authorizedPdfPath}`;
  const native = await printWithSystemSheet({
    uri,
    authorization: `Bearer ${token}`,
    title: request.title,
    pageIndexes: request.pageIndexes,
    requestedCopies: request.copies,
  });
  return { ...native, message: printResultMessage(native) };
}

export async function prepareMaterialPrintFromApp(
  materialId: string,
  options: { copies: number; includeAnswerKey: boolean },
): Promise<PreparedPrintRequest | null> {
  const token = await accessToken();
  if (!token) return null;
  const response = await fetch(
    `${env.apiUrl.replace(/\/+$/, "")}/api/materials/${materialId}/print`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...EVE_CHANNEL_HEADER,
      },
      body: JSON.stringify(options),
    },
  );
  const body = (await response.json().catch(() => null)) as { printRequest?: unknown } | null;
  return response.ok ? parsePreparedPrintRequest(body?.printRequest) : null;
}
