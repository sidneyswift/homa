import { useCallback, useEffect, useState } from "react";

import {
  getMyChildren,
  getMyFamily,
  getMyMemberDisplayName,
  type ChildRecord,
  type FamilyRecord,
} from "../../lib/family";

interface FamilyData {
  family: FamilyRecord | null;
  children: ChildRecord[];
  memberDisplayName: string | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Loads the caller's family + children (RLS-scoped) with manual reload. */
export function useFamilyData(): FamilyData {
  const [family, setFamily] = useState<FamilyRecord | null>(null);
  const [children, setChildren] = useState<ChildRecord[]>([]);
  const [memberDisplayName, setMemberDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const nextFamily = await getMyFamily();
      const [nextChildren, nextMemberDisplayName] = nextFamily
        ? await Promise.all([
            getMyChildren(nextFamily.id),
            getMyMemberDisplayName(),
          ])
        : [[], null];
      setFamily(nextFamily);
      setChildren(nextChildren);
      setMemberDisplayName(nextMemberDisplayName);
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

  return { family, children, memberDisplayName, loading, error, reload };
}
