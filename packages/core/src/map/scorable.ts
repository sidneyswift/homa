import { PROGRESS_TAXONOMY_TOPICS } from "@homa/taxonomy/progress";

import { getMapItem, getMapSubject, type MapItem, type MapSubject } from "./bank";

/**
 * One abilities catalog (founder ruling 2026-07-21, "one abilities map").
 *
 * The 225 bank items and the ~1,384 assessable taxonomy topics were two
 * parallel worlds: only the bank could move a child's number, so every
 * taxonomy skill a parent demonstrated counted for exactly nothing. The
 * split was justified as "the bank is cited and the taxonomy is not",
 * which turned out to be false: 818 taxonomy topics carry standards
 * references, including CCSS, the same corpus the bank cites.
 *
 * So they are one catalog now. Both kinds carry a typical age; a child
 * who demonstrates skills above their age is ahead, whichever list the
 * skill came from.
 *
 * Two things this deliberately does NOT do:
 *
 *  - It does not touch MAP_SUBJECTS. That list drives onboarding
 *    question selection (planQuestions), and adding 1,384 topics to it
 *    would change what every new family is asked. Askable and scorable
 *    are different jobs.
 *  - It does not invent an age. A taxonomy topic's anchor is the START
 *    of its documented teaching window, the earliest age it is typically
 *    expected, so the credit under-claims rather than over-claims.
 */

/** A taxonomy topic's scoring anchor: the early edge of its window. */
function anchorForTopic(teachingWindowMonths: readonly [number, number]): number {
  return teachingWindowMonths[0];
}

const taxonomyIndex = new Map<string, { subject: MapSubject; item: MapItem }>();
for (const topic of PROGRESS_TAXONOMY_TOPICS) {
  const subject = getMapSubject(topic.subject);
  // A topic whose subject has no bank subject has nowhere to score; the
  // taxonomy carries subjects the bank does not (and vice versa).
  if (!subject) continue;
  taxonomyIndex.set(topic.id, {
    subject,
    item: {
      id: topic.id,
      statement: topic.name,
      typicalMonths: anchorForTopic(topic.teachingWindowMonths),
      // The window itself is the documented range, so the scorer's
      // early-edge credit rule lands on the same number as the anchor.
      typicalRangeMonths: topic.teachingWindowMonths,
      sources: [],
    },
  });
}

/**
 * getScorableItem(itemId): the bank first, then the taxonomy. The bank
 * wins on collision because its anchors are per-item cited developmental
 * norms rather than curriculum placement.
 */
export function getScorableItem(
  itemId: string,
): { subject: MapSubject; item: MapItem } | undefined {
  return getMapItem(itemId) ?? taxonomyIndex.get(itemId);
}

/** Only the taxonomy half, for callers that already walk the bank. */
export function taxonomyScorableItems(): {
  subject: MapSubject;
  item: MapItem;
}[] {
  return [...taxonomyIndex.values()];
}

/** True when this id is a taxonomy topic rather than a bank item: the
 *  honest basis label for anything parent-facing. */
export function isTaxonomyScorable(itemId: string): boolean {
  return getMapItem(itemId) === undefined && taxonomyIndex.has(itemId);
}
