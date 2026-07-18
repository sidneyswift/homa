import { listHandledAlerts, type HandledAlert } from "./alert-acks";
import { adminDb } from "./db";
import { getFamilySnapshots, type FamilySnapshot } from "./roster-data";
import {
  countPossibleMorningBriefInterest,
  summarizeMorningOfferFunnel,
  summarizeTaskPromptOutcomes,
  type MorningOfferCohortRow,
  type MorningOfferFunnelSummary,
  type PromptOutcome,
  type TaskPromptOutcomeSummary,
} from "./morning-brief-metrics";
import { summarizeUsageCost, type UsageCostSummary } from "../model-pricing";
import { getModelPriceBook, type PriceBookStatus } from "../model-pricing-live";
import type { FamilyTaskKind } from "../tasks/kinds";

/**
 * Fleet aggregates for the founder console's overview (MJ-14 mission
 * control). One call fans out the range-scoped SQL and merges it with the
 * family snapshots; every number is a live query, no rollups (lab
 * question 5, founder answer 2026-07-12: live now, snapshots later).
 *
 * Alerts the founder marked handled (admin_alert_acknowledgments, the
 * 2026-07-13 "mark handled" ask) drop out of the trouble lists here but
 * stay inside every count: hiding an alert never edits history. The
 * hide rules live in lib/admin/alert-acks.ts.
 */

export type OverviewRange = 7 | 28;

export interface DeliveryTrouble {
  id: string;
  familyName: string;
  channel: string;
  status: "failed" | "uncertain";
  error: string | null;
  at: string;
}

export interface RunTrouble {
  id: string;
  familyName: string | null;
  kind: string;
  status: string;
  error: string | null;
  at: string;
}

export interface EmailTrouble {
  id: string;
  kind: string;
  status: string;
  error: string | null;
  at: string;
}

/** An inbound SMS or email whose webhook was claimed but never completed:
 * the season-sim BUG-P3-2 silent stall, where a family keeps texting into a
 * thread that has quietly stopped answering. A receipt still 'claimed' this
 * long after the claim is a lost turn, not one in flight. */
export interface InboundTrouble {
  id: string;
  familyName: string | null;
  channel: string;
  at: string;
}

/** A claimed inbound receipt older than this never finished; the longest
 * legitimate turn seen in the field study was about five minutes, so this
 * is comfortably past in-flight and short enough to notice same-morning. */
const INBOUND_STALL_MINUTES = 15;

export interface FleetOverview {
  rangeDays: OverviewRange;
  snapshots: FamilySnapshot[];
  activeFamilies: number;
  newSignups: FamilySnapshot[];
  runCounts: Record<string, number>;
  runTrouble: RunTrouble[];
  deliveryCounts: Record<string, number>;
  deliveryTrouble: DeliveryTrouble[];
  morningOfferFunnel: MorningOfferFunnelSummary;
  taskPromptOutcomes: Record<FamilyTaskKind, TaskPromptOutcomeSummary>;
  possibleMorningBriefInterest: number;
  nonTaskReplies: number;
  userMessages: number;
  messagesByDay: number[];
  materialsCount: number;
  hoursMinutes: number;
  emailCounts: Record<string, number>;
  emailTrouble: EmailTrouble[];
  inboundTrouble: InboundTrouble[];
  cronLastAt: string | null;
  cronLastOk: boolean | null;
  /** True when the newest heartbeat is over two hours old (the cron is
   * hourly, so one missed tick plus slack). Computed here because pages
   * must stay pure: no clock reads during render. */
  cronLate: boolean;
  modelCalls: number;
  modelTokens: number;
  /** Price-book estimate of range spend, plus any unpriced models. */
  modelCost: UsageCostSummary;
  /** Which prices did the math: live gateway or pinned fallback. */
  priceBook: PriceBookStatus;
  /** Alerts marked handled that would otherwise show in this range. */
  handledAlerts: HandledAlert[];
}

