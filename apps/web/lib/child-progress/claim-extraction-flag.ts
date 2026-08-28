/**
 * Turns on model-judged claim extraction (AGENTS.md "Models judge,
 * code verifies"). Off (or a failed extraction call) records the
 * parent's message as an unscored observation instead: the safe
 * rollback direction, since it can lose new signal but can never
 * write a fabricated score. There is no lexical-matcher fallback
 * (retired, see the "Models judge, code verifies" law: pattern
 * matching never gets to decide what a sentence means, not even as a
 * safety net).
 *
 * Its own module rather than a second export from flag.ts, because
 * that module's test pins it to exactly one export as a guard against
 * anyone adding a bypass to the live-progress gate.
 */
export function claimExtractionEnabled(): boolean {
  return process.env.HOMA_CLAIM_EXTRACTION_ENABLED === "true";
}
