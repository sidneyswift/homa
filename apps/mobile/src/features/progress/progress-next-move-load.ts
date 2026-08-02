import type {
  ChildProgressView,
  ProgressNextMoveResponse,
} from "@homa/core";

import {
  ChildProgressReadError,
  type ChildProgressReadFailureKind,
} from "../../lib/child-progress-error";
import { progressViewsMatch } from "./progress-view-match";

export interface ProgressNextMoveFailure {
  kind: ChildProgressReadFailureKind;
  message: string;
  reason: string | null;
}

export interface ProgressNextMoveSnapshot {
  requestKey: string | null;
  response: ProgressNextMoveResponse | null;
  loading: boolean;
  error: ProgressNextMoveFailure | null;
}

export interface ProgressNextMoveRequestGate {
  activeRequest: number;
}

export function progressNextMoveRequestKey(view: ChildProgressView): string {
  return `${view.childId}:${view.projectedAt}`;
}

export function createProgressNextMoveRequestGate(): ProgressNextMoveRequestGate {
  return { activeRequest: 0 };
}

export function cancelProgressNextMoveRequests(
  gate: ProgressNextMoveRequestGate,
): void {
  gate.activeRequest += 1;
}

export function settleDismissedProgressNextMove(input: {
  current: ProgressNextMoveSnapshot;
  requestKey: string;
  contextFingerprint: string;
  childId: string;
}): ProgressNextMoveSnapshot {
  const response = input.current.response;
  if (
    input.current.requestKey !== input.requestKey ||
    response?.status !== "settled" ||
    response.contextFingerprint !== input.contextFingerprint ||
    response.view.childId !== input.childId
  ) {
    return input.current;
  }

  return {
    ...input.current,
    response: {
      ok: true,
      status: "settled",
      contextFingerprint: input.contextFingerprint,
      sourceRevision: response.sourceRevision,
      view: response.view,
      nextMove: {
        kind: "none",
        childId: input.childId,
        sourceRevision: response.sourceRevision,
        reason: "dismissed",
      },
    },
    error: null,
  };
}

export async function loadProgressNextMoveRequest(input: {
  view: ChildProgressView;
  gate: ProgressNextMoveRequestGate;
  retryFailed?: boolean;
  load: (
    childId: string,
    options?: { retryFailed?: boolean },
  ) => Promise<ProgressNextMoveResponse>;
  commit: (
    update: (
      current: ProgressNextMoveSnapshot,
    ) => ProgressNextMoveSnapshot,
  ) => void;
}): Promise<void> {
  const requestKey = progressNextMoveRequestKey(input.view);
  const requestId = input.gate.activeRequest + 1;
  input.gate.activeRequest = requestId;
  input.commit((current) => ({
    requestKey,
    response:
      !input.retryFailed && current.requestKey === requestKey
        ? current.response
        : null,
    loading: true,
    error: null,
  }));

  try {
    const response = await input.load(input.view.childId, {
      retryFailed: input.retryFailed,
    });
    if (input.gate.activeRequest !== requestId) return;
    if (
      response.view.childId !== input.view.childId ||
      !progressViewsMatch(input.view, response.view)
    ) {
      throw new ChildProgressReadError(
        "invalid",
        "Progress changed while Homa was choosing. Refresh to see what’s current.",
        409,
        "projection-changed",
      );
    }
    input.commit(() => ({
      requestKey,
      response,
      loading: false,
      error: null,
    }));
  } catch (cause) {
    if (input.gate.activeRequest !== requestId) return;
    const failure: ProgressNextMoveFailure =
      cause instanceof ChildProgressReadError
        ? { kind: cause.kind, message: cause.message, reason: cause.reason }
        : {
            kind: "transient",
            message:
              cause instanceof Error
                ? cause.message
                : "Homa couldn’t choose a next move right now.",
            reason: null,
          };
    input.commit((current) => ({
      requestKey,
      response:
        current.requestKey === requestKey ? current.response : null,
      loading: false,
      error: failure,
    }));
  }
}
