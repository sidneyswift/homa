import { DEADLINE_ANCHORS } from "./deadline-anchors.generated";
import type {
  DeadlineAnchor,
  DeadlineAnchorEntry,
} from "./deadline-anchor-verify";

/**
 * When a family's filing is actually due (gh#419, the filing service).
 *
 * Turning a state's rule into a date on a family's calendar is the whole
 * job of the reminder service: Homa cannot email "your paperwork is due
 * in two weeks" without knowing the day. The verified anchors say what
 * each state's rule IS; this says what that means for one family.
 *
 * Two shapes of rule, and only one of them is a calendar date:
 *   - 14 states name a date in law (New York July 1, Pennsylvania
 *     August 1, California's October 1 through 15 window).
 *   - 25 count from the day that family began homeschooling ("within 30
 *     days of starting"), so their date is unknowable until the family
 *     tells us when they started. Founder ruling 2026-07-29: ask each
 *     family once rather than guess.
 *
 * The refusal is the feature. A family who is told the wrong date and
 * files late is worse off than one Homa stayed quiet about, so every
 * path that cannot produce a real date returns nothing and says why.
 * Pure and clock-free: the caller passes today, which keeps this
 * testable and keeps a timezone bug from moving a legal deadline.
 */

export interface FilingDeadline {
  stateCode: string;
  /** The day it is due, "YYYY-MM-DD" in the family's own timezone. */
  dueOn: string;
  /** How a parent should read it, from the verified anchor's own label. */
  label: string;
  /** Whether the state named this date, or the family's start implies it. */
  basis: "state_calendar" | "family_start";
  /** Days from the reference date until it is due; negative when past. */
  daysAway: number;
}

export type DeadlineOutcome =
  | { ok: true; deadlines: FilingDeadline[] }
  | {
      ok: false;
      /**
       * no_anchors: this state names no timing Homa has verified.
       * needs_school_year_start: countable, but the family has not said
       *   when they began. This is the signal to ask them.
       * not_computable: the state names timing Homa refuses to convert,
       *   like New Hampshire's five BUSINESS days. The rule is real and
       *   the family should be shown its words; the date is not Homa's
       *   to calculate without a holiday calendar it does not have.
       */
      reason: "no_anchors" | "needs_school_year_start" | "not_computable";
    };

/** Days in each month, with February resolved per year. */
function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function toIso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Whole days between two "YYYY-MM-DD" dates, calendar-exact and free of
 * any timezone: both are parsed as UTC midnight, so the difference is
 * always a whole number of days. */
export function daysBetween(fromIso: string, toIsoDate: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIsoDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.NaN;
  return Math.round((to - from) / 86_400_000);
}

/** The date N days after an ISO date, staying in calendar arithmetic. */
export function addDays(isoDate: string, days: number): string {
  const base = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(base)) return isoDate;
  const moved = new Date(base + days * 86_400_000);
  return toIso(
    moved.getUTCFullYear(),
    moved.getUTCMonth() + 1,
    moved.getUTCDate(),
  );
}

/**
 * The next occurrence of a recurring month-and-day, on or after the
 * reference date. An anchor is a rule that repeats every year ("by July
 * 1"), never one year's date, so the answer is this year's if it has not
 * passed and next year's if it has.
 */
export function nextOccurrence(
  month: number,
  day: number,
  referenceIso: string,
): string | null {
  const [refYear] = referenceIso.split("-").map(Number);
  if (!refYear || month < 1 || month > 12) return null;
  for (const year of [refYear, refYear + 1]) {
    if (day > daysInMonth(year, month)) continue;
    const candidate = toIso(year, month, day);
    if (candidate >= referenceIso) return candidate;
  }
  return null;
}

/**
 * A counted anchor's due date, from the day the family started. Business
 * days and school days are deliberately NOT converted: only the anchor's
 * label knows which it counts (New Hampshire and Vermont count business
 * days, Arkansas counts school days), and turning "5 business days" into
 * a calendar date would require a school calendar and a holiday table
 * Homa does not have. Those return null so the family is told the rule
 * rather than a date Homa cannot stand behind.
 */
function countedDueDate(
  anchor: DeadlineAnchor,
  schoolYearStartIso: string,
): string | null {
  if (anchor.withinDays === null) return null;
  const label = anchor.label.toLowerCase();
  if (label.includes("business day") || label.includes("school day")) {
    return null;
  }
  return addDays(schoolYearStartIso, anchor.withinDays);
}

