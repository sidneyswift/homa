import type { FourWeekPlan } from "@homa/core";

interface ActivityIdentity {
  key: string;
  text: string;
}

export interface RebuiltPlanProgress {
  progress: Record<string, boolean>;
  archivedDoneCount: number;
  preservedDoneCount: number;
  archivedUnmatchedDoneCount: number;
}

function activityIdentities(
  plan: Pick<FourWeekPlan, "weeks">,
): ActivityIdentity[] {
  return plan.weeks.flatMap((week) =>
    week.activities.map((text, index) => ({
      key: `${week.week}.${index}`,
      text,
    })),
  );
}

function groupByText(
  identities: readonly ActivityIdentity[],
): Map<string, ActivityIdentity[]> {
  const grouped = new Map<string, ActivityIdentity[]>();
  for (const identity of identities) {
    const matches = grouped.get(identity.text) ?? [];
    matches.push(identity);
    grouped.set(identity.text, matches);
  }
  return grouped;
}

/**
 * Carries progress across a rebuilt plan only when one old activity and one
 * new activity have exactly the same text. Positional similarity, whitespace
 * normalization, and duplicate text are not authority to reinterpret a
 * parent's completion.
 */
export function remapProgressForRebuiltPlan(
  priorPlan: Pick<FourWeekPlan, "weeks">,
  nextPlan: Pick<FourWeekPlan, "weeks">,
  priorProgress: Record<string, boolean>,
): RebuiltPlanProgress {
  const priorIdentities = activityIdentities(priorPlan);
  const nextIdentities = activityIdentities(nextPlan);
  const priorByKey = new Map(
    priorIdentities.map((identity) => [identity.key, identity]),
  );
  const priorByText = groupByText(priorIdentities);
  const nextByText = groupByText(nextIdentities);
  const progress: Record<string, boolean> = {};

  for (const [key, value] of Object.entries(priorProgress)) {
    if (typeof value !== "boolean") continue;
    const priorIdentity = priorByKey.get(key);
    if (!priorIdentity) continue;
    const priorMatches = priorByText.get(priorIdentity.text) ?? [];
    const nextMatches = nextByText.get(priorIdentity.text) ?? [];
    if (priorMatches.length !== 1 || nextMatches.length !== 1) continue;
    progress[nextMatches[0].key] = value;
  }

  const archivedDoneCount = Object.values(priorProgress).filter(
    (value) => value === true,
  ).length;
  const preservedDoneCount = Object.values(progress).filter(
    (value) => value === true,
  ).length;
  return {
    progress,
    archivedDoneCount,
    preservedDoneCount,
    archivedUnmatchedDoneCount: archivedDoneCount - preservedDoneCount,
  };
}
