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
  // Fired once, when the anonymous session opens (no email yet).
  "map.started": z.object({
    family_id: z.uuid(),
    source: z.enum(WAITLIST_SOURCES),
    has_state: z.boolean(),
    returning: z.boolean(),
  }),
  // Fired at signup: the moment email is captured, right before the report
  // scores (or, for an all-pending-band family, before the hub). Separate
  // from map.started because founder call 2026-07-06 split identity capture
  // from session start: a lead can now answer the whole checklist before
  // this ever fires.
  "map.claimed": z.object({
    family_id: z.uuid(),
    source: z.enum(WAITLIST_SOURCES),
    has_state: z.boolean(),
    returning: z.boolean(),
  }),
  "map.child_added": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    age_months: z.number().int().min(0),
    in_range: z.boolean(),
  }),
  "map.child_removed": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
  }),
  "map.question_answered": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    domain: z.string(),
    answer: z.enum(["easily", "getting_there", "not_yet", "not_sure", "skip"]),
  }),
  "map.context_added": z.object({
    family_id: z.uuid(),
    child_id: z.uuid().optional(),
    keys: z.array(z.string()).default([]),
  }),
  // Fired once, the moment the anonymous family gains a real Supabase
  // Auth account: either "google" (immediate, at S1) or "password" (the
  // last question, right before the report). Separate from map.claimed
  // (which only marks the email as known) so the funnel can see how many
  // families ever finish becoming an account.
  "map.account_created": z.object({
    family_id: z.uuid(),
    method: z.enum(["google", "password"]),
    returning: z.boolean(),
  }),
  "map.report_generated": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    mapped_domains: z.number().int().min(0),
    observations: z.number().int().min(0),
    bank_version: z.string(),
  }),
  // The one-world unification (2026-07-07) retired the family bridge and
  // its events: a family exists from the first tap, so there is nothing
  // to bridge. map.family_bridged / map.family_bridge_skipped ended here.
  "map.report_viewed": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    entry: z.enum(["instant", "link"]),
  }),
  "map.reminder_sent": z.object({
    family_id: z.uuid(),
  }),
  "map.deep_dive_started": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    domain: z.string(),
    mode: z.enum(["parent", "together"]),
  }),
  "map.plan_built": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    domain: z.string(),
  }),
  "map.retest_emailed": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    domain: z.string(),
  }),
  "map.band_ready_emailed": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
  }),
  // The living record (2026-07-07): answers edited from the report page
  // itself. source separates a tapped receipt correction from the inline
  // sharpening question and the staleness re-check; changes counts the
  // batch (one event per save, not per tap).
  "map.answers_corrected": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    source: z.enum(["report_correction", "report_probe", "recheck"]),
    changes: z.number().int().min(1),
  }),
  // The report's one-tap month: the parent explicitly asked Homa to build
  // the plan and check back, which is what arms the retest email.
  "map.plan_consented": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    domain: z.string(),
  }),
  // Plan check-offs synced server-side (one event per save; done_count is
  // the running total, so the funnel reads practice volume without PII).
  "map.plan_progress": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    domain: z.string(),
    done_count: z.number().int().min(0),
  }),
  // The LLM narrative layer (D8 overturn, 2026-07-06). One event per
  // finished generation; kind separates the report from a four-week plan.
  "map.narrative_generated": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    kind: z.enum(["report", "plan"]),
    duration_ms: z.number().int().min(0),
    tokens_in: z.number().int().min(0),
    tokens_out: z.number().int().min(0),
    rejected_pieces: z.array(z.string()).default([]),
  }),
  // Fired when a generation could not be shown (gate failed the whole
  // thing, or the call errored) and templates rendered instead.
  "map.narrative_fallback": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    kind: z.enum(["report", "plan"]),
    reason: z.enum(["gate-failed", "generation-error"]),
  }),
  // SMS channel (M5-01 groundwork pulled forward as a founder experiment,
  // build-log 2026-07-07; sole-prop 10DLC, dark behind TELNYX_SMS_ENABLED).
  // Emitted server-side per inbound text. Props carry no phone number and
  // no message content: the number is PII and lives only in the session.
  "sms.message_received": z.object({
    media_count: z.number().int().min(0),
    linked_family: z.boolean(),
  }),
  // A phone number was linked to a family workspace (family_phones,
  // migration #22): typed at signup, set on /home, or carried forward by
  // the lead bridge. No phone number in props, ever.
  "sms.family_linked": z.object({
    family_id: z.uuid(),
    source: z.enum(["signup", "home", "bridge"]),
    replaced: z.boolean(),
  }),
  // "Call Homa" curriculum feature (founder decision 2026-07-07): an
  // outbound voice call reviews the report, then an LLM-authored
  // curriculum is generated from what was discussed. No phone number,
  // no transcript content, ever in props.
  "voice.call_started": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
  }),
  "voice.call_failed": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    reason: z.enum(["no-phone", "telnyx-error", "not-found"]),
  }),
  "voice.curriculum_generated": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    duration_ms: z.number().int().min(0),
    tokens_in: z.number().int().min(0),
    tokens_out: z.number().int().min(0),
    fallback: z.boolean(),
  }),
  // The "send an email" tool (build-log 2026-07-08), both voice
  // assistants. No subject/body content in props, ever.
  "voice.email_sent": z.object({
    family_id: z.uuid(),
    child_id: z.uuid().optional(),
  }),
  // Same tool, web chat + SMS (agent/tools/send_followup_email.ts).
  "chat.email_sent": z.object({
    family_id: z.uuid(),
    channel: z.enum(["web", "sms"]),
  }),
  // Chat (FR-4). journeys/06 §4.4 #15. Emitted with the signed-in caller's
  // token and family_id (events policy, migration #13). No message content.
  "chat.turn_completed": z.object({
    status: z.enum(["ok", "error"]),
    error_class: z.enum(["turn_failed", "send_failed", "unknown"]).optional(),
    modality: z.enum(["text", "voice"]),
    latency_ms: z.number().int().min(0),
    model_tier: z.enum(["fast", "mid", "premium"]),
    tool_calls: z.number().int().min(0),
  }),
} as const;

export type EventName = keyof typeof EVENT_SCHEMAS;
export type EventProps<N extends EventName> = z.input<(typeof EVENT_SCHEMAS)[N]>;

export interface EventSink {
  supabaseUrl: string;
  supabaseKey: string;
  /** Signed-in caller's JWT. Required for family-scoped events (chat.*):
   *  the RLS policy checks membership of family_id under this token. */
  accessToken?: string;
  /** Stamped onto the row's family_id column (never into props). */
  familyId?: string;
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
        ...(sink.accessToken
          ? { Authorization: `Bearer ${sink.accessToken}` }
          : {}),
      },
      body: JSON.stringify({
        name,
        props: parsed,
        ...(sink.familyId ? { family_id: sink.familyId } : {}),
      }),
    });
    if (!response.ok) {
      console.error(`emitEvent(${name}) failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`emitEvent(${name}) failed:`, error);
  }
}
