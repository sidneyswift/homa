import { createHash } from "node:crypto";

import {
  isHoursSubject,
  requireHoursSource,
  type HoursSource,
  type HoursSubject,
} from "./hours-model";
import {
  ALL_HOURS_RECORDS,
  deriveRecordedLearningDays,
  matchesHoursRecordScope,
  summarizeRecordedLearningDays,
  type HoursRecordChild,
  type HoursRecordScope,
  type RecordedLearningDay,
} from "./hours-record-scope";
import { SUBJECT_LABELS } from "./hours-view";
import { mapDb } from "./map/db";

export interface HoursExportRow {
  id: string;
  childId: string | null;
  happenedOn: string;
  childName: string | null;
  subject: HoursSubject;
  customLabel: string | null;
  programName?: string | null;
  minutes: number;
  source: HoursSource;
  note: string | null;
}

interface RawHoursExportRow {
  id: string;
  child_id: string | null;
  happened_on: string;
  child_name: string | null;
  subject: string;
  custom_label: string | null;
  program_name: string | null;
  minutes: string;
  source: string;
  note: string | null;
}

export class HoursRecordChildNotFound extends Error {}

export interface HoursExportRecord {
  rows: HoursExportRow[];
  children: HoursRecordChild[];
}

/** Server-authenticated family scope, rechecked child ownership, one read-only
 * snapshot. The archive has no display-row cap. Timeout fails the whole read. */
export async function getHoursExportRecord(
  familyId: string,
  scope: HoursRecordScope = ALL_HOURS_RECORDS,
): Promise<HoursExportRecord> {
  const sql = mapDb();
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    await tx`set local statement_timeout = '15s'`;
    const children = await tx<HoursRecordChild[]>`
      select id, name from public.children where family_id = ${familyId} order by created_at, id
    `;
    if (
      scope.childId !== null &&
      !children.some((child) => child.id === scope.childId)
    ) {
      throw new HoursRecordChildNotFound("Hours child is not in this family.");
    }
    const raw = await tx<RawHoursExportRow[]>`
    select h.id, h.child_id, h.happened_on::text as happened_on,
           c.name as child_name,
           h.subject,
           h.custom_label,
           (select p.name from public.planner_learning_activity_hours l
            join public.learning_program_occurrences o on o.activity_id=l.activity_id and o.family_id=l.family_id
            join public.learning_programs p on p.id=o.program_id and p.family_id=o.family_id
            where l.hours_entry_id=h.id and l.family_id=h.family_id limit 1) as program_name,
           h.minutes::text as minutes,
           h.source,
           h.note
    from public.hours_log h
    left join public.children c
      on c.id = h.child_id
     and c.family_id = h.family_id
    where h.family_id = ${familyId}
      and (${scope.from}::date is null or h.happened_on >= ${scope.from}::date)
      and (${scope.through}::date is null or h.happened_on <= ${scope.through}::date)
      and (${scope.includeShared}::boolean or h.child_id is not null)
      and (${scope.childId}::uuid is null or h.child_id = ${scope.childId}::uuid
           or (${scope.includeShared}::boolean and h.child_id is null))
    order by h.happened_on asc, h.created_at asc, h.id asc
  `;
    const rows = raw.map((row) => {
      const minutes = Number(row.minutes);
      if (!Number.isSafeInteger(minutes) || minutes < 1) {
        throw new Error("hours export found an invalid duration");
      }
      const subject = isHoursSubject(row.subject) ? row.subject : "other";
      return {
        id: row.id,
        childId: row.child_id,
        happenedOn: row.happened_on,
        childName: row.child_name,
        subject,
        customLabel: row.custom_label,
        programName: row.program_name,
        minutes,
        source: requireHoursSource(row.source),
        note: row.note,
      };
    });
    if (
      rows.some(
        (row) =>
          !matchesHoursRecordScope(row, scope) ||
          (row.childId !== null &&
            !children.some((child) => child.id === row.childId)),
      )
    ) {
      throw new Error(
        "Hours record scope did not match the requested family record.",
      );
    }
    return { rows, children };
  });
}

function spreadsheetSafe(value: string): string {
  return /^(?:\s*[=+\-@]|[\t\r\n])/u.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number): string {
  const safe = spreadsheetSafe(String(value));
  return `"${safe.replaceAll('"', '""')}"`;
}

function decimalHours(minutes: number): string {
  return String(Number((minutes / 60).toFixed(2)));
}

export function renderHoursCsv(rows: readonly HoursExportRow[]): string {
  const header = [
    "Date",
    "Child",
    "Child ID",
    "Subject",
    "Category",
    "Minutes",
    "Hours",
    "Source",
    "Note",
    "Entry ID",
    "Program",
  ];
  const lines = rows.map((row) => [
    row.happenedOn,
    row.childName ?? "Whole family",
    row.childId ?? "",
    SUBJECT_LABELS[row.subject],
    row.customLabel ?? "",
    row.minutes,
    decimalHours(row.minutes),
    row.source,
    row.note ?? "",
    row.id,
    row.programName ?? "",
  ]);
  return `\uFEFF${[header, ...lines].map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function renderRecordedDaysCsv(
  days: readonly RecordedLearningDay[],
): string {
  const header = [
    "Date",
    "Child",
    "Child ID",
    "Recorded learning days",
    "Minutes",
    "Hours",
    "Subjects",
  ];
  const lines = days.map((day) => [
    day.happenedOn,
    day.childName,
    day.childId ?? "",
    1,
    day.minutes,
    decimalHours(day.minutes),
    day.subjects
      .map((subject) =>
        isHoursSubject(subject) ? SUBJECT_LABELS[subject] : subject,
      )
      .join("; "),
  ]);
  return `\uFEFF${[header, ...lines].map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function hoursRecordRevision(
  record: HoursExportRecord,
  scope: HoursRecordScope,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({ scope, children: record.children, rows: record.rows }),
    )
    .digest("hex");
}

export function buildHoursRecordPreview(
  record: HoursExportRecord,
  scope: HoursRecordScope,
) {
  const days = deriveRecordedLearningDays(record.rows, record.children, scope);
  return {
    scope,
    revision: hoursRecordRevision(record, scope),
    entryCount: record.rows.length,
    totalMinutes: record.rows.reduce((sum, row) => sum + row.minutes, 0),
    recordedDays: new Set(record.rows.map((row) => row.happenedOn)).size,
    byChild: summarizeRecordedLearningDays(days, record.children, scope),
    entries: record.rows.slice(0, 20),
    previewLimit: 20,
  };
}

export type HoursRecordPreview = ReturnType<typeof buildHoursRecordPreview>;
