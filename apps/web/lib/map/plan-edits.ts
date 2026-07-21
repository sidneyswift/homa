import type { FourWeekPlan } from "@homa/core";

/**
 * The pure edit engine behind the edit_plan agent tool: apply a batch of
 * activity edits to a stored four-week plan and keep the check-off map
 * honest while indices move. Checks are keyed "week.activityIndex"
 * (use-plan-checks.ts), so a removed activity shifts every later key in
 * its week down by one, and a replaced activity clears its own check
 * (the new activity has not been done). Pure and deterministic; the
 * store owns the read, the family wall, and the write.
 */

export type PlanEdit =
  | { action: "add"; week: number; text: string }
  | { action: "replace"; week: number; index: number; text: string }
  | { action: "remove"; week: number; index: number };

export interface AppliedPlanEdits {
  plan: FourWeekPlan;
  progress: Record<string, boolean>;
  added: number;
  replaced: number;
  removed: number;
}

export type PlanEditFailure =
  | { code: "unknown_week"; note: string }
  | { code: "unknown_activity"; note: string };

export type PlanEditsResult =
  | { ok: true; result: AppliedPlanEdits }
  | { ok: false; failure: PlanEditFailure };

/** Longest activity line the planner renders comfortably; the tool's
 * input schema enforces the same bound before edits get here. */
export const MAX_ACTIVITY_TEXT = 280;

/** Most activities one week can hold before the board stops being a
 * week and starts being a syllabus. */
export const MAX_ACTIVITIES_PER_WEEK = 10;

function remapProgressAfterRemove(
  progress: Record<string, boolean>,
  week: number,
  removedIndex: number,
): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(progress)) {
    const [weekPart, indexPart] = key.split(".");
    const keyWeek = Number(weekPart);
    const keyIndex = Number(indexPart);
    if (keyWeek !== week || Number.isNaN(keyIndex)) {
      next[key] = value;
      continue;
    }
    if (keyIndex === removedIndex) continue;
    if (keyIndex > removedIndex) {
      next[`${week}.${keyIndex - 1}`] = value;
      continue;
    }
    next[key] = value;
  }
  return next;
}

/**
 * Applies edits in order against a deep copy; the caller's objects are
 * never mutated. Fails atomically on the first invalid edit (unknown
 * week, index out of range, week over capacity): either every edit
 * lands or none do, so a half-applied batch can never be written.
 */
export function applyPlanEdits(
  plan: FourWeekPlan,
  progress: Record<string, boolean>,
  edits: readonly PlanEdit[],
): PlanEditsResult {
  const nextPlan: FourWeekPlan = {
    ...plan,
    weeks: plan.weeks.map((week) => ({ ...week, activities: [...week.activities] })),
  };
  let nextProgress: Record<string, boolean> = { ...progress };
  let added = 0;
  let replaced = 0;
  let removed = 0;

  for (const edit of edits) {
    const week = nextPlan.weeks.find((candidate) => candidate.week === edit.week);
    if (!week) {
      return {
        ok: false,
        failure: {
          code: "unknown_week",
          note: `This plan has no week ${edit.week}. Its weeks are ${nextPlan.weeks
            .map((candidate) => candidate.week)
            .join(", ")}.`,
        },
      };
    }
    if (edit.action === "add") {
      if (week.activities.length >= MAX_ACTIVITIES_PER_WEEK) {
        return {
          ok: false,
          failure: {
            code: "unknown_activity",
            note: `Week ${edit.week} already holds ${week.activities.length} activities; remove or replace one instead of adding more.`,
          },
        };
      }
      week.activities.push(edit.text);
      added += 1;
      continue;
    }
    if (edit.index < 0 || edit.index >= week.activities.length) {
      return {
        ok: false,
        failure: {
          code: "unknown_activity",
          note: `Week ${edit.week} has activities 0 through ${week.activities.length - 1}; index ${edit.index} does not exist. Read the plan again before editing.`,
        },
      };
    }
    if (edit.action === "replace") {
      week.activities[edit.index] = edit.text;
      // The replaced activity is a new activity: its old check-off no
      // longer describes work that happened.
      delete nextProgress[`${edit.week}.${edit.index}`];
      replaced += 1;
      continue;
    }
    week.activities.splice(edit.index, 1);
    nextProgress = remapProgressAfterRemove(nextProgress, edit.week, edit.index);
    removed += 1;
  }

  return {
    ok: true,
    result: { plan: nextPlan, progress: nextProgress, added, replaced, removed },
  };
}

/** One plain sentence naming what changed, for the tool result and the
 * transcript chip ("added 2 activities to week 1, removed 1 from week 3"
 * reads better assembled than enumerated). */
export function describePlanEdits(edits: readonly PlanEdit[]): string {
  const byWeek = new Map<number, { added: number; replaced: number; removed: number }>();
  for (const edit of edits) {
    const entry = byWeek.get(edit.week) ?? { added: 0, replaced: 0, removed: 0 };
    if (edit.action === "add") entry.added += 1;
    if (edit.action === "replace") entry.replaced += 1;
    if (edit.action === "remove") entry.removed += 1;
    byWeek.set(edit.week, entry);
  }
  const parts: string[] = [];
  for (const [week, counts] of [...byWeek.entries()].sort(([a], [b]) => a - b)) {
    const verbs: string[] = [];
    if (counts.added > 0) {
      verbs.push(`added ${counts.added} ${counts.added === 1 ? "activity" : "activities"}`);
    }
    if (counts.replaced > 0) verbs.push(`replaced ${counts.replaced}`);
    if (counts.removed > 0) verbs.push(`removed ${counts.removed}`);
    parts.push(`${verbs.join(", ")} in week ${week}`);
  }
  return parts.join("; ");
}
