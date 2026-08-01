import { createMemoryState } from "@chat-adapter/state-memory";
import { TelnyxAdapter } from "@telnyx/chat-sdk-adapter";
import { chatSdkChannel } from "eve/channels/chat-sdk";
import type { UserContent } from "ai";
import type { Message, Thread } from "chat";

import { normalizeUsPhoneE164 } from "@homa/core";

import {
  CONTACT_CARD_FIRST_TEXT,
  sendHomaContactCard,
} from "../../lib/contact-card";
import {
  resolveActiveSmsProgressContext,
  type ActiveSmsProgressContext,
} from "../../lib/child-progress/active-sms-progress-context";
import { bindDeliveredProgressCheckIn } from "../../lib/child-progress/delivery-binding.server";
import {
  claimInboundReceipt,
  completeInboundReceipt,
  completeInboundReceiptForTurn,
  failInboundReceipt,
  setInboundReceiptSession,
  setInboundReceiptTurn,
} from "../../lib/conversation-continuity/inbound-receipts";
import {
  markCanonicalMessageDelivered,
  persistCanonicalMessage,
  resolveInboundContinuity,
  resolvedContinuityAttributes,
} from "../../lib/conversation-continuity/ledger";
import {
  beginDeliveryAttempt,
  finishDeliveryAttempt,
  openReplyLoop,
} from "../../lib/conversation-continuity/delivery-ledger";
import { replyContractForReactiveMessage } from "../../lib/conversation-continuity/delivery-policy";
import { canonicalInboundAuthAttributes } from "../../lib/conversation-continuity/canonical-inbound";
import {
  findFamilyIdentityByPhone,
  findPhoneAccessEpoch,
} from "../../lib/family-phone";
import {
  findFamilySmsInviterConfirmationContext,
  type FamilySmsInviterConfirmationContext,
} from "../../lib/family-sms-invite-confirmation";
import {
  findFamilySmsInviteChannelContext,
  type FamilySmsInviteChannelContext,
} from "../../lib/family-sms-invites";
import {
  classifyFamilySmsInviteConsent,
  classifyFamilySmsInviteParentConfirmation,
} from "../../lib/family-sms-invite-consent";
import { emitMapEvent } from "../../lib/map/events";
import { recordLeadContact } from "../../lib/phone-leads";
import {
  classifySmsOptKeyword,
  suppressSmsNumber,
  unsuppressSmsNumber,
} from "../../lib/sms-suppression";
import { signupProgress } from "../../lib/sms-onboarding";
import { trustedSmsInboundIdentityAttributes } from "../../lib/sms-inbound-auth";
import {
  CHANNEL_GATE_SMS_LINE,
  familyHasChannel,
} from "../../lib/billing/channel-access";
import {
  buildSmsSessionThreadId,
  smsSessionDayKey,
  stripSmsSessionEpoch,
} from "../../lib/sms-session-epoch";
import { effectiveTimeZone } from "../../lib/time-zone";
import { normalizeSmsAttachments } from "../../lib/voice/sms-attachments";
import { sendHomaSms } from "../../lib/voice/telnyx-api";

/**
 * SMS channel (M5-01 groundwork, pulled forward as a founder experiment,
 * build-log 2026-07-07). Inbound texts to Homa's Telnyx number route into
 * the SAME eve agent as web chat, via Telnyx's official Vercel Chat SDK
 * adapter bridged by eve's chatSdkChannel. The webhook mounts at
 * /eve/v1/chat/telnyx (proxy.ts already skips /eve paths).
 *
 * Dark by default. The channel processes nothing unless ALL of these are
 * set: TELNYX_SMS_ENABLED=true, TELNYX_API_KEY, TELNYX_FROM_NUMBER, and
 * TELNYX_PUBLIC_KEY (Ed25519 webhook signature verification; requiring it
 * here means an unverified deployment can never be fed forged webhooks).
 *
 * Tenancy (BUILD.md law #1): the sender's number is the auth context.
 * When it matches a family_phones row (written only by that family's
 * signed-in parent), the session is stamped with that familyId and the
 * family-context instruction loads their context through family-pinned
 * server reads. No supabaseAccessToken exists on SMS, so token-backed
 * tools still refuse; that unlock is the M1-02 SET LOCAL work. Unknown
 * numbers chat as unlinked general sessions.
 *
 * Media (founder ruling 2026-07-10: never deny input): every attachment
 * runs through the normalizer (lib/voice/sms-attachments.ts), which
 * converts each one into something the model natively consumes: photos
 * and PDFs pass through as parts, voice notes and video clips arrive as
 * speech transcripts, text-format files inline, and anything unreadable
 * becomes a bracketed note the agent can acknowledge. A text whose
 * attachments ALL failed gets a direct "couldn't read it" reply instead
 * of an agent turn.
 */

