import { emailHash } from "../email/hash";
import { suppressedHashesForDrip } from "../email/suppression";
import { mapDb } from "../map/db";
import {
  siteUrl,
  submitDripReportUnviewed,
  submitDripSetupNudge,
  type HomaEmailSubmission,
} from "../map/email";
import { mintLinkToken } from "../map/store";

/**
 * The stage-aware onboarding drip (funnel work 2026-07-20,
 * docs/homa-planning/plans/2026-07-20-onboarding-funnel-drip.md, Phase 3).
 * Rides the existing hourly /api/map/cron like the other promise loops, and
 * stays DARK until dripEnabled() (lib/drip/flag.ts).
 *
 * The eligibility is a pure function (chooseDripNudge) so the rules are unit
 * tested; the SQL only gathers signals and applies the non-negotiable fences
 * (sandbox out, email required, a real member). Two audiences ship in the
 * sweep, both unambiguous and mutually exclusive:
 *   - setup nudge: signed up, no report yet (setup unfinished, or no kid).
 *   - report unviewed: a report was emailed and the family never opened any.
 * The add-a-kid nudge template exists (email.ts) for the founder preview but
 * is NOT in the automated audience: it must never guess a family has more
 * children than it does, so it waits on a durable more-kids signal.
 *
 * Caps (the not-pushy contract): at most one drip email per family per 7
 * days, each nudge kind at most once ever, any email.opt_out stops
 * everything, and every rule is re-checked at send time. A family sits in at
 * most one audience, and each nudge uses a link that cannot collide: the
 * setup nudge mints a resume link, the report nudge uses the durable
 * per-report token.
 */

const GLOBAL_CAP_MS = 7 * 24 * 60 * 60 * 1000;
const SETUP_MIN_AGE_MS = 24 * 60 * 60 * 1000;
const REPORT_MIN_AGE_MS = 48 * 60 * 60 * 1000;
const SWEEP_LIMIT = 200;

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
  /** The family turned proactive email off (journal_opt_out_at set, from an
   * inbound "stop"). Cleared by "start", so it reads current state. */
  optedOut: boolean;
  /** This address is on the suppression list for the drip (unsubscribe,
   * "stop", or a hard bounce/complaint). */
  suppressed: boolean;
  lastDripSentAt: Date | null;
  sentKinds: string[];
}

export type DripDecision =
  | { kind: "drip_setup_nudge" }
  | { kind: "drip_report_unviewed"; childName: string; reportToken: string }
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

  const setupEligible =
    !signals.hasReport &&
    (signals.profileCompletedAt === null || !signals.hasKid) &&
    !signals.sentKinds.includes("drip_setup_nudge") &&
    now.getTime() - signals.createdAt.getTime() >= SETUP_MIN_AGE_MS;
  if (setupEligible) return { kind: "drip_setup_nudge" };

  return null;
}

export interface DripSweepResult {
  skipped: boolean;
  considered: number;
  setupSent: number;
  reportSent: number;
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
      opted_out: boolean;
      last_drip_sent_at: string | null;
      sent_kinds: string[];
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
      ) as sent_kinds
    from public.families f
    where coalesce(f.status, 'open') <> 'deleted'
      and not coalesce(f.sandbox, false)
      and f.email is not null
      and exists (select 1 from public.family_members m where m.family_id = f.id)
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
    optedOut: row.opted_out,
    suppressed: false,
    lastDripSentAt: toDate(row.last_drip_sent_at),
    sentKinds: Array.isArray(row.sent_kinds) ? row.sent_kinds : [],
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
  let setupSent = 0;
  let reportSent = 0;

  for (const family of signals) {
    const decision = chooseDripNudge(family, now);
    if (!decision) continue;
    if (await dripAlreadySent(family.familyId, decision.kind)) continue;

    let submission: HomaEmailSubmission = { status: "unknown" };
    if (decision.kind === "drip_setup_nudge") {
      const token = await mintLinkToken(family.familyId);
      submission = await submitDripSetupNudge(
        family.email,
        family.firstName,
        `${siteUrl()}/api/map/resume-link?t=${token}`,
        family.familyId,
      );
      if (submission.status === "submitted") setupSent += 1;
    } else {
      submission = await submitDripReportUnviewed(
        family.email,
        family.firstName,
        decision.childName,
        `${siteUrl()}/onboarding/r/${decision.reportToken}`,
        family.familyId,
      );
      if (submission.status === "submitted") reportSent += 1;
    }
  }

  return { skipped: false, considered: signals.length, setupSent, reportSent };
}
