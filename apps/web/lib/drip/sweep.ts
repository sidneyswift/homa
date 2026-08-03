import { getMapSubject, MONTH_PLAN_SUBJECT } from "@homa/core";

import { LOOP_BACK_EVENTS } from "../activation/signals";
import { emailHash } from "../email/hash";
import { suppressedHashesForDrip } from "../email/suppression";
import { mapDb } from "../map/db";
import {
  siteUrl,
  submitDripKid2Pending,
  submitDripLoopBack,
  submitDripMidChecklist,
  submitDripReportUnviewed,
  submitDripRevealedNeverReturned,
  submitDripSetupNudge,
  type HomaEmailSubmission,
} from "../map/email";
import { mintLinkToken, mintNamedLinkToken } from "../map/store";

/**
 * The stage-aware onboarding drip (funnel work 2026-07-20,
 * docs/homa-planning/plans/2026-07-20-onboarding-funnel-drip.md, Phase 3).
 * Rides the existing hourly /api/map/cron like the other promise loops, and
 * stays DARK until dripEnabled() (lib/drip/flag.ts).
 *
 * The eligibility is a pure function (chooseDripNudge) so the rules are unit
 * tested; the SQL only gathers signals and applies the non-negotiable fences
 * (sandbox out, email required, a real member). Three audiences ship in the
 * sweep, each unambiguous:
 *   - setup nudge: signed up, no report yet (setup unfinished, or no kid).
 *   - report unviewed: a report was emailed and the family never opened any.
 *   - loop back: they said yes to a plan and never told Homa how it went.
 *     Aimed at the activation ladder's measured cliff (lib/activation
 *     /signals.ts), because those replies tune everything Homa makes next.
 * The add-a-kid nudge template exists (email.ts) for the founder preview but
 * is NOT in the automated audience: it must never guess a family has more
 * children than it does, so it waits on a durable more-kids signal.
 *
 * Caps (the not-pushy contract): at most one drip email per family per 7
 * days, each nudge kind at most once ever, any email.opt_out stops
 * everything, at most MAX_SENDS_PER_RUN sends per hourly tick so a backlog
 * trickles instead of bursting, and every rule is re-checked at send time.
 * A family sits in at most one audience, and each nudge uses a link that
 * cannot collide: the setup nudge mints a resume link, the report nudge uses
 * the durable per-report token.
 */

const GLOBAL_CAP_MS = 7 * 24 * 60 * 60 * 1000;
const SETUP_MIN_AGE_MS = 24 * 60 * 60 * 1000;
const REPORT_MIN_AGE_MS = 48 * 60 * 60 * 1000;
/** Two days after the parent explicitly asked for a plan. This creates a
 * useful rescue inside Homa's seven-day trial, while still leaving room for
 * a parent to try the first activity before Homa asks how it went. */
const LOOP_BACK_MIN_AGE_MS = 2 * 24 * 60 * 60 * 1000;
/** Matches the funnel plan's "2-6 days" beat-keyed drip window
 * (plans/2026-07-21-chat-first-onboarding.md §6.2): long enough that a
 * few taps left is still true, short enough the questions are still
 * fresh in mind. Shared by all three beat-keyed audiences below. */
const BEAT_KEYED_MIN_AGE_MS = 2 * 24 * 60 * 60 * 1000;
const SWEEP_LIMIT = 200;
/**
 * Ceiling on sends per hourly tick, so a backlog trickles out instead of
 * arriving as one burst. The first live batch was 21 eligible families from a
 * domain that had never sent proactive mail, and a burst from a young sender
 * is exactly what hurts deliverability. At five an hour that queue clears in
 * an afternoon. The cap is reported in the result, never silent: a run that
 * stops here must not read as a finished queue.
 */
const MAX_SENDS_PER_RUN = 5;

