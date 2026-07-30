/**
 * The filing reminder stays DARK until counsel reviews the letter
 * wording (founder ruling 6, 2026-07-29: "build it all now, but the
 * automatic emails stay switched off until a lawyer reviews it").
 * gh#423 is that review.
 *
 * The reason the flag guards the SEND and not the whole sweep: the plan
 * is worth computing every hour whether or not anything goes out. It is
 * how the founder sees that thirty families are two weeks from a legal
 * deadline and none of them can be told yet.
 *
 * Only the exact string turns it on. Anything else, including unset,
 * keeps it off, so a missing or mistyped env var can never start mailing
 * real families about a legal deadline on unreviewed wording.
 */
export function filingRemindersEnabled(): boolean {
  return process.env.HOMA_FILING_REMINDERS_ENABLED === "true";
}
