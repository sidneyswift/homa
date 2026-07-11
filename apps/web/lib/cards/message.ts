import { HOMA_NUMBER_FALLBACK } from "../contact-card";

/**
 * The words the pen writes (plans/2026-07-11-thank-you-cards.md).
 * Revision 3, founder-directed (2026-07-11 4:43pm): the co-founders'
 * "We" version, signed Alessa & Carolyng with no title and the domain
 * as the final line (founder ruling, verbatim signature). Reader gate
 * ran on the founder's draft; editor gate passed this exact text with
 * zero must-fixes and one accepted craft fix ("ours" to "our own",
 * two signers means two households). The exact text sent is also
 * snapshotted onto the thank_you_cards row.
 *
 * Why each sentence is what it is (gate findings, all rounds):
 * - The address explanation lives in sentence ONE: the "how do they
 *   know where we live" worry fires at the logo and hums under every
 *   tender line until answered.
 * - The warmth is testimony, not fake familiarity: "We see it: we
 *   homeschool our own kids" turns the "most people won't see" claim
 *   from greeting-card talk into two named women speaking from
 *   experience. Fake-personal lines read as horoscope-generic.
 * - "your family's whole education" is family-size-neutral: the
 *   template cannot know kids vs kid, and a wrong plural in real ink
 *   is where the hand stops feeling like a hand.
 * - "when you signed up", never app language, inside handwriting.
 * - The texting number is printed because the card lives on a fridge
 *   and must be actionable from the kitchen.
 * - Homa is named, then "she": one consistent pronoun (the reader
 *   tripped on "her magic ... it's helped" in the founder draft).
 * - Gratitude stays sized to "trying Homa"; "want a hand" is the
 *   surface's one metaphor; contractions on purpose.
 * - thankshoma.com under the names is a founder ruling (2026-07-11);
 *   the reader gate's domain-misparse note is consciously overridden.
 *
 * Physical constraints: the custom card holds 500 characters; this
 * body stays near 395 with a long first name. The wishes zone caps at
 * 50 characters; the signature block is 40.
 */

/** "(346) 758-8011" from the E.164 env value, so the printed card and
 *  the vCard (lib/contact-card.ts) always name the same line. */
function homaTextingNumberPretty(): string {
  const e164 = process.env.TELNYX_FROM_NUMBER ?? HOMA_NUMBER_FALLBACK;
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164;
}

/**
 * thankYouCardMessage(firstName): string
 * The body the robot writes inside the card. Warm, short, no ask.
 */
export function thankYouCardMessage(firstName: string): string {
  return [
    `Hi ${firstName},`,
    "",
    "Thank you for trying Homa, and for sharing this address when you signed up.",
    "",
    "You took on your family's whole education. Most people won't see how much love that takes. We see it: we homeschool our own kids. We built Homa so you never have to do it alone.",
    "",
    `Whenever you want a hand, text Homa: ${homaTextingNumberPretty()}. We hope she helps your family as much as she's helped our own.`,
  ].join("\n");
}

/** The closing lines, written below the message in the same hand
 *  (founder-dictated verbatim; fits the 50-character wishes zone). */
export const THANK_YOU_CARD_WISHES = "Warmly,\nAlessa & Carolyng\nthankshoma.com";