export interface DripSignals {
  familyId: string;
  email: string;
  firstName: string | null;
  createdAt: Date;
  profileCompletedAt: Date | null;
  hasKid: boolean;
  hasReport: boolean;
  /** Earliest emailed-but-unviewed report time, null when none applies. */
  reportEmailedAt: Date | null;
  /** Family-level: any report opened at all (the plan's "never viewed"
   * cohort is the families where this is false). */
  anyReportViewed: boolean;
  unviewedChildName: string | null;
  unviewedReportToken: string | null;
  /** The most recent plan the parent explicitly asked Homa to build, and
   * when. This comes from map.plan_consented, not child_plans: a stored plan
   * can be Homa's preparation, but consent is the parent's actual choice. */
  planChildName: string | null;
  planSubjectId: string | null;
  planCreatedAt: Date | null;
  /** The parent has told Homa how something went at least once. */
  closedLoop: boolean;
  /** The family turned proactive email off (journal_opt_out_at set, from an
   * inbound "stop"). Cleared by "start", so it reads current state. */
  optedOut: boolean;
  /** This address is on the suppression list for the drip (unsubscribe,
   * "stop", or a hard bounce/complaint). */
  suppressed: boolean;
  lastDripSentAt: Date | null;
  sentKinds: string[];
  /** Mid-checklist (plans/2026-07-21-chat-first-onboarding.md §9 Phase 2):
   * a child with at least one answer but no report yet, and how long since
   * her last answer. Null together means no such child exists, either
   * because nobody has started or every started child already has a
   * report. Picks the child with the most answers when more than one
   * qualifies, so the nudge names whoever is closest to done. */
  midChecklistChildName: string | null;
  midChecklistAnswerCount: number;
  midChecklistLastAnsweredAt: Date | null;
  /** Kid 2 pending: a second (or later) child on the roster with zero
   * answers, in a family where at least one other child already has a
   * report. Chat onboarding collects the whole roster up front (§6.1), so
   * this child is a real row, not a guess. */
  kid2PendingChildName: string | null;
  /** The most recent report this family has, regardless of email or view
   * state. drip_report_unviewed only sees emailed-and-unopened reports;
   * a chat reveal happens live in conversation and is never emailed, so
   * revealed-never-returned needs its own signal to see it at all. */
  latestReportChildName: string | null;
  latestReportCreatedAt: Date | null;
}

export type DripDecision =
  | { kind: "drip_setup_nudge" }
  | { kind: "drip_report_unviewed"; childName: string; reportToken: string }
  | { kind: "drip_loop_back"; childName: string; subjectId: string }
  | { kind: "drip_revealed_never_returned"; childName: string }
  | { kind: "drip_kid2_pending"; childName: string }
  | { kind: "drip_mid_checklist"; childName: string; answerCount: number }
  | null;

/**
 * The one nudge a family is eligible for right now, or null. Pure so the
 * cadence and priority rules are testable without a database. Priority:
 * a family that earned a report but never opened it gets that nudge first
 * (higher intent); otherwise a family that never reached a report gets the
 * setup nudge. Every guard here is also expressed in the sweep's re-check.
 */
