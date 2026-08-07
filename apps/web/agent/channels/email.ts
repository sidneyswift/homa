import { defineChannel, POST } from "eve/channels";

import { bindDeliveredProgressCheckIn } from "../../lib/child-progress/delivery-binding.server";
import {
  CHANNEL_GATE_SMS_LINE,
  familyHasChannel,
} from "../../lib/billing/channel-access";
import { canonicalInboundAuthAttributes } from "../../lib/conversation-continuity/canonical-inbound";
import {
  beginDeliveryAttempt,
  enrichDeliveryAttemptProviderMessageId,
  findDeliveryEmailIdentity,
  finishDeliveryAttempt,
  openReplyLoop,
} from "../../lib/conversation-continuity/delivery-ledger";
import {
  buildSignedReplyAddress,
  emailAuthenticationPasses,
  parseSignedReplyDeliveryId,
} from "../../lib/conversation-continuity/email-reply-auth";
import {
  claimInboundReceipt,
  completeInboundReceipt,
  failInboundReceipt,
  setInboundReceiptSession,
} from "../../lib/conversation-continuity/inbound-receipts";
import {
  markCanonicalMessageDelivered,
  persistCanonicalMessage,
  resolveInboundContinuity,
  resolvedContinuityAttributes,
} from "../../lib/conversation-continuity/ledger";
import { replyContractForReactiveMessage } from "../../lib/conversation-continuity/delivery-policy";
import {
  acceptedOfferDeliveryIdFromAttributes,
  acceptedOfferDestinationStillCurrent,
} from "../../lib/conversation-continuity/offer-fulfillment";
import { deliverReactiveEmailWithRetry } from "../../lib/conversation-continuity/reactive-email-delivery";
import {
  findFamilyIdentityByEmail,
  optOutIntent,
  parseInboundEmail,
  parseInboundEmailEvent,
  retrieveInboundEmail,
  setJournalOptOut,
  verifyResendWebhookSignature,
} from "../../lib/email-inbound";
import { suppressEmail, unsuppressEmail } from "../../lib/email/suppression";
import {
  getFamilyEmail,
  retrieveResendRfcMessageIdForSubmission,
  sendAgentComposedEmail,
  submitAgentComposedEmail,
} from "../../lib/map/email";
import { emitMapEvent } from "../../lib/map/events";
import { operationalDiagnostic } from "../../lib/operational-diagnostics";
import { protectOutboundChildFraming } from "../../lib/outbound-child-framing";
import { currentOutboundChildFramingApproval } from "../outbound-child-framing-state";

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

      const receivedEvent = parseInboundEmailEvent(body);
      let email;
      if (receivedEvent) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          // A retry can recover after configuration is restored; silently
          // acknowledging here would permanently lose the parent email.
          return Response.json(
            { ok: false, note: "email retrieval unavailable" },
            { status: 503 },
          );
        }
        try {
          email = await retrieveInboundEmail(receivedEvent.emailId, apiKey);
        } catch (error) {
          console.error(
            "email channel: received-email retrieval failed:",
            error instanceof Error ? error.message : "unknown",
          );
          return Response.json(
            { ok: false, note: "email retrieval failed" },
            { status: 503 },
          );
        }
        if (!email.messageId && receivedEvent.messageId) {
          email.messageId = receivedEvent.messageId;
        }
      } else {
        // Legacy fixture compatibility. Production Resend webhooks use the
        // metadata-only event above.
        email = parseInboundEmail(body);
      }
      if (!email.fromEmail || email.text.length === 0) {
        return Response.json({ ok: true, note: "nothing to process" });
      }

      const signedDeliveryId = parseSignedReplyDeliveryId(
        email.toEmails,
        secret,
      );
      const signedIdentity = signedDeliveryId
        ? await findDeliveryEmailIdentity(
            signedDeliveryId,
            email.fromEmail,
          )
        : null;
      const identity =
        signedIdentity ??
        (await findFamilyIdentityByEmail(email.fromEmail));
      if (
        !signedIdentity &&
        identity &&
        !emailAuthenticationPasses(email.authenticationResults)
      ) {
        // A verified Resend webhook authenticates Resend, not the SMTP
        // sender. Legacy fixed reply addresses require aligned DMARC;
        // new proactive messages use a signed per-delivery alias.
        return Response.json(
          { ok: false, note: "sender authentication failed" },
          { status: 403 },
        );
      }
      const familyId = identity?.familyId ?? null;
      await emitMapEvent("email.message_received", {
        linked_family: familyId !== null,
      });
      if (!familyId) {
        // Unknown sender: never a turn. The reply-to inbox remains the
        // human path for strangers.
        return Response.json({ ok: true, note: "sender not linked" });
      }
      const providerMessageId =
        email.messageId ??
        receivedEvent?.emailId ??
        req.headers.get("svix-id") ??
        req.headers.get("webhook-id");
      if (!providerMessageId) {
        return Response.json(
          { ok: false, note: "email id missing" },
          { status: 400 },
        );
      }
      const inboundReceipt = await claimInboundReceipt({
        familyId,
        channel: "email",
        providerMessageId,
      });
      if (!inboundReceipt.claimed) {
        return Response.json({ ok: true, note: "duplicate ignored" });
      }

      const intent = optOutIntent(email.text);
      if (intent) {
        await setJournalOptOut(familyId, intent === "stop");
        // "stop" also suppresses the drip for this address; "start" lifts
        // it. The drip already honors journal_opt_out_at, but the durable
        // suppression row is the record that survives address changes and
        // matches the unsubscribe link's mechanism (funnel work 2026-07-20).
        if (intent === "stop") {
          await suppressEmail(email.fromEmail, "drip", "stop");
        } else {
          await unsuppressEmail(email.fromEmail, "drip");
        }
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
            undefined,
            familyId,
          );
        }
        await completeInboundReceipt(inboundReceipt.id);
        return Response.json({ ok: true, note: "opt-out handled" });
      }

      // Email is part of Homa Plus (gh#298, tier ruling 2026-07-28). A
      // known family on a web-only plan gets a real reply naming the
      // door and the agent never runs.
      //
      // Placed after the opt-out branch so "stop" still works on any
      // plan: a parent must always be able to turn something off,
      // whatever she pays. Ships dark behind HOMA_CHANNEL_GATE_ENABLED
      // and fails open on any error.
      if (!(await familyHasChannel(familyId))) {
        await emitMapEvent("sms.channel_gated", { channel: "email" }, { familyId });
        const to = await getFamilyEmail(familyId);
        if (to) {
          await sendAgentComposedEmail(
            to,
            "Everything is waiting on the web",
            [CHANNEL_GATE_SMS_LINE],
            undefined,
            familyId,
          );
        }
        await completeInboundReceipt(inboundReceipt.id);
        return Response.json({ ok: true, note: "channel not on plan" });
      }

      const continuationToken = emailContinuationToken(email.fromEmail);
      let continuityAttributes: Record<string, string> = {};
      try {
        const continuity = await resolveInboundContinuity({
          familyId,
          memberUserId: identity?.memberUserId ?? null,
          channel: "email",
          transportThreadKey: continuationToken,
          runtimeSessionId: null,
          providerMessageId,
          providerReplyTo: email.inReplyTo,
          explicitDeliveryId: signedDeliveryId,
          destinationKey: email.fromEmail,
          text: email.text,
        });
        continuityAttributes = resolvedContinuityAttributes(continuity, {
          memberUserId: identity?.memberUserId ?? null,
          providerMessageId,
          providerReplyTo: email.inReplyTo,
        });
      } catch (error) {
        console.error(
          "email channel: continuity resolution failed:",
          error instanceof Error ? error.message : "unknown",
        );
        await failInboundReceipt(inboundReceipt.id, error);
        throw error;
      }
      try {
        const persistedInbound = await persistCanonicalMessage({
          attributes: {
            familyId,
            ...continuityAttributes,
          },
          sessionId: `inbound:${inboundReceipt.id}`,
          channel: "email",
          sequence: 0,
          role: "user",
          content: email.text,
          turnId: inboundReceipt.id,
          providerMessageId,
        });
        if (persistedInbound) {
          Object.assign(
            continuityAttributes,
            canonicalInboundAuthAttributes({
              text: email.text,
              messageId: persistedInbound.id,
            }),
          );
        }
        if (
          continuityAttributes.repliedDeliveryId &&
          !persistedInbound?.replyClaimed
        ) {
          await completeInboundReceipt(inboundReceipt.id);
          return Response.json({
            ok: true,
            note: "reply already handled",
          });
        }
      } catch (error) {
        await failInboundReceipt(inboundReceipt.id, error);
        throw error;
      }

      let startedSession;
      try {
        startedSession = await send(email.text, {
          auth: {
            authenticator: "resend-email",
            principalId: `email:${email.fromEmail}`,
            principalType: "user",
            // memberName rides only when the sender's address is a
            // member's own sign-in email (auth context, never model input).
            attributes: {
              channel: "email",
              familyId,
              email: email.fromEmail,
              inboundReceiptId: inboundReceipt.id,
              ...continuityAttributes,
              ...(identity?.memberDisplayName
                ? { memberName: identity.memberDisplayName }
                : {}),
            },
          },
          continuationToken,
          state: {
            toEmail: email.fromEmail,
            subject: email.subject || null,
            familyId,
          },
          title: `Email conversation ${email.fromEmail}`,
        });
      } catch (error) {
        await failInboundReceipt(inboundReceipt.id, error);
        throw error;
      }
      try {
        await setInboundReceiptSession(
          inboundReceipt.id,
          startedSession.id,
        );
      } catch (error) {
        console.error(
          "email channel: receipt session link failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
      return Response.json({ ok: true, sessionId: startedSession.id });
    }),
  ],

  events: {
    "session.failed"(eventData) {
      console.error("email channel session failed:", JSON.stringify(eventData).slice(0, 400));
    },
    async "message.completed"(eventData, channel, ctx) {
      // Interim narration before tool calls also lands here; only the
      // terminal reply goes back to the parent's inbox.
      const data = eventData as {
        message?: string | null;
        finishReason?: string;
        sequence: number;
        turnId?: string;
      };
      if (data.finishReason !== "stop" || !data.message?.trim()) return;
      const composedText = data.message.trim();
      const to = channel.state.toEmail;
      const familyId = channel.state.familyId;
      const attributes = (ctx.session.auth.current?.attributes ?? {}) as {
        acceptedOfferDeliveryId?: string;
        memberUserId?: string;
        inboundReceiptId?: string;
      };
      if (!to || !familyId) {
        throw new Error(
          operationalDiagnostic(
            "email_channel",
            "canonical_persist",
            "retry_pending",
          ),
        );
      }
      const messageText = protectOutboundChildFraming({
        text: composedText,
        approvedText: currentOutboundChildFramingApproval(),
        channel: "email",
      }).text;
      const persisted = await persistCanonicalMessage({
        attributes: ctx.session.auth.current?.attributes,
        sessionId: ctx.session.id,
        channel: "email",
        sequence: data.sequence,
        role: "assistant",
        content: messageText,
        turnId: data.turnId,
      });
      if (!persisted) {
        throw new Error(
          operationalDiagnostic(
            "email_channel",
            "canonical_persist",
            "retry_pending",
          ),
        );
      }
      const genericContract = replyContractForReactiveMessage(
        messageText,
      );
      const acceptedOfferDeliveryId =
        acceptedOfferDeliveryIdFromAttributes(attributes);
      const openLoopAfterOutcome = async (
        attempt: Awaited<ReturnType<typeof beginDeliveryAttempt>>,
        deliveryOutcome: "sent" | "uncertain" | "failed",
      ) => {
        const progress =
          data.turnId
            ? await bindDeliveredProgressCheckIn({
                attempt,
                deliveryOutcome,
                runtimeSessionId: ctx.session.id,
                turnId: data.turnId,
                deliveredContent: messageText,
              })
            : { status: "no_unique_prompt" as const };
        if (
          progress.status !== "bound" &&
          progress.status !== "delivery_paused" &&
          deliveryOutcome !== "failed" &&
          genericContract
        ) {
          await openReplyLoop({
            attempt,
            contract: genericContract,
          });
        }
      };

      try {
        await deliverReactiveEmailWithRetry({
          beginAttempt: async () =>
            await beginDeliveryAttempt({
              familyId,
              episodeId: persisted.episodeId,
              messageId: persisted.id,
              taskRunId: null,
              memberUserId: attributes.memberUserId ?? null,
              channel: "email",
              destination: to,
              providerThreadKey: `email:${to.toLowerCase()}`,
            }),
          sendEmail: async (attempt) => {
            if (
              acceptedOfferDeliveryId &&
              !(await acceptedOfferDestinationStillCurrent({
                familyId,
                sourceDeliveryId: acceptedOfferDeliveryId,
                expectedRecipientMemberUserId:
                  attributes.memberUserId ?? null,
                channel: "email",
                destination: to,
              }))
            ) {
              return { status: "rejected" };
            }
            const replySecret = process.env.RESEND_INBOUND_SECRET;
            return await submitAgentComposedEmail(
              to,
              replySubject(channel.state.subject),
              messageText
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.length > 0),
              replySecret
                ? buildSignedReplyAddress(attempt.id, replySecret)
                : undefined,
            );
          },
          finishAttempt: finishDeliveryAttempt,
          enrichProviderMessageId:
            enrichDeliveryAttemptProviderMessageId,
          retrieveProviderMessageId:
            retrieveResendRfcMessageIdForSubmission,
          finalizeOutcome: async (attempt, deliveryOutcome) => {
            if (deliveryOutcome === "sent") {
              await markCanonicalMessageDelivered({
                familyId,
                messageId: persisted.id,
              });
            }
            await openLoopAfterOutcome(attempt, deliveryOutcome);
          },
          completeInboundReceipt: async () => {
            if (attributes.inboundReceiptId) {
              await completeInboundReceipt(attributes.inboundReceiptId);
            }
          },
        });
      } catch (error) {
        if (attributes.inboundReceiptId) {
          await failInboundReceipt(
            attributes.inboundReceiptId,
            new Error(
              operationalDiagnostic(
                "email_channel",
                "reactive_email_postprocess",
                "retry_pending",
              ),
            ),
          );
        }
        throw error;
      }
    },
  },
});
