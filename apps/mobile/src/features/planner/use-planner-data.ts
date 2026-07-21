import { useCallback, useEffect, useState } from "react";

import { getPlannerData, type PlannerData } from "../../lib/planner";

interface PlannerState {
  /** Null while loading or when setup is unfinished; `loading` and
   * `setupIncomplete` say which. */
  data: PlannerData | null;
  loading: boolean;
  /** True after a load that found no completed family or no kids: the
   * screen offers the web onboarding (the mobile twin of web
   * page.tsx's redirect). */
  setupIncomplete: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Loads the planner's reads (RLS-scoped) with manual reload, the same
 * shape as features/family/use-family-data.ts. */
export function usePlannerData(): PlannerState {
  const [data, setData] = useState<PlannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupIncomplete, setSetupIncomplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const next = await getPlannerData();
      setData(next);
      setSetupIncomplete(next === null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  return { data, loading, setupIncomplete, error, reload };
}
