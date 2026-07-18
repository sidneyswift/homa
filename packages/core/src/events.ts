import { z } from "zod";

import { MAP_ANSWERS } from "./map/bank";
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

/** The wall's doors: the four report actions the paywall stands in
 *  front of (plans/2026-07-11-the-wall.md), plus "report" for the
 *  report lock's held-subjects offer (plans/2026-07-18-report-lock.md).
 *  Shared by the wall.* and report.action_tapped schemas and the beacon
 *  route's request schema. */
export const WALL_DOORS = ["plan", "month", "call", "chat", "report"] as const;
export type WallDoor = (typeof WALL_DOORS)[number];

const PROGRESS_EVENT_DIMENSION_ID_SCHEMA = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9_-]*$/u);

const PROMPT_SUGGESTION_EVENT_FIELDS = {
  suggestion_set_id: z.uuid(),
  prompt_version: z.string().min(1).max(40),
  source: z.enum(["model", "fallback"]),
} as const;

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
  // The onboarding depth fork (plans/2026-07-11-onboarding-depth-fork.md,
  // founder rulings 2026-07-11): after a subject's core questions the mom
  // chooses depth. Take-rate per subject reads straight off choice.
  "map.depth_fork_decided": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    subject: z.string(),
    choice: z.enum(["deeper", "move_on"]),
  }),
  // One event per graph-walk card answered (the walk's heartbeat).
  // domain is the level-2 skill line, so drop-off localizes to a strand.
  "map.walk_answered": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    subject: z.string(),
    domain: z.string(),
    answer: z.enum(["easily", "getting_there", "not_yet", "not_sure", "skip"]),
  }),
  // A walk sitting ended. stopped_early is the mid-walk drop-off signal
  // the founder asked to watch from day one; silent abandonment shows as
  // a deeper fork with no walk_ended row.
  "map.walk_ended": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    subject: z.string(),
    questions_answered: z.number().int().min(0),
    outcome: z.enum(["frontier_found", "budget_reached", "stopped_early"]),
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
  // ChildProgress emits only after a committed, non-replayed operation.
  // Item identifiers, operation identifiers, quotes, messages, and adult
  // contact or display data stay out of analytics properties.
  "progress.evidence_recorded": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      source: z.enum([
        "journal",
        "conversation",
        "check_in",
        "checklist",
        "deep_dive",
        "correction",
        "report_correction",
        "report_probe",
        "recheck",
        "onboarding_walk",
        "legacy",
        "lesson_listen",
      ]),
      items: z.number().int().min(1),
      supersedes: z.boolean(),
    })
    .strict(),
  "progress.checkin_started": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      scope: z.enum(["whole", "subject"]),
      subject: PROGRESS_EVENT_DIMENSION_ID_SCHEMA.optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.scope === "whole" && value.subject !== undefined) {
        context.addIssue({
          code: "custom",
          message: "Whole-progress check-ins cannot name one subject",
          path: ["subject"],
        });
      }
    }),
  "progress.checkin_answered": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      subject: PROGRESS_EVENT_DIMENSION_ID_SCHEMA,
      domain: PROGRESS_EVENT_DIMENSION_ID_SCHEMA,
      answer: z.enum(MAP_ANSWERS),
    })
    .strict(),
  "progress.checkin_paused": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      reason: z.enum([
        "topic_change",
        "explicit_stop",
        "conflict",
        "delivery_uncertain",
        "delivery_failed",
        "member_removed",
      ]),
    })
    .strict(),
  "progress.checkin_resumed": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      takeover: z.boolean(),
    })
    .strict(),
  "progress.checkin_ended": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      outcome: z.enum(["completed", "stopped"]),
    })
    .strict(),
  "progress.conflict_opened": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      subject: PROGRESS_EVENT_DIMENSION_ID_SCHEMA,
      domain: PROGRESS_EVENT_DIMENSION_ID_SCHEMA,
    })
    .strict(),
  "progress.conflict_resolved": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      subject: PROGRESS_EVENT_DIMENSION_ID_SCHEMA,
      domain: PROGRESS_EVENT_DIMENSION_ID_SCHEMA,
      resolution: z.literal("confirmed"),
    })
    .strict(),
  "progress.projection_updated": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      subjects_touched: z.number().int().min(1),
      had_conflict: z.boolean(),
    })
    .strict(),
  // The observation ledger (plan 2026-07-13-observation-ledger.md):
  // journal input the matcher cannot score is kept as an observation.
  // Quotes, item identifiers, and adult data stay out of properties.
  "progress.observation_saved": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      classification: z.enum([
        "no_match",
        "activity_only",
        "ambiguous",
      ]),
    })
    .strict(),
  "progress.observation_used": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
    })
    .strict(),
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
  // into PNG before the model sees them), described (video clips watched
  // end to end by the Twelve Labs gateway, 2026-07-11), transcribed
  // (voice notes through STT; video clips when the visual lane is dark
  // or missed), extracted (Word/Excel text pulled out), inlined
  // (text-format files), or failed (bracketed acknowledgement note).
  // Never any content, never a number.
  "sms.attachment_processed": z.object({
    kind: z.enum(["image", "audio", "video", "document", "text", "other"]),
    media_type: z.string(),
    outcome: z.enum([
      "model_native",
      "converted",
      "described",
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
      "packet",
      "other",
    ]),
    source: z.enum(["html", "image", "hybrid"]),
    // Packets (multi-page builds, 2026-07-17) carry their true PDF page
    // count; single pages report 1.
    page_count: z.number().int().min(1).optional(),
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
  // The studio's photo desk (SerpAPI Google Images): each search spends
  // one unit of the small shared monthly quota, so volume per family is
  // the story. Queries never enter props (they can carry topic text).
  "materials.photo_searched": z.object({
    family_id: z.uuid(),
    channel: z.enum(["web", "sms", "email", "dispatch"]),
    results: z.number().int().min(0),
    duration_ms: z.number().int().min(0),
  }),
  // A found photo was copied into the family's own artifact space and
  // became reusable (printable embeds, generate_image references).
  "materials.photo_imported": z.object({
    family_id: z.uuid(),
    channel: z.enum(["web", "sms", "email", "dispatch"]),
    bytes: z.number().int().min(0),
    duration_ms: z.number().int().min(0),
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
  // Homa's contact card (vCard MMS, founder ask 2026-07-10) went out.
  // first_text = a brand-new number's first inbound message; linked =
  // the notification when a number connects to a family. sent=false
  // rows surface carrier or media fetch trouble. No numbers (MJ-08).
  "sms.contact_card_sent": z.object({
    trigger: z.enum(["first_text", "linked"]),
    sent: z.boolean(),
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
  // Web chat attachments (approved chat redesign 2026-07-13), the
  // sms.attachment_processed twin: one event per attached file, naming
  // the lane it took. Never any content, filename, or URL.
  "chat.attachment_processed": z.object({
    kind: z.enum(["image", "audio", "video", "document", "text", "other"]),
    media_type: z.string(),
    outcome: z.enum([
      "model_native",
      "described",
      "transcribed",
      "extracted",
      "inlined",
      "failed",
    ]),
    filed_to_child: z.boolean(),
  }),
  // Webchat prompt suggestions. Correlation, source, position, and timing
  // only; suggestion text and conversation content never enter events.
  "chat.prompt_suggestions_shown": z
    .object({
      ...PROMPT_SUGGESTION_EVENT_FIELDS,
      count: z.number().int().min(1).max(2),
      latency_ms: z.number().int().min(0),
    })
    .strict(),
  "chat.prompt_suggestion_tapped": z
    .object({
      ...PROMPT_SUGGESTION_EVENT_FIELDS,
      position: z.number().int().min(0).max(1),
    })
    .strict(),
  // Chat (FR-4). journeys/06 §4.4 #15. Emitted with the signed-in caller's
  // token and family_id (events policy, migration #13). No message content.
  "chat.turn_completed": z.object({
    status: z.enum(["ok", "error"]),
    error_class: z.enum(["turn_failed", "send_failed", "unknown"]).optional(),
    modality: z.enum(["text", "voice"]),
    latency_ms: z.number().int().min(0),
    model_tier: z.enum(["fast", "mid", "premium"]),
    tool_calls: z.number().int().min(0),
    suggestion_set_id: z.uuid().optional(),
  }),
  // Canonical persistence successfully claimed one open loop for a parent
  // reply. Ambiguous candidates never emit. No content, message id, or
  // recipient address enters events.
  "conversation.reply_resolved": z
    .object({
      family_id: z.uuid(),
      channel: z.enum(["web", "sms", "email"]),
      resolution: z.literal("matched"),
      resolved_outcome: z.enum(["accepted", "declined", "answered"]),
      cross_channel: z.boolean(),
      resolution_method: z
        .enum([
          "explicit_delivery",
          "provider_reply",
          "content_clarification",
          "prompt_key",
          "bounded_polarity",
          "same_channel_free_text",
          "progress_choice",
        ])
        .optional(),
      classifier_version: z.string().min(1).max(40).optional(),
    })
    .strict(),
  // A trusted post-acceptance tool completed one durable effect for a
  // causally linked morning brief offer. Result ids and content stay out.
  "conversation.offer_fulfilled": z
    .object({
      family_id: z.uuid(),
      source: z.literal("morning_brief"),
      fulfillment_kind: z.enum(["material", "task"]),
    })
    .strict(),
  // The task framework (HT-1/HT-7). One event per finished proactive
  // run; fleet runs carry no family_id. Kind + status only, no content.
  "tasks.run_completed": z.object({
    family_id: z.uuid().optional(),
    kind: z.enum(["journal_prompt", "morning_brief", "custom", "fleet_research"]),
    status: z.enum([
      "done",
      "partial",
      "partial_uncertain",
      "uncertain",
      "failed",
      "skipped",
    ]),
  }),
  // The weekday morning research brief reached a parent (HT-4, D-ht-2).
  "research.brief_sent": z.object({
    family_id: z.uuid(),
    channel: z.enum(["sms", "email"]),
  }),
  // One adult's explicit response to a confirmed delivered brief. The
  // run id is pseudonymous; adult identity and brief content stay out.
  "research.brief_feedback": z
    .object({
      family_id: z.uuid(),
      task_run_id: z.uuid(),
      signal: z.enum(["helpful", "not_for_us"]),
    })
    .strict(),
  // Family invites (multi-parent plan Phase 3 plus SMS consent flow).
  // Email acceptance creates a family member through /join; SMS
  // acceptance links the recipient's verified phone to the family.
  // No email addresses, phone numbers, or child details in props (MJ-08).
  // NT-4's fuller
  // account.secondary_user_added shape (relationship enum) waits for
  // roles to mean something.
  "family.invite_sent": z.object({
    family_id: z.uuid(),
    channel: z.enum(["email", "sms"]),
  }),
  "family.invite_accepted": z.object({
    family_id: z.uuid(),
    channel: z.enum(["email", "sms"]),
  }),
  // Child photo personalization (D4, migration #75): the dedicated
  // consent screen's agree moment, then each photo change on a child.
  // Ids only, never URLs or names (MJ-08).
  "family.child_photo_consented": z.object({
    family_id: z.uuid(),
  }),
  "family.child_photo_updated": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    action: z.enum(["set", "removed"]),
  }),
  // Lesson listen (plan 2026-07-13-lesson-listen.md, ruling
  // lesson-listen-child-audio): the dedicated consent screen's agree
  // moment, then the pipeline's lifecycle. Ids, counts, and
  // classifications only; transcripts, tone notes, quotes, and URLs
  // never ride events (MJ-08).
  "family.lesson_audio_consented": z.object({
    family_id: z.uuid(),
  }),
  "lesson.recorded": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    source: z.enum(["recorder", "upload"]),
    segment_count: z.number().int().min(0),
    duration_seconds: z.number().int().min(0).nullable(),
  }),
  "lesson.review_ready": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    evidence_count: z.number().int().min(0),
    observation_count: z.number().int().min(0),
    moment_count: z.number().int().min(0),
    // Segments with tone notes over total: the PMF read's "was the
    // tone lane deaf" signal (plan §4.7).
    tone_coverage: z.number().min(0).max(1),
  }),
  "lesson.media_attached": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    when: z.enum(["during", "finish", "after_ready"]),
  }),
  "lesson.failed": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    stage: z.enum(["transcription", "synthesis"]),
  }),
  // A research row entered (or was refused by) the knowledge bank's
  // automated gate (HT-2, D-ht-5). Topic type only, never content.
  "knowledge.row_merged": z.object({
    topic_type: z.enum(["method_philosophy", "method_format", "subject", "study", "other"]),
    gate: z.enum(["passed", "flagged"]),
  }),
  // A physical thank-you card order was placed with the mail vendor
  // (plans/2026-07-11-thank-you-cards.md). One per family, ever; the
  // name, address, and message are PII and live on the thank_you_cards
  // row, never here.
  "card.thank_you_sent": z.object({
    family_id: z.uuid(),
  }),
  // The wall (paywall groundwork, built DARK behind HOMA_WALL_ENABLED;
  // plans/2026-07-11-the-wall.md). A "door" is one of the four report
  // actions the wall will stand in front of. Door taps fire with the
  // flag OFF too, on purpose: the paywall decision wants baseline
  // tap-through data from the free era, and `walled` says which era a
  // tap belongs to.
  "report.action_tapped": z.object({
    family_id: z.uuid(),
    child_id: z.uuid().optional(),
    door: z.enum(WALL_DOORS),
    walled: z.boolean(),
  }),
  // The wall rendered: the modal opened on a door, or the plan page
  // served its full-page offer instead of building a plan.
  "wall.viewed": z.object({
    family_id: z.uuid(),
    door: z.enum(WALL_DOORS),
  }),
  "wall.dismissed": z.object({
    family_id: z.uuid(),
    door: z.enum(WALL_DOORS),
  }),
  // She left for Stripe checkout (a Payment Link tab, plan chosen).
  "wall.checkout_started": z.object({
    family_id: z.uuid(),
    door: z.enum(WALL_DOORS),
    plan: z.enum(["monthly", "annual"]),
  }),
  // /api/billing/confirm verified the checkout session and stamped
  // trial_started_at. Fires only on the first confirm; a re-visit of
  // the confirmation URL is a no-op.
  "billing.trial_started": z.object({
    family_id: z.uuid(),
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
