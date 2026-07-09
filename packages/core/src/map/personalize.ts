/**
 * Question personalization (founder call 2026-07-08: "make the questions
 * include the kids name"). Bank statements are third-person verb phrases
 * about the child ("Counts out loud to 10..."), so prefixing the name
 * reads as a natural question: "Story counts out loud to 10...?". The
 * bank itself stays neutral: the report's receipts, the narrative facts,
 * and the scorer all keep one canonical statement per item.
 *
 * Items whose subject is NOT the child register a hand-written exception
 * here instead of getting the prefix (a naive "Story someone who just
 * met them..." would be word salad). check:map verifies every bank item
 * personalizes cleanly, so a new odd-shaped statement fails CI until it
 * either reads naturally with the prefix or registers here.
 */

/** Statements where the child is not the sentence's subject, keyed by
 * item id, each with its own hand-written personalization. */
const EXCEPTIONS: Record<string, (childName: string) => string> = {
  "language.stranger-clear": (childName) =>
    `Someone who just met ${childName} understands most of what they say`,
};

/** For check:map: items allowed to skip the name-prefix rule because a
 * hand-written personalization exists above. */
export const PERSONALIZATION_EXCEPTION_IDS: readonly string[] = Object.keys(EXCEPTIONS);

/**
 * personalizeStatement(childName, item): string
 * "Counts out loud to 10" + "Story" becomes "Story counts out loud to
 * 10"; render sites append their own "?".
 */
export function personalizeStatement(
  childName: string,
  item: { id: string; statement: string },
): string {
  const exception = EXCEPTIONS[item.id];
  if (exception) return exception(childName);
  return `${childName} ${item.statement.charAt(0).toLowerCase()}${item.statement.slice(1)}`;
}
