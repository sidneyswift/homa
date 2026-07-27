import { createHash } from "node:crypto";

import { mapDb, type DbJson } from "../map/db";
import { checkSyncEnvelope, type SyncEnvelope } from "./schemas";

/**
 * Server-only access to the device sync mailbox (migration
 * 20260725150000). Both tables are deny-all for every Data API role; this
 * module, running on the app's own server connection, is the only reader
 * and writer. familyId always comes from the resolved device row, never
 * from a request payload.
 */

export interface SyncDevice {
  id: string;
  familyId: string;
  name: string;
}

/** Resolve a bearer token to an unrevoked device, stamping last_seen_at
 * best-effort. Null means 401: unknown or revoked. */
export async function resolveSyncDevice(token: string): Promise<SyncDevice | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const sql = mapDb();
  const rows = await sql<{ id: string; family_id: string; name: string }[]>`
    select id, family_id, name from public.sync_devices
    where token_hash = ${tokenHash} and revoked_at is null
  `;
  const device = rows[0];
  if (!device) return null;
  try {
    await sql`update public.sync_devices set last_seen_at = now() where id = ${device.id}`;
  } catch {
    // Best-effort: a failed liveness stamp never fails the request.
  }
  return { id: device.id, familyId: device.family_id, name: device.name };
}

export type IngestEventResult =
  | { accepted: true; duplicate: boolean }
  | { accepted: false; reason: string };

export interface IngestBatchResult {
  received: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  results: IngestEventResult[];
}

/**
 * Validate and insert a raw event batch for one device. Per-event: an
 * invalid envelope rejects that event alone; a dedupe-key replay is a
 * silent no-op (accepted, duplicate: true) so the mini's at-least-once
 * push is free to retry whole batches.
 */
export async function ingestSyncEvents(
  device: SyncDevice,
  rawEvents: unknown[],
): Promise<IngestBatchResult> {
  const sql = mapDb();
  const results: IngestEventResult[] = [];
  let inserted = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const raw of rawEvents) {
    const check = checkSyncEnvelope(raw);
    if (!check.ok) {
      invalid += 1;
      results.push({ accepted: false, reason: check.reason });
      continue;
    }
    const envelope: SyncEnvelope = check.envelope;
    const insertedRows = await sql<{ id: string }[]>`
      insert into public.sync_events
        (family_id, device_id, origin, kind, schema_version, dedupe_key, payload, produced_at)
      values
        (${device.familyId}, ${device.id}, 'device', ${envelope.kind},
         ${envelope.schemaVersion}, ${envelope.dedupeKey},
         ${sql.json(envelope.payload as DbJson)}, ${envelope.producedAt})
      on conflict on constraint sync_events_dedupe do nothing
      returning id
    `;
    if (insertedRows.length > 0) {
      inserted += 1;
      results.push({ accepted: true, duplicate: false });
    } else {
      duplicates += 1;
      results.push({ accepted: true, duplicate: true });
    }
  }

  return { received: rawEvents.length, inserted, duplicates, invalid, results };
}

export interface PendingSyncEvent {
  id: string;
  familyId: string;
  kind: string;
  schemaVersion: number;
  dedupeKey: string;
  payload: Record<string, unknown>;
  attempts: number;
}

export type SyncEventOutcome =
  | { status: "applied" }
  | { status: "skipped"; reason: string }
  | { status: "parked" }
  | { status: "failed"; error: string };

/** Dead-letter after this many handler failures; replay by resetting the
 * row to pending in SQL. */
export const SYNC_MAX_ATTEMPTS = 5;

/**
 * Drain pending device-origin events through a handler, one claim
 * transaction per batch. `for update skip locked` makes an overlapping
 * tick (cron plus a manual run) safe: two drains never process the same
 * row. The handler runs inside the claim transaction; its own writes go
 * through gate libraries on the same server connection.
 */
export async function drainSyncEvents(
  handle: (event: PendingSyncEvent) => Promise<SyncEventOutcome>,
  limit = 100,
): Promise<{ applied: number; skipped: number; parked: number; errored: number; retrying: number }> {
  const sql = mapDb();
  const counts = { applied: 0, skipped: 0, parked: 0, errored: 0, retrying: 0 };

  await sql.begin(async (tx) => {
    const pending = await tx<
      {
        id: string;
        family_id: string;
        kind: string;
        schema_version: number;
        dedupe_key: string;
        payload: Record<string, unknown>;
        attempts: number;
      }[]
    >`
      select id, family_id, kind, schema_version, dedupe_key, payload, attempts
      from public.sync_events
      where status = 'pending' and origin = 'device'
      order by created_at asc
      limit ${limit}
      for update skip locked
    `;

    for (const row of pending) {
      const event: PendingSyncEvent = {
        id: row.id,
        familyId: row.family_id,
        kind: row.kind,
        schemaVersion: row.schema_version,
        dedupeKey: row.dedupe_key,
        payload: row.payload,
        attempts: row.attempts,
      };
      let outcome: SyncEventOutcome;
      try {
        outcome = await handle(event);
      } catch (error) {
        outcome = {
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        };
      }

      if (outcome.status === "applied") {
        counts.applied += 1;
        await tx`
          update public.sync_events
          set status = 'applied', processed_at = now(), error = null
          where id = ${event.id}
        `;
      } else if (outcome.status === "skipped") {
        counts.skipped += 1;
        await tx`
          update public.sync_events
          set status = 'skipped', processed_at = now(), error = ${outcome.reason}
          where id = ${event.id}
        `;
      } else if (outcome.status === "parked") {
        counts.parked += 1;
        await tx`
          update public.sync_events
          set status = 'parked', processed_at = now(), error = null
          where id = ${event.id}
        `;
      } else {
        const attempts = event.attempts + 1;
        const dead = attempts >= SYNC_MAX_ATTEMPTS;
        if (dead) counts.errored += 1;
        else counts.retrying += 1;
        await tx`
          update public.sync_events
          set attempts = ${attempts},
              status = ${dead ? "error" : "pending"},
              processed_at = ${dead ? tx`now()` : null},
              error = ${outcome.error.slice(0, 2000)}
          where id = ${event.id}
        `;
      }
    }
  });

  return counts;
}
