import {
  PROGRESS_NEXT_MOVE_CHAT_CHILD_HEADER,
  PROGRESS_NEXT_MOVE_CHAT_FINGERPRINT_HEADER,
} from "@homa/core";

import type { ProgressClientContext, ProgressDraftIntent } from "./chat-send-policy";
import { mergeComposerDraft } from "./composer-draft";

export interface ProgressDraftBinding {
  childId: string;
  draftPrefix: string;
  intent: ProgressDraftIntent;
  proposalFingerprint: string | null;
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
): ProgressClientContext {
  return {
    source: "progress",
    intent: "share_progress_evidence",
    progressChildId: childId,
  };
}

export function progressClientContext(input: {
  childId: string;
  intent: ProgressDraftIntent;
  proposalFingerprint: string | null;
}): ProgressClientContext {
  return {
    source: "progress",
    intent: input.intent,
    progressChildId: input.childId,
    ...(input.proposalFingerprint
      ? { progressNextMoveFingerprint: input.proposalFingerprint }
      : {}),
  };
}

export function progressDraftIntentFromRoute(
  value: string | string[] | undefined,
): ProgressDraftIntent | null {
  const intent = firstRouteValue(value);
  return intent === "share_progress_evidence" ||
    intent === "review_progress_next_move"
    ? intent
    : null;
}

export function progressFingerprintFromRoute(
  value: string | string[] | undefined,
): string | null {
  const fingerprint = firstRouteValue(value);
  return fingerprint && /^[a-f0-9]{64}$/u.test(fingerprint)
    ? fingerprint
    : null;
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
  intent: ProgressDraftIntent = "share_progress_evidence",
  proposalFingerprint: string | null = null,
): ProgressDraftBinding | null {
  const draftPrefix = incomingDraft.trim();
  if (childId.trim().length === 0 || draftPrefix.length === 0) return null;
  if (!mergedDraft.startsWith(draftPrefix)) return null;
  if (intent === "review_progress_next_move" && !proposalFingerprint) {
    return null;
  }
  return { childId, draftPrefix, intent, proposalFingerprint };
}

/** Keeps explicit Progress context through arbitrary edits until send or unlink. */
export function progressChildIdForDraft(
  binding: ProgressDraftBinding | null,
  currentDraft: string,
): string | null {
  if (!binding || currentDraft.trim().length === 0) return null;
  return binding.childId;
}

export function progressContextForDraft(
  binding: ProgressDraftBinding | null,
  currentDraft: string,
): ProgressClientContext | null {
  if (!binding || currentDraft.trim().length === 0) return null;
  return progressClientContext({
    childId: binding.childId,
    intent: binding.intent,
    proposalFingerprint: binding.proposalFingerprint,
  });
}

export function progressTransportForDraft(
  binding: ProgressDraftBinding | null,
  currentDraft: string,
):
  | { clientContext: ProgressClientContext }
  | { headers: Readonly<Record<string, string>> }
  | null {
  const context = progressContextForDraft(binding, currentDraft);
  if (!context) return null;
  if (
    context.intent === "review_progress_next_move" &&
    context.progressNextMoveFingerprint
  ) {
    return {
      headers: {
        [PROGRESS_NEXT_MOVE_CHAT_CHILD_HEADER]: context.progressChildId,
        [PROGRESS_NEXT_MOVE_CHAT_FINGERPRINT_HEADER]:
          context.progressNextMoveFingerprint,
      },
    };
  }
  return { clientContext: context };
}
