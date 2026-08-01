export interface MonthPlanPreviewActivity {
  text: string;
  scheduledDate: string | null;
  reusedMaterialId: string | null;
}

export interface MonthPlanPreviewWeek {
  week: number;
  focus: string;
  activities: MonthPlanPreviewActivity[];
}

export interface MonthPlanPreviewChild {
  childId: string;
  childName: string;
  targets: string[];
  weeks: MonthPlanPreviewWeek[];
  unresolvedChoices: string[];
}

export interface MonthPlanPreviewConflict {
  childId: string;
  childName: string;
  scheduledDate: string;
  activity: string;
  commitment: string;
}

export interface MonthPlanPreview {
  draftId: string;
  revision: number;
  monthStart: string;
  title: string;
  children: MonthPlanPreviewChild[];
  conflicts: MonthPlanPreviewConflict[];
  unscheduledItems: string[];
  unresolvedChoices: string[];
  restoredFrom: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : null;
}

function parseActivity(value: unknown): MonthPlanPreviewActivity | null {
  if (!isRecord(value) || typeof value.text !== "string") return null;
  if (value.scheduledDate !== null && typeof value.scheduledDate !== "string") return null;
  if (value.reusedMaterialId !== null && typeof value.reusedMaterialId !== "string") return null;
  return {
    text: value.text,
    scheduledDate: value.scheduledDate,
    reusedMaterialId: value.reusedMaterialId,
  };
}

function parseWeek(value: unknown): MonthPlanPreviewWeek | null {
  if (!isRecord(value) || !Number.isInteger(value.week) || typeof value.focus !== "string") {
    return null;
  }
  if (!Array.isArray(value.activities)) return null;
  const activities = value.activities.map(parseActivity);
  if (activities.some((entry) => entry === null)) return null;
  return {
    week: value.week as number,
    focus: value.focus,
    activities: activities as MonthPlanPreviewActivity[],
  };
}

function parseChild(value: unknown): MonthPlanPreviewChild | null {
  if (
    !isRecord(value)
    || typeof value.childId !== "string"
    || typeof value.childName !== "string"
    || !Array.isArray(value.weeks)
  ) {
    return null;
  }
  const targets = strings(value.targets);
  const unresolvedChoices = strings(value.unresolvedChoices);
  const weeks = value.weeks.map(parseWeek);
  if (!targets || !unresolvedChoices || weeks.some((entry) => entry === null)) return null;
  return {
    childId: value.childId,
    childName: value.childName,
    targets,
    weeks: weeks as MonthPlanPreviewWeek[],
    unresolvedChoices,
  };
}

function parseConflict(value: unknown): MonthPlanPreviewConflict | null {
  if (
    !isRecord(value)
    || typeof value.childId !== "string"
    || typeof value.childName !== "string"
    || typeof value.scheduledDate !== "string"
    || typeof value.activity !== "string"
    || typeof value.commitment !== "string"
  ) {
    return null;
  }
  return value as unknown as MonthPlanPreviewConflict;
}

export function parseMonthPlanPreview(value: unknown): MonthPlanPreview | null {
  if (
    !isRecord(value)
    || typeof value.draftId !== "string"
    || !Number.isInteger(value.revision)
    || typeof value.monthStart !== "string"
    || typeof value.title !== "string"
    || !Array.isArray(value.children)
    || !Array.isArray(value.conflicts)
  ) {
    return null;
  }
  const children = value.children.map(parseChild);
  const conflicts = value.conflicts.map(parseConflict);
  const unscheduledItems = strings(value.unscheduledItems);
  const unresolvedChoices = strings(value.unresolvedChoices);
  if (
    children.some((entry) => entry === null)
    || conflicts.some((entry) => entry === null)
    || !unscheduledItems
    || !unresolvedChoices
    || (value.restoredFrom !== null && !Number.isInteger(value.restoredFrom))
  ) {
    return null;
  }
  return {
    draftId: value.draftId,
    revision: value.revision as number,
    monthStart: value.monthStart,
    title: value.title,
    children: children as MonthPlanPreviewChild[],
    conflicts: conflicts as MonthPlanPreviewConflict[],
    unscheduledItems,
    unresolvedChoices,
    restoredFrom: value.restoredFrom as number | null,
  };
}
