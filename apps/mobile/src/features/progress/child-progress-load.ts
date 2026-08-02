import {
  ChildProgressReadError,
  shouldRetainStaleChildProgress,
  type ChildProgressReadFailureKind,
} from "../../lib/child-progress-error";
import type { ChildProgressView } from "../../lib/child-progress";

export interface ChildProgressFailure {
  kind: ChildProgressReadFailureKind;
  message: string;
  reason: string | null;
}

export interface ChildProgressSnapshot {
  requestedChildId: string | null;
  view: ChildProgressView | null;
  loading: boolean;
  error: ChildProgressFailure | null;
}

export interface ChildProgressRequestGate {
  activeRequest: number;
}

export type CommitChildProgressSnapshot = (
  update: (current: ChildProgressSnapshot) => ChildProgressSnapshot,
) => void;

export function createChildProgressRequestGate(): ChildProgressRequestGate {
  return { activeRequest: 0 };
}

export function cancelChildProgressRequests(
  gate: ChildProgressRequestGate,
): void {
  gate.activeRequest += 1;
}

/**
 * Runs one child-scoped read. Only the newest request may commit, and even
 * that request is rejected if the server returns a different child.
 */
export async function loadChildProgressRequest(input: {
  childId: string;
  gate: ChildProgressRequestGate;
  load: (childId: string) => Promise<ChildProgressView>;
  commit: CommitChildProgressSnapshot;
}): Promise<void> {
  const requestId = input.gate.activeRequest + 1;
  input.gate.activeRequest = requestId;
  input.commit((current) => ({
    requestedChildId: input.childId,
    view:
      current.requestedChildId === input.childId ? current.view : null,
    loading: true,
    error: null,
  }));

  try {
    const view = await input.load(input.childId);
    if (input.gate.activeRequest !== requestId) return;
    if (view.childId !== input.childId) {
      throw new ChildProgressReadError(
        "invalid",
        "Progress could not be verified.",
      );
    }
    input.commit(() => ({
      requestedChildId: input.childId,
      view,
      loading: false,
      error: null,
    }));
  } catch (cause) {
    if (input.gate.activeRequest !== requestId) return;
    const failure: ChildProgressFailure =
      cause instanceof ChildProgressReadError
        ? {
            kind: cause.kind,
            message: cause.message,
            reason: cause.reason,
          }
        : {
            kind: "transient",
            message:
              cause instanceof Error ? cause.message : "Something went wrong.",
            reason: null,
          };
    input.commit((current) => ({
      requestedChildId: input.childId,
      view:
        current.requestedChildId === input.childId &&
        shouldRetainStaleChildProgress(cause)
          ? current.view
          : null,
      loading: false,
      error: failure,
    }));
  }
}
