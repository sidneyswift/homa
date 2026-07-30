/**
 * The stranded-chain follow-up ships DARK.
 *
 * Founder ruling 2026-07-30 permits the message; it does not say start
 * mailing eighty families tonight. This is the first proactive send Homa
 * has ever made about a parent's unfinished work, the not-nagging line
 * is the whole design, and the backlog it would address is two weeks
 * deep, so the first run reaches people about things they may barely
 * remember asking for.
 *
 * Same posture as the drip and the filing reminder: only the exact
 * string turns it on, so a missing or mistyped variable can never start
 * a send. Unlike the drip, the SWEEP still runs while dark, because the
 * eligible count is the number that says whether this is worth turning
 * on at all.
 */
export function strandedFollowupsEnabled(): boolean {
  return process.env.HOMA_STRANDED_FOLLOWUP_ENABLED === "true";
}
