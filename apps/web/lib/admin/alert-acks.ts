import { adminDb } from "./db";

/**
 * "Mark handled" for the founder console's alert strip (founder ask
 * 2026-07-13). One admin_alert_acknowledgments row per handled alert,
 * keyed by the source table plus the row the alert was built from.
 *
 * Task runs are terminal once failed, so a plain id match hides them
 * forever. Deliveries and email sends can fail AGAIN on the same row
 * (retries and webhooks bump updated_at), so those only stay hidden
 * while the ack is newer than the row: a re-failure resurfaces the
 * alert, and marking it handled again refreshes the stamp. Handled is
 * never erased: the overview tiles keep counting the underlying
 * failures, and the page says how many alerts are hidden.
 */

export type AlertSource =
  | "task_run"
  | "delivery"
  | "email_send"
  | "inbound_receipt";

export interface HandledAlert {
  source: AlertSource;
  sourceId: string;
  familyName: string | null;
  /** Task kind, delivery channel, email kind, or inbound channel, per source. */
  descriptor: string;
  status: string;
  error: string | null;
  at: string;
  handledAt: string;
}

export function parseAlertSource(value: string): AlertSource | null {
  return value === "task_run" ||
    value === "delivery" ||
    value === "email_send" ||
    value === "inbound_receipt"
    ? value
    : null;
}

/** The ack row must point at a real source row; anything else no-ops.
 * Sequential single queries only, per lib/admin/db.ts. */
async function alertSourceRowExists(source: AlertSource, sourceId: string): Promise<boolean> {
  const sql = adminDb();
  switch (source) {
    case "task_run": {
      const rows = await sql<{ one: number }[]>`
        select 1 as one from public.homa_task_runs where id = ${sourceId} limit 1
      `;
      return rows.length > 0;
    }
    case "delivery": {
      const rows = await sql<{ one: number }[]>`
        select 1 as one from public.conversation_deliveries where id = ${sourceId} limit 1
      `;
      return rows.length > 0;
    }
    case "email_send": {
      const rows = await sql<{ one: number }[]>`
        select 1 as one from public.email_sends where id = ${sourceId} limit 1
      `;
      return rows.length > 0;
    }
    case "inbound_receipt": {
      const rows = await sql<{ one: number }[]>`
        select 1 as one from public.conversation_inbound_receipts
        where id = ${sourceId} limit 1
      `;
      return rows.length > 0;
    }
    default: {
      const exhausted: never = source;
      throw new Error(`unknown alert source: ${String(exhausted)}`);
    }
  }
}

export async function acknowledgeAlert(
  source: AlertSource,
  sourceId: string,
  acknowledgedBy: string,
): Promise<boolean> {
  if (!(await alertSourceRowExists(source, sourceId))) return false;
  const sql = adminDb();
  await sql`
    insert into public.admin_alert_acknowledgments (source, source_id, acknowledged_by)
    values (${source}, ${sourceId}, ${acknowledgedBy})
    on conflict (source, source_id)
      do update set created_at = now(), acknowledged_by = excluded.acknowledged_by
  `;
  return true;
}

export async function unacknowledgeAlert(source: AlertSource, sourceId: string): Promise<void> {
  const sql = adminDb();
  await sql`
    delete from public.admin_alert_acknowledgments
    where source = ${source} and source_id = ${sourceId}
  `;
}

/**
 * Every handled alert that the overview's trouble lists would show if
 * it were not acknowledged; the exact mirror of the not-exists filters
 * in overview-data.ts. Feeds both the "N handled alerts hidden" note
 * (its length) and the Bring back list.
 */
