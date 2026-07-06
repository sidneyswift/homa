/**
 * Child age math, shared by the home page, agent tools, and the per-turn
 * family context loader. birth_month is stored as YYYY-MM-01 by design
 * (month + year only; a full DOB is data we chose not to hold).
 */

export function ageInMonths(birthMonth: string, now: Date = new Date()): number {
  const birth = new Date(birthMonth);
  return (
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth())
  );
}

/** "18 months" under two, "5 years old" after (plain language per the DS). */
export function formatChildAge(months: number): string {
  if (months < 24) return `${months} months`;
  return `${Math.floor(months / 12)} years old`;
}
