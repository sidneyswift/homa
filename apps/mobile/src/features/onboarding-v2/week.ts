/**
 * Turns @homa/core's real buildMonthPlan output into a five-day week the
 * payoff screen can render.
 *
 * Flag, found while researching this build: buildMonthPlan returns four
 * PlanWeek entries, each a flat array of already-interpolated strings
 * (e.g. "Math: Ten minutes a day of counting..."). There is no day field,
 * no per-activity subject field, no five-day shape anywhere in
 * @homa/core; that structure belongs to the DB-shaped
 * PlannerLearningActivityRecord the real planner writes, which this
 * client-only lab has no server to produce. Rather than fabricate fake
 * database rows to force-fit the production LearningActivityRow /
 * DayAgenda components, this file does the simplest honest thing: take
 * week one's real, scored activities and lay them across the family's
 * chosen school days, one each, first day carrying the subject she just
 * watched Homa pick. The content is real (scoreMap and buildMonthPlan ran
 * for real on her real answers); the day-by-day arrangement is this
 * lab's own presentation, not a production algorithm.
 */
import { buildMonthPlan, type MapAnswerInput } from "@homa/core";
import type { SchoolDay } from "./state";

export interface WeekDay {
  day: SchoolDay;
  label: string;
  subject: string;
  detail: string;
  isStartWithSubject: boolean;
}

const DAY_LABELS: Record<SchoolDay, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
};

function splitActivity(activity: string): { subject: string; detail: string } {
  const colonIndex = activity.indexOf(":");
  if (colonIndex === -1 || colonIndex > 24) return { subject: "Today", detail: activity };
  return {
    subject: activity.slice(0, colonIndex).trim(),
    detail: activity.slice(colonIndex + 1).trim(),
  };
}

export interface BuiltWeek {
  days: WeekDay[];
  hasRealPlan: boolean;
}

export function buildWeek(
  ageMonths: number,
  answers: MapAnswerInput[],
  schoolDays: SchoolDay[],
  startWithSubjectId: string | null,
  loving: string[],
): BuiltWeek {
  const orderedDays = [...schoolDays].sort((a, b) => a - b);
  const plan = buildMonthPlan(ageMonths, answers, {
    interests: loving,
  });
  const week1 = plan?.weeks.find((w) => w.week === 1) ?? plan?.weeks[0];
  const activities = week1?.activities ?? [];

  if (activities.length === 0 || orderedDays.length === 0) {
    return { days: [], hasRealPlan: false };
  }

  const days: WeekDay[] = orderedDays.map((day, index) => {
    const activity = activities[index % activities.length];
    const { subject, detail } = splitActivity(activity);
    return {
      day,
      label: DAY_LABELS[day],
      subject,
      detail,
      isStartWithSubject: index === 0,
    };
  });

  return { days, hasRealPlan: true };
}

export { DAY_LABELS };
