import { listHandledAlerts, type HandledAlert } from "./alert-acks";
import { adminDb } from "./db";
import { STOP_ERROR_PATTERNS } from "./delivery-errors";
import { adminTimeZone, dayKey } from "./format";
import { getFamilySnapshots, type FamilySnapshot } from "./roster-data";
import {
  countPossibleMorningBriefInterest,
  summarizeMorningOfferFunnel,
  type MorningOfferCohortRow,
  type MorningOfferFunnelSummary,
  type PromptOutcome,
} from "./morning-brief-metrics";
import { summarizeUsageCost, type UsageCostSummary } from "../model-pricing";
import { getModelPriceBook, type PriceBookStatus } from "../model-pricing-live";

/**
 * Fleet aggregates for the founder console's overview (MJ-14 mission
 * control). One call fans out the range-scoped SQL and merges it with the
 * family snapshots; every number is a live query, no rollups (lab
 * question 5, founder answer 2026-07-12: live now, snapshots later).
 *
 * Test families (families.sandbox) are excluded from every count by
 * default (founder ask 2026-07-23: the headline said 81 families when 13
 * were test signups). includeTests widens the counts back out for
 * debugging; the alert strip, the opted-out list, and the growth line
 * stay customers-only either way, because a test family waiting on us is
 * not an outage and a test signup is not growth.
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
  familyName: string | null;
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

/** A parent said yes to a morning-brief offer (the loop resolved
 * 'accepted'), but no fulfillment row was ever written: the agent turn that
 * makes the worksheet or task crashed after the acceptance was booked, so
 * the family got silence where an artifact was promised. Confirmed live
 * 2026-07-20 (Chan family, Noah's project-planning worksheet). This is the
 * semantically-correct unit the receipt-level 'sms turn never answered'
 * alert only caught by luck: acceptance and fulfillment are decoupled, so
 * the recoverable signal is an accepted offer with no matching fulfillment.
 * Stale past the same minutes as an inbound turn (fulfillment rides the same
 * turn as acceptance, so seconds is normal and minutes means dropped), and
 * bounded to the 24h window in which reserveAcceptedOfferFulfillment still
 * treats the offer as re-fulfillable. */
export interface OfferTrouble {
  id: string;
  familyName: string;
  /** Whole minutes since the parent accepted, for a plain "43m ago" line. */
  at: string;
}

const OFFER_FULFILLMENT_STALL_MINUTES = 15;
const OFFER_FULFILLMENT_WINDOW_HOURS = 24;

/** One point of a growth line: founder-local day, running total by the
 * end of it. */
export interface FamiliesByDayPoint {
  day: string;
  total: number;
}

/** The three growth lines (founder rulings 2026-07-23): signups counts
 * every real signup including families that never finished the account
 * step, so it is top-of-funnel demand; accounts counts families whose
 * first member row landed (the population the page headline and roster
 * count); setupDone counts families that finished setup and added a kid.
 * The vertical gaps between the lines ARE the funnel leaks, which is why
 * this is three fixed lines and not a filter. */
export interface GrowthSeries {
  signups: FamiliesByDayPoint[];
  accounts: FamiliesByDayPoint[];
  setupDone: FamiliesByDayPoint[];
}

/** A family whose sends are blocked because they texted STOP. A choice,
 * honored automatically, never an alert. */
export interface OptOutFamily {
  familyId: string;
  familyName: string;
  at: string;
}

