import { adminDb } from "./db";

/**
 * Funnels & flows data (founder console MJ-14, direction 4): the human
 * funnel from typed events, the machine pipeline from homa_task_runs and
 * conversation_deliveries, and signup cohorts measured by weekly
 * user-message activity. Event-count funnel semantics on purpose: each
 * stage counts distinct families emitting that event inside the window,
 * which reads era health, not one strict cohort's conversion.
 */

export interface FunnelStage {
  key: string;
  name: string;
  source: string;
  count: number;
}

export interface StuckFamily {
  id: string;
  name: string;
  createdAt: string;
  note: string;
}

export interface PipelineNode {
  key: string;
  label: string;
  source: string;
  count: number;
  tone: "plain" | "fail" | "warn";
}

export interface CohortRow {
  weekStart: string;
  size: number;
  /** Families with any user message in signup week + k (null = future). */
  activeByWeek: (number | null)[];
}

export interface FunnelData {
  windowDays: number;
  stages: FunnelStage[];
  stuck: { accountNoSetup: StuckFamily[]; setupNoReport: StuckFamily[] };
  pipeline: PipelineNode[];
  cohorts: CohortRow[];
}

const FUNNEL_EVENTS: { key: string; name: string; event: string }[] = [
  { key: "started", name: "Map started", event: "map.started" },
  { key: "account", name: "Account created", event: "map.account_created" },
  { key: "setup", name: "Family setup", event: "map.family_setup" },
  { key: "kids", name: "Kids added", event: "map.child_added" },
  { key: "report", name: "Report generated", event: "map.report_generated" },
  { key: "trial", name: "Trial started", event: "billing.trial_started" },
];

