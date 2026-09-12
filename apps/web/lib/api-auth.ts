import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { readEveAuthentication } from "./eve-authentication";
import { readEveMembership } from "./eve-membership";
import { createSupabaseRequestClient } from "./supabase/server";
import { measureChatPreparation } from "./observability/chat-preparation";

/**
 * Family resolution for API routes that serve both surfaces: the web
 * app (cookie session) and the mobile app (Supabase JWT as a Bearer
 * header). Same walk the learning/review route and the eve channel do:
 * token or cookie proves the user, family_members maps user to family.
 * familyId always comes from here, never from a request body (BUILD.md
 * law #1).
 */

export interface ApiFamilyAuth {
  supabase: SupabaseClient;
  userId: string;
  familyId: string;
}

export type RequestAuthTransport =
  | { kind: "bearer"; token: string }
  | { kind: "cookie" }
  | { kind: "invalid" };

export function requestAuthTransport(request: Request): RequestAuthTransport {
  const header = request.headers.get("authorization");
  if (header === null) return { kind: "cookie" };
  const match = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/i.exec(header);
  return match ? { kind: "bearer", token: match[1] } : { kind: "invalid" };
}

/**
 * resolveApiFamily(request): Promise<ApiFamilyAuth | null>
 * Returns the caller's RLS-scoped client, user id, and family id, or
 * null when the request carries no valid session or the user has no
 * family yet. Existing callers retain the non-throwing membership lookup.
 * Chat may opt into structured service errors for temporary Auth or membership
 * failures so a backend outage does not look like an expired login.
 */
export async function resolveApiFamily(
  request: Request,
  options: {
    transientAuthErrors?: "throw";
    transientMembershipErrors?: "throw";
    traceChatBinding?: boolean;
  } = {},
): Promise<ApiFamilyAuth | null> {
  let supabase: SupabaseClient;
  let token: string | undefined;

  const transport = requestAuthTransport(request);
  if (transport.kind === "invalid") return null;
  if (transport.kind === "bearer") {
    token = transport.token;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;
    supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } else {
    supabase = createSupabaseRequestClient(request);
  }
  const readUser = () => supabase.auth.getUser(token);
  const { data, error } = options.transientAuthErrors === "throw"
    ? await readEveAuthentication(readUser, options.traceChatBinding ? "binding_authenticate" : undefined)
    : options.traceChatBinding
      ? await measureChatPreparation("binding_authenticate", readUser)
      : await readUser();
  if (error || !data.user) return null;
  const userId = data.user.id;

  const readMembership = () => supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const { data: membership } = options.transientMembershipErrors === "throw"
    ? await readEveMembership(readMembership, options.traceChatBinding ? "binding_membership" : "membership")
    : await readMembership();
  const familyId = membership?.family_id as string | undefined;
  if (!familyId) return null;

  return { supabase, userId, familyId };
}
