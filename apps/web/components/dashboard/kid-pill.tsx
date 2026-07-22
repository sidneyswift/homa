import { isInScoredRange } from "@homa/core";

import type { DashboardReport } from "../../lib/dashboard";

/**
 * The chip on the per-kid page header. The KidCard this file was named
 * for retired with the card dashboard (founder ask 2026-07-10: the
 * progress report IS the home surface); the pill lives on in the
 * per-kid page header.
 *
 * It says where a child is in getting started, and nothing about how
 * they are doing.
 *
 * It used to say the second thing. The chip carried one of "Ahead
 * \u2726" in gold, "On track" in sage, or "Growing right now" in sky,
 * computed from how many of the child's subjects scored ahead or
 * growing. Nothing about a single one of those chips is unkind, and
 * "behind" was never in the vocabulary. The problem is where the chip
 * sits: the sibling switcher renders directly beneath it
 * (`app/app/kids/[childId]/kid-view.tsx`), so a mother of two reached
 * gold "Ahead \u2726" and sky "Growing right now" one tap apart, in the
 * same spot on the page, and Homa had performed the comparison for
 * her. No wording inside a single chip prevents that.
 *
 * It was also frequently backwards. Age bands ask older children
 * harder questions while implied closure pushes the other way, so the
 * nine year old drew the softer label and the seven year old drew
 * gold. A ranked whole-child label is not merely a comparison, it is
 * an unreliable one (founder ruling 2026-07-22, `kid-standing-chip`).
 *
 * What stays: the per-SUBJECT badges inside one child's own page
 * (`lib/child-progress/map-model.ts` BADGE_TONES) keep the full
 * vocabulary. Comparing a child's math to that same child's reading is
 * the comparison a mother came here to make, and it never leaves the
 * child.
 */

export interface KidPill {
  label: string;
  bg: string;
  ink: string;
}

/**
 * kidPill(report, months): the getting-started chip, or null once this
 * child is genuinely under way. Null is the common case and it is the
 * intended one: the subjects below the header already say what is
 * happening, in the report's own sentences, per subject, with no
 * ranking of the whole child.
 */
export function kidPill(report: DashboardReport | null, months: number): KidPill | null {
  const quiet = { bg: "var(--stone-100)", ink: "var(--stone-600)" };
  if (!report) {
    if (months < 24) return { label: "Opens at age 2", ...quiet };
    if (isInScoredRange(months)) return { label: "Checklist ready", ...quiet };
    return null;
  }
  const scored = report.scores.subjects.filter(
    (score) => !score.exposureBased && score.position !== "not_mapped",
  );
  if (scored.length === 0) return { label: "Just getting started", ...quiet };
  return null;
}