export async function getFunnelData(windowDays = 28): Promise<FunnelData> {
  const sql = adminDb();
  const interval = `${windowDays} days`;

  // Sequential on purpose, never Promise.all: see lib/admin/db.ts.
  // Founder test families (families.sandbox) are fenced out of every
  // funnel read: the founder rehearsing the product must never read as
  // era health (founder ask 2026-07-14).
  const eventCounts = await sql<{ name: string; n: number }[]>`
    select e.name, count(distinct e.family_id)::int as n
    from public.events e
    where e.created_at >= now() - ${interval}::interval
      and e.name in ('map.started', 'map.account_created', 'map.family_setup',
                   'map.child_added', 'map.report_generated', 'billing.trial_started')
      and not exists (
        select 1 from public.families f
        where f.id = e.family_id and (f.sandbox or coalesce(f.status, 'open') = 'deleted')
      )
    group by e.name
  `;
  const accountNoSetup = await sql<{ id: string; name: string; created_at: string }[]>`
    select f.id, f.name, f.created_at::text as created_at
    from public.families f
    where coalesce(f.status, 'open') <> 'deleted'
      and not f.sandbox
      and exists (select 1 from public.family_members m where m.family_id = f.id)
      and f.profile_completed_at is null
    order by f.created_at desc
    limit 8
  `;
  const setupNoReport = await sql<{ id: string; name: string; created_at: string }[]>`
    select f.id, f.name, f.created_at::text as created_at
    from public.families f
    where coalesce(f.status, 'open') <> 'deleted'
      and not f.sandbox
      and exists (select 1 from public.family_members m where m.family_id = f.id)
      and f.profile_completed_at is not null
      and exists (select 1 from public.children c where c.family_id = f.id)
      and not exists (
        select 1 from public.child_reports r
        join public.children c on c.id = r.child_id
        where c.family_id = f.id
      )
    order by f.created_at desc
    limit 8
  `;
  const runRows = await sql<{ status: string; n: number }[]>`
    select status, count(*)::int as n from public.homa_task_runs
    where started_at >= now() - ${interval}::interval
    group by status
  `;
  const deliveryRows = await sql<{ status: string; n: number }[]>`
    select status, count(*)::int as n from public.conversation_deliveries
    where created_at >= now() - ${interval}::interval
    group by status
  `;
  const replyRows = await sql<{ n: number }[]>`
    select count(*)::int as n from public.conversation_deliveries
    where replied_at is not null and replied_at >= now() - ${interval}::interval
  `;
  const cohortFamilies = await sql<{ id: string; week: string }[]>`
    select f.id, date_trunc('week', f.created_at)::date::text as week
    from public.families f
    where f.created_at >= date_trunc('week', now()) - interval '35 days'
      and coalesce(f.status, 'open') <> 'deleted'
      and not f.sandbox
      and exists (select 1 from public.family_members m where m.family_id = f.id)
  `;
  const cohortActivity = await sql<{ family_id: string; week: string }[]>`
    select distinct family_id, date_trunc('week', created_at)::date::text as week
    from public.conversation_messages
    where role = 'user' and created_at >= date_trunc('week', now()) - interval '35 days'
  `;

  const countsBy = new Map(eventCounts.map((row) => [row.name, row.n]));
  const stages = FUNNEL_EVENTS.map((stage) => ({
    key: stage.key,
    name: stage.name,
    source: stage.event,
    count: countsBy.get(stage.event) ?? 0,
  }));

  const runBy = new Map(runRows.map((row) => [row.status, row.n]));
  const delBy = new Map(deliveryRows.map((row) => [row.status, row.n]));
  const runsTotal = runRows.reduce((sum, row) => sum + row.n, 0);
  const pipeline: PipelineNode[] = [
    { key: "ran", label: "Runs", source: "homa_task_runs", count: runsTotal, tone: "plain" },
    { key: "done", label: "Done", source: "status done", count: runBy.get("done") ?? 0, tone: "plain" },
    { key: "sent", label: "Deliveries sent", source: "conversation_deliveries", count: delBy.get("sent") ?? 0, tone: "plain" },
    { key: "failed", label: "Failed", source: "runs + deliveries", count: (runBy.get("failed") ?? 0) + (delBy.get("failed") ?? 0), tone: "fail" },
    {
      key: "uncertain",
      label: "Uncertain",
      source: "no receipt",
      count:
        (runBy.get("uncertain") ?? 0) +
        (runBy.get("partial_uncertain") ?? 0) +
        (delBy.get("uncertain") ?? 0),
      tone: "warn",
    },
    { key: "replied", label: "Replied", source: "replied_at", count: replyRows[0].n, tone: "plain" },
  ];

  const activityByFamily = new Map<string, Set<string>>();
  for (const row of cohortActivity) {
    const set = activityByFamily.get(row.family_id) ?? new Set<string>();
    set.add(row.week);
    activityByFamily.set(row.family_id, set);
  }
  const cohortsBy = new Map<string, string[]>();
  for (const family of cohortFamilies) {
    const list = cohortsBy.get(family.week) ?? [];
    list.push(family.id);
    cohortsBy.set(family.week, list);
  }
  const nowWeek = currentWeekStart();
  const cohorts: CohortRow[] = Array.from(cohortsBy.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([weekStart, ids]) => {
      const activeByWeek: (number | null)[] = [];
      for (let offset = 0; offset < 4; offset += 1) {
        const target = addWeeks(weekStart, offset);
        if (target > nowWeek) {
          activeByWeek.push(null);
          continue;
        }
        activeByWeek.push(ids.filter((id) => activityByFamily.get(id)?.has(target)).length);
      }
      return { weekStart, size: ids.length, activeByWeek };
    });

  return {
    windowDays,
    stages,
    stuck: {
      accountNoSetup: accountNoSetup.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        note: "account exists, family setup not finished",
      })),
      setupNoReport: setupNoReport.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        note: "setup and kids done, no report yet",
      })),
    },
    pipeline,
    cohorts,
  };
}

function addWeeks(isoDate: string, weeks: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

function currentWeekStart(): string {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7;
  now.setUTCDate(now.getUTCDate() - day);
  return now.toISOString().slice(0, 10);
}
