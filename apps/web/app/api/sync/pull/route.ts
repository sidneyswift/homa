import { deviceSyncEnabled } from "../../../../lib/sync/flag";
import { getSyncPullDelta } from "../../../../lib/sync/pull";
import { resolveSyncDevice } from "../../../../lib/sync/store";

/**
 * GET /api/sync/pull?since=ISO: the mac-mini's read door. Returns
 * cloud-side deltas (memories with supersessions, child profiles, live
 * progress projections) for the device's family only, computed from the
 * domain tables. The device's ack is its own cursor; nothing here
 * mutates state.
 */
export async function GET(request: Request): Promise<Response> {
  if (!deviceSyncEnabled()) {
    return Response.json({ error: "not enabled" }, { status: 404 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const device = await resolveSyncDevice(token);
  if (!device) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  if (since !== null && Number.isNaN(Date.parse(since))) {
    return Response.json({ error: "invalid since cursor" }, { status: 400 });
  }

  const delta = await getSyncPullDelta(device.familyId, { since });
  return Response.json(delta);
}
