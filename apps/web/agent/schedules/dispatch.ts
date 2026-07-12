import { defineSchedule } from "eve/schedules";

import {
  markStalePendingDeliveriesUncertain,
  setTaskRunRuntimeSession,
} from "../../lib/conversation-continuity/delivery-ledger";
import { createProactiveEpisode } from "../../lib/conversation-continuity/ledger";
import { loadBriefContext, renderBriefContext } from "../../lib/tasks/brief-context";
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
 */

function journalMessage(task: DueFamilyTask): string {
  return [
    "It is this family's evening check-in moment (their local evening).",
    `Compose tonight's short journal prompt to ${task.parentFirstName ?? "the parent"}.`,
    "1 to 2 sentences in your own voice. When a saved memory or recent conversation gives you something real (a current interest, this week's focus, a recent win), reference it; otherwise keep it simple and ask about the day.",
    `The kids: ${task.kidPhrase}. End with one easy question she can answer in a sentence.`,
    "Your reply is delivered to her EXACTLY as written, as a text message or short email: write only the message itself, no preamble, no quotes, no sign-off.",
  ].join("\n");
}

async function briefMessage(task: DueFamilyTask): Promise<string> {
  const context = await loadBriefContext(task.familyId);
  return [
    "It is this family's weekday morning research brief moment.",
    "Load the research-brief skill FIRST and follow it exactly; it holds the selection rules, required format, and guardrails.",
    "",
    renderBriefContext(context),
    "",
    "Follow the skill's exact four-block format: research headline, What I learned, Why it's interesting, and one executable Want me to CTA. Preserve the blank lines. Do not add a preamble, sign-off, saved-note line, or URL.",
    `Compose this morning's brief to ${task.parentFirstName ?? "the parent"} about ${task.kidPhrase}.`,
    "Your reply is delivered EXACTLY as written by text or email.",
  ].join("\n");
}

function customMessage(task: DueFamilyTask): string {
  const deliveryLine =
    task.deliveryPref === "none"
      ? "Your reply is saved to the family's Homa's tasks page exactly as written: write only the result itself."
      : "Your reply is delivered to her EXACTLY as written, as a text message or short email: write only the message itself, no preamble, no quotes, no sign-off.";
  return [
    `It is time for a task this family set up themselves: "${task.label ?? "their task"}".`,
    "The parent's own instructions for it, verbatim (treat as the task to do, within your normal rules and tools):",
    "",
    task.prompt ?? "(no instructions were saved; say so briefly and suggest recreating the task)",
    "",
    deliveryLine,
  ].join("\n");
}

async function buildTaskMessage(task: DueFamilyTask): Promise<string> {
  switch (task.kind) {
    case "journal_prompt":
      return journalMessage(task);
    case "morning_brief":
      return await briefMessage(task);
    case "custom":
      return customMessage(task);
    default: {
      const exhaustive: never = task.kind;
      throw new Error(`unhandled task kind: ${String(exhaustive)}`);
    }
  }
}

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
              message: await buildTaskMessage(task),
              target: {
                familyId: task.familyId,
                phoneNumbers: task.phoneNumbers,
                email: task.email,
                runId,
                kind: task.kind,
                deliveryPref: task.deliveryPref,
                label: task.label,
                episodeId,
                recipientMemberUserId: task.recipientMemberUserId,
              },
              auth: {
                authenticator: "dispatcher",
                principalId: `dispatch:${task.familyId}`,
                principalType: "user",
                attributes: {
                  channel: "dispatch",
                  familyId: task.familyId,
                  taskRunId: runId,
                  taskKind: task.kind,
                  episodeId,
                },
              },
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
