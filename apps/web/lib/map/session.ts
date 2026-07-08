import { cookies } from "next/headers";

import { createSupabaseServerClient } from "../supabase/server";
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