export function chooseDripNudge(signals: DripSignals, now: Date): DripDecision {
  if (signals.optedOut || signals.suppressed) return null;
  if (
    signals.lastDripSentAt &&
    now.getTime() - signals.lastDripSentAt.getTime() < GLOBAL_CAP_MS
  ) {
    return null;
  }

  const reportEligible =
    signals.reportEmailedAt !== null &&
    !signals.anyReportViewed &&
    signals.unviewedReportToken !== null &&
    signals.unviewedChildName !== null &&
    !signals.sentKinds.includes("drip_report_unviewed") &&
    now.getTime() - signals.reportEmailedAt.getTime() >= REPORT_MIN_AGE_MS;
  if (reportEligible) {
    return {
      kind: "drip_report_unviewed",
      childName: signals.unviewedChildName as string,
      reportToken: signals.unviewedReportToken as string,
    };
  }

  // The loop-back nudge, aimed at the activation ladder's measured cliff:
  // a plan the parent explicitly asked for, and no word back about how it
  // went. It names that plan, so the consent event must prove it exists.
  const loopBackEligible =
    signals.planChildName !== null &&
    signals.planSubjectId !== null &&
    signals.planCreatedAt !== null &&
    !signals.closedLoop &&
    !signals.sentKinds.includes("drip_loop_back") &&
    now.getTime() - signals.planCreatedAt.getTime() >= LOOP_BACK_MIN_AGE_MS;
  if (loopBackEligible) {
    return {
      kind: "drip_loop_back",
      childName: signals.planChildName as string,
      subjectId: signals.planSubjectId as string,
    };
  }

  // Kid 2 pending: she is already engaged enough to have finished one
  // child's report, and a sibling roster entry has sat untouched. Checked
  // ahead of revealed-never-returned because it is the more actionable of
  // the two when both apply (a concrete next child to start, not just
  // "come back"). Gated on a real report existing so this never fires for
  // a family who has not reached value with ANY child yet (that is
  // mid-checklist's or setup's job below).
  const kid2PendingEligible =
    signals.kid2PendingChildName !== null &&
    signals.latestReportCreatedAt !== null &&
    !signals.sentKinds.includes("drip_kid2_pending") &&
    now.getTime() - signals.latestReportCreatedAt.getTime() >= BEAT_KEYED_MIN_AGE_MS;
  if (kid2PendingEligible) {
    return { kind: "drip_kid2_pending", childName: signals.kid2PendingChildName as string };
  }

  // Revealed, never returned: a report exists but no plan was ever made and
  // no word has come back, the same "she got value and went quiet" shape as
  // loop-back, generalized to families whose reveal happened live in chat
  // rather than by email (so drip_report_unviewed's emailed_at signal
  // cannot see them). Gated on planChildName === null so a family who DOES
  // have a plan is loop-back's job, never double-claimed here.
  const revealedNeverReturnedEligible =
    signals.latestReportChildName !== null &&
    signals.latestReportCreatedAt !== null &&
    signals.planChildName === null &&
    !signals.closedLoop &&
    !signals.sentKinds.includes("drip_revealed_never_returned") &&
    now.getTime() - signals.latestReportCreatedAt.getTime() >= BEAT_KEYED_MIN_AGE_MS;
  if (revealedNeverReturnedEligible) {
    return {
      kind: "drip_revealed_never_returned",
      childName: signals.latestReportChildName as string,
    };
  }

  // Mid-checklist: she started, no report for anyone yet. Further from
  // value than either beat-keyed audience above, so it ranks last among
  // the engaged-family nudges.
  const midChecklistEligible =
    signals.midChecklistChildName !== null &&
    signals.midChecklistLastAnsweredAt !== null &&
    !signals.sentKinds.includes("drip_mid_checklist") &&
    now.getTime() - signals.midChecklistLastAnsweredAt.getTime() >= BEAT_KEYED_MIN_AGE_MS;
  if (midChecklistEligible) {
    return {
      kind: "drip_mid_checklist",
      childName: signals.midChecklistChildName as string,
      answerCount: signals.midChecklistAnswerCount,
    };
  }

  const setupEligible =
    !signals.hasReport &&
    (signals.profileCompletedAt === null || !signals.hasKid) &&
    !signals.sentKinds.includes("drip_setup_nudge") &&
    now.getTime() - signals.createdAt.getTime() >= SETUP_MIN_AGE_MS;
  if (setupEligible) return { kind: "drip_setup_nudge" };

  return null;
}

export interface PlannedDripSend {
  family: DripSignals;
  decision: Exclude<DripDecision, null>;
}

export interface DripPlan {
  /** The sends this tick may make, already truncated to the cap. */
  sends: PlannedDripSend[];
  /** How many families were eligible before the cap. */
  eligible: number;
  /** True when the cap held sends back for a later tick. */
  capped: boolean;
}

