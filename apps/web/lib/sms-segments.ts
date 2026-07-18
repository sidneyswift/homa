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

/**
 * Hard ceiling on how many separate messages one logical text may become.
 * Three messages is thirty segments; anything larger is a producer bug,
 * not a delivery problem, and still gets refused.
 */
export const MAX_SMS_PARTS = 3;

/** Meaning-preserving stand-ins for characters that force UCS-2 or are
 * absent from GSM 03.38. Punctuation only; letters go through NFKD. */
const GSM7_TRANSLITERATIONS = new Map<string, string>([
  ["\u2018", "'"], // left single quote
  ["\u2019", "'"], // right single quote, the classic UCS-2 trigger
  ["\u201A", "'"],
  ["\u201B", "'"],
  ["\u2032", "'"], // prime
  ["\u2039", "'"],
  ["\u203A", "'"],
  ["\u201C", '"'], // left double quote
  ["\u201D", '"'], // right double quote
  ["\u201E", '"'],
  ["\u2033", '"'], // double prime
  ["\u00AB", '"'],
  ["\u00BB", '"'],
  ["\u2010", "-"], // hyphen
  ["\u2011", "-"], // non-breaking hyphen
  ["\u2012", "-"],
  ["\u2013", "-"], // en dash
  ["\u2014", "-"], // em dash
  ["\u2015", "-"],
  ["\u2212", "-"], // minus sign
  ["\u2022", "-"], // bullet
  ["\u00B7", "-"], // middle dot, Homa's brand separator
  ["\u2026", "..."], // ellipsis
  ["\u00A0", " "], // no-break space
  ["\u2002", " "],
  ["\u2003", " "],
  ["\u2009", " "], // thin space
  ["\u200A", " "],
  ["\u200B", ""], // zero-width space
  ["\u200D", ""], // zero-width joiner, emoji glue
  ["\uFE0F", ""], // emoji variation selector
  ["\uFEFF", ""],
  ["\u2192", "->"],
  ["\u2190", "<-"],
]);

/**
 * Rewrites text into the GSM 03.38 repertoire: smart punctuation becomes
 * its plain equivalent, accented letters lose marks GSM cannot carry
 * (NFKD keeps the base letter), and anything else (emoji, symbols) is
 * dropped. One stray curly quote or emoji otherwise doubles the whole
 * message's segment count, which is exactly the 2026-07-13 failure.
 */
export function gsm7Transliterate(text: string): string {
  let out = "";
  for (const char of text) {
    if (GSM7_BASIC.has(char) || GSM7_EXTENSION.has(char)) {
      out += char;
      continue;
    }
    const mapped = GSM7_TRANSLITERATIONS.get(char);
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    for (const piece of char.normalize("NFKD").replace(/\p{M}/gu, "")) {
      if (GSM7_BASIC.has(piece) || GSM7_EXTENSION.has(piece)) out += piece;
    }
  }
  return out
    .replace(/[ \t]{2,}/gu, " ")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n[ \t]+/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

/** Largest prefix of one unbreakable token that still fits, repeatedly. */
function hardSlice(text: string, maxSegments: number): string[] {
  const parts: string[] = [];
  let rest = text;
  while (smsSegmentCount(rest) > maxSegments) {
    let end = Math.min(
      rest.length,
      maxSegments * GSM7_MULTIPART_SEGMENT_CHARS,
    );
    while (end > 1 && smsSegmentCount(rest.slice(0, end)) > maxSegments) {
      end -= 1;
    }
    parts.push(rest.slice(0, end));
    rest = rest.slice(end);
  }
  if (rest.length > 0) parts.push(rest);
  return parts;
}

/**
 * Greedy word-boundary split into pieces that each fit the carrier cap.
 * Whitespace at a boundary is consumed by the split, so no part starts
 * or ends mid-word or with dangling spaces.
 */
export function splitForSms(
  text: string,
  maxSegments = MAX_SMS_SEGMENTS,
): string[] {
  const parts: string[] = [];
  let current = "";
  for (const token of text.split(/(\s+)/u)) {
    if (token.length === 0) continue;
    const candidate = current + token;
    if (
      current.length > 0 &&
      smsSegmentCount(candidate.trimEnd()) > maxSegments
    ) {
      if (current.trimEnd().length > 0) parts.push(current.trimEnd());
      current = token.trimStart();
    } else {
      current = candidate;
    }
  }
  if (current.trimEnd().length > 0) parts.push(current.trimEnd());
  return parts.flatMap((part) =>
    smsSegmentCount(part) > maxSegments ? hardSlice(part, maxSegments) : [part],
  );
}

export type SmsPartsPlan =
  | { ok: true; parts: string[] }
  | { ok: false; reason: string };

/**
 * Turns one logical text into deliverable SMS bodies instead of refusing
 * it: send as-is when it fits, else transliterate to GSM-7 (a single
 * non-GSM character was what pushed the 2026-07-13 brief past the cap),
 * else split into at most MAX_SMS_PARTS messages. Texts that still
 * cannot fit are refused with the founder-digest reason. Messages that
 * already fit are never rewritten.
 */
export function planSmsParts(text: string): SmsPartsPlan {
  if (fitsInOneSms(text)) return { ok: true, parts: [text] };
  const transliterated = gsm7Transliterate(text);
  const usable = transliterated.length > 0 ? transliterated : text;
  if (fitsInOneSms(usable)) return { ok: true, parts: [usable] };
  if (smsSegmentCount(usable) <= MAX_SMS_SEGMENTS * MAX_SMS_PARTS) {
    const parts = splitForSms(usable);
    if (
      parts.length <= MAX_SMS_PARTS &&
      parts.every((part) => fitsInOneSms(part))
    ) {
      return { ok: true, parts };
    }
  }
  return {
    ok: false,
    reason: `SMS over the carrier size limit (${smsSegmentCount(text)} segments, max ${MAX_SMS_SEGMENTS} per message, ${MAX_SMS_PARTS} messages)`,
  };
}
