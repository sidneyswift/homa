import { defineChannel, GET, POST } from "eve/channels";

import {
  listFamilyDeliveryRecipients,
  setTaskRunRuntimeSession,
} from "../../lib/conversation-continuity/delivery-ledger";
import { dispatchContinuationToken } from "../../lib/conversation-continuity/dispatch-session-token";
import { selectTaskDeliveryRecipients } from "../../lib/conversation-continuity/task-recipients";
import { buildSignedReplyAddress } from "../../lib/conversation-continuity/email-reply-auth";
import {
  createProactiveEpisode,
  markCanonicalMessageDelivered,
  persistCanonicalMessage,
} from "../../lib/conversation-continuity/ledger";
import {
  deliverTaskMessage,
  postgresTaskDeliveryLedger,
} from "../../lib/conversation-continuity/task-delivery";
import {
  submitAgentComposedEmail,
  submitJournalAgentEmail,
  submitResearchBriefEmail,
  type HomaEmailSubmission,
} from "../../lib/map/email";
import { mapDb } from "../../lib/map/db";
import { emitMapEvent } from "../../lib/map/events";
import {
  buildDispatchAuth,
  buildDispatchTarget,
  buildTaskMessage,
} from "../../lib/tasks/dispatch-input";
import {
  beginManualTaskRun,
  finishTaskRun,
  hasRunningTaskRun,
  loadFamilyTaskForRun,
  markTaskRunDelivered,
} from "../../lib/tasks/store";
import { type FamilyTaskKind } from "../../lib/tasks/kinds";
import { submitHomaSms } from "../../lib/voice/telnyx-api";

/**
 * The proactive channel (gateway-plan GW-4, generalized by HT-1): where
 * agent turns that WE start (the dispatcher's task rows) run and
 * deliver. The agent composes the message as this family, and this
 * channel owns getting it to her: a text when a line is linked, the
 * kind's email shell otherwise, or nothing at all for save-only custom
 * tasks. Loops that talk to families wake the agent; this is the
 * doorway they use.
 *
 * This channel also FINISHES each run (homa_task_runs): the dispatcher
 * cannot, because receive() resolves when the durable session starts,
 * not when it completes; message.completed here is the only place that
 * sees the composed text and the delivery outcome.
 *
 * No conversational inbound routes on purpose: the parent's REPLY
 * arrives on her own surface (the SMS channel or the email adapter) as
 * a normal turn. The health route exists because eve's cross-channel
 * receive() falls back to route-fingerprint matching when bundle
 * boundaries break reference identity; a channel with zero routes has
 * no fingerprint and cannot be dispatched to.
 *
 * The run-now route is not conversational either: it is the tasks
 * page's own Run now button arriving over HTTP, because eve's send()
 * only exists inside the runtime and the Next server action lives
 * outside it. The route is gated by CRON_SECRET (the deployment's own
 * internal-trigger secret, same trust boundary as the Vercel cron) and
 * trusts the posted familyId only because the caller holds that
 * secret: the server action derives it from the signed-in parent's OWN
 * membership, and every query re-scopes taskId by it.
 */

interface DispatchState {
  familyId: string | null;
  /** Every linked number (multi-parent v0: one per adult). A text task
   * goes to each of them; one landing counts as delivered. */
  phoneNumbers: string[];
  email: string | null;
  runId: string | null;
  episodeId: string | null;
  kind: FamilyTaskKind;
  deliveryPref: "text" | "email" | "none";
  label: string | null;
  /** The one adult this task delivers to (founder ruling 2026-07-12);
   * null falls back to the account owner at delivery time. */
  recipientMemberUserId: string | null;
  delivered: boolean;
}

interface DispatchTargetInput {
  familyId?: string;
  phoneNumbers?: string[];
  email?: string | null;
  runId?: string;
  episodeId?: string;
  kind?: FamilyTaskKind;
  deliveryPref?: "text" | "email" | "none";
  label?: string | null;
  recipientMemberUserId?: string | null;
}

/** One session identity and state per run, shared by the receive hook
 * (scheduled runs) and the run-now route (manual runs). */
