import { adminDb } from "./db";
import { deriveFamilyStage, type FamilyStage } from "./stage";
import { estimateUsageCostUsd } from "../model-pricing";
import { getModelPriceBook } from "../model-pricing-live";

/**
 * The founder console's family backbone (MJ-14): one snapshot per family
 * with an account, merging the tenancy row with derived activity, report,
 * send, and billing facts. Server-only (mapDb, bypasses RLS): this is the
 * internal fleet view, gated by requireFounder() at every entry point.
 *
 * "Has an account" means a family_members row exists: one-world families
 * also get a row when the signup screen opens, so status=open husks
 * (signup not finished) stay on /admin/funnels, not this roster.
 */

export type RunOutcome = "done" | "partial" | "partial_uncertain" | "uncertain" | "failed" | "skipped" | "running";

export interface LatestRun {
  status: RunOutcome;
  scheduledFor: string | null;
  startedAt: string;
  error: string | null;
  deliveredChannel: string | null;
}

export interface FamilySnapshot {
  id: string;
  name: string;
  parentName: string | null;
  email: string | null;
  usState: string | null;
  createdAt: string;
  profileCompletedAt: string | null;
  journalOptOutAt: string | null;
  trialStartedAt: string | null;
  billingExempt: boolean;
  subscriptionStatus: string | null;
  /** Founder test family (reserved +homatest alias or console action). */
  sandbox: boolean;
  /** families.status: open | claimed | complete | deleted. */
  status: string;
  kidCount: number;
  kidNames: string[];
  hasReport: boolean;
  firstReportAt: string | null;
  lastUserActivityAt: string | null;
  /** Messages this family sent Homa inside the caller's window (default
   * 7 days). Follows the console's range toggle so a "last 4 weeks" page
   * never shows week-sized counts. */
  userMessagesInRange: number;
  /** User messages per founder-local-adjacent day, oldest first (7 slots). */
  activityByDay: number[];
  latestRuns: Partial<Record<"journal_prompt" | "morning_brief", LatestRun>>;
  tokens28d: number;
  /** Price-book estimate of the family's 28 day AI spend. */
  cost28dUsd: number;
  stage: FamilyStage;
}

interface FamilyRow {
  id: string;
  name: string;
  parent_display_name: string | null;
  email: string | null;
  us_state: string | null;
  created_at: string;
  profile_completed_at: string | null;
  journal_opt_out_at: string | null;
  trial_started_at: string | null;
  billing_exempt: boolean;
  stripe_subscription_status: string | null;
  sandbox: boolean;
  status: string;
}

