import {
  mobileFamilyEventRequestSchema,
  type MobileFamilyEventClientProps,
  type MobileFamilyEventName,
} from "@homa/core";

import { EVE_CHANNEL_HEADER, env } from "./env";
import { supabase } from "./supabase";

/**
 * Sends a strictly typed, content-free event to Homa's authenticated relay.
 * The family id is only a local readiness gate. It never crosses the wire;
 * the server derives family scope again from the verified bearer token.
 */
export async function emitFamilyEvent<N extends MobileFamilyEventName>(
  familyId: string | null,
  name: N,
  props: MobileFamilyEventClientProps<N>,
): Promise<void> {
  if (!familyId) return;
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return;

  const parsed = mobileFamilyEventRequestSchema.safeParse({ name, props });
  if (!parsed.success) {
    console.error(`emitFamilyEvent(${name}) rejected invalid props`);
    return;
  }

  const controller = new AbortController();
  // 10s, not 3s: a cold serverless start regularly outlived the old
  // cap, aborting requests that were mid-flight. Most still persisted
  // server-side (logging a false "failed"), but some died before the
  // body landed and the event was really lost (materials.print_result,
  // 2026-08-24). Fire-and-forget can afford the patience.
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(
      `${env.apiUrl.replace(/\/$/u, "")}/api/mobile/event`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...EVE_CHANNEL_HEADER,
        },
        body: JSON.stringify(parsed.data),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      console.error(`emitFamilyEvent(${name}) failed: HTTP ${response.status}`);
    }
  } catch {
    console.error(`emitFamilyEvent(${name}) failed`);
  } finally {
    clearTimeout(timeout);
  }
}
