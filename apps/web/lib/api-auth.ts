import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseRequestClient } from "./supabase/server";

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

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = /^Bearer\s+(.+)$/i.exec(header ?? "");
  return match?.[1] ?? null;
}

/**
 * resolveApiFamily(request): Promise<ApiFamilyAuth | null>
 * Returns the caller's RLS-scoped client, user id, and family id, or
 * null when the request carries no valid session or the user has no
 * family yet. Never throws.
 */
export async function resolveApiFamily(
  request: Request,
): Promise<ApiFamilyAuth | null> {
  let supabase: SupabaseClient;
  let userId: string;

  const token = bearerToken(request);
  if (token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;
    supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    userId = data.user.id;
  } else {
    supabase = createSupabaseRequestClient(request);
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    userId = data.user.id;
  }

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const familyId = membership?.family_id as string | undefined;
  if (!familyId) return null;

  return { supabase, userId, familyId };
}
