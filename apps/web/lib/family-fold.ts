import { mapDb } from "./map/db";

/**
 * The conservative stub-fold shared by every phone reconciliation path
 * (lib/phone-link.ts, lib/phone-claim.ts). A "true stub" is a family
 * with NO members and NO email: the anonymous shell a text signup or
 * abandoned web visit leaves behind. Only those ever fold; anything
 * with an account or an address on it is somebody's real workspace and
 * refuses.
 *
 * Folding moves the family-scoped record (conversation history,
 * memories, hours) and the children (child-scoped rows ride along via
 * FKs), then retires the shell. The stub's family_phones row dies with
 * it, freeing the number for the destination family.
 */

export async function isTrueStub(familyId: string): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ email: string | null; members: number }[]>`
    select f.email,
           (select count(*)::int from public.family_members m where m.family_id = f.id) as members
    from public.families f where f.id = ${familyId}
  `;
  const row = rows[0];
  return Boolean(row) && row.email === null && row.members === 0;
}

export async function foldStubFamilyInto(stubId: string, intoId: string): Promise<boolean> {
  if (stubId === intoId) return false;
  if (!(await isTrueStub(stubId))) return false;
  const sql = mapDb();
  for (const table of ["conversation_messages", "family_memories", "hours_log"]) {
    await sql`
      update ${sql(table)} set family_id = ${intoId}
      where family_id = ${stubId}
    `;
  }
  await sql`
    update public.children set family_id = ${intoId} where family_id = ${stubId}
  `;
  await sql`delete from public.families where id = ${stubId}`;
  return true;
}
