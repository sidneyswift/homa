import { mapDb } from "../map/db";
import { siteUrl, submitStrandedFollowup } from "../map/email";
import {
  planStrandedFollowups,
  STRANDED_LEDGER_KIND,
  type StrandedChainRow,
  type StrandedSkipReason,
} from "./stranded-chains";
import { strandedFollowupsEnabled } from "./stranded-flag";

/**
 * The daily stranded-chain pass (gh#197), called from /api/map/cron.
 *
 * Like the filing reminder, the FLAG GUARDS THE SEND and not the sweep,
 * because the eligible count is the number that says whether this is
 * worth turning on. On 2026-07-30 that number is what made the case:
 * ten of fifteen families with materials had zero finals.
 */

export interface StrandedSweepResult {
  sent: number;
  eligible: number;
  skipped: Record<StrandedSkipReason, number>;
  sendingEnabled: boolean;
}

/**
 * The newest material of every chain that never reached final.
 *
 * A "chain" is a revises-linked series. `revises` points at the row this
 * one replaces, so the newest member of a chain is the row nobody else
 * revises. Excluding families with no email and sandbox rows happens
 * here; everything about WHO to mail is the planner's job.
 *
 * state-pack and state-filing subjects are excluded: those are generated
 * on demand and land final immediately, so they are never stranded, and
 * a compliance document is not what this message is about.
 */
async function loadStrandedRows(): Promise<StrandedChainRow[]> {
  const sql = mapDb();
  const rows = await sql<
    {
      family_id: string;
      email: string | null;
      first_name: string | null;
      id: string;
      title: string;
      created_at: string;
      review_pass: string | null;
      family_has_final: boolean;
    }[]
  >`
    select m.family_id, f.email, f.first_name, m.id, m.title,
           m.created_at::text as created_at,
           m.generation->'review'->>'pass' as review_pass,
           exists (
             select 1 from public.materials done
             where done.family_id = m.family_id and done.status = 'final'
           ) as family_has_final
    from public.materials m
    join public.families f on f.id = m.family_id
    where coalesce(f.sandbox, false) = false
      and f.status <> 'deleted'
      and m.status = 'draft'
      and m.child_id is not null
      and m.subject not in ('state-pack', 'state-filing')
      and not exists (
        select 1 from public.materials newer
        where newer.revises = m.id
      )
    order by m.created_at desc
    limit 500
  `;
  return rows.map((row) => ({
    familyId: row.family_id,
    email: row.email,
    firstName: row.first_name,
    materialId: row.id,
    title: row.title,
    createdAtIso: new Date(row.created_at).toISOString(),
    reviewPass: row.review_pass === null ? null : row.review_pass !== "false",
    familyHasFinal: row.family_has_final,
  }));
}

/** Every family that has already had its one message. */
async function familiesAlreadyTold(): Promise<Set<string>> {
  const sql = mapDb();
  const rows = await sql<{ family_id: string }[]>`
    select distinct family_id from public.email_sends
    where kind = ${STRANDED_LEDGER_KIND}
      and status in ('submitted', 'delivered')
      and family_id is not null
  `;
  return new Set(rows.map((row) => row.family_id));
}

export async function runStrandedSweep(
  nowIso: string,
): Promise<StrandedSweepResult> {
  const [rows, told] = await Promise.all([
    loadStrandedRows(),
    familiesAlreadyTold(),
  ]);
  const plan = planStrandedFollowups(rows, nowIso, told);
  const sendingEnabled = strandedFollowupsEnabled();

  let sent = 0;
  if (sendingEnabled) {
    for (const send of plan.sends) {
      const submission = await submitStrandedFollowup(send.email, {
        firstName: send.firstName,
        title: send.title,
        strandedCount: send.strandedCount,
        binderUrl: `${siteUrl()}/app/binder`,
        familyId: send.familyId,
      });
      if (submission.status === "submitted") sent += 1;
    }
  }

  return {
    sent,
    eligible: plan.sends.length,
    skipped: plan.skipped,
    sendingEnabled,
  };
}
