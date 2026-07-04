import { z } from "zod";

import { KID_AGE_BANDS, WAITLIST_SOURCES } from "./waitlist";

/**
 * Typed event registry (MJ-08). Law: no feature merges without its events.
 * Every event name and its props schema is declared here; emitters cannot
 * invent names or shapes. Event props never contain PII (no emails, no names);
 * the PII lives in the domain row the event points at.
 *
 * Pre-signup web events (waitlist.*) are the only names the public database
 * role may insert; see migration 20260704033725.
 */
export const EVENT_SCHEMAS = {
  "waitlist.joined": z.object({
    source: z.enum(WAITLIST_SOURCES),
    channel_variant: z.enum(["default", "conference"]),
    us_state: z.string().optional(),
    kid_age_bands: z.array(z.enum(KID_AGE_BANDS)).default([]),
  }),
} as const;

export type EventName = keyof typeof EVENT_SCHEMAS;
export type EventProps<N extends EventName> = z.input<(typeof EVENT_SCHEMAS)[N]>;

export interface EventSink {
  supabaseUrl: string;
  supabaseKey: string;
}

/**
 * emitEvent(sink, name, props): void
 * Validates props against the registry and writes one row to public.events
 * over the Data API. Best-effort by design: analytics must never break the
 * feature emitting them, so failures are logged and swallowed.
 */
export async function emitEvent<N extends EventName>(
  sink: EventSink,
  name: N,
  props: EventProps<N>,
): Promise<void> {
  try {
    const parsed = EVENT_SCHEMAS[name].parse(props);
    const response = await fetch(`${sink.supabaseUrl}/rest/v1/events`, {
      method: "POST",
      headers: {
        apikey: sink.supabaseKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ name, props: parsed }),
    });
    if (!response.ok) {
      console.error(`emitEvent(${name}) failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`emitEvent(${name}) failed:`, error);
  }
}
