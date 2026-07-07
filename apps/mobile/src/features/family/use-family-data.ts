import { useCallback, useEffect, useState } from "react";

import {
  getMyChildren,
  getMyFamily,
  type ChildRecord,
  type FamilyRecord,
} from "../../lib/family";

interface FamilyData {
  family: FamilyRecord | null;
  children: ChildRecord[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Loads the caller's family + children (RLS-scoped) with manual reload. */
export function useFamilyData(): FamilyData {
  const [family, setFamily] = useState<FamilyRecord | null>(null);
  const [children, setChildren] = useState<ChildRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const nextFamily = await getMyFamily();
      const nextChildren = nextFamily ? await getMyChildren(nextFamily.id) : [];
      setFamily(nextFamily);
      setChildren(nextChildren);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // reload never sets state synchronously (every set follows an await),
    // so the cascading-render concern this rule guards against can't occur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  return { family, children, loading, error, reload };
}