function dispatchSendOptions(target: DispatchTargetInput) {
  const kind = target.kind ?? "journal_prompt";
  return {
    // Per run, not per family-day: two custom tasks for one family in
    // one tick must not collide on one eve hook token (2026-07-12
    // HookConflictError incident, two of three per-kid briefs lost).
    continuationToken: dispatchContinuationToken(
      kind,
      target.familyId,
      target.runId,
    ),
    state: {
      familyId: target.familyId ?? null,
      phoneNumbers: target.phoneNumbers ?? [],
      email: target.email ?? null,
      runId: target.runId ?? null,
      episodeId: target.episodeId ?? null,
      kind,
      deliveryPref: target.deliveryPref ?? "text",
      label: target.label ?? null,
      recipientMemberUserId: target.recipientMemberUserId ?? null,
      delivered: false,
    } satisfies DispatchState,
    title: `${kind} ${target.familyId ?? ""}`.trim(),
  };
}

async function sendTaskEmail(
  kind: FamilyTaskKind,
  label: string | null,
  email: string,
  text: string,
  replyTo?: string,
): Promise<HomaEmailSubmission> {
  switch (kind) {
    case "journal_prompt":
      return await submitJournalAgentEmail(email, text, replyTo);
    case "morning_brief":
      return await submitResearchBriefEmail(email, text, replyTo);
    case "custom":
      return await submitAgentComposedEmail(
        email,
        label ?? "From Homa",
        [text],
        replyTo,
      );
    default: {
      const exhaustive: never = kind;
      throw new Error(`unhandled task email kind: ${String(exhaustive)}`);
    }
  }
}

