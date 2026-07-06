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
  // Map (lead magnet v2) funnel. Emitted server-side only, with the
  // server key: the anon events policy stays waitlist-only on purpose.
  // Props carry pseudonymous ids, never names or emails.
  "map.started": z.object({
    lead_id: z.uuid(),
    source: z.enum(WAITLIST_SOURCES),
    has_state: z.boolean(),
    returning: z.boolean(),
  }),
  "map.child_added": z.object({
    lead_id: z.uuid(),
    child_id: z.uuid(),
    age_months: z.number().int().min(0),
    in_range: z.boolean(),
  }),
  "map.question_answered": z.object({
    lead_id: z.uuid(),
    child_id: z.uuid(),
    domain: z.string(),
    answer: z.enum(["easily", "getting_there", "not_yet", "not_sure", "skip"]),
  }),
  "map.context_added": z.object({
    lead_id: z.uuid(),
    child_id: z.uuid().optional(),
    keys: z.array(z.string()).default([]),
  }),
  "map.report_generated": z.object({
    lead_id: z.uuid(),
    child_id: z.uuid(),
    mapped_domains: z.number().int().min(0),
    observations: z.number().int().min(0),
    bank_version: z.string(),
  }),
  "map.report_viewed": z.object({
    lead_id: z.uuid(),
    child_id: z.uuid(),
    entry: z.enum(["instant", "link"]),
  }),
  "map.reminder_sent": z.object({
    lead_id: z.uuid(),
  }),
  "map.deep_dive_started": z.object({
    lead_id: z.uuid(),
    child_id: z.uuid(),
    domain: z.string(),
    mode: z.enum(["parent", "together"]),
  }),
  "map.plan_built": z.object({
    lead_id: z.uuid(),
    child_id: z.uuid(),
    domain: z.string(),
  }),
  "map.retest_emailed": z.object({
    lead_id: z.uuid(),
    child_id: z.uuid(),
    domain: z.string(),
  }),
  "map.band_ready_emailed": z.object({
    lead_id: z.uuid(),
    child_id: z.uuid(),
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
