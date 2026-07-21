import { useCallback, useEffect, useState } from "react";

import { getMyChildren, getMyFamily } from "../../lib/family";
import { listFinalMaterials } from "../../lib/materials";
import { toBinderMaterials, type BinderMaterial } from "./binder-model";

/**
 * Loads the caller's kept materials with child names attached, the
 * mobile twin of apps/web/app/app/binder/page.tsx's server reads.
 * Follows the use-family-data.ts pattern: RLS-scoped reads, manual
 * reload, one gentle error string instead of a crash.
 */

interface BinderData {
  /** Null while loading or when onboarding has not created a family yet. */
  hasFamily: boolean;
  materials: BinderMaterial[];
  /**
   * The clock reading taken at load time for the "this week" cover
   * math, the mobile stand-in for the web page's server-supplied now.
   * Captured here, outside render, so components stay pure.
   */
  nowMs: number;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useBinderData(): BinderData {
  const [hasFamily, setHasFamily] = useState(false);
  const [materials, setMaterials] = useState<BinderMaterial[]>([]);
  const [nowMs, setNowMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setNowMs(Date.now());
      const family = await getMyFamily();
      if (!family) {
        setHasFamily(false);
        setMaterials([]);
        setError(null);
        return;
      }
      const [children, summaries] = await Promise.all([
        getMyChildren(family.id),
        listFinalMaterials(family.id),
      ]);
      setHasFamily(true);
      setMaterials(toBinderMaterials(summaries, children));
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

  return { hasFamily, materials, nowMs, loading, error, reload };
}
