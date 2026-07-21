import { useCallback, useEffect, useState } from "react";

import {
  getMyScheduledTasks,
  getMyTaskRuns,
  getTasksFamilyContext,
  type TaskRow,
  type TaskRun,
  type TasksFamilyContext,
} from "../../lib/tasks";

interface TasksData {
  family: TasksFamilyContext | null;
  tasks: TaskRow[];
  runs: TaskRun[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Loads the tasks screen's reads (RLS-scoped) with manual reload, the
 * same shape as features/family/use-family-data.ts. The web twin loads
 * these in one server render (app/app/tasks/page.tsx); here the screen
 * refetches on focus so a task Homa just changed in chat shows up when
 * the parent swings back.
 */
export function useTasksData(): TasksData {
  const [family, setFamily] = useState<TasksFamilyContext | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const nextFamily = await getTasksFamilyContext();
      const [nextTasks, nextRuns] = nextFamily
        ? await Promise.all([getMyScheduledTasks(), getMyTaskRuns()])
        : [[], []];
      setFamily(nextFamily);
      setTasks(nextTasks);
      setRuns(nextRuns);
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

  return { family, tasks, runs, loading, error, reload };
}
