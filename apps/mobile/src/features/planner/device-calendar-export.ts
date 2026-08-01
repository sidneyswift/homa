import type { FamilyEventRecord } from "../../lib/family-events";
import type { ScheduledActivityView } from "./planner-model";

export type CalendarExportSourceKind = "family-event" | "plan-activity";

export interface CalendarExportRecurrence {
  frequency: "weekly";
  interval: number;
  /** Sunday is 0, matching JavaScript and Homa's schedule convention. */
  weekdays: number[];
  until: string | null;
}

export interface CalendarExportItem {
  sourceKey: string;
  sourceKind: CalendarExportSourceKind;
  title: string;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
  timeZone: string;
  notes: string | null;
  childScope: string;
  recurrence: CalendarExportRecurrence | null;
}

export interface CalendarCreatePayload {
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  timeZone: string;
  notes: string;
  url: string;
  recurrenceRule?: {
    frequency: "weekly";
    interval: number;
    endDate?: Date;
    daysOfTheWeek: { dayOfTheWeek: number }[];
  };
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY = /^([01]\d|2[0-3]):[0-5]\d$/;
const MS_PER_DAY = 86_400_000;

function assertDateOnly(value: string): void {
  if (!DATE_ONLY.test(value)) throw new Error(`Invalid calendar date: ${value}`);
}

function dateParts(value: string): [number, number, number] {
  assertDateOnly(value);
  const [year, month, day] = value.split("-").map(Number);
  return [year, month, day];
}

export function addCalendarDays(value: string, amount: number): string {
  const [year, month, day] = dateParts(value);
  const result = new Date(Date.UTC(year, month - 1, day) + amount * MS_PER_DAY);
  return [
    result.getUTCFullYear(),
    String(result.getUTCMonth() + 1).padStart(2, "0"),
    String(result.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function localDate(value: string): Date {
  const [year, month, day] = dateParts(value);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function partsInTimeZone(value: Date, timeZone: string): [number, number, number, number, number] {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const fields = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return [fields.year, fields.month, fields.day, fields.hour, fields.minute];
}

/**
 * Turns Homa's local planner date and time into a real instant without
 * letting the phone's current time zone move it. A DST gap is rejected
 * rather than silently changing a 2:30 appointment into 3:30.
 */
export function zonedDateTime(value: string, time: string, timeZone: string): Date {
  const [year, month, day] = dateParts(value);
  if (!TIME_ONLY.test(time)) throw new Error(`Invalid calendar time: ${time}`);
  const [hour, minute] = time.split(":").map(Number);
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(desiredUtc);

  for (let pass = 0; pass < 4; pass += 1) {
    const [actualYear, actualMonth, actualDay, actualHour, actualMinute] = partsInTimeZone(
      candidate,
      timeZone,
    );
    const actualUtc = Date.UTC(actualYear, actualMonth - 1, actualDay, actualHour, actualMinute);
    const correction = desiredUtc - actualUtc;
    if (correction === 0) return candidate;
    candidate = new Date(candidate.getTime() + correction);
  }

  throw new Error(`${value} at ${time} does not exist in ${timeZone}.`);
}

export function familyEventExportItem(
  event: FamilyEventRecord,
  childName: string | null,
  timeZone: string,
  recurrence: CalendarExportRecurrence | null = null,
): CalendarExportItem {
  return {
    sourceKey: `family-event/${event.id}`,
    sourceKind: "family-event",
    title: event.title,
    startsOn: event.starts_on,
    endsOn: event.ends_on,
    startTime: event.start_time,
    endTime: event.end_time,
    timeZone,
    notes: event.note,
    childScope: childName ?? "Whole family",
    recurrence,
  };
}

export function planActivityExportItem(
  activity: ScheduledActivityView,
  timeZone: string,
): CalendarExportItem {
  return {
    sourceKey: `plan-schedule/${activity.scheduleId}`,
    sourceKind: "plan-activity",
    title: `${activity.subjectName}: ${activity.text}`,
    startsOn: activity.scheduledDate,
    endsOn: activity.scheduledDate,
    startTime: null,
    endTime: null,
    timeZone,
    notes: `From ${activity.childName}'s ${activity.subjectName} plan.`,
    childScope: activity.childName,
    recurrence: null,
  };
}

function linkageUrl(item: CalendarExportItem): string {
  return `homa://planner?source=${encodeURIComponent(item.sourceKey)}`;
}

function recurrencePayload(item: CalendarExportItem): CalendarCreatePayload["recurrenceRule"] {
  if (!item.recurrence) return undefined;
  if (!Number.isInteger(item.recurrence.interval) || item.recurrence.interval < 1) {
    throw new Error("Calendar recurrence interval must be a positive whole number.");
  }
  if (
    item.recurrence.weekdays.length === 0
    || new Set(item.recurrence.weekdays).size !== item.recurrence.weekdays.length
    || item.recurrence.weekdays.some((weekday) => !Number.isInteger(weekday) || weekday < 0 || weekday > 6)
  ) {
    throw new Error("Calendar recurrence weekdays must be unique values from Sunday through Saturday.");
  }
  if (item.recurrence.until && item.recurrence.until < item.startsOn) {
    throw new Error("Calendar recurrence cannot end before it starts.");
  }
  return {
    frequency: "weekly",
    interval: item.recurrence.interval,
    daysOfTheWeek: item.recurrence.weekdays.map((weekday) => ({
      // EventKit uses Sunday=1 through Saturday=7.
      dayOfTheWeek: weekday + 1,
    })),
    ...(item.recurrence.until
      ? { endDate: zonedDateTime(item.recurrence.until, "23:59", item.timeZone) }
      : {}),
  };
}

export function calendarCreatePayload(item: CalendarExportItem): CalendarCreatePayload {
  const startTime = item.startTime;
  const allDay = startTime === null;
  const startDate = allDay
    ? localDate(item.startsOn)
    : zonedDateTime(item.startsOn, startTime, item.timeZone);
  const endDate = allDay
    ? localDate(addCalendarDays(item.endsOn, 1))
    : zonedDateTime(item.endsOn, item.endTime ?? startTime, item.timeZone);
  if (endDate.getTime() <= startDate.getTime()) {
    throw new Error(`The end of ${item.title} must be after its start.`);
  }

  const url = linkageUrl(item);
  const notes = [item.notes?.trim(), `Homa planner link: ${url}`].filter(Boolean).join("\n\n");
  return {
    title: item.title.trim(),
    startDate,
    endDate,
    allDay,
    timeZone: item.timeZone,
    notes,
    url,
    ...(item.recurrence ? { recurrenceRule: recurrencePayload(item) } : {}),
  };
}

export function calendarExportFingerprint(item: CalendarExportItem): string {
  const serialized = JSON.stringify(item);
  let hash = 2_166_136_261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `${item.sourceKey}:${(hash >>> 0).toString(36)}`;
}

export function recurrenceLabel(recurrence: CalendarExportRecurrence | null): string {
  if (!recurrence) return "Does not repeat";
  const cadence = recurrence.interval === 1 ? "Every week" : `Every ${recurrence.interval} weeks`;
  return recurrence.until ? `${cadence}, through ${recurrence.until}` : cadence;
}
