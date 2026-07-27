/**
 * The studio iteration loop's feedback vocabulary (/admin/studio,
 * founder ask 2026-07-18 evening). Tags are a closed set on purpose:
 * they aggregate across runs ("layout-broken showed up in 4 of the
 * last 10") and travel into the improvement packet, so free-form tag
 * spellings would fragment the signal. Nuance goes in the prose field.
 */

export const STUDIO_FEEDBACK_TAGS = [
  "too-easy",
  "too-hard",
  "wrong-theme",
  "layout-broken",
  "text-error",
  "wrong-creation-path",
  "style-off",
  "missed-request",
  "too-cluttered",
  "great-example",
] as const;

export type StudioFeedbackTag = (typeof STUDIO_FEEDBACK_TAGS)[number];

export const STUDIO_FEEDBACK_MAX_CHARS = 2000;

/** One plain reason the feedback cannot save, or null when it can.
 * Empty feedback with tags is fine; tags with no prose still teach. */
export function studioFeedbackProblem(
  feedback: string,
  tags: readonly string[],
): string | null {
  if (feedback.trim().length === 0 && tags.length === 0) {
    return "Pick at least one tag or write a sentence first.";
  }
  if (feedback.length > STUDIO_FEEDBACK_MAX_CHARS) {
    return `Keep feedback under ${STUDIO_FEEDBACK_MAX_CHARS} characters.`;
  }
  const allowed = new Set<string>(STUDIO_FEEDBACK_TAGS);
  const unknown = tags.filter((tag) => !allowed.has(tag));
  if (unknown.length > 0) {
    return "That tag could not be identified. Reload and try again.";
  }
  if (new Set(tags).size !== tags.length) {
    return "That tag could not be identified. Reload and try again.";
  }
  return null;
}
