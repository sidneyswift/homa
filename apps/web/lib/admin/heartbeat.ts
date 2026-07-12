import { mapDb, type DbJson } from "../map/db";

/**
 * The hourly cron's heartbeat (founder console MJ-14; blind spot 5 in the
 * 2026-07-12 founder-dashboard lab): one cron_runs row per tick, so a
 * dead cron finally looks different from a healthy quiet one. Best-effort
 * by law: the heartbeat never breaks the jobs it is recording.
 */
export async function recordCronRun(
  job: string,
  ok: boolean,
  counts: Record<string, unknown>,
  error?: string,
): Promise<void> {
  try {
    const sql = mapDb();
    await sql`
      insert into public.cron_runs (job, ok, counts, error)
      values (${job}, ${ok}, ${sql.json(counts as DbJson)}, ${error ?? null})
    `;
  } catch (heartbeatError) {
    console.error("cron heartbeat write failed:", heartbeatError);
  }
}