export interface FleetOverview {
  rangeDays: OverviewRange;
  /** Whether test families are included in the counts (?families=all). */
  includeTests: boolean;
  snapshots: FamilySnapshot[];
  /** Test families hidden (or, with includeTests, included). */
  sandboxCount: number;
  activeFamilies: number;
  newSignups: FamilySnapshot[];
  /** Cumulative real signups and setup-done families per founder-local
   * day, full history. Always customers-only: the growth lines are the
   * story of the business. */
  growth: GrowthSeries;
  runCounts: Record<string, number>;
  runTrouble: RunTrouble[];
  deliveryCounts: Record<string, number>;
  deliveryTrouble: DeliveryTrouble[];
  /** Range-scoped failed and uncertain sends to real families, STOP blocks
   * excluded: the number the "did not arrive" copy can say honestly. */
  undeliveredCount: number;
  /** Raw count of STOP-blocked sends in range (a family can hit several). */
  stopBlockedCount: number;
  /** One row per family whose sends hit a STOP block in range, newest first. */
  optOuts: OptOutFamily[];
  morningOfferFunnel: MorningOfferFunnelSummary;
  possibleMorningBriefInterest: number;
  userMessages: number;
  /** User messages per founder-local day, oldest first, zero-filled so the
   * sparkline keeps its shape on quiet days. */
  messagesByDay: number[];
  emailCounts: Record<string, number>;
  emailTrouble: EmailTrouble[];
  inboundTrouble: InboundTrouble[];
  /** Accepted morning-brief offers whose fulfillment turn dropped: a yes
   * with no artifact. See OfferTrouble. */
  offerTrouble: OfferTrouble[];
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

/** Walks founder-local day keys from startDay (default: the first row's
 * day) through today and carries the running total across zero-event
 * days, so a growth line never skips a quiet day. Both growth lines pass
 * the same startDay so their x domains align. Day keys are plain
 * calendar dates; stepping them with UTC math is safe. */
function buildCumulativeByDay(
  rowsPerDay: { day: string; n: number }[],
  todayKey: string,
  startDay: string | undefined = rowsPerDay[0]?.day,
): FamiliesByDayPoint[] {
  if (!startDay) return [];
  const byDay = new Map(rowsPerDay.map((row) => [row.day, row.n]));
  const points: FamiliesByDayPoint[] = [];
  let total = 0;
  let cursor = new Date(`${startDay}T00:00:00Z`);
  const last = new Date(`${todayKey}T00:00:00Z`);
  while (cursor.getTime() <= last.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    total += byDay.get(key) ?? 0;
    points.push({ day: key, total });
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return points;
}

export async function getFleetOverview(
  rangeDays: OverviewRange,
  opts: { includeTests?: boolean } = {},
): Promise<FleetOverview> {
  const sql = adminDb();
  const includeTests = opts.includeTests === true;
  const priceBook = await getModelPriceBook();
  const interval = `${rangeDays} days`;
  const tz = adminTimeZone();
  // Null-safe: on a left join a fleet-level row (no family) passes too.
  const customersOnly = includeTests ? sql`` : sql`and f.sandbox is not true`;
  const [stopPattern40300, stopPatternText] = STOP_ERROR_PATTERNS;

  // Sequential on purpose, never Promise.all: see lib/admin/db.ts.
  const allSnapshots = await getFamilySnapshots(new Date(), rangeDays);
  // Every real signup, husks included (founder ruling 2026-07-23): the
  // signups line measures demand, so it must not require the account
  // step the roster requires.
  const signupsPerDay = await sql<{ day: string; n: number }[]>`
    select ((f.created_at at time zone ${tz})::date)::text as day, count(*)::int as n
    from public.families f
    where coalesce(f.status, 'open') <> 'deleted'
      and f.sandbox is not true
    group by 1 order by 1
  `;
  // Account open = the family's first member row; this is the population
  // the headline and the roster count, so the middle line is the one the
  // rest of the page agrees with.
  const accountsPerDay = await sql<{ day: string; n: number }[]>`
    select ((member.first_at at time zone ${tz})::date)::text as day, count(*)::int as n
    from public.families f
    join lateral (
      select min(m.created_at) as first_at
      from public.family_members m
      where m.family_id = f.id
    ) member on true
    where coalesce(f.status, 'open') <> 'deleted'
      and f.sandbox is not true
      and member.first_at is not null
    group by 1 order by 1
  `;
  // Setup done = profile completed and at least one kid added; the
  // milestone day is whichever of the two happened last.
  const setupPerDay = await sql<{ day: string; n: number }[]>`
    select ((greatest(f.profile_completed_at, kid.first_at) at time zone ${tz})::date)::text as day,
           count(*)::int as n
    from public.families f
    join lateral (
      select min(c.created_at) as first_at
      from public.children c
      where c.family_id = f.id
    ) kid on true
    where coalesce(f.status, 'open') <> 'deleted'
      and f.sandbox is not true
      and f.profile_completed_at is not null
      and kid.first_at is not null
    group by 1 order by 1
  `;
  const runRows = await sql<{ status: string; n: number }[]>`
    select r.status, count(*)::int as n
    from public.homa_task_runs r
    left join public.families f on f.id = r.family_id
    where r.started_at >= now() - ${interval}::interval
      ${customersOnly}
    group by r.status
  `;
  const runTroubleRows = await sql<{ id: string; family_name: string | null; kind: string; status: string; error: string | null; at: string }[]>`
    select r.id, f.name as family_name, r.kind, r.status, r.error, r.started_at::text as at
    from public.homa_task_runs r
    left join public.families f on f.id = r.family_id
    where r.status in ('failed', 'uncertain', 'partial', 'partial_uncertain')
      and r.started_at >= now() - ${interval}::interval
      and f.sandbox is not true
      and not exists (
        select 1 from public.admin_alert_acknowledgments a
        where a.source = 'task_run' and a.source_id = r.id
      )
    order by r.started_at desc
    limit 12
  `;
  const deliveryRows = await sql<{ status: string; n: number }[]>`
    select d.status, count(*)::int as n
    from public.conversation_deliveries d
    join public.families f on f.id = d.family_id
    where d.created_at >= now() - ${interval}::interval
      ${customersOnly}
    group by d.status
  `;
  // A delivery can fail again after being marked handled (retries bump
  // updated_at), so the ack only hides rows it is newer than. STOP blocks
  // are not trouble: they route to the opted-out list below.
  const troubleRows = await sql<{ id: string; family_name: string; channel: string; status: string; error: string | null; at: string }[]>`
    select d.id, f.name as family_name, d.channel, d.status, d.error, d.updated_at::text as at
    from public.conversation_deliveries d
    join public.families f on f.id = d.family_id
    where d.status in ('failed', 'uncertain')
      and d.updated_at >= now() - ${interval}::interval
      and f.sandbox is not true
      and not (
        coalesce(d.error, '') ilike ${stopPattern40300}
        or coalesce(d.error, '') ilike ${stopPatternText}
      )
      and not exists (
        select 1 from public.admin_alert_acknowledgments a
        where a.source = 'delivery' and a.source_id = d.id
          and a.created_at >= d.updated_at
      )
    order by d.updated_at desc
    limit 12
  `;
  const undeliveredRows = await sql<{ n: number }[]>`
    select count(*)::int as n
    from public.conversation_deliveries d
    join public.families f on f.id = d.family_id
    where d.status in ('failed', 'uncertain')
      and d.created_at >= now() - ${interval}::interval
      and f.sandbox is not true
      and not (
        coalesce(d.error, '') ilike ${stopPattern40300}
        or coalesce(d.error, '') ilike ${stopPatternText}
      )
  `;
  const stopRows = await sql<{ family_id: string; family_name: string; at: string }[]>`
    select d.family_id, f.name as family_name, d.updated_at::text as at
    from public.conversation_deliveries d
    join public.families f on f.id = d.family_id
    where d.status in ('failed', 'uncertain')
      and d.updated_at >= now() - ${interval}::interval
      and f.sandbox is not true
      and (
        coalesce(d.error, '') ilike ${stopPattern40300}
        or coalesce(d.error, '') ilike ${stopPatternText}
      )
    order by d.updated_at desc
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
            and (
              (
                fulfillment.kind = 'material'
                and exists (
                  select 1
                  from public.materials material
                  where material.id = fulfillment.reference_id
                    and material.family_id = fulfillment.family_id
                )
              )
              or
              (
                fulfillment.kind = 'task'
                and exists (
                  select 1
                  from public.agent_schedules schedule
                  where schedule.id = fulfillment.reference_id
                    and schedule.family_id = fulfillment.family_id
                )
              )
            )
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
    select count(*)::int as n
    from public.conversation_messages m
    join public.families f on f.id = m.family_id
    where m.role = 'user' and m.created_at >= now() - ${interval}::interval
      ${customersOnly}
  `;
  const messagesPerDay = await sql<{ day: string; n: number }[]>`
    select ((m.created_at at time zone ${tz})::date)::text as day, count(*)::int as n
    from public.conversation_messages m
    join public.families f on f.id = m.family_id
    where m.role = 'user' and m.created_at >= now() - ${interval}::interval
      ${customersOnly}
    group by 1 order by 1
  `;
  const emailRows = await sql<{ status: string; n: number }[]>`
    select e.status, count(*)::int as n
    from public.email_sends e
    left join public.families f on f.id = e.family_id
    where e.created_at >= now() - ${interval}::interval
      ${customersOnly}
    group by e.status
  `;
  const emailTroubleRows = await sql<{ id: string; family_name: string | null; kind: string; status: string; error: string | null; at: string }[]>`
    select e.id, f.name as family_name, e.kind, e.status, e.error, e.updated_at::text as at
    from public.email_sends e
    left join public.families f on f.id = e.family_id
    where e.status in ('rejected', 'bounced', 'complained')
      and e.updated_at >= now() - ${interval}::interval
      and f.sandbox is not true
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
      and f.sandbox is not true
      and not exists (
        select 1 from public.admin_alert_acknowledgments a
        where a.source = 'inbound_receipt' and a.source_id = ir.id
          and a.created_at >= ir.claimed_at
      )
    order by ir.claimed_at desc
    limit 12
  `;
  // Accepted morning-brief offers whose fulfillment never landed: the loop
  // resolved 'accepted' but no conversation_offer_fulfillments row exists for
  // the offer's delivery. That is a promised artifact the family never got,
  // and until now nothing surfaced it (acceptance and fulfillment are
  // decoupled). Bounded to the same 24h in which the offer stays
  // re-fulfillable, hidden once marked handled, sandbox excluded.
  const offerTroubleRows = await sql<{ id: string; family_name: string; at: string }[]>`
    select d.id, f.name as family_name, l.resolved_at::text as at
    from public.conversation_open_loops l
    join public.conversation_deliveries d
      on d.id = l.delivery_id and d.family_id = l.family_id
    join public.homa_task_runs r
      on r.id = d.task_run_id and r.family_id = d.family_id
    join public.families f on f.id = l.family_id
    where l.state = 'resolved'
      and l.resolved_outcome = 'accepted'
      and r.kind = 'morning_brief'
      and d.status = 'sent'
      and l.resolved_at < now() - ${`${OFFER_FULFILLMENT_STALL_MINUTES} minutes`}::interval
      and l.resolved_at >= now() - ${`${OFFER_FULFILLMENT_WINDOW_HOURS} hours`}::interval
      and not f.sandbox
      and not exists (
        select 1 from public.conversation_offer_fulfillments cof
        where cof.source_delivery_id = d.id and cof.family_id = l.family_id
      )
    order by l.resolved_at desc
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
    select u.model, count(*)::int as calls,
           coalesce(sum(u.input_tokens), 0)::int as tokens_in,
           coalesce(sum(u.output_tokens), 0)::int as tokens_out,
           coalesce(sum(u.cache_read_tokens), 0)::int as cache_read,
           coalesce(sum(u.cache_write_tokens), 0)::int as cache_write
    from public.model_usage u
    left join public.families f on f.id = u.family_id
    where u.created_at >= now() - ${interval}::interval
      ${customersOnly}
    group by u.model
  `;
  const handledAlerts = await listHandledAlerts(rangeDays);

  const now = new Date();
  const sandboxCount = allSnapshots.filter((s) => s.sandbox).length;
  const snapshots = includeTests ? allSnapshots : allSnapshots.filter((s) => !s.sandbox);

  const cutoff = now.getTime() - rangeDays * 24 * 60 * 60 * 1000;
  const activeIds = new Set(
    snapshots
      .filter(
        (s) => s.lastUserActivityAt && new Date(s.lastUserActivityAt).getTime() >= cutoff,
      )
      .map((s) => s.id),
  );

  // Zero-fill the daily message counts: a day nobody wrote still exists,
  // and dropping it bends the sparkline's shape.
  const messagesByDayMap = new Map(messagesPerDay.map((row) => [row.day, row.n]));
  const messagesByDay: number[] = [];
  for (let back = rangeDays - 1; back >= 0; back -= 1) {
    const key = dayKey(new Date(now.getTime() - back * 24 * 60 * 60 * 1000), tz);
    messagesByDay.push(messagesByDayMap.get(key) ?? 0);
  }

  // One row per opted-out family, newest block first.
  const optOutsByFamily = new Map<string, OptOutFamily>();
  for (const row of stopRows) {
    if (!optOutsByFamily.has(row.family_id)) {
      optOutsByFamily.set(row.family_id, {
        familyId: row.family_id,
        familyName: row.family_name,
        at: row.at,
      });
    }
  }

  const toCounts = (rows: { status: string; n: number }[]) =>
    Object.fromEntries(rows.map((row) => [row.status, row.n]));

  return {
    rangeDays,
    includeTests,
    snapshots,
    sandboxCount,
    activeFamilies: activeIds.size,
    newSignups: snapshots.filter((s) => new Date(s.createdAt).getTime() >= cutoff),
    growth: {
      signups: buildCumulativeByDay(signupsPerDay, dayKey(now, tz)),
      accounts: buildCumulativeByDay(accountsPerDay, dayKey(now, tz), signupsPerDay[0]?.day),
      setupDone: buildCumulativeByDay(setupPerDay, dayKey(now, tz), signupsPerDay[0]?.day),
    },
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
    undeliveredCount: undeliveredRows[0].n,
    stopBlockedCount: stopRows.length,
    optOuts: [...optOutsByFamily.values()],
    morningOfferFunnel: summarizeMorningOfferFunnel(
      morningOfferRows.map((row) => ({
        state: row.state,
        expiresAt: new Date(row.expires_at),
        outcome: row.resolved_outcome,
        fulfilled: row.fulfilled,
      })),
      now,
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
    userMessages: messageRows[0].n,
    messagesByDay,
    emailCounts: toCounts(emailRows),
    emailTrouble: emailTroubleRows.map((row) => ({
      id: row.id,
      familyName: row.family_name,
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
    offerTrouble: offerTroubleRows.map((row) => ({
      id: row.id,
      familyName: row.family_name,
      at: row.at,
    })),
    cronLastAt: cronRows[0]?.ran_at ?? null,
    cronLastOk: cronRows[0]?.ok ?? null,
    cronLate: cronRows[0]
      ? now.getTime() - new Date(cronRows[0].ran_at).getTime() > 2 * 60 * 60 * 1000
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
