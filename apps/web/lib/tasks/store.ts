import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";
import {
  TASK_KIND_CONFIG,
  enabledFamilyTaskKinds,
  type FamilyTaskKind,
  type TaskRunKind,
} from "./kinds";
import { localDateKey, localHourOf, nextTaskRunInstant } from "./time";

/**
 * The task framework's storage (HT-1, generalizing GW-4's journal-only
 * schedule-store). agent_schedules holds one row per family task;
 * homa_task_runs holds one row per run and doubles as the at-least-once
 * outbox. Everything here runs on the server connection; familyId always
 * arrives from auth context or the dispatcher's own seeded rows, never
 * from model input (BUILD.md law #1).
 *
 * Semantics the dispatcher depends on:
 *   - seeding is idempotent and self-healing per kind; it never touches
 *     paused_at (the parent's switch outranks hygiene);
 *   - claimDue takes an atomic lease (update ... returning), so two
 *     overlapping ticks never wake the same family twice;
 *   - beginTaskRun is the outbox: a redelivered claim on the same local
 *     day hits the partial unique index and returns null;
 *   - advance moves next_run_at to the NEXT allowed weekday hour in the
 *     family's own zone; release retries on the next tick.
 */

export interface DueFamilyTask {
  scheduleId: string;
  familyId: string;
  kind: FamilyTaskKind;
  timeZone: string;
  localHour: number;
  weekdays: number[];
  deliveryPref: "text" | "email" | "none";
  label: string | null;
  prompt: string | null;
  parentFirstName: string | null;
  kidPhrase: string;
  /** Every linked number, oldest first (multi-parent v0: one per adult;
   * SMS delivery reaches each of them). Empty when none is linked. */
  phoneNumbers: string[];
  email: string | null;
}

const SEEDABLE_KINDS = ["journal_prompt", "morning_brief"] as const;
type SeedableKind = (typeof SEEDABLE_KINDS)[number];

/** Eligibility SQL per built-in kind. Both require email + zone + kids +
 * a 20-hour-old family; the brief additionally requires a scored report,
 * because a brief with nothing real to say teaches families to ignore
 * it. Kept as one function so the two rules stay side by side. */
