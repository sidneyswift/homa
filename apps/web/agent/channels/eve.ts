import { extractBearerToken, localDev, vercelOidc, type AuthFn } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";
import { createClient } from "@supabase/supabase-js";

import { readViewContextCookie, VIEW_CONTEXT_FAMILY } from "../../lib/view-context";

/**
 * Route auth for the eve channel (minimal M1-01 slice of FR-1).
 *
 * The chat UI sends the caller's Supabase access token as a bearer header
 * (resolved fresh per request by useEveAgent, so browser-side auto-refresh
 * keeps it valid). This AuthFn verifies the token against Supabase Auth,
 * resolves the caller's family under their OWN RLS context, and stamps the
 * principal eve carries through the whole durable session:
 *
 *   principalId          the Supabase user id
 *   attributes.familyId  from family_members, under the caller's RLS
 *   attributes.supabaseAccessToken  the raw JWT, for tools to query the DB
 *                        as the caller (RLS stays the tenancy wall inside
 *                        tools too, per BUILD.md law #1)
 *
 * The token in attributes is server-custody session state, never shown to
 * the model. It is refreshed on every inbound turn (auth.current re-runs
 * this walk), so interactive chat always carries a live token. The proper
 * per-request re-scoping pattern (M1-02, SET LOCAL) replaces this at
 * walking-skeleton time.
 *
 * Walk order: our Supabase auth first, then vercelOidc() (Vercel-internal
 * callers such as subagents), then localDev() (local eve dev tooling).
 * Tools that need a family refuse to act when attributes.familyId is
 * absent, which covers both fallback principals.
 */
function supabaseAuth(): AuthFn<Request> {
  return async (request) => {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) return null; // not ours; fall through the walk

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;

    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error } = await supabase.auth.getUser(token);
    if (error || !userData.user) return null;

    // The caller's OWN membership row (user_id filter matters since
    // migration #49 let members read the whole family roster).
    const { data: membership } = await supabase
      .from("family_members")
      .select("family_id, display_name")
      .eq("user_id", userData.user.id)
      .limit(1)
      .maybeSingle();

    // attributes only admits string values; absent facts are omitted keys.
    const attributes: Record<string, string> = { supabaseAccessToken: token };
    if (membership?.family_id) attributes.familyId = membership.family_id;
    if (membership?.display_name) attributes.memberName = membership.display_name;
    if (userData.user.email) attributes.email = userData.user.email;

    // The context switcher's selection rides the same-origin request as a
    // cookie. It is a UI HINT, not an auth fact: family-context validates
    // it against the family's own children before the model ever hears a
    // name, so a stale or forged id simply drops (tenancy law).
    const viewContext = readViewContextCookie(request.headers.get("cookie"));
    if (viewContext && viewContext !== VIEW_CONTEXT_FAMILY) {
      attributes.viewChildId = viewContext;
    }

    return {
      authenticator: "app",
      principalId: userData.user.id,
      principalType: "user" as const,
      attributes,
    };
  };
}

export default eveChannel({
  auth: [supabaseAuth(), vercelOidc(), localDev()],
});
