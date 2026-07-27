import assert from "node:assert/strict";
import { test } from "node:test";

import { planReapedRunRetry } from "./reap-retry";
import type { ReapedTaskRun } from "./store";

function reaped(overrides: Partial<ReapedTaskRun> = {}): ReapedTaskRun {
  return {
    runId: "11111111-1111-4111-8111-111111111111",
    familyId: "22222222-2222-4222-8222-222222222222",
    scheduleId: "33333333-3333-4333-8333-333333333333",
    kind: "custom",
    scheduledFor: null,
    reachedFamily: false,
    ...overrides,
  } as ReapedTaskRun;
}

test("a manual custom run retries through the manual door", () => {
  // The Swift-family case: a Run now task that hung on a tool call. It has
  // no scheduled_for, so replaying it must not touch next_run_at.
  const plan = planReapedRunRetry(reaped({ kind: "custom", scheduledFor: null }));
  assert.equal(plan.retry, true);
  assert.equal(plan.retry && plan.door, "manual");
});

test("a scheduled morning brief keeps the original same-day door", () => {
  const plan = planReapedRunRetry(
    reaped({ kind: "morning_brief", scheduledFor: "2026-07-19" }),
  );
  assert.equal(plan.retry, true);
  assert.equal(plan.retry && plan.door, "scheduled");
});

test("a run that reached the family is never retried", () => {
  // Retrying would double-text her.
  const plan = planReapedRunRetry(reaped({ reachedFamily: true }));
  assert.equal(plan.retry, false);
  assert.equal(!plan.retry && plan.reason, "reached_family");
});

test("journal prompts are not retried", () => {
  // An evening prompt replayed hours late is worse than none.
  const plan = planReapedRunRetry(reaped({ kind: "journal_prompt" }));
  assert.equal(plan.retry, false);
  assert.equal(!plan.retry && plan.reason, "kind_not_retryable");
});

test("a run whose schedule was deleted is not retried", () => {
  // schedule_id nulls on delete, so there is nothing to re-dispatch from.
  const plan = planReapedRunRetry(reaped({ scheduleId: null }));
  assert.equal(plan.retry, false);
  assert.equal(!plan.retry && plan.reason, "no_schedule");
});

test("a run with no family is not retried", () => {
  const plan = planReapedRunRetry(reaped({ familyId: null }));
  assert.equal(plan.retry, false);
  assert.equal(!plan.retry && plan.reason, "no_schedule");
});
