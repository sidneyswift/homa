import { ageInMonths as coreAgeInMonths } from "@homa/core";

/**
 * Child age math, shared by the home page, agent tools, and the per-turn
 * family context loader. children.birth_month holds the child's full
 * birthday (founder ruling 2026-07-11: "get the full data so we know how
 * old the kid is", restoring the 2026-07-06 ruling product-wide). Rows
 * saved under the old month-only convention keep day 01 and read exactly
 * as they always did.
 */

/** Whole months of age, precise to the day, delegating to the same math
 * the map and dashboard use (@homa/core bands.ts). Accepts "YYYY-MM-DD"
 * or a bare "YYYY-MM". */
export function ageInMonths(birthDate: string, now: Date = new Date()): number {
  return coreAgeInMonths(birthDate, now);
}

/** "18 months" under two, "5 years old" after (plain language per the DS). */
export function formatChildAge(months: number): string {
  if (months < 24) return `${months} months`;
  return `${Math.floor(months / 12)} years old`;
}
