import { EVENT_SCHEMAS, type EventName, type EventProps } from "@homa/core";

import { mapDb, type DbJson } from "./db";

/**
 * Server-side event emission for map.* names. The public events policy
 * stays waitlist-only on purpose; map events insert through the server's
 * own database connection. Best-effort by law: analytics never break the
 * feature emitting them.
 */
export async function emitMapEvent<N extends EventName>(
  name: N,
  props: EventProps<N>,
): Promise<void> {
  try {
    const parsed = EVENT_SCHEMAS[name].parse(props);
    const sql = mapDb();
    await sql`insert into public.events (name, props) values (${name}, ${sql.json(parsed as unknown as DbJson)})`;
  } catch (error) {
    console.error(`emitMapEvent(${name}) failed:`, error);
  }
}
