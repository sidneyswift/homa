import { recordCronRun } from "../../../../lib/admin/heartbeat";
import { runSyncApplier } from "../../../../lib/sync/apply";
import { deviceSyncEnabled } from "../../../../lib/sync/flag";

/**
 * GET /api/sync/cron (Vercel cron, hourly): drains pending device sync
 * events through the applier. CRON_SECRET bearer, identical gate to
 * /api/map/cron; that secret stays inside the deployment, the device
 * never holds it. Every tick writes a cron_runs heartbeat so a dead sync
 * cron is visible in /admin, and overlapping ticks are safe (row claims
 * use for update skip locked).
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("cron secret unset", { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  if (!deviceSyncEnabled()) {
    await recordCronRun("sync_cron", true, { enabled: false });
    return Response.json({ enabled: false });
  }

  try {
    const summary = await runSyncApplier();
    await recordCronRun("sync_cron", true, { enabled: true, ...summary });
    return Response.json({ enabled: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordCronRun("sync_cron", false, { enabled: true }, message);
    return Response.json({ error: message }, { status: 500 });
  }
}
