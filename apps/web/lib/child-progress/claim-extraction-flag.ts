/**
 * Turns on model-judged claim extraction (AGENTS.md "Models judge,
 * code verifies"). Off keeps the legacy lexical matcher, which is the
 * safe rollback direction: the matcher writes less than extraction,
 * never more, so turning this off can lose new signal but can never
 * corrupt a record that already exists.
 *
 * Its own module rather than a second export from flag.ts, because
 * that module's test pins it to exactly one export as a guard against
 * anyone adding a bypass to the live-progress gate.
 */
export function claimExtractionEnabled(): boolean {
  return process.env.HOMA_CLAIM_EXTRACTION_ENABLED === "true";
}
