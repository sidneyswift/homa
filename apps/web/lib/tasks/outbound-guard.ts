/**
 * The last deterministic gate before a legacy dispatch delivery reaches a
 * family. Prompts and skills make internal narration unlikely; only this
 * guard makes "never text a family our machinery" a guarantee. Cause: on
 * 2026-07-18 a parent-created research task delivered "This dispatch isn't
 * running in a state where I can prepare and send a morning research
 * brief..." as a mother's 6 AM text, with the run marked done.
 *
 * The deny list is small and explicit on purpose. Family-legitimate copy
 * ("morning brief", "research brief", "tasks page") stays out of it. A
 * match fails the run visibly instead of texting the family, and the
 * founder digest surfaces the failed run for follow-up, so the cost of a
 * false positive is a skipped message, never a leaked one.
 */

const INTERNAL_NARRATION_PATTERNS: ReadonlyArray<{
  label: string;
  pattern: RegExp;
}> = [
  // A lowercase snake_case identifier reads as machinery in a family
  // message (tool names, delivery versions, subject ids). Links, bare
  // domains, filenames, and email addresses are stripped first so
  // "reading_rockets.org" or "number_line_v2.pdf" cannot trip it, and
  // codeAllowed skips it entirely for save-only tasks whose output may
  // legitimately contain code.
  {
    label: "internal identifier",
    pattern: /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/,
  },
  { label: "dispatch vocabulary", pattern: /\bdispatch(?:es|ed|ing)?\b/i },
  { label: "run mechanics", pattern: /\btask run\b/i },
  { label: "retry vocabulary", pattern: /\bretryable\b/i },
  { label: "auth vocabulary", pattern: /\bauthenticated\b/i },
];

/** Links, bare domains, filenames with extensions, and email addresses:
 * legitimate underscore carriers a composed message may reference. */
const NON_PROSE_TOKEN_PATTERNS: ReadonlyArray<RegExp> = [
  /https?:\/\/\S+/gi,
  /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g,
  /\b[\w-]+(?:\.[\w-]+)*\.(?:com|org|net|edu|gov|io|co|us)(?:\/\S*)?\b/gi,
  /\b[\w-]+\.(?:pdf|png|jpg|jpeg|doc|docx|csv|txt|html)\b/gi,
];

export interface FindInternalNarrationOptions {
  /** Save-only tasks land on the family's tasks page, where code (and its
   * snake_case) is legitimate; the explicit vocabulary checks still run. */
  codeAllowed?: boolean;
}

/** Returns the matched deny-list label when the composed text narrates
 * internal machinery, or null when it is clean family copy. */
export function findInternalNarration(
  text: string,
  options: FindInternalNarrationOptions = {},
): string | null {
  let prose = text;
  for (const tokenPattern of NON_PROSE_TOKEN_PATTERNS) {
    prose = prose.replace(tokenPattern, " ");
  }
  for (const { label, pattern } of INTERNAL_NARRATION_PATTERNS) {
    if (options.codeAllowed && label === "internal identifier") continue;
    if (pattern.test(prose)) return label;
  }
  return null;
}