/** Placeholder that keeps the adapter constructible when env is unset. */
const FALLBACK_FROM_NUMBER = "+10000000000";

function smsEnabled(): boolean {
  return (
    process.env.TELNYX_SMS_ENABLED === "true" &&
    Boolean(process.env.TELNYX_API_KEY) &&
    Boolean(process.env.TELNYX_FROM_NUMBER) &&
    Boolean(process.env.TELNYX_PUBLIC_KEY)
  );
}

/**
 * Eve's continuation token carries an access-epoch suffix, while Telnyx
 * accepts only its original phone-pair thread format. Every adapter path
 * decodes through this override before it reaches the provider.
 */
class HomaTelnyxAdapter extends TelnyxAdapter {
  override decodeThreadId(threadId: string) {
    return super.decodeThreadId(stripSmsSessionEpoch(threadId));
  }
}

const telnyx = new HomaTelnyxAdapter({
  apiKey: process.env.TELNYX_API_KEY ?? "not-configured",
  phoneNumber: process.env.TELNYX_FROM_NUMBER ?? FALLBACK_FROM_NUMBER,
  publicKey: process.env.TELNYX_PUBLIC_KEY,
  messagingProfileId: process.env.TELNYX_MESSAGING_PROFILE_ID,
  userName: "homa",
});

const { bot, channel, send } = chatSdkChannel({
  userName: "homa",
  adapters: { telnyx },
  // Memory state is deliberate for now: Chat SDK state only carries
  // dedupe/locks here, and eve owns the durable session (keyed by the
  // thread id plus access epoch). A cold lambda losing Chat SDK memory
  // cannot lose conversation state.
  state: createMemoryState(),
  events: {
    // eve's session.auth.current is a single mutable slot (AuthKey), not
    // one per turn: sending a second inbound text on the same long-lived
    // SMS session overwrites it before the first turn's completion event
    // reads it. That silently orphaned real families' replies (confirmed
    // live: two SMS turns claimed and never answered). turn.started fires
    // essentially immediately, well before a follow-up text could arrive,
    // so it is the one safe place left to durably stamp which receipt this
    // turn owns. Overriding this key replaces eve's default typing
    // indicator, so it is replicated here.
    async "turn.started"(event, channel, ctx) {
      await channel.thread?.startTyping("Working...");
      const attributes = (ctx.session.auth.current?.attributes ?? {}) as {
        inboundReceiptId?: string;
      };
      if (attributes.inboundReceiptId) {
        await setInboundReceiptTurn(attributes.inboundReceiptId, event.turnId);
      }
    },
    // Fires exactly once per turn regardless of output, unlike
    // message.completed (once per assistant step, and not at all when the
    // final step has no visible text). Looked up by the durable turn stamp
    // above instead of session.auth.current, so it always resolves the
    // claim even when message.completed below raced onto the wrong
    // receipt. No default handler exists for this key, so this is purely
    // additive.
    async "turn.completed"(event, channel, ctx) {
      await completeInboundReceiptForTurn(ctx.session.id, event.turnId);
    },
    async "message.completed"(event, channel, ctx) {
      if (event.finishReason !== "stop" || !event.message?.trim()) return;
      const attributes = (ctx.session.auth.current?.attributes ?? {}) as {
        familyId?: string;
        memberUserId?: string;
        phoneNumber?: string;
        inboundReceiptId?: string;
      };
      if (attributes.inboundReceiptId) {
        await completeInboundReceipt(attributes.inboundReceiptId);
      }
      if (!channel.thread) return;
      if (!attributes.familyId || !attributes.phoneNumber) {
        try {
          await channel.thread.post(event.message);
          if (attributes.inboundReceiptId) {
            await completeInboundReceipt(attributes.inboundReceiptId);
          }
        } catch (error) {
          if (attributes.inboundReceiptId) {
            await completeInboundReceipt(attributes.inboundReceiptId);
          }
          throw error;
        }
        return;
      }
      const persisted = await persistCanonicalMessage({
        attributes,
        sessionId: ctx.session.id,
        channel: "sms",
        sequence: event.sequence,
        role: "assistant",
        content: event.message,
        turnId: event.turnId,
      });
      if (!persisted) return;
      const attempt = await beginDeliveryAttempt({
        familyId: attributes.familyId,
        episodeId: persisted.episodeId,
        messageId: persisted.id,
        taskRunId: null,
        memberUserId: attributes.memberUserId ?? null,
        channel: "sms",
        destination: attributes.phoneNumber,
        providerThreadKey: channel.thread.id,
      });
      const genericContract = replyContractForReactiveMessage(
        event.message,
      );
      const openLoopAfterOutcome = async (
        deliveryOutcome: "sent" | "uncertain",
      ) => {
        const progress =
          event.turnId
            ? await bindDeliveredProgressCheckIn({
                attempt,
                deliveryOutcome,
                runtimeSessionId: ctx.session.id,
                turnId: event.turnId,
                deliveredContent: event.message ?? undefined,
              })
            : { status: "no_unique_prompt" as const };
        if (
          progress.status !== "bound" &&
          progress.status !== "delivery_paused" &&
          genericContract
        ) {
          await openReplyLoop({
            attempt,
            contract: genericContract,
          });
        }
      };
      if (!attempt.shouldSend) {
        if (attempt.existingStatus === "sent") {
          await markCanonicalMessageDelivered({
            familyId: attributes.familyId,
            messageId: persisted.id,
          });
          await openLoopAfterOutcome("sent");
        } else if (attempt.existingStatus === "uncertain") {
          await openLoopAfterOutcome("uncertain");
        }
        return;
      }
      try {
        const posted = (await channel.thread.post(event.message)) as {
          id?: string;
        };
        await finishDeliveryAttempt(attempt, {
          delivered: true,
          providerMessageId: posted.id ?? null,
        });
        await markCanonicalMessageDelivered({
          familyId: attributes.familyId,
          messageId: persisted.id,
        });
        await openLoopAfterOutcome("sent");
        if (attributes.inboundReceiptId) {
          await completeInboundReceipt(attributes.inboundReceiptId);
        }
      } catch (error) {
        await finishDeliveryAttempt(attempt, {
          delivered: false,
          error: error instanceof Error ? error.message : "unknown",
          uncertain: true,
        });
        await openLoopAfterOutcome("uncertain");
        if (attributes.inboundReceiptId) {
          await completeInboundReceipt(attributes.inboundReceiptId);
        }
        throw error;
      }
    },
  },
});

