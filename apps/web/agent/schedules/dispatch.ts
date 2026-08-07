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
import { mapDb } from "../../lib/map/db";
import { chatOnboardingEnabled } from "../../lib/onboarding/state";
import {
  buildSitting1RecapMessage,
  findFamiliesDueForSitting1RecapWithDatabase,
} from "../../lib/onboarding/sitting1-recap";
import { writeOnboardingRecord } from "../../lib/onboarding/store";
import {
  buildDispatchAuth,
  buildDispatchTarget,
  preflightTaskDispatch,
} from "../../lib/tasks/dispatch-input";
import { deliveryVersionForNewTaskRun } from "../../lib/tasks/delivery-version";
import { enabledFamilyTaskKinds } from "../../lib/tasks/kinds";
import { startManualTaskDispatch } from "../../lib/tasks/manual-dispatch";
import { planReapedRunRetry } from "../../lib/tasks/reap-retry";
import {
  dispatchScheduledTask,
  type ScheduledTaskDispatchDependencies,
} from "../../lib/tasks/scheduled-dispatch";
import {
  advanceTaskSchedule,
  beginManualTaskRun,
  beginTaskRun,
  claimDueFamilyTasks,
  finishTaskRun,
  isFirstFailedManualRun,
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
              memberUserId: scheduledTask.sourceOfferDeliveryId
                ? scheduledTask.recipientMemberUserId
                : null,
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

        // DR-2 (widened 2026-07-23): a reaped run that reached nobody gets
        // exactly one replacement. Morning briefs kept their original
        // same-day behaviour: the failed run fell out of the outbox index,
        // so a fresh run for the same schedule and local day can begin, and
        // the delivery window still applies, so a retry past noon records a
        // skip instead of an afternoon text.
        //
        // Custom tasks now retry too. A parent's own task could hang on a
        // single tool call and die with nothing to show: the Swift family's
        // "Story's alphabet pages, next batch" (2026-07-19) requested
        // find_materials, never got a result, sat frozen, and was failed by
        // the reaper three hours later, so the parent had to notice and
        // re-run it by hand. One automatic retry turns that into a delay
        // instead of a dead end.
        //
        // A manual run has no scheduled_for, so it re-runs through the
        // manual door rather than the scheduled one: that keeps next_run_at
        // and the daily outbox untouched, exactly as a Run now click does.
        // journal_prompt is deliberately excluded: an evening prompt
        // replayed hours late is worse than none.
        for (const run of reaped) {
          const plan = planReapedRunRetry(run);
          if (!plan.retry) continue;
          const firstFailure =
            plan.door === "manual"
              ? await isFirstFailedManualRun(plan.scheduleId)
              : await isFirstFailedRunForScheduleDay(
                  plan.scheduleId,
                  plan.scheduledFor,
                );
          if (!firstFailure) continue;
          const loaded = await loadFamilyTaskForRun(
            plan.familyId,
            plan.scheduleId,
          );
          if (!loaded.ok) {
            console.error(
              `reaped ${run.kind} not retried for family ${run.familyId}: ${loaded.note}`,
            );
            continue;
          }
          console.error(
            `retrying reaped ${run.kind} for family ${run.familyId} (run ${run.runId})`,
          );
          if (plan.door === "manual") {
            await startManualTaskDispatch(loaded.task, {
              preflight: async (manualTask) =>
                await preflightTaskDispatch(manualTask, "manual"),
              beginRun: async (manualTask, deliveryVersion) =>
                await beginManualTaskRun(manualTask, { deliveryVersion }),
              createEpisode: async (manualTask) =>
                await createProactiveEpisode({
                  familyId: manualTask.familyId,
                  memberUserId: manualTask.sourceOfferDeliveryId
                    ? manualTask.recipientMemberUserId
                    : null,
                  now,
                }),
              sendSession: async ({ message, auth, target }) =>
                await receive(dispatchChannel, { message, target, auth }),
              setRuntimeSession: setTaskRunRuntimeSession,
              finishRun: finishTaskRun,
            });
          } else {
            await dispatchScheduledTask(loaded.task, now, dependenciesFor(loaded.task));
          }
        }

        // H1 rep 2, the day-1 evening close-the-loop prompt
        // (plans/2026-07-21-chat-first-onboarding.md §6.3): no
        // agent_schedules row, no advance/claim semantics, because this
        // is a single boundary event, not a recurring cadence. Beat
        // idempotency is context.onboarding.beatsDone (append-only), not
        // homa_task_runs, so unlike the built-in kinds a session that
        // starts but never completes has no reaper to retry it; accepted
        // here because a missed one-time evening nudge is a low-stakes
        // miss, not a broken promise (nothing was told to her in advance).
        if (chatOnboardingEnabled()) {
          const dueRecaps = await findFamiliesDueForSitting1RecapWithDatabase(
            mapDb(),
            now,
          );
          for (const recap of dueRecaps) {
            const episodeId = await createProactiveEpisode({
              familyId: recap.familyId,
              now,
            });
            await receive(dispatchChannel, {
              message: buildSitting1RecapMessage(recap),
              target: {
                familyId: recap.familyId,
                phoneNumbers: recap.phoneNumbers,
                email: recap.email,
                episodeId,
                kind: "custom" as const,
                deliveryPref: recap.phoneNumbers.length > 0 ? "text" : "email",
                recipientMemberUserId: recap.recipientMemberUserId,
              },
              auth: {
                authenticator: "dispatcher",
                principalId: `dispatch:${recap.familyId}`,
                principalType: "user" as const,
                attributes: {
                  channel: "dispatch",
                  familyId: recap.familyId,
                  taskKind: "custom",
                  episodeId,
                },
              },
            });
            await writeOnboardingRecord(recap.familyId, {
              addBeats: ["sitting1_recap"],
            });
          }
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
              const episodeId = await createProactiveEpisode({
                familyId: offer.familyId,
                memberUserId: offer.recipientMemberUserId,
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
                  phoneNumbers: [],
                  email: null,
                  episodeId,
                  kind: "custom" as const,
                  deliveryPref:
                    offer.channel === "email" ? "email" : "text",
                  recipientMemberUserId: offer.recipientMemberUserId,
                  requireExactRecipient: true,
                  sourceOfferDeliveryId: offer.sourceDeliveryId,
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
                    memberUserId: offer.recipientMemberUserId,
                    acceptedOfferDeliveryId: offer.sourceDeliveryId,
                    offerRecovery: "true",
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
