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