/**
 * Which nudge goes first when the per-tick cap cannot serve everyone.
 *
 * Ordered by how close the family already is to value, and by how fast the
 * nudge goes stale. A family who finished the whole assessment and never
 * opened the report is one tap away and her report ages every day, so she
 * leads. The loop-back nudge asks about a plan that is already two days old,
 * so a few hours changes little. The setup nudge is for families who never
 * reached value at all, and an hour later is no worse for them.
 *
 * Without this the cap took whatever five rows Postgres happened to return,
 * which put the highest-intent group behind the lowest by luck of row order
 * (seen live 2026-07-21: nine report-unviewed families waited while setup
 * nudges went out first).
 */
const KIND_PRIORITY: Record<Exclude<DripDecision, null>["kind"], number> = {
  drip_report_unviewed: 0,
  drip_loop_back: 1,
  drip_kid2_pending: 2,
  drip_revealed_never_returned: 3,
  drip_mid_checklist: 4,
  drip_setup_nudge: 5,
};

/** The moment that made this family eligible, so the oldest wait goes first
 * inside a nudge. Keeps the queue FIFO within a priority band: nobody sits at
 * the back forever because newer families keep arriving. */
function triggerAt(send: PlannedDripSend): number {
  const { family, decision } = send;
  if (decision.kind === "drip_report_unviewed") {
    return family.reportEmailedAt?.getTime() ?? family.createdAt.getTime();
  }
  if (decision.kind === "drip_loop_back") {
    return family.planCreatedAt?.getTime() ?? family.createdAt.getTime();
  }
  if (
    decision.kind === "drip_revealed_never_returned" ||
    decision.kind === "drip_kid2_pending"
  ) {
    return family.latestReportCreatedAt?.getTime() ?? family.createdAt.getTime();
  }
  if (decision.kind === "drip_mid_checklist") {
    return family.midChecklistLastAnsweredAt?.getTime() ?? family.createdAt.getTime();
  }
  return family.createdAt.getTime();
}

/**
 * Which families this tick sends to, in one pure pass, so the cadence and
 * priority rules are unit tested alongside the eligibility rules. Eligibility
 * is decided for every family first, then the queue is ordered, then the cap
 * truncates: that way `eligible` reports the true size of the queue rather
 * than just what fit, and the cap always takes the families that most deserve
 * this tick rather than an arbitrary five.
 */
export function planDripSends(
  signals: DripSignals[],
  now: Date,
  limit: number = MAX_SENDS_PER_RUN,
): DripPlan {
  const eligible: PlannedDripSend[] = [];
  for (const family of signals) {
    const decision = chooseDripNudge(family, now);
    if (decision) eligible.push({ family, decision });
  }

  // Highest intent first, then longest wait, then family id purely so the
  // order is total and reproducible: two runs over the same data must plan
  // the same sends, or the queue on /admin/drip stops predicting reality.
  eligible.sort((left, right) => {
    const byKind = KIND_PRIORITY[left.decision.kind] - KIND_PRIORITY[right.decision.kind];
    if (byKind !== 0) return byKind;
    const byWait = triggerAt(left) - triggerAt(right);
    if (byWait !== 0) return byWait;
    return left.family.familyId.localeCompare(right.family.familyId);
  });

  return {
    sends: eligible.slice(0, limit),
    eligible: eligible.length,
    capped: eligible.length > limit,
  };
}

/** Whole days between two moments, floored, for the reason strings. */
function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

/**
 * Why this family is getting this email, in the founder's words, recorded to
 * email_sends.meta at send time. Written at SEND time on purpose: the
 * audience that picked her will have changed by the time anyone asks, so
 * re-deriving it later would answer a different question.
 */
