import { useCallback, useEffect, useState } from "react";

import { getChildPlans, type ChildPlanRecord } from "../../lib/child-plans";
import { getFamilyEvents, type FamilyEventRecord } from "../../lib/family-events";
import { getScheduledActivities, type PlanActivityScheduleRecord } from "../../lib/plan-schedule";
import type { ChildRecord } from "../../lib/family";

interface PlannerData {
  events: FamilyEventRecord[];
  scheduleRows: PlanActivityScheduleRecord[];
  childPlans: ChildPlanRecord[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Loads everything the Planner needs for one visible date range: family
 * events and scheduled activities in that window, plus every child's
 * current plans (small, so read whole rather than date-filtered). */
export function usePlannerData(
  familyId: string | null,
  children: ChildRecord[],
  rangeStart: string,
  rangeEnd: string,
): PlannerData {
  const [events, setEvents] = useState<FamilyEventRecord[]>([]);
  const [scheduleRows, setScheduleRows] = useState<PlanActivityScheduleRecord[]>([]);
  const [childPlans, setChildPlans] = useState<ChildPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!familyId || children.length === 0) {
      setEvents([]);
      setScheduleRows([]);
      setChildPlans([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const childIds = children.map((child) => child.id);
      const [nextEvents, nextSchedule, nextPlans] = await Promise.all([
        getFamilyEvents(familyId, rangeStart, rangeEnd),
        getScheduledActivities(familyId, rangeStart, rangeEnd),
        Promise.all(childIds.map((childId) => getChildPlans(childId))).then((lists) => lists.flat()),
      ]);
      setEvents(nextEvents);
      setScheduleRows(nextSchedule);
      setChildPlans(nextPlans);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [familyId, children, rangeStart, rangeEnd]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  return { events, scheduleRows, childPlans, loading, error, reload };
}
