import { useCallback, useEffect, useState } from "react";

import { getFinalMaterials, getInProgressMaterials, type MaterialSummary } from "../../lib/materials";

interface BinderData {
  finalMaterials: MaterialSummary[];
  inProgressMaterials: MaterialSummary[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useBinderData(familyId: string | null): BinderData {
  const [finalMaterials, setFinalMaterials] = useState<MaterialSummary[]>([]);
  const [inProgressMaterials, setInProgressMaterials] = useState<MaterialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!familyId) {
      setFinalMaterials([]);
      setInProgressMaterials([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [final, inProgress] = await Promise.all([
        getFinalMaterials(familyId),
        // In-progress reads are best-effort: a failure here should never
        // take down the finalized grid, matching web's own .catch(() => []).
        getInProgressMaterials(familyId).catch(() => []),
      ]);
      setFinalMaterials(final);
      setInProgressMaterials(inProgress);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  return { finalMaterials, inProgressMaterials, loading, error, reload };
}