export function dripReason(
  family: DripSignals,
  decision: Exclude<DripDecision, null>,
  now: Date,
): string {
  if (decision.kind === "drip_report_unviewed") {
    const days = family.reportEmailedAt ? daysBetween(family.reportEmailedAt, now) : 0;
    return `${decision.childName}'s report was emailed ${days}d ago and no report has been opened yet`;
  }
  if (decision.kind === "drip_loop_back") {
    const days = family.planCreatedAt ? daysBetween(family.planCreatedAt, now) : 0;
    return `said yes to ${decision.childName}'s ${decision.subjectId} plan ${days}d ago, no word back since`;
  }
  if (decision.kind === "drip_revealed_never_returned") {
    const days = family.latestReportCreatedAt
      ? daysBetween(family.latestReportCreatedAt, now)
      : 0;
    return `${decision.childName}'s report has existed ${days}d, no plan and no return visit`;
  }
  if (decision.kind === "drip_kid2_pending") {
    return `${decision.childName}'s questions have never been started, a sibling's report is already done`;
  }
  if (decision.kind === "drip_mid_checklist") {
    const days = family.midChecklistLastAnsweredAt
      ? daysBetween(family.midChecklistLastAnsweredAt, now)
      : 0;
    return `${decision.childName} has ${decision.answerCount} answer${decision.answerCount === 1 ? "" : "s"} in, no report yet, last answered ${days}d ago`;
  }
  const days = daysBetween(family.createdAt, now);
  const stalled = family.profileCompletedAt === null ? "setup never finished" : "no child added";
  return `signed up ${days}d ago, ${stalled}, no report yet`;
}

export interface DripSweepResult {
  skipped: boolean;
  considered: number;
  setupSent: number;
  reportSent: number;
  loopBackSent: number;
  revealedNeverReturnedSent: number;
  kid2PendingSent: number;
  midChecklistSent: number;
  /** Families eligible this tick, before the per-run cap. */
  eligible: number;
  /** True when the cap deferred sends to a later tick. */
  capped: boolean;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" && value) return new Date(value);
  return null;
}

/** All non-sandbox, non-deleted families with a member and an email, plus
 * the signals chooseDripNudge needs. Small fleet, so signals for every
 * family are cheap; the pure chooser then filters to an audience. */
