import type { ReapedTaskRun } from "./store";

/**
 * Which reaped task runs earn exactly one automatic replacement, and
 * through which door (DR-2, widened 2026-07-23).
 *
 * The decision is pure so it can be tested without a database or a live
 * dispatcher: the hourly schedule pairs it with the durable
 * first-failure guard (day-keyed for scheduled runs, window-keyed for
 * manual ones) before it re-dispatches anything.
 *
 * Retryable kinds are deliberately narrow:
 *   - morning_brief keeps its original same-day replacement.
 *   - custom is new. A parent's own task could hang on a single tool call
 *     and die with nothing to show (Swift family 2026-07-19: find_materials
 *     was requested, never returned, and the reaper failed the run three
 *     hours later), leaving the parent to notice and re-run it by hand.
 *   - journal_prompt is excluded on purpose: an evening prompt replayed
 *     hours late is worse than none.
 *
 * A run that reached anybody is never retried, because a second send
 * would double-text the family.
 */

export type ReapRetryDoor = "scheduled" | "manual";

export type ReapRetryPlan =
  | {
      retry: false;
      reason: "reached_family" | "kind_not_retryable" | "no_schedule";
    }
  /** A manual run carries no scheduled_for, so it re-runs through the
   * manual door, which leaves next_run_at and the daily outbox alone. */
  | { retry: true; door: "manual"; familyId: string; scheduleId: string }
  | {
      retry: true;
      door: "scheduled";
      familyId: string;
      scheduleId: string;
      /** The family-local day, half of the outbox idempotency key. */
      scheduledFor: string;
    };

const RETRYABLE_KINDS = new Set(["morning_brief", "custom"]);

export function planReapedRunRetry(run: ReapedTaskRun): ReapRetryPlan {
  if (run.reachedFamily) return { retry: false, reason: "reached_family" };
  if (!RETRYABLE_KINDS.has(run.kind)) {
    return { retry: false, reason: "kind_not_retryable" };
  }
  // A run whose schedule row is gone (the parent deleted the task) has
  // nothing to re-dispatch from; the FK nulls schedule_id on delete.
  if (!run.familyId || !run.scheduleId) {
    return { retry: false, reason: "no_schedule" };
  }
  if (run.scheduledFor === null) {
    return {
      retry: true,
      door: "manual",
      familyId: run.familyId,
      scheduleId: run.scheduleId,
    };
  }
  return {
    retry: true,
    door: "scheduled",
    familyId: run.familyId,
    scheduleId: run.scheduleId,
    scheduledFor: run.scheduledFor,
  };
}
