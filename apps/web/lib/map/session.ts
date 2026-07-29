import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { extractBearerToken } from "eve/channels/auth";

import { createSupabaseServerClient } from "../supabase/server";
import { classifyFamilyActorAuthLookup } from "./family-actor-auth";
import { getFamilyByAuthUser, getFamilyByResumeToken, type FamilyRow } from "./store";
import { MAP_RESUME_COOKIE } from "./tokens";

/**
 * Resolves the calling browser's family. The family id NEVER arrives in a
 * request body; this is the only way routes learn who they're talking to
 * (the auth-context law). Two doors, one identity:
 *   1. The httpOnly resume cookie (anonymous onboarding, emailed links).
 *   2. The Supabase session's membership row (a signed-in parent on a
 *      fresh browser, or right after the Google OAuth return).
 */
export async function requireFamily(): Promise<FamilyRow | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(MAP_RESUME_COOKIE)?.value;
  if (token) {
    const family = await getFamilyByResumeToken(token);
    if (family) return family;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return await getFamilyByAuthUser(user.id);
  } catch {
    // No Supabase session context here (build-time render, cookieless
    // caller): the cookie path above was the only door.
  }
  return null;
}

/**
 * Resolves the calling MOBILE app's family from a bearer token, the
 * iOS/Android twin of requireFamily above. The mobile app holds its
 * session in AsyncStorage, not cookies (apps/mobile/src/lib/supabase.ts),
 * so requireFamily's cookie doors never open for it; every JSON API route
 * a native client calls must use this instead. Same tenancy law either
 * way: the family id is re-derived from the verified token, never taken
 * from the request. Mirrors apps/web/agent/channels/eve.ts's
 * supabaseAuth() exactly (fresh client scoped to the token, auth.getUser
 * verifies it against Supabase, not just decoded locally), so a token
 * this route accepts is a token eve's chat channel would also accept.
 */
export async function requireFamilyFromBearer(
  request: Request,
): Promise<FamilyRow | null> {
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return await getFamilyByAuthUser(data.user.id);
}

/**
 * Adds the authenticated member identity when the browser session belongs
 * to the same family. Anonymous resume-cookie sittings remain unattributed.
 */
export async function requireFamilyWithActor(): Promise<{
  family: FamilyRow;
  memberUserId: string | null;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(MAP_RESUME_COOKIE)?.value;
  const resumeFamily = token
    ? await getFamilyByResumeToken(token)
    : null;
  let authResponse;
  try {
    const supabase = await createSupabaseServerClient();
    authResponse = await supabase.auth.getUser();
  } catch (error) {
    throw new FamilyActorLookupError(error);
  }
  const auth = classifyFamilyActorAuthLookup({
    userId: authResponse.data.user?.id ?? null,
    error: authResponse.error,
  });
  if (auth.status === "failure") {
    throw new FamilyActorLookupError(auth.message);
  }
  const authenticatedFamily =
    auth.status === "authenticated"
      ? await getFamilyByAuthUser(auth.userId)
      : null;
  const family = resumeFamily ?? authenticatedFamily;
  if (!family) return null;
  return {
    family,
    memberUserId:
      auth.status === "authenticated" &&
      authenticatedFamily?.id === family.id
        ? auth.userId
        : null,
  };
}

export class FamilyActorLookupError extends Error {
  constructor(cause: unknown) {
    super(
      cause instanceof Error
        ? cause.message
        : typeof cause === "string"
          ? cause
          : "Family actor lookup failed",
      { cause },
    );
    this.name = "FamilyActorLookupError";
  }
}
