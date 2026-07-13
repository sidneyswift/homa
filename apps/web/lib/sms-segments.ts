/**
 * Carrier segment math for outbound SMS, per GSM 03.38 as Telnyx
 * implements it (developers.telnyx.com/docs/messaging/messages/message-encoding).
 *
 * Why this exists: one emoji anywhere in a text switches the WHOLE
 * message from GSM-7 (160 chars per segment, 153 when multi-part) to
 * UCS-2 (70, then 67 per segment), and Telnyx hard-rejects anything
 * over 10 segments with HTTP 400 error 40302. That combination is what
 * silently killed the 2026-07-13 morning-brief texts: an emoji-led
 * 755-character brief is 12 segments, not the 5 its author expected.
 *
 * Used by the send transport (preflight) and by copy producers whose
 * output must fit one deliverable SMS (the morning research brief).
 */

/** Telnyx rejects messages that would exceed this many segments. */
export const MAX_SMS_SEGMENTS = 10;

const GSM7_SINGLE_SEGMENT_CHARS = 160;
const GSM7_MULTIPART_SEGMENT_CHARS = 153;
const UCS2_SINGLE_SEGMENT_UNITS = 70;
const UCS2_MULTIPART_SEGMENT_UNITS = 67;

/** GSM 03.38 basic character set (each costs one septet). */
const GSM7_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);

/** GSM 03.38 extension set (each costs two septets: ESC + char). */
const GSM7_EXTENSION = new Set("\f^{}\\[~]|€");

function gsm7Septets(text: string): number | null {
  let septets = 0;
  for (const char of text) {
    if (GSM7_BASIC.has(char)) septets += 1;
    else if (GSM7_EXTENSION.has(char)) septets += 2;
    else return null;
  }
  return septets;
}

/**
 * smsSegmentCount(text): how many segments carriers bill and reassemble
 * for one SMS body. Empty text is 0 segments (Telnyx rejects it anyway).
 */
export function smsSegmentCount(text: string): number {
  if (text.length === 0) return 0;
  const septets = gsm7Septets(text);
  if (septets !== null) {
    return septets <= GSM7_SINGLE_SEGMENT_CHARS
      ? 1
      : Math.ceil(septets / GSM7_MULTIPART_SEGMENT_CHARS);
  }
  // Any non-GSM-7 character forces UCS-2; the payload is UTF-16 code
  // units, which is exactly JavaScript string length.
  return text.length <= UCS2_SINGLE_SEGMENT_UNITS
    ? 1
    : Math.ceil(text.length / UCS2_MULTIPART_SEGMENT_UNITS);
}

/** True when the text can leave as one deliverable (possibly multi-segment) SMS. */
export function fitsInOneSms(text: string): boolean {
  return smsSegmentCount(text) <= MAX_SMS_SEGMENTS;
}