async function loadDripSignals(): Promise<DripSignals[]> {
  const sql = mapDb();
  const rows = await sql<
    {
      id: string;
      email: string;
      first_name: string | null;
      created_at: string;
      profile_completed_at: string | null;
      has_kid: boolean;
      has_report: boolean;
      any_report_viewed: boolean;
      report_emailed_at: string | null;
      unviewed_child_name: string | null;
      unviewed_token: string | null;
      plan_child_name: string | null;
      plan_subject_id: string | null;
      plan_created_at: string | null;
      closed_loop: boolean;
      opted_out: boolean;
      last_drip_sent_at: string | null;
      sent_kinds: string[];
      mid_checklist_child_name: string | null;
      mid_checklist_answer_count: number | null;
      mid_checklist_last_answered_at: string | null;
      kid2_pending_child_name: string | null;
      latest_report_child_name: string | null;
      latest_report_created_at: string | null;
    }[]
  >`
    select
      f.id,
      f.email,
      f.first_name,
      f.created_at,
      f.profile_completed_at,
      exists(select 1 from public.children c where c.family_id = f.id) as has_kid,
      exists(
        select 1 from public.children c
        join public.child_reports r on r.child_id = c.id
        where c.family_id = f.id
      ) as has_report,
      exists(
        select 1 from public.children c
        join public.child_reports r on r.child_id = c.id
        where c.family_id = f.id and r.viewed_at is not null
      ) as any_report_viewed,
      (
        select min(r.emailed_at) from public.children c
        join public.child_reports r on r.child_id = c.id
        where c.family_id = f.id and r.emailed_at is not null and r.viewed_at is null
      ) as report_emailed_at,
      (
        select c.name from public.children c
        join public.child_reports r on r.child_id = c.id
        where c.family_id = f.id and r.emailed_at is not null and r.viewed_at is null
        order by r.emailed_at limit 1
      ) as unviewed_child_name,
      (
        select r.token from public.children c
        join public.child_reports r on r.child_id = c.id
        where c.family_id = f.id and r.emailed_at is not null and r.viewed_at is null
        order by r.emailed_at limit 1
      ) as unviewed_token,
      consented_plan.child_name as plan_child_name,
      consented_plan.subject_id as plan_subject_id,
      consented_plan.created_at as plan_created_at,
      exists (
        select 1 from public.events e
        where e.family_id = f.id and e.name = any(${LOOP_BACK_EVENTS as unknown as string[]})
      ) as closed_loop,
      f.journal_opt_out_at is not null as opted_out,
      (
        select max(es.created_at) from public.email_sends es
        where es.family_id = f.id and es.kind like 'drip_%'
      ) as last_drip_sent_at,
      coalesce(
        (
          select array_agg(distinct es.kind) from public.email_sends es
          where es.family_id = f.id and es.kind like 'drip_%'
            and es.status in ('submitted', 'delivered')
        ),
        '{}'
      ) as sent_kinds,
      mid_checklist.child_name as mid_checklist_child_name,
      mid_checklist.answer_count as mid_checklist_answer_count,
      mid_checklist.last_answered_at as mid_checklist_last_answered_at,
      (
        select c.name from public.children c
        where c.family_id = f.id
          and not exists (select 1 from public.child_answers a where a.child_id = c.id)
          and exists (
            select 1 from public.children c2
            join public.child_reports r2 on r2.child_id = c2.id
            where c2.family_id = f.id
          )
        order by c.created_at
        limit 1
      ) as kid2_pending_child_name,
      (
        select c.name from public.children c
        join public.child_reports r on r.child_id = c.id
        where c.family_id = f.id
        order by r.generated_at desc limit 1
      ) as latest_report_child_name,
      (
        select r.generated_at from public.children c
        join public.child_reports r on r.child_id = c.id
        where c.family_id = f.id
        order by r.generated_at desc limit 1
      ) as latest_report_created_at
    from public.families f
    left join lateral (
      -- The child closest to done: some answers in, no report yet. One
      -- lateral subquery computing name/count/last-answered together, so
      -- the "which child" pick is derived once, never re-derived per
      -- column (a tripled subquery is exactly how these three columns
      -- silently disagree about which child they mean).
      select c.name as child_name, count(a.*) as answer_count,
        max(a.answered_at) as last_answered_at
      from public.children c
      join public.child_answers a on a.child_id = c.id
      left join public.child_reports r on r.child_id = c.id
      where c.family_id = f.id and r.child_id is null
      group by c.id, c.name
      order by count(a.*) desc
      limit 1
    ) mid_checklist on true
    left join lateral (
      -- A plan row alone can be Homa's preparation. The consent event is
      -- the parent action that makes the loop-back email's wording true.
      select c.name as child_name,
        e.props->>'subject' as subject_id,
        e.created_at
      from public.events e
      join public.children c on c.id::text = e.props->>'child_id'
      where e.family_id = f.id
        and c.family_id = f.id
        and e.name = 'map.plan_consented'
      order by e.created_at desc
      limit 1
    ) consented_plan on true
    where coalesce(f.status, 'open') <> 'deleted'
      and not coalesce(f.sandbox, false)
      and f.email is not null
      and exists (select 1 from public.family_members m where m.family_id = f.id)
    -- Deterministic scan. The intent ordering that decides who this tick
    -- serves happens in planDripSends, because it depends on WHICH nudge each
    -- family gets and that is decided in TypeScript; expressing it here would
    -- mean a second copy of the eligibility rules, free to drift from the
    -- first. This only guarantees the same rows in the same order every run,
    -- so a capped scan is reproducible instead of arbitrary.
    order by f.created_at, f.id
    limit ${SWEEP_LIMIT}
  `;

  const signals: DripSignals[] = rows.map((row) => ({
    familyId: row.id,
    email: row.email,
    firstName: row.first_name,
    createdAt: new Date(row.created_at),
    profileCompletedAt: toDate(row.profile_completed_at),
    hasKid: row.has_kid,
    hasReport: row.has_report,
    reportEmailedAt: toDate(row.report_emailed_at),
    anyReportViewed: row.any_report_viewed,
    unviewedChildName: row.unviewed_child_name,
    unviewedReportToken: row.unviewed_token,
    planChildName: row.plan_child_name,
    planSubjectId: row.plan_subject_id,
    planCreatedAt: toDate(row.plan_created_at),
    closedLoop: row.closed_loop,
    optedOut: row.opted_out,
    suppressed: false,
    lastDripSentAt: toDate(row.last_drip_sent_at),
    sentKinds: Array.isArray(row.sent_kinds) ? row.sent_kinds : [],
    midChecklistChildName: row.mid_checklist_child_name,
    midChecklistAnswerCount: row.mid_checklist_answer_count ?? 0,
    midChecklistLastAnsweredAt: toDate(row.mid_checklist_last_answered_at),
    kid2PendingChildName: row.kid2_pending_child_name,
    latestReportChildName: row.latest_report_child_name,
    latestReportCreatedAt: toDate(row.latest_report_created_at),
  }));

  // One batch suppression lookup for the whole candidate set, keyed by the
  // address hash the ledger already uses.
  const suppressed = await suppressedHashesForDrip(
    signals.map((signal) => emailHash(signal.email)),
  );
  for (const signal of signals) {
    signal.suppressed = suppressed.has(emailHash(signal.email));
  }
  return signals;
}

