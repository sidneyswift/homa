/**
 * The task-kind registry (plans/2026-07-10-homa-tasks-and-nightly-research.md
 * §1): a proactive loop is a registry entry here plus rows in
 * agent_schedules, never a new system. Family-scoped kinds run through
 * the hourly dispatcher (agent/schedules/dispatch.ts); fleet-scoped work
 * (fleet_research) has its own authored schedule and only shares the run
 * record. Adding a kind means: entry here, seeding rule in
 * lib/tasks/store.ts, message builder in the dispatcher, delivery branch
 * in the dispatch channel, events in the registry.
 */

export const FAMILY_TASK_KINDS = [
  "journal_prompt",
  "morning_brief",
  "custom",
] as const;
export type FamilyTaskKind = (typeof FAMILY_TASK_KINDS)[number];

export const TASK_RUN_KINDS = [...FAMILY_TASK_KINDS, "fleet_research"] as const;
export type TaskRunKind = (typeof TASK_RUN_KINDS)[number];

export const EVERY_DAY: readonly number[] = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS_MON_FRI: readonly number[] = [1, 2, 3, 4, 5];

export interface FamilyTaskKindConfig {
  /** Wall-clock hour in the family's own zone. Custom rows override. */
  defaultLocalHour: number;
  /** 0 = Sunday .. 6 = Saturday. Custom rows override. */
  defaultWeekdays: readonly number[];
  /**
   * How many hours past the scheduled local hour a claim may still
   * deliver. null = whenever due (the journal's original behavior). The
   * morning brief refuses to become an afternoon text: a run claimed
   * past the window records `skipped` and the schedule advances.
   */
  deliveryWindowHours: number | null;
  /** The run row's title, which is what the tab's history feed shows. */
  runTitle: string;
  /** The founder kill switch for this kind (seeding AND claiming). */
  enabled(): boolean;
}

export const TASK_KIND_CONFIG: Record<FamilyTaskKind, FamilyTaskKindConfig> = {
  journal_prompt: {
    defaultLocalHour: 20,
    defaultWeekdays: EVERY_DAY,
    // 8pm to 11pm local. GW-4 had no window because claims could only
    // ever run an hour late; the live E2E (2026-07-10) proved a stale
    // due row otherwise becomes a late-night message after downtime
    // (three real families got 11pm journal emails from leftover rows).
    deliveryWindowHours: 3,
    runTitle: "Evening check-in",
    enabled: () => process.env.JOURNAL_PROMPT_ENABLED === "true",
  },
  morning_brief: {
    defaultLocalHour: 9,
    defaultWeekdays: WEEKDAYS_MON_FRI,
    deliveryWindowHours: 3,
    runTitle: "Morning research brief",
    enabled: () => process.env.MORNING_BRIEF_ENABLED === "true",
  },
  custom: {
    defaultLocalHour: 9,
    defaultWeekdays: EVERY_DAY,
    deliveryWindowHours: null,
    runTitle: "Your task",
    enabled: () => true,
  },
};

export function enabledFamilyTaskKinds(): FamilyTaskKind[] {
  return FAMILY_TASK_KINDS.filter((kind) => TASK_KIND_CONFIG[kind].enabled());
}
