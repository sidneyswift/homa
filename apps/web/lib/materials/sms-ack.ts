import { rateLimited } from "../map/ratelimit";
import { sendHomaSms } from "../voice/telnyx-api";

/**
 * The wait softener for slow work over SMS. A material turn (image
 * generation + render + review) runs 60 to 90 seconds, and the chat-sdk
 * bridge cannot post agent text before tool calls finish, so without
 * this the parent stares at dead air (the 2026-07-10 transcript: 84
 * silent seconds after "Idk you pick").
 *
 * Two senders share this one lane and its dedupe window:
 *   1. The send_heads_up tool: the agent's own first move on a slow
 *      build, one short line in her voice, sent before designing.
 *   2. The automatic tool-start ack in generate_image and
 *      create_printable: the canned safety net for when the agent
 *      skipped the heads-up.
 * The shared per-family window keeps the two lanes, a multi-image
 * turn, or a quick revision loop from stacking wait texts.
 *
 * Not an agent reply: the one-reply-per-inbound-text law governs the
 * model's own messages, and this rides the same tool-send lane as the
 * MMS delivery itself.
 */

const ACK_WINDOW_MS = 3 * 60 * 1000;
const AUTO_ACK_TEXT = "On it, making that now. It should land here in a minute or two.";

/**
 * Fire-and-forget: a wait text must never delay or break the build.
 * Returns false when the window already carried one (nothing sent).
 * familyId keys the window; unlinked sessions fall back to the number.
 */
export function sendWaitTextOnce(options: {
  familyId: string | null;
  phoneNumber: string;
  text?: string;
}): boolean {
  const key = `materials-ack:${options.familyId ?? options.phoneNumber}`;
  if (rateLimited(key, 1, ACK_WINDOW_MS)) return false;
  void sendHomaSms(options.phoneNumber, options.text ?? AUTO_ACK_TEXT).catch(
    (error: unknown) => {
      console.error(
        "wait text send failed:",
        error instanceof Error ? error.message : "unknown",
      );
    },
  );
  return true;
}
