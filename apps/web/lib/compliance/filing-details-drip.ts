import type { PlanTier } from "../billing/wall-types";
import { daysBetween } from "./deadlines";
import {
  missingFilingDetails,
  type FilingDetail,
  type FilingDetailInput,
} from "./filing-details";

/**
 * The gentle drip for the details Homa needs to file (gh#424, founder
 * ruling 3, 2026-07-29):
 *
 *   "If they sign up for that tier, then maybe it becomes part of a drip
 *    campaign or gentle nudge until they actually add it. An email that
 *    says, a couple days into it, by the way, we need this information,
 *    X, Y, and Z, to do your filing. Add it here. It's not due until X
 *    or Y, but we can kind of use it as a gentle nudge thing."
 *
 * "Nudges until complete" and "gentle" pull against each other, and the
 * bound is what reconciles them. Three nudges, ever, on a widening
 * cadence, and then Homa stops asking:
 *
 *   day 2    you just joined, here is what your state needs
 *   day 9    a week later
 *   day 30   three weeks after that, and then never again
 *
 * Widening rather than fixed, because a parent who has not answered
 * twice is telling you something, and a fourth ask would be Homa
 * refusing to hear it. The deadline reminder (gh#422) still fires
 * independently when the date actually approaches, which is the founder's
 * "ask for both": this drip is the calm one, that one is the timely one.
 *
 * If she fills everything in, the drip stops mid-sequence and never
 * resumes, because there is nothing left to ask for.
 */

export const NUDGE_DAYS = [2, 9, 30] as const;
export const MAX_NUDGES = NUDGE_DAYS.length;

export type NudgeIndex = 1 | 2 | 3;

/** One ledger kind per step, so "already sent step N" is one lookup. */
export function nudgeLedgerKind(index: NudgeIndex): `filing_details_${NudgeIndex}` {
  return `filing_details_${index}`;
}

export interface NudgeCandidate extends FilingDetailInput {
  familyId: string;
  email: string | null;
  firstName: string | null;
  planTier: PlanTier;
  /** When this family became eligible, ISO date. Signup, in practice. */
  eligibleSinceIso: string;
  /** Which steps have already gone out, 1-based. */
  nudgesSent: readonly NudgeIndex[];
}

export interface PlannedNudge {
  familyId: string;
  email: string;
  firstName: string | null;
  stateCode: string;
  missing: FilingDetail[];
  index: NudgeIndex;
  ledgerKind: `filing_details_${NudgeIndex}`;
}

export const NUDGE_SKIP_REASONS = [
  "not_entitled",
  "no_email",
  "nothing_missing",
  "too_soon",
  "sequence_finished",
] as const;
export type NudgeSkipReason = (typeof NUDGE_SKIP_REASONS)[number];

export interface NudgePlan {
  sends: PlannedNudge[];
  skipped: Record<NudgeSkipReason, number>;
}

export function planDetailNudges(
  candidates: readonly NudgeCandidate[],
  todayIso: string,
): NudgePlan {
  const skipped = Object.fromEntries(
    NUDGE_SKIP_REASONS.map((reason) => [reason, 0]),
  ) as Record<NudgeSkipReason, number>;
  const sends: PlannedNudge[] = [];

  for (const candidate of candidates) {
    // Plus and Elite only (founder ruling 4), counted rather than
    // filtered in the query so the number says why nobody was mailed.
    if (candidate.planTier !== "plus" && candidate.planTier !== "elite") {
      skipped.not_entitled += 1;
      continue;
    }
    if (!candidate.email || candidate.email.trim().length === 0) {
      skipped.no_email += 1;
      continue;
    }

    // Checked BEFORE the cadence, so a family who filled everything in
    // stops hearing from Homa immediately rather than at the next step.
    const missing = missingFilingDetails(candidate);
    if (missing.length === 0 || !candidate.stateCode) {
      skipped.nothing_missing += 1;
      continue;
    }

    const sent = new Set(candidate.nudgesSent);
    const next = ([1, 2, 3] as NudgeIndex[]).find((index) => !sent.has(index));
    if (next === undefined) {
      skipped.sequence_finished += 1;
      continue;
    }

    const age = daysBetween(candidate.eligibleSinceIso, todayIso);
    if (age < NUDGE_DAYS[next - 1]) {
      skipped.too_soon += 1;
      continue;
    }

    sends.push({
      familyId: candidate.familyId,
      email: candidate.email,
      firstName: candidate.firstName,
      stateCode: candidate.stateCode,
      missing,
      index: next,
      ledgerKind: nudgeLedgerKind(next),
    });
  }

  return { sends, skipped };
}
