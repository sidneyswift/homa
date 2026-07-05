import { cookies } from "next/headers";

import { getLeadByResumeToken, type LeadRow } from "./store";
import { MAP_RESUME_COOKIE } from "./tokens";

/**
 * Resolves the calling browser's lead from the httpOnly resume cookie.
 * The lead id NEVER arrives in a request body; this is the only way routes
 * learn who they're talking to (the auth-context law, applied to leads).
 */
export async function requireLead(): Promise<LeadRow | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(MAP_RESUME_COOKIE)?.value;
  if (!token) return null;
  return getLeadByResumeToken(token);
}
