import { useCallback, useEffect, useState } from "react";

import { getHoursLogForFamily, type HoursLogRow } from "../../lib/hours";

interface HoursData {
  rows: HoursLogRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useHoursData(familyId: string | null): HoursData {
  const [rows, setRows] = useState<HoursLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!familyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const nextRows = await getHoursLogForFamily(familyId);
      setRows(nextRows);
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

  return { rows, loading, error, reload };
}
