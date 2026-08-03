import type { ChildPlanRecord } from "../../lib/child-plans";
import type { PlanActivityCheckApplied } from "../../lib/plan-check-mutation";

interface PlanActivityCheckTarget {
  childId: string;
  subjectId: string;
}

function planKey(plan: ChildPlanRecord): string {
  return `${plan.child_id}\u0000${plan.subject_id}`;
}

/**
 * Reconciles a complete Planner read with state already accepted by the
 * client. A stale plan revision cannot replace newer plan meaning. When
 * only progress is stale, fresh non-progress fields survive while the
 * newer progress snapshot remains authoritative.
 */
export function mergeChildPlanSnapshots(
  current: ChildPlanRecord[],
  incoming: ChildPlanRecord[],
): ChildPlanRecord[] {
  const currentByKey = new Map(current.map((plan) => [planKey(plan), plan]));
  return incoming.map((nextPlan) => {
    const existing = currentByKey.get(planKey(nextPlan));
    if (!existing || existing.id !== nextPlan.id) return nextPlan;
    if (existing.plan_revision > nextPlan.plan_revision) return existing;
    if (existing.plan_revision < nextPlan.plan_revision) return nextPlan;
    if (existing.progress_revision <= nextPlan.progress_revision) return nextPlan;
    return {
      ...nextPlan,
      progress: existing.progress,
      progress_revision: existing.progress_revision,
    };
  });
}

/**
 * Applies one authoritative check snapshot without a follow-up query.
 * A delayed receipt cannot replace a newer progress revision, and a
 * receipt for a different plan meaning or row is ignored.
 */
export function mergeAppliedPlanActivityCheck(
  plans: ChildPlanRecord[],
  target: PlanActivityCheckTarget,
  outcome: PlanActivityCheckApplied,
): ChildPlanRecord[] {
  let changed = false;
  const next = plans.map((plan) => {
    if (
      plan.child_id !== target.childId ||
      plan.subject_id !== target.subjectId ||
      plan.id !== outcome.planId ||
      plan.plan_revision !== outcome.planRevision ||
      plan.progress_revision >= outcome.progressRevision
    ) {
      return plan;
    }
    changed = true;
    return {
      ...plan,
      progress: { ...outcome.progressSnapshot },
      plan_revision: outcome.planRevision,
      progress_revision: outcome.progressRevision,
    };
  });
  return changed ? next : plans;
}
