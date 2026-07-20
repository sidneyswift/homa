/**
 * The onboarding drip stays DARK until its copy has cleared review and the
 * compliance work (List-Unsubscribe, one-click opt-out, suppression on
 * bounce/complaint) has landed. Only the exact documented value turns the
 * automated sweep on; anything else, including unset, keeps it off, so a
 * missing env var can never start emailing real families. The founder
 * preview action (send one nudge to the founder's own address) does NOT
 * read this flag: it is an explicit, per-click send to the founder alone.
 *
 * Plan: docs/homa-planning/plans/2026-07-20-onboarding-funnel-drip.md,
 * Phase 3/4.
 */
export function dripEnabled(): boolean {
  return process.env.HOMA_DRIP_ENABLED === "true";
}
