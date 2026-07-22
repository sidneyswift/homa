/**
 * The journal path validates observedAt with a strict offset-ISO parser,
 * while a lesson's finished_at reads back from Postgres in text form
 * ("2026-07-21 16:23:42.081217+00": space separator, short offset),
 * which that parser rejects. Latent until the 2026-07-21 gate fix let
 * clause pairs reach the journal at all; the first passing lesson then
 * failed whole-analysis on its own timestamp. Normalize through Date,
 * falling back to now for a missing or unparseable value.
 */
export function lessonObservedAt(finishedAt: string | null): string {
  if (finishedAt !== null) {
    const parsed = new Date(finishedAt);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}
