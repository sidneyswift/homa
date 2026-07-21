import { LOOP_BACK_EVENTS } from "../activation/signals";
import { DRIP_KINDS, type DripKind } from "../drip/labels";
import { adminDb } from "./db";

/**
 * Drip observability for the founder console (2026-07-21). Answers the five
 * questions the founder asked of every nudge: what went out, WHY it went to
 * that family, whether it was delivered, whether it worked, and whether it
 * cost an unsubscribe.
 *
 * Two honesty rules shape this module.
 *
 * 1. "Worked" is measured against the nudge's own stated target
 *    (lib/drip/labels.ts), and the targets come from the same
 *    lib/activation/signals.ts rungs the drip aims at, so the thing measured
 *    and the thing nudged cannot drift apart.
 * 2. A nudge sent an hour ago has NOT failed; it is pending. Effect is only
 *    scored once the attribution window has closed, and the rate is reported
 *    over settled sends alone with the settled count shown beside it. A rate
 *    computed over sends that never had a chance is worse than no rate.
 *
 * This is correlation, never proof: the console labels it "acted within 7
 * days", not "caused". There is no holdout group, so a family who would have
 * come back anyway still counts.
 *
 * "Unsubscribed" counts only a person choosing to stop (the unsubscribe link
 * or a "stop" reply). A hard bounce also writes a suppression row, but that
 * is a dead mailbox, not a decision, and it is already reported as failed.
 */

/** How long a nudge gets to work before its effect is judged. */
const ATTRIBUTION_DAYS = 7;

export interface DripScorecardRow {
  kind: DripKind;
  label: string;
  audience: string;
  target: string;
  sent: number;
  delivered: number;
  failed: number;
  /** Took the target action inside the window. */
  worked: number;
  /** Window still open, so not yet judged either way. */
  pending: number;
  unsubscribed: number;
  /** Sends whose window has closed: the only honest denominator. */
  settled: number;
}

export interface DripSendRow {
  id: string;
  familyId: string;
  familyName: string | null;
  firstName: string | null;
  kind: DripKind;
  label: string;
  reason: string | null;
  status: string;
  worked: boolean;
  pending: boolean;
  unsubscribed: boolean;
  sentAt: string;
}

export interface DripData {
  attributionDays: number;
  scorecard: DripScorecardRow[];
  recent: DripSendRow[];
  totals: {
    sent: number;
    delivered: number;
    failed: number;
    worked: number;
    pending: number;
    settled: number;
    unsubscribed: number;
  };
}

interface ScoredSendRow {
  id: string;
  family_id: string;
  family_name: string | null;
  first_name: string | null;
  kind: string;
  reason: string | null;
  status: string;
  worked: boolean;
  pending: boolean;
  unsubscribed: boolean;
  created_at: string;
}

export async function getDripData(recentLimit = 40): Promise<DripData> {
  const sql = adminDb();
  const window = `${ATTRIBUTION_DAYS} days`;

  // One scored row per drip send. The join to families is POSITIVE on
  // purpose: it drops founder preview sends (family_id null) and any send
  // whose family was later purged, so the console never reports a nudge to
  // nobody as real fleet activity. Sandbox families are fenced like every
  // other founder-console read.
  const rows = await sql<ScoredSendRow[]>`
    select
      s.id,
      s.family_id,
      f.name as family_name,
      f.first_name,
      s.kind,
      s.meta->>'reason' as reason,
      s.status,
      case s.kind
        when 'drip_report_unviewed' then exists(
          select 1 from public.child_reports r
          join public.children c on c.id = r.child_id
          where c.family_id = s.family_id
            and r.viewed_at > s.created_at
            and r.viewed_at <= s.created_at + ${window}::interval
        )
        when 'drip_setup_nudge' then exists(
          select 1 from public.child_reports r
          join public.children c on c.id = r.child_id
          where c.family_id = s.family_id
            and r.generated_at > s.created_at
            and r.generated_at <= s.created_at + ${window}::interval
        )
        when 'drip_loop_back' then exists(
          select 1 from public.events e
          where e.family_id = s.family_id
            and e.name = any(${LOOP_BACK_EVENTS as unknown as string[]})
            and e.created_at > s.created_at
            and e.created_at <= s.created_at + ${window}::interval
        )
        when 'drip_add_kid' then exists(
          select 1 from public.children c
          where c.family_id = s.family_id
            and c.created_at > s.created_at
            and c.created_at <= s.created_at + ${window}::interval
        )
        else false
      end as worked,
      (s.created_at + ${window}::interval > now()) as pending,
      -- A PERSON asking to stop, never a dead mailbox. The bounce/complaint
      -- webhook also writes suppressions (scope 'all', reason 'email.bounced'),
      -- and counting those as opt-outs would report a parent who never chose
      -- anything as one who asked us to stop. Bounces are already in failed.
      exists(
        select 1 from public.email_suppressions sup
        where sup.email_hash = s.to_hash
          and sup.created_at > s.created_at
          and sup.reason in ('unsubscribe', 'stop')
      ) as unsubscribed,
      s.created_at::text as created_at
    from public.email_sends s
    join public.families f on f.id = s.family_id
    where s.kind like 'drip_%'
      and not coalesce(f.sandbox, false)
      and coalesce(f.status, 'open') <> 'deleted'
    order by s.created_at desc
  `;

  const failedStatuses = new Set(["bounced", "complained", "rejected"]);
  const scorecard: DripScorecardRow[] = (
    Object.keys(DRIP_KINDS) as DripKind[]
  ).map((kind) => {
    const info = DRIP_KINDS[kind];
    const forKind = rows.filter((row) => row.kind === kind);
    // A send that already worked is settled regardless of the clock: the
    // outcome cannot be undone by waiting longer.
    const pending = forKind.filter((row) => row.pending && !row.worked);
    return {
      kind,
      label: info.label,
      audience: info.audience,
      target: info.target,
      sent: forKind.length,
      delivered: forKind.filter((row) => row.status === "delivered").length,
      failed: forKind.filter((row) => failedStatuses.has(row.status)).length,
      worked: forKind.filter((row) => row.worked).length,
      pending: pending.length,
      unsubscribed: forKind.filter((row) => row.unsubscribed).length,
      settled: forKind.length - pending.length,
    };
  });

  const totals = scorecard.reduce(
    (sum, row) => ({
      sent: sum.sent + row.sent,
      delivered: sum.delivered + row.delivered,
      failed: sum.failed + row.failed,
      worked: sum.worked + row.worked,
      pending: sum.pending + row.pending,
      settled: sum.settled + row.settled,
      unsubscribed: sum.unsubscribed + row.unsubscribed,
    }),
    { sent: 0, delivered: 0, failed: 0, worked: 0, pending: 0, settled: 0, unsubscribed: 0 },
  );

  const recent: DripSendRow[] = rows.slice(0, recentLimit).map((row) => ({
    id: row.id,
    familyId: row.family_id,
    familyName: row.family_name,
    firstName: row.first_name,
    kind: row.kind as DripKind,
    label: DRIP_KINDS[row.kind as DripKind]?.label ?? row.kind,
    reason: row.reason,
    status: row.status,
    worked: row.worked,
    pending: row.pending && !row.worked,
    unsubscribed: row.unsubscribed,
    sentAt: row.created_at,
  }));

  return { attributionDays: ATTRIBUTION_DAYS, scorecard, recent, totals };
}
