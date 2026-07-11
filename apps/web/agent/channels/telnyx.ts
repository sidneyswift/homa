import { createMemoryState } from "@chat-adapter/state-memory";
import { createTelnyxAdapter } from "@telnyx/chat-sdk-adapter";
import { chatSdkChannel } from "eve/channels/chat-sdk";
import type { UserContent } from "ai";
import type { Message, Thread } from "chat";

import { normalizeUsPhoneE164 } from "@homa/core";

import { findFamilyIdByPhone } from "../../lib/family-phone";
import { emitMapEvent } from "../../lib/map/events";
import { recordLeadContact } from "../../lib/phone-leads";
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

const telnyx = createTelnyxAdapter({
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
  // thread id, one session per phone-number pair), so a cold lambda
  // losing memory state cannot lose conversation state.
  state: createMemoryState(),
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
  // match (parent-written, unique across families) resolves the family.
  const senderNumber = message.author.userId;
  const normalizedSender = normalizeUsPhoneE164(senderNumber);
  let familyId: string | null = null;
  if (normalizedSender) {
    try {
      familyId = await findFamilyIdByPhone(normalizedSender);
    } catch (error) {
      // Fail closed to an unlinked session; never drop the text.
      console.error(
        "telnyx channel: phone lookup failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  // Best-effort analytics (law #3). No phone number, no content in props.
  await emitMapEvent("sms.message_received", {
    media_count: attachments.length,
    linked_family: familyId !== null,
  });

  // A stranger texting IS a lead (lead-funnel-plan LF-2): save the
  // number before anything else can fail. Fire-and-forget by design.
  if (!familyId && normalizedSender) {
    recordLeadContact(normalizedSender, "sms").catch((error: unknown) => {
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
    await sendHomaSms(normalizedSender ?? senderNumber, ATTACHMENTS_FAILED_REPLY);
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

  await send(
    { message: normalized.mediaParts.length > 0 ? parts : turnText },
    {
      thread,
      title: `SMS conversation ${senderNumber}`,
      auth: {
        authenticator: "telnyx-sms",
        principalId: `sms:${senderNumber}`,
        principalType: "user",
        // familyId comes from the phone mapping above (auth context,
        // never model input). supabaseAccessToken stays absent on SMS,
        // so token-backed tools refuse until M1-02 lands.
        attributes: {
          channel: "sms",
          phoneNumber: senderNumber,
          ...(familyId ? { familyId } : {}),
        },
      },
    },
  );
};

bot.onDirectMessage(handleInboundSms);

export default channel;
