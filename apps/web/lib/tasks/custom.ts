import { z } from "zod";

import { mapDb } from "../map/db";
import { TASK_KIND_CONFIG, type FamilyTaskKind } from "./kinds";
import { nextTaskRunInstant } from "./time";

/**
 * Parent-managed task rows (HT-6, M3-08 pulled forward): the tab's
 * server actions and the chat CRUD tools both land here, so the rules
 * live once. familyId always arrives from the caller's own auth context
 * (getMyFamily on web, session attributes on chat), never from a form or
 * the model. Writes run on the server connection because agent_schedules
 * has no Data API write policies on purpose.
 */

export const MAX_CUSTOM_TASKS_PER_FAMILY = 10;

const taskWeekdaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .transform((weekdays) => [...new Set(weekdays)].sort((left, right) => left - right));

export const customTaskInputSchema = z.object({
  label: z.string().trim().min(3).max(60),
  prompt: z.string().trim().min(10).max(1000),
  weekdays: taskWeekdaysSchema,
  localHour: z.number().int().min(0).max(23),
  deliveryPref: z.enum(["text", "email", "none"]),
});
export type CustomTaskInput = z.infer<typeof customTaskInputSchema>;

export interface FamilyTaskRow {
  id: string;
  kind: FamilyTaskKind;
  label: string | null;
  prompt: string | null;
  localHour: number;
  weekdays: number[];
  deliveryPref: "text" | "email" | "none";
  paused: boolean;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdBy: "system" | "parent" | "homa";
}

function toRow(row: {
  id: string;
  kind: FamilyTaskKind;
  label: string | null;
  prompt: string | null;
  local_hour: number;
  weekdays: number[];
  delivery_pref: "text" | "email" | "none";
  paused_at: string | null;
  enabled: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_by: "system" | "parent" | "homa";
}): FamilyTaskRow {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    prompt: row.prompt,
    localHour: row.local_hour,
    weekdays: row.weekdays,
    deliveryPref: row.delivery_pref,
    paused: row.paused_at !== null,
    enabled: row.enabled,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    createdBy: row.created_by,
  };
}

export async function listFamilyTasks(familyId: string): Promise<FamilyTaskRow[]> {
  const sql = mapDb();
  const rows = await sql<Parameters<typeof toRow>[0][]>`
    select id, kind, label, prompt, local_hour, weekdays, delivery_pref,
           paused_at::text as paused_at, enabled,
           next_run_at::text as next_run_at, last_run_at::text as last_run_at,
           created_by
    from public.agent_schedules
    where family_id = ${familyId}
    order by (kind != 'morning_brief'), (kind != 'journal_prompt'), created_at
  `;
  return rows.map(toRow);
}

async function familyTimeZone(familyId: string): Promise<string | null> {
  const sql = mapDb();
  const rows = await sql<{ time_zone: string | null }[]>`
    select time_zone from public.families where id = ${familyId}
  `;
  return rows[0]?.time_zone ?? null;
}

export async function createCustomTask(
  familyId: string,
  input: CustomTaskInput,
  createdBy: "parent" | "homa",
): Promise<{ ok: true; id: string } | { ok: false; note: string }> {
  const parsed = customTaskInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, note: parsed.error.issues[0]?.message ?? "Invalid task." };
  }
  const timeZone = await familyTimeZone(familyId);
  if (!timeZone) {
    return {
      ok: false,
      note: "The family's time zone is not set yet. Set it at /app/settings first so tasks run at the right hour.",
    };
  }
  const sql = mapDb();
  const existing = await sql<{ count: string }[]>`
    select count(*)::text as count from public.agent_schedules
    where family_id = ${familyId} and kind = 'custom'
  `;
  if (Number(existing[0]?.count ?? 0) >= MAX_CUSTOM_TASKS_PER_FAMILY) {
    return {
      ok: false,
      note: `This family already has ${MAX_CUSTOM_TASKS_PER_FAMILY} tasks, the limit. Delete one first.`,
    };
  }
  const nextRun = nextTaskRunInstant(
    timeZone,
    parsed.data.localHour,
    parsed.data.weekdays,
    new Date(),
  );
  const rows = await sql<{ id: string }[]>`
    insert into public.agent_schedules
      (family_id, kind, next_run_at, local_hour, weekdays, delivery_pref,
       label, prompt, created_by)
    values
      (${familyId}, 'custom', ${nextRun.toISOString()}, ${parsed.data.localHour},
       ${sql.array(parsed.data.weekdays)}::smallint[], ${parsed.data.deliveryPref},
       ${parsed.data.label}, ${parsed.data.prompt}, ${createdBy})
    returning id
  `;
  return { ok: true, id: rows[0].id };
}

