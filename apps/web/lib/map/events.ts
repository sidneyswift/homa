import { EVENT_SCHEMAS, type EventName, type EventProps } from "@homa/core";

import { mapDb, type DbJson } from "./db";

/**
 * Server-side event emission for names the public events policy will not
 * accept (map.*, sms.*; the policy stays waitlist-only on purpose). These
 * insert through the server's own database connection. Best-effort by law:
 * analytics never break the feature emitting them.
 */
function familyIdFromProps(props: unknown): string | null {
  if (!props || typeof props !== "object" || !("family_id" in props)) return null;
  const familyId = (props as { family_id?: unknown }).family_id;
  return typeof familyId === "string" ? familyId : null;
}

export async function emitMapEvent<N extends EventName>(
  name: N,
  props: EventProps<N>,
  options: { familyId?: string | null } = {},
): Promise<void> {
  try {
    const parsed = EVENT_SCHEMAS[name].parse(props);
    const sql = mapDb();
    const familyId = options.familyId ?? familyIdFromProps(parsed);
    if (familyId) {
      await sql`
        insert into public.events (name, props, family_id)
        values (${name}, ${sql.json(parsed as unknown as DbJson)}, ${familyId})
      `;
      return;
    }
    await sql`
      insert into public.events (name, props)
      values (${name}, ${sql.json(parsed as unknown as DbJson)})
    `;
  } catch (error) {
    console.error(`emitMapEvent(${name}) failed:`, error);
  }
}
