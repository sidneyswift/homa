import { mapDb } from "../map/db";
import { emailHash } from "./hash";

/**
 * The email suppression store (compliance for the onboarding drip, funnel
 * work 2026-07-20). Durable record of addresses that must not get proactive
 * mail: unsubscribes and inbound "stop" suppress the 'drip' scope; hard
 * bounces and spam complaints suppress 'all'. See the migration for the
 * scope contract.
 *
 * Every function is best-effort by the same law as the email ledger: a
 * suppression read or write must never break the send or receipt it guards.
 * A read failure (including the table not existing yet on a deploy that
 * leads its migration) resolves to "not suppressed" rather than throwing;
 * the drip is dark until its migration is applied, so this can only ever
 * fail open while nothing is sending.
 */

export type SuppressionScope = "drip" | "all";

/** The scopes that silence a drip nudge: an explicit drip opt-out, or a
 * hard all-mail suppression. */
const DRIP_BLOCKING_SCOPES: SuppressionScope[] = ["drip", "all"];

export async function suppressHash(
  hash: string,
  scope: SuppressionScope,
  reason: string,
): Promise<void> {
  try {
    const sql = mapDb();
    await sql`
      insert into public.email_suppressions (email_hash, scope, reason)
      values (${hash}, ${scope}, ${reason})
      on conflict (email_hash, scope)
      do update set reason = excluded.reason, updated_at = now()
    `;
  } catch (error) {
    console.error("email suppression write failed:", error);
  }
}

export async function suppressEmail(
  address: string,
  scope: SuppressionScope,
  reason: string,
): Promise<void> {
  await suppressHash(emailHash(address), scope, reason);
}

/** Lifts a suppression, e.g. an inbound "start" undoing a "stop". Narrow by
 * scope so lifting the drip opt-out never clears a hard all-mail bounce. */
export async function unsuppressEmail(
  address: string,
  scope: SuppressionScope,
): Promise<void> {
  try {
    const sql = mapDb();
    await sql`
      delete from public.email_suppressions
      where email_hash = ${emailHash(address)} and scope = ${scope}
    `;
  } catch (error) {
    console.error("email suppression delete failed:", error);
  }
}

/** True when this address must not receive a drip nudge. */
export async function isEmailSuppressedForDrip(address: string): Promise<boolean> {
  return (await suppressedHashesForDrip([emailHash(address)])).size > 0;
}

/**
 * The subset of the given hashes that are drip-suppressed, in one query, for
 * the sweep's batch check. Returns an empty set on any failure so a
 * suppression outage fails open rather than silencing every nudge (the drip
 * is dark regardless until its migration lands).
 */
export async function suppressedHashesForDrip(
  hashes: string[],
): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();
  try {
    const sql = mapDb();
    const rows = await sql<{ email_hash: string }[]>`
      select distinct email_hash from public.email_suppressions
      where email_hash = any(${hashes}) and scope = any(${DRIP_BLOCKING_SCOPES})
    `;
    return new Set(rows.map((row) => row.email_hash));
  } catch (error) {
    console.error("email suppression read failed:", error);
    return new Set();
  }
}
