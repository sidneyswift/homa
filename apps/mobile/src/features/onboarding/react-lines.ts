import { EVE_CHANNEL_HEADER, env } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import type { OnboardingIntent } from "./onboarding-state";

/**
 * Client for Homa's give-back lines (D7: live model, schema-checked
 * server-side, warm fallback). The screen never waits on this beyond
 * the request's own bound; the server enforces its 2.5s model budget
 * and always answers with a usable line.
 */

const LOCAL_FALLBACKS: Record<"intent" | "love", string> = {
  intent: "We'll start with the thing kids actually grab.",
  love: "Noted, and I know exactly what to do with that.",
};

export async function fetchReactLine(input: {
  kind: "intent" | "love";
  intent?: OnboardingIntent;
  childName?: string;
  love?: string;
  priorLines?: string[];
}): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return LOCAL_FALLBACKS[input.kind];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(
      `${env.apiUrl.replace(/\/+$/u, "")}/api/mobile/onboarding/react`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...EVE_CHANNEL_HEADER,
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      },
    );
    if (!response.ok) return LOCAL_FALLBACKS[input.kind];
    const body = (await response.json()) as { ok: boolean; line?: string };
    if (!body.ok || !body.line) return LOCAL_FALLBACKS[input.kind];
    return body.line;
  } catch {
    return LOCAL_FALLBACKS[input.kind];
  } finally {
    clearTimeout(timeout);
  }
}
