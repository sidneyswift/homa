/**
 * Guards against non-answers ("idk", "not sure", "nothing") landing in
 * profile fields that re-enter every system prompt. Cause: a parent
 * answered the onboarding focus question with "idk" and the context
 * block faithfully told the agent the child was "working on idk" every
 * turn (2026-07-10 build-log entry). Write paths skip non-answers;
 * the renderer also skips them defensively for rows saved before this.
 */

const NON_ANSWERS = new Set([
  "idk",
  "i dont know",
  "i do not know",
  "dont know",
  "do not know",
  "not sure",
  "unsure",
  "no idea",
  "nothing",
  "none",
  "no",
  "na",
  "n a",
  "tbd",
  "unknown",
  "whatever",
  "you pick",
  "anything",
]);

/**
 * isProfileNonAnswer(text): true when the value carries no information
 * about the child (a shrug typed out). Comparison is case-insensitive
 * and ignores punctuation, so "IDK", "idk...", and "I don't know" all
 * match.
 */
export function isProfileNonAnswer(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length === 0 || NON_ANSWERS.has(normalized);
}
