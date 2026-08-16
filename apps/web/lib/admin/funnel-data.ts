import { MAP_FLOW_STEPS, type MapFlowStep } from "@homa/core";

import {
  LOOP_BACK_EVENTS,
  PARENT_INITIATED_EVENTS,
} from "../activation/signals";
import { adminDb } from "./db";
import { classifySignupAttribution } from "./signup-attribution";

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

export interface StepStage {
  step: MapFlowStep;
  label: string;
  count: number;
}

export interface ActivationStage {
  key: string;
  name: string;
  blurb: string;
  source: string;
  count: number;
}

export interface ActivationLadder {
  /** Every live family that has a report: the cohort all rungs are measured
   * over, and the ladder's denominator. Current state, not window-scoped. */
  base: number;
  stages: ActivationStage[];
  /** Stage 5. Families old enough to HAVE a second week, and how many came
   * back in it. Reported as a pair so "0 returned" is never confused with
   * "0 could have". */
  weekTwo: { eligible: number; returned: number };
}

export interface CommercialState {
  families: number;
  trialStarted: number;
  stripeCustomers: number;
  subscriptions: number;
  billingExempt: number;
  trialEvents: number;
  /** False when billing has never run in production at all, which reads very
   * differently from a real 0% conversion. */
  everRan: boolean;
}

/** A windowed audit of Auth accounts. It deliberately does not call each
 * account a signup until it is linked to a new, non-sandbox family. */
export interface SignupAttributionAudit {
  authAccounts: number;
  newFamilies: number;
  existingFamilyLinks: number;
  sandboxFamilies: number;
  /** Auth accounts attached only to a deleted family. Excluded from conversion. */
  deletedFamilyAccounts: number;
  /** Reserved non-deliverable fixture accounts. Excluded from conversion. */
  internalFixtureAccounts: number;
  unlinkedAccounts: number;
  signupGateViewed: number;
  checkoutStarted: number;
  trialStarted: number;
}

export interface FunnelData {
  windowDays: number;
  stages: FunnelStage[];
  stepFunnel: StepStage[];
  activation: ActivationLadder;
  commercial: CommercialState;
  signupAudit: SignupAttributionAudit;
  stuck: { accountNoSetup: StuckFamily[]; setupNoReport: StuckFamily[] };
  pipeline: PipelineNode[];
  cohorts: CohortRow[];
}

/**
 * The activation handoff: the visible report, then the parent-directed path
 * from opening it through one changed plan and one closed learning loop.
 *
 * Only report_rendered represents Homa's delivery of the handoff. Every
 * later rung is parent-directed. In the 2026-07-20 read, 32 families had a
 * research brief sent and 31 got a thank-you card while only 8 ever wrote
 * back, so machine work cannot count as activation. progress.evidence
 * recorded is excluded for the same reason: the scoring pipeline emits it
 * during assessment, so it does not prove a parent logged anything.
 *
 * Counted over ONE cohort (every live family that has a report) rather than
 * as windowed event counts, so each rung is the same set of families and the
 * percentages mean what they look like. It is not strictly nested on
 * purpose: a family can talk to Homa without ever opening the report, and
 * hiding that would be a lie about how families actually behave.
 *
 * Sources are chosen for reliability, not tidiness. "Opened the report"
 * reads child_reports.viewed_at (a durable column) rather than the
 * map.report_viewed event. The remaining stages are exact effect events,
 * rather than messages that merely imply an intention.
 */
const ACTIVATION_STAGES: {
  key: string;
  name: string;
  blurb: string;
  source: string;
}[] = [
  {
    key: "rendered",
    name: "Report shown",
    blurb: "Homa put the scored report in the conversation.",
    source: "map.report_rendered",
  },
  {
    key: "opened",
    name: "Opened the report",
    blurb: "They actually looked at it.",
    source: "child_reports.viewed_at",
  },
  {
    key: "planner",
    name: "Opened the Planner",
    blurb:
      "The current week is visible, grounded in the family's actual plan.",
    source: "planner.viewed",
  },
  {
    key: "adjusted",
    name: "Changed the plan",
    blurb:
      "A parent-directed edit, scheduling change, or approved month replaced the default.",
    source: "map.plan_edited · planner.activity_scheduled · planner.month_approved",
  },
  {
    key: "looped",
    name: "Told Homa how it went",
    blurb:
      "An observation, a correction, hours logged, or plan progress. This is the loop that makes Homa smarter.",
    source:
      "progress.observation_saved · map.answers_corrected · chat.hours_logged · map.plan_progress",
  },
  {
    key: "complete",
    name: "Completed the activation handoff",
    blurb: "The report, real week, one adjustment, and one learning loop all happened.",
    source: "event-derived activation state",
  },
];

