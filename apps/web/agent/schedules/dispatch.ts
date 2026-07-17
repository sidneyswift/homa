import { defineSchedule } from "eve/schedules";

import {
  markStalePendingDeliveriesUncertain,
  setTaskRunRuntimeSession,
} from "../../lib/conversation-continuity/delivery-ledger";
import { createProactiveEpisode } from "../../lib/conversation-continuity/ledger";
import {
  buildDispatchAuth,
  buildDispatchTarget,
  preflightTaskDispatch,
} from "../../lib/tasks/dispatch-input";
import { deliveryVersionForNewTaskRun } from "../../lib/tasks/delivery-version";
import { enabledFamilyTaskKinds } from "../../lib/tasks/kinds";
import { dispatchScheduledTask } from "../../lib/tasks/scheduled-dispatch";
import {
  advanceTaskSchedule,
  beginTaskRun,
  claimDueFamilyTasks,
  finishTaskRun,
  recordSkippedScheduledTaskRun,
  reapStaleTaskRuns,
  releaseTaskSchedule,
  seedFamilyTaskSchedules,
  withinDeliveryWindow,
} from "../../lib/tasks/store";
import dispatchChannel from "../channels/dispatch";

/**
 * The dispatcher (gateway-plan GW-4, generalized by HT-1): the one
 * authored family-facing schedule. Every hour it seeds and claims due
 * per-family task rows (agent_schedules) and wakes THE agent as each
 * family via the dispatch channel: the evening journal prompt, the
 * weekday morning research brief, and parent-created custom tasks all
 * ride the same rails. Each kind stays dark behind its own env flag
 * (lib/tasks/kinds.ts).
 *
 * At-least-once: a crash between receive and advance redelivers, and the
 * homa_task_runs outbox row (schedule_id + family-local date) is the
 * idempotency guard. The brief also carries a delivery window: claimed
 * too late (past noon local), it records a skipped run instead of
 * becoming an afternoon text.
 *
 * Division of labor, learned in the live E2E: receive() resolves when a
 * session STARTS, not when it finishes, so this handler never judges an
 * outcome. The dispatch channel finishes each run from its own
 * message.completed (it is the only place that sees the composed text),
 * and the reaper below fails anything still 'running' hours later.
 *
 * The message builders and the session's auth identity live in
 * lib/tasks/dispatch-input.ts, shared with the Run now route on the
 * dispatch channel, so a manual run and a scheduled run wake the agent
 * identically.
 */

export default defineSchedule({
  cron: "0 * * * *",
  run({ receive, waitUntil }) {
    waitUntil(
      (async () => {
        if (enabledFamilyTaskKinds().length === 0) return;
        const now = new Date();
        await seedFamilyTaskSchedules(now);
        await markStalePendingDeliveriesUncertain(now);
        await reapStaleTaskRuns(now);
        const tasks = await claimDueFamilyTasks({
          now,
          limit: 50,
          leaseForMs: 10 * 60_000,
        });

        for (const task of tasks) {
          await dispatchScheduledTask(task, now, {
            withinDeliveryWindow,
            selectDeliveryVersion: (scheduledTask) =>
              deliveryVersionForNewTaskRun(
                scheduledTask.kind,
                process.env,
                scheduledTask.familySandbox,
              ),
            preflight: async (scheduledTask) =>
              await preflightTaskDispatch(scheduledTask, "scheduled"),
            beginRun: beginTaskRun,
            recordSkippedRun: async (
              scheduledTask,
              scheduledAt,
              preflight,
            ) =>
              await recordSkippedScheduledTaskRun({
                task: scheduledTask,
                now: scheduledAt,
                deliveryVersion: preflight.deliveryVersion,
                reason: preflight.reason,
              }),
            createEpisode: async (scheduledTask) =>
              await createProactiveEpisode({
                familyId: scheduledTask.familyId,
                now,
              }),
            receive: async ({
              message,
              task: scheduledTask,
              run,
              episodeId,
              deliveryVersion,
            }) =>
              await receive(dispatchChannel, {
                message,
                target: buildDispatchTarget(
                  scheduledTask,
                  run.id,
                  episodeId,
                  deliveryVersion,
                ),
                auth: buildDispatchAuth(
                  scheduledTask,
                  run.id,
                  episodeId,
                  deliveryVersion,
                ),
              }),
            setRuntimeSession: setTaskRunRuntimeSession,
            finishRun: finishTaskRun,
            advanceSchedule: advanceTaskSchedule,
            releaseSchedule: releaseTaskSchedule,
            logFailure: (error) => {
              console.error(
                `dispatch failed for family ${task.familyId} (${task.kind}):`,
                error instanceof Error ? error.message : "unknown",
              );
            },
          });
        }
      })(),
    );
  },
});
