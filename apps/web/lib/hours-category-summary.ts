import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HOURS_SUBJECTS } from "./hours-model";
import { HoursSummaryReadError, validateHoursSummaryRecord, type HoursSummaryRequest } from "./hours-summary-reader";
import { mapDb } from "./map/db";

export type HoursCategorySummaryRequest = HoursSummaryRequest & { categoryId?: string; uncategorizedOnly?: boolean };
const categoryFields = z.object({ categoryId: z.uuid().nullable(), customLabel: z.string().refine(value => Array.from(value).length <= 40).nullable() });
const categorySummary = z.object({ subject: z.enum(HOURS_SUBJECTS), categoryId: z.uuid().nullable(), name: z.string().refine(value => Array.from(value).length <= 40).nullable(), minutes: z.number().int().positive() });

export function validateHoursCategorySummary(raw: unknown, familyId: string, request: HoursCategorySummaryRequest, now: Date) {
  // RPC refusals have no successful receipt fields. Preserve their reason first.
  if (raw && typeof raw === "object" && "status" in raw && raw.status !== "ready") {
    validateHoursSummaryRecord(raw, familyId, request, now);
  }
  const refuse = () => { throw new HoursSummaryReadError("invalid_receipt"); };
  if (!raw || typeof raw !== "object" || !("byCategory" in raw) || !("entries" in raw)) return refuse();
  const parsed = z.object({ byCategory: z.array(categorySummary).max(5000), entries: z.array(categoryFields.passthrough()).max(50) }).safeParse(raw);
  if (!parsed.success) return refuse();
  const { byCategory, entries } = parsed.data;
  const { byCategory: ignored, ...plain } = raw as Record<string, unknown>;
  void ignored;
  plain.entries = entries.map(({ categoryId, customLabel, ...entry }) => { void categoryId; void customLabel; return entry; });
  const base = validateHoursSummaryRecord(plain, familyId, request, now);
  const keys = new Set<string>();
  for (const row of byCategory) {
    const key = `${row.subject}:${row.categoryId ?? ""}`;
    if (keys.has(key) || (row.categoryId === null) !== (row.name === null)
      || (request.categoryId !== undefined && row.categoryId !== request.categoryId)
      || (request.uncategorizedOnly && row.categoryId !== null)) refuse();
    keys.add(key);
  }
  if (byCategory.reduce((sum, row) => sum + row.minutes, 0) !== base.totalMinutes) refuse();
  for (const subject of base.bySubject) if (byCategory.filter(row => row.subject === subject.subject).reduce((sum,row) => sum+row.minutes,0) !== subject.minutes) refuse();
  const sampleByCategory = new Map<string, number>();
  for (const entry of entries) {
    const row = byCategory.find(row => row.subject === entry.subject && row.categoryId === entry.categoryId);
    if (!row || row.name !== entry.customLabel) refuse();
    const key = `${entry.subject}:${entry.categoryId ?? ""}`;
    const total = (sampleByCategory.get(key) ?? 0) + Number(entry.minutes);
    sampleByCategory.set(key, total);
    if (total > row!.minutes) refuse();
  }
  return { ...base, byCategory, entries: base.entries.map((entry,index) => ({ ...entry, categoryId: entries[index].categoryId, customLabel: entries[index].customLabel })) };
}

export async function readHoursCategorySummary(access: { mode: "pinned"; familyId: string } | { mode: "caller"; familyId: string; db: SupabaseClient }, request: HoursCategorySummaryRequest, now = new Date()) {
  if ((request.categoryId !== undefined && !z.uuid().safeParse(request.categoryId).success) || (request.categoryId && request.uncategorizedOnly)) throw new HoursSummaryReadError("invalid");
  const p = { target_family_id: access.familyId, requested_period: request.period ?? "week", target_child_id: request.childId ?? null, include_shared: request.includeShared ?? true, from_on: request.from ?? null, through_on: request.through ?? null, target_subject: request.subject ?? null, entry_limit: request.limit ?? 20, reference_at: now.toISOString(), target_category_id: request.categoryId ?? null, uncategorized_only: request.uncategorizedOnly ?? false };
  let raw: unknown;
  if (access.mode === "caller") {
    const { data, error } = await access.db.rpc("read_hours_category_summary", p).abortSignal(AbortSignal.timeout(15_000));
    if (error) throw new HoursSummaryReadError("unavailable");
    raw = data;
  } else raw = await mapDb().begin("read only", async tx => {
    await tx`set local statement_timeout='15s'`;
    return (await tx`select public.read_hours_category_summary(${p.target_family_id}::uuid,${p.requested_period},${p.target_child_id}::uuid,${p.include_shared},${p.from_on}::text,${p.through_on}::text,${p.target_subject}::text,${p.entry_limit},${p.reference_at}::timestamptz,${p.target_category_id}::uuid,${p.uncategorized_only}) as record`)[0]?.record;
  });
  return validateHoursCategorySummary(raw, access.familyId, request, now);
}
