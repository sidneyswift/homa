import { defineSchedule } from "eve/schedules";

import {
  markStalePendingDeliveriesUncertain,
  setTaskRunRuntimeSession,
} from "../../lib/conversation-continuity/delivery-ledger";
import { createProactiveEpisode } from "../../lib/conversation-continuity/ledger";
import {
  buildFulfillmentRecoveryMessage,
  recoverUnfulfilledOffers,
} from "../../lib/conversation-continuity/offer-recovery";
import { getFamilyPhones } from "../../lib/family-phone";
import { mapDb } from "../../lib/map/db";
import {
  buildDispatchAuth,
  buildDispatchTarget,
  preflightTaskDispatch,
} from "../../lib/tasks/dispatch-input";
import { deliveryVersionForNewTaskRun } from "../../lib/tasks/delivery-version";
import { enabledFamilyTaskKinds } from "../../lib/tasks/kinds";
import {
  dispatchScheduledTask,
  type ScheduledTaskDispatchDependencies,
} from "../../lib/tasks/scheduled-dispatch";
import {
  advanceTaskSchedule,
  beginTaskRun,
  claimDueFamilyTasks,
  finishTaskRun,
  isFirstFailedRunForScheduleDay,
  loadFamilyTaskForRun,
  recordSkippedScheduledTaskRun,
  reapStaleTaskRuns,
  releaseTaskSchedule,
  seedFamilyTaskSchedules,
  withinDeliveryWindow,
  type DueFamilyTask,
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
        const reaped = await reapStaleTaskRuns(now);
        const tasks = await claimDueFamilyTasks({
          now,
          limit: 50,
          leaseForMs: 10 * 60_000,
        });

        const dependenciesFor = (
          task: DueFamilyTask,
        ): ScheduledTaskDispatchDependencies => ({
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

        for (const task of tasks) {
          await dispatchScheduledTask(task, now, dependenciesFor(task));
        }

        // DR-2: a reaped morning brief that reached nobody gets exactly
        // one same-day replacement. The failed run fell out of the
        // outbox index, so a fresh run for the same schedule and local
        // day can begin; the delivery window still applies, so a retry
        // past noon records a skip instead of an afternoon text.
        for (const run of reaped) {
          if (run.kind !== "morning_brief" || run.reachedFamily) continue;
          if (!run.familyId || !run.scheduleId || !run.scheduledFor) continue;
          if (
            !(await isFirstFailedRunForScheduleDay(
              run.scheduleId,
              run.scheduledFor,
            ))
          ) {
            continue;
          }
          const loaded = await loadFamilyTaskForRun(
            run.familyId,
            run.scheduleId,
          );
          if (!loaded.ok) {
            console.error(
              `reaped morning brief not retried for family ${run.familyId}: ${loaded.note}`,
            );
            continue;
          }
          console.error(
            `retrying reaped morning brief for family ${run.familyId} (run ${run.runId})`,
          );
          await dispatchScheduledTask(loaded.task, now, dependenciesFor(loaded.task));
        }

        // Auto-recover accepted offers whose fulfillment turn dropped
        // (founder ruling 2026-07-23: remake and deliver, do not make the
        // parent ask again). Dark until HOMA_OFFER_RECOVERY_ENABLED and
        // verified on a +homatest sandbox family first, because it wakes
        // agent turns on these same rails. Idempotent via the fulfillment
        // ledger, bounded by conversation_offer_recovery; the finder and
        // guarantees live in lib/conversation-continuity/offer-recovery.ts.
        if (process.env.HOMA_OFFER_RECOVERY_ENABLED === "true") {
          await recoverUnfulfilledOffers(
            async (offer) => {
              const sql = mapDb();
              const [family] = await sql<{ email: string | null }[]>`
                select email from public.families where id = ${offer.familyId}
              `;
              const phones = await getFamilyPhones(offer.familyId);
              const episodeId = await createProactiveEpisode({
                familyId: offer.familyId,
                now,
              });
              // No runId on purpose: a recovery has no homa_task_runs row,
              // and an absent runId makes the dispatch channel deliver the
              // composed reply without touching task-run finalization.
              // acceptedOfferDeliveryId lets create_printable link and
              // dedupe the fulfillment against this exact offer.
              await receive(dispatchChannel, {
                message: buildFulfillmentRecoveryMessage(offer.offerText),
                target: {
                  familyId: offer.familyId,
                  phoneNumbers: phones.map((row) => row.phone_e164),
                  email: family?.email ?? null,
                  episodeId,
                  kind: "custom" as const,
                  deliveryPref:
                    offer.channel === "email" ? "email" : "text",
                },
                auth: {
                  authenticator: "dispatcher",
                  principalId: `dispatch:${offer.familyId}`,
                  principalType: "user" as const,
                  attributes: {
                    channel: "dispatch",
                    familyId: offer.familyId,
                    taskKind: "custom",
                    episodeId,
                    acceptedOfferDeliveryId: offer.sourceDeliveryId,
                  },
                },
              });
            },
            { now },
          );
        }
      })(),
    );
  },
});
