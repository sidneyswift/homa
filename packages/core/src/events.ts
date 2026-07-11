import { z } from "zod";

import { KID_AGE_BANDS, WAITLIST_SOURCES } from "./waitlist";

/**
 * Typed event registry (MJ-08). Law: no feature merges without its events.
 * Every event name and its props schema is declared here; emitters cannot
 * invent names or shapes. Event props never contain PII (no emails, no names);
 * the PII lives in the subject row the event points at.
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
    subject: z.string(),
    answer: z.enum(["easily", "getting_there", "not_yet", "not_sure", "skip"]),
  }),
  "map.context_added": z.object({
    family_id: z.uuid(),
    child_id: z.uuid().optional(),
    keys: z.array(z.string()).default([]),
  }),
  // Fired once, the moment the anonymous family gains a real Supabase
  // Auth account: either "google" or "password", both now at S1 (founder
  // call 2026-07-08 folded the password path into the entry screen too,
  // retiring the old email-only "map.claimed" that used to fire here).
  "map.account_created": z.object({
    family_id: z.uuid(),
    method: z.enum(["google", "password"]),
    returning: z.boolean(),
  }),
  // The create-your-family step right after the account moment (founder
  // call 2026-07-08: one onboarding for every door). Booleans only, the
  // address/phone/avatar themselves are PII and live on the family row.
  "map.family_setup": z.object({
    family_id: z.uuid(),
    has_address: z.boolean(),
    has_phone: z.boolean(),
    has_avatar: z.boolean(),
  }),
  "map.report_generated": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    mapped_subjects: z.number().int().min(0),
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
    subject: z.string(),
    mode: z.enum(["parent", "together"]),
  }),
  "map.plan_built": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    subject: z.string(),
  }),
  "map.retest_emailed": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    subject: z.string(),
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
    subject: z.string(),
  }),
  // Plan check-offs synced server-side (one event per save; done_count is
  // the running total, so the funnel reads practice volume without PII).
  "map.plan_progress": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    subject: z.string(),
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
  // MMS attachment lanes (build-log 2026-07-10, superseding the one-day
  // sms.voice_note_received: never deny input). One event per attachment
  // on an inbound text. media_type is the MIME type the carrier
  // delivered; outcome says which lane handled it: model_native (photos,
  // PDFs passed to the model directly), converted (BMP images, remade
  // into PNG before the model sees them), transcribed (voice notes and
  // video clips through STT), extracted (Word/Excel text pulled out),
  // inlined (text-format files), or failed (bracketed acknowledgement
  // note). Never any content, never a number.
  "sms.attachment_processed": z.object({
    kind: z.enum(["image", "audio", "video", "document", "text", "other"]),
    media_type: z.string(),
    outcome: z.enum([
      "model_native",
      "converted",
      "transcribed",
      "extracted",
      "inlined",
      "failed",
    ]),
    linked_family: z.boolean(),
  }),
  // The materials studio (FR-5, v2 shape 2026-07-10): one event per
  // rendered printable, on every channel. Props never carry titles,
  // html, urls, or prompts; the materials row holds those. kind/source
  // read the founder's modularity question directly ("which creation
  // path do families actually exercise"); reviewed/review_passed track
  // the self-critique gate (MS-5).
  "materials.created": z.object({
    family_id: z.uuid(),
    child_id: z.uuid().optional(),
    channel: z.enum(["web", "sms", "email", "dispatch"]),
    kind: z.enum([
      "worksheet",
      "coloring",
      "flashcards",
      "reader",
      "poster",
      "infographic",
      "game",
      "other",
    ]),
    source: z.enum(["html", "image", "hybrid"]),
    reviewed: z.boolean(),
    review_passed: z.boolean().optional(),
    sent_by_text: z.boolean(),
    duration_ms: z.number().int().min(0),
  }),
  // The studio's art department: one event per generated image (each is
  // a real Vercel AI Gateway spend, so volume is the story). Reference
  // driven generation is the reuse loop working, hence the flag.
  "materials.image_generated": z.object({
    family_id: z.uuid(),
    channel: z.enum(["web", "sms", "email", "dispatch"]),
    duration_ms: z.number().int().min(0),
    has_references: z.boolean(),
  }),
  // The keeper moment (MS-3): a parent-approved version became the
  // family's final and its draft chain was tidied away.
  "materials.finalized": z.object({
    family_id: z.uuid(),
    channel: z.enum(["web", "sms", "email", "dispatch"]),
    versions_superseded: z.number().int().min(0),
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
  // Call-transcript capture (agentic ladder item 2, founder direction
  // 2026-07-09): one event per NEWLY stored transcript. No phone numbers,
  // no content; unlinked calls carry no family reference at all.
  "voice.transcript_synced": z.object({
    line: z.enum(["general", "curriculum"]),
    message_count: z.number().int().min(0),
    linked_family: z.boolean(),
  }),
  // The voice remember tool (item 6): a memory saved live on a call.
  "voice.memory_saved": z.object({
    family_id: z.uuid(),
    child_id: z.uuid().optional(),
  }),
  // The post-call memory turn (item 3): counts only, never content.
  "memory.call_extracted": z.object({
    family_id: z.uuid(),
    child_id: z.uuid().optional(),
    saved: z.number().int().min(0),
    skipped: z.number().int().min(0),
  }),
  // The post-turn chat review (item 8, M2-13): counts only.
  "memory.review_extracted": z.object({
    family_id: z.uuid(),
    saved: z.number().int().min(0),
    skipped: z.number().int().min(0),
    messages_reviewed: z.number().int().min(0),
  }),
  // A parent removed a saved memory from /home (the undo surface).
  "memory.forgotten": z.object({
    family_id: z.uuid(),
    source: z.enum(["homa", "parent", "onboarding", "call", "review"]),
  }),
  // The evening journal prompt (item 7, FR-6 seed; flag-dark). channel
  // arrived with the dispatcher (gateway-plan GW-4): the agent composes,
  // the dispatch channel delivers by text or email.
  "journal.prompt_sent": z.object({
    family_id: z.uuid(),
    channel: z.enum(["sms", "email"]),
  }),
  // Inbound email adapter (gateway-plan GW-3). No addresses, no content.
  "email.message_received": z.object({
    linked_family: z.boolean(),
  }),
  // Phone-first leads (lead-funnel-plan LF-6). Channel only: no numbers,
  // no names, no content (MJ-08).
  "lead.captured": z.object({
    channel: z.enum(["sms", "voice"]),
  }),
  // Text-native signup completed a child's report (sms-onboarding-plan
  // SO-4). Counts only.
  "signup.sms_completed": z.object({
    family_id: z.uuid(),
    questions_answered: z.number().int().min(0),
  }),
  // Verified phone claim (sms-onboarding-plan U2/U7): a texted code
  // proved possession and the number routed to the caller's family.
  "sms.phone_claim_started": z.object({
    family_id: z.uuid(),
  }),
  "sms.phone_claimed": z.object({
    family_id: z.uuid(),
    folded_stub: z.boolean(),
    moved_number: z.boolean(),
  }),
  "lead.invited": z.object({
    channel: z.enum(["sms", "voice"]),
  }),
  "lead.converted": z.object({
    channel: z.enum(["sms", "voice"]),
  }),
  "email.opt_out": z.object({
    family_id: z.uuid(),
    resumed: z.boolean(),
  }),
  // Capture-time hours (M3-05 slice, 2026-07-09). Subject and minutes
  // are the whole story; the note (parent's words) is PII-adjacent and
  // stays on the row.
  "voice.hours_logged": z.object({
    family_id: z.uuid(),
    child_id: z.uuid().optional(),
    subject: z.string(),
    minutes: z.number().int().min(1).max(600),
  }),
  // Same tool, web chat + SMS (agent/tools/send_followup_email.ts).
  "chat.email_sent": z.object({
    family_id: z.uuid(),
    channel: z.enum(["web", "sms"]),
  }),
  // Same capture-time hours, from the chat agent's tool. Emitted with
  // the caller's token (chat.% policy); family_id rides the row column.
  "chat.hours_logged": z.object({
    subject: z.string(),
    minutes: z.number().int().min(1).max(600),
    channel: z.enum(["web", "sms", "email", "dispatch"]),
  }),
  // The recall tool (item 4, M2-15): the agent searched its own history.
  // Emitted with the caller's token (chat.% policy). Query text never
  // enters props; scope and result count are the whole story.
  "chat.recall_used": z.object({
    scope: z.enum(["calls", "chats", "memories", "all"]),
    results: z.number().int().min(0),
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
