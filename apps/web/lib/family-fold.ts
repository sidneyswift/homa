import type postgres from "postgres";

import {
  CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY,
} from "./child-progress/postgres-repository-helpers";
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
  "conversation_episodes",
  "conversation_deliveries",
  "conversation_open_loops",
  "conversation_offer_fulfillments",
  "conversation_inbound_receipts",
  "family_memories",
  "call_transcripts",
  "learning_reviews",
  "materials",
  "model_usage",
  "homa_task_runs",
  "child_curriculum_calls",
] as const;

interface LockedFamilyFoldRow {
  id: string;
  email: string | null;
  context: Record<string, unknown> | null;
}

export interface FamilyFoldTestHooks {
  afterFamilyLocks?: () => Promise<void>;
}

async function lockFamilyRowsForFold(
  tx: postgres.TransactionSql,
  sourceFamilyId: string,
  destinationFamilyId: string,
  testHooks: FamilyFoldTestHooks,
): Promise<LockedFamilyFoldRow[] | null> {
  await tx`
    select pg_advisory_xact_lock_shared(
      ${CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY}::bigint
    )
  `;
  const rows = await tx<LockedFamilyFoldRow[]>`
    select family.id, family.email, family.context
    from public.families family
    where family.id in (${sourceFamilyId}, ${destinationFamilyId})
    order by family.id
    for update
  `;
  await testHooks.afterFamilyLocks?.();
  return rows.length === 2 ? rows : null;
}

async function countFamilyMembersAfterLock(
  tx: postgres.TransactionSql,
  familyId: string,
): Promise<number> {
  const rows = await tx<{ count: number }[]>`
    select count(*)::integer as count
    from public.family_members member
    where member.family_id = ${familyId}
  `;
  return rows[0]?.count ?? 0;
}

async function moveLockedFamilyDataIntoTx(
  tx: postgres.TransactionSql,
  sourceFamilyId: string,
  destinationFamilyId: string,
  lockedRows: readonly LockedFamilyFoldRow[],
): Promise<boolean> {
  const sourceContext = lockedRows.find(
    (row) => row.id === sourceFamilyId,
  )?.context;
  const destinationContext = lockedRows.find(
    (row) => row.id === destinationFamilyId,
  )?.context;
  const mergedContext = mergeFamilyContextBags(
    destinationContext,
    sourceContext,
  );
  await tx`
    update public.families
    set context = ${tx.json(mergedContext as unknown as DbJson)},
        updated_at = now()
    where id = ${destinationFamilyId}
  `;
  for (const table of SIMPLE_FAMILY_TABLES) {
    await tx`
      update ${tx(table)} set family_id = ${destinationFamilyId}
      where family_id = ${sourceFamilyId}
    `;
  }

  await tx`
    update public.conversation_thread_bindings source
    set family_id = ${destinationFamilyId}
    where source.family_id = ${sourceFamilyId}
      and not exists (
        select 1 from public.conversation_thread_bindings target
        where target.family_id = ${destinationFamilyId}
          and target.channel = source.channel
          and target.thread_key_hash = source.thread_key_hash
      )
  `;
  await tx`
    delete from public.conversation_thread_bindings
    where family_id = ${sourceFamilyId}
  `;

  await tx`
    update public.events set family_id = ${destinationFamilyId}
    where family_id = ${sourceFamilyId}
  `;

  // hours_log_block_unique_idx forbids two identical blocks in one
  // family; a source row the destination already has is the same
  // dedupe the writers enforce, so it is dropped, not moved.
  await tx`
    update public.hours_log source
    set family_id = ${destinationFamilyId}
    where source.family_id = ${sourceFamilyId}
      and not exists (
        select 1 from public.hours_log target
        where target.family_id = ${destinationFamilyId}
          and target.subject = source.subject
          and target.minutes = source.minutes
          and target.happened_on = source.happened_on
          and target.child_id is not distinct from source.child_id
      )
  `;
  await tx`
    delete from public.hours_log
    where family_id = ${sourceFamilyId}
  `;

  await tx`
    update public.family_skills source
    set family_id = ${destinationFamilyId}, updated_at = now()
    where source.family_id = ${sourceFamilyId}
      and not exists (
        select 1 from public.family_skills target
        where target.family_id = ${destinationFamilyId}
          and target.name = source.name
      )
  `;
  await tx`
    delete from public.family_skills
    where family_id = ${sourceFamilyId}
  `;

  await tx`
    update public.agent_schedules source
    set family_id = ${destinationFamilyId}
    where source.family_id = ${sourceFamilyId}
      and (
        source.kind not in ('journal_prompt', 'morning_brief')
        or not exists (
          select 1 from public.agent_schedules target
          where target.family_id = ${destinationFamilyId}
            and target.kind = source.kind
        )
      )
  `;
  await tx`
    delete from public.agent_schedules
    where family_id = ${sourceFamilyId}
  `;

  await tx`
    update public.children
    set family_id = ${destinationFamilyId}
    where family_id = ${sourceFamilyId}
  `;
  await tx`
    delete from public.families
    where id = ${sourceFamilyId}
  `;
  return true;
}

export async function foldFamilyDataIntoTx(
  tx: postgres.TransactionSql,
  sourceFamilyId: string,
  destinationFamilyId: string,
  testHooks: FamilyFoldTestHooks = {},
): Promise<boolean> {
  if (sourceFamilyId === destinationFamilyId) return false;
  const lockedRows = await lockFamilyRowsForFold(
    tx,
    sourceFamilyId,
    destinationFamilyId,
    testHooks,
  );
  return lockedRows
    ? moveLockedFamilyDataIntoTx(
        tx,
        sourceFamilyId,
        destinationFamilyId,
        lockedRows,
      )
    : false;
}

export async function foldStubFamilyIntoTx(
  tx: postgres.TransactionSql,
  stubId: string,
  intoId: string,
  testHooks: FamilyFoldTestHooks = {},
): Promise<boolean> {
  if (stubId === intoId) return false;
  const lockedRows = await lockFamilyRowsForFold(
    tx,
    stubId,
    intoId,
    testHooks,
  );
  const stub = lockedRows?.find((row) => row.id === stubId);
  if (
    !lockedRows ||
    !stub ||
    stub.email !== null ||
    await countFamilyMembersAfterLock(tx, stubId) !== 0
  ) {
    return false;
  }
  return moveLockedFamilyDataIntoTx(
    tx,
    stubId,
    intoId,
    lockedRows,
  );
}

export async function foldStubFamilyInto(stubId: string, intoId: string): Promise<boolean> {
  const sql = mapDb();
  return await sql.begin((tx) => foldStubFamilyIntoTx(tx, stubId, intoId));
}
