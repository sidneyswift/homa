import type { ProgressEvidenceClientContext } from "./chat-send-policy";
import { mergeComposerDraft } from "./composer-draft";

export interface ProgressDraftBinding {
  childId: string;
  draftPrefix: string;
}

const MAX_PROGRESS_CHILD_ID_CHARACTERS = 80;

function firstRouteValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null;
}

export function progressChildIdFromRoute(
  value: string | string[] | undefined,
): string | null {
  const childId = firstRouteValue(value);
  if (
    childId === null ||
    childId.trim().length === 0 ||
    Array.from(childId).length > MAX_PROGRESS_CHILD_ID_CHARACTERS
  ) {
    return null;
  }
  return childId;
}

export function progressEvidenceClientContext(
  childId: string,
): ProgressEvidenceClientContext {
  return {
    source: "progress",
    intent: "share_progress_evidence",
    progressChildId: childId,
  };
}

/** Preserves anything she was already typing and never sends on her behalf. */
export function mergeProgressDraft(current: string, incoming: string): string {
  if (current.includes(incoming)) return current;
  return mergeComposerDraft(current, incoming);
}

/**
 * Binds exact-child evidence only when the Progress handoff begins the
 * composer. If a parent was already writing something unrelated, that text
 * stays intact but must not silently inherit Progress provenance.
 */
export function bindProgressDraftContext(
  childId: string,
  incomingDraft: string,
  mergedDraft: string,
): ProgressDraftBinding | null {
  const draftPrefix = incomingDraft.trim();
  if (childId.trim().length === 0 || draftPrefix.length === 0) return null;
  if (!mergedDraft.startsWith(draftPrefix)) return null;
  return { childId, draftPrefix };
}

/** Keeps the binding while she appends detail, and drops it after replacement. */
export function progressChildIdForDraft(
  binding: ProgressDraftBinding | null,
  currentDraft: string,
): string | null {
  if (!binding || !currentDraft.startsWith(binding.draftPrefix)) return null;
  return binding.childId;
}