export async function listHandledAlerts(rangeDays: number): Promise<HandledAlert[]> {
  const sql = adminDb();
  const interval = `${rangeDays} days`;

  // Sequential on purpose, never Promise.all: see lib/admin/db.ts.
  const runRows = await sql<
    { source_id: string; family_name: string | null; kind: string; status: string; error: string | null; at: string; handled_at: string }[]
  >`
    select r.id as source_id, f.name as family_name, r.kind, r.status, r.error,
           r.started_at::text as at, a.created_at::text as handled_at
    from public.admin_alert_acknowledgments a
    join public.homa_task_runs r on r.id = a.source_id
    left join public.families f on f.id = r.family_id
    where a.source = 'task_run'
      and r.status in ('failed', 'uncertain', 'partial', 'partial_uncertain')
      and r.started_at >= now() - ${interval}::interval
    order by a.created_at desc
    limit 12
  `;
  const deliveryRows = await sql<
    { source_id: string; family_name: string; channel: string; status: string; error: string | null; at: string; handled_at: string }[]
  >`
    select d.id as source_id, f.name as family_name, d.channel, d.status, d.error,
           d.updated_at::text as at, a.created_at::text as handled_at
    from public.admin_alert_acknowledgments a
    join public.conversation_deliveries d on d.id = a.source_id
    join public.families f on f.id = d.family_id
    where a.source = 'delivery'
      and d.status in ('failed', 'uncertain')
      and d.updated_at >= now() - ${interval}::interval
      and a.created_at >= d.updated_at
    order by a.created_at desc
    limit 12
  `;
  const emailRows = await sql<
    { source_id: string; kind: string; status: string; error: string | null; at: string; handled_at: string }[]
  >`
    select e.id as source_id, e.kind, e.status, e.error,
           e.updated_at::text as at, a.created_at::text as handled_at
    from public.admin_alert_acknowledgments a
    join public.email_sends e on e.id = a.source_id
    where a.source = 'email_send'
      and e.status in ('rejected', 'bounced', 'complained')
      and e.updated_at >= now() - ${interval}::interval
      and a.created_at >= e.updated_at
    order by a.created_at desc
    limit 12
  `;
  // A stalled inbound receipt (season-sim BUG-P3-2), hidden while still
  // claimed and while the ack is newer than the current claim, exactly
  // mirroring overview-data.ts. A reclaim resets claimed_at and resurfaces.
  const inboundRows = await sql<
    { source_id: string; family_name: string | null; channel: string; at: string; handled_at: string }[]
  >`
    select ir.id as source_id, f.name as family_name, ir.channel,
           ir.claimed_at::text as at, a.created_at::text as handled_at
    from public.admin_alert_acknowledgments a
    join public.conversation_inbound_receipts ir on ir.id = a.source_id
    left join public.families f on f.id = ir.family_id
    where a.source = 'inbound_receipt'
      and ir.status = 'claimed'
      and ir.claimed_at >= now() - ${interval}::interval
      and a.created_at >= ir.claimed_at
    order by a.created_at desc
    limit 12
  `;

  const handled: HandledAlert[] = [
    ...runRows.map((row) => ({
      source: "task_run" as const,
      sourceId: row.source_id,
      familyName: row.family_name,
      descriptor: row.kind,
      status: row.status,
      error: row.error,
      at: row.at,
      handledAt: row.handled_at,
    })),
    ...deliveryRows.map((row) => ({
      source: "delivery" as const,
      sourceId: row.source_id,
      familyName: row.family_name,
      descriptor: row.channel,
      status: row.status,
      error: row.error,
      at: row.at,
      handledAt: row.handled_at,
    })),
    ...emailRows.map((row) => ({
      source: "email_send" as const,
      sourceId: row.source_id,
      familyName: null,
      descriptor: row.kind,
      status: row.status,
      error: row.error,
      at: row.at,
      handledAt: row.handled_at,
    })),
    ...inboundRows.map((row) => ({
      source: "inbound_receipt" as const,
      sourceId: row.source_id,
      familyName: row.family_name,
      descriptor: row.channel,
      status: "stalled",
      error: null,
      at: row.at,
      handledAt: row.handled_at,
    })),
  ];
  return handled.sort(
    (left, right) => new Date(right.handledAt).getTime() - new Date(left.handledAt).getTime(),
  );
}
