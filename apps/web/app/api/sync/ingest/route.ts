import { emitMapEvent } from "../../../../lib/map/events";
import { deviceSyncEnabled } from "../../../../lib/sync/flag";
import { syncBatchSchema } from "../../../../lib/sync/schemas";
import { ingestSyncEvents, resolveSyncDevice } from "../../../../lib/sync/store";

/**
 * POST /api/sync/ingest: the mac-mini's push door. Bearer token resolves
 * to one sync_devices row; family_id is stamped server-side from that row
 * and never read from the payload (channel-identity trust basis, same as
 * the phone mapping). Per-event validation: one bad envelope rejects that
 * event alone. Replays are free (dedupe unique index).
 */
export async function POST(request: Request): Promise<Response> {
  if (!deviceSyncEnabled()) {
    return Response.json({ error: "not enabled" }, { status: 404 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const device = await resolveSyncDevice(token);
  if (!device) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const batch = syncBatchSchema.safeParse(body);
  if (!batch.success) {
    return Response.json({ error: "invalid batch shape" }, { status: 400 });
  }

  const result = await ingestSyncEvents(device, batch.data.events);
  await emitMapEvent("mini_sync.batch_received", {
    family_id: device.familyId,
    received: result.received,
    inserted: result.inserted,
    duplicates: result.duplicates,
    invalid: result.invalid,
  });

  return Response.json({
    received: result.received,
    inserted: result.inserted,
    duplicates: result.duplicates,
    invalid: result.invalid,
    results: result.results,
  });
}
