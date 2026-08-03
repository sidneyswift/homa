import { z } from "zod";

import {
  CAPTURE_LOOP_EVENT_NAME,
  captureLoopEventPropsSchema,
  nativeCaptureLoopEventPropsSchema,
} from "./capture-loop";
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

/** The wall's doors: the report actions the paywall stands in front
 *  of (plans/2026-07-11-the-wall.md), plus "lesson" for the subject-lesson
 *  build door, "report" for the report lock's held-subjects offer
 *  (plans/2026-07-18-report-lock.md), and "signup" for the account-level
 *  trial gate right after account creation (founder directive 2026-07-26:
 *  the card comes out before the product, HOMA_SIGNUP_PAYWALL_ENABLED).
 *  Shared by the wall.* and report.action_tapped schemas and the beacon
 *  route's request schema. */
export const WALL_DOORS = ["plan", "month", "call", "chat", "lesson", "report", "signup"] as const;
export type WallDoor = (typeof WALL_DOORS)[number];

/** The onboarding flow's trackable cards: map-flow.tsx's FlowPhase minus
 *  the non-card "loading" and "bootstrap-error" states. Emitted once per
 *  family per step by map.step_viewed, so per-card drop-off is finally
 *  measurable: before this, a family stuck on the parent (account) step
 *  was indistinguishable in the data from one that never arrived. Shared
 *  by the event schema and the /api/map/step route's allowlist. Funnel
 *  work 2026-07-20 (docs/homa-planning/plans/2026-07-20-onboarding-funnel-drip.md). */
export const MAP_FLOW_STEPS = [
  "parent",
  /** The signup trial gate between the account card and the product
   *  (founder directive 2026-07-26, HOMA_SIGNUP_PAYWALL_ENABLED): its
   *  own step so paywall drop-off is visible next to the cards around
   *  it. */
  "paywall",
  /** Chat-first onboarding's one step after the account
   *  (plans/2026-07-21-chat-first-onboarding.md). Kept in the same
   *  allowlist as the card steps so the funnel can compare the two
   *  flows on one chart instead of two. */
  "chat",
  "family",
  "homeschool",
  "kids",
  "preparing",
  "checklist",
  "extras",
  "next-kid",
  "scoring",
  "deepdive",
  "hub",
] as const;
export type MapFlowStep = (typeof MAP_FLOW_STEPS)[number];

const PROGRESS_EVENT_DIMENSION_ID_SCHEMA = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9_-]*$/u);
const SESSION_HASH_SCHEMA = z.string().regex(/^[a-f0-9]{64}$/u);

const PROMPT_SUGGESTION_EVENT_FIELDS = {
  suggestion_set_id: z.uuid(),
  prompt_version: z.string().min(1).max(40),
  source: z.enum(["model", "fallback"]),
} as const;

const SUBJECT_LESSON_EVENT_FIELDS = {
  family_id: z.uuid(),
  child_id: z.uuid(),
  subject: z.string(),
} as const;

/**
 * Where a planner interaction happened (the one-planner arc, issue
 * #257 PR B0 and plans/2026-07-27-planner-calendar-ecosystem.md §4.6:
 * instrument BOTH the old and the new surfaces). "chat" is a tool call
 * in any chat channel; "planner_page" and "calendar_page" are the two
 * pre-unification routes; "grid" is the unified surface's week grid
 * (arrives with arc B1/C emitters).
 */
export const PLANNER_EVENT_SURFACES = [
  "chat",
  "planner_page",
  "calendar_page",
  "grid",
] as const;
export type PlannerEventSurface = (typeof PLANNER_EVENT_SURFACES)[number];

/**
 * Which client rendered the surface. Chat tools map their channel
 * attribute here (apps/web/lib/planner-events.ts); anything the mapper
 * does not recognize lands in "other" rather than being dropped.
 */
export const PLANNER_EVENT_CLIENTS = [
  "web",
  "mobile",
  "sms",
  "email",
  "dispatch",
  "agent_job",
  "other",
] as const;
export type PlannerEventClient = (typeof PLANNER_EVENT_CLIENTS)[number];

