/**
 * Version stamp for the report writer (agent/report-writer.md plus the
 * generation schema in lib/map/narrative-generate.ts). Bump on ANY prompt
 * or schema change: fixtures record this value, and check:map fails when
 * the committed fixtures lag it, forcing a regenerate and a founder
 * re-read before the change ships.
 */
export const REPORT_PROMPT_VERSION = "2026.07.22";
