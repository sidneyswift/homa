import { mapDb } from "./map/db";

/**
 * The dispatcher's schedule rows (gateway-plan GW-4; the eve
 * dynamic-scheduling pattern from 01-architecture §per-family
 * scheduling). agent_schedules is deny-all at the database; only this
 * module touches it, from the authored dispatch schedule.
 *
 * Semantics the dispatcher depends on:
 *   - seeding is idempotent and self-healing: eligible families gain
 *     their journal row hourly, ineligible or opted-out rows disable;
 *   - claimDue takes an atomic lease (update ... returning), so two
 *     overlapping ticks never wake the same family twice;
 *   - complete advances next_run_at to the NEXT 8pm in the family's own
 *     time zone; release retries on the next tick;
 *   - delivery is at least once, and the per-local-day advance is the
 *     idempotency key (a redelivered claim lands on the same day and
 *     the completed row is already pointed at tomorrow).
 */

const PROMPT_LOCAL_HOUR = 20;

export interface DueJournalJob {
  scheduleId: string;
  familyId: string;
  timeZone: string;
  parentFirstName: string | null;
  kidPhrase: string;
  phoneE164: string | null;
  email: string | null;
}

export function journalPromptEnabled(): boolean {
  return process.env.JOURNAL_PROMPT_ENABLED === "true";
}

/** The UTC instant of the next `hour`:00 wall-clock in `zone`, strictly
 * after `after`. Two-pass offset correction handles DST edges. */
export function nextLocalHourInstant(zone: string, hour: number, after: Date): Date {
  const wallClock = (instant: Date): { key: string; ms: number } => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(instant);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
    const key = `${get("year")}-${get("month")}-${get("day")}`;
    const ms = Date.UTC(
      Number(get("year")),
      Number(get("month")) - 1,
      Number(get("day")),
      Number(get("hour")) % 24,
      Number(get("minute")),
    );
    return { key, ms };
  };

  // Start from "today at `hour` local" as a UTC guess and correct by the
  // observed wall-clock difference; repeat once for DST boundaries.
  const today = wallClock(after);
  let candidate = new Date(
    Date.UTC(
      Number(today.key.slice(0, 4)),
      Number(today.key.slice(5, 7)) - 1,
      Number(today.key.slice(8, 10)),
      hour,
    ),
  );
  for (let pass = 0; pass < 2; pass += 1) {
    const seen = wallClock(candidate);
    const want = Date.UTC(
      Number(seen.key.slice(0, 4)),
      Number(seen.key.slice(5, 7)) - 1,
      Number(seen.key.slice(8, 10)),
      hour,
    );
    candidate = new Date(candidate.getTime() + (want - seen.ms));
  }
  while (candidate.getTime() <= after.getTime()) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
    for (let pass = 0; pass < 2; pass += 1) {
      const seen = wallClock(candidate);
      const want = Date.UTC(
        Number(seen.key.slice(0, 4)),
        Number(seen.key.slice(5, 7)) - 1,
        Number(seen.key.slice(8, 10)),
        hour,
      );
      candidate = new Date(candidate.getTime() + (want - seen.ms));
    }
  }
  return candidate;
}

/** Idempotent seeding + hygiene, run every tick before claiming. */
export async function seedJournalSchedules(now = new Date()): Promise<void> {
  const sql = mapDb();

  // New eligible families get a row pointed at their next local 8pm.
  const eligible = await sql<{ id: string; time_zone: string }[]>`
    select f.id, f.time_zone from public.families f
    where f.email is not null
      and f.time_zone is not null
      and f.journal_opt_out_at is null
      and f.created_at < now() - interval '20 hours'
      and exists (select 1 from public.children c where c.family_id = f.id)
      and not exists (
        select 1 from public.agent_schedules s
        where s.family_id = f.id and s.kind = 'journal_prompt'
      )
  `;
  for (const family of eligible) {
    try {
      const nextRun = nextLocalHourInstant(family.time_zone, PROMPT_LOCAL_HOUR, now);
      await sql`
        insert into public.agent_schedules (family_id, kind, next_run_at)
        values (${family.id}, 'journal_prompt', ${nextRun.toISOString()})
        on conflict (family_id, kind) do nothing
      `;
    } catch (error) {
      console.error(
        `journal seed failed for family ${family.id}:`,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  // Opted-out or no-longer-eligible families go quiet; returners wake up.
  await sql`
    update public.agent_schedules s
    set enabled = false
    from public.families f
    where s.family_id = f.id and s.kind = 'journal_prompt' and s.enabled
      and (f.journal_opt_out_at is not null or f.email is null or f.time_zone is null)
  `;
  await sql`
    update public.agent_schedules s
    set enabled = true
    from public.families f
    where s.family_id = f.id and s.kind = 'journal_prompt' and not s.enabled
      and f.journal_opt_out_at is null and f.email is not null and f.time_zone is not null
  `;
}

/** Atomically leases due journal rows and returns delivery-ready jobs. */
export async function claimDueJournalJobs(options: {
  now: Date;
  limit: number;
  leaseForMs: number;
}): Promise<DueJournalJob[]> {
  const sql = mapDb();
  const leaseUntil = new Date(options.now.getTime() + options.leaseForMs).toISOString();
  const rows = await sql<
    {
      schedule_id: string;
      family_id: string;
      time_zone: string;
      first_name: string | null;
      parent_display_name: string | null;
      email: string | null;
      phone_e164: string | null;
      child_names: string[];
    }[]
  >`
    with claimed as (
      update public.agent_schedules s
      set lease_until = ${leaseUntil}
      where s.id in (
        select id from public.agent_schedules
        where kind = 'journal_prompt' and enabled
          and next_run_at <= ${options.now.toISOString()}
          and (lease_until is null or lease_until < ${options.now.toISOString()})
        order by next_run_at
        limit ${options.limit}
        for update skip locked
      )
      returning s.id, s.family_id
    )
    select claimed.id as schedule_id, f.id as family_id, f.time_zone,
           f.first_name, f.parent_display_name, f.email,
           (select p.phone_e164 from public.family_phones p where p.family_id = f.id) as phone_e164,
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
    timeZone: row.time_zone,
    parentFirstName: row.parent_display_name ?? row.first_name,
    kidPhrase: row.child_names.length === 1 ? row.child_names[0] : "the kids",
    phoneE164: row.phone_e164,
    email: row.email,
  }));
}

export async function completeJournalJob(job: DueJournalJob, now = new Date()): Promise<void> {
  const sql = mapDb();
  const nextRun = nextLocalHourInstant(job.timeZone, PROMPT_LOCAL_HOUR, now);
  await sql`
    update public.agent_schedules
    set next_run_at = ${nextRun.toISOString()}, last_run_at = now(), lease_until = null
    where id = ${job.scheduleId}
  `;
}

export async function releaseJournalJob(job: DueJournalJob): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.agent_schedules set lease_until = null where id = ${job.scheduleId}
  `;
}
