import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { isValidDateOnly } from "./compliance/deadlines";
import { HOURS_SUBJECTS } from "./hours-model";
import { matchesHoursRecordScope, parseHoursRecordRequest } from "./hours-record-scope";
import { resolveHoursWindow } from "./hours-summary";
import { mapDb } from "./map/db";
import { zonedDateString } from "./time-zone";

const number = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const dateOnly = z.string().refine(isValidDateOnly);
const nullableDate = dateOnly.nullable();
const childId = z.uuid().nullable();
const requestSchema = z.object({
  period: z.enum(["week", "month", "school_year", "all"]).default("week"),
  childId: z.uuid().transform(value => value.toLowerCase()).optional(), includeShared: z.boolean().default(true),
  from: z.string().max(10).optional(), through: z.string().max(10).optional(),
  subject: z.enum(HOURS_SUBJECTS).optional(), limit: z.number().int().min(1).max(50).default(20),
});
export type HoursSummaryRequest = z.input<typeof requestSchema>;
const resultSchema = z.object({
  status: z.literal("ready"), familyId: z.uuid(), timeZone: z.string().min(1).max(100),
  schoolYearStartOn: nullableDate, today: dateOnly,
  window: z.object({ from: nullableDate, through: nullableDate,
    period: z.enum(["week", "month", "school_year", "all", "custom"]), schoolYearFallback: z.boolean() }).strict(),
  children: z.array(z.object({ id: z.uuid(), name: z.string() }).strict()).max(1000),
  entryCount: number, totalMinutes: number, recordedDays: number, firstDay: nullableDate, lastDay: nullableDate,
  byEntryScope: z.array(z.object({ childId, minutes: number }).strict()).max(1001),
  bySubject: z.array(z.object({ subject: z.enum(HOURS_SUBJECTS), minutes: number }).strict()).max(HOURS_SUBJECTS.length),
  recordedDaysByChild: z.array(z.object({ childId, childName: z.string(), recordedDays: number, minutes: number }).strict()).max(1000),
  entries: z.array(z.object({ childId, subject: z.enum(HOURS_SUBJECTS), minutes: number.min(1).max(600),
    happenedOn: dateOnly, source: z.enum(["chat", "sms", "call"]), note: z.string().max(400).nullable(), noteTruncated: z.boolean() }).strict()).max(50),
}).strict();
export type HoursSummaryRecord = z.infer<typeof resultSchema>;

export class HoursSummaryReadError extends Error {
  constructor(readonly reason: "invalid" | "not_found" | "unavailable" | "invalid_receipt") {
    super(`Hours summary ${reason}. No complete total is available.`);
    this.name = "HoursSummaryReadError";
  }
}

function parameters(familyId: string, request: HoursSummaryRequest, now: Date) {
  const parsed = requestSchema.safeParse(request);
  if (!z.uuid().safeParse(familyId).success || !parsed.success || !Number.isFinite(now.getTime())) {
    throw new HoursSummaryReadError("invalid");
  }
  for (const value of [parsed.data.from, parsed.data.through]) {
    if (value !== undefined && value !== "" && !isValidDateOnly(value)) throw new HoursSummaryReadError("invalid");
  }
  return { input: parsed.data, rpc: {
    target_family_id: familyId.toLowerCase(), requested_period: parsed.data.period,
    target_child_id: parsed.data.childId ?? null, include_shared: parsed.data.includeShared,
    from_on: parsed.data.from ?? null, through_on: parsed.data.through ?? null,
    target_subject: parsed.data.subject ?? null, entry_limit: parsed.data.limit, reference_at: now.toISOString(),
  } };
}

/** Verify identity, full aggregate receipt, and the SQL mirror against the
 * canonical TypeScript calendar helper. Never infer full totals from sample rows. */
