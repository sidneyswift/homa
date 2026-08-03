import { useCallback, useEffect, useRef, useState } from "react";

import { getChildPlans, type ChildPlanRecord } from "../../lib/child-plans";
import { getFamilyEvents, type FamilyEventRecord } from "../../lib/family-events";
import { getHoursLogForFamilyBetween, type HoursLogRow } from "../../lib/hours";
import { getScheduledActivities, type PlanActivityScheduleRecord } from "../../lib/plan-schedule";
import type { ChildRecord } from "../../lib/family";
import type { PlanActivityCheckApplied } from "../../lib/plan-check-mutation";
import {
  getFamilyAssetPlanLinks,
  type FamilyAssetPlanLinkRecord,
} from "../../lib/family-asset-plan-links";
import { expandRecurringFamilyEvents } from "./recurring-family-events";
import {
  mergeAppliedPlanActivityCheck,
  mergeChildPlanSnapshots,
} from "./plan-check-state";

interface PlannerData {
  events: FamilyEventRecord[];
  scheduleRows: PlanActivityScheduleRecord[];
  childPlans: ChildPlanRecord[];
  sourceLinks: FamilyAssetPlanLinkRecord[];
  hoursRows: HoursLogRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  reconcileAfterAmbiguousWrite: () => Promise<void>;
  applyActivityCheck: (
    target: { childId: string; subjectId: string },
    outcome: PlanActivityCheckApplied,
  ) => void;
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
  const [sourceLinks, setSourceLinks] = useState<FamilyAssetPlanLinkRecord[]>([]);
  const [hoursRows, setHoursRows] = useState<HoursLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reloadGeneration = useRef(0);
  const reconciliationTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const reconciliationScheduled = useRef(false);

  const reload = useCallback(async () => {
    const requestGeneration = ++reloadGeneration.current;
    if (!familyId || children.length === 0) {
      setEvents([]);
      setScheduleRows([]);
      setChildPlans([]);
      setSourceLinks([]);
      setHoursRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const childIds = children.map((child) => child.id);
      const [nextEvents, nextSchedule, nextPlans, nextSourceLinks, nextHoursRows] = await Promise.all([
        getFamilyEvents(familyId, rangeStart, rangeEnd),
        getScheduledActivities(familyId, rangeStart, rangeEnd),
        Promise.all(childIds.map((childId) => getChildPlans(childId))).then((lists) => lists.flat()),
        getFamilyAssetPlanLinks(familyId, childIds),
        getHoursLogForFamilyBetween(familyId, rangeStart, rangeEnd),
      ]);
      if (requestGeneration !== reloadGeneration.current) return;
      setEvents(expandRecurringFamilyEvents(nextEvents, rangeStart, rangeEnd));
      setScheduleRows(nextSchedule);
      setChildPlans((current) => mergeChildPlanSnapshots(current, nextPlans));
      setSourceLinks(nextSourceLinks);
      setHoursRows(nextHoursRows);
      setError(null);
    } catch (cause) {
      if (requestGeneration !== reloadGeneration.current) return;
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      if (requestGeneration === reloadGeneration.current) {
        setLoading(false);
      }
    }
  }, [familyId, children, rangeStart, rangeEnd]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  useEffect(() => () => {
    for (const timer of reconciliationTimers.current) clearTimeout(timer);
    reconciliationTimers.current.clear();
    reconciliationScheduled.current = false;
  }, []);

  const reconcileAfterAmbiguousWrite = useCallback(async () => {
    await reload();
    if (reconciliationScheduled.current) return;
    reconciliationScheduled.current = true;
    let remaining = 2;
    for (const delayMs of [1_500, 5_000]) {
      const timer = setTimeout(() => {
        reconciliationTimers.current.delete(timer);
        void reload();
        remaining -= 1;
        if (remaining === 0) reconciliationScheduled.current = false;
      }, delayMs);
      reconciliationTimers.current.add(timer);
    }
  }, [reload]);

  const applyActivityCheck = useCallback((
    target: { childId: string; subjectId: string },
    outcome: PlanActivityCheckApplied,
  ) => {
    setChildPlans((current) =>
      mergeAppliedPlanActivityCheck(current, target, outcome),
    );
  }, []);

  return {
    events,
    scheduleRows,
    childPlans,
    sourceLinks,
    hoursRows,
    loading,
    error,
    reload,
    reconcileAfterAmbiguousWrite,
    applyActivityCheck,
  };
}
