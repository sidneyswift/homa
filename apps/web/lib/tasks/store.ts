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
  /** The one adult this task delivers to (founder ruling 2026-07-12).
   * Null on legacy rows; delivery falls back to the account owner. */
  recipientMemberUserId: string | null;
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

  const eligible = await sql<
    { id: string; time_zone: string; owner_user_id: string | null }[]
  >`
    select f.id, f.time_zone,
      (select m.user_id from public.family_members m
       where m.family_id = f.id
       order by m.created_at
       limit 1) as owner_user_id
    from public.families f
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
      // The recipient is the account owner, the family's first member
      // (founder ruling 2026-07-12): built-in texts never auto-subscribe
      // an invited adult. seedPaused kinds arrive switched off; the
      // parent's card switch owns paused_at from here on (unpausing
      // recomputes next_run_at, so a months-later opt-in never fires
      // instantly off this stale timestamp).
      await sql`
        insert into public.agent_schedules
          (family_id, kind, next_run_at, local_hour, weekdays, delivery_pref,
           created_by, recipient_member_user_id, paused_at)
        values
          (${family.id}, ${kind}, ${nextRun.toISOString()},
           ${config.defaultLocalHour},
           ${sql.array(config.defaultWeekdays as number[])}::smallint[],
           'text', 'system', ${family.owner_user_id},
           ${config.seedPaused ? now.toISOString() : null})
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
           or (${optOutFilter} and f.journal_opt_out_at is not null)
           or not exists (select 1 from public.children c where c.family_id = f.id)
           or (
             ${requireReport}
             and not exists (
               select 1 from public.child_reports r
               join public.children c on c.id = r.child_id
               where c.family_id = f.id
             )
           ))
  `;
  await sql`
    update public.agent_schedules s
    set enabled = true
    from public.families f
    where s.family_id = f.id and s.kind = ${kind} and not s.enabled
      and f.email is not null and f.time_zone is not null
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
      recipient_member_user_id: string | null;
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
                s.delivery_pref, s.label, s.prompt,
                s.recipient_member_user_id
    )
    select claimed.id as schedule_id, claimed.kind, claimed.local_hour,
           claimed.weekdays, claimed.delivery_pref, claimed.label,
           claimed.prompt, claimed.recipient_member_user_id,
           f.id as family_id, f.time_zone,
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
    recipientMemberUserId: row.recipient_member_user_id,
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
 * One task with its delivery-ready family context, for the parent's own
 * Run now button. Same shape as a claimed row but with NO lease and NO
 * due-time filter: a manual run ignores next_run_at and the paused
 * switch (the click is the parent's explicit ask), while `enabled`
 * (system eligibility: email, zone, kids, the brief's first report)
 * still gates it, because an ineligible run has nothing real to say.
 * Tenancy: taskId is re-scoped by the caller-derived familyId, so a
 * forged id from another family loads nothing.
 */
export async function loadFamilyTaskForRun(
  familyId: string,
  taskId: string,
): Promise<
  | { ok: true; task: DueFamilyTask }
  | { ok: false; note: string }
> {
  const sql = mapDb();
  const rows = await sql<
    {
      schedule_id: string;
      kind: FamilyTaskKind;
      enabled: boolean;
      time_zone: string | null;
      local_hour: number;
      weekdays: number[];
      delivery_pref: "text" | "email" | "none";
      label: string | null;
      prompt: string | null;
      recipient_member_user_id: string | null;
      family_id: string;
      first_name: string | null;
      parent_display_name: string | null;
      email: string | null;
      phone_numbers: string[];
      child_names: string[];
    }[]
  >`
    select s.id as schedule_id, s.kind, s.enabled, s.local_hour, s.weekdays,
           s.delivery_pref, s.label, s.prompt, s.recipient_member_user_id,
           f.id as family_id, f.time_zone,
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
    from public.agent_schedules s
    join public.families f on f.id = s.family_id
    where s.id = ${taskId} and s.family_id = ${familyId}
  `;
  const row = rows[0];
  if (!row) {
    // Reachable only when the row vanished after the page rendered (a
    // delete in another tab) or the id was forged; the copy speaks to
    // the honest case. Copy passed both gates 2026-07-13.
    return {
      ok: false,
      note: "This task isn't here anymore. Refresh the page to see the current list.",
    };
  }
  if (!TASK_KIND_CONFIG[row.kind].enabled()) {
    // The founder kill switch for this kind is still off fleet-wide.
    return {
      ok: false,
      note: "This task can't run yet. It's almost ready on Homa's side, nothing you need to set up.",
    };
  }
  if (!row.enabled) {
    // System eligibility (seeding hygiene) turned the row off. The brief's
    // usual reason is the missing first report; the rest is family setup.
    return {
      ok: false,
      note:
        row.kind === "morning_brief"
          ? "This task can't run yet. The brief starts once your family's first report is ready."
          : "This task can't run yet. Check that your family's email and time zone are set in Settings.",
    };
  }
  if (!row.time_zone) {
    return {
      ok: false,
      note: "This task can't run yet. Set your family's time zone in Settings, then try again.",
    };
  }
  return {
    ok: true,
    task: {
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
      recipientMemberUserId: row.recipient_member_user_id,
    },
  };
}

/** True while any run for this schedule is still 'running': the Run now
 * throttle, so a mashed button (or a manual run racing the scheduled
 * one) never stacks sessions for one task. */
export async function hasRunningTaskRun(scheduleId: string): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    select id from public.homa_task_runs
    where schedule_id = ${scheduleId} and status = 'running'
    limit 1
  `;
  return rows.length > 0;
}

function taskRunTitle(task: DueFamilyTask): string {
  return task.kind === "custom"
    ? (task.label ?? TASK_KIND_CONFIG.custom.runTitle)
    : TASK_KIND_CONFIG[task.kind].runTitle;
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
  const title = taskRunTitle(task);
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

/**
 * A Run now run's row. scheduled_for stays null on purpose: the partial
 * unique outbox index only covers scheduled days, so a manual run never
 * collides with (or blocks) today's scheduled run. Everything
 * downstream (delivery, finishTaskRun, the reaper, the History feed)
 * reads the run by id and treats it like any other run.
 */
export async function beginManualTaskRun(task: DueFamilyTask): Promise<string> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    insert into public.homa_task_runs
      (family_id, schedule_id, kind, status, scheduled_for, title)
    values
      (${task.familyId}, ${task.scheduleId}, ${task.kind}, 'running', null,
       ${taskRunTitle(task)})
    returning id
  `;
  return rows[0].id;
}

/** The dispatch channel's write: the composed text and where it went. */
export async function markTaskRunDelivered(
  runId: string,
  outcome: {
    summary: string;
    channel: "sms" | "email" | "none" | null;
  },
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
    status:
      | "done"
      | "partial"
      | "partial_uncertain"
      | "uncertain"
      | "failed"
      | "skipped";
    error?: string;
    sessionId?: string;
    /** Lab cancellation races a durable session finishing. When true,
     * only the transition from running succeeds; a prior cancellation
     * receipt can never be overwritten by the late session. */
    onlyIfRunning?: boolean;
  },
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<Array<{ id: string }>>`
    update public.homa_task_runs
    set status = ${outcome.status},
        error = coalesce(${outcome.error ?? null}, error),
        session_id = coalesce(${outcome.sessionId ?? null}, session_id),
        finished_at = now()
    where id = ${runId}
      and (${!outcome.onlyIfRunning} or status = 'running')
    returning id
  `;
  if (rows.length === 0) return false;
  await emitMapEvent("tasks.run_completed", {
    ...(outcome.familyId ? { family_id: outcome.familyId } : {}),
    kind: outcome.kind,
    status: outcome.status,
  });
  return true;
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
  const stale = await sql<
    {
      id: string;
      family_id: string | null;
      kind: TaskRunKind;
      delivered_channel: "sms" | "email" | "none" | null;
      summary: string | null;
    }[]
  >`
    select id, family_id, kind, delivered_channel, summary
    from public.homa_task_runs
    where status = 'running' and started_at < ${cutoff}
    limit 25
  `;
  for (const run of stale) {
    const deliveries = await sql<
      { sent: number; uncertain: number; unresolved: number }[]
    >`
      select
        count(*) filter (where status = 'sent')::int as sent,
        count(*) filter (where status = 'uncertain')::int as uncertain,
        count(*) filter (where status in ('failed', 'pending'))::int
          as unresolved
      from public.conversation_deliveries
      where task_run_id = ${run.id}
    `;
    const sent = deliveries[0]?.sent ?? 0;
    const uncertain = deliveries[0]?.uncertain ?? 0;
    const unresolved = deliveries[0]?.unresolved ?? 0;
    const saveOnlyCompleted =
      run.delivered_channel === "none" && Boolean(run.summary);
    await finishTaskRun(run.id, {
      familyId: run.family_id,
      kind: run.kind,
      status:
        saveOnlyCompleted
          ? "done"
          : sent > 0
            ? unresolved > 0 || uncertain > 0
              ? uncertain > 0 && unresolved === 0
                ? "partial_uncertain"
                : "partial"
              : "done"
            : uncertain > 0
              ? "uncertain"
              : "failed",
      ...(sent > 0 || uncertain > 0 || saveOnlyCompleted
        ? {}
        : { error: "run never completed (reaped after 2 hours)" }),
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

/**
 * A fleet run has no schedule row and no family; the run record is its
 * audit trail, its revert handle, and now the durable lock for one
 * research cell. Returns null when another scheduled/manual/lab trigger
 * already owns that cell. The partial unique index only covers running
 * rows, so a later refresh remains possible after completion.
 */
export async function beginFleetRun(
  title: string,
  options: {
    cellKey: string;
    trigger: "scheduled" | "manual" | "lab";
  },
): Promise<string | null> {
  const sql = mapDb();
  try {
    const rows = await sql<{ id: string }[]>`
      insert into public.homa_task_runs
        (family_id, schedule_id, kind, status, title,
         research_cell_key, research_trigger)
      values
        (null, null, 'fleet_research', 'running', ${title.slice(0, 120)},
         ${options.cellKey}, ${options.trigger})
      returning id
    `;
    return rows[0]?.id ?? null;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return null;
    throw error;
  }
}

export async function updateFleetRunSummary(runId: string, summary: string): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.homa_task_runs set summary = ${summary.slice(0, 4000)} where id = ${runId}
  `;
}
