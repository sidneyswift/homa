import { adminDb } from "./db";
import { getFamilySnapshots, type FamilySnapshot } from "./roster-data";

/**
 * Fleet aggregates for the founder console's overview (MJ-14 mission
 * control). One call fans out the range-scoped SQL and merges it with the
 * family snapshots; every number is a live query, no rollups (lab
 * question 5, founder answer 2026-07-12: live now, snapshots later).
 */

export type OverviewRange = 7 | 28;

export interface DeliveryTrouble {
  familyName: string;
  channel: string;
  status: "failed" | "uncertain";
  error: string | null;
  at: string;
}

export interface RunTrouble {
  familyName: string | null;
  kind: string;
  status: string;
  error: string | null;
  at: string;
}

export interface EmailTrouble {
  kind: string;
  status: string;
  error: string | null;
  at: string;
}

export interface FleetOverview {
  rangeDays: OverviewRange;
  snapshots: FamilySnapshot[];
  activeFamilies: number;
  newSignups: FamilySnapshot[];
  runCounts: Record<string, number>;
  runTrouble: RunTrouble[];
  deliveryCounts: Record<string, number>;
  deliveryTrouble: DeliveryTrouble[];
  replies: number;
  userMessages: number;
  messagesByDay: number[];
  materialsCount: number;
  hoursMinutes: number;
  emailCounts: Record<string, number>;
  emailTrouble: EmailTrouble[];
  cronLastAt: string | null;
  cronLastOk: boolean | null;
  /** True when the newest heartbeat is over two hours old (the cron is
   * hourly, so one missed tick plus slack). Computed here because pages
   * must stay pure: no clock reads during render. */
  cronLate: boolean;
  modelCalls: number;
  modelTokens: number;
}

export async function getFleetOverview(rangeDays: OverviewRange): Promise<FleetOverview> {
  const sql = adminDb();
  const interval = `${rangeDays} days`;

  // Sequential on purpose, never Promise.all: see lib/admin/db.ts.
  const snapshots = await getFamilySnapshots();
  const runRows = await sql<{ status: string; n: number }[]>`
    select status, count(*)::int as n from public.homa_task_runs
    where started_at >= now() - ${interval}::interval
    group by status
  `;
  const runTroubleRows = await sql<{ family_name: string | null; kind: string; status: string; error: string | null; at: string }[]>`
    select f.name as family_name, r.kind, r.status, r.error, r.started_at::text as at
    from public.homa_task_runs r
    left join public.families f on f.id = r.family_id
    where r.status in ('failed', 'uncertain', 'partial', 'partial_uncertain')
      and r.started_at >= now() - ${interval}::interval
    order by r.started_at desc
    limit 12
  `;
  const deliveryRows = await sql<{ status: string; n: number }[]>`
    select status, count(*)::int as n from public.conversation_deliveries
    where created_at >= now() - ${interval}::interval
    group by status
  `;
  const troubleRows = await sql<{ family_name: string; channel: string; status: string; error: string | null; at: string }[]>`
    select f.name as family_name, d.channel, d.status, d.error, d.updated_at::text as at
    from public.conversation_deliveries d
    join public.families f on f.id = d.family_id
    where d.status in ('failed', 'uncertain')
      and d.updated_at >= now() - ${interval}::interval
    order by d.updated_at desc
    limit 12
  `;
  const replyRows = await sql<{ n: number }[]>`
    select count(*)::int as n from public.conversation_deliveries
    where replied_at is not null and replied_at >= now() - ${interval}::interval
  `;
  const messageRows = await sql<{ n: number }[]>`
    select count(*)::int as n from public.conversation_messages
    where role = 'user' and created_at >= now() - ${interval}::interval
  `;
  const messagesPerDay = await sql<{ day: string; n: number }[]>`
    select date_trunc('day', created_at)::date::text as day, count(*)::int as n
    from public.conversation_messages
    where role = 'user' and created_at >= now() - ${interval}::interval
    group by 1 order by 1
  `;
  const materialRows = await sql<{ n: number }[]>`
    select count(*)::int as n from public.materials
    where created_at >= now() - ${interval}::interval
  `;
  const hourRows = await sql<{ minutes: number }[]>`
    select coalesce(sum(minutes), 0)::int as minutes from public.hours_log
    where created_at >= now() - ${interval}::interval
  `;
  const emailRows = await sql<{ status: string; n: number }[]>`
    select status, count(*)::int as n from public.email_sends
    where created_at >= now() - ${interval}::interval
    group by status
  `;
  const emailTroubleRows = await sql<{ kind: string; status: string; error: string | null; at: string }[]>`
    select kind, status, error, updated_at::text as at from public.email_sends
    where status in ('rejected', 'bounced', 'complained')
      and updated_at >= now() - ${interval}::interval
    order by updated_at desc
    limit 12
  `;
  const cronRows = await sql<{ ran_at: string; ok: boolean }[]>`
    select ran_at::text as ran_at, ok from public.cron_runs
    where job = 'map_cron'
    order by ran_at desc limit 1
  `;
  const usageRows = await sql<{ calls: number; tokens: number }[]>`
    select count(*)::int as calls,
           (coalesce(sum(input_tokens), 0) + coalesce(sum(output_tokens), 0))::int as tokens
    from public.model_usage
    where created_at >= now() - ${interval}::interval
  `;

  const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
  const activeIds = new Set(
    snapshots
      .filter(
        (s) => s.lastUserActivityAt && new Date(s.lastUserActivityAt).getTime() >= cutoff,
      )
      .map((s) => s.id),
  );

  const toCounts = (rows: { status: string; n: number }[]) =>
    Object.fromEntries(rows.map((row) => [row.status, row.n]));

  return {
    rangeDays,
    snapshots,
    activeFamilies: activeIds.size,
    newSignups: snapshots.filter((s) => new Date(s.createdAt).getTime() >= cutoff),
    runCounts: toCounts(runRows),
    runTrouble: runTroubleRows.map((row) => ({
      familyName: row.family_name,
      kind: row.kind,
      status: row.status,
      error: row.error,
      at: row.at,
    })),
    deliveryCounts: toCounts(deliveryRows),
    deliveryTrouble: troubleRows.map((row) => ({
      familyName: row.family_name,
      channel: row.channel,
      status: row.status as "failed" | "uncertain",
      error: row.error,
      at: row.at,
    })),
    replies: replyRows[0].n,
    userMessages: messageRows[0].n,
    messagesByDay: messagesPerDay.map((row) => row.n),
    materialsCount: materialRows[0].n,
    hoursMinutes: hourRows[0].minutes,
    emailCounts: toCounts(emailRows),
    emailTrouble: emailTroubleRows.map((row) => ({
      kind: row.kind,
      status: row.status,
      error: row.error,
      at: row.at,
    })),
    cronLastAt: cronRows[0]?.ran_at ?? null,
    cronLastOk: cronRows[0]?.ok ?? null,
    cronLate: cronRows[0]
      ? Date.now() - new Date(cronRows[0].ran_at).getTime() > 2 * 60 * 60 * 1000
      : false,
    modelCalls: usageRows[0].calls,
    modelTokens: usageRows[0].tokens,
  };
}
