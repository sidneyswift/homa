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

export interface FamilyFoldArtifactSchema {
  hard_delete_guard_present: boolean;
  tombstones_present: boolean;
  prefixes_present: boolean;
  candidates_present: boolean;
}

export type FamilyFoldArtifactSchemaState = "legacy" | "partial" | "ready";

interface LockedFamilyFold {
  rows: LockedFamilyFoldRow[];
  artifactSchemaReady: boolean;
}

export function classifyFamilyFoldArtifactSchema(
  schema: FamilyFoldArtifactSchema,
): FamilyFoldArtifactSchemaState {
  const relationStates = [
    schema.tombstones_present,
    schema.prefixes_present,
    schema.candidates_present,
  ];
  if (!schema.hard_delete_guard_present && relationStates.every((present) => !present)) {
    return "legacy";
  }
  if (schema.hard_delete_guard_present && relationStates.every(Boolean)) {
    return "ready";
  }
  return "partial";
}

export interface FamilyFoldTestHooks {
  afterFamilyLocks?: () => Promise<void>;
}

async function lockFamilyRowsForFold(
  tx: postgres.TransactionSql,
  sourceFamilyId: string,
  destinationFamilyId: string,
  testHooks: FamilyFoldTestHooks,
): Promise<LockedFamilyFold | null> {
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
  if (rows.length !== 2) return null;

  const [artifactSchema] = await tx<FamilyFoldArtifactSchema[]>`
    select
      exists (
        select 1
        from pg_trigger trigger
        where trigger.tgrelid = 'public.families'::regclass
          and trigger.tgname = 'families_hard_delete_protocol_guard'
          and not trigger.tgisinternal
          and trigger.tgenabled in ('O', 'A')
          and trigger.tgfoid = to_regprocedure(
            'public.guard_family_hard_delete_protocol()'
          )
      ) as hard_delete_guard_present,
      to_regclass('public.account_deletion_artifact_tombstones') is not null
        as tombstones_present,
      to_regclass('public.family_artifact_prefixes') is not null
        as prefixes_present,
      to_regclass('public.family_artifact_prefix_candidates') is not null
        as candidates_present
  `;
  const artifactSchemaState = artifactSchema
    ? classifyFamilyFoldArtifactSchema(artifactSchema)
    : "partial";
  if (artifactSchemaState === "partial") return null;
  if (artifactSchemaState === "legacy") {
    return { rows, artifactSchemaReady: false };
  }

  // Account deletion and family folding lock the same family rows. Once a
  // deletion tombstone exists, refusing the fold keeps its Blob cleanup set
  // complete. Also reject impossible alias ownership before any family data
  // moves, rather than stealing another family's historical storage prefix.
  const unsafeArtifactOwnership = await tx<Array<{ unsafe: boolean }>>`
    select exists (
      select 1
      from public.account_deletion_artifact_tombstones tombstone
      where tombstone.family_id in (${sourceFamilyId}, ${destinationFamilyId})
    ) or exists (
      select 1
      from public.family_artifact_prefixes prefix
      join public.account_deletion_artifact_tombstones tombstone
        on tombstone.family_id = prefix.artifact_family_id
      where prefix.owner_family_id in (${sourceFamilyId}, ${destinationFamilyId})
    ) or exists (
      select 1
      from public.family_artifact_prefixes prefix
      where prefix.artifact_family_id in (
        ${sourceFamilyId},
        ${destinationFamilyId}
      )
    ) or exists (
      select 1
      from public.family_artifact_prefix_candidates candidate
      where candidate.artifact_family_id in (
        ${sourceFamilyId},
        ${destinationFamilyId}
      )
    ) or exists (
      select 1
      from public.family_artifact_prefix_candidates candidate
      join public.family_artifact_prefixes prefix
        on prefix.artifact_family_id = candidate.artifact_family_id
      where prefix.owner_family_id in (
        ${sourceFamilyId},
        ${destinationFamilyId}
      )
        and candidate.owner_family_id not in (
          ${sourceFamilyId},
          ${destinationFamilyId}
        )
    ) or exists (
      select 1
      from public.family_artifact_prefix_candidates candidate
      join public.family_artifact_prefix_candidates other
        on other.artifact_family_id = candidate.artifact_family_id
       and other.owner_family_id not in (
         ${sourceFamilyId},
         ${destinationFamilyId}
       )
      where candidate.owner_family_id in (
        ${sourceFamilyId},
        ${destinationFamilyId}
      )
    ) as unsafe
  `;
  return unsafeArtifactOwnership[0]?.unsafe
    ? null
    : { rows, artifactSchemaReady: true };
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
  lockedFold: LockedFamilyFold,
): Promise<boolean> {
  const lockedRows = lockedFold.rows;
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

  // Distinct entry ids are preserved, even when subject/time/date happen to match.
  // Deferred composite FKs validate the complete graph when this fold commits.
  // A real operation-key collision aborts the transaction instead of discarding data.
  await tx`update public.learning_write_operations set family_id = ${destinationFamilyId} where family_id = ${sourceFamilyId}`;
  await tx`update public.planner_learning_activities set family_id = ${destinationFamilyId} where family_id = ${sourceFamilyId}`;
  await tx`update public.planner_learning_activity_children set family_id = ${destinationFamilyId} where family_id = ${sourceFamilyId}`;
  await tx`update public.planner_learning_activity_hours set family_id = ${destinationFamilyId} where family_id = ${sourceFamilyId}`;
  await tx`update public.hours_log set family_id = ${destinationFamilyId} where family_id = ${sourceFamilyId}`;

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
  if (lockedFold.artifactSchemaReady) {
    // Carry prefixes inherited by an earlier fold before the source family
    // cascade can remove their ownership rows.
    await tx`
      update public.family_artifact_prefixes
      set owner_family_id = ${destinationFamilyId}
      where owner_family_id = ${sourceFamilyId}
    `;
    await tx`
      insert into public.family_artifact_prefix_candidates as existing (
        owner_family_id,
        artifact_family_id,
        evidence_kind,
        evidence_count,
        observed_at
      )
      select
        ${destinationFamilyId},
        candidate.artifact_family_id,
        candidate.evidence_kind,
        candidate.evidence_count,
        candidate.observed_at
      from public.family_artifact_prefix_candidates candidate
      where candidate.owner_family_id = ${sourceFamilyId}
      on conflict (owner_family_id, artifact_family_id, evidence_kind)
      do update set
        evidence_count = existing.evidence_count + excluded.evidence_count,
        observed_at = least(existing.observed_at, excluded.observed_at)
    `;
    await tx`
      delete from public.family_artifact_prefix_candidates
      where owner_family_id = ${sourceFamilyId}
    `;
    // Record the source disposition before deleting it. Both statements remain
    // in one transaction, so readers can observe neither partial state.
    await tx`
      insert into public.family_artifact_prefixes (
        owner_family_id,
        artifact_family_id
      )
      values (${destinationFamilyId}, ${sourceFamilyId})
    `;
    await tx`
      select set_config('homa.family_delete_mode', 'family-fold-v2', true)
    `;
  }
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
  const lockedFold = await lockFamilyRowsForFold(
    tx,
    sourceFamilyId,
    destinationFamilyId,
    testHooks,
  );
  return lockedFold
    ? moveLockedFamilyDataIntoTx(
        tx,
        sourceFamilyId,
        destinationFamilyId,
        lockedFold,
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
  const lockedFold = await lockFamilyRowsForFold(
    tx,
    stubId,
    intoId,
    testHooks,
  );
  const stub = lockedFold?.rows.find((row) => row.id === stubId);
  if (
    !lockedFold ||
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
    lockedFold,
  );
}

export async function foldStubFamilyInto(stubId: string, intoId: string): Promise<boolean> {
  const sql = mapDb();
  return await sql.begin((tx) => foldStubFamilyIntoTx(tx, stubId, intoId));
}