/** Sent directly (no agent turn) when EVERY attachment failed and there
 *  was no typed text: silence would read as Homa ignoring her. */
const ATTACHMENTS_FAILED_REPLY =
  "I couldn't quite make out what you sent. Mind trying again, or typing it?";

// Param types come from the npm "chat" package (the adapter's peer); the
// vendored copy inside eve is structurally identical, so the handler
// assigns cleanly to bot.onDirectMessage.
// Every SMS thread is a DM (one Homa number, one parent number), so the
// Chat SDK routes each inbound text here exactly once.
const handleInboundSms = async (thread: Thread, message: Message) => {
  if (!smsEnabled()) return;

  const text = message.text?.trim() ?? "";
  const attachments = message.attachments ?? [];
  if (text.length === 0 && attachments.length === 0) return;

  // The sender's number is this channel's auth context: a family_phones
  // match (parent-written, unique across families) resolves the family,
  // and since multi-parent v0 also WHICH adult carries this number.
  const senderNumber = message.author.userId;
  const normalizedSender = normalizeUsPhoneE164(senderNumber);
  let familyId: string | null = null;
  let familySessionEpoch: string | null = null;
  let familyTimeZone: string | null = null;
  let unlinkedSessionEpoch: string | null = null;
  let memberUserId: string | null = null;
  let memberName: string | null = null;
  let canInviteFamilyMembers = false;
  let smsSignupCandidate = false;
  let familySmsInviteLookupFailed = false;
  let familySmsInviteContext: FamilySmsInviteChannelContext | null = null;
  let familySmsInviterConfirmationLookupFailed = false;
  let familySmsInviterConfirmationContext: FamilySmsInviterConfirmationContext | null =
    null;
  if (normalizedSender) {
    try {
      const identity = await findFamilyIdentityByPhone(normalizedSender);
      familyId = identity?.familyId ?? null;
      familySessionEpoch = identity?.sessionEpoch ?? null;
      familyTimeZone = identity?.timeZone ?? null;
      memberUserId = identity?.memberUserId ?? null;
      memberName = identity?.memberDisplayName ?? null;
      canInviteFamilyMembers = identity?.canInviteFamilyMembers ?? false;
      smsSignupCandidate = identity?.smsSignupCandidate ?? false;
    } catch (error) {
      // Fail closed to an unlinked session; never drop the text.
      console.error(
        "telnyx channel: phone lookup failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
    if (familyId && smsSignupCandidate) {
      try {
        const progress = await signupProgress(familyId);
        smsSignupCandidate = progress.needs.length > 0;
      } catch (error) {
        // Keep the candidate flag true. begin_text_signup will retry the
        // same scoped progress read inside the turn.
        console.error(
          "telnyx channel: SMS signup progress lookup failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
    const parentConfirmation = familyId
      ? classifyFamilySmsInviteParentConfirmation({
          text,
          hasAttachments: attachments.length > 0,
        })
      : null;
    if (familyId && parentConfirmation) {
      try {
        familySmsInviterConfirmationContext =
          await findFamilySmsInviterConfirmationContext({
            familyId,
            inviterPhoneE164: normalizedSender,
            confirmationCode: parentConfirmation.confirmationCode,
            decision: parentConfirmation.decision,
          });
      } catch (error) {
        familySmsInviterConfirmationLookupFailed = true;
        console.error(
          "telnyx channel: inviter confirmation lookup failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
    if (!familyId) {
      try {
        familySmsInviteContext =
          await findFamilySmsInviteChannelContext(normalizedSender);
      } catch (error) {
        familySmsInviteLookupFailed = true;
        // Fail closed. A possible invite recipient must not enter lead
        // capture or text signup while invitation status is unknown.
        console.error(
          "telnyx channel: family invite lookup failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
    if (!familyId && !familySmsInviteContext && !familySmsInviteLookupFailed) {
      try {
        unlinkedSessionEpoch = await findPhoneAccessEpoch(normalizedSender);
      } catch (error) {
        // The additive access-epoch migration must lead this code deploy.
        // Falling back to the generic unlinked key keeps SMS available,
        // but logs loudly so a sequencing mistake is visible.
        console.error(
          "telnyx channel: phone access epoch lookup failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
  }
  const familySmsInviteState = familySmsInviteContext?.state ?? null;
  const familySmsInviteDecision = familySmsInviteContext
    ? classifyFamilySmsInviteConsent({
        text,
        hasAttachments: attachments.length > 0,
      })
    : null;
  const inboundReceipt = await claimInboundReceipt({
    familyId,
    channel: "sms",
    providerMessageId: message.id,
  });
  if (!inboundReceipt.claimed) return;

  // Best-effort analytics (law #3). No phone number, no content in props.
  // The family id rides the COLUMN, never the props, so the props contract
  // is unchanged and still carries nothing identifying. Without it every
  // inbound text was unattributable (231 events, zero countable per family),
  // which made SMS invisible to the activation ladder even though most
  // families text (funnel work 2026-07-20). Null for a stranger, as before.
  await emitMapEvent(
    "sms.message_received",
    {
      media_count: attachments.length,
      linked_family: familyId !== null,
    },
    { familyId },
  );

  // Carrier opt-out keywords are protocol, not conversation: the exact
  // single-word commands Telnyx itself matches before blocking the
  // number at the platform level (40300 on every later send). Recording
  // the same fact in sms_suppressions lets dispatch skip suppressed
  // numbers instead of burning agent runs into guaranteed rejections
  // (morning-brief conversion escalation, 2026-07-23). The agent never
  // runs for these texts: any reply would already be carrier-blocked.
  // START/UNSTOP lifts the row so resuming on the Telnyx side resumes
  // here too.
  if (normalizedSender) {
    const optAction = classifySmsOptKeyword({
      text,
      hasAttachments: attachments.length > 0,
    });
    if (optAction) {
      if (optAction === "stop") {
        await suppressSmsNumber(normalizedSender, "inbound-stop");
      } else {
        await unsuppressSmsNumber(normalizedSender);
      }
      await emitMapEvent(
        "sms.opt_out_recorded",
        { action: optAction, linked_family: familyId !== null },
        { familyId },
      );
      await completeInboundReceipt(inboundReceipt.id);
      return;
    }
  }

  // Texting is part of Homa Plus (gh#298, tier ruling 2026-07-28). A
  // known family on a web-only plan is answered here and the agent
  // never wakes: she gets a real reply naming where the door is, which
  // is the whole point, because a number that used to answer and now
  // says nothing reads as Homa being broken rather than as a plan
  // boundary.
  //
  // Placed after the opt-out block so STOP still wins, and before the
  // lead path so a STRANGER is untouched: familyHasChannel(null) admits,
  // and an unknown number is a lead, not a downgrade. Ships dark behind
  // HOMA_CHANNEL_GATE_ENABLED and fails open on any error.
  if (familyId && !(await familyHasChannel(familyId))) {
    const sent = await sendHomaSms(
      normalizedSender ?? senderNumber,
      CHANNEL_GATE_SMS_LINE,
    );
    await emitMapEvent("sms.channel_gated", { channel: "sms" }, { familyId });
    if (sent) {
      await completeInboundReceipt(inboundReceipt.id);
    } else {
      await failInboundReceipt(
        inboundReceipt.id,
        new Error("channel-gate reply did not send"),
      );
    }
    return;
  }

  // A stranger texting IS a lead (lead-funnel-plan LF-2): save the
  // number before anything else can fail. Fire-and-forget by design.
  // A number's FIRST-ever text also gets Homa's contact card (vCard
  // MMS) alongside the agent's reply, so she can save who's texting.
  if (
    !familyId &&
    !familySmsInviteContext &&
    !familySmsInviteLookupFailed &&
    normalizedSender
  ) {
    const to = normalizedSender;
    recordLeadContact(to, "sms")
      .then(async ({ firstContact }) => {
        if (!firstContact) return;
        const sent = await sendHomaContactCard(to, CONTACT_CARD_FIRST_TEXT);
        await emitMapEvent("sms.contact_card_sent", {
          trigger: "first_text",
          sent,
        });
      })
      .catch((error: unknown) => {
        console.error(
          "phone lead capture (sms) failed:",
          error instanceof Error ? error.message : "unknown",
        );
      });
  }

  // Every attachment gets a lane (never deny input): images and PDFs
  // become parts, speech becomes marked transcript blocks, text files
  // inline, failures become bracketed notes the agent can acknowledge.
  // Linked-family photos also get a caption block so the photo leaves a
  // searchable trace in the durable record (the microwave lesson).
  const normalized = await normalizeSmsAttachments(attachments, { familyId });
  for (const result of normalized.results) {
    await emitMapEvent("sms.attachment_processed", {
      kind: result.kind,
      media_type: result.mediaType,
      outcome: result.outcome,
      linked_family: familyId !== null,
    });
  }

  // A text whose every attachment failed, with no typed words, never
  // wakes the agent (it would have nothing to answer); reply directly.
  if (text.length === 0 && !normalized.hasContent) {
    const sent = await sendHomaSms(
      normalizedSender ?? senderNumber,
      ATTACHMENTS_FAILED_REPLY,
    );
    if (sent) {
      await completeInboundReceipt(inboundReceipt.id);
    } else {
      await failInboundReceipt(
        inboundReceipt.id,
        new Error("attachment-failure reply did not send"),
      );
    }
    return;
  }

  const turnText = [...(text.length > 0 ? [text] : []), ...normalized.blocks].join(
    "\n\n",
  );

  // Image parts ride by their (short lived) Telnyx URL, read within the
  // turn; PDF parts carry downloaded bytes. Text always leads the parts.
  const parts: UserContent = [
    ...(turnText.length > 0 ? [{ type: "text" as const, text: turnText }] : []),
    ...normalized.mediaParts,
  ];
  const accessEpoch = familyId
    ? (familySessionEpoch ?? `family:${familyId}`)
    : (familySmsInviteContext?.sessionEpoch ??
      unlinkedSessionEpoch ??
      (familySmsInviteLookupFailed ? "invite-lookup-unavailable" : "unlinked"));
  const sessionThreadId = buildSmsSessionThreadId(
    thread.id,
    accessEpoch,
    smsSessionDayKey(new Date(), effectiveTimeZone(familyTimeZone)),
  );
  const sessionThread = { ...thread.toJSON(), id: sessionThreadId };
  let continuityAttributes: Record<string, string> = {};
  if (familyId) {
    try {
      const continuity = await resolveInboundContinuity({
        familyId,
        memberUserId,
        channel: "sms",
        transportThreadKey: sessionThreadId,
        runtimeSessionId: null,
        providerMessageId: message.id,
        providerReplyTo: null,
        destinationKey: normalizedSender ?? senderNumber,
        text: turnText,
      });
      continuityAttributes = resolvedContinuityAttributes(continuity, {
        memberUserId,
        providerMessageId: message.id,
      });
    } catch (error) {
      // A linked family's parent message must enter the canonical ledger
      // before Eve can run tools or compose a reply.
      console.error(
        "telnyx channel: continuity resolution failed:",
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
        channel: "sms",
        sequence: 0,
        role: "user",
        content: turnText,
        turnId: inboundReceipt.id,
        providerMessageId: message.id,
      });
      if (persistedInbound) {
        Object.assign(
          continuityAttributes,
          canonicalInboundAuthAttributes({
            text: turnText,
            messageId: persistedInbound.id,
          }),
        );
      }
      if (
        continuityAttributes.repliedDeliveryId &&
        !persistedInbound?.replyClaimed
      ) {
        await completeInboundReceipt(inboundReceipt.id);
        return;
      }
    } catch (error) {
      await failInboundReceipt(inboundReceipt.id, error);
      throw error;
    }
  }

  let activeProgressContext: ActiveSmsProgressContext | null = null;
  if (familyId) {
    try {
      activeProgressContext = await resolveActiveSmsProgressContext({
        familyId,
        memberUserId,
        phoneNumber: senderNumber,
      });
    } catch (error) {
      // Fail closed for progress writes without dropping the parent's text.
      console.error(
        "telnyx channel: active progress lookup failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  let startedSession;
  try {
    startedSession = await send(
      { message: normalized.mediaParts.length > 0 ? parts : turnText },
      {
        thread: sessionThread,
        title: `SMS conversation ${senderNumber}`,
        auth: {
          authenticator: "telnyx-sms",
          principalId: `sms:${senderNumber}`,
          principalType: "user",
          // familyId and memberName come from the phone mapping above
          // (auth context, never model input). supabaseAccessToken stays
          // absent on SMS, so token-backed tools refuse until M1-02 lands.
          attributes: {
            channel: "sms",
            phoneNumber: senderNumber,
            ...trustedSmsInboundIdentityAttributes({
              providerMessageId: message.id,
              inboundReceiptId: inboundReceipt.id,
              activeProgressContext,
            }),
            ...(familyId ? { familyId } : {}),
            ...continuityAttributes,
            ...(memberName ? { memberName } : {}),
            ...(canInviteFamilyMembers
              ? { canInviteFamilyMembers: "true" }
              : {}),
            ...(smsSignupCandidate ? { smsSignupCandidate: "true" } : {}),
            ...(familySmsInviterConfirmationContext
              ? {
                  familySmsInviterConfirmationDecision:
                    familySmsInviterConfirmationContext.decision,
                familySmsInviterConfirmationCodeHash:
                  familySmsInviterConfirmationContext.confirmationCodeHash,
                  familySmsInviterConfirmationId:
                    familySmsInviterConfirmationContext.inviteId,
                }
              : {}),
            ...(familySmsInviterConfirmationLookupFailed
              ? { familySmsInviterConfirmationLookupFailed: "true" }
              : {}),
            ...(familySmsInviteContext
              ? { familySmsInviteId: familySmsInviteContext.inviteId }
              : {}),
            ...(familySmsInviteLookupFailed
              ? { familySmsInviteLookupFailed: "true" }
              : {}),
            ...(familySmsInviteDecision ? { familySmsInviteDecision } : {}),
            ...(familySmsInviteState ? { familySmsInviteState } : {}),
          },
        },
      },
    );
  } catch (error) {
    await failInboundReceipt(inboundReceipt.id, error);
    throw error;
  }
  try {
    await setInboundReceiptSession(inboundReceipt.id, startedSession.id);
  } catch (error) {
    // Eve already accepted the turn. Never make the provider event
    // reclaimable over observability metadata.
    console.error(
      "telnyx channel: receipt session link failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }
};

bot.onDirectMessage(handleInboundSms);

export default channel;