/** Friendly names for the onboarding cards, in MAP_FLOW_STEPS order. The
 * per-card funnel reads these so drop-off between two adjacent cards is
 * visible for the first time (funnel work 2026-07-20). */
const STEP_LABELS: Record<MapFlowStep, string> = {
  parent: "Account (email/password)",
  paywall: "Trial gate (card ask)",
  chat: "The conversation (chat-first)",
  family: "Create your family",
  homeschool: "About your homeschool",
  kids: "Add your kids",
  preparing: "Preparing the questionnaire",
  checklist: "The questionnaire",
  extras: "Extras",
  "next-kid": "Next-kid choice",
  scoring: "Scoring",
  deepdive: "Deep dive",
  hub: "Hub",
};

const FUNNEL_EVENTS: { key: string; name: string; event: string }[] = [
  // map.started often fires when the signup screen opens (session bootstrap),
  // not when a parent finishes Google/email signup. Prefer "Signed up" below.
  { key: "started", name: "Signup screen opened", event: "map.started" },
  { key: "account", name: "Signed up", event: "map.account_created" },
  { key: "setup", name: "Setup done", event: "map.family_setup" },
  { key: "kids", name: "Kids added", event: "map.child_added" },
  { key: "report", name: "Report generated", event: "map.report_generated" },
  // "Trial started" deliberately does NOT live here (founder decision
  // 2026-07-20). The aha is the activation ladder below; billing is a
  // separate commercial funnel, so a structural 0 there can never make a
  // healthy activation funnel look broken.
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
      and exists (
        select 1 from public.families f
        where f.id = e.family_id
          and not coalesce(f.sandbox, false)
          and coalesce(f.status, 'open') <> 'deleted'
      )
    group by e.name
  `;
  // Per-card onboarding funnel from map.step_viewed (funnel work
  // 2026-07-20): one row per family per card reached, so this reads the
  // real per-card drop-off. Same sandbox fence as the event funnel above.
  const stepCounts = await sql<{ step: string; n: number }[]>`
    select e.props->>'step' as step, count(distinct e.family_id)::int as n
    from public.events e
    where e.name = 'map.step_viewed'
      and e.created_at >= now() - ${interval}::interval
      and exists (
        select 1 from public.families f
        where f.id = e.family_id
          and not coalesce(f.sandbox, false)
          and coalesce(f.status, 'open') <> 'deleted'
      )
    group by e.props->>'step'
  `;
  // The activation ladder plus the week-two return, over one cohort: every
  // live family that has a report. Current state, not window-scoped, so each
  // rung is the same set of families.
  const activationRows = await sql<
    {
      base: number;
      rendered: number;
      opened: number;
      planner: number;
      adjusted: number;
      looped: number;
      complete: number;
      w2_eligible: number;
      w2_returned: number;
    }[]
  >`
    with cohort as (
      select f.id, f.created_at
      from public.families f
      where not coalesce(f.sandbox, false)
        and coalesce(f.status, 'open') <> 'deleted'
        and exists (
          select 1 from public.children c
          join public.child_reports r on r.child_id = c.id
          where c.family_id = f.id
        )
    ),
    flags as (
      select c.id,
        exists (
          select 1 from public.events e
          where e.family_id = c.id and e.name = 'map.report_rendered'
        ) as rendered,
        exists (
          select 1 from public.children ch
          join public.child_reports r on r.child_id = ch.id
          where ch.family_id = c.id and r.viewed_at is not null
        ) as opened,
        exists (
          select 1 from public.events e
          where e.family_id = c.id
            and e.name = 'planner.viewed'
        ) as planner,
        exists (
          select 1 from public.events e
          where e.family_id = c.id
            and e.name in (
              'map.plan_edited', 'planner.activity_scheduled',
              'planner.week_repaired', 'planner.month_approved'
            )
        ) as adjusted,
        exists (
          select 1 from public.events e
          where e.family_id = c.id
            and e.name = any(string_to_array(${LOOP_BACK_EVENTS.join(",")}, ','))
        ) as looped,
        (c.created_at < now() - interval '7 days') as w2_eligible,
        (
          exists (
            select 1 from public.conversation_messages m
            where m.family_id = c.id and m.role = 'user'
              and m.created_at > c.created_at + interval '7 days'
          )
          or exists (
            select 1 from public.events e
            where e.family_id = c.id
              and e.created_at > c.created_at + interval '7 days'
              and e.name = any(string_to_array(${PARENT_INITIATED_EVENTS.join(",")}, ','))
          )
        ) as w2_returned
      from cohort c
    )
    select
      count(*)::int as base,
      (count(*) filter (where rendered))::int as rendered,
      (count(*) filter (where opened))::int as opened,
      (count(*) filter (where planner))::int as planner,
      (count(*) filter (where adjusted))::int as adjusted,
      (count(*) filter (where looped))::int as looped,
      (count(*) filter (where rendered and opened and planner and adjusted and looped))::int as complete,
      (count(*) filter (where w2_eligible))::int as w2_eligible,
      (count(*) filter (where w2_eligible and w2_returned))::int as w2_returned
    from flags
  `;
  // The commercial funnel, kept apart from activation on purpose.
  const billing = await sql<
    {
      families: number;
      trial_started: number;
      stripe_customers: number;
      subscriptions: number;
      billing_exempt: number;
    }[]
  >`
    select
      count(*)::int as families,
      (count(*) filter (where f.trial_started_at is not null))::int as trial_started,
      (count(*) filter (where f.stripe_customer_id is not null))::int as stripe_customers,
      (count(*) filter (where f.stripe_subscription_id is not null))::int as subscriptions,
      (count(*) filter (where f.billing_exempt))::int as billing_exempt
    from public.families f
    where coalesce(f.status, 'open') <> 'deleted' and not f.sandbox
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

  const activationRow = activationRows[0];
  const activationByKey: Record<string, number> = {
    rendered: activationRow.rendered,
    opened: activationRow.opened,
    planner: activationRow.planner,
    adjusted: activationRow.adjusted,
    looped: activationRow.looped,
    complete: activationRow.complete,
  };
  const activation: ActivationLadder = {
    base: activationRow.base,
    stages: ACTIVATION_STAGES.map((stage) => ({
      key: stage.key,
      name: stage.name,
      blurb: stage.blurb,
      source: stage.source,
      count: activationByKey[stage.key] ?? 0,
    })),
    weekTwo: {
      eligible: activationRow.w2_eligible,
      returned: activationRow.w2_returned,
    },
  };

  const billingRow = billing[0];
  const trialEvents = countsBy.get("billing.trial_started") ?? 0;
  const commercial: CommercialState = {
    families: billingRow.families,
    trialStarted: billingRow.trial_started,
    stripeCustomers: billingRow.stripe_customers,
    subscriptions: billingRow.subscriptions,
    billingExempt: billingRow.billing_exempt,
    trialEvents,
    everRan:
      billingRow.trial_started > 0 ||
      billingRow.stripe_customers > 0 ||
      billingRow.subscriptions > 0 ||
      trialEvents > 0,
  };

  // Auth users are not a conversion denominator on their own. A user can
  // belong to a sandbox rehearsal, link to an old family, or leave before
  // attachAuthUser connects the account to anything. Read one membership per
  // account, then classify it in deterministic code so the founder can see
  // those paths instead of mistaking them for paywall abandonment.
  const signupAuditRows = await sql<
    {
      user_created_at: string;
      family_created_at: string | null;
      sandbox: boolean | null;
      deleted_family_only: boolean;
      internal_fixture: boolean;
      signup_gate_viewed: boolean;
      checkout_started: boolean;
      trial_started: boolean;
    }[]
  >`
    select
      u.created_at::text as user_created_at,
      linked.family_created_at,
      linked.sandbox,
      deleted_history.deleted_family_only,
      (
        lower(coalesce(u.email, '')) like '%@example.com'
        or lower(coalesce(u.email, '')) like '%@example.invalid'
      ) as internal_fixture,
      coalesce(linked.signup_gate_viewed, false) as signup_gate_viewed,
      coalesce(linked.checkout_started, false) as checkout_started,
      coalesce(linked.trial_started, false) as trial_started
    from auth.users u
    left join lateral (
      select
        f.created_at::text as family_created_at,
        coalesce(f.sandbox, false) as sandbox,
        exists (
          select 1 from public.events e
          where e.family_id = f.id
            and e.name = 'wall.viewed'
            and e.props->>'door' = 'signup'
            and e.created_at >= u.created_at
        ) as signup_gate_viewed,
        exists (
          select 1 from public.events e
          where e.family_id = f.id
            and e.name = 'wall.checkout_started'
            and e.created_at >= u.created_at
        ) as checkout_started,
        (f.trial_started_at is not null) as trial_started
      from public.family_members fm
      join public.families f on f.id = fm.family_id
      where fm.user_id = u.id
        and coalesce(f.status, 'open') <> 'deleted'
      order by fm.created_at asc
      limit 1
    ) linked on true
    cross join lateral (
      select exists (
        select 1
        from public.family_members fm
        join public.families f on f.id = fm.family_id
        where fm.user_id = u.id
          and coalesce(f.status, 'open') = 'deleted'
      ) as deleted_family_only
    ) deleted_history
    where u.created_at >= now() - ${interval}::interval
      and u.deleted_at is null
  `;
  const signupAudit: SignupAttributionAudit = {
    authAccounts: signupAuditRows.length,
    newFamilies: 0,
    existingFamilyLinks: 0,
    sandboxFamilies: 0,
    deletedFamilyAccounts: 0,
    internalFixtureAccounts: 0,
    unlinkedAccounts: 0,
    signupGateViewed: 0,
    checkoutStarted: 0,
    trialStarted: 0,
  };
  for (const row of signupAuditRows) {
    const attribution = classifySignupAttribution({
      userCreatedAt: row.user_created_at,
      familyCreatedAt: row.family_created_at,
      sandbox: row.sandbox === true,
      deletedFamilyOnly: row.deleted_family_only,
      internalFixture: row.internal_fixture,
    });
    switch (attribution) {
      case "new_family":
        signupAudit.newFamilies += 1;
        if (row.signup_gate_viewed) signupAudit.signupGateViewed += 1;
        if (row.checkout_started) signupAudit.checkoutStarted += 1;
        if (row.trial_started) signupAudit.trialStarted += 1;
        break;
      case "existing_family":
        signupAudit.existingFamilyLinks += 1;
        break;
      case "sandbox_family":
        signupAudit.sandboxFamilies += 1;
        break;
      case "deleted_family":
        signupAudit.deletedFamilyAccounts += 1;
        break;
      case "internal_fixture":
        signupAudit.internalFixtureAccounts += 1;
        break;
      case "unlinked_account":
        signupAudit.unlinkedAccounts += 1;
        break;
      default: {
        const exhaustive: never = attribution;
        throw new Error(`Unhandled signup attribution: ${exhaustive}`);
      }
    }
  }

  const stepCountsBy = new Map(stepCounts.map((row) => [row.step, row.n]));
  const stepFunnel: StepStage[] = MAP_FLOW_STEPS.map((step) => ({
    step,
    label: STEP_LABELS[step],
    count: stepCountsBy.get(step) ?? 0,
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
    stepFunnel,
    activation,
    commercial,
    signupAudit,
    stuck: {
      accountNoSetup: accountNoSetup.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        note: "signed up; setup not finished",
      })),
      setupNoReport: setupNoReport.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        note: "setup done and kids exist; no report yet",
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
