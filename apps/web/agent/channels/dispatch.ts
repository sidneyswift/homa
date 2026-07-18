import { defineChannel, GET, POST } from "eve/channels";

import {
  setTaskRunRuntimeSession,
} from "../../lib/conversation-continuity/delivery-ledger";
import { dispatchContinuationToken } from "../../lib/conversation-continuity/dispatch-session-token";
import {
  createProactiveEpisode,
  persistCanonicalMessage,
} from "../../lib/conversation-continuity/ledger";
import { mapDb } from "../../lib/map/db";
import {
  operationalDiagnostic,
  type OperationalPhase,
} from "../../lib/operational-diagnostics";
import {
  preflightTaskDispatch,
} from "../../lib/tasks/dispatch-input";
import { deliverLiveDispatchTask } from "../../lib/tasks/dispatch-transport";
import { startManualTaskDispatch } from "../../lib/tasks/manual-dispatch";
import { findInternalNarration } from "../../lib/tasks/outbound-guard";
import {
  isPreparedResearchBriefTerminalMessage,
} from "../../lib/tasks/research-brief-delivery";
import {
  beginManualTaskRun,
  finishTaskRun,
  finishTaskRunFromDurableDeliveries,
  hasRunningTaskRun,
  loadFamilyTaskForRun,
  markTaskRunDelivered,
} from "../../lib/tasks/store";
import type { TaskDeliveryVersion } from "../../lib/tasks/delivery-version";
import { type FamilyTaskKind } from "../../lib/tasks/kinds";
import {
  deliverResearchBriefDispatch,
  handleResearchBriefDispatchTerminalEvent,
  usesResearchBriefV2Dispatch,
  type ResearchBriefDispatchState,
} from "../research-brief-dispatch";

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

interface DispatchState extends ResearchBriefDispatchState {
  /** Every linked number (multi-parent v0: one per adult). A text task
   * goes to each of them; one landing counts as delivered. */
  phoneNumbers: string[];
  email: string | null;
  label: string | null;
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
  deliveryVersion?: TaskDeliveryVersion;
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
      deliveryVersion: target.deliveryVersion ?? "legacy",
      transportAccepted: false,
      delivered: false,
    } satisfies DispatchState,
    title: `${kind} ${target.familyId ?? ""}`.trim(),
  };
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
    deliveryVersion: "legacy",
    transportAccepted: false,
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
      const preparedDelivery = usesResearchBriefV2Dispatch(
        channel.state.kind,
        channel.state.deliveryVersion,
      );
      if (preparedDelivery) {
        if (!isPreparedResearchBriefTerminalMessage(data)) return;
      } else if (data.finishReason !== "stop" || !data.message?.trim()) {
        return;
      }
      if (channel.state.delivered) return;
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

      if (preparedDelivery) {
        await deliverResearchBriefDispatch({
          state: channel.state,
          authAttributes: ctx.session.auth.current?.attributes,
          sessionId: ctx.session.id,
          sequence: data.sequence,
          turnId: data.turnId,
        });
        return;
      }
      const text = data.message?.trim() ?? "";

      // The composed text is about to reach the family verbatim. A turn
      // that narrated internal machinery instead of doing the task must
      // fail visibly, not deliver (2026-07-18 Gomes incident).
      const narration = findInternalNarration(text, {
        codeAllowed: deliveryPref === "none",
      });
      if (narration) {
        console.error(
          operationalDiagnostic("dispatch", "content_guard", "blocked"),
        );
        if (runId) {
          await finishTaskRun(runId, {
            familyId,
            kind,
            status: "failed",
            error: `internal narration blocked: ${narration}`,
            sessionId: ctx.session.id,
            onlyIfRunning: true,
          });
        }
        return;
      }

      let deliveryPhase: OperationalPhase = "canonical_persist";
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
        deliveryPhase = "transport";
        const delivery = await deliverLiveDispatchTask({
          familyId,
          episodeId,
          messageId: message.id,
          taskRunId: runId,
          kind,
          text,
          deliveryMode: deliveryPref,
          recipientMemberUserId,
          label,
          deliveryVersion: channel.state.deliveryVersion,
        });
        deliveryPhase = "finalization";
        const saveOnlyAccepted =
          delivery.deliveredCount > 0 &&
          delivery.deliveredChannel === "none";
        if (runId && saveOnlyAccepted) {
          await markTaskRunDelivered(runId, {
            summary: text,
            channel: "none",
          });
        }
        const durableResult = runId
          ? await finishTaskRunFromDurableDeliveries({
              runId,
              familyId,
              kind,
              summary: text,
              sessionId: ctx.session.id,
              saveOnlyAccepted,
              canonicalMessageId: message.id,
            })
          : { finished: true as const, delivery };
        if (!durableResult.finished) return;
        const durableDelivery = durableResult.delivery;
        channel.state.delivered = durableDelivery.deliveredCount > 0;

        if (
          kind === "journal_prompt" &&
          durableDelivery.deliveredCount > 0
        ) {
          const sql = mapDb();
          await sql`
            update public.families set journal_prompt_last_sent_at = now()
            where id = ${familyId}
          `;
        }
      } catch {
        console.error(
          operationalDiagnostic(
            "dispatch",
            deliveryPhase,
            "failed",
          ),
        );
      }
    },
    async "turn.completed"(_eventData, channel, ctx) {
      await handleResearchBriefDispatchTerminalEvent({
        eventType: "turn.completed",
        state: channel.state,
        sessionId: ctx.session.id,
      });
    },
    async "turn.failed"(_eventData, channel, ctx) {
      await handleResearchBriefDispatchTerminalEvent({
        eventType: "turn.failed",
        state: channel.state,
        sessionId: ctx.session.id,
      });
    },
    async "session.failed"(_eventData, channel) {
      await handleResearchBriefDispatchTerminalEvent({
        eventType: "session.failed",
        state: channel.state,
      });
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

      const result = await startManualTaskDispatch(task, {
        preflight: async (manualTask) =>
          await preflightTaskDispatch(manualTask, "manual"),
        beginRun: async (manualTask, deliveryVersion) =>
          await beginManualTaskRun(manualTask, {
            deliveryVersion,
          }),
        createEpisode: async (manualTask) =>
          await createProactiveEpisode({ familyId: manualTask.familyId }),
        sendSession: async ({ message, auth, target }) =>
          await send(message, {
            auth,
            ...dispatchSendOptions(target),
          }),
        setRuntimeSession: setTaskRunRuntimeSession,
        finishRun: finishTaskRun,
      });
      return result.ok
        ? Response.json(result)
        : Response.json(
            { ok: false, note: result.note },
            { status: result.status },
          );
    }),
  ],
});