/** Final defensive guard against a double send: even though the audience
 * query already excludes sent kinds, re-check right before the send so a
 * concurrent run (rare with the single hourly trigger) cannot duplicate. */
async function dripAlreadySent(familyId: string, kind: string): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ one: number }[]>`
    select 1 as one from public.email_sends
    where family_id = ${familyId} and kind = ${kind}
      and status in ('submitted', 'delivered')
    limit 1
  `;
  return rows.length > 0;
}

/**
 * One drip pass. Called from /api/map/cron only when dripEnabled(). Sends at
 * most one nudge per eligible family, records through the email ledger (each
 * submit writes email_sends), and returns counts for the cron heartbeat.
 */
export async function runDripSweep(now: Date = new Date()): Promise<DripSweepResult> {
  const signals = await loadDripSignals();
  const plan = planDripSends(signals, now);
  let setupSent = 0;
  let reportSent = 0;
  let loopBackSent = 0;
  let revealedNeverReturnedSent = 0;
  let kid2PendingSent = 0;
  let midChecklistSent = 0;

  for (const { family, decision } of plan.sends) {
    if (await dripAlreadySent(family.familyId, decision.kind)) continue;

    let submission: HomaEmailSubmission = { status: "unknown" };
    if (decision.kind === "drip_setup_nudge") {
      const token = await mintLinkToken(family.familyId);
      submission = await submitDripSetupNudge(
        family.email,
        family.firstName,
        `${siteUrl()}/api/map/resume-link?t=${token}`,
        family.familyId,
        dripReason(family, decision, now),
      );
      if (submission.status === "submitted") setupSent += 1;
    } else if (decision.kind === "drip_report_unviewed") {
      submission = await submitDripReportUnviewed(
        family.email,
        family.firstName,
        decision.childName,
        `${siteUrl()}/onboarding/r/${decision.reportToken}`,
        family.familyId,
        dripReason(family, decision, now),
      );
      if (submission.status === "submitted") reportSent += 1;
    } else if (decision.kind === "drip_loop_back") {
      // Most plans in production are the whole-month plan, which has no
      // single subject and is NOT in the subject bank: resolving it through
      // getMapSubject alone would silently skip the majority of this
      // audience. Same split the retest email makes in /api/map/cron.
      const isMonth = decision.subjectId === MONTH_PLAN_SUBJECT;
      const subjectName = isMonth
        ? null
        : getMapSubject(decision.subjectId)?.displayName;
      // An unknown subject id must never reach a parent as a raw slug.
      if (!isMonth && !subjectName) continue;
      const planLabel = isMonth
        ? "this month's plan"
        : `the ${(subjectName as string).toLowerCase()} plan`;
      submission = await submitDripLoopBack(
        family.email,
        decision.childName,
        planLabel,
        family.familyId,
        dripReason(family, decision, now),
      );
      if (submission.status === "submitted") loopBackSent += 1;
    } else if (decision.kind === "drip_revealed_never_returned") {
      const token = await mintNamedLinkToken(family.familyId, decision.kind);
      submission = await submitDripRevealedNeverReturned(
        family.email,
        family.firstName,
        decision.childName,
        `${siteUrl()}/api/map/resume-link?t=${token}`,
        family.familyId,
        dripReason(family, decision, now),
      );
      if (submission.status === "submitted") revealedNeverReturnedSent += 1;
    } else if (decision.kind === "drip_kid2_pending") {
      const token = await mintNamedLinkToken(family.familyId, decision.kind);
      submission = await submitDripKid2Pending(
        family.email,
        family.firstName,
        decision.childName,
        `${siteUrl()}/api/map/resume-link?t=${token}`,
        family.familyId,
        dripReason(family, decision, now),
      );
      if (submission.status === "submitted") kid2PendingSent += 1;
    } else {
      const token = await mintNamedLinkToken(family.familyId, decision.kind);
      submission = await submitDripMidChecklist(
        family.email,
        family.firstName,
        decision.childName,
        decision.answerCount,
        `${siteUrl()}/api/map/resume-link?t=${token}`,
        family.familyId,
        dripReason(family, decision, now),
      );
      if (submission.status === "submitted") midChecklistSent += 1;
    }
  }

  return {
    skipped: false,
    considered: signals.length,
    setupSent,
    reportSent,
    loopBackSent,
    revealedNeverReturnedSent,
    kid2PendingSent,
    midChecklistSent,
    eligible: plan.eligible,
    capped: plan.capped,
  };
}

