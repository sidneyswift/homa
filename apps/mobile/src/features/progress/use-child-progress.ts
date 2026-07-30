import { useCallback, useEffect, useState } from "react";

import { getChildProgressView, type ChildProgressView } from "../../lib/child-progress";

interface ChildProgressState {
  view: ChildProgressView | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Loads one child's live Progress view (RLS-scoped), reloading on childId change. */
export function useChildProgress(childId: string | null): ChildProgressState {
  const [view, setView] = useState<ChildProgressView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!childId) {
      setView(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const nextView = await getChildProgressView(childId);
      setView(nextView);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  return { view, loading, error, reload };
}