async function seedKind(kind: SeedableKind, now: Date): Promise<void> {
  const sql = mapDb();
  const config = TASK_KIND_CONFIG[kind];

  const requireReport = kind === "morning_brief";
  const optOutFilter = kind === "journal_prompt";

  const eligible = await sql<{ id: string; time_zone: string }[]>`
    select f.id, f.time_zone from public.families f
    where f.email is not null
      and f.time_zone is not null
      and f.created_at < now() - interval '20 hours'
      and (${!optOutFilter} or f.journal_opt_out_at is null)
      and exists (select 1 from public.children c where c.family_id = f.id)
      and (
        ${!requireReport}
        or exists (
          select 1 from public.child_reports r
          join public.children c on c.id = r.child_id
          where c.family_id = f.id
        )
      )
      and not exists (
        select 1 from public.agent_schedules s
        where s.family_id = f.id and s.kind = ${kind}
      )
  `;
  for (const family of eligible) {
    try {
      const nextRun = nextTaskRunInstant(
        family.time_zone,
        config.defaultLocalHour,
        config.defaultWeekdays,
        now,
      );
      await sql`
        insert into public.agent_schedules
          (family_id, kind, next_run_at, local_hour, weekdays, delivery_pref, created_by)
        values
          (${family.id}, ${kind}, ${nextRun.toISOString()},
           ${config.defaultLocalHour},
           ${sql.array(config.defaultWeekdays as number[])}::smallint[],
           'text', 'system')
        on conflict do nothing
      `;
    } catch (error) {
      console.error(
        `task seed (${kind}) failed for family ${family.id}:`,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  // No-longer-eligible rows go quiet; returners wake up. paused_at is
  // the parent's own switch and is deliberately never written here.
  await sql`
    update public.agent_schedules s
    set enabled = false
    from public.families f
    where s.family_id = f.id and s.kind = ${kind} and s.enabled
      and (f.email is null or f.time_zone is null
           or (${optOutFilter} and f.journal_opt_out_at is not null))
  `;
  await sql`
    update public.agent_schedules s
    set enabled = true
    from public.families f
    where s.family_id = f.id and s.kind = ${kind} and not s.enabled
      and f.email is not null and f.time_zone is not null
      and (${!optOutFilter} or f.journal_opt_out_at is null)
  `;
}

/** Idempotent seeding + hygiene for every enabled built-in kind, run
 * every dispatcher tick before claiming. */
export async function seedFamilyTaskSchedules(now = new Date()): Promise<void> {
  const enabled = new Set(enabledFamilyTaskKinds());
  for (const kind of SEEDABLE_KINDS) {
    if (!enabled.has(kind)) continue;
    await seedKind(kind, now);
  }
}

/** Atomically leases due rows across enabled kinds and returns
 * delivery-ready jobs with their family context. */
export async function claimDueFamilyTasks(options: {
  now: Date;
  limit: number;
  leaseForMs: number;
}): Promise<DueFamilyTask[]> {
  const kinds = enabledFamilyTaskKinds();
  if (kinds.length === 0) return [];
  const sql = mapDb();
  const leaseUntil = new Date(options.now.getTime() + options.leaseForMs).toISOString();
  const rows = await sql<
    {
      schedule_id: string;
      family_id: string;
      kind: FamilyTaskKind;
      time_zone: string;
      local_hour: number;
      weekdays: number[];
      delivery_pref: "text" | "email" | "none";
      label: string | null;
      prompt: string | null;
      first_name: string | null;
      parent_display_name: string | null;
      email: string | null;
      phone_numbers: string[];
      child_names: string[];
    }[]
  >`
    with claimed as (
      update public.agent_schedules s
      set lease_until = ${leaseUntil}
      where s.id in (
        select id from public.agent_schedules
        where kind = any(${sql.array(kinds)}) and enabled
          and paused_at is null
          and next_run_at <= ${options.now.toISOString()}
          and (lease_until is null or lease_until < ${options.now.toISOString()})
        order by next_run_at
        limit ${options.limit}
        for update skip locked
      )
      returning s.id, s.family_id, s.kind, s.local_hour, s.weekdays,
                s.delivery_pref, s.label, s.prompt
    )
    select claimed.id as schedule_id, claimed.kind, claimed.local_hour,
           claimed.weekdays, claimed.delivery_pref, claimed.label,
           claimed.prompt, f.id as family_id, f.time_zone,
           f.first_name, f.parent_display_name, f.email,
           coalesce(
             (select array_agg(p.phone_e164 order by p.created_at)
              from public.family_phones p where p.family_id = f.id),
             '{}'
           ) as phone_numbers,
           coalesce(
             (select array_agg(c.name order by c.created_at)
              from public.children c where c.family_id = f.id),
             '{}'
           ) as child_names
    from claimed
    join public.families f on f.id = claimed.family_id
    where f.time_zone is not null
  `;
  return rows.map((row) => ({
    scheduleId: row.schedule_id,
    familyId: row.family_id,
    kind: row.kind,
    timeZone: row.time_zone,
    localHour: row.local_hour,
    weekdays: row.weekdays,
    deliveryPref: row.delivery_pref,
    label: row.label,
    prompt: row.prompt,
    parentFirstName: row.parent_display_name ?? row.first_name,
    kidPhrase: row.child_names.length === 1 ? row.child_names[0] : "the kids",
    phoneNumbers: row.phone_numbers,
    email: row.email,
  }));
}

/** True when this claim is still inside the kind's delivery window
 * (e.g. the brief's 9am to noon). Kinds with a null window always pass. */
export function withinDeliveryWindow(task: DueFamilyTask, now: Date): boolean {
  const window = TASK_KIND_CONFIG[task.kind].deliveryWindowHours;
  if (window === null) return true;
  const hour = localHourOf(task.timeZone, now);
  return hour >= task.localHour && hour < task.localHour + window;
}

/**
 * The outbox: inserts this run's row for the family's current local day.
 * Returns the run id, or null when a run for (schedule, day) already
 * exists, which is exactly the at-least-once redelivery case.
 */
export async function beginTaskRun(
  task: DueFamilyTask,
  now: Date,
  options?: { status?: "running" | "skipped"; error?: string },
): Promise<string | null> {
  const sql = mapDb();
  const title = task.kind === "custom"
    ? (task.label ?? TASK_KIND_CONFIG.custom.runTitle)
    : TASK_KIND_CONFIG[task.kind].runTitle;
  try {
    const rows = await sql<{ id: string }[]>`
      insert into public.homa_task_runs
        (family_id, schedule_id, kind, status, scheduled_for, title, error)
      values
        (${task.familyId}, ${task.scheduleId}, ${task.kind},
         ${options?.status ?? "running"},
         ${localDateKey(task.timeZone, now)}, ${title},
         ${options?.error ?? null})
      returning id
    `;
    return rows[0]?.id ?? null;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return null;
    throw error;
  }
}

/** The dispatch channel's write: the composed text and where it went. */
export async function markTaskRunDelivered(
  runId: string,
  outcome: { summary: string; channel: "sms" | "email" | "none" },
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.homa_task_runs
    set summary = ${outcome.summary.slice(0, 4000)},
        delivered_channel = ${outcome.channel}
    where id = ${runId}
  `;
}

/** Appends artifact references (knowledge rows cited, materials made). */
export async function appendTaskRunArtifacts(
  runId: string,
  artifacts: Array<{ kind: string; id: string; title?: string }>,
): Promise<void> {
  if (artifacts.length === 0) return;
  const sql = mapDb();
  await sql`
    update public.homa_task_runs
    set artifacts = artifacts || ${sql.json(artifacts as never)}
    where id = ${runId}
  `;
}

export async function finishTaskRun(
  runId: string,
  outcome: {
    familyId: string | null;
    kind: TaskRunKind;
    status: "done" | "failed" | "skipped";
    error?: string;
    sessionId?: string;
  },
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.homa_task_runs
    set status = ${outcome.status},
        error = coalesce(${outcome.error ?? null}, error),
        session_id = coalesce(${outcome.sessionId ?? null}, session_id),
        finished_at = now()
    where id = ${runId}
  `;
  await emitMapEvent("tasks.run_completed", {
    ...(outcome.familyId ? { family_id: outcome.familyId } : {}),
    kind: outcome.kind,
    status: outcome.status,
  });
}

/**
 * The safety net for runs whose session never reached a deliverable
 * message (crash, refusal, model outage): receive() resolves at session
 * START, so nobody is waiting on the other end. Any run still 'running'
 * after two hours is failed here, one tick at a time, with its event.
 */
export async function reapStaleTaskRuns(now = new Date()): Promise<void> {
  const sql = mapDb();
  const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const stale = await sql<{ id: string; family_id: string | null; kind: TaskRunKind }[]>`
    select id, family_id, kind from public.homa_task_runs
    where status = 'running' and started_at < ${cutoff}
    limit 25
  `;
  for (const run of stale) {
    await finishTaskRun(run.id, {
      familyId: run.family_id,
      kind: run.kind,
      status: "failed",
      error: "run never completed (reaped after 2 hours)",
    });
  }
}

export async function advanceTaskSchedule(task: DueFamilyTask, now = new Date()): Promise<void> {
  const sql = mapDb();
  const nextRun = nextTaskRunInstant(task.timeZone, task.localHour, task.weekdays, now);
  await sql`
    update public.agent_schedules
    set next_run_at = ${nextRun.toISOString()}, last_run_at = now(), lease_until = null
    where id = ${task.scheduleId}
  `;
}

export async function releaseTaskSchedule(task: DueFamilyTask): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.agent_schedules set lease_until = null where id = ${task.scheduleId}
  `;
}

/** A fleet run has no schedule row and no family; the run record is its
 * audit trail and the revert script's handle. */
export async function beginFleetRun(title: string): Promise<string> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    insert into public.homa_task_runs (family_id, schedule_id, kind, status, title)
    values (null, null, 'fleet_research', 'running', ${title.slice(0, 120)})
    returning id
  `;
  return rows[0].id;
}

export async function updateFleetRunSummary(runId: string, summary: string): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.homa_task_runs set summary = ${summary.slice(0, 4000)} where id = ${runId}
  `;
}
