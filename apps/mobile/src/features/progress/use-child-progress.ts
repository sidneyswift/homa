import { useCallback, useEffect, useRef, useState } from "react";

import { getChildProgressView } from "../../lib/child-progress";
import {
  cancelChildProgressRequests,
  createChildProgressRequestGate,
  loadChildProgressRequest,
  type ChildProgressSnapshot,
} from "./child-progress-load";

interface ChildProgressState extends Omit<ChildProgressSnapshot, "requestedChildId"> {
  reload: () => Promise<void>;
}

const EMPTY_SNAPSHOT: ChildProgressSnapshot = {
  requestedChildId: null,
  view: null,
  loading: false,
  error: null,
};

/** Loads one child's canonical Progress view without cross-child stale commits. */
export function useChildProgress(childId: string | null): ChildProgressState {
  const [snapshot, setSnapshot] = useState<ChildProgressSnapshot>(EMPTY_SNAPSHOT);
  const requestGate = useRef(createChildProgressRequestGate());

  const reload = useCallback(async () => {
    if (!childId) {
      cancelChildProgressRequests(requestGate.current);
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }
    await loadChildProgressRequest({
      childId,
      gate: requestGate.current,
      load: getChildProgressView,
      commit: setSnapshot,
    });
  }, [childId]);

  useEffect(() => {
    const gate = requestGate.current;
    const timer = setTimeout(() => void reload(), 0);
    return () => {
      clearTimeout(timer);
      cancelChildProgressRequests(gate);
    };
  }, [reload]);

  // React renders once with the old snapshot before the child-change effect
  // runs. Mask that frame so old evidence can never sit under the new pill.
  if (snapshot.requestedChildId !== childId) {
    return {
      view: null,
      loading: childId !== null,
      error: null,
      reload,
    };
  }
  return {
    view: snapshot.view,
    loading: snapshot.loading,
    error: snapshot.error,
    reload,
  };
}
