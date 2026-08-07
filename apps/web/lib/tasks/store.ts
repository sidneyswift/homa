import type { Sql, TransactionSql } from "postgres";

import {
  aggregateDurableDeliveryAttempts,
  type DeliveryAggregate,
} from "../conversation-continuity/delivery-policy";
import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";
import {
  TASK_KIND_CONFIG,
  enabledFamilyTaskKinds,
  type FamilyTaskKind,
  type TaskRunKind,
} from "./kinds";
import {
  usesResearchBriefV2Delivery,
  type TaskDeliveryVersion,
} from "./delivery-version";
import { recoverPreparedResearchBriefDelivery } from "./research-brief-store";
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
  /** Server-loaded rollout eligibility. Never accepts model or client input. */
  familySandbox: boolean;
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
  /** Accepted offer that created this task. When present, every run must
   * revalidate and deliver only to that offer's exact accepting adult. */
  sourceOfferDeliveryId: string | null;
}

const SEEDABLE_KINDS = ["journal_prompt", "morning_brief"] as const;
type SeedableKind = (typeof SEEDABLE_KINDS)[number];

/** Eligibility SQL per built-in kind. Both require email + zone + kids +
 * a 20-hour-old family; the brief additionally requires a scored report,
 * because a brief with nothing real to say teaches families to ignore
 * it. Kept as one function so the two rules stay side by side.
 *
 * PMF-201 (plans/2026-07-21-chat-first-onboarding.md §6.3/§9): the
 * 20-hour wait exists so a text-signup family isn't seeded before she
 * has even added a child. A chat-onboarding family adds a child and
 * gets a scored report inside the first sitting, so the same wait plus
 * nextTaskRunInstant's "strictly after now" walk pushes her first
 * morning brief to day 3 instead of day 2. `context->'onboarding'` is
 * only ever written by the chat-onboarding tools (lib/onboarding/
 * store.ts), so its presence is durable DB truth that this family
 * already cleared the fast path; the 20-hour floor is waived for her
 * once the real eligibility columns (email, zone, kids, report) hold.
 *
 * Takes an injected connection (the file's established xWithDatabase
 * pattern, see beginTaskRunWithDatabase etc.) so this eligibility rule
 * is exercisable against the disposable Postgres harness instead of
 * only ever running live against prod. */
