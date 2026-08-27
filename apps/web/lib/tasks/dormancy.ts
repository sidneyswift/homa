import { mapDb } from "../map/db";

/**
 * A family goes dormant for the scheduled morning brief once two weeks pass
 * with no message she actually typed or spoke. Internal dispatch turns and
 * agent-authored rows never count, so this reads real silence rather than
 * the scheduler's own traffic (2026-08-27: briefs were firing daily for
 * every family regardless of whether anyone was reading them).
 */
const DORMANCY_WINDOW_DAYS = 14;

export async function familyIsDormant(familyId: string): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ recent: boolean }[]>`
    select exists (
      select 1 from public.conversation_messages
      where family_id = ${familyId}
        and role = 'user'
        and visibility <> 'internal'
        and channel <> 'dispatch'
        and created_at > now() - (interval '1 day' * ${DORMANCY_WINDOW_DAYS})
    ) as recent
  `;
  return rows[0]?.recent !== true;
}
