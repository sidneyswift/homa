import { isInScoredRange } from "@homa/core";

import type { DashboardReport } from "../../lib/dashboard";

/**
 * The kid's overall standing chip, in the report's reassurance-first
 * vocabulary. The KidCard this file was named for retired with the card
 * dashboard (founder ask 2026-07-10: the progress report IS the home
 * surface); the pill lives on in the per-kid page header.
 */

export interface KidPill {
  label: string;
  bg: string;
  ink: string;
}

/** The kid's overall standing chip, reassurance-first (also used by the
 * per-kid page header). */
export function kidPill(report: DashboardReport | null, months: number): KidPill | null {
  if (!report) {
    if (months < 24) return { label: "Opens at age 2", bg: "var(--stone-100)", ink: "var(--stone-600)" };
    if (isInScoredRange(months)) {
      return { label: "Checklist ready", bg: "var(--stone-100)", ink: "var(--stone-600)" };
    }
    return null;
  }
  const scored = report.scores.domains.filter(
    (score) => !score.exposureBased && score.position !== "not_mapped",
  );
  if (scored.length === 0) {
    return { label: "Just getting started", bg: "var(--stone-100)", ink: "var(--stone-600)" };
  }
  const ahead = scored.filter((score) => score.position === "ahead").length;
  const growing = scored.filter((score) => score.position === "growing").length;
  // Strengths first: the sky pill only when growing genuinely dominates
  // the picture; a kid ahead in two subjects with one growing is, in this
  // house's vocabulary, on track.
  if (growing > scored.length - growing) {
    return { label: "Growing right now", bg: "var(--info-soft)", ink: "var(--sky-600)" };
  }
  if (ahead >= Math.ceil(scored.length / 2)) {
    return { label: "Ahead \u2726", bg: "var(--gold-100)", ink: "var(--gold-ink)" };
  }
  return { label: "On track", bg: "var(--sage-50)", ink: "var(--sage-700)" };
}
