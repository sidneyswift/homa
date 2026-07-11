/**
 * The words the pen writes (plans/2026-07-11-thank-you-cards.md).
 * Passed both copy gates 2026-07-11 (homa-copy-reviewer, then
 * homa-copy-editor); the exact text sent is also snapshotted onto the
 * thank_you_cards row.
 *
 * Why each sentence is what it is (gate findings): the gratitude stays
 * small ("for trying") because week-one moms feel guilt at bigger
 * claims; one reassurance sentence, concrete and adjective-light; the
 * address sentence answers the "how do they know where we live" flinch
 * before it forms; "Homa is one text away" names the product plainly so
 * the card never overpromises a person; "want a hand" is the surface's
 * single metaphor; the signature says who Sidney is, because an
 * unidentified first name is where trust wobbled. Contractions on
 * purpose: uncontracted phrasing reads as a copied script and makes
 * readers re-check whether the ink is real.
 *
 * Physical constraint: Handwrytten's standard card holds roughly 400
 * characters at default size; this stays near 240 with a long first name.
 */

/**
 * thankYouCardMessage(firstName): string
 * The body the robot writes inside the card. Warm, short, no ask.
 */
export function thankYouCardMessage(firstName: string): string {
  return [
    `Hi ${firstName},`,
    "",
    "Thank you for trying Homa. Teaching your kids at home is generous work.",
    "",
    "You shared this address when you set up your family, so I wanted to send a real card. Homa is one text away whenever you want a hand.",
  ].join("\n");
}

/** The closing line, written below the message in the same hand. */
export const THANK_YOU_CARD_WISHES = "Warmly,\nSidney, founder of Homa";