export interface DripQueueEntry {
  familyId: string;
  familyFirstName: string | null;
  kind: Exclude<DripDecision, null>["kind"];
  reason: string;
  /** True when this one is inside the current tick's cap. */
  nextTick: boolean;
}

export interface DripQueueSnapshot {
  eligible: number;
  capped: boolean;
  considered: number;
  entries: DripQueueEntry[];
}

/**
 * Who the drip would email next, without sending anything. The founder
 * console reads this so the queue on screen is produced by the same planner
 * that does the sending: a preview derived from a second implementation
 * would eventually disagree with the real one, which is worse than no
 * preview at all.
 */
export async function dripQueueSnapshot(
  now: Date = new Date(),
  limit = 25,
): Promise<DripQueueSnapshot> {
  const signals = await loadDripSignals();
  const plan = planDripSends(signals, now, Number.MAX_SAFE_INTEGER);
  const nextTick = new Set(
    planDripSends(signals, now).sends.map((send) => send.family.familyId),
  );
  return {
    eligible: plan.eligible,
    capped: plan.eligible > nextTick.size,
    considered: signals.length,
    entries: plan.sends.slice(0, limit).map((send) => ({
      familyId: send.family.familyId,
      familyFirstName: send.family.firstName,
      kind: send.decision.kind,
      reason: dripReason(send.family, send.decision, now),
      nextTick: nextTick.has(send.family.familyId),
    })),
  };
}
