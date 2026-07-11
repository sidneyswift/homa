import { HOMA_CONTACT_PHOTO_B64 } from "./contact-card-photo";
import { siteUrl } from "./map/email";
import { sendHomaSms } from "./voice/telnyx-api";

/**
 * Homa's contact card (founder ask 2026-07-10): a vCard texted as MMS
 * media so a parent can save Homa (name, photo, email, site, socials)
 * to her phone in one tap. Telnyx's MMS file allowlist explicitly
 * includes text/vcard (build-log 2026-07-10 mid-morning), and iOS
 * renders the attachment as a tappable contact bubble.
 *
 * Two product moments send it: a brand-new number's first inbound text
 * (agent/channels/telnyx.ts) and the link-notification text when a
 * number is connected to a family on the web (lib/family-phone.ts).
 */

/** Homa's texting line; TELNYX_FROM_NUMBER is authoritative when set.
 *  Also printed inside the thank-you card (lib/cards/message.ts). */
export const HOMA_NUMBER_FALLBACK = "+13467588011";

/** The one line that rides with the card on a new number's first text. */
export const CONTACT_CARD_FIRST_TEXT =
  "It's Homa. Here's my contact card so you can save me to your phone.";

/**
 * vCard 3.0 requires CRLF line endings and folding at 75 octets, with
 * continuation lines starting with one space. Get folding wrong and
 * phones silently drop the photo. Every value here is ASCII, so
 * characters equal octets and a plain slice is safe.
 */
function foldVcardLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) {
    chunks.push(` ${line.slice(i, i + 74)}`);
  }
  return chunks.join("\r\n");
}

/**
 * buildHomaVcard(): string
 * The exact vCard bytes served at /homa.vcf. The homepage URL stays the
 * production domain on purpose (the card is Homa's identity, never a
 * preview deployment's). X-SOCIALPROFILE is an Apple extension: iPhones
 * show the TikTok and Instagram rows, Android keeps the rest.
 */
export function buildHomaVcard(): string {
  const phone = process.env.TELNYX_FROM_NUMBER ?? HOMA_NUMBER_FALLBACK;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:;Homa;;;",
    "FN:Homa",
    `TEL;TYPE=CELL:${phone}`,
    "EMAIL;TYPE=INTERNET;TYPE=HOME:hello@thankshoma.com",
    "URL:https://thankshoma.com",
    "X-SOCIALPROFILE;TYPE=tiktok;x-user=thankshoma:https://www.tiktok.com/@thankshoma",
    "X-SOCIALPROFILE;TYPE=instagram;x-user=thankshoma:https://www.instagram.com/thankshoma",
    `PHOTO;ENCODING=b;TYPE=PNG:${HOMA_CONTACT_PHOTO_B64}`,
    "END:VCARD",
  ];
  return `${lines.map(foldVcardLine).join("\r\n")}\r\n`;
}

/** The public URL Telnyx fetches the card from (app/homa.vcf/route.ts). */
export function homaVcardUrl(): string {
  return `${siteUrl()}/homa.vcf`;
}

/**
 * sendHomaContactCard(toE164, text): Promise<boolean>
 * Texts the card as MMS media. Returns false (never throws) when the
 * channel is dark or the send fails, same contract as sendHomaSms, so
 * callers stay fire-and-forget safe.
 */
export async function sendHomaContactCard(
  toE164: string,
  text: string,
): Promise<boolean> {
  return sendHomaSms(toE164, text, [homaVcardUrl()]);
}
