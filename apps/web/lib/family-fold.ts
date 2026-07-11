import type postgres from "postgres";

import { mergeFamilyContextBags } from "./family-context-merge";
import { mapDb } from "./map/db";
import type { DbJson } from "./map/db";

/**
 * The conservative stub-fold shared by every phone reconciliation path
 * (lib/phone-link.ts, lib/phone-claim.ts). A "true stub" is a family
 * with NO members and NO email: the anonymous shell a text signup or
 * abandoned web visit leaves behind. Only those ever fold; anything
 * with an account or an address on it is somebody's real workspace and
 * refuses.
 *
 * Folding moves the family-scoped record (conversation history,
 * memories, hours, call transcripts, materials, task history, saved
 * skills, and analytics) and the children (child-scoped rows ride along
 * via FKs), then retires the shell. The stub's family_phones row dies
 * with it, freeing the number for the destination family.
 */

const SIMPLE_FAMILY_TABLES = [
  "conversation_messages",
  "family_memories",
  "hours_log",
  "call_transcripts",
  "learning_reviews",
  "materials",
  "model_usage",
  "homa_task_runs",
  "child_curriculum_calls",
] as const;

type SqlClient = postgres.Sql | postgres.TransactionSql;

async function isTrueStubWithSql(sql: SqlClient, familyId: string): Promise<boolean> {
  const rows = await sql<{ email: string | null; members: number }[]>`
    select f.email,
           (select count(*)::int from public.family_members m where m.family_id = f.id) as members
    from public.families f where f.id = ${familyId}
  `;
  const row = rows[0];
  return Boolean(row) && row.email === null && row.members === 0;
}

export async function foldStubFamilyIntoTx(
  tx: SqlClient,
  stubId: string,
  intoId: string,
): Promise<boolean> {
  if (stubId === intoId) return false;
  if (!(await isTrueStubWithSql(tx, stubId))) return false;
  const contextRows = await tx<{ id: string; context: Record<string, unknown> | null }[]>`
    select id, context from public.families where id in (${stubId}, ${intoId})
  `;
  const stubContext = contextRows.find((row) => row.id === stubId)?.context;
  const intoContext = contextRows.find((row) => row.id === intoId)?.context;
  const mergedContext = mergeFamilyContextBags(intoContext, stubContext);
  await tx`
    update public.families
    set context = ${tx.json(mergedContext as unknown as DbJson)},
        updated_at = now()
    where id = ${intoId}
  `;
  for (const table of SIMPLE_FAMILY_TABLES) {
    await tx`
      update ${tx(table)} set family_id = ${intoId}
      where family_id = ${stubId}
    `;
  }

  await tx`
    update public.events set family_id = ${intoId}
    where family_id = ${stubId}
  `;

  await tx`
    update public.family_skills source
    set family_id = ${intoId}, updated_at = now()
    where source.family_id = ${stubId}
      and not exists (
        select 1 from public.family_skills target
        where target.family_id = ${intoId} and target.name = source.name
      )
  `;
  await tx`
    delete from public.family_skills where family_id = ${stubId}
  `;

  await tx`
    update public.agent_schedules source
    set family_id = ${intoId}
    where source.family_id = ${stubId}
      and (
        source.kind not in ('journal_prompt', 'morning_brief')
        or not exists (
          select 1 from public.agent_schedules target
          where target.family_id = ${intoId} and target.kind = source.kind
        )
      )
  `;
  await tx`
    delete from public.agent_schedules where family_id = ${stubId}
  `;

  await tx`
    update public.children set family_id = ${intoId} where family_id = ${stubId}
  `;
  await tx`delete from public.families where id = ${stubId}`;
  return true;
}

export async function foldStubFamilyInto(stubId: string, intoId: string): Promise<boolean> {
  const sql = mapDb();
  return await sql.begin((tx) => foldStubFamilyIntoTx(tx, stubId, intoId));
}
