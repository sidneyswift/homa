/**
 * REPORT_NARRATIVE_ENABLED (server env): off means today's template
 * behavior everywhere except the sample page, whose committed fixture is
 * reviewed content and renders regardless. Default off in prod until the
 * founder flips it after the STOP 2 read-aloud.
 */
export function narrativeEnabled(): boolean {
  const value = (process.env.REPORT_NARRATIVE_ENABLED ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}
