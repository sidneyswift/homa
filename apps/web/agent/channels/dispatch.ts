import { defineChannel, GET } from "eve/channels";

import {
  sendAgentComposedEmail,
  sendJournalAgentEmail,
  sendResearchBriefEmail,
} from "../../lib/map/email";
import { mapDb } from "../../lib/map/db";
import { emitMapEvent } from "../../lib/map/events";
import { finishTaskRun, markTaskRunDelivered } from "../../lib/tasks/store";
import { type FamilyTaskKind } from "../../lib/tasks/kinds";
import { sendHomaSms } from "../../lib/voice/telnyx-api";

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
  kind: FamilyTaskKind;
  deliveryPref: "text" | "email" | "none";
  label: string | null;
  delivered: boolean;
}

type DeliveredChannel = "sms" | "email" | "none";

/** Texts every linked number; true when at least one send landed, so a
 * second parent's dead number never fails the whole family's task. */
async function sendSmsToAll(phoneNumbers: string[], text: string): Promise<boolean> {
  let anyDelivered = false;
  for (const phone of phoneNumbers) {
    if (await sendHomaSms(phone, text)) anyDelivered = true;
  }
  return anyDelivered;
}

/** Kind-specific delivery: which doors to try, in which order. Returns
 * null when every attempted door failed (the dispatcher then fails the
 * run); "none" is a successful save-only outcome, never a failure. */
async function deliver(
  state: DispatchState,
  text: string,
): Promise<DeliveredChannel | null> {
  const { kind, phoneNumbers, email, deliveryPref, label } = state;

  switch (kind) {
    case "journal_prompt": {
      if (await sendSmsToAll(phoneNumbers, text)) return "sms";
      if (email && (await sendJournalAgentEmail(email, text))) return "email";
      return null;
    }
    case "morning_brief": {
      if (await sendSmsToAll(phoneNumbers, text)) return "sms";
      if (email && (await sendResearchBriefEmail(email, text))) return "email";
      return null;
    }
    case "custom": {
      // The parent picked the door herself. Her own vocabulary is never
      // brand-gated (she may well say "assessment"); the shared email
      // shell and SMS pipe are the same guarded senders as everywhere.
      if (deliveryPref === "none") return "none";
      if (deliveryPref === "text") {
        if (await sendSmsToAll(phoneNumbers, text)) return "sms";
        if (email && (await sendAgentComposedEmail(email, label ?? "From Homa", [text]))) {
          return "email";
        }
        return null;
      }
      if (email && (await sendAgentComposedEmail(email, label ?? "From Homa", [text]))) {
        return "email";
      }
      return null;
    }
    default: {
      const exhaustive: never = kind;
      throw new Error(`unhandled dispatch kind: ${String(exhaustive)}`);
    }
  }
}

export default defineChannel({
  state: {
    familyId: null,
    phoneNumbers: [],
    email: null,
    runId: null,
    kind: "journal_prompt",
    deliveryPref: "text",
    label: null,
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
      kind?: FamilyTaskKind;
      deliveryPref?: "text" | "email" | "none";
      label?: string | null;
    };
    const kind = target.kind ?? "journal_prompt";
    return await send(input.message, {
      auth: input.auth ?? null,
      continuationToken: `${kind}:${target.familyId ?? "unknown"}:${new Date().toISOString().slice(0, 10)}`,
      state: {
        familyId: target.familyId ?? null,
        phoneNumbers: target.phoneNumbers ?? [],
        email: target.email ?? null,
        runId: target.runId ?? null,
        kind,
        deliveryPref: target.deliveryPref ?? "text",
        label: target.label ?? null,
        delivered: false,
      },
      title: `${kind} ${target.familyId ?? ""}`.trim(),
    });
  },

  events: {
    async "message.completed"(eventData, channel) {
      const data = eventData as { message?: string | null; finishReason?: string };
      if (data.finishReason !== "stop" || !data.message?.trim()) return;
      if (channel.state.delivered) return;
      const text = data.message.trim();
      const { familyId, runId, kind } = channel.state;
      if (!familyId) return;

      try {
        const channelUsed = await deliver(channel.state, text);
        if (channelUsed === null) {
          console.error(
            `dispatch delivery failed for family ${familyId} (${kind}; no channel worked)`,
          );
          if (runId) {
            await finishTaskRun(runId, {
              familyId,
              kind,
              status: "failed",
              error: "delivery failed on every channel",
            });
          }
          return;
        }
        channel.state.delivered = true;

        if (runId) {
          await markTaskRunDelivered(runId, { summary: text, channel: channelUsed });
          await finishTaskRun(runId, { familyId, kind, status: "done" });
        }

        if (kind === "journal_prompt") {
          const sql = mapDb();
          await sql`
            update public.families set journal_prompt_last_sent_at = now()
            where id = ${familyId}
          `;
          if (channelUsed !== "none") {
            await emitMapEvent("journal.prompt_sent", {
              family_id: familyId,
              channel: channelUsed,
            });
          }
        } else if (kind === "morning_brief" && channelUsed !== "none") {
          await emitMapEvent("research.brief_sent", {
            family_id: familyId,
            channel: channelUsed,
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
