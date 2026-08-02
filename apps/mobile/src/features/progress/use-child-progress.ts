import { useCallback, useEffect, useRef, useState } from "react";

import { getChildProgressView, type ChildProgressView } from "../../lib/child-progress";
import {
  completeProgressLoad,
  createProgressLoadState,
  failProgressLoad,
  startProgressLoad,
  visibleProgressLoadState,
} from "./load-state";

interface ChildProgressState {
  view: ChildProgressView | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Loads one child's live Progress view (RLS-scoped), reloading on childId change. */
export function useChildProgress(childId: string | null): ChildProgressState {
  const requestIdRef = useRef(0);
  const [state, setState] = useState(() => createProgressLoadState(childId));

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setState((current) => startProgressLoad(current, childId, requestId));
    if (!childId) {
      return;
    }
    try {
      const nextView = await getChildProgressView(childId);
      setState((current) => completeProgressLoad(current, childId, requestId, nextView));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Something went wrong.";
      setState((current) => failProgressLoad(current, childId, requestId, message));
    }
  }, [childId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reload();
    }, 0);
    return () => {
      clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [reload]);

  const visible = visibleProgressLoadState(state, childId);
  return {
    view: visible.view,
    loading: visible.loading,
    error: visible.error,
    reload,
  };
}
