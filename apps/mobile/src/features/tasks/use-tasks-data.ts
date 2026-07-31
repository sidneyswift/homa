import { useCallback, useEffect, useState } from "react";

import { fetchTasks, type TaskListData } from "../../lib/tasks";

interface TasksData {
  data: TaskListData | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Null data means "not loaded yet" or "failed to load", never "the
 *  family has zero tasks": a load failure must never render as an
 *  empty list. A failed reload keeps whatever was already loaded. */
export function useTasksData(): TasksData {
  const [data, setData] = useState<TaskListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const next = await fetchTasks();
    if (next) {
      setData(next);
      setError(null);
    } else {
      setError("That didn't load. Pull down to try again.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  return { data, loading, error, reload };
}
