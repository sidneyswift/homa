import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchChatHistory,
  type ChatHistoryPayload,
} from "./chat-history";
import {
  resolveApiFamily,
  type ApiFamilyAuth,
} from "./api-auth";

interface HistoryReadInput {
  familyId: string;
  userId: string;
  supabase: SupabaseClient;
}

export interface ChatHistoryRouteDependencies {
  resolveFamily: (request: Request) => Promise<ApiFamilyAuth | null>;
  fetchHistory: (input: HistoryReadInput) => Promise<ChatHistoryPayload | null>;
}

const productionDependencies: ChatHistoryRouteDependencies = {
  resolveFamily: resolveApiFamily,
  fetchHistory: fetchChatHistory,
};

/**
 * Shared handler seam for cookie-authenticated web and bearer-authenticated
 * mobile reads. Family and adult ids come only from resolveApiFamily, and the
 * same caller-scoped Supabase client performs every transcript query.
 */
export async function chatHistoryResponse(
  request: Request,
  dependencies: ChatHistoryRouteDependencies = productionDependencies,
): Promise<Response> {
  let auth: ApiFamilyAuth | null;
  try {
    auth = await dependencies.resolveFamily(request);
  } catch (error) {
    console.error(
      "chat/history auth lookup failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { ok: false, reason: "auth-lookup-failed" },
      { status: 502 },
    );
  }
  if (!auth) {
    return Response.json(
      { ok: false, reason: "no-session" },
      { status: 401 },
    );
  }

  const history = await dependencies.fetchHistory({
    familyId: auth.familyId,
    userId: auth.userId,
    supabase: auth.supabase,
  });
  if (!history) {
    return Response.json(
      { ok: false, reason: "read-failed" },
      { status: 503 },
    );
  }

  return Response.json(
    { ok: true, history },
    { headers: { "cache-control": "private, no-store" } },
  );
}
