/**
 * Pure copy formatting for the founder's daily digest. Split from
 * digest.ts so the line logic is unit-testable without a database.
 */

/** The families.name column default; a family still carrying it never
 * finished the onboarding family step. */
export const DEFAULT_FAMILY_NAME = "My family";

/**
 * The digest's first line. Alerts the founder already marked handled in
 * the console never count toward "need a look" (2026-07-18: the digest
 * re-alarmed on three alerts handled 13 hours before it was sent), and
 * an all-handled morning says so instead of claiming nothing broke.
 */
export function formatTroubleHeadline(needLook: number, handled: number): string {
  if (needLook > 0) {
    return `${needLook} delivery ${needLook === 1 ? "problem needs" : "problems need"} a look.`;
  }
  return handled > 0 ? "Nothing new needs a look." : "Nothing broke in the last 24 hours.";
}

/**
 * One line, after the trouble rows, for alerts the founder already
 * marked handled in the console. The digest drops their detail rows but
 * still says how many were handled, matching the console's "N handled
 * alerts hidden" note: hiding never erases history. Null when there is
 * nothing handled to mention.
 */
export function formatHandledLine(handled: number): string | null {
  if (handled === 0) return null;
  return handled === 1
    ? "1 alert from the last 24 hours was already marked handled in the console."
    : `${handled} alerts from the last 24 hours were already marked handled in the console.`;
}

/**
 * One line for the digest's signup section. Families that never named
 * themselves are collapsed into a stalled count instead of a wall of
 * "My family, My family, ...", because how many stalled is the number
 * the founder acts on (2026-07-16: 17 of 20 signups stalled unnamed).
 */
export function formatSignupsLine(names: string[]): string {
  if (names.length === 0) return "No new signups in the last 24 hours.";
  const named = names.filter((name) => name !== DEFAULT_FAMILY_NAME);
  const unnamed = names.length - named.length;
  const count = `${names.length} new ${names.length === 1 ? "signup" : "signups"}`;
  if (unnamed === 0) return `${count}: ${named.join(", ")}.`;
  if (named.length === 0) {
    return names.length === 1
      ? `${count}, stopped before naming their family.`
      : `${count}, all stopped before naming their family.`;
  }
  return `${count}: ${named.join(", ")}, plus ${unnamed} that stopped before naming their family.`;
}
