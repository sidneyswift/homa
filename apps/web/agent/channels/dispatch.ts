import { defineChannel, GET } from "eve/channels";

import { sendJournalAgentEmail } from "../../lib/map/email";
import { mapDb } from "../../lib/map/db";
import { emitMapEvent } from "../../lib/map/events";
import { sendHomaSms } from "../../lib/voice/telnyx-api";

/**
 * The proactive channel (gateway-plan GW-4): where agent turns that WE
 * start (the dispatcher's schedule rows) run and deliver. The agent
 * composes the message as this family, and this channel owns getting it
 * to her: a text when a line is linked, the approved email shell
 * otherwise. Loops that talk to families wake the agent; this is the
 * doorway they use.
 *
 * No conversational inbound routes on purpose: the parent's REPLY
 * arrives on her own surface (the SMS channel or the email adapter) as
 * a normal turn. The health route exists because eve's cross-channel
 * receive() falls back to route-fingerprint matching when bundle
 * boundaries break reference identity; a channel with zero routes has
 * no fingerprint and cannot be dispatched to.
 */

export default defineChannel({
  state: {
    familyId: null as string | null,
    phoneE164: null as string | null,
    email: null as string | null,
    delivered: false,
  },

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
      phoneE164?: string | null;
      email?: string | null;
    };
    return await send(input.message, {
      auth: input.auth ?? null,
      continuationToken: `${target.familyId ?? "unknown"}:${new Date().toISOString().slice(0, 10)}`,
      state: {
        familyId: target.familyId ?? null,
        phoneE164: target.phoneE164 ?? null,
        email: target.email ?? null,
        delivered: false,
      },
      title: `Journal prompt ${target.familyId ?? ""}`.trim(),
    });
  },

  events: {
    async "message.completed"(eventData, channel) {
      const data = eventData as { message?: string | null; finishReason?: string };
      if (data.finishReason !== "stop" || !data.message?.trim()) return;
      if (channel.state.delivered) return;
      const text = data.message.trim();
      const { familyId, phoneE164, email } = channel.state;
      if (!familyId) return;

      try {
        let channelUsed: "sms" | "email" | null = null;
        if (phoneE164 && (await sendHomaSms(phoneE164, text))) {
          channelUsed = "sms";
        } else if (email && (await sendJournalAgentEmail(email, text))) {
          channelUsed = "email";
        }
        if (!channelUsed) {
          console.error(`dispatch delivery failed for family ${familyId} (no channel worked)`);
          return;
        }
        channel.state.delivered = true;
        const sql = mapDb();
        await sql`
          update public.families set journal_prompt_last_sent_at = now()
          where id = ${familyId}
        `;
        await emitMapEvent("journal.prompt_sent", {
          family_id: familyId,
          channel: channelUsed,
        });
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
