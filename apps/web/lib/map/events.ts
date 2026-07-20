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

/** Emission with a short same-child dedupe window: two of the same
 * event for one child moments apart count once. Production evidence
 * 2026-07-18: map.report_viewed landed in same-child pairs, once 6
 * microseconds apart (two page contexts loading the report at the same
 * moment, or a fast reload, each run the mount beacon). The advisory
 * lock, keyed on name and child, serializes the racing pair so the
 * second insert actually sees the first; a plain check-then-insert
 * would let both pass the check. Props must carry the family id, which
 * scopes both the window query and the inserted row. */
export async function emitMapEventOnce<N extends EventName>(
  name: N,
  props: EventProps<N>,
  dedupe: { childId: string; windowSeconds: number },
): Promise<void> {
  try {
    const parsed = EVENT_SCHEMAS[name].parse(props);
    const familyId = familyIdFromProps(parsed);
    if (!familyId) throw new Error("emitMapEventOnce needs family_id in props");
    const sql = mapDb();
    await sql.begin(async (tx) => {
      await tx`
        select pg_advisory_xact_lock(
          hashtextextended(${"event-once:" + name + ":" + dedupe.childId}, 0)
        )
      `;
      const recent = await tx<{ one: number }[]>`
        select 1 as one from public.events
        where name = ${name}
          and family_id = ${familyId}
          and props->>'child_id' = ${dedupe.childId}
          and created_at > now() - make_interval(secs => ${dedupe.windowSeconds})
        limit 1
      `;
      if (recent.length > 0) return;
      await tx`
        insert into public.events (name, props, family_id)
        values (${name}, ${tx.json(parsed as unknown as DbJson)}, ${familyId})
      `;
    });
  } catch (error) {
    console.error(`emitMapEventOnce(${name}) failed:`, error);
  }
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