export function validateHoursSummaryRecord(raw: unknown, familyId: string, request: HoursSummaryRequest, now: Date): HoursSummaryRecord {
  const { input } = parameters(familyId, request, now);
  if (raw && typeof raw === "object" && "status" in raw && raw.status !== "ready") {
    throw new HoursSummaryReadError(raw.status === "not_found" ? "not_found" : raw.status === "invalid" ? "invalid" : "unavailable");
  }
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success) throw new HoursSummaryReadError("invalid_receipt");
  const r = parsed.data;
  const refuse = () => { throw new HoursSummaryReadError("invalid_receipt"); };
  if (r.familyId !== familyId.toLowerCase() || r.today !== zonedDateString(now, r.timeZone)) refuse();
  const window = resolveHoursWindow(input.period, r.today, r.schoolYearStartOn);
  const params = new URLSearchParams({ shared: input.includeShared ? "include" : "exclude" });
  if (input.childId !== undefined) params.set("child", input.childId);
  if (input.from !== undefined || window.from !== null) params.set("from", input.from ?? window.from!);
  params.set("through", input.through ?? window.through);
  const requested = parseHoursRecordRequest(params);
  if (!requested) throw new HoursSummaryReadError("invalid");
  const scope = requested.scope;
  const custom = input.from !== undefined || input.through !== undefined;
  if (r.window.from !== scope.from || r.window.through !== scope.through
    || r.window.period !== (custom ? "custom" : window.period)
    || r.window.schoolYearFallback !== (window.schoolYearFallback && !custom)) refuse();
  const roster = new Map(r.children.map(child => [child.id, child.name]));
  if (roster.size !== r.children.length || (input.childId !== undefined && !roster.has(input.childId))) refuse();
  const selected = r.children.filter(child => input.childId === undefined || child.id === input.childId);
  const expectedRecipients = selected.length > 0 ? selected : [{ id: null, name: "Whole family" }];
  if (r.recordedDaysByChild.length !== expectedRecipients.length) refuse();
  const assignedMinutes = new Map(r.byEntryScope.map(row => [row.childId, row.minutes]));
  r.recordedDaysByChild.forEach((child, index) => {
    const expectedMinutes = (assignedMinutes.get(child.childId) ?? 0)
      + (child.childId === null ? 0 : assignedMinutes.get(null) ?? 0);
    if (child.childId !== expectedRecipients[index].id || child.childName !== expectedRecipients[index].name
      || child.recordedDays > r.recordedDays || child.minutes !== expectedMinutes
      || child.recordedDays > child.minutes
      || (scope.childId !== null && child.recordedDays !== r.recordedDays)
      || (child.recordedDays === 0) !== (child.minutes === 0)) refuse();
  });
  if (new Set(r.byEntryScope.map(row => row.childId)).size !== r.byEntryScope.length
    || new Set(r.bySubject.map(row => row.subject)).size !== r.bySubject.length
    || r.byEntryScope.reduce((sum, row) => sum + row.minutes, 0) !== r.totalMinutes
    || r.bySubject.reduce((sum, row) => sum + row.minutes, 0) !== r.totalMinutes) refuse();
  for (const row of r.byEntryScope) {
    if ((row.childId !== null && !roster.has(row.childId)) || (row.childId === null && !scope.includeShared)
      || (scope.childId !== null && row.childId !== null && row.childId !== scope.childId)) refuse();
  }
  if (r.entryCount < r.recordedDays || r.totalMinutes < r.entryCount
    || r.totalMinutes > r.entryCount * 600
    || (r.entryCount === 0) !== (r.recordedDays === 0)
    || r.entries.length !== Math.min(input.limit, r.entryCount)
    || (r.entryCount === 0) !== (r.totalMinutes === 0)
    || (r.entryCount === 0) !== (r.firstDay === null && r.lastDay === null)) refuse();
  if (r.entryCount > 0 && (r.firstDay === null || r.lastDay === null || r.firstDay > r.lastDay
    || (scope.from !== null && r.firstDay < scope.from) || (scope.through !== null && r.lastDay > scope.through))) refuse();
  const sampleMinutes = r.entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const sampleDays = new Set(r.entries.map(entry => entry.happenedOn)).size;
  if (sampleMinutes > r.totalMinutes || sampleDays > r.recordedDays
    || (r.entries.length > 0 && r.entries[0].happenedOn !== r.lastDay)
    || (r.entries.length === r.entryCount && (sampleMinutes !== r.totalMinutes
      || sampleDays !== r.recordedDays || (r.entries.length > 0 && r.entries.at(-1)!.happenedOn !== r.firstDay)))) refuse();
  const sampleAssigned = new Map<string | null, number>();
  const sampleSubjects = new Map<string, number>();
  const subjectMinutes = new Map(r.bySubject.map(row => [row.subject as string, row.minutes]));
  for (const entry of r.entries) {
    sampleAssigned.set(entry.childId, (sampleAssigned.get(entry.childId) ?? 0) + entry.minutes);
    sampleSubjects.set(entry.subject, (sampleSubjects.get(entry.subject) ?? 0) + entry.minutes);
  }
  for (const [id, minutes] of sampleAssigned) if (minutes > (assignedMinutes.get(id) ?? 0)) refuse();
  for (const [subject, minutes] of sampleSubjects) if (minutes > (subjectMinutes.get(subject) ?? 0)) refuse();
  for (const [index, entry] of r.entries.entries()) {
    const noteLength = entry.note === null ? 0 : Array.from(entry.note).length;
    if ((entry.childId !== null && !roster.has(entry.childId)) || !matchesHoursRecordScope(entry, scope)
      || (input.subject !== undefined && entry.subject !== input.subject)
      || r.firstDay === null || r.lastDay === null || entry.happenedOn < r.firstDay || entry.happenedOn > r.lastDay
      || (index > 0 && entry.happenedOn > r.entries[index - 1].happenedOn)
      || noteLength > 200 || (entry.noteTruncated && noteLength !== 200)) refuse();
  }
  if (input.subject !== undefined && r.bySubject.some(row => row.subject !== input.subject)) refuse();
  return r;
}

