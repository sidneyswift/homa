/**
 * The canonical activation signals, in one place because two systems must
 * agree on them: the founder console's activation ladder
 * (lib/admin/funnel-data.ts) reports these rungs, and the onboarding drip
 * (lib/drip/sweep.ts) nudges toward the one families fall off.
 *
 * If these lists drift apart, the console reports a cliff the drip is not
 * actually aiming at, so both import from here.
 *
 * Parent-initiated only. Homa's own activity (briefs sent, cards mailed,
 * narratives generated) is never an activation signal, and neither is
 * progress.evidence_recorded, which the scoring pipeline emits during the
 * assessment rather than a parent logging anything.
 */

/** Rung 3: Homa's prep landed and the parent kept it. Something now exists
 * that the parent can actually report back on. */
export const KEPT_PREP_EVENTS = [
  "map.plan_consented",
  "materials.finalized",
] as const;

/** Rung 4: the parent told Homa how it went. The loop that makes Homa
 * smarter, and the measured cliff (5 of 36 families on 2026-07-20). */
export const LOOP_BACK_EVENTS = [
  "progress.observation_saved",
  "map.answers_corrected",
  "chat.hours_logged",
  "map.plan_progress",
] as const;

/** Every event that proves a human hand did something, for the week-two
 * return check. Parent messages live in conversation_messages, not here. */
export const PARENT_INITIATED_EVENTS = [
  "map.report_viewed",
  "report.action_tapped",
  ...KEPT_PREP_EVENTS,
  ...LOOP_BACK_EVENTS,
] as const;