/**
 * Native startup stages that can block the first usable screen. These events
 * are deliberately content-free and family-free because fonts and persisted
 * auth can fail before Homa has a trustworthy family context.
 */
export const MOBILE_BOOTSTRAP_STAGES = [
  "fonts",
  "session",
  "family",
  "consent",
  "billing",
] as const;
export type MobileBootstrapStage = (typeof MOBILE_BOOTSTRAP_STAGES)[number];

export const MOBILE_BOOTSTRAP_FAILURE_REASONS = [
  "timeout",
  "offline",
  "expired_session",
  "not_ready",
  "server_error",
  "unknown",
] as const;
export type MobileBootstrapFailureReason =
  (typeof MOBILE_BOOTSTRAP_FAILURE_REASONS)[number];

/**
 * The only family-scoped analytics names a native client may submit through
 * the authenticated mobile event relay. Keeping this allowlist beside the
 * canonical schemas prevents the app and server from drifting into two
 * different contracts.
 */
export const MOBILE_FAMILY_EVENT_NAMES = [
  "chat.turn_completed",
  "materials.print_result",
  "materials.share_result",
  "planner.device_calendar_previewed",
  "planner.device_calendar_export_finished",
  CAPTURE_LOOP_EVENT_NAME,
] as const;
export type MobileFamilyEventName =
  (typeof MOBILE_FAMILY_EVENT_NAMES)[number];

/** The three governed scheduling-offer venues (§4.3.8): the empty-grid
 * card, the moment after the first plan is built, and the capped
 * morning-brief offer. */
export const PLANNER_OFFER_VENUES = [
  "empty_grid",
  "first_plan",
  "morning_brief",
] as const;

const SUBJECT_LESSON_ATTEMPT_SCHEMA = z.number().int().min(1);
const SUBJECT_LESSON_ERROR_CODE_SCHEMA = z.string().min(1).max(80);
const MATERIAL_EVENT_CHANNEL_SCHEMA = z.enum([
  "web",
  "sms",
  "email",
  "dispatch",
]);
const MATERIAL_CREATION_EVENT_CHANNEL_SCHEMA = z.enum([
  "web",
  "sms",
  "email",
  "dispatch",
  "subject_lesson",
]);

