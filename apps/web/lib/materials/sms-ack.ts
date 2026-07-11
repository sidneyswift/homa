import { rateLimited } from "../map/ratelimit";
import { sendHomaSms } from "../voice/telnyx-api";

/**
 * The wait softener for slow material builds over SMS. A material turn
 * (image generation + render + review) runs 60 to 90 seconds, and the
 * chat-sdk bridge cannot post agent text before tool calls finish, so
 * without this the parent stares at dead air (the 2026-07-10 transcript:
 * 84 silent seconds after "Idk you pick"). The first slow tool of a
 * build texts one heads-up; the per-family window keeps a
 * multi-image turn or a quick revision loop from stacking acks.
 *
 * Not an agent reply: the one-reply-per-inbound-text law governs the
 * model's own messages, and this rides the same tool-send lane as the
 * MMS delivery itself.
 */

const ACK_WINDOW_MS = 3 * 60 * 1000;
const ACK_TEXT = "On it, making that now. It should land here in a minute or two.";

/** Fire-and-forget: an ack must never delay or break the build. */
export function sendMaterialsAckOnce(familyId: string, phoneNumber: string): void {
  if (rateLimited(`materials-ack:${familyId}`, 1, ACK_WINDOW_MS)) return;
  void sendHomaSms(phoneNumber, ACK_TEXT).catch((error: unknown) => {
    console.error(
      "materials ack send failed:",
      error instanceof Error ? error.message : "unknown",
    );
  });
}