async function seedKindWithDatabase(
  sql: Sql,
  kind: SeedableKind,
  now: Date,
): Promise<void> {
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
      and (
        f.created_at < now() - interval '20 hours'
        or (f.context -> 'onboarding') is not null
      )
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
export async function seedFamilyTaskSchedulesWithDatabase(
  sql: Sql,
  now = new Date(),
): Promise<void> {
  const enabled = new Set(enabledFamilyTaskKinds());
  for (const kind of SEEDABLE_KINDS) {
    if (!enabled.has(kind)) continue;
    await seedKindWithDatabase(sql, kind, now);
  }
}

export async function seedFamilyTaskSchedules(now = new Date()): Promise<void> {
  return await seedFamilyTaskSchedulesWithDatabase(mapDb(), now);
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
      family_sandbox: boolean;
      kind: FamilyTaskKind;
      time_zone: string;
      local_hour: number;
      weekdays: number[];
      delivery_pref: "text" | "email" | "none";
      label: string | null;
      prompt: string | null;
      recipient_member_user_id: string | null;
      source_offer_delivery_id: string | null;
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
                s.recipient_member_user_id, s.source_offer_delivery_id
    )
    select claimed.id as schedule_id, claimed.kind, claimed.local_hour,
           claimed.weekdays, claimed.delivery_pref, claimed.label,
           claimed.prompt, claimed.recipient_member_user_id,
           claimed.source_offer_delivery_id,
           f.id as family_id, f.sandbox as family_sandbox, f.time_zone,
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
    familySandbox: row.family_sandbox,
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
    sourceOfferDeliveryId: row.source_offer_delivery_id,
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
      source_offer_delivery_id: string | null;
      family_id: string;
      family_sandbox: boolean;
      first_name: string | null;
      parent_display_name: string | null;
      email: string | null;
      phone_numbers: string[];
      child_names: string[];
    }[]
  >`
    select s.id as schedule_id, s.kind, s.enabled, s.local_hour, s.weekdays,
           s.delivery_pref, s.label, s.prompt, s.recipient_member_user_id,
           s.source_offer_delivery_id,
           f.id as family_id, f.sandbox as family_sandbox, f.time_zone,
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
      familySandbox: row.family_sandbox,
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
      sourceOfferDeliveryId: row.source_offer_delivery_id,
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
export interface StartedTaskRun {
  id: string;
  deliveryVersion: TaskDeliveryVersion;
}

export interface BeginTaskRunOptions {
  deliveryVersion: TaskDeliveryVersion;
  status?: "running" | "skipped";
  error?: string;
}

export async function beginTaskRunWithDatabase(
  database: Sql,
  task: DueFamilyTask,
  now: Date,
  options: BeginTaskRunOptions,
): Promise<StartedTaskRun | null> {
  const title = taskRunTitle(task);
  try {
    const rows = await database<
      { id: string; delivery_version: TaskDeliveryVersion }[]
    >`
      insert into public.homa_task_runs
        (family_id, schedule_id, kind, status, scheduled_for, title, error,
         delivery_version)
      values
        (${task.familyId}, ${task.scheduleId}, ${task.kind},
         ${options?.status ?? "running"},
         ${localDateKey(task.timeZone, now)}, ${title},
         ${options?.error ?? null}, ${options.deliveryVersion})
      returning id, delivery_version
    `;
    const row = rows[0];
    return row
      ? { id: row.id, deliveryVersion: row.delivery_version }
      : null;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return null;
    throw error;
  }
}

export async function beginTaskRun(
  task: DueFamilyTask,
  now: Date,
  options: BeginTaskRunOptions,
): Promise<StartedTaskRun | null> {
  return await beginTaskRunWithDatabase(mapDb(), task, now, options);
}

export interface RecordSkippedScheduledTaskRunInput {
  task: DueFamilyTask;
  now: Date;
  deliveryVersion: TaskDeliveryVersion;
  reason: "no eligible morning brief candidate";
}

export type RecordSkippedScheduledTaskRunResult =
  | { inserted: false }
  | { inserted: true; runId: string };

type ScheduledSkipCompletionEmitter = (
  name: "tasks.run_completed",
  props: Record<string, unknown>,
) => Promise<void>;

const scheduledSkipCompletionEmitter: ScheduledSkipCompletionEmitter =
  async (name, props) => {
    await emitMapEvent(name, props as {
      family_id: string;
      kind: FamilyTaskKind;
      status: "skipped";
    });
  };

/**
 * Inserts a final no-candidate run and advances its still-due schedule under
 * one transaction. An outbox conflict still clears a due claim without
 * duplicating the run or completion event.
 */
export async function recordSkippedScheduledTaskRunWithDatabase(
  database: Sql,
  input: RecordSkippedScheduledTaskRunInput,
  emit: ScheduledSkipCompletionEmitter = scheduledSkipCompletionEmitter,
): Promise<RecordSkippedScheduledTaskRunResult> {
  const result = await database.begin<RecordSkippedScheduledTaskRunResult>(
    async (transaction) => {
      const runRows = await transaction<{ id: string }[]>`
        insert into public.homa_task_runs (
          family_id, schedule_id, kind, status, scheduled_for, title, error,
          delivery_version, started_at, finished_at
        )
        values (
          ${input.task.familyId}, ${input.task.scheduleId}, ${input.task.kind},
          'skipped', ${localDateKey(input.task.timeZone, input.now)},
          ${taskRunTitle(input.task)}, ${input.reason},
          ${input.deliveryVersion}, ${input.now.toISOString()},
          ${input.now.toISOString()}
        )
        on conflict do nothing
        returning id
      `;
      const run = runRows[0];
      const nextRun = nextTaskRunInstant(
        input.task.timeZone,
        input.task.localHour,
        input.task.weekdays,
        input.now,
      );
      const scheduleRows = await transaction<{ id: string }[]>`
        update public.agent_schedules
        set next_run_at = ${nextRun.toISOString()},
            last_run_at = ${input.now.toISOString()},
            lease_until = null
        where id = ${input.task.scheduleId}
          and family_id = ${input.task.familyId}
          and next_run_at <= ${input.now.toISOString()}
        returning id
      `;
      if (run && scheduleRows.length !== 1) {
        throw new Error("scheduled task schedule was no longer due");
      }
      if (!run) return { inserted: false };
      return { inserted: true, runId: run.id };
    },
  );
  if (result.inserted) {
    await emit("tasks.run_completed", {
      family_id: input.task.familyId,
      kind: input.task.kind,
      status: "skipped",
    });
  }
  return result;
}

export async function recordSkippedScheduledTaskRun(
  input: RecordSkippedScheduledTaskRunInput,
): Promise<RecordSkippedScheduledTaskRunResult> {
  return await recordSkippedScheduledTaskRunWithDatabase(mapDb(), input);
}

/**
 * A Run now run's row. scheduled_for stays null on purpose: the partial
 * unique outbox index only covers scheduled days, so a manual run never
 * collides with (or blocks) today's scheduled run. Everything
 * downstream (delivery, finishTaskRun, the reaper, the History feed)
 * reads the run by id and treats it like any other run.
 */
export interface BeginManualTaskRunOptions {
  deliveryVersion: TaskDeliveryVersion;
}

export async function beginManualTaskRunWithDatabase(
  database: Sql,
  task: DueFamilyTask,
  options: BeginManualTaskRunOptions,
): Promise<StartedTaskRun> {
  const rows = await database<
    { id: string; delivery_version: TaskDeliveryVersion }[]
  >`
    insert into public.homa_task_runs
      (family_id, schedule_id, kind, status, scheduled_for, title,
       delivery_version)
    values
      (${task.familyId}, ${task.scheduleId}, ${task.kind}, 'running', null,
       ${taskRunTitle(task)}, ${options.deliveryVersion})
    returning id, delivery_version
  `;
  return {
    id: rows[0].id,
    deliveryVersion: rows[0].delivery_version,
  };
}

export async function beginManualTaskRun(
  task: DueFamilyTask,
  options: BeginManualTaskRunOptions,
): Promise<StartedTaskRun> {
  return await beginManualTaskRunWithDatabase(mapDb(), task, options);
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

export interface FinishTaskRunOutcome {
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
  /** Clears stale delivery claims when a no-output run is failed. */
  clearDelivery?: boolean;
  /** Lab cancellation and stale reaping can race a durable session finish.
   * When true, only the transition from running succeeds. */
  onlyIfRunning?: boolean;
}

export async function finishTaskRunWithDatabase(
  database: Sql | TransactionSql,
  runId: string,
  outcome: FinishTaskRunOutcome,
): Promise<boolean> {
  const rows = await database<Array<{ id: string }>>`
    update public.homa_task_runs
    set status = ${outcome.status},
        error = coalesce(${outcome.error ?? null}, error),
        session_id = coalesce(${outcome.sessionId ?? null}, session_id),
        summary = case when ${outcome.clearDelivery ?? false}
          then null else summary end,
        delivered_channel = case when ${outcome.clearDelivery ?? false}
          then null else delivered_channel end,
        finished_at = now()
    where id = ${runId}
      and (${!outcome.onlyIfRunning} or status = 'running')
    returning id
  `;
  return rows.length === 1;
}

export async function finishTaskRun(
  runId: string,
  outcome: FinishTaskRunOutcome,
): Promise<boolean> {
  const finished = await finishTaskRunWithDatabase(mapDb(), runId, outcome);
  if (!finished) return false;
  await emitMapEvent("tasks.run_completed", {
    ...(outcome.familyId ? { family_id: outcome.familyId } : {}),
    kind: outcome.kind,
    status: outcome.status,
  });
  return true;
}

export interface FinishTaskRunFromDurableDeliveriesInput {
  runId: string;
  familyId: string;
  kind: FamilyTaskKind;
  summary: string;
  sessionId: string | null;
  saveOnlyAccepted: boolean;
  canonicalMessageId: string;
}

export type FinishTaskRunFromDurableDeliveriesResult =
  | { finished: false; delivery: null }
  | { finished: true; delivery: DeliveryAggregate };

export async function finishTaskRunFromDurableDeliveriesWithDatabase(
  database: Sql,
  input: FinishTaskRunFromDurableDeliveriesInput,
): Promise<FinishTaskRunFromDurableDeliveriesResult> {
  return await database.begin<FinishTaskRunFromDurableDeliveriesResult>(
    async (transaction) => {
      const [run] = await transaction<{
        id: string;
        status: string;
        kind: string;
      }[]>`
        select id, status, kind
        from public.homa_task_runs
        where id = ${input.runId}
          and family_id = ${input.familyId}
        for update
      `;
      if (
        !run ||
        run.status !== "running" ||
        run.kind !== input.kind
      ) {
        return { finished: false, delivery: null };
      }
      const canonicalMessages = await transaction<{ id: string }[]>`
        select id
        from public.conversation_messages
        where id = ${input.canonicalMessageId}
          and family_id = ${input.familyId}
          and task_run_id = ${input.runId}
          and role = 'assistant'
        for update
      `;
      if (canonicalMessages.length !== 1) {
        return { finished: false, delivery: null };
      }
      await transaction`
        update public.conversation_deliveries
        set status = 'uncertain',
            error = coalesce(
              error,
              'delivery acceptance unknown at task finalization'
            ),
            failed_at = coalesce(failed_at, now()),
            updated_at = now()
        where task_run_id = ${input.runId}
          and family_id = ${input.familyId}
          and status = 'pending'
      `;
      const attempts = await transaction<{
        id: string;
        recipient_member_user_id: string | null;
        destination_hash: string | null;
        channel: "sms" | "email";
        status: "sent" | "failed" | "uncertain";
      }[]>`
        select id, recipient_member_user_id, destination_hash, channel, status
        from public.conversation_deliveries
        where task_run_id = ${input.runId}
          and family_id = ${input.familyId}
          and channel in ('sms', 'email')
        order by created_at, id
      `;
      const delivery: DeliveryAggregate =
        input.saveOnlyAccepted && attempts.length === 0
          ? {
              status: "done",
              deliveredChannel: "none",
              deliveredCount: 1,
              failedCount: 0,
            }
          : aggregateDurableDeliveryAttempts(
              attempts.map((attempt) => ({
                recipientKey: attempt.recipient_member_user_id
                  ? `member:${attempt.recipient_member_user_id}`
                  : attempt.destination_hash
                    ? `destination:${attempt.destination_hash}`
                    : `delivery:${attempt.id}`,
                channel: attempt.channel,
                status: attempt.status,
              })),
            );
      const finished = await transaction<{ id: string }[]>`
        update public.homa_task_runs
        set status = ${delivery.status},
            summary = ${delivery.deliveredCount > 0
              ? input.summary.slice(0, 4000)
              : null},
            delivered_channel = ${delivery.deliveredChannel},
            session_id = coalesce(${input.sessionId}, session_id),
            finished_at = now(),
            error = case
              when ${delivery.status === "failed"}
                then coalesce(error, 'delivery failed for every intended recipient')
              else error
            end
        where id = ${input.runId}
          and family_id = ${input.familyId}
          and kind = ${input.kind}
          and status = 'running'
        returning id
      `;
      if (finished.length === 1 && delivery.deliveredCount > 0) {
        const visible = await transaction<{ id: string }[]>`
          update public.conversation_messages
          set visibility = 'family'
          where id = ${input.canonicalMessageId}
            and family_id = ${input.familyId}
            and task_run_id = ${input.runId}
            and role = 'assistant'
          returning id
        `;
        if (visible.length !== 1) {
          return { finished: false, delivery: null };
        }
      }
      return finished.length === 1
        ? { finished: true, delivery }
        : { finished: false, delivery: null };
    },
  );
}

export interface FinishStaleTaskRunFromDurableDeliveriesInput {
  runId: string;
  familyId: string;
  kind: FamilyTaskKind;
}

export async function finishStaleTaskRunFromDurableDeliveriesWithDatabase(
  database: Sql,
  input: FinishStaleTaskRunFromDurableDeliveriesInput,
): Promise<FinishTaskRunFromDurableDeliveriesResult> {
  type StaleTaskRunDecision =
    | {
        action: "finalize";
        canonicalMessage: { id: string; content: string | null };
        runSummary: string | null;
        sessionId: string | null;
        deliveredChannel: "sms" | "email" | "none" | null;
      }
    | {
        action: "return";
        result: FinishTaskRunFromDurableDeliveriesResult;
      };
  const decision = await database.begin<StaleTaskRunDecision>(
    async (transaction) => {
      const [run] = await transaction<{
        status: string;
        kind: string;
        summary: string | null;
        sessionId: string | null;
        deliveredChannel: "sms" | "email" | "none" | null;
      }[]>`
        select status, kind, summary, session_id as "sessionId",
               delivered_channel as "deliveredChannel"
        from public.homa_task_runs
        where id = ${input.runId}
          and family_id = ${input.familyId}
        for update
      `;
      if (
        !run ||
        run.status !== "running" ||
        run.kind !== input.kind
      ) {
        return {
          action: "return",
          result: { finished: false, delivery: null },
        };
      }
      const [canonicalMessage] = await transaction<{
        id: string;
        content: string | null;
      }[]>`
        select id, content
        from public.conversation_messages
        where family_id = ${input.familyId}
          and task_run_id = ${input.runId}
          and role = 'assistant'
        order by created_at desc, id desc
        limit 1
      `;
      if (canonicalMessage) {
        return {
          action: "finalize",
          canonicalMessage,
          runSummary: run.summary,
          sessionId: run.sessionId,
          deliveredChannel: run.deliveredChannel,
        };
      }
      const [evidence] = await transaction<{
        recoverable: number;
        failed: number;
      }[]>`
        select
          count(*) filter (
            where status in ('sent', 'uncertain', 'pending')
          )::integer as recoverable,
          count(*) filter (where status = 'failed')::integer as failed
        from public.conversation_deliveries
        where family_id = ${input.familyId}
          and task_run_id = ${input.runId}
      `;
      const saveOnlyReceipt =
        run.deliveredChannel === "none" && Boolean(run.summary);
      if ((evidence?.recoverable ?? 0) > 0 || saveOnlyReceipt) {
        return {
          action: "return",
          result: { finished: false, delivery: null },
        };
      }
      const finished = await finishTaskRunWithDatabase(
        transaction,
        input.runId,
        {
          familyId: input.familyId,
          kind: input.kind,
          status: "failed",
          error: "stale task produced no canonical output",
          ...(run.sessionId ? { sessionId: run.sessionId } : {}),
          clearDelivery: true,
          onlyIfRunning: true,
        },
      );
      return {
        action: "return",
        result: finished
          ? {
              finished: true,
              delivery: {
                status: "failed",
                deliveredChannel: null,
                deliveredCount: 0,
                failedCount: evidence?.failed ?? 0,
              },
            }
          : { finished: false, delivery: null },
      };
    },
  );
  if (decision.action === "return") {
    return decision.result;
  }
  return await finishTaskRunFromDurableDeliveriesWithDatabase(database, {
    runId: input.runId,
    familyId: input.familyId,
    kind: input.kind,
    summary:
      decision.canonicalMessage.content ??
      decision.runSummary ??
      "",
    sessionId: decision.sessionId,
    saveOnlyAccepted:
      decision.deliveredChannel === "none" &&
      Boolean(decision.runSummary),
    canonicalMessageId: decision.canonicalMessage.id,
  });
}

type DurableTaskCompletionEventName =
  | "tasks.run_completed"
  | "journal.prompt_sent"
  | "research.brief_sent";

type DurableTaskCompletionEmitter = (
  name: DurableTaskCompletionEventName,
  props: Record<string, unknown>,
) => Promise<void>;

const durableTaskCompletionEmitter: DurableTaskCompletionEmitter = async (
  name,
  props,
) => {
  switch (name) {
    case "tasks.run_completed":
      await emitMapEvent("tasks.run_completed", props as {
        family_id: string;
        kind: FamilyTaskKind;
        status: DeliveryAggregate["status"];
      });
      return;
    case "journal.prompt_sent":
      await emitMapEvent("journal.prompt_sent", props as {
        family_id: string;
        channel: "sms" | "email";
      });
      return;
    case "research.brief_sent":
      await emitMapEvent("research.brief_sent", props as {
        family_id: string;
        channel: "sms" | "email";
      });
      return;
    default: {
      const exhaustive: never = name;
      throw new Error(
        `unhandled durable task completion event: ${String(exhaustive)}`,
      );
    }
  }
};

export async function emitDurableTaskRunCompletion(
  input: Pick<
    FinishTaskRunFromDurableDeliveriesInput,
    "familyId" | "kind"
  >,
  result: FinishTaskRunFromDurableDeliveriesResult,
  emit: DurableTaskCompletionEmitter = durableTaskCompletionEmitter,
): Promise<void> {
  if (!result.finished) return;
  await emit("tasks.run_completed", {
    family_id: input.familyId,
    kind: input.kind,
    status: result.delivery.status,
  });
  if (
    result.delivery.deliveredCount === 0 ||
    (
      result.delivery.deliveredChannel !== "sms" &&
      result.delivery.deliveredChannel !== "email"
    )
  ) {
    return;
  }
  switch (input.kind) {
    case "journal_prompt":
      await emit("journal.prompt_sent", {
        family_id: input.familyId,
        channel: result.delivery.deliveredChannel,
      });
      return;
    case "morning_brief":
      await emit("research.brief_sent", {
        family_id: input.familyId,
        channel: result.delivery.deliveredChannel,
      });
      return;
    case "custom":
      return;
    default: {
      const exhaustive: never = input.kind;
      throw new Error(
        `unhandled durable task completion kind: ${String(exhaustive)}`,
      );
    }
  }
}

export async function finishTaskRunFromDurableDeliveries(
  input: FinishTaskRunFromDurableDeliveriesInput,
): Promise<FinishTaskRunFromDurableDeliveriesResult> {
  const result = await finishTaskRunFromDurableDeliveriesWithDatabase(
    mapDb(),
    input,
  );
  await emitDurableTaskRunCompletion(input, result);
  return result;
}

export async function loadLegacyStaleTaskRunOutcomeWithDatabase(
  database: Sql,
  input: {
    taskRunId: string;
    deliveredChannel: "sms" | "email" | "none" | null;
    summary: string | null;
  },
): Promise<{
  status: Exclude<FinishTaskRunOutcome["status"], "skipped">;
  hasAcceptedOrUncertainDelivery: boolean;
}> {
  const deliveries = await database<
    { sent: number; uncertain: number; unresolved: number }[]
  >`
    select
      count(*) filter (where status = 'sent')::int as sent,
      count(*) filter (where status = 'uncertain')::int as uncertain,
      count(*) filter (where status in ('failed', 'pending'))::int
        as unresolved
    from public.conversation_deliveries
    where task_run_id = ${input.taskRunId}
  `;
  const sent = deliveries[0]?.sent ?? 0;
  const uncertain = deliveries[0]?.uncertain ?? 0;
  const unresolved = deliveries[0]?.unresolved ?? 0;
  const saveOnlyCompleted =
    input.deliveredChannel === "none" && Boolean(input.summary);
  return {
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
    hasAcceptedOrUncertainDelivery:
      sent > 0 || uncertain > 0 || saveOnlyCompleted,
  };
}

/** One reaped run, reported back so the dispatcher can decide whether a
 * clean same-day failure deserves its single retry (ticket DR-2). */
export interface ReapedTaskRun {
  runId: string;
  familyId: string | null;
  scheduleId: string | null;
  kind: TaskRunKind;
  /** Family-local calendar day the run served (half of the outbox key). */
  scheduledFor: string | null;
  /** True when any delivery was accepted, is still uncertain, or was
   * recovered; retrying such a run could double-text the family. */
  reachedFamily: boolean;
}

/**
 * The safety net for runs whose session never reached a deliverable
 * message (crash, refusal, model outage): receive() resolves at session
 * START, so nobody is waiting on the other end. Prepared briefs first recover
 * their durable aggregate. Other stale runs retain the legacy aggregation.
 * Returns what it reaped: a failed run fell out of the outbox index by
 * design, so the dispatcher may start one same-day replacement.
 */
export async function reapStaleTaskRuns(
  now = new Date(),
): Promise<ReapedTaskRun[]> {
  const sql = mapDb();
  const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const stale = await sql<
    {
      id: string;
      family_id: string | null;
      schedule_id: string | null;
      kind: TaskRunKind;
      delivered_channel: "sms" | "email" | "none" | null;
      summary: string | null;
      session_id: string | null;
      delivery_version: TaskDeliveryVersion;
      scheduled_for: string | null;
    }[]
  >`
    select id, family_id, schedule_id, kind, delivered_channel, summary,
           session_id, delivery_version, scheduled_for::text as scheduled_for
    from public.homa_task_runs
    where status = 'running' and started_at < ${cutoff}
    limit 25
  `;
  const reaped: ReapedTaskRun[] = [];
  for (const run of stale) {
    const base = {
      runId: run.id,
      familyId: run.family_id,
      scheduleId: run.schedule_id,
      kind: run.kind,
      scheduledFor: run.scheduled_for,
    };
    if (
      run.kind === "morning_brief" &&
      run.family_id &&
      usesResearchBriefV2Delivery(run.delivery_version)
    ) {
      const recovery = await recoverPreparedResearchBriefDelivery({
        familyId: run.family_id,
        taskRunId: run.id,
      });
      if (recovery.status !== "not_found") {
        reaped.push({
          ...base,
          reachedFamily:
            recovery.status === "recovery_pending" ||
            recovery.delivery.status !== "failed",
        });
        continue;
      }
    }
    if (
      run.family_id &&
      (
        run.kind === "journal_prompt" ||
        run.kind === "morning_brief" ||
        run.kind === "custom"
      )
    ) {
      const result =
        await finishStaleTaskRunFromDurableDeliveriesWithDatabase(sql, {
          runId: run.id,
          familyId: run.family_id,
          kind: run.kind,
        });
      await emitDurableTaskRunCompletion(
        { familyId: run.family_id, kind: run.kind },
        result,
      );
      if (
        result.finished &&
        run.kind === "journal_prompt" &&
        result.delivery.deliveredCount > 0
      ) {
        await sql`
          update public.families
          set journal_prompt_last_sent_at = now()
          where id = ${run.family_id}
        `;
      }
      reaped.push({
        ...base,
        reachedFamily: !(
          result.finished && result.delivery?.status === "failed"
        ),
      });
      continue;
    }
    const outcome = await loadLegacyStaleTaskRunOutcomeWithDatabase(sql, {
      taskRunId: run.id,
      deliveredChannel: run.delivered_channel,
      summary: run.summary,
    });
    await finishTaskRun(run.id, {
      familyId: run.family_id,
      kind: run.kind,
      status: outcome.status,
      ...(outcome.hasAcceptedOrUncertainDelivery
        ? {}
        : { error: "run never completed (reaped after 2 hours)" }),
      onlyIfRunning: true,
    });
    reaped.push({
      ...base,
      reachedFamily: outcome.hasAcceptedOrUncertainDelivery,
    });
  }
  return reaped;
}

/**
 * The retry bound for a reaped run: exactly one failed run for this
 * schedule and local day means the failure has never been retried. A
 * retried run that hangs again fails this check forever, so a broken
 * family can never loop.
 */
export async function isFirstFailedRunForScheduleDay(
  scheduleId: string,
  scheduledFor: string,
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ n: number }[]>`
    select count(*)::int as n from public.homa_task_runs
    where schedule_id = ${scheduleId}
      and scheduled_for = ${scheduledFor}
      and status = 'failed'
  `;
  return (rows[0]?.n ?? 0) === 1;
}

/**
 * The retry bound for a reaped MANUAL run. A manual run carries no
 * scheduled_for (it is not an outbox day), so the day-keyed guard above
 * cannot see it. Exactly one failed manual run for this schedule inside the
 * window means the failure has never been retried; a retried run that hangs
 * again makes the count 2 and fails this check, so a task whose tool call
 * reliably hangs can never loop.
 */
export async function isFirstFailedManualRun(
  scheduleId: string,
  withinHours = 24,
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ n: number }[]>`
    select count(*)::int as n from public.homa_task_runs
    where schedule_id = ${scheduleId}
      and scheduled_for is null
      and status = 'failed'
      and started_at >= now() - ${`${withinHours} hours`}::interval
  `;
  return (rows[0]?.n ?? 0) === 1;
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
 * Switches a family's text-delivery schedules to email after the provider
 * reports the destination region is unreachable (Telnyx 40309). Our sole-prop
 * 10DLC profile is US-only, so a non-US +1 number (e.g. Canada) that our +1
 * normalization accepts fails on every send; without this it is retried and
 * re-logged daily (2026-07-23 founder-console cleanup, Mani Family +1 236).
 *
 * Only rows still set to 'text' move, so a repeat rejection in the same run
 * (a second phone, a second recipient) updates nothing and stays quiet: the
 * returned count and the event fire only on the transition. The message that
 * triggered this already fell back to email in the same delivery pass; this
 * only stops FUTURE runs from texting an un-textable number. Family-scoped,
 * never touches another family's rows. Mirrors the founder's manual remedy.
 */
export async function markFamilyTextSchedulesEmailOnly(
  familyId: string,
): Promise<number> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    update public.agent_schedules
    set delivery_pref = 'email'
    where family_id = ${familyId} and delivery_pref = 'text'
    returning id
  `;
  const switched = rows.length;
  if (switched > 0) {
    await emitMapEvent("sms.delivery_region_unsupported", {
      family_id: familyId,
      schedules_switched: switched,
    });
  }
  return switched;
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