export default defineChannel({
  state: {
    familyId: null,
    phoneNumbers: [],
    email: null,
    runId: null,
    episodeId: null,
    kind: "journal_prompt",
    deliveryPref: "text",
    label: null,
    recipientMemberUserId: null,
    delivered: false,
  } as DispatchState,

  // The per-step channel context handed to event handlers; mutations to
  // state here write back through the adapter.
  context(state) {
    return { state };
  },

  metadata(state) {
    return { adapterName: "dispatch", delivered: state.delivered };
  },

  async receive(input, { send }) {
    const target = (input.target ?? {}) as DispatchTargetInput;
    return await send(input.message, {
      auth: input.auth ?? null,
      ...dispatchSendOptions(target),
    });
  },

  events: {
    async "message.completed"(eventData, channel, ctx) {
      const data = eventData as {
        message?: string | null;
        finishReason?: string;
        sequence: number;
        turnId?: string;
      };
      if (data.finishReason !== "stop" || !data.message?.trim()) return;
      if (channel.state.delivered) return;
      const text = data.message.trim();
      const {
        familyId,
        runId,
        kind,
        episodeId,
        deliveryPref,
        label,
        recipientMemberUserId,
      } = channel.state;
      if (!familyId) return;

      try {
        const message = await persistCanonicalMessage({
          attributes: ctx.session.auth.current?.attributes,
          sessionId: ctx.session.id,
          channel: "dispatch",
          sequence: data.sequence,
          role: "assistant",
          content: text,
          turnId: data.turnId,
        });
        if (!message || !episodeId) {
          throw new Error("dispatch message could not enter the continuity ledger");
        }
        // Task texts reach ONE adult: the task's own recipient, or the
        // account owner on legacy rows (founder ruling 2026-07-12).
        // Invited co-parents are never auto-subscribed.
        const recipients = selectTaskDeliveryRecipients(
          await listFamilyDeliveryRecipients(familyId),
          recipientMemberUserId,
        );
        const delivery = await deliverTaskMessage(
          {
            familyId,
            episodeId,
            messageId: message.id,
            taskRunId: runId,
            kind,
            text,
            recipients,
            deliveryMode: deliveryPref,
          },
          {
            ledger: postgresTaskDeliveryLedger,
            transports: {
              sendSms: submitHomaSms,
              sendEmail: async (email, body, attempt) => {
                const secret = process.env.RESEND_INBOUND_SECRET;
                const replyTo = secret
                  ? buildSignedReplyAddress(attempt.id, secret)
                  : undefined;
                return await sendTaskEmail(
                  kind,
                  label,
                  email,
                  body,
                  replyTo,
                );
              },
            },
          },
        );
        channel.state.delivered = delivery.deliveredCount > 0;
        if (delivery.deliveredCount > 0) {
          await markCanonicalMessageDelivered({
            familyId,
            messageId: message.id,
          });
        }

        if (runId) {
          if (delivery.status !== "failed") {
            await markTaskRunDelivered(runId, {
              summary: text,
              channel: delivery.deliveredChannel,
            });
          }
          await finishTaskRun(runId, {
            familyId,
            kind,
            status: delivery.status,
            sessionId: ctx.session.id,
            ...(delivery.status === "failed"
              ? { error: "delivery failed for every intended recipient" }
              : {}),
          });
        }

        if (kind === "journal_prompt" && delivery.deliveredCount > 0) {
          const sql = mapDb();
          await sql`
            update public.families set journal_prompt_last_sent_at = now()
            where id = ${familyId}
          `;
          if (
            delivery.deliveredChannel === "sms" ||
            delivery.deliveredChannel === "email"
          ) {
            await emitMapEvent("journal.prompt_sent", {
              family_id: familyId,
              channel: delivery.deliveredChannel,
            });
          }
        } else if (
          kind === "morning_brief" &&
          delivery.deliveredCount > 0 &&
          (delivery.deliveredChannel === "sms" ||
            delivery.deliveredChannel === "email")
        ) {
          await emitMapEvent("research.brief_sent", {
            family_id: familyId,
            channel: delivery.deliveredChannel,
          });
        }
      } catch (error) {
        console.error(
          "dispatch delivery failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    },
  },

  routes: [
    GET("/eve/v1/dispatch/health", async () => Response.json({ ok: true })),

    // The tasks page's Run now button (runTaskNowAction): one immediate
    // run of one task, on demand. The schedule row is untouched, so
    // next_run_at, the paused switch, and the daily outbox all keep
    // their meaning; the manual run row rides scheduled_for null. Path
    // under /eve/v1/ on purpose: only /eve/* is guaranteed to reach the
    // eve runtime through proxy.ts and the withEve() mount.
    POST<DispatchState>("/eve/v1/dispatch/run-now", async (req, { send }) => {
      const secret = process.env.CRON_SECRET;
      if (!secret) {
        return Response.json(
          { ok: false, note: "Homa couldn't start this run. Try again in a bit." },
          { status: 503 },
        );
      }
      if (req.headers.get("authorization") !== `Bearer ${secret}`) {
        return Response.json({ ok: false }, { status: 401 });
      }

      let body: { taskId?: unknown; familyId?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return Response.json({ ok: false }, { status: 400 });
      }
      const uuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const taskId = typeof body.taskId === "string" ? body.taskId : "";
      const familyId = typeof body.familyId === "string" ? body.familyId : "";
      if (!uuidShape.test(taskId) || !uuidShape.test(familyId)) {
        return Response.json({ ok: false }, { status: 400 });
      }

      const loaded = await loadFamilyTaskForRun(familyId, taskId);
      if (!loaded.ok) {
        return Response.json({ ok: false, note: loaded.note }, { status: 409 });
      }
      const task = loaded.task;
      if (await hasRunningTaskRun(task.scheduleId)) {
        // The dialog's helper line above this note already names History
        // as where the result lands, so this stays one sentence.
        return Response.json(
          { ok: false, note: "Homa is already working on this task." },
          { status: 409 },
        );
      }

      // Build the message before the run row exists so a context-load
      // failure leaves no orphaned 'running' row behind.
      const message = await buildTaskMessage(task, "manual");
      const runId = await beginManualTaskRun(task);
      const episodeId = await createProactiveEpisode({ familyId: task.familyId });
      try {
        const session = await send(message, {
          auth: buildDispatchAuth(task, runId, episodeId),
          ...dispatchSendOptions(buildDispatchTarget(task, runId, episodeId)),
        });
        await setTaskRunRuntimeSession(runId, session.id);
        return Response.json({ ok: true, runId });
      } catch (error) {
        await finishTaskRun(runId, {
          familyId: task.familyId,
          kind: task.kind,
          status: "failed",
          error:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "session startup failed",
        });
        return Response.json(
          { ok: false, note: "Homa couldn't start this run. Try again in a bit." },
          { status: 502 },
        );
      }
    }),
  ],
});
