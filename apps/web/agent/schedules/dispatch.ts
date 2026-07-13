import { defineSchedule } from "eve/schedules";

import {
  markStalePendingDeliveriesUncertain,
  setTaskRunRuntimeSession,
} from "../../lib/conversation-continuity/delivery-ledger";
import { createProactiveEpisode } from "../../lib/conversation-continuity/ledger";
import {
  buildDispatchAuth,
  buildDispatchTarget,
  buildTaskMessage,
} from "../../lib/tasks/dispatch-input";
import { enabledFamilyTaskKinds } from "../../lib/tasks/kinds";
import {
  advanceTaskSchedule,
  beginTaskRun,
  claimDueFamilyTasks,
  finishTaskRun,
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
          let runId: string | null = null;
          let sessionStarted = false;
          try {
            if (!withinDeliveryWindow(task, now)) {
              // Too late to deliver today (e.g. the 9am brief claimed at
              // 1pm after downtime). Record the miss, move to the next
              // scheduled day; never text at the wrong hour.
              await beginTaskRun(task, now, {
                status: "skipped",
                error: "missed the delivery window",
              });
              await advanceTaskSchedule(task, now);
              continue;
            }

            runId = await beginTaskRun(task, now);
            if (!runId) {
              // The outbox already holds a run for this local day: this
              // claim is an at-least-once redelivery. Advance and move on.
              await advanceTaskSchedule(task, now);
              continue;
            }
            const episodeId = await createProactiveEpisode({
              familyId: task.familyId,
              now,
            });

            const session = await receive(dispatchChannel, {
              message: await buildTaskMessage(task, "scheduled"),
              target: buildDispatchTarget(task, runId, episodeId),
              auth: buildDispatchAuth(task, runId, episodeId),
            });
            sessionStarted = true;
            await setTaskRunRuntimeSession(runId, session.id);

            // The session is started and durable; its channel finishes
            // the run. Advancing here (not after completion) is what
            // makes redelivery a same-day no-op instead of a double text.
            await advanceTaskSchedule(task, now);
          } catch (error) {
            console.error(
              `dispatch failed for family ${task.familyId} (${task.kind}):`,
              error instanceof Error ? error.message : "unknown",
            );
            if (runId && !sessionStarted) {
              await finishTaskRun(runId, {
                familyId: task.familyId,
                kind: task.kind,
                status: "failed",
                error:
                  error instanceof Error
                    ? error.message.slice(0, 500)
                    : "session startup failed",
              });
            }
            await releaseTaskSchedule(task);
          }
        }
      })(),
    );
  },
});
