import type { AppData } from "./app-data";
import type { FamilyEventRow } from "./family-events";
import type { HoursEntry } from "./hours-view";
import type { PlannerLearningActivity } from "./planner-learning-activities";
import type { PlanActivityScheduleRow } from "./plan-schedule";
import { effectiveTimeZone } from "./time-zone";
import { monthGridRangeForDate, parsePlannerDate, parsePlannerView, todayDateOnly, weekRangeForDate } from "./unified-planner";

export interface WorkspacePlannerData {
  kids: { id: string; name: string; avatar_url: string | null; birth_month: string; reportToken: string | null }[];
  plans: AppData["plans"];
  familyEvents: FamilyEventRow[];
  scheduledActivities: PlanActivityScheduleRow[];
  learningActivities: PlannerLearningActivity[];
  hoursEntries: HoursEntry[];
  timeZone: string;
  now: string;
  today: string;
  activeDate: string;
  view: "day" | "week" | "month";
}

export interface WorkspacePlannerReaders {
  events(familyId: string, start: string, end: string): Promise<FamilyEventRow[]>;
  schedule(familyId: string, start: string, end: string): Promise<PlanActivityScheduleRow[]>;
  learning(familyId: string, start: string, end: string): Promise<PlannerLearningActivity[]>;
  hours(familyId: string, start: string, end: string, children: AppData["children"]): Promise<HoursEntry[]>;
}

/** Caller-authenticated data is the only source of family identity. A failed read fails the whole snapshot. */
export async function loadWorkspacePlanner(data: AppData, query: URLSearchParams, readers: WorkspacePlannerReaders, now = new Date()): Promise<WorkspacePlannerData> {
  const timeZone = effectiveTimeZone(data.family.time_zone);
  const today = todayDateOnly(now, timeZone);
  const activeDate = parsePlannerDate(query.get("date") ?? undefined, today);
  const requestedView = parsePlannerView(query.get("view") ?? undefined);
  const view = requestedView === "hours" ? "day" : requestedView;
  const range = view === "month" ? monthGridRangeForDate(activeDate, today) : weekRangeForDate(activeDate);
  const args = [data.family.id, range.start, range.end] as const;
  const [familyEvents, scheduledActivities, learningActivities, hoursEntries] = await Promise.all([
    readers.events(...args), readers.schedule(...args), readers.learning(...args), readers.hours(...args, data.children),
  ]);
  return { kids: data.children.map(({ id, name, avatar_url, birth_month }) => ({ id, name, avatar_url, birth_month, reportToken: data.reports.get(id)?.token ?? null })), plans: data.plans,
    familyEvents, scheduledActivities, learningActivities, hoursEntries, timeZone, now: now.toISOString(), today, activeDate, view };
}