export async function getFleetOverview(rangeDays: OverviewRange): Promise<FleetOverview> {
  const sql = adminDb();
  const priceBook = await getModelPriceBook();
  const interval = `${rangeDays} days`;

  // Sequential on purpose, never Promise.all: see lib/admin/db.ts.
  const snapshots = await getFamilySnapshots();
  const runRows = await sql<{ status: string; n: number }[]>`
    select status, count(*)::int as n from public.homa_task_runs
    where started_at >= now() - ${interval}::interval
    group by status
  `;
  const runTroubleRows = await sql<{ id: string; family_name: string | null; kind: string; status: string; error: string | null; at: string }[]>`
    select r.id, f.name as family_name, r.kind, r.status, r.error, r.started_at::text as at
    from public.homa_task_runs r
    left join public.families f on f.id = r.family_id
    where r.status in ('failed', 'uncertain', 'partial', 'partial_uncertain')
      and r.started_at >= now() - ${interval}::interval
      and not exists (
        select 1 from public.admin_alert_acknowledgments a
        where a.source = 'task_run' and a.source_id = r.id
      )
    order by r.started_at desc
    limit 12
  `;
  const deliveryRows = await sql<{ status: string; n: number }[]>`
    select status, count(*)::int as n from public.conversation_deliveries
    where created_at >= now() - ${interval}::interval
    group by status
  `;
  // A delivery can fail again after being marked handled (retries bump
  // updated_at), so the ack only hides rows it is newer than.
  const troubleRows = await sql<{ id: string; family_name: string; channel: string; status: string; error: string | null; at: string }[]>`
    select d.id, f.name as family_name, d.channel, d.status, d.error, d.updated_at::text as at
    from public.conversation_deliveries d
    join public.families f on f.id = d.family_id
    where d.status in ('failed', 'uncertain')
      and d.updated_at >= now() - ${interval}::interval
      and not exists (
        select 1 from public.admin_alert_acknowledgments a
        where a.source = 'delivery' and a.source_id = d.id
          and a.created_at >= d.updated_at
      )
    order by d.updated_at desc
    limit 12
  `;
  const morningOfferRows = await sql<
    {
      state: MorningOfferCohortRow["state"];
      expires_at: string;
      resolved_outcome: PromptOutcome | null;
      fulfilled: boolean;
    }[]
  >`
    select
      l.state,
      l.expires_at::text as expires_at,
      l.resolved_outcome,
      (
        exists (
          select 1
          from public.conversation_offer_fulfillments fulfillment
          where fulfillment.source_delivery_id = d.id
            and fulfillment.family_id = d.family_id
        )
        or exists (
          select 1
          from public.materials material
          where material.source_offer_delivery_id = d.id
            and material.family_id = d.family_id
        )
        or exists (
          select 1
          from public.agent_schedules schedule
          where schedule.source_offer_delivery_id = d.id
            and schedule.family_id = d.family_id
        )
      ) as fulfilled
    from public.conversation_deliveries d
    join public.conversation_open_loops l
      on l.delivery_id = d.id
     and l.family_id = d.family_id
    join public.homa_task_runs r
      on r.id = d.task_run_id
     and r.family_id = d.family_id
    join public.families f on f.id = d.family_id
    where r.kind = 'morning_brief'
      and d.status = 'sent'
      and d.sent_at >= now() - ${interval}::interval
      and not f.sandbox
  `;
  const sentTaskPromptRows = await sql<{ task_kind: FamilyTaskKind }[]>`
    select r.kind as task_kind
    from public.conversation_deliveries d
    join public.conversation_open_loops l on l.delivery_id = d.id
    join public.homa_task_runs r
      on r.id = d.task_run_id
     and r.family_id = d.family_id
    where r.kind in ('journal_prompt', 'custom')
      and d.status = 'sent'
      and d.sent_at >= now() - ${interval}::interval
  `;
  const resolvedTaskPromptRows = await sql<
    {
      task_kind: FamilyTaskKind;
      resolved_outcome: PromptOutcome | null;
    }[]
  >`
    select r.kind as task_kind, l.resolved_outcome
    from public.conversation_open_loops l
    join public.conversation_deliveries d on d.id = l.delivery_id
    join public.homa_task_runs r
      on r.id = d.task_run_id
     and r.family_id = d.family_id
    where r.kind in ('journal_prompt', 'custom')
      and l.state = 'resolved'
      and l.resolved_at >= now() - ${interval}::interval
  `;
  const nonTaskReplyRows = await sql<{ n: number }[]>`
    select count(*)::int as n from public.conversation_deliveries
    where replied_at is not null
      and replied_at >= now() - ${interval}::interval
      and task_run_id is null
  `;
  const possibleInterestRows = await sql<
    {
      message_created_at: string;
      replied_delivery_id: string | null;
      sent_morning_brief_at: string | null;
    }[]
  >`
    select
      m.created_at::text as message_created_at,
      m.replied_delivery_id,
      brief.sent_at::text as sent_morning_brief_at
    from public.conversation_messages m
    join public.families f on f.id = m.family_id
    join lateral (
        select d.sent_at::text
        from public.conversation_deliveries d
        join public.homa_task_runs r
          on r.id = d.task_run_id
         and r.family_id = d.family_id
        where d.family_id = m.family_id
          and d.episode_id = m.episode_id
          and d.status = 'sent'
          and r.kind = 'morning_brief'
          and d.sent_at <= m.created_at
          and m.created_at <= d.sent_at + interval '4 hours'
        order by d.sent_at desc
        limit 1
      ) brief on true
    where m.role = 'user'
      and not f.sandbox
      and m.replied_delivery_id is null
      and m.created_at >= now() - ${interval}::interval
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
  const emailTroubleRows = await sql<{ id: string; kind: string; status: string; error: string | null; at: string }[]>`
    select e.id, e.kind, e.status, e.error, e.updated_at::text as at
    from public.email_sends e
    where e.status in ('rejected', 'bounced', 'complained')
      and e.updated_at >= now() - ${interval}::interval
      and not exists (
        select 1 from public.admin_alert_acknowledgments a
        where a.source = 'email_send' and a.source_id = e.id
          and a.created_at >= e.updated_at
      )
    order by e.updated_at desc
    limit 12
  `;
  // Inbound turns claimed but never completed (a lost SMS/email turn looks
  // identical to one in flight, so nothing surfaced it before). Bounded by
  // the range like every other trouble list, hidden once marked handled.
  const inboundTroubleRows = await sql<{ id: string; family_name: string | null; channel: string; at: string }[]>`
    select ir.id, f.name as family_name, ir.channel, ir.claimed_at::text as at
    from public.conversation_inbound_receipts ir
    left join public.families f on f.id = ir.family_id
    where ir.status = 'claimed'
      and ir.claimed_at < now() - ${`${INBOUND_STALL_MINUTES} minutes`}::interval
      and ir.claimed_at >= now() - ${interval}::interval
      and not exists (
        select 1 from public.admin_alert_acknowledgments a
        where a.source = 'inbound_receipt' and a.source_id = ir.id
          and a.created_at >= ir.claimed_at
      )
    order by ir.claimed_at desc
    limit 12
  `;
  const cronRows = await sql<{ ran_at: string; ok: boolean }[]>`
    select ran_at::text as ran_at, ok from public.cron_runs
    where job = 'map_cron'
    order by ran_at desc limit 1
  `;
  // Grouped by model so each one prices at its own input/output/cache
  // rates; the tile then shows the summed estimate.
  const usageRows = await sql<
    {
      model: string;
      calls: number;
      tokens_in: number;
      tokens_out: number;
      cache_read: number;
      cache_write: number;
    }[]
  >`
    select model, count(*)::int as calls,
           coalesce(sum(input_tokens), 0)::int as tokens_in,
           coalesce(sum(output_tokens), 0)::int as tokens_out,
           coalesce(sum(cache_read_tokens), 0)::int as cache_read,
           coalesce(sum(cache_write_tokens), 0)::int as cache_write
    from public.model_usage
    where created_at >= now() - ${interval}::interval
    group by model
  `;
  const handledAlerts = await listHandledAlerts(rangeDays);

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
      id: row.id,
      familyName: row.family_name,
      kind: row.kind,
      status: row.status,
      error: row.error,
      at: row.at,
    })),
    deliveryCounts: toCounts(deliveryRows),
    deliveryTrouble: troubleRows.map((row) => ({
      id: row.id,
      familyName: row.family_name,
      channel: row.channel,
      status: row.status as "failed" | "uncertain",
      error: row.error,
      at: row.at,
    })),
    morningOfferFunnel: summarizeMorningOfferFunnel(
      morningOfferRows.map((row) => ({
        state: row.state,
        expiresAt: new Date(row.expires_at),
        outcome: row.resolved_outcome,
        fulfilled: row.fulfilled,
      })),
      new Date(),
    ),
    taskPromptOutcomes: summarizeTaskPromptOutcomes(
      [
        ...sentTaskPromptRows.map((row) => ({
          taskKind: row.task_kind,
          sentInRange: true,
          resolvedInRange: false,
          outcome: null,
        })),
        ...resolvedTaskPromptRows.map((row) => ({
          taskKind: row.task_kind,
          sentInRange: false,
          resolvedInRange: true,
          outcome: row.resolved_outcome,
        })),
      ],
    ),
    possibleMorningBriefInterest: countPossibleMorningBriefInterest(
      possibleInterestRows.map((row) => ({
        sentMorningBriefAt: row.sent_morning_brief_at
          ? new Date(row.sent_morning_brief_at)
          : null,
        messageCreatedAt: new Date(row.message_created_at),
        repliedDeliveryId: row.replied_delivery_id,
      })),
    ),
    nonTaskReplies: nonTaskReplyRows[0].n,
    userMessages: messageRows[0].n,
    messagesByDay: messagesPerDay.map((row) => row.n),
    materialsCount: materialRows[0].n,
    hoursMinutes: hourRows[0].minutes,
    emailCounts: toCounts(emailRows),
    emailTrouble: emailTroubleRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      error: row.error,
      at: row.at,
    })),
    inboundTrouble: inboundTroubleRows.map((row) => ({
      id: row.id,
      familyName: row.family_name,
      channel: row.channel,
      at: row.at,
    })),
    cronLastAt: cronRows[0]?.ran_at ?? null,
    cronLastOk: cronRows[0]?.ok ?? null,
    cronLate: cronRows[0]
      ? Date.now() - new Date(cronRows[0].ran_at).getTime() > 2 * 60 * 60 * 1000
      : false,
    modelCalls: usageRows.reduce((sum, row) => sum + row.calls, 0),
    modelTokens: usageRows.reduce((sum, row) => sum + row.tokens_in + row.tokens_out, 0),
    modelCost: summarizeUsageCost(
      usageRows.map((row) => ({
        model: row.model,
        inputTokens: row.tokens_in,
        outputTokens: row.tokens_out,
        cacheReadTokens: row.cache_read,
        cacheWriteTokens: row.cache_write,
      })),
      { rates: priceBook.rates },
    ),
    priceBook: { source: priceBook.source, fetchedAt: priceBook.fetchedAt },
    handledAlerts,
  };
}
