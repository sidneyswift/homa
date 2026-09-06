import { printWithSystemSheet, type NativePrintResult } from "../../../modules/homa-print";
import { env, EVE_CHANNEL_HEADER } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import {
  type PreparedPrintRequest,
} from "./material-print-contract";

import { isPrintMaterialId, parsePreparedPrintResponse } from "@homa/core";
import { runPrintHandoff } from "./material-print-flow";

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

let presenting = false;
export async function runPreparedMaterialPrint(request: PreparedPrintRequest): Promise<MaterialPrintResult> {
  if (presenting) return { status: "failed", reason: "already-presenting", message: "Print options are already being prepared or open." };
  presenting = true;
  try {
    const token = await accessToken();
    if (!token) return { status: "failed", reason: "no-session", message: "Your session expired. Sign in again before printing." };
    return await runPrintHandoff(request, {
      prepare: (id, options) => prepareResponse(id, options, token),
      present: ({ path, ...options }) => printWithSystemSheet({ ...options, uri: `${env.apiUrl.replace(/\/+$/, "")}${path}`, authorization: `Bearer ${token}` }),
    });
  } catch { return { status: "failed", reason: "download-failed", message: "I could not prepare the print options. Check your connection and try again." }; }
  finally { presenting = false; }
}

async function prepareResponse(materialId: string, options: { copies: number; includeAnswerKey: boolean }, token: string): Promise<unknown> {
  if (!isPrintMaterialId(materialId)) return { ready: false };
  const response = await fetch(`${env.apiUrl.replace(/\/+$/, "")}/api/materials/${materialId}/print`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...EVE_CHANNEL_HEADER },
    body: JSON.stringify(options), signal: AbortSignal.timeout(40_000),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok && !(typeof body === "object" && body !== null && "ready" in body && body.ready === false)) return { ready: false };
  return body;
}

export async function prepareMaterialPrintFromApp(materialId: string, options: { copies: number; includeAnswerKey: boolean }): Promise<PreparedPrintRequest | null> {
  try {
    const token = await accessToken();
    if (!token) return null;
    const result = parsePreparedPrintResponse(await prepareResponse(materialId, options, token), materialId);
    return result.ready ? result.request : null;
  } catch { return null; }
}
