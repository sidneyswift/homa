import { notFound } from "next/navigation";
import { cache } from "react";

import { createSupabaseServerClient } from "../supabase/server";

/**
 * The founder console's gate (MJ-14; lab question 2, founder answer
 * 2026-07-12: env allowlist checked server-side). HOMA_ADMIN_EMAILS is a
 * comma-separated list of founder addresses; a signed-in session whose
 * email is on it may pass. Everyone else, signed in or not, gets a plain
 * 404, so the console's existence is not advertised. Fail closed: an
 * unset allowlist means nobody passes, including in production, so a
 * missing env var can never open the door.
 *
 * Every /admin page AND the layout call requireFounder(): Next renders
 * nested pages without re-running the layout on soft navigation, so the
 * gate must sit on every data-bearing render, not just the frame.
 * React's cache() collapses the repeated calls within one request.
 */

function allowedEmails(): Set<string> {
  return new Set(
    (process.env.HOMA_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );
}

export interface FounderSession {
  userId: string;
  email: string;
}

export const requireFounder = cache(async (): Promise<FounderSession> => {
  const allowlist = allowedEmails();
  if (allowlist.size === 0) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!user || !email || !allowlist.has(email)) notFound();

  return { userId: user.id, email };
});
