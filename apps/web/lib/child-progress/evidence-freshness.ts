/** Selection freshness is not score decay or a recurring check-in schedule. */
export const PROGRESS_EVIDENCE_FRESH_DAYS = 30;

export function isProgressEvidenceFresh(observedAt: string, now: Date): boolean {
  const age = now.getTime() - new Date(observedAt).getTime();
  return Number.isFinite(age) && age >= 0 &&
    age <= PROGRESS_EVIDENCE_FRESH_DAYS * 86_400_000;
}
