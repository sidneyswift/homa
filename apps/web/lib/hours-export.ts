import { isHoursSubject, type HoursSubject } from "./hours-model";
import { SUBJECT_LABELS } from "./hours-view";
import { mapDb } from "./map/db";

export interface HoursExportRow {
  happenedOn: string;
  childName: string | null;
  subject: HoursSubject;
  minutes: number;
  source: "chat" | "sms" | "call";
  note: string | null;
}

interface RawHoursExportRow {
  happened_on: string;
  child_name: string | null;
  subject: string;
  minutes: string;
  source: string;
  note: string | null;
}

function exportSource(value: string): HoursExportRow["source"] {
  return value === "sms" || value === "call" ? value : "chat";
}

/** Loads the complete record for an authenticated family. Unlike the screen,
 * the download has no display cap because it is the family's archive. */
export async function getHoursExportForFamily(familyId: string): Promise<HoursExportRow[]> {
  const sql = mapDb();
  const rows = await sql<RawHoursExportRow[]>`
    select h.happened_on::text as happened_on,
           c.name as child_name,
           h.subject,
           h.minutes::text as minutes,
           h.source,
           h.note
    from public.hours_log h
    left join public.children c
      on c.id = h.child_id
     and c.family_id = h.family_id
    where h.family_id = ${familyId}
    order by h.happened_on asc, h.created_at asc, h.id asc
  `;
  return rows.map((row) => {
    const minutes = Number(row.minutes);
    if (!Number.isInteger(minutes) || minutes < 1) {
      throw new Error("hours export found an invalid duration");
    }
    return {
      happenedOn: row.happened_on,
      childName: row.child_name,
      subject: isHoursSubject(row.subject) ? row.subject : "other",
      minutes,
      source: exportSource(row.source),
      note: row.note,
    };
  });
}

function spreadsheetSafe(value: string): string {
  return /^[=+\-@\t\r]/u.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number): string {
  const safe = spreadsheetSafe(String(value));
  return `"${safe.replaceAll('"', '""')}"`;
}

function decimalHours(minutes: number): string {
  return String(Number((minutes / 60).toFixed(2)));
}

export function renderHoursCsv(rows: readonly HoursExportRow[]): string {
  const header = ["Date", "Child", "Subject", "Minutes", "Hours", "Source", "Note"];
  const lines = rows.map((row) => [
    row.happenedOn,
    row.childName ?? "Whole family",
    SUBJECT_LABELS[row.subject],
    row.minutes,
    decimalHours(row.minutes),
    row.source,
    row.note ?? "",
  ]);
  return `\uFEFF${[header, ...lines].map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
