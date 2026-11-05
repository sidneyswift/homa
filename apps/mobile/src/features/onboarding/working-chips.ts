/**
 * What a child is working on, as the kid screen asks it
 * (app/(onboarding)/kids.tsx): a closed set of chips per age band,
 * saved as the child's focus in plain words ("Reading and Math") and
 * returned by /api/map/state as the child's helpWith.
 */

export function workingChipsForAge(age: number | null): string[] {
  // "I'm not sure yet" is the deck's S6 escape chip (approved
  // 2026-08-31): a parent who does not know the working edge yet still
  // gets through, and the phrase reads fine downstream as an honest
  // focus hint.
  if (age !== null && age <= 5) {
    return ["Letters", "Counting", "Shapes and colors", "First reading", "Handwriting", "I'm not sure yet"];
  }
  if (age !== null && age >= 10) {
    return ["Writing", "Math", "Reading", "Science", "History", "Grammar", "I'm not sure yet"];
  }
  return ["Reading", "Writing", "Math", "Handwriting", "Spelling", "Science", "I'm not sure yet"];
}

/** "letters", "letters and counting", "letters, counting and reading". */
export function joinNatural(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The checklist subjects (packages/core MAP_SUBJECTS ids) each chip
 * means. The checklist asks subjects in a fixed order with Math first,
 * so a parent who tapped Reading met a Math question first (2026-11-03
 * walk, gh#1236); her chips now go first. "I'm not sure yet" has none.
 */
export const WORKING_CHIP_SUBJECTS: Readonly<Record<string, readonly string[]>> = {
  "Letters": ["literacy", "phonics"],
  "Counting": ["math"],
  "Shapes and colors": ["math"],
  "First reading": ["literacy", "phonics"],
  "Reading": ["literacy", "phonics"],
  "Writing": ["writing"],
  "Handwriting": ["writing"],
  "Spelling": ["phonics"],
  "Math": ["math"],
  "Science": ["science"],
  "History": ["social_studies"],
  "Grammar": ["language"],
};

/**
 * The subjects a saved focus asks to go first, in the order she tapped
 * them. The focus is joinNatural over known chips, so this reads chips
 * back by position rather than splitting on "and" ("Shapes and colors"
 * is one chip). Anything else, such as a focus typed on the web, maps to
 * nothing and leaves the checklist in its usual order.
 */
export function focusSubjectIds(focus: string | null): string[] {
  if (!focus) return [];
  const text = focus.toLowerCase();
  const found = Object.keys(WORKING_CHIP_SUBJECTS)
    .map((chip) => ({ chip, at: text.indexOf(chip.toLowerCase()) }))
    .filter(({ at }) => at !== -1)
    // A chip inside a longer chip ("Reading" in "First reading") is
    // that longer chip, not a second pick.
    .filter(({ chip, at }, _, all) =>
      !all.some(
        (other) =>
          other.chip.length > chip.length
          && other.at <= at
          && at < other.at + other.chip.length,
      ),
    )
    .sort((a, b) => a.at - b.at);
  return [...new Set(found.flatMap(({ chip }) => WORKING_CHIP_SUBJECTS[chip]))];
}
