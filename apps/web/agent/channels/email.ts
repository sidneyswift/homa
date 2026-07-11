import { defineChannel, POST } from "eve/channels";

import {
  findFamilyIdentityByEmail,
  optOutIntent,
  parseInboundEmail,
  setJournalOptOut,
  verifyResendWebhookSignature,
} from "../../lib/email-inbound";
import { getFamilyEmail, sendAgentComposedEmail } from "../../lib/map/email";
import { emitMapEvent } from "../../lib/map/events";

/**
 * Email as an adapter on the ONE agent (gateway-plan GW-3): a parent
 * replying to a Homa email is having a conversation, so the reply
 * becomes a normal agent turn and the agent's answer goes back as a
 * threaded email. Inbound arrives from Resend's inbound webhook,
 * configured with ?key=RESEND_INBOUND_SECRET and verified with
 * RESEND_WEBHOOK_SECRET. The channel is DARK while either env is unset.
 *
 * Tenancy: the sender's address is the auth context, matched against
 * the family's own registered email (the address SHE gave us), exactly
 * the family_phones posture. The session is stamped
 * {channel:'email', familyId}, so the pinned tool path applies and the
 * persist hook records the conversation. "stop" and "start" replies
 * flip the journal opt-out without ever starting a turn.
 *
 * One durable session per address per local-ish day (UTC date is fine
 * here; the session is a container, not a clock).
 */

/** Adapter state carried per session: where the reply goes back to. */
interface EmailState {
  toEmail: string | null;
  subject: string | null;
  familyId: string | null;
}

function emailContinuationToken(address: string): string {
  return `${address}:${new Date().toISOString().slice(0, 10)}`;
}

function replySubject(subject: string | null): string {
  if (!subject) return "Re: your note to Homa";
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

export default defineChannel({
  state: {
    toEmail: null as string | null,
    subject: null as string | null,
    familyId: null as string | null,
  },

  // The per-step channel context handed to event handlers.
  context(state) {
    return { state };
  },

  metadata(state) {
    return { adapterName: "email", subject: state.subject };
  },

  routes: [
    // Path declared under /eve/v1/ on purpose: custom channel routes
    // mount at their literal path, and only /eve/* is guaranteed to
    // reach the eve runtime through proxy.ts and the withEve() mount.
    // The explicit generic lets this route's send() carry typed state
    // (POST cannot infer TState from the surrounding defineChannel).
    POST<EmailState>("/eve/v1/email/inbound", async (req, { send }) => {
      const secret = process.env.RESEND_INBOUND_SECRET;
      const key = new URL(req.url).searchParams.get("key");
      if (!secret || key !== secret) {
        return Response.json({ ok: false }, { status: 401 });
      }

      const payload = await req.text();
      if (
        !verifyResendWebhookSignature(
          payload,
          req.headers,
          process.env.RESEND_WEBHOOK_SECRET,
        )
      ) {
        return Response.json({ ok: false }, { status: 401 });
      }

      let body: unknown;
      try {
        body = JSON.parse(payload);
      } catch {
        return Response.json({ ok: false }, { status: 400 });
      }

      const email = parseInboundEmail(body);
      if (!email.fromEmail || email.text.length === 0) {
        return Response.json({ ok: true, note: "nothing to process" });
      }

      const identity = await findFamilyIdentityByEmail(email.fromEmail);
      const familyId = identity?.familyId ?? null;
      await emitMapEvent("email.message_received", {
        linked_family: familyId !== null,
      });
      if (!familyId) {
        // Unknown sender: never a turn. The reply-to inbox remains the
        // human path for strangers.
        return Response.json({ ok: true, note: "sender not linked" });
      }

      const intent = optOutIntent(email.text);
      if (intent) {
        await setJournalOptOut(familyId, intent === "stop");
        await emitMapEvent("email.opt_out", {
          family_id: familyId,
          resumed: intent === "start",
        });
        const to = await getFamilyEmail(familyId);
        if (to) {
          await sendAgentComposedEmail(
            to,
            intent === "stop" ? "Evening check-ins are off" : "Evening check-ins are back on",
            [
              intent === "stop"
                ? "Done. No more evening check-ins. Reply 'start' anytime to turn them back on."
                : "Done. Evening check-ins are back on.",
            ],
          );
        }
        return Response.json({ ok: true, note: "opt-out handled" });
      }

      const session = await send(email.text, {
        auth: {
          authenticator: "resend-email",
          principalId: `email:${email.fromEmail}`,
          principalType: "user",
          // memberName rides only when the sender's address is a
          // member's own sign-in email (auth context, never model input).
          attributes: {
            channel: "email",
            familyId,
            ...(identity?.memberDisplayName
              ? { memberName: identity.memberDisplayName }
              : {}),
          },
        },
        continuationToken: emailContinuationToken(email.fromEmail),
        state: { toEmail: email.fromEmail, subject: email.subject || null, familyId },
        title: `Email conversation ${email.fromEmail}`,
      });

      return Response.json({ ok: true, sessionId: session.id });
    }),
  ],

  events: {
    "session.failed"(eventData) {
      console.error("email channel session failed:", JSON.stringify(eventData).slice(0, 400));
    },
    async "message.completed"(eventData, channel) {
      // Interim narration before tool calls also lands here; only the
      // terminal reply goes back to the parent's inbox.
      const data = eventData as { message?: string | null; finishReason?: string };
      if (data.finishReason !== "stop" || !data.message?.trim()) return;
      const to = channel.state.toEmail;
      if (!to) return;
      try {
        await sendAgentComposedEmail(
          to,
          replySubject(channel.state.subject),
          data.message
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0),
        );
      } catch (error) {
        console.error(
          "email channel delivery failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    },
  },
});
