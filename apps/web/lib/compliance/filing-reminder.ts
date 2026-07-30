import type { PlanTier } from "../billing/wall-types";
import {
  deadlineNeedingReminder,
  filingDeadlines,
  REMINDER_LEAD_DAYS,
  type FilingDeadline,
} from "./deadlines";
import { FILING_METHODS_BY_STATE } from "./filing-methods.data";

/**
 * Who gets told their filing is coming due, and who does not (gh#422).
 *
 * Pure: the caller supplies the families, the clock and the lead time,
 * and gets back a plan. Nothing here reads a database or sends anything,
 * because the interesting failure is not "the mailer broke", it is
 * "nobody was eligible and no one noticed for a month".
 *
 * That is why skips are counted by reason rather than filtered away. A
 * sweep that mails nobody should be able to say whether that is because
 * no deadline is near, because no one is on Plus, or because a hundred
 * families never told Homa when their year starts. The first is healthy,
 * the third is a product problem hiding as silence.
 *
 * SENDING IS DARK until counsel reviews the letter wording (founder
 * ruling 6, 2026-07-29). The flag is the only thing standing between
 * this plan and a real send, and it defaults off.
 */

export interface ReminderCandidate {
  familyId: string;
  email: string | null;
  firstName: string | null;
  stateCode: string | null;
  planTier: PlanTier;
  schoolYearStartIso: string | null;
}

export interface PlannedReminder {
  familyId: string;
  email: string;
  firstName: string | null;
  stateCode: string;
  deadline: FilingDeadline;
  /**
   * The email ledger key, unique per family per deadline. Encoding the
   * due date is what makes the reminder annual rather than once ever:
   * "already sent" must mean "for THIS deadline", or a family hears
   * about their filing exactly one time and never again.
   */
  ledgerKind: `filing:${string}`;
}

export const REMINDER_SKIP_REASONS = [
  "not_entitled",
  "no_email",
  "no_state",
  "state_asks_nothing",
  "needs_school_year_start",
  "no_deadline",
  "not_due_yet",
] as const;
export type ReminderSkipReason = (typeof REMINDER_SKIP_REASONS)[number];

export interface ReminderPlan {
  sends: PlannedReminder[];
  skipped: Record<ReminderSkipReason, number>;
}

/** Ledger kinds are capped at 40 characters by the email_sends check. */
export function reminderLedgerKind(dueOn: string): `filing:${string}` {
  return `filing:${dueOn}`;
}

export function planFilingReminders(
  candidates: readonly ReminderCandidate[],
  todayIso: string,
  leadDays: number = REMINDER_LEAD_DAYS,
): ReminderPlan {
  const skipped = Object.fromEntries(
    REMINDER_SKIP_REASONS.map((reason) => [reason, 0]),
  ) as Record<ReminderSkipReason, number>;
  const sends: PlannedReminder[] = [];

  for (const candidate of candidates) {
    // Plus and Elite only (founder ruling 4). Checked here rather than
    // in the query so the skip is counted: "we have 84 families and 84
    // not_entitled" is the number that tells the founder this feature
    // is waiting on the tier, not on the code.
    if (candidate.planTier !== "plus" && candidate.planTier !== "elite") {
      skipped.not_entitled += 1;
      continue;
    }
    if (!candidate.email || candidate.email.trim().length === 0) {
      skipped.no_email += 1;
      continue;
    }
    if (!candidate.stateCode) {
      skipped.no_state += 1;
      continue;
    }
    if (FILING_METHODS_BY_STATE[candidate.stateCode]?.method === "not_required") {
      // Nothing to file means nothing to remind about. New Hampshire
      // repealed its requirement outright.
      skipped.state_asks_nothing += 1;
      continue;
    }

    const outcome = filingDeadlines({
      stateCode: candidate.stateCode,
      schoolYearStartIso: candidate.schoolYearStartIso,
      todayIso,
    });
    if (!outcome.ok) {
      // needs_school_year_start is the one a family can fix themselves,
      // so it is counted separately from a state Homa cannot date at all.
      skipped[
        outcome.reason === "needs_school_year_start"
          ? "needs_school_year_start"
          : "no_deadline"
      ] += 1;
      continue;
    }

    const due = deadlineNeedingReminder(outcome, leadDays);
    if (!due) {
      skipped.not_due_yet += 1;
      continue;
    }

    sends.push({
      familyId: candidate.familyId,
      email: candidate.email,
      firstName: candidate.firstName,
      stateCode: candidate.stateCode,
      deadline: due,
      ledgerKind: reminderLedgerKind(due.dueOn),
    });
  }

  return { sends, skipped };
}
