import { defineChannel, GET } from "eve/channels";

import {
  listFamilyDeliveryRecipients,
} from "../../lib/conversation-continuity/delivery-ledger";
import { dispatchContinuationToken } from "../../lib/conversation-continuity/dispatch-session-token";
import { selectTaskDeliveryRecipients } from "../../lib/conversation-continuity/task-recipients";
import { buildSignedReplyAddress } from "../../lib/conversation-continuity/email-reply-auth";
import {
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
import { finishTaskRun, markTaskRunDelivered } from "../../lib/tasks/store";
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
    const target = (input.target ?? {}) as {
      familyId?: string;
      phoneNumbers?: string[];
      email?: string | null;
      runId?: string;
      episodeId?: string;
      kind?: FamilyTaskKind;
      deliveryPref?: "text" | "email" | "none";
      label?: string | null;
      recipientMemberUserId?: string | null;
    };
    const kind = target.kind ?? "journal_prompt";
    return await send(input.message, {
      auth: input.auth ?? null,
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
      },
      title: `${kind} ${target.familyId ?? ""}`.trim(),
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

  routes: [GET("/eve/v1/dispatch/health", async () => Response.json({ ok: true }))],
});