/**
 * The start date to reckon this year's deadlines from (gh#418).
 *
 * A family reports a real date once ("we started August 17, 2026"), and
 * its month and day are the pattern that recurs. Reading the stored
 * value literally would quietly go stale: in 2027 a family would be
 * measured from a start two school years back, and every counted
 * deadline would land in the past.
 *
 * So the answer is the most recent anniversary on or before today, which
 * is the start of the school year the family is actually in. Returns
 * null when never asked, which is the signal to ask rather than assume.
 */
export function schoolYearStartFor(
  storedIso: string | null,
  todayIso: string,
): string | null {
  if (!storedIso) return null;
  const stored = /^(\d{4})-(\d{2})-(\d{2})$/.exec(storedIso.trim());
  const today = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayIso.trim());
  if (!stored || !today) return null;
  const month = Number(stored[2]);
  const day = Number(stored[3]);
  const thisYear = Number(today[1]);
  for (const year of [thisYear, thisYear - 1]) {
    if (day > daysInMonth(year, month)) continue;
    const candidate = toIso(year, month, day);
    if (candidate <= todayIso) return candidate;
  }
  return storedIso;
}

export interface DeadlineInput {
  stateCode: string;
  /** "YYYY-MM-DD" in the family's timezone; the caller owns the clock. */
  todayIso: string;
  /** When this family began homeschooling, or null if never asked. */
  schoolYearStartIso: string | null;
}

/**
 * Every filing deadline Homa can honestly put on a family's calendar.
 *
 * Returns needs_school_year_start when the state's rule is countable but
 * the family has not told us when they began, which is the signal for
 * the ask rather than an error.
 */
export function filingDeadlines(input: DeadlineInput): DeadlineOutcome {
  const entry: DeadlineAnchorEntry | undefined =
    DEADLINE_ANCHORS[input.stateCode];
  if (!entry || entry.anchors.length === 0) {
    return { ok: false, reason: "no_anchors" };
  }

  const deadlines: FilingDeadline[] = [];
  let sawCountable = false;

  for (const anchor of entry.anchors) {
    if (anchor.month !== null && anchor.day !== null) {
      const dueOn = nextOccurrence(anchor.month, anchor.day, input.todayIso);
      if (dueOn) {
        deadlines.push({
          stateCode: entry.stateCode,
          dueOn,
          label: anchor.label,
          basis: "state_calendar",
          daysAway: daysBetween(input.todayIso, dueOn),
        });
      }
      continue;
    }
    if (anchor.withinDays !== null) {
      sawCountable = true;
      if (!input.schoolYearStartIso) continue;
      const dueOn = countedDueDate(anchor, input.schoolYearStartIso);
      if (dueOn) {
        deadlines.push({
          stateCode: entry.stateCode,
          dueOn,
          label: anchor.label,
          basis: "family_start",
          daysAway: daysBetween(input.todayIso, dueOn),
        });
      }
    }
  }

  if (deadlines.length === 0) {
    if (sawCountable && !input.schoolYearStartIso) {
      return { ok: false, reason: "needs_school_year_start" };
    }
    // The state has anchors; none of them could become a date. Saying
    // "no anchors" here would tell the caller this state has no rule,
    // when in fact it has one Homa declines to convert.
    return { ok: false, reason: "not_computable" };
  }

  // Soonest first: the reminder cares about the next thing due.
  deadlines.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  return { ok: true, deadlines };
}

/**
 * The deadline a reminder should fire for: the soonest one still ahead,
 * inside the lead window. Founder ruling 2026-07-29 sets the lead at two
 * weeks; a deadline already past is never "coming up", because telling a
 * family their deadline passed is a different message this does not send.
 */
export const REMINDER_LEAD_DAYS = 14;

export function deadlineNeedingReminder(
  outcome: DeadlineOutcome,
  leadDays: number = REMINDER_LEAD_DAYS,
): FilingDeadline | null {
  if (!outcome.ok) return null;
  return (
    outcome.deadlines.find(
      (deadline) => deadline.daysAway >= 0 && deadline.daysAway <= leadDays,
    ) ?? null
  );
}