/** Caller token is retained end to end. A scalar JSON RPC is one record, so a
 * PostgREST rowset cap cannot silently crop the aggregate or newest sample. */
export async function readHoursSummaryCaller(db: SupabaseClient, familyId: string, request: HoursSummaryRequest, now = new Date()): Promise<HoursSummaryRecord> {
  const { rpc } = parameters(familyId, request, now);
  const { data, error } = await db.rpc("read_hours_summary", rpc).abortSignal(AbortSignal.timeout(15_000));
  if (error || data === null) throw new HoursSummaryReadError("unavailable");
  return validateHoursSummaryRecord(data, familyId, request, now);
}

/** Same function, explicit authenticated family, SELECT only. The transaction's
 * statement timeout is set before the query, not as an ignored pooler startup option. */
export async function readHoursSummaryPinned(familyId: string, request: HoursSummaryRequest, now = new Date()): Promise<HoursSummaryRecord> {
  const { rpc } = parameters(familyId, request, now);
  let raw: unknown;
  try {
    raw = await mapDb().begin("read only", async tx => {
      await tx`set local statement_timeout = '15s'`;
      await tx`set local lock_timeout = '2s'`;
      const rows = await tx<{ record: unknown }[]>`select public.read_hours_summary(
        ${rpc.target_family_id}::uuid, ${rpc.requested_period}::text, ${rpc.target_child_id}::uuid,
        ${rpc.include_shared}::boolean, ${rpc.from_on}::text, ${rpc.through_on}::text,
        ${rpc.target_subject}::text, ${rpc.entry_limit}::integer, ${rpc.reference_at}::timestamptz
      ) as record`;
      return rows[0]?.record;
    });
  } catch { throw new HoursSummaryReadError("unavailable"); }
  return validateHoursSummaryRecord(raw, familyId, request, now);
}