export async function updateCustomTask(
  familyId: string,
  taskId: string,
  patch: Partial<CustomTaskInput>,
): Promise<{ ok: true } | { ok: false; note: string }> {
  const parsed = customTaskInputSchema.partial().safeParse(patch);
  if (!parsed.success) {
    return { ok: false, note: parsed.error.issues[0]?.message ?? "Invalid change." };
  }
  const sql = mapDb();
  const rows = await sql<{ id: string; local_hour: number; weekdays: number[] }[]>`
    select id, local_hour, weekdays from public.agent_schedules
    where id = ${taskId} and family_id = ${familyId} and kind = 'custom'
  `;
  const current = rows[0];
  if (!current) return { ok: false, note: "That task is not in this family." };

  const localHour = parsed.data.localHour ?? current.local_hour;
  const weekdays = parsed.data.weekdays ?? current.weekdays;
  const timeZone = await familyTimeZone(familyId);
  if (!timeZone) return { ok: false, note: "The family's time zone is not set yet." };
  const nextRun = nextTaskRunInstant(timeZone, localHour, weekdays, new Date());

  await sql`
    update public.agent_schedules
    set label = coalesce(${parsed.data.label ?? null}, label),
        prompt = coalesce(${parsed.data.prompt ?? null}, prompt),
        local_hour = ${localHour},
        weekdays = ${sql.array(weekdays)}::smallint[],
        delivery_pref = coalesce(${parsed.data.deliveryPref ?? null}, delivery_pref),
        next_run_at = ${nextRun.toISOString()}
    where id = ${taskId} and family_id = ${familyId} and kind = 'custom'
  `;
  return { ok: true };
}

export async function deleteCustomTask(
  familyId: string,
  taskId: string,
): Promise<{ ok: true } | { ok: false; note: string }> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    delete from public.agent_schedules
    where id = ${taskId} and family_id = ${familyId} and kind = 'custom'
    returning id
  `;
  return rows[0] ? { ok: true } : { ok: false, note: "That task is not in this family." };
}

/** The tab toggle, valid for every kind: paused_at is the parent's own
 * switch and outranks seeding hygiene. Unpausing a built-in recomputes
 * next_run_at so the task never fires instantly off a stale timestamp. */
export async function setTaskPaused(
  familyId: string,
  taskId: string,
  paused: boolean,
): Promise<{ ok: true } | { ok: false; note: string }> {
  const sql = mapDb();
  const rows = await sql<
    { id: string; kind: FamilyTaskKind; local_hour: number; weekdays: number[] }[]
  >`
    select id, kind, local_hour, weekdays from public.agent_schedules
    where id = ${taskId} and family_id = ${familyId}
  `;
  const task = rows[0];
  if (!task) return { ok: false, note: "That task is not in this family." };

  if (paused) {
    await sql`
      update public.agent_schedules set paused_at = now()
      where id = ${taskId} and family_id = ${familyId}
    `;
    return { ok: true };
  }

  const timeZone = await familyTimeZone(familyId);
  const config = TASK_KIND_CONFIG[task.kind];
  const nextRun = timeZone
    ? nextTaskRunInstant(
        timeZone,
        task.local_hour ?? config.defaultLocalHour,
        task.weekdays,
        new Date(),
      )
    : null;
  await sql`
    update public.agent_schedules
    set paused_at = null,
        next_run_at = coalesce(${nextRun ? nextRun.toISOString() : null}, next_run_at)
    where id = ${taskId} and family_id = ${familyId}
  `;
  return { ok: true };
}