export const EVENT_SCHEMAS = {
  "waitlist.joined": z.object({
    source: z.enum(WAITLIST_SOURCES),
    channel_variant: z.enum(["default", "conference"]),
    us_state: z.string().optional(),
    kid_age_bands: z.array(z.enum(KID_AGE_BANDS)).default([]),
  }),
  "mobile.bootstrap_failed": z.object({
    stage: z.enum(MOBILE_BOOTSTRAP_STAGES),
    reason: z.enum(MOBILE_BOOTSTRAP_FAILURE_REASONS),
  }),
  "mobile.bootstrap_attempted": z.object({
    stage: z.enum(MOBILE_BOOTSTRAP_STAGES),
  }),
  "mobile.bootstrap_recovered": z.object({
    stage: z.enum(MOBILE_BOOTSTRAP_STAGES),
    reason: z.enum(MOBILE_BOOTSTRAP_FAILURE_REASONS),
  }),
  [CAPTURE_LOOP_EVENT_NAME]: captureLoopEventPropsSchema,
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
    // "instant" is the report page straight out of the card flow,
    // "link" is the emailed copy, and "chat" is the reveal landing
    // inside the conversation (chat-first onboarding). The whole claim
    // of that rebuild is that a report she is shown beats a report she
    // is emailed, and this is the field that settles it.
    entry: z.enum(["instant", "link", "chat"]),
  }),
  // Fired once per family per onboarding card reached (map-flow.tsx phase
  // transitions, beaconed through /api/map/step). The step is a UI phase
  // name, never content, so this carries no PII. This is the only event
  // that makes per-card onboarding drop-off measurable. Funnel work
  // 2026-07-20.
  "map.step_viewed": z.object({
    family_id: z.uuid(),
    step: z.enum(MAP_FLOW_STEPS),
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
  // A parent requested one next-skill lesson and printable worksheet from
  // a subject card. Attempts begin when the background builder claims the
  // durable row. Error details stay in the row; events carry a bounded code.
  "map.subject_lesson_requested": z
    .object(SUBJECT_LESSON_EVENT_FIELDS)
    .strict(),
  "map.subject_lesson_started": z
    .object({
      ...SUBJECT_LESSON_EVENT_FIELDS,
      attempt: SUBJECT_LESSON_ATTEMPT_SCHEMA,
    })
    .strict(),
  "map.subject_lesson_ready": z
    .object({
      ...SUBJECT_LESSON_EVENT_FIELDS,
      attempt: SUBJECT_LESSON_ATTEMPT_SCHEMA,
    })
    .strict(),
  "map.subject_lesson_failed": z
    .object({
      ...SUBJECT_LESSON_EVENT_FIELDS,
      attempt: SUBJECT_LESSON_ATTEMPT_SCHEMA,
      error_code: SUBJECT_LESSON_ERROR_CODE_SCHEMA,
    })
    .strict(),
  "map.subject_lesson_retried": z
    .object({
      ...SUBJECT_LESSON_EVENT_FIELDS,
      attempt: SUBJECT_LESSON_ATTEMPT_SCHEMA,
    })
    .strict(),
  // The account owner approved the ready lesson's attached worksheet.
  // Material identity and worksheet content stay in durable rows.
  "map.subject_lesson_kept": z
    .object(SUBJECT_LESSON_EVENT_FIELDS)
    .strict(),
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
  // The dense abilities explorer records navigation only. Ability ids,
  // names, evidence, quotes, and parent answers stay in the authenticated
  // product surface, never in analytics properties.
  "progress.explorer_opened": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      subject: z.enum(["math", "literacy", "science"]),
      device: z.enum(["desktop", "phone", "tablet", "unknown"]),
    })
    .strict(),
  "progress.explorer_subject_selected": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      subject: z.enum(["math", "literacy", "science"]),
      device: z.enum(["desktop", "phone", "tablet", "unknown"]),
    })
    .strict(),
  "progress.explorer_ability_detail_opened": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      subject: z.enum(["math", "literacy", "science"]),
      device: z.enum(["desktop", "phone", "tablet", "unknown"]),
    })
    .strict(),
  "progress.explorer_find_opened": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      subject: z.enum(["math", "literacy", "science"]),
      device: z.enum(["desktop", "phone", "tablet", "unknown"]),
    })
    .strict(),
  "progress.explorer_connected_ability_opened": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      subject: z.enum(["math", "literacy", "science"]),
      device: z.enum(["desktop", "phone", "tablet", "unknown"]),
    })
    .strict(),
  "progress.explorer_ask_homa_opened": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      subject: z.enum(["math", "literacy", "science"]),
      device: z.enum(["desktop", "phone", "tablet", "unknown"]),
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
  // The one-planner arc's own namespace (issue #257 PR B0; the plan
  // doc's §4.6 instrumentation law: both old and new surfaces). Emitted
  // server-side through emitMapEvent. Props carry ids, subject ids,
  // week numbers, and enums only, never activity text or event titles.
  // Someone opened the planner: the open_planner tool, or one of the
  // week routes rendering server-side.
  "planner.viewed": z
    .object({
      family_id: z.uuid(),
      // Set when the view was narrowed to one child (tool calls only;
      // the pages emit family-wide).
      child_id: z.uuid().optional(),
      surface: z.enum(PLANNER_EVENT_SURFACES),
      client: z.enum(PLANNER_EVENT_CLIENTS),
    })
    .strict(),
  // One plan activity got (or moved to) a real persisted date.
  "planner.activity_scheduled": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      subject: z.string().min(1).max(80),
      week: z.number().int().min(1).max(4),
      surface: z.enum(PLANNER_EVENT_SURFACES),
      client: z.enum(PLANNER_EVENT_CLIENTS),
    })
    .strict(),
  // A reshuffle moved school work around real life; moves counts the
  // batch. Staged until the arc-C reshuffle receipt lands (gh#259).
  "planner.week_repaired": z
    .object({
      family_id: z.uuid(),
      moves: z.number().int().min(1),
      surface: z.enum(PLANNER_EVENT_SURFACES),
      client: z.enum(PLANNER_EVENT_CLIENTS),
    })
    .strict(),
  // The governed scheduling offers (§4.3.8), shown vs accepted per
  // venue. Staged until the arc-B1 offer cards land (gh#258).
  "planner.offer_shown": z
    .object({
      family_id: z.uuid(),
      venue: z.enum(PLANNER_OFFER_VENUES),
    })
    .strict(),
  "planner.offer_accepted": z
    .object({
      family_id: z.uuid(),
      venue: z.enum(PLANNER_OFFER_VENUES),
    })
    .strict(),
  // One activity checked off, split by register (rail vs grid) so the
  // success metric's paired diagnostic reads straight off events.
  // Staged until the arc-B1 registers and per-toggle op land (gh#258).
  "planner.checkoff": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      subject: z.string().min(1).max(80),
      register: z.enum(["rail", "grid"]),
      surface: z.enum(PLANNER_EVENT_SURFACES),
      client: z.enum(PLANNER_EVENT_CLIENTS),
    })
    .strict(),
  // A parent checked the exact device-calendar export before Homa asked
  // for write-only access. Counts only, never titles, notes, or calendar
  // names. The export remains a client-side copy of planner truth.
  "planner.device_calendar_previewed": z
    .object({
      family_id: z.uuid(),
      selected_count: z.number().int().min(1),
      duplicate_count: z.number().int().min(0),
    })
    .strict(),
  // The terminal receipt for one device-calendar export attempt. This is
  // deliberately aggregate-only because the app must not send personal
  // calendar metadata or planner content through analytics.
  "planner.device_calendar_export_finished": z
    .object({
      family_id: z.uuid(),
      outcome: z.enum(["saved", "canceled", "denied", "failed", "mixed", "duplicates_only"]),
      selected_count: z.number().int().min(1),
      saved_count: z.number().int().min(0),
      duplicate_count: z.number().int().min(0),
      failed_count: z.number().int().min(0),
    })
    .strict(),
  // Voice-built month plans (gh#539). Drafts remain session-bound until
  // approval, so these events carry only ids and counts, never plan copy.
  "planner.month_draft_requested": z
    .object({
      family_id: z.uuid(),
      draft_id: z.uuid(),
      child_count: z.number().int().min(1).max(8),
      client: z.enum(PLANNER_EVENT_CLIENTS),
    })
    .strict(),
  "planner.month_preview_ready": z
    .object({
      family_id: z.uuid(),
      draft_id: z.uuid(),
      revision: z.number().int().min(1),
      conflict_count: z.number().int().min(0),
      unresolved_count: z.number().int().min(0),
      client: z.enum(PLANNER_EVENT_CLIENTS),
    })
    .strict(),
  "planner.month_approved": z
    .object({
      family_id: z.uuid(),
      draft_id: z.uuid(),
      revision: z.number().int().min(1),
      child_count: z.number().int().min(1).max(8),
      client: z.enum(PLANNER_EVENT_CLIENTS),
    })
    .strict(),
  "planner.month_revised": z
    .object({
      family_id: z.uuid(),
      draft_id: z.uuid(),
      revision: z.number().int().min(2),
      client: z.enum(PLANNER_EVENT_CLIENTS),
    })
    .strict(),
  "planner.month_abandoned": z
    .object({
      family_id: z.uuid(),
      draft_id: z.uuid(),
      revision: z.number().int().min(1),
      client: z.enum(PLANNER_EVENT_CLIENTS),
    })
    .strict(),
  "planner.month_restored": z
    .object({
      family_id: z.uuid(),
      draft_id: z.uuid(),
      revision: z.number().int().min(2),
      restored_from: z.number().int().min(1),
      client: z.enum(PLANNER_EVENT_CLIENTS),
    })
    .strict(),
  // Homa edited a plan's activities from chat (the edit_plan tool, one
  // event per applied batch). Counts only, no activity text: the funnel
  // reads how often the agent drives the planner without carrying PII.
  "map.plan_edited": z.object({
    family_id: z.uuid(),
    child_id: z.uuid(),
    subject: z.string(),
    added: z.number().int().min(0),
    replaced: z.number().int().min(0),
    removed: z.number().int().min(0),
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
  // A carrier opt-out keyword arrived by text (2026-07-23): stop is
  // STOP and friends recorded into sms_suppressions, start is a
  // START/UNSTOP lifting one. The agent never runs for these texts.
  // No phone number in props, ever.
  // A known family texted on a plan that does not include texting
  // (gh#298, tier ruling 2026-07-28). She gets a real reply naming the
  // door, the agent never runs, and this counts it: how often the gate
  // is met is the number that says whether the second tier is priced
  // where parents actually want it. No phone number, no content.
  "sms.channel_gated": z.object({
    channel: z.enum(["sms", "voice", "email"]),
  }),
  "sms.opt_out_recorded": z.object({
    action: z.enum(["stop", "start"]),
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
  // A scheduled-task SMS was rejected because the provider cannot reach
  // the destination's region (Telnyx 40309): our sole-prop 10DLC profile
  // is US-only, so a non-US +1 number (e.g. Canada) our +1 normalization
  // accepts fails on every send. The family's text schedules were flipped
  // to email-only so the un-textable number is not retried and re-logged
  // daily (2026-07-23 founder-console cleanup). schedules_switched is how
  // many agent_schedules rows moved text -> email. No phone number, ever.
  "sms.delivery_region_unsupported": z.object({
    family_id: z.uuid(),
    schedules_switched: z.number().int().min(0),
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
    channel: MATERIAL_CREATION_EVENT_CHANNEL_SCHEMA,
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
    channel: MATERIAL_EVENT_CHANNEL_SCHEMA,
    duration_ms: z.number().int().min(0),
    has_references: z.boolean(),
  }),
  // The keeper moment (MS-3): a parent-approved version became the
  // family's final and its draft chain was tidied away.
  "materials.finalized": z.object({
    family_id: z.uuid(),
    channel: MATERIAL_EVENT_CHANNEL_SCHEMA,
    versions_superseded: z.number().int().min(0),
  }),
  // The studio's photo desk (SerpAPI Google Images): each search spends
  // one unit of the small shared monthly quota, so volume per family is
  // the story. Queries never enter props (they can carry topic text).
  "materials.photo_searched": z.object({
    family_id: z.uuid(),
    channel: MATERIAL_EVENT_CHANNEL_SCHEMA,
    results: z.number().int().min(0),
    duration_ms: z.number().int().min(0),
  }),
  // A found photo was copied into the family's own artifact space and
  // became reusable (printable embeds, generate_image references).
  "materials.photo_imported": z.object({
    family_id: z.uuid(),
    channel: MATERIAL_EVENT_CHANNEL_SCHEMA,
    bytes: z.number().int().min(0),
    duration_ms: z.number().int().min(0),
  }),
  // The funnel's missing terminal event (2026-07-25 field review): a
  // parent's own click on the PDF is the only signal that a material
  // reached her at all, and nothing recorded it before this, not
  // finalize (a phrase she may never say), not print (the browser owns
  // that). Emitted by the /api/materials/[id]/pdf redirect route.
  "materials.pdf_opened": z.object({
    family_id: z.uuid(),
    material_id: z.uuid(),
    status: z.enum(["draft", "final", "superseded"]),
  }),
  // Native iOS owns the only trustworthy print terminal. Ready is not an
  // outcome here: the app emits after UIPrintInteractionController's
  // completion handler reports completed, canceled, or failed.
  "materials.print_result": z
    .object({
      family_id: z.uuid(),
      material_id: z.uuid(),
      outcome: z.enum(["completed", "canceled", "failed"]),
      requested_copies: z.number().int().min(1).max(20),
      pages_selected: z.number().int().min(1),
      answer_key_excluded: z.boolean(),
    })
    .strict(),
  // The native share sheet is a parent-controlled handoff, never a
  // delivery receipt. No destination app, account, message, or child
  // detail enters analytics.
  "materials.share_result": z
    .object({
      family_id: z.uuid(),
      material_id: z.uuid(),
      outcome: z.enum(["handed_off", "canceled", "failed"]),
      reason: z
        .enum([
          "no-session",
          "app-backgrounded",
          "offline",
          "missing-material",
          "expired-material",
          "download-failed",
          "unsupported-destination",
          "share-failed",
        ])
        .optional(),
    })
    .strict(),
  // Family Library funnel and reuse loop (gh#580). Every shape is strict
  // and content-free: titles, filenames, URLs, search text, child names,
  // and extracted text never enter analytics.
  "library.upload_started": z
    .object({
      family_id: z.uuid(),
      upload_id: z.uuid(),
      bytes: z.number().int().min(1).max(524_288_000),
    })
    .strict(),
  "library.upload_completed": z
    .object({
      family_id: z.uuid(),
      asset_id: z.uuid(),
      bytes: z.number().int().min(1).max(524_288_000),
    })
    .strict(),
  "library.asset_processed": z
    .object({
      family_id: z.uuid(),
      asset_id: z.uuid(),
    })
    .strict(),
  "library.asset_reopened": z
    .object({
      family_id: z.uuid(),
      asset_id: z.uuid(),
      status: z.enum(["ready", "processing", "needs_attention", "failed"]),
    })
    .strict(),
  "library.searched": z
    .object({
      family_id: z.uuid(),
      query_length: z.number().int().min(0).max(180),
      active_filters: z.number().int().min(0).max(4),
      result_count: z.number().int().min(0).max(300),
    })
    .strict(),
  "library.original_downloaded": z
    .object({
      family_id: z.uuid(),
      asset_id: z.uuid(),
      surface: z.enum(["shelf", "detail"]),
    })
    .strict(),
  "library.asset_deleted": z
    .object({
      family_id: z.uuid(),
      asset_id: z.uuid(),
      prior_status: z.enum(["ready", "processing", "needs_attention", "failed"]),
    })
    .strict(),
  "library.asset_used": z
    .object({
      family_id: z.uuid(),
      asset_id: z.uuid(),
      use_kind: z.enum(["retrieval", "material", "planner"]),
    })
    .strict(),
  "library.curriculum_mapped": z
    .object({
      family_id: z.uuid(),
      asset_id: z.uuid(),
      draft_id: z.uuid(),
      unit_count: z.number().int().min(1).max(120),
      planner_target_count: z.number().int().min(0).max(40),
    })
    .strict(),
  // The state pack (journeys/06 rows 47-50, J4; shipped 2026-07-28 per
  // docs/homa-planning/plans/2026-07-28-state-pack.md). Deterministic
  // web feature over the state_requirements table; no agent involved.
  // Fired when the Binder's state pack card renders with a verified
  // state row in view (the requirements screen, spec row 47).
  "compliance.ruleset_viewed": z.object({
    family_id: z.uuid(),
    state: z.string().length(2),
    has_verified_date: z.boolean(),
  }),
  // The parent pressed the one button (spec row 48; the period enum the
  // spec once carried belonged to the retired evidence-report concept).
  "compliance.report_requested": z.object({
    family_id: z.uuid(),
    state: z.string().length(2),
  }),
  // The pack PDF rendered, uploaded, and finalized (spec row 49).
  "compliance.report_generated": z.object({
    family_id: z.uuid(),
    state: z.string().length(2),
    latency_ms: z.number().int().min(0),
    page_count: z.number().int().min(1),
  }),
  // The parent's own click opened the pack PDF (spec row 50, the J4
  // terminal; emitted by the materials pdf route for state packs).
  "compliance.report_downloaded": z.object({
    family_id: z.uuid(),
    state: z.string().length(2),
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
  // The general line's "have Homa call me" button (#283). Distinct from
  // voice.call_started, which is the curriculum line and always carries a
  // child; a general call is about the family, not one kid. One event
  // covers both outcomes so the tap and its result stay comparable.
  "voice.call_requested": z.object({
    family_id: z.uuid(),
    line: z.literal("general"),
    outcome: z.enum(["placed", "telnyx-error"]),
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
  // The general line's call-ended webhook (#171): fired when a finished
  // call is synced within seconds instead of waiting for the hourly cron.
  // Distinct from voice.transcript_synced, which fires on the row insert
  // either way; this one measures whether the fast path is actually
  // firing, which is the thing #171's acceptance criterion turns on.
  // In-app voice (#283, founder direction 2026-07-29): she tapped the
  // composer's voice button and a browser realtime session was minted.
  // Distinct from voice.call_requested, which dials a phone: this one
  // never leaves the app, runs on the AI Gateway under Vercel OIDC, and
  // is the surface the OpenAI Realtime work was actually for.
  "voice.realtime_session_started": z.object({
    family_id: z.uuid(),
    model: z.string(),
  }),
  "voice.call_ended_synced": z.object({
    linked_family: z.boolean(),
    message_count: z.number().int().min(0),
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
  // Background compaction tidied a family's saved memories (founder
  // rulings 2026-07-20 memory-render-time-budget and 2026-07-21
  // one-child-per-memory). Counts only, never content: chars_before and
  // chars_after are what tell us the pass earned its keep, since a run
  // that shrinks nothing should not be running. splits can legitimately
  // grow chars, so read the two together, not chars alone.
  "memory.compacted": z.object({
    family_id: z.uuid(),
    merges: z.number().int().min(0),
    splits: z.number().int().min(0),
    chars_before: z.number().int().min(0),
    chars_after: z.number().int().min(0),
  }),
  // A parent removed a saved memory from /home (the undo surface).
  "memory.forgotten": z.object({
    family_id: z.uuid(),
    source: z.enum(["homa", "parent", "onboarding", "call", "review"]),
  }),
  // Device sync mailbox (mac-mini spec Part 2 v2, 2026-07-25; flag-dark
  // behind HOMA_DEVICE_SYNC_ENABLED). Counts and kinds only, never
  // content: the payloads carry family data, the events never do.
  "mini_sync.batch_received": z.object({
    family_id: z.uuid(),
    received: z.number().int().min(0),
    inserted: z.number().int().min(0),
    duplicates: z.number().int().min(0),
    invalid: z.number().int().min(0),
  }),
  "mini_sync.event_applied": z.object({
    family_id: z.uuid(),
    kind: z.string(),
  }),
  "mini_sync.event_rejected": z.object({
    family_id: z.uuid(),
    kind: z.string(),
    reason: z.string(),
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
  // Chat (FR-4). journeys/06 §4.4 #15. Web emits under the signed-in caller's
  // token; native uses the authenticated server relay. No message content.
  "chat.turn_completed": z
    .object({
      status: z.enum(["ok", "error"]),
      error_class: z
        .enum(["turn_failed", "send_failed", "unknown"])
        .optional(),
      modality: z.enum(["text", "voice"]),
      latency_ms: z.number().int().min(0),
      model_tier: z.enum(["fast", "mid", "premium"]),
      tool_calls: z.number().int().min(0),
      suggestion_set_id: z.uuid().optional(),
    })
    .strict(),
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
  // A child Eve session was delegated by a parent-facing session. Only
  // one-way hashes enter analytics, never raw session identifiers or content.
  "conversation.session_delegated": z
    .object({
      family_id: z.uuid(),
      child_session_hash: SESSION_HASH_SCHEMA,
      parent_session_hash: SESSION_HASH_SCHEMA,
      root_session_hash: SESSION_HASH_SCHEMA,
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
    // Pairs the trust gate turned away: nonzero with zero evidence and
    // zero observations is the silent-loss signal (2026-07-21 replay).
    rejected_count: z.number().int().min(0),
    moment_count: z.number().int().min(0),
    // Segments with tone notes over total: the PMF read's "was the
    // tone lane deaf" signal (plan §4.7).
    tone_coverage: z.number().min(0).max(1),
    // Whether this lesson's recording outlived the 30-day TTL, and on
    // what (founder ruling `keep-their-voice`). Retention is a change
    // to a stated privacy posture, so its rate is measured from the
    // first lesson rather than discovered later from a storage bill or
    // a surprised parent.
    audio_kept: z.boolean(),
    audio_kept_kind: z.enum(["breakthrough", "sweet"]).nullable(),
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
  // plans/2026-07-11-the-wall.md). A "door" is one of the six report
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
  // tier defaults to "regular" so pre-tier-launch historical rows (the
  // only tier that ever existed) still validate on replay.
  "wall.checkout_started": z.object({
    family_id: z.uuid(),
    door: z.enum(WALL_DOORS),
    plan: z.enum(["monthly", "annual"]),
    tier: z.enum(["regular", "plus", "elite"]).default("regular"),
  }),
  // /api/billing/confirm verified the checkout session and stamped
  // trial_started_at. Fires only on the first confirm; a re-visit of
  // the confirmation URL is a no-op.
  "billing.trial_started": z.object({
    family_id: z.uuid(),
  }),
  // The Day 4 trial reminder actually reached Resend, for the family
  // named. Emitted only on a submitted send, so counting these against
  // billing.trial_started answers "did every trial get its reminder?"
  // without reading the email ledger.
  "billing.trial_reminder_sent": z.object({
    family_id: z.uuid(),
  }),
  // Agent jobs (the general finite-job primitive). Content-free fleet
  // analytics: family_id plus the skill and stage counts, never a title,
  // plan text, or any parent quote (that lives in the job rows). Emitted
  // server-side through emitMapEvent (the events policy is waitlist-only
  // for the Data API). job.started and job.cancelled emit from
  // lib/jobs/store.ts today; the three runner-emitted names are staged in
  // scripts/events-check.mts until the claim-lease runner lands.
  "job.started": z.object({
    family_id: z.uuid(),
    skill: z.string().min(2).max(60),
    total_stages: z.number().int().min(1).max(200),
  }),
  "job.stage_completed": z.object({
    family_id: z.uuid(),
    skill: z.string().min(2).max(60),
    stage_number: z.number().int().min(1).max(200),
    total_stages: z.number().int().min(1).max(200),
  }),
  "job.completed": z.object({
    family_id: z.uuid(),
    skill: z.string().min(2).max(60),
    total_stages: z.number().int().min(1).max(200),
  }),
  "job.cancelled": z.object({
    family_id: z.uuid(),
    skill: z.string().min(2).max(60),
    completed_stages: z.number().int().min(0).max(200),
  }),
  "job.failed": z.object({
    family_id: z.uuid(),
    skill: z.string().min(2).max(60),
    stage_number: z.number().int().min(1).max(200),
  }),
} as const;

export type EventName = keyof typeof EVENT_SCHEMAS;
export type EventProps<N extends EventName> = z.input<(typeof EVENT_SCHEMAS)[N]>;

/**
 * The native wire contract deliberately omits family_id. The authenticated
 * relay re-derives and stamps it, both inside schemas that require the field
 * and on the event row itself.
 */
export const mobileFamilyEventRequestSchema = z.discriminatedUnion("name", [
  z
    .object({
      name: z.literal("chat.turn_completed"),
      props: EVENT_SCHEMAS["chat.turn_completed"],
    })
    .strict(),
  z
    .object({
      name: z.literal("materials.print_result"),
      props: EVENT_SCHEMAS["materials.print_result"].omit({ family_id: true }),
    })
    .strict(),
  z
    .object({
      name: z.literal("materials.share_result"),
      props: EVENT_SCHEMAS["materials.share_result"].omit({ family_id: true }),
    })
    .strict(),
  z
    .object({
      name: z.literal("planner.device_calendar_previewed"),
      props: EVENT_SCHEMAS["planner.device_calendar_previewed"].omit({
        family_id: true,
      }),
    })
    .strict(),
  z
    .object({
      name: z.literal("planner.device_calendar_export_finished"),
      props: EVENT_SCHEMAS["planner.device_calendar_export_finished"].omit({
        family_id: true,
      }),
    })
    .strict(),
  z
    .object({
      name: z.literal(CAPTURE_LOOP_EVENT_NAME),
      props: nativeCaptureLoopEventPropsSchema,
    })
    .strict(),
]);

export type MobileFamilyEventRequest = z.infer<
  typeof mobileFamilyEventRequestSchema
>;
export type MobileFamilyEventClientProps<N extends MobileFamilyEventName> =
  Omit<EventProps<N>, "family_id">;

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
