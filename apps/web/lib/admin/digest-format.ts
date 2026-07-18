/**
 * Pure copy formatting for the founder's daily digest. Split from
 * digest.ts so the line logic is unit-testable without a database.
 */

/** The families.name column default; a family still carrying it never
 * finished the onboarding family step. */
export const DEFAULT_FAMILY_NAME = "My family";

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
