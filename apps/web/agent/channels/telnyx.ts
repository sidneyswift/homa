import { createMemoryState } from "@chat-adapter/state-memory";
import { createTelnyxAdapter } from "@telnyx/chat-sdk-adapter";
import { chatSdkChannel } from "eve/channels/chat-sdk";
import type { UserContent } from "ai";
import type { Message, Thread } from "chat";

import { normalizeUsPhoneE164 } from "@homa/core";

import { findFamilyIdByPhone } from "../../lib/family-phone";
import { emitMapEvent } from "../../lib/map/events";

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

// Param types come from the npm "chat" package (the adapter's peer); the
// vendored copy inside eve is structurally identical, so the handler
// assigns cleanly to bot.onDirectMessage.
// Every SMS thread is a DM (one Homa number, one parent number), so the
// Chat SDK routes each inbound text here exactly once.
const handleInboundSms = async (thread: Thread, message: Message) => {
  if (!smsEnabled()) return;

  const text = message.text?.trim() ?? "";
  const attachments = message.attachments ?? [];
  const images = attachments.filter(
    (attachment) => attachment.type === "image" && attachment.url,
  );
  if (text.length === 0 && images.length === 0) return;

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

  // MMS photos ride along as image parts; Telnyx media URLs are short
  // lived, which is fine because the model reads them within the turn.
  const parts: UserContent = [
    ...(text.length > 0 ? [{ type: "text" as const, text }] : []),
    ...images.map((attachment) => ({
      type: "image" as const,
      image: new URL(attachment.url as string),
    })),
  ];

  await send(
    { message: images.length > 0 ? parts : text },
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