export async function getFamilySnapshots(
  now: Date = new Date(),
  /** Window for userMessagesInRange; the overview passes its range toggle
   * so the families table's message counts match the page's period. */
  rangeDays = 7,
): Promise<FamilySnapshot[]> {
  const sql = adminDb();
  const priceBook = await getModelPriceBook();
  const messageInterval = `${rangeDays} days`;

  // Sequential on purpose, never Promise.all: see lib/admin/db.ts.
  const families = await sql<FamilyRow[]>`
    select f.id, f.name, f.parent_display_name, f.email, f.us_state,
           f.created_at::text as created_at,
           f.profile_completed_at::text as profile_completed_at,
           f.journal_opt_out_at::text as journal_opt_out_at,
           f.trial_started_at::text as trial_started_at,
           f.billing_exempt,
           f.stripe_subscription_status,
           f.sandbox,
           coalesce(f.status, 'open') as status
    from public.families f
    where coalesce(f.status, 'open') <> 'deleted'
      and exists (select 1 from public.family_members m where m.family_id = f.id)
    order by f.created_at desc
  `;
  const kids = await sql<{ family_id: string; n: number; names: string }[]>`
    select family_id, count(*)::int as n,
           json_agg(name order by created_at)::text as names
    from public.children group by family_id
  `;
  const reports = await sql<{ family_id: string; n: number; first_at: string }[]>`
    select c.family_id, count(r.child_id)::int as n,
           min(r.generated_at)::text as first_at
    from public.child_reports r
    join public.children c on c.id = r.child_id
    group by c.family_id
  `;
  const activity = await sql<{ family_id: string; last_at: string | null; recent: number }[]>`
    select family_id,
           max(created_at) filter (where role = 'user')::text as last_at,
           count(*) filter (
             where role = 'user' and created_at >= now() - ${messageInterval}::interval
           )::int as recent
    from public.conversation_messages
    group by family_id
  `;
  const perDay = await sql<{ family_id: string; day: string; n: number }[]>`
    select family_id, date_trunc('day', created_at)::date::text as day, count(*)::int as n
    from public.conversation_messages
    where role = 'user' and created_at >= now() - interval '7 days'
    group by family_id, date_trunc('day', created_at)
  `;
  const runs = await sql<{ family_id: string; kind: string; status: string; scheduled_for: string | null; started_at: string; error: string | null; delivered_channel: string | null }[]>`
    select distinct on (family_id, kind)
           family_id, kind, status, scheduled_for::text as scheduled_for,
           started_at::text as started_at, error, delivered_channel
    from public.homa_task_runs
    where family_id is not null and kind in ('journal_prompt', 'morning_brief')
    order by family_id, kind, started_at desc
  `;
  const usage = await sql<
    {
      family_id: string;
      model: string;
      tokens_in: number;
      tokens_out: number;
      cache_read: number;
      cache_write: number;
    }[]
  >`
    select family_id, model,
           coalesce(sum(input_tokens), 0)::int as tokens_in,
           coalesce(sum(output_tokens), 0)::int as tokens_out,
           coalesce(sum(cache_read_tokens), 0)::int as cache_read,
           coalesce(sum(cache_write_tokens), 0)::int as cache_write
    from public.model_usage
    where family_id is not null and created_at >= now() - interval '28 days'
    group by family_id, model
  `;

  const kidsBy = new Map(kids.map((row) => [row.family_id, row]));
  const reportsBy = new Map(reports.map((row) => [row.family_id, row]));
  const activityBy = new Map(activity.map((row) => [row.family_id, row]));
  const tokensBy = new Map<string, number>();
  const costBy = new Map<string, number>();
  for (const row of usage) {
    tokensBy.set(
      row.family_id,
      (tokensBy.get(row.family_id) ?? 0) + row.tokens_in + row.tokens_out,
    );
    // Unpriced models add $0 here; the overview tile carries the alarm.
    const usd =
      estimateUsageCostUsd(
        row.model,
        {
          inputTokens: row.tokens_in,
          outputTokens: row.tokens_out,
          cacheReadTokens: row.cache_read,
          cacheWriteTokens: row.cache_write,
        },
        { rates: priceBook.rates },
      ) ?? 0;
    costBy.set(row.family_id, (costBy.get(row.family_id) ?? 0) + usd);
  }

  const dayKeys: string[] = [];
  for (let back = 6; back >= 0; back -= 1) {
    const d = new Date(now.getTime() - back * 24 * 60 * 60 * 1000);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const perDayBy = new Map<string, Map<string, number>>();
  for (const row of perDay) {
    const forFamily = perDayBy.get(row.family_id) ?? new Map<string, number>();
    forFamily.set(row.day, row.n);
    perDayBy.set(row.family_id, forFamily);
  }

  const runsBy = new Map<string, FamilySnapshot["latestRuns"]>();
  for (const run of runs) {
    const forFamily = runsBy.get(run.family_id) ?? {};
    forFamily[run.kind as "journal_prompt" | "morning_brief"] = {
      status: run.status as RunOutcome,
      scheduledFor: run.scheduled_for,
      startedAt: run.started_at,
      error: run.error,
      deliveredChannel: run.delivered_channel,
    };
    runsBy.set(run.family_id, forFamily);
  }

  return families.map((family) => {
    const kidRow = kidsBy.get(family.id);
    const reportRow = reportsBy.get(family.id);
    const activityRow = activityBy.get(family.id);
    const days = perDayBy.get(family.id);
    const stage = deriveFamilyStage({
      createdAt: new Date(family.created_at),
      profileCompletedAt: family.profile_completed_at ? new Date(family.profile_completed_at) : null,
      childCount: kidRow?.n ?? 0,
      hasReport: (reportRow?.n ?? 0) > 0,
      lastUserActivityAt: activityRow?.last_at ? new Date(activityRow.last_at) : null,
      now,
    });
    return {
      id: family.id,
      name: family.name,
      parentName: family.parent_display_name,
      email: family.email,
      usState: family.us_state,
      createdAt: family.created_at,
      profileCompletedAt: family.profile_completed_at,
      journalOptOutAt: family.journal_opt_out_at,
      trialStartedAt: family.trial_started_at,
      billingExempt: family.billing_exempt,
      subscriptionStatus: family.stripe_subscription_status,
      sandbox: family.sandbox,
      status: family.status,
      kidCount: kidRow?.n ?? 0,
      kidNames: kidRow ? (JSON.parse(kidRow.names) as string[]) : [],
      hasReport: (reportRow?.n ?? 0) > 0,
      firstReportAt: reportRow?.first_at ?? null,
      lastUserActivityAt: activityRow?.last_at ?? null,
      userMessagesInRange: activityRow?.recent ?? 0,
      activityByDay: dayKeys.map((key) => days?.get(key) ?? 0),
      latestRuns: runsBy.get(family.id) ?? {},
      tokens28d: tokensBy.get(family.id) ?? 0,
      cost28dUsd: costBy.get(family.id) ?? 0,
      stage,
    };
  });
}
