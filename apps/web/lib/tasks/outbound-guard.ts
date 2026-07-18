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
  // Any snake_case identifier reads as machinery in a family message:
  // tool names, delivery versions, subject ids. URLs are stripped before
  // this check so a link cannot trip it.
  {
    label: "internal identifier",
    pattern: /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/,
  },
  { label: "dispatch vocabulary", pattern: /\bdispatch\b/i },
  { label: "run mechanics", pattern: /\btask run\b/i },
  { label: "retry vocabulary", pattern: /\bretryable\b/i },
  { label: "auth vocabulary", pattern: /\bauthenticated\b/i },
];

const URL_PATTERN = /https?:\/\/\S+/gi;

/** Returns the matched deny-list label when the composed text narrates
 * internal machinery, or null when it is clean family copy. */
export function findInternalNarration(text: string): string | null {
  const withoutUrls = text.replace(URL_PATTERN, " ");
  for (const { label, pattern } of INTERNAL_NARRATION_PATTERNS) {
    if (pattern.test(withoutUrls)) return label;
  }
  return null;
}
