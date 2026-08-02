import type {
  ChildProgressView,
  ProgressNextMove,
  ProgressNextMoveResponse,
} from "@homa/core";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  dismissProgressNextMove,
  getProgressNextMove,
} from "../../lib/progress-next-move";
import {
  cancelProgressNextMoveRequests,
  createProgressNextMoveRequestGate,
  loadProgressNextMoveRequest,
  progressNextMoveRequestKey,
  settleDismissedProgressNextMove,
  type ProgressNextMoveFailure,
  type ProgressNextMoveSnapshot,
} from "./progress-next-move-load";

const EMPTY: ProgressNextMoveSnapshot = {
  requestKey: null,
  response: null,
  loading: false,
  error: null,
};
const MAX_PENDING_POLLS = 2;
const PRODUCER_FAILURE_MESSAGE =
  "Homa couldn’t finish that idea. Your Progress is still here.";

export function useProgressNextMove(view: ChildProgressView | null): {
  nextMove: ProgressNextMove | null;
  contextFingerprint: string | null;
  pending: boolean;
  loading: boolean;
  dismissing: boolean;
  dismissError: string | null;
  error: ProgressNextMoveFailure | null;
  reload: () => Promise<void>;
  retry: () => Promise<void>;
  dismiss: () => Promise<void>;
} {
  const [snapshot, setSnapshot] = useState<ProgressNextMoveSnapshot>(EMPTY);
  const [dismissingKey, setDismissingKey] = useState<string | null>(null);
  const [dismissFailure, setDismissFailure] = useState<{
    requestKey: string;
    message: string;
  } | null>(null);
  const [pollFailure, setPollFailure] = useState<{
    requestKey: string;
  } | null>(null);
  const gate = useRef(createProgressNextMoveRequestGate());
  const dismissalRequest = useRef(0);
  const pendingPolls = useRef({ requestKey: null as string | null, count: 0 });
  const requestKey = view ? progressNextMoveRequestKey(view) : null;

  const loadCurrent = useCallback(async (retryFailed = false) => {
    if (!view) {
      cancelProgressNextMoveRequests(gate.current);
      setSnapshot(EMPTY);
      return;
    }
    await loadProgressNextMoveRequest({
      view,
      gate: gate.current,
      load: getProgressNextMove,
      commit: setSnapshot,
      retryFailed,
    });
  }, [view]);

  const reload = useCallback(async () => {
    await loadCurrent(false);
  }, [loadCurrent]);

  useEffect(() => {
    const currentGate = gate.current;
    const timer = setTimeout(() => void reload(), 0);
    return () => {
      clearTimeout(timer);
      cancelProgressNextMoveRequests(currentGate);
    };
  }, [reload]);

  const response: ProgressNextMoveResponse | null =
    snapshot.requestKey === requestKey ? snapshot.response : null;
  const nextMove =
    response?.status === "settled" ? response.nextMove : null;
  const contextFingerprint = response?.contextFingerprint ?? null;
  const pollingExpired =
    pollFailure?.requestKey === requestKey && response?.status === "pending";

  useEffect(() => {
    if (!requestKey || response?.status !== "pending") {
      pendingPolls.current = { requestKey, count: 0 };
      return;
    }
    if (pollFailure?.requestKey === requestKey) return;
    if (snapshot.loading) return;
    if (pendingPolls.current.requestKey !== requestKey) {
      pendingPolls.current = { requestKey, count: 0 };
    }
    if (pendingPolls.current.count >= MAX_PENDING_POLLS) {
      const timer = setTimeout(
        () =>
          setPollFailure((current) =>
            current?.requestKey === requestKey
              ? current
              : { requestKey },
          ),
        0,
      );
      return () => clearTimeout(timer);
    }
    pendingPolls.current.count += 1;
    const timer = setTimeout(() => void reload(), 1_500);
    return () => clearTimeout(timer);
  }, [
    pollFailure?.requestKey,
    reload,
    requestKey,
    response?.status,
    snapshot.loading,
  ]);

  const retry = useCallback(async () => {
    if (!requestKey) return;
    pendingPolls.current = { requestKey, count: 0 };
    setPollFailure((current) =>
      current?.requestKey === requestKey ? null : current,
    );
    await loadCurrent(true);
  }, [loadCurrent, requestKey]);

  const dismiss = useCallback(async () => {
    if (!view || !contextFingerprint || !requestKey) return;
    const activeRequestKey = requestKey;
    const requestId = dismissalRequest.current + 1;
    dismissalRequest.current = requestId;
    setDismissingKey(activeRequestKey);
    setDismissFailure(null);
    try {
      await dismissProgressNextMove(view.childId, contextFingerprint);
      setSnapshot((current) =>
        settleDismissedProgressNextMove({
          current,
          requestKey: activeRequestKey,
          contextFingerprint,
          childId: view.childId,
        }),
      );
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Homa couldn’t hide that idea yet.";
      if (dismissalRequest.current === requestId) {
        setDismissFailure({ requestKey: activeRequestKey, message });
      }
    } finally {
      if (dismissalRequest.current === requestId) {
        setDismissingKey(null);
      }
    }
  }, [contextFingerprint, requestKey, view]);

  return {
    nextMove,
    contextFingerprint,
    pending: response?.status === "pending" && !pollingExpired,
    loading: snapshot.requestKey === requestKey && snapshot.loading,
    dismissing: dismissingKey === requestKey,
    dismissError:
      dismissFailure?.requestKey === requestKey
        ? dismissFailure.message
        : null,
    error:
      snapshot.requestKey === requestKey && snapshot.error
        ? snapshot.error
        : response?.status === "failed"
          ? {
              kind: "transient",
              message: PRODUCER_FAILURE_MESSAGE,
              reason: "producer-unavailable",
            }
          : pollingExpired
            ? {
                kind: "transient",
                message: PRODUCER_FAILURE_MESSAGE,
                reason: "producer-timeout",
              }
            : null,
    reload,
    retry,
    dismiss,
  };
}
