import type { DashboardPlan } from "./plan-week";

export const PLANNER_ACTIVITY_HELP_DRAFT = "planner-activity-help";

export function plannerActivityHelpHref(input: {
  childId: string;
  subjectId: string;
  checkId: string;
}): string {
  const params = new URLSearchParams({
    draft: PLANNER_ACTIVITY_HELP_DRAFT,
    child: input.childId,
    subject: input.subjectId,
    check: input.checkId,
  });
  return `/app?${params.toString()}`;
}

/**
 * Resolves an activity-help deep link against the authenticated family's
 * own plan. URL values are coordinates only. Composer text always comes
 * from server-read family data, never from arbitrary query text.
 */
export function plannerActivityHelpDraft(input: {
  draft: string | undefined;
  childId: string | undefined;
  subjectId: string | undefined;
  checkId: string | undefined;
  children: readonly { id: string; name: string }[];
  plans: readonly DashboardPlan[];
}): string | undefined {
  if (input.draft !== PLANNER_ACTIVITY_HELP_DRAFT) return undefined;
  const parts = input.checkId?.split(".") ?? [];
  if (parts.length !== 2) return undefined;
  const weekNumber = Number(parts[0]);
  const activityIndex = Number(parts[1]);
  if (!Number.isInteger(weekNumber) || weekNumber < 1) return undefined;
  if (!Number.isInteger(activityIndex) || activityIndex < 0) return undefined;

  const child = input.children.find((candidate) => candidate.id === input.childId);
  const plan = input.plans.find(
    (candidate) =>
      candidate.childId === child?.id && candidate.subjectId === input.subjectId,
  );
  const activity = plan?.weeks.find((week) => week.week === weekNumber)
    ?.activities[activityIndex];
  if (!child || !activity) return undefined;

  return `Give me simple steps for this activity with ${child.name}: ${activity}`;
}
