import { HOMA_NUMBER_FALLBACK } from "../contact-card";

/**
 * The words the pen writes (plans/2026-07-11-thank-you-cards.md).
 * Revision 2, founder direction "make it heartfelt" (2026-07-11 1:40am);
 * passed both copy gates same night, reader then editor. The exact text
 * sent is also snapshotted onto the thank_you_cards row.
 *
 * Why each sentence is what it is (gate findings, both rounds):
 * - The address explanation lives in sentence ONE. The "how do they
 *   know where we live" worry fires the moment she sees who sent the
 *   card, and the tender middle cannot land while it hums unanswered.
 * - The warmth states facts true of every homeschool parent (what she
 *   took on, the founder's why). A fake-personal line ("you show up
 *   every day") read as horoscope-generic; real per-family detail is
 *   off the table because child data never goes to the mail vendor.
 * - "took on your family's whole education" is family-size-neutral on
 *   purpose: the template cannot know kids vs kid, and a wrong plural
 *   in real ink is where the hand stops feeling like a hand.
 * - "when you signed up", never "set up your family": app language
 *   inside handwriting breaks the spell.
 * - The texting number is printed because the card lives on a fridge
 *   and the Homa thread lives in a week-old phone notification: the
 *   card must be actionable from the kitchen.
 * - Gratitude stays sized to "trying Homa" (bigger claims read as
 *   guilt in week one); "want a hand" is the surface's one metaphor;
 *   contractions on purpose (uncontracted phrasing reads as a copied
 *   script); the signature says who Sidney is.
 *
 * Physical constraint: Handwrytten's standard card holds roughly 400
 * characters at default size; this stays near 300 with a long first name.
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
    "You took on your family's whole education. Most people won't see how much love that takes. I built Homa so you never have to do it alone.",
    "",
    `Whenever you want a hand, text Homa: ${homaTextingNumberPretty()}.`,
  ].join("\n");
}

/** The closing line, written below the message in the same hand. */
export const THANK_YOU_CARD_WISHES = "Warmly,\nSidney, founder of Homa";
