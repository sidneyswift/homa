/**
 * Homa-authored walk cards: the parent-facing statement asked for a
 * taxonomy topic during a graph walk
 * (plans/2026-07-11-onboarding-depth-fork.md § The cards).
 *
 * Authoring contract:
 *   - keyed by Homa topic id (`<subject>.<slug>`), one card per topic
 *   - statement is parent-observable, answerable from memory with the
 *     chips, `{{name}}` placeholder allowed (personalizePrompt fills it)
 *   - every entry passes the content laws and both copy gates
 *     (homa-copy-reviewer, then homa-copy-editor) before merging;
 *     Marble's assessmentPrompt/evidence are raw material, never
 *     shipped verbatim
 *
 * Empty until curation batch 1 lands: the walk engine only serves
 * topics present here, so the machinery ships dark ahead of the
 * content and curation never blocks the feature.
 */
export const WALK_CARDS: Readonly<Record<string, { statement: string }>> = {};

export function walkCardStatement(topicId: string): string | null {
  return WALK_CARDS[topicId]?.statement ?? null;
}

let askable: ReadonlySet<string> | null = null;

/** Topic ids that have an authored card and may be served to a family. */
export function askableTopicIds(): ReadonlySet<string> {
  if (!askable) askable = new Set(Object.keys(WALK_CARDS));
  return askable;
}
