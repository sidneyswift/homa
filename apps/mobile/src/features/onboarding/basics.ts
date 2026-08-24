import { EVE_CHANNEL_HEADER, env } from "../../lib/env";
import { supabase } from "../../lib/supabase";

/**
 * The walk's "about you" write (founder call 2026-08-24: mobile never
 * learned the parent's name or state). Same authenticated route the web
 * basics card uses; the family comes from the bearer token, never the
 * body. The device's time zone rides along silently, the same way the
 * web card sends it. Server-side, the mobile bootstrap has already
 * ensured an active onboarding record, so this route stamping
 * profile_completed_at cannot end the walk's paywall exemption.
 */
export async function saveWalkBasics(input: {
  callMeName?: string;
  usState?: string;
}): Promise<boolean> {
  const callMeName = input.callMeName?.trim();
  const usState = input.usState?.trim().toUpperCase();
  if (!callMeName && !usState) return true;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;

  try {
    const response = await fetch(
      `${env.apiUrl.replace(/\/+$/u, "")}/api/onboarding/basics`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...EVE_CHANNEL_HEADER,
        },
        body: JSON.stringify({
          ...(callMeName ? { callMeName } : {}),
          ...(usState ? { usState } : {}),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      },
    );
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
    } | null;
    return response.ok && body?.ok === true;
  } catch {
    return false;
  }
}
