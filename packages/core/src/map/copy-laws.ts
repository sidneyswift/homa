/**
 * The copy laws, shared verbatim by the build-time content lint
 * (scripts/map-check.mts) and the runtime narrative gate
 * (map/narrative-gate.ts), so the two can never drift.
 *
 * BANNED_WORDS is the journeys/07 never-say list: no deficit words, no
 * diagnosis vocabulary, no testing vocabulary. "test" itself is allowed
 * only inside "never a test" phrasing and is checked separately by the
 * build script, not here. EM_DASH is the brand law (AGENTS.md): no em
 * dash, ever, anywhere.
 */
export const BANNED_WORDS = /\b(behind|delayed?|disorder|diagnos\w*|screening|assessment|percentile)\b/i;

export const EM_DASH = /\u2014/;

/**
 * Third-person gendered pronouns. The product never collects a child's
 * sex, so the writer must never infer one from a name (founder report,
 * 2026-07-07: a boy named Story was written up as "she"). Same law as
 * numbers: gendered words are allowed in generated prose ONLY when the
 * parent's own words in the facts payload use them first; otherwise the
 * child is "they", and the gate rejects the piece.
 */
export const GENDERED_PRONOUNS = /\b(he|him|his|she|her|hers)\b/i;
