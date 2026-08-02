import type postgres from "postgres";

import { effectiveTimeZone, zonedDateString } from "../time-zone";
import { mapDb, type DbJson } from "../map/db";
import {
  CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY,
  buildChildReportCompatibilityUpdate,
  mapPostgresChildProgressOperationRow,
  mapPostgresProgressCheckInResponseRow,
  mapPostgresProgressCheckInRow,
  mapPostgresProgressConflictRow,
  mapPostgresProgressEvidenceRow,
  mapPostgresProgressSelectionResponseRow,
  runRepeatableReadOnlyProgressSnapshot,
  validatePostgresLiveProgressRow,
  type PostgresChildProgressOperationRow,
  type PostgresProgressCheckInResponseRow,
  type PostgresProgressCheckInRow,
  type PostgresProgressConflictRow,
  type PostgresProgressEvidenceRow,
  type PostgresProgressSelectionResponseRow,
  type PostgresLiveProgressRow,
} from "./postgres-repository-helpers";
import type {
  AppendChildObservationInput,
  AppendProgressEvidenceInput,
  BindProgressCheckInDeliveryInput,
  CancelProgressReplyLoopsInput,
  ChildObservationClassification,
  ChildProgressProjectionInput,
  ClaimChildProgressOperationInput,
  ClaimChildProgressOperationResult,
  CompareAndSwapProgressCheckInInput,
  CompleteProgressCheckInResponseInput,
  CompleteChildProgressOperationInput,
  FindProgressCheckInResponseReplayInput,
  InsertProgressCheckInBaselineSnapshotInput,
  InsertProgressCheckInInput,
  InsertProgressCheckInResponseInput,
  InsertProgressCheckInResponseResult,
  InsertProgressCheckInResult,
  InsertOpenProgressConflictInput,
  InsertMapWalkPromptInput,
  InsertMapWalkPromptResult,
  LoadActiveProgressCheckInInput,
  LockedProgressConflict,
  MarkChildObservationUsedInput,
  MarkChildObservationUsedResult,
  ProgressCheckInRepository,
  ProgressCheckInTransaction,
  ProgressConflictIdentity,
  StoredChildObservation,
  ResolveProgressConflictInput,
  SaveDerivedChildProgressInput,
  SaveProgressCompatibilityAnswersInput,
  ConsumeMapWalkPromptInput,
  StoredMapWalkPrompt,
  StoredProgressCheckInResponse,
  StoredProgressEvidence,
  SupersedeProgressEvidenceInput,
} from "./repository";
import type {
  ChildProgressView,
  OpenProgressConflict,
  ProgressCheckInRecord,
  ProgressConflict,
  ProgressSelectionAnswer,
  ResolvedProgressConflict,
} from "./types";
import {
  CHILD_ANSWER_SELECTION_PREFIX,
} from "./selection-answer";

// Shared by Next server code and Eve-authored server modules. index.ts keeps
// the Next-only marker; this adapter omits that package because Eve cannot
// bundle it. The mapDb dependency still keeps every execution path server-side.
type TransactionSql = postgres.TransactionSql;
type DatabaseSql = ReturnType<typeof mapDb>;
export type ChildProgressTestDatabaseFactory = () => DatabaseSql;
export interface ChildProgressPostgresTestHooks {
  afterInitialChildLock?: () => Promise<void>;
}

interface ChildRow {
  id: string;
  name: string;
  birth_date: string;
  time_zone: string | null;
  source_revision: string;
}

interface MapWalkPromptRow {
  id: string;
  child_id: string;
  family_id: string;
  subject_id: string;
  topic_id: string;
  sitting: number;
  source_revision: string;
  item_observed_at: string | null;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  terminal_reason:
    | "answered"
    | "expired"
    | "stale"
    | "stopped"
    | null;
  answer: StoredMapWalkPrompt["answer"];
  idempotency_key: string | null;
  payload_hash: string | null;
  result: unknown;
}

function mapWalkPromptRow(
  row: MapWalkPromptRow,
): StoredMapWalkPrompt {
  return {
    id: row.id,
    childId: row.child_id,
    familyId: row.family_id,
    subjectId: row.subject_id,
    topicId: row.topic_id,
    sitting: row.sitting,
    sourceRevision: BigInt(row.source_revision),
    itemObservedAt: row.item_observed_at,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    terminalReason: row.terminal_reason,
    answer: row.answer,
    idempotencyKey: row.idempotency_key,
    payloadHash: row.payload_hash,
    result: row.result,
  };
}

async function loadChildRow(
  sql: TransactionSql,
  familyId: string,
  childId: string,
  lockForUpdate: boolean,
): Promise<ChildRow | null> {
  const rows = lockForUpdate
    ? await sql<ChildRow[]>`
        select c.id, c.name,
               to_char(c.birth_month, 'YYYY-MM-DD') as birth_date,
               f.time_zone,
               coalesce(revision.revision, 0)::text
                 as source_revision
        from public.children c
        join public.families f
          on f.id = c.family_id
         and f.id = ${familyId}
        left join public.child_progress_revisions revision
          on revision.child_id = c.id
         and revision.family_id = c.family_id
        where c.id = ${childId}
          and c.family_id = ${familyId}
        for update of c
      `
    : await sql<ChildRow[]>`
        select c.id, c.name,
               to_char(c.birth_month, 'YYYY-MM-DD') as birth_date,
               f.time_zone,
               coalesce(revision.revision, 0)::text
                 as source_revision
        from public.children c
        join public.families f
          on f.id = c.family_id
         and f.id = ${familyId}
        left join public.child_progress_revisions revision
          on revision.child_id = c.id
         and revision.family_id = c.family_id
        where c.id = ${childId}
          and c.family_id = ${familyId}
      `;
  return rows[0] ?? null;
}

async function loadEvidenceRows(
  sql: TransactionSql,
  familyId: string,
  childId: string,
): Promise<StoredProgressEvidence[]> {
  const rows = await sql<PostgresProgressEvidenceRow[]>`
    select evidence.id, evidence.child_id, evidence.family_id,
           evidence.item_id, evidence.answer, evidence.derivation,
           evidence.source,
           evidence.member_user_id,
           member.display_name as current_adult_display_name,
           evidence.adult_display_name_snapshot,
           evidence.quote, evidence.channel, evidence.message_id,
           evidence.check_in_id, evidence.supersedes_id,
           case when evidence.superseded_at is null then null else
             to_char(
               evidence.superseded_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             )
           end as superseded_at,
           to_char(
             evidence.observed_at at time zone 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
           ) as observed_at,
           to_char(
             evidence.created_at at time zone 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
           ) as created_at,
           evidence.idempotency_key
    from public.child_progress_evidence evidence
    left join public.family_members member
      on member.family_id = evidence.family_id
     and member.family_id = ${familyId}
     and member.user_id = evidence.member_user_id
    where evidence.family_id = ${familyId}
      and evidence.child_id = ${childId}
    order by evidence.observed_at, evidence.created_at, evidence.id
  `;
  return rows.map(mapPostgresProgressEvidenceRow);
}

async function loadConflictRows(
  sql: TransactionSql,
  familyId: string,
  childId: string,
): Promise<ProgressConflict[]> {
  const rows = await sql<PostgresProgressConflictRow[]>`
    select conflict.id, conflict.child_id, conflict.family_id,
           conflict.item_id, conflict.evidence_id_a,
           conflict.evidence_id_b, conflict.state,
           conflict.resolved_answer, conflict.resolved_evidence_id,
           to_char(
             conflict.created_at at time zone 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
           ) as created_at,
           case when conflict.resolved_at is null then null else
             to_char(
               conflict.resolved_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             )
           end as resolved_at
    from public.child_progress_conflicts conflict
    where conflict.family_id = ${familyId}
      and conflict.child_id = ${childId}
    order by conflict.created_at, conflict.id
  `;
  return rows.map(mapPostgresProgressConflictRow);
}

async function loadSelectionResponses(
  sql: TransactionSql,
  familyId: string,
  childId: string,
): Promise<ProgressSelectionAnswer[]> {
  const rows = await sql<PostgresProgressSelectionResponseRow[]>`
    select selection.id, selection.evidence_id, selection.item_id,
           selection.answer,
           to_char(
             selection.answered_at at time zone 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
           ) as created_at
    from (
      select response.id::text as id, response.evidence_id,
             response.item_id, response.answer,
             response.created_at as answered_at
      from public.progress_check_in_responses response
      where response.family_id = ${familyId}
        and response.child_id = ${childId}

      union all

      select
        ${CHILD_ANSWER_SELECTION_PREFIX} || answer.child_id::text || ':' ||
          answer.question_id as id,
        exact_evidence.id as evidence_id,
        answer.question_id as item_id,
        answer.answer,
        answer.answered_at
      from public.child_answers answer
      join public.children child
        on child.id = answer.child_id
       and child.id = ${childId}
       and child.family_id = ${familyId}
      left join lateral (
        select evidence.id
        from public.child_progress_evidence evidence
        where evidence.child_id = answer.child_id
          and evidence.family_id = child.family_id
          and evidence.item_id = answer.question_id
          and evidence.answer = answer.answer
          and evidence.source =
            private.normalize_child_progress_source(answer.source)
          and evidence.observed_at = answer.answered_at
        order by evidence.superseded_at nulls first,
                 evidence.created_at desc, evidence.id desc
        limit 1
      ) exact_evidence on true
    ) selection
    order by selection.answered_at, selection.id
  `;
  return rows.map(mapPostgresProgressSelectionResponseRow);
}

async function loadFamilyCheckInRows(
  sql: TransactionSql,
  familyId: string,
): Promise<ProgressCheckInRecord[]> {
  const rows = await sql<PostgresProgressCheckInRow[]>`
    select check_in.id, check_in.child_id, child.name as child_name,
           check_in.family_id, check_in.purpose, check_in.scope,
           check_in.state, check_in.active_member_user_id,
           owner.display_name as active_member_display_name,
           check_in.prompt_recipient_member_user_id,
           recipient.display_name as prompt_recipient_display_name,
           check_in.revision, check_in.current_item_id,
           check_in.current_delivery_id, check_in.episode_id,
           check_in.pending_runtime_session_id,
           check_in.pending_turn_id,
           check_in.pause_reason,
           to_char(
             check_in.opened_at at time zone 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
           ) as opened_at,
           case when check_in.paused_at is null then null else
             to_char(
               check_in.paused_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             )
           end as paused_at,
           case when check_in.completed_at is null then null else
             to_char(
               check_in.completed_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             )
           end as completed_at,
           case when check_in.stopped_at is null then null else
             to_char(
               check_in.stopped_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             )
           end as stopped_at,
           to_char(
             check_in.updated_at at time zone 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
           ) as updated_at
    from public.progress_check_ins check_in
    join public.children child
      on child.id = check_in.child_id
     and child.family_id = check_in.family_id
     and child.family_id = ${familyId}
    left join public.family_members owner
      on owner.family_id = check_in.family_id
     and owner.user_id = check_in.active_member_user_id
    left join public.family_members recipient
      on recipient.family_id = check_in.family_id
     and recipient.user_id =
       check_in.prompt_recipient_member_user_id
    where check_in.family_id = ${familyId}
    order by check_in.updated_at desc, check_in.id
  `;
  return rows.map(mapPostgresProgressCheckInRow);
}

async function loadCheckInRow(
  sql: TransactionSql,
  familyId: string,
  checkInId: string,
  lockForUpdate: boolean,
): Promise<ProgressCheckInRecord | null> {
  const rows = lockForUpdate
    ? await sql<PostgresProgressCheckInRow[]>`
        select check_in.id, check_in.child_id,
               child.name as child_name, check_in.family_id,
               check_in.purpose, check_in.scope, check_in.state,
               check_in.active_member_user_id,
               owner.display_name as active_member_display_name,
               check_in.prompt_recipient_member_user_id,
               recipient.display_name
                 as prompt_recipient_display_name,
               check_in.revision, check_in.current_item_id,
               check_in.current_delivery_id, check_in.episode_id,
               check_in.pending_runtime_session_id,
               check_in.pending_turn_id,
               check_in.pause_reason,
               to_char(
                 check_in.opened_at at time zone 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
               ) as opened_at,
               case when check_in.paused_at is null then null else
                 to_char(
                   check_in.paused_at at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                 )
               end as paused_at,
               case when check_in.completed_at is null then null else
                 to_char(
                   check_in.completed_at at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                 )
               end as completed_at,
               case when check_in.stopped_at is null then null else
                 to_char(
                   check_in.stopped_at at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                 )
               end as stopped_at,
               to_char(
                 check_in.updated_at at time zone 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
               ) as updated_at
        from public.progress_check_ins check_in
        join public.children child
          on child.id = check_in.child_id
         and child.family_id = check_in.family_id
         and child.family_id = ${familyId}
        left join public.family_members owner
          on owner.family_id = check_in.family_id
         and owner.user_id = check_in.active_member_user_id
        left join public.family_members recipient
          on recipient.family_id = check_in.family_id
         and recipient.user_id =
           check_in.prompt_recipient_member_user_id
        where check_in.family_id = ${familyId}
          and check_in.id = ${checkInId}
        for update of check_in
      `
    : await sql<PostgresProgressCheckInRow[]>`
        select check_in.id, check_in.child_id,
               child.name as child_name, check_in.family_id,
               check_in.purpose, check_in.scope, check_in.state,
               check_in.active_member_user_id,
               owner.display_name as active_member_display_name,
               check_in.prompt_recipient_member_user_id,
               recipient.display_name
                 as prompt_recipient_display_name,
               check_in.revision, check_in.current_item_id,
               check_in.current_delivery_id, check_in.episode_id,
               check_in.pending_runtime_session_id,
               check_in.pending_turn_id,
               check_in.pause_reason,
               to_char(
                 check_in.opened_at at time zone 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
               ) as opened_at,
               case when check_in.paused_at is null then null else
                 to_char(
                   check_in.paused_at at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                 )
               end as paused_at,
               case when check_in.completed_at is null then null else
                 to_char(
                   check_in.completed_at at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                 )
               end as completed_at,
               case when check_in.stopped_at is null then null else
                 to_char(
                   check_in.stopped_at at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                 )
               end as stopped_at,
               to_char(
                 check_in.updated_at at time zone 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
               ) as updated_at
        from public.progress_check_ins check_in
        join public.children child
          on child.id = check_in.child_id
         and child.family_id = check_in.family_id
         and child.family_id = ${familyId}
        left join public.family_members owner
          on owner.family_id = check_in.family_id
         and owner.user_id = check_in.active_member_user_id
        left join public.family_members recipient
          on recipient.family_id = check_in.family_id
         and recipient.user_id =
           check_in.prompt_recipient_member_user_id
        where check_in.family_id = ${familyId}
          and check_in.id = ${checkInId}
      `;
  const row = rows[0];
  return row === undefined ? null : mapPostgresProgressCheckInRow(row);
}

async function lockNonterminalCheckInRowByChild(
  sql: TransactionSql,
  familyId: string,
  childId: string,
): Promise<ProgressCheckInRecord | null> {
  const rows = await sql<PostgresProgressCheckInRow[]>`
    select check_in.id, check_in.child_id, child.name as child_name,
           check_in.family_id, check_in.purpose, check_in.scope,
           check_in.state, check_in.active_member_user_id,
           owner.display_name as active_member_display_name,
           check_in.prompt_recipient_member_user_id,
           recipient.display_name as prompt_recipient_display_name,
           check_in.revision, check_in.current_item_id,
           check_in.current_delivery_id, check_in.episode_id,
           check_in.pending_runtime_session_id,
           check_in.pending_turn_id,
           check_in.pause_reason,
           to_char(
             check_in.opened_at at time zone 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
           ) as opened_at,
           case when check_in.paused_at is null then null else
             to_char(
               check_in.paused_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             )
           end as paused_at,
           case when check_in.completed_at is null then null else
             to_char(
               check_in.completed_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             )
           end as completed_at,
           case when check_in.stopped_at is null then null else
             to_char(
               check_in.stopped_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             )
           end as stopped_at,
           to_char(
             check_in.updated_at at time zone 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
           ) as updated_at
    from public.progress_check_ins check_in
    join public.children child
      on child.id = check_in.child_id
     and child.family_id = check_in.family_id
     and child.family_id = ${familyId}
    left join public.family_members owner
      on owner.family_id = check_in.family_id
     and owner.user_id = check_in.active_member_user_id
    left join public.family_members recipient
      on recipient.family_id = check_in.family_id
     and recipient.user_id =
       check_in.prompt_recipient_member_user_id
    where check_in.family_id = ${familyId}
      and check_in.child_id = ${childId}
      and check_in.state in ('active', 'paused')
    limit 1
    for update of check_in
  `;
  const row = rows[0];
  return row === undefined ? null : mapPostgresProgressCheckInRow(row);
}

async function loadCheckInResponseReplay(
  sql: TransactionSql,
  input: FindProgressCheckInResponseReplayInput,
): Promise<StoredProgressCheckInResponse | null> {
  const rows = await sql<PostgresProgressCheckInResponseRow[]>`
    select response.id, response.child_id, response.family_id,
           response.check_in_id, response.revision, response.item_id,
           response.answer, response.member_user_id,
           response.delivery_id, response.channel,
           response.provider_message_id,
           response.inbound_message_id, response.is_evidence,
           response.evidence_id, response.idempotency_key,
           response.result,
           to_char(
             response.created_at at time zone 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
           ) as created_at
    from public.progress_check_in_responses response
    where response.family_id = ${input.familyId}
      and (
        (
          response.check_in_id = ${input.checkInId}
          and response.idempotency_key = ${input.idempotencyKey}
        )
        or (
          ${input.providerMessageId}::text is not null
          and response.channel = ${input.channel}
          and response.provider_message_id =
            ${input.providerMessageId}
        )
      )
    order by response.created_at, response.id
    limit 1
  `;
  return rows[0] === undefined
    ? null
    : mapPostgresProgressCheckInResponseRow(rows[0]);
}

async function ensureAndLockSourceRevision(
  sql: TransactionSql,
  familyId: string,
  childId: string,
): Promise<string> {
  await sql`
    insert into public.child_progress_revisions (
      child_id, family_id, revision, updated_at
    )
    select child.id, child.family_id, 0, clock_timestamp()
    from public.children child
    where child.id = ${childId}
      and child.family_id = ${familyId}
    on conflict (child_id, family_id) do nothing
  `;
  const rows = await sql<{ revision: string }[]>`
    select revision.revision::text as revision
    from public.child_progress_revisions revision
    where revision.child_id = ${childId}
      and revision.family_id = ${familyId}
    for update
  `;
  if (rows[0] === undefined) {
    throw new Error("Progress revision lock lost its child scope");
  }
  return rows[0].revision;
}

async function loadProjectionInputWithSql(
  sql: TransactionSql,
  familyId: string,
  childId: string,
  lockForUpdate: boolean,
  testHooks?: ChildProgressPostgresTestHooks,
): Promise<ChildProgressProjectionInput | null> {
  let child = await loadChildRow(
    sql,
    familyId,
    childId,
    lockForUpdate,
  );
  if (child === null) return null;
  if (lockForUpdate) {
    await testHooks?.afterInitialChildLock?.();
  }
  let sourceRevision = child.source_revision;
  if (lockForUpdate) {
    sourceRevision = await ensureAndLockSourceRevision(
      sql,
      familyId,
      childId,
    );
    const reloadedChild = await loadChildRow(
      sql,
      familyId,
      childId,
      false,
    );
    if (reloadedChild === null) {
      throw new Error("Locked progress child disappeared");
    }
    child = reloadedChild;
  }
  const evidence = await loadEvidenceRows(sql, familyId, childId);
  const conflicts = await loadConflictRows(sql, familyId, childId);
  const selectionAnswers = await loadSelectionResponses(
    sql,
    familyId,
    childId,
  );
  return {
    child: {
      id: child.id,
      name: child.name,
      birthDate: child.birth_date,
    },
    familyId,
    timeZone: effectiveTimeZone(child.time_zone),
    sourceRevision: BigInt(sourceRevision),
    evidence,
    conflicts,
    selectionAnswers,
  };
}

class PostgresChildProgressTransaction
  implements ProgressCheckInTransaction
{
  constructor(
    private readonly sql: TransactionSql,
    private readonly testHooks: ChildProgressPostgresTestHooks,
  ) {}

  loadProjectionInputForUpdate(
    familyId: string,
    childId: string,
  ): Promise<ChildProgressProjectionInput | null> {
    return loadProjectionInputWithSql(
      this.sql,
      familyId,
      childId,
      true,
      this.testHooks,
    );
  }

  async appendEvidence(
    input: AppendProgressEvidenceInput,
  ): Promise<StoredProgressEvidence> {
    const rows = await this.sql<PostgresProgressEvidenceRow[]>`
      with inserted as (
        insert into public.child_progress_evidence (
          child_id, family_id, item_id, answer, derivation, source,
          member_user_id, quote, channel, message_id,
          provider_message_id,
          check_in_id, supersedes_id,
          observed_at, idempotency_key
        )
        select ${input.childId}, ${input.familyId}, ${input.itemId},
               ${input.answer}, ${input.derivation}, ${input.source},
               ${input.memberUserId},
               ${input.quote}, ${input.channel ?? null},
               ${input.messageId ?? null},
               ${input.providerMessageId ?? null},
               ${input.checkInId}, ${input.supersedesId},
               ${input.observedAt}, ${input.idempotencyKey}
        where exists (
          select 1
          from public.children child
          where child.id = ${input.childId}
            and child.family_id = ${input.familyId}
        )
        returning *
      )
      select inserted.id, inserted.child_id, inserted.family_id,
             inserted.item_id, inserted.answer,
             inserted.derivation, inserted.source,
             inserted.member_user_id,
             member.display_name as current_adult_display_name,
             inserted.adult_display_name_snapshot,
             inserted.quote, inserted.channel, inserted.message_id,
             inserted.check_in_id, inserted.supersedes_id,
             case when inserted.superseded_at is null then null else
               to_char(
                 inserted.superseded_at at time zone 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
               )
             end as superseded_at,
             to_char(
               inserted.observed_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             ) as observed_at,
             to_char(
               inserted.created_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             ) as created_at,
             inserted.idempotency_key
      from inserted
      left join public.family_members member
        on member.family_id = inserted.family_id
       and member.family_id = ${input.familyId}
       and member.user_id = inserted.member_user_id
    `;
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Progress evidence child scope changed");
    }
    return mapPostgresProgressEvidenceRow(row);
  }

  async appendObservation(
    input: AppendChildObservationInput,
  ): Promise<StoredChildObservation> {
    const rows = await this.sql<
      {
        id: string;
        child_id: string;
        family_id: string;
        classification: ChildObservationClassification;
        status: "new" | "used";
        created_at: string;
      }[]
    >`
      insert into public.child_observations (
        child_id, family_id, member_user_id, quote, channel,
        message_id, classification, candidates, subject_hints,
        observed_at
      )
      select ${input.childId}, ${input.familyId},
             ${input.memberUserId}, ${input.quote},
             ${input.channel}, ${input.messageId},
             ${input.classification},
             ${this.sql.json(
               input.candidates.map((candidate) => ({
                 itemId: candidate.itemId,
                 score: candidate.score,
               })),
             )},
             ${[...input.subjectHints]},
             ${input.observedAt}
      where exists (
        select 1
        from public.children child
        where child.id = ${input.childId}
          and child.family_id = ${input.familyId}
      )
      returning id, child_id, family_id, classification, status,
                to_char(
                  created_at at time zone 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                ) as created_at
    `;
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Child observation scope changed");
    }
    return {
      id: row.id,
      childId: row.child_id,
      familyId: row.family_id,
      classification: row.classification,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  async claimOperation(
    input: ClaimChildProgressOperationInput,
  ): Promise<ClaimChildProgressOperationResult> {
    const inserted = await this.sql<
      PostgresChildProgressOperationRow[]
    >`
      insert into public.child_progress_operations (
        child_id, family_id, idempotency_key, payload_hash, status,
        evidence_ids, affected_item_ids, conflict_ids, result
      )
      select ${input.childId}, ${input.familyId},
             ${input.idempotencyKey}, ${input.payloadHash}, 'pending',
             '{}'::uuid[], '{}'::text[], '{}'::uuid[],
             ${this.sql.json({ status: "pending" })}
      where exists (
        select 1
        from public.children child
        where child.id = ${input.childId}
          and child.family_id = ${input.familyId}
      )
      on conflict (child_id, family_id, idempotency_key)
      do nothing
      returning id, child_id, family_id, idempotency_key, payload_hash,
                status, evidence_ids, affected_item_ids, conflict_ids,
                result,
                to_char(
                  created_at at time zone 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                ) as created_at
    `;
    if (inserted[0] !== undefined) {
      return {
        kind: "claimed",
        receipt: mapPostgresChildProgressOperationRow(inserted[0]),
      };
    }
    const existing = await this.sql<
      PostgresChildProgressOperationRow[]
    >`
      select operation.id, operation.child_id, operation.family_id,
             operation.idempotency_key, operation.payload_hash,
             operation.status, operation.evidence_ids,
             operation.affected_item_ids, operation.conflict_ids,
             operation.result,
             to_char(
               operation.created_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             ) as created_at
      from public.child_progress_operations operation
      where operation.child_id = ${input.childId}
        and operation.family_id = ${input.familyId}
        and operation.idempotency_key = ${input.idempotencyKey}
      limit 1
    `;
    if (existing[0] === undefined) {
      throw new Error("Progress operation claim lost its child scope");
    }
    return {
      kind: "existing",
      receipt: mapPostgresChildProgressOperationRow(existing[0]),
    };
  }

  async completeOperation(
    input: CompleteChildProgressOperationInput,
  ) {
    const rows = await this.sql<
      PostgresChildProgressOperationRow[]
    >`
      update public.child_progress_operations operation
      set status = ${input.status},
          evidence_ids =
            ${this.sql.array(input.evidenceIds)}::uuid[],
          affected_item_ids =
            ${this.sql.array(input.affectedItemIds)}::text[],
          conflict_ids =
            ${this.sql.array(input.conflictIds)}::uuid[],
          result = ${this.sql.json(input.result as DbJson)}
      where operation.child_id = ${input.childId}
        and operation.family_id = ${input.familyId}
        and operation.idempotency_key = ${input.idempotencyKey}
        and operation.payload_hash = ${input.payloadHash}
        and operation.status = 'pending'
      returning id, child_id, family_id, idempotency_key, payload_hash,
                status, evidence_ids, affected_item_ids, conflict_ids,
                result,
                to_char(
                  created_at at time zone 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                ) as created_at
    `;
    if (rows[0] === undefined) {
      throw new Error("Progress operation completion lost its claim");
    }
    return mapPostgresChildProgressOperationRow(rows[0]);
  }

  async loadSourceRevision(
    familyId: string,
    childId: string,
  ): Promise<bigint> {
    const rows = await this.sql<{ revision: string }[]>`
      select revision.revision::text as revision
      from public.child_progress_revisions revision
      where revision.child_id = ${childId}
        and revision.family_id = ${familyId}
      for update
    `;
    if (rows[0] === undefined) {
      throw new Error("Progress revision child scope changed");
    }
    return BigInt(rows[0].revision);
  }

  async supersedeEvidence(
    input: SupersedeProgressEvidenceInput,
  ): Promise<void> {
    const rows = await this.sql<{ id: string }[]>`
      update public.child_progress_evidence evidence
      set superseded_at = ${input.supersededAt}
      where evidence.id = ${input.evidenceId}
        and evidence.family_id = ${input.familyId}
        and evidence.child_id = ${input.childId}
        and evidence.superseded_at is null
      returning evidence.id
    `;
    if (rows.length !== 1) {
      throw new Error("Progress evidence supersession lost its scope");
    }
  }

  async insertOpenConflict(
    input: InsertOpenProgressConflictInput,
  ): Promise<OpenProgressConflict> {
    const rows = await this.sql<PostgresProgressConflictRow[]>`
      insert into public.child_progress_conflicts (
        child_id, family_id, item_id, evidence_id_a, evidence_id_b,
        created_at
      )
      select ${input.childId}, ${input.familyId}, ${input.itemId},
             ${input.evidenceIdA}, ${input.evidenceIdB},
             ${input.openedAt}
      where exists (
        select 1
        from public.children child
        where child.id = ${input.childId}
          and child.family_id = ${input.familyId}
      )
      returning id, child_id, family_id, item_id, evidence_id_a,
                evidence_id_b, state, resolved_answer,
                resolved_evidence_id,
                to_char(
                  created_at at time zone 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                ) as created_at,
                case when resolved_at is null then null else
                  to_char(
                    resolved_at at time zone 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                  )
                end as resolved_at
    `;
    const conflict = rows[0] === undefined
      ? undefined
      : mapPostgresProgressConflictRow(rows[0]);
    if (conflict === undefined || conflict.state !== "open") {
      throw new Error("Progress conflict child scope changed");
    }
    return conflict;
  }

  async saveCompatibilityAnswers(
    input: SaveProgressCompatibilityAnswersInput,
  ): Promise<void> {
    for (const compatibilityAnswer of input.compatibilityAnswers) {
      if (compatibilityAnswer.kind === "delete") {
        await this.sql`
          delete from public.child_answers answer
          where answer.child_id = ${input.childId}
            and answer.question_id = ${compatibilityAnswer.itemId}
            and exists (
              select 1
              from public.children child
              where child.id = ${input.childId}
                and child.family_id = ${input.familyId}
            )
        `;
      } else {
        await this.sql`
          insert into public.child_answers (
            child_id, question_id, answer, source, answered_at
          )
          select ${input.childId}, ${compatibilityAnswer.itemId},
                 ${compatibilityAnswer.answer},
                 ${compatibilityAnswer.source},
                 ${compatibilityAnswer.observedAt}
          where exists (
            select 1
            from public.children child
            where child.id = ${input.childId}
              and child.family_id = ${input.familyId}
          )
          on conflict (child_id, question_id) do update
          set answer = excluded.answer,
              source = excluded.source,
              answered_at = excluded.answered_at
        `;
      }
    }
  }

  async saveDerivedProgress(
    input: SaveDerivedChildProgressInput,
  ): Promise<void> {
    const liveRows = await this.sql<{ child_id: string }[]>`
      insert into public.child_progress_live (
        child_id, family_id, projection, scores, bank_version,
        projection_version, projection_date, source_revision,
        evidence_count,
        open_conflict_count, projected_at, updated_at
      )
      select ${input.childId}, ${input.familyId},
             ${this.sql.json(input.view as unknown as DbJson)},
             ${this.sql.json(input.view.scores as unknown as DbJson)},
             ${input.bankVersion}, ${input.projectionVersion},
             ${input.projectionDate},
             ${input.sourceRevision.toString()}::bigint,
             ${input.evidenceCount},
             ${input.openConflictCount}, ${input.view.projectedAt},
             ${input.view.projectedAt}
      where exists (
        select 1
        from public.children child
        where child.id = ${input.childId}
          and child.family_id = ${input.familyId}
      )
      on conflict (child_id) do update
      set projection = excluded.projection,
          scores = excluded.scores,
          bank_version = excluded.bank_version,
          projection_version = excluded.projection_version,
          projection_date = excluded.projection_date,
          source_revision = excluded.source_revision,
          evidence_count = excluded.evidence_count,
          open_conflict_count = excluded.open_conflict_count,
          projected_at = excluded.projected_at,
          updated_at = excluded.updated_at
      where child_progress_live.family_id = excluded.family_id
      returning child_id
    `;
    if (liveRows.length !== 1) {
      throw new Error("Live progress child scope changed");
    }

    const reportUpdate =
      buildChildReportCompatibilityUpdate(input);
    await this.sql`
      update public.child_reports report
      set scores = ${this.sql.json(
        reportUpdate.scores as unknown as DbJson,
      )},
          bank_version = ${reportUpdate.bankVersion},
          scorer_version = ${reportUpdate.scorerVersion},
          scored_birth_date = ${reportUpdate.scoredBirthDate},
          scored_age_months = ${reportUpdate.scoredAgeMonths},
          generated_at = ${reportUpdate.generatedAt},
          updated_at = ${reportUpdate.updatedAt},
          narrative = ${reportUpdate.narrative},
          narrative_meta = ${reportUpdate.narrativeMeta}
      where report.child_id = ${input.childId}
        and exists (
          select 1
          from public.children child
          where child.id = ${input.childId}
            and child.family_id = ${input.familyId}
        )
    `;
    await this.sql`
      update public.families family
      set updated_at = ${input.view.projectedAt}
      where family.id in (
        select scoped_family.id
        from public.families scoped_family
        where scoped_family.id = ${input.familyId}
          and exists (
            select 1
            from public.children child
            where child.id = ${input.childId}
              and child.family_id = ${input.familyId}
          )
        for update skip locked
        )
    `;
  }

  async insertOrLoadActiveMapWalkPrompt(
    input: InsertMapWalkPromptInput,
  ): Promise<InsertMapWalkPromptResult> {
    const rows = await this.sql<MapWalkPromptRow[]>`
      insert into public.map_walk_prompts (
        id, child_id, family_id, subject_id, topic_id, sitting,
        source_revision, item_observed_at, created_at, expires_at
      )
      values (
        ${input.id}, ${input.childId}, ${input.familyId},
        ${input.subjectId}, ${input.topicId}, ${input.sitting},
        ${input.sourceRevision.toString()}::bigint,
        ${input.itemObservedAt}, ${input.createdAt}, ${input.expiresAt}
      )
      on conflict (
        child_id, family_id, subject_id
      ) where consumed_at is null
      do nothing
      returning id, child_id, family_id, subject_id, topic_id,
                sitting, source_revision::text as source_revision,
                case when item_observed_at is null then null else
                  to_char(
                    item_observed_at at time zone 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                  )
                end as item_observed_at,
                to_char(
                  created_at at time zone 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                ) as created_at,
                to_char(
                  expires_at at time zone 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                ) as expires_at,
                null::text as consumed_at,
                null::text as terminal_reason,
                answer, idempotency_key,
                payload_hash, result
    `;
    if (rows[0]) {
      return {
        kind: "inserted",
        prompt: mapWalkPromptRow(rows[0]),
      };
    }
    const existing = await this.sql<MapWalkPromptRow[]>`
      select prompt.id, prompt.child_id, prompt.family_id,
             prompt.subject_id, prompt.topic_id, prompt.sitting,
             prompt.source_revision::text as source_revision,
             case when prompt.item_observed_at is null then null else
               to_char(
                 prompt.item_observed_at at time zone 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
               )
             end as item_observed_at,
             to_char(
               prompt.created_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             ) as created_at,
             to_char(
               prompt.expires_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             ) as expires_at,
             null::text as consumed_at,
             null::text as terminal_reason, prompt.answer,
             prompt.idempotency_key, prompt.payload_hash, prompt.result
      from public.map_walk_prompts prompt
      where prompt.child_id = ${input.childId}
        and prompt.family_id = ${input.familyId}
        and prompt.subject_id = ${input.subjectId}
        and prompt.consumed_at is null
      for update
    `;
    if (!existing[0]) {
      throw new Error("Active map walk prompt conflict disappeared");
    }
    return {
      kind: "existing",
      prompt: mapWalkPromptRow(existing[0]),
    };
  }

  async lockMapWalkPrompt(
    familyId: string,
    childId: string,
    promptId: string,
  ): Promise<StoredMapWalkPrompt | null> {
    const rows = await this.sql<MapWalkPromptRow[]>`
      select prompt.id, prompt.child_id, prompt.family_id,
             prompt.subject_id, prompt.topic_id, prompt.sitting,
             prompt.source_revision::text as source_revision,
             case when prompt.item_observed_at is null then null else
               to_char(
                 prompt.item_observed_at at time zone 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
               )
             end as item_observed_at,
             to_char(
               prompt.created_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             ) as created_at,
             to_char(
               prompt.expires_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             ) as expires_at,
             case when prompt.consumed_at is null then null else
               to_char(
                 prompt.consumed_at at time zone 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
               )
             end as consumed_at,
             prompt.terminal_reason, prompt.answer,
             prompt.idempotency_key,
             prompt.payload_hash, prompt.result
      from public.map_walk_prompts prompt
      where prompt.id = ${promptId}
        and prompt.child_id = ${childId}
        and prompt.family_id = ${familyId}
      for update
    `;
    return rows[0] ? mapWalkPromptRow(rows[0]) : null;
  }

  async consumeMapWalkPrompt(
    input: ConsumeMapWalkPromptInput,
  ): Promise<void> {
    const rows = await this.sql<{ id: string }[]>`
      update public.map_walk_prompts prompt
      set consumed_at = ${input.consumedAt},
          terminal_reason = ${input.terminalReason},
          answer = ${input.answer},
          idempotency_key = ${input.idempotencyKey},
          payload_hash = ${input.payloadHash},
          result = ${this.sql.json(input.result as DbJson)}
      where prompt.id = ${input.promptId}
        and prompt.child_id = ${input.childId}
        and prompt.family_id = ${input.familyId}
        and prompt.consumed_at is null
      returning prompt.id
    `;
    if (rows.length !== 1) {
      throw new Error("Map walk prompt consumption lost its lock");
    }
  }

  async loadOperation(
    familyId: string,
    childId: string,
    idempotencyKey: string,
  ) {
    const rows = await this.sql<
      PostgresChildProgressOperationRow[]
    >`
      select operation.id, operation.child_id, operation.family_id,
             operation.idempotency_key, operation.payload_hash,
             operation.status, operation.evidence_ids,
             operation.affected_item_ids, operation.conflict_ids,
             operation.result,
             to_char(
               operation.created_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             ) as created_at
      from public.child_progress_operations operation
      where operation.child_id = ${childId}
        and operation.family_id = ${familyId}
        and operation.idempotency_key = ${idempotencyKey}
      limit 1
    `;
    return rows[0] === undefined
      ? null
      : mapPostgresChildProgressOperationRow(rows[0]);
  }

  async findOperationById(
    familyId: string,
    operationId: string,
  ) {
    const rows = await this.sql<
      PostgresChildProgressOperationRow[]
    >`
      select operation.id, operation.child_id, operation.family_id,
             operation.idempotency_key, operation.payload_hash,
             operation.status, operation.evidence_ids,
             operation.affected_item_ids, operation.conflict_ids,
             operation.result,
             to_char(
               operation.created_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             ) as created_at
      from public.child_progress_operations operation
      where operation.id = ${operationId}
        and operation.family_id = ${familyId}
      limit 1
    `;
    return rows[0] === undefined
      ? null
      : mapPostgresChildProgressOperationRow(rows[0]);
  }

  async findProgressEvidence(
    familyId: string,
    evidenceId: string,
  ) {
    const rows = await this.sql<
      { child_id: string; family_id: string }[]
    >`
      select evidence.child_id, evidence.family_id
      from public.child_progress_evidence evidence
      where evidence.id = ${evidenceId}
        and evidence.family_id = ${familyId}
      limit 1
    `;
    return rows[0] === undefined
      ? null
      : {
          childId: rows[0].child_id,
          familyId: rows[0].family_id,
        };
  }

  async lockFamilyMemberForKeyShare(
    familyId: string,
    memberUserId: string,
  ): Promise<boolean> {
    const authRows = await this.sql<{ id: string }[]>`
      select actor.id
      from auth.users actor
      where actor.id = ${memberUserId}
      for key share
    `;
    if (authRows.length !== 1) return false;
    const rows = await this.sql<{ user_id: string }[]>`
      select member.user_id
      from public.family_members member
      where member.family_id = ${familyId}
        and member.user_id = ${memberUserId}
      for key share
    `;
    return rows.length === 1;
  }

  findCheckIn(
    familyId: string,
    checkInId: string,
  ): Promise<ProgressCheckInRecord | null> {
    return loadCheckInRow(
      this.sql,
      familyId,
      checkInId,
      false,
    );
  }

  lockCheckIn(
    familyId: string,
    childId: string,
    checkInId: string,
  ): Promise<ProgressCheckInRecord | null> {
    return loadCheckInRow(
      this.sql,
      familyId,
      checkInId,
      true,
    ).then((checkIn) =>
      checkIn?.childId === childId ? checkIn : null
    );
  }

  lockNonterminalCheckInByChild(
    familyId: string,
    childId: string,
  ): Promise<ProgressCheckInRecord | null> {
    return lockNonterminalCheckInRowByChild(
      this.sql,
      familyId,
      childId,
    );
  }

  async insertCheckIn(
    input: InsertProgressCheckInInput,
  ): Promise<InsertProgressCheckInResult> {
    const inserted = await this.sql<{ id: string }[]>`
      insert into public.progress_check_ins (
        child_id, family_id, idempotency_key, purpose, scope, state,
        active_member_user_id, prompt_recipient_member_user_id,
        revision, current_item_id, current_delivery_id, episode_id,
        pending_runtime_session_id, pending_turn_id,
        pause_reason, opened_at, paused_at, completed_at, stopped_at,
        updated_at
      )
      select ${input.childId}, ${input.familyId},
             ${input.idempotencyKey}, ${input.purpose},
             ${this.sql.json(input.scope as unknown as DbJson)},
             'active', ${input.ownerMemberUserId},
             ${input.recipientMemberUserId}, 1,
             ${input.currentItemId}, null, ${input.episodeId},
             ${input.pendingRuntimeSessionId}, ${input.pendingTurnId},
             null, ${input.openedAt}, null, null, null,
             ${input.openedAt}
      where exists (
        select 1
        from public.children child
        where child.id = ${input.childId}
          and child.family_id = ${input.familyId}
          and child.name = ${input.childName}
      )
      on conflict do nothing
      returning id
    `;
    const insertedId = inserted[0]?.id;
    if (insertedId !== undefined) {
      const checkIn = await loadCheckInRow(
        this.sql,
        input.familyId,
        insertedId,
        true,
      );
      if (checkIn === null) {
        throw new Error("Inserted check-in left its family scope");
      }
      return { kind: "inserted", checkIn };
    }

    const nonterminal = await lockNonterminalCheckInRowByChild(
      this.sql,
      input.familyId,
      input.childId,
    );
    if (nonterminal !== null) {
      return { kind: "existing", checkIn: nonterminal };
    }
    const idempotentRows = await this.sql<{ id: string }[]>`
      select check_in.id
      from public.progress_check_ins check_in
      where check_in.child_id = ${input.childId}
        and check_in.family_id = ${input.familyId}
        and check_in.idempotency_key = ${input.idempotencyKey}
      limit 1
      for update
    `;
    const idempotentId = idempotentRows[0]?.id;
    if (idempotentId === undefined) {
      throw new Error("Check-in insert lost its child scope");
    }
    const checkIn = await loadCheckInRow(
      this.sql,
      input.familyId,
      idempotentId,
      true,
    );
    if (checkIn === null) {
      throw new Error("Idempotent check-in left its family scope");
    }
    return { kind: "existing", checkIn };
  }

  async compareAndSwapCheckIn(
    input: CompareAndSwapProgressCheckInInput,
  ): Promise<ProgressCheckInRecord | null> {
    const rows = await this.sql<{ id: string }[]>`
      update public.progress_check_ins check_in
      set state = ${input.next.state},
          active_member_user_id =
            ${input.next.ownerMemberUserId},
          prompt_recipient_member_user_id =
            ${input.next.recipientMemberUserId},
          revision = check_in.revision + 1,
          current_item_id = ${input.next.currentItemId},
          current_delivery_id =
            ${input.next.currentDeliveryId},
          episode_id = ${input.next.episodeId},
          pending_runtime_session_id =
            ${input.next.pendingRuntimeSessionId},
          pending_turn_id = ${input.next.pendingTurnId},
          pause_reason = ${input.next.pauseReason},
          paused_at = ${input.next.pausedAt},
          completed_at = ${input.next.completedAt},
          stopped_at = ${input.next.stoppedAt},
          updated_at = ${input.next.updatedAt}
      where check_in.id = ${input.checkInId}
        and check_in.child_id = ${input.childId}
        and check_in.family_id = ${input.familyId}
        and check_in.revision = ${input.expectedRevision}
      returning check_in.id
    `;
    if (rows[0] === undefined) return null;
    return loadCheckInRow(
      this.sql,
      input.familyId,
      rows[0].id,
      true,
    );
  }

  async cancelProgressReplyLoops(
    input: CancelProgressReplyLoopsInput,
  ): Promise<number> {
    const exactCurrentPrompt =
      input.keepRevision === null
        ? null
        : `progress-check-in:${input.checkInId}:revision:${input.keepRevision}`;
    const rows = await this.sql<{ id: string }[]>`
      update public.conversation_open_loops loop
      set state = 'cancelled'
      where loop.family_id = ${input.familyId}
        and loop.state = 'open'
        and loop.prompt_key like
          ${`progress-check-in:${input.checkInId}:revision:%`}
        and (
          ${input.keepDeliveryId}::uuid is null
          or loop.delivery_id <> ${input.keepDeliveryId}
          or loop.prompt_key <> ${exactCurrentPrompt}
        )
      returning loop.id
    `;
    return rows.length;
  }

  findCheckInResponseReplay(
    input: FindProgressCheckInResponseReplayInput,
  ): Promise<StoredProgressCheckInResponse | null> {
    return loadCheckInResponseReplay(this.sql, input);
  }

  async insertCheckInResponse(
    input: InsertProgressCheckInResponseInput,
  ): Promise<InsertProgressCheckInResponseResult> {
    const rows = await this.sql<
      PostgresProgressCheckInResponseRow[]
    >`
      insert into public.progress_check_in_responses (
        child_id, family_id, check_in_id, revision, item_id, answer,
        member_user_id, delivery_id, channel, provider_message_id,
        inbound_message_id,
        is_evidence, evidence_id, idempotency_key, result, created_at
      )
      select ${input.childId}, ${input.familyId}, ${input.checkInId},
             ${input.revision}, ${input.itemId}, ${input.answer},
             ${input.memberUserId}, ${input.deliveryId},
             ${input.channel}, ${input.providerMessageId},
             ${input.inboundMessageId ?? null},
             false, null, ${input.idempotencyKey},
             ${this.sql.json({ status: "pending" })},
             ${input.createdAt}
      from public.progress_check_ins check_in
      where check_in.id = ${input.checkInId}
        and check_in.child_id = ${input.childId}
        and check_in.family_id = ${input.familyId}
        and check_in.revision = ${input.revision}
        and check_in.state = 'active'
        and check_in.current_item_id = ${input.itemId}
        and check_in.prompt_recipient_member_user_id
          is not distinct from ${input.memberUserId}::uuid
        and check_in.current_delivery_id
          is not distinct from ${input.deliveryId}::uuid
      on conflict do nothing
      returning id, child_id, family_id, check_in_id, revision,
                item_id, answer, member_user_id, delivery_id, channel,
                provider_message_id, inbound_message_id,
                is_evidence, evidence_id,
                idempotency_key, result,
                to_char(
                  created_at at time zone 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                ) as created_at
    `;
    if (rows[0] !== undefined) {
      return {
        kind: "inserted",
        response:
          mapPostgresProgressCheckInResponseRow(rows[0]),
      };
    }
    const duplicate = await loadCheckInResponseReplay(
      this.sql,
      input,
    );
    if (duplicate === null) {
      throw new Error(
        "Check-in response insert lost its validated prompt",
      );
    }
    return { kind: "duplicate", response: duplicate };
  }

  async completeCheckInResponse(
    input: CompleteProgressCheckInResponseInput,
  ): Promise<void> {
    const rows = await this.sql<{ id: string }[]>`
      update public.progress_check_in_responses response
      set is_evidence = ${input.evidenceId !== null},
          evidence_id = ${input.evidenceId},
          result =
            ${this.sql.json(input.result as DbJson)}
      where response.id = ${input.responseId}
        and response.check_in_id = ${input.checkInId}
        and response.child_id = ${input.childId}
        and response.family_id = ${input.familyId}
        and response.result ->> 'status' = 'pending'
      returning response.id
    `;
    if (rows.length !== 1) {
      throw new Error("Check-in response completion lost its scope");
    }
  }

  async insertCheckInBaselineSnapshot(
    input: InsertProgressCheckInBaselineSnapshotInput,
  ): Promise<"inserted" | "existing"> {
    const rows = await this.sql<{ id: string }[]>`
      insert into public.child_progress_snapshots (
        child_id, family_id, snapshot_kind, check_in_id,
        evidence_ids, age_months, bank_version, scorer_version,
        projection, scores, created_at
      )
      select ${input.childId}, ${input.familyId}, 'check_in_group',
             ${input.checkInId},
             ${this.sql.array(input.evidenceIds)}::uuid[],
             ${input.ageMonths}, ${input.bankVersion},
             ${input.scorerVersion},
             ${this.sql.json(
               input.projection as unknown as DbJson,
             )},
             ${this.sql.json(
               input.projection.scores as unknown as DbJson,
             )},
             ${input.createdAt}
      where exists (
        select 1
        from public.progress_check_ins check_in
        where check_in.id = ${input.checkInId}
          and check_in.child_id = ${input.childId}
          and check_in.family_id = ${input.familyId}
      )
      on conflict (check_in_id)
        where check_in_id is not null
          and snapshot_kind = 'check_in_group'
      do nothing
      returning id
    `;
    return rows[0] === undefined ? "existing" : "inserted";
  }

  async findProgressConflict(
    familyId: string,
    conflictId: string,
  ): Promise<ProgressConflictIdentity | null> {
    const rows = await this.sql<ProgressConflictIdentity[]>`
      select conflict.child_id as "childId",
             conflict.family_id as "familyId"
      from public.child_progress_conflicts conflict
      where conflict.id = ${conflictId}
        and conflict.family_id = ${familyId}
      limit 1
    `;
    return rows[0] ?? null;
  }

  async lockProgressConflict(
    familyId: string,
    childId: string,
    conflictId: string,
  ): Promise<LockedProgressConflict | null> {
    const rows = await this.sql<PostgresProgressConflictRow[]>`
      select conflict.id, conflict.child_id, conflict.family_id,
             conflict.item_id, conflict.evidence_id_a,
             conflict.evidence_id_b, conflict.state,
             conflict.resolved_answer,
             conflict.resolved_evidence_id,
             to_char(
               conflict.created_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             ) as created_at,
             case when conflict.resolved_at is null then null else
               to_char(
                 conflict.resolved_at at time zone 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
               )
             end as resolved_at
      from public.child_progress_conflicts conflict
      where conflict.id = ${conflictId}
        and conflict.child_id = ${childId}
        and conflict.family_id = ${familyId}
      for update
    `;
    const row = rows[0];
    if (row === undefined) return null;
    const evidence = await loadEvidenceRows(
      this.sql,
      familyId,
      childId,
    );
    const evidenceA = evidence.find(
      (candidate) => candidate.id === row.evidence_id_a,
    );
    const evidenceB = evidence.find(
      (candidate) => candidate.id === row.evidence_id_b,
    );
    if (evidenceA === undefined || evidenceB === undefined) {
      throw new Error("Locked conflict is missing exact evidence");
    }
    return {
      conflict: mapPostgresProgressConflictRow(row),
      evidenceA,
      evidenceB,
    };
  }

  async resolveProgressConflict(
    input: ResolveProgressConflictInput,
  ): Promise<ResolvedProgressConflict | null> {
    const rows = await this.sql<PostgresProgressConflictRow[]>`
      update public.child_progress_conflicts conflict
      set state = 'resolved',
          resolved_answer = ${input.answer},
          resolved_evidence_id = ${input.evidenceId},
          resolved_by_member_user_id =
            ${input.resolverMemberUserId},
          resolved_at = ${input.resolvedAt}
      where conflict.id = ${input.conflictId}
        and conflict.child_id = ${input.childId}
        and conflict.family_id = ${input.familyId}
        and conflict.state = 'open'
        and exists (
          select 1
          from public.child_progress_evidence evidence
          where evidence.id = ${input.evidenceId}
            and evidence.child_id = ${input.childId}
            and evidence.family_id = ${input.familyId}
            and evidence.item_id = conflict.item_id
            and evidence.answer = ${input.answer}
            and evidence.id in (
              conflict.evidence_id_a,
              conflict.evidence_id_b
            )
        )
      returning id, child_id, family_id, item_id, evidence_id_a,
                evidence_id_b, state, resolved_answer,
                resolved_evidence_id,
                to_char(
                  created_at at time zone 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                ) as created_at,
                to_char(
                  resolved_at at time zone 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                ) as resolved_at
    `;
    if (rows[0] === undefined) return null;
    const conflict = mapPostgresProgressConflictRow(rows[0]);
    if (conflict.state !== "resolved") {
      throw new Error("Resolved conflict returned an open row");
    }
    return conflict;
  }

  async bindCurrentCheckInDelivery(
    input: BindProgressCheckInDeliveryInput,
  ): Promise<ProgressCheckInRecord | null> {
    const rows = await this.sql<{ id: string }[]>`
      update public.progress_check_ins check_in
      set current_delivery_id = ${input.deliveryId},
          episode_id = ${input.episodeId},
          updated_at = ${input.updatedAt}
      where check_in.id = ${input.checkInId}
        and check_in.child_id = ${input.childId}
        and check_in.family_id = ${input.familyId}
        and check_in.revision = ${input.expectedRevision}
        and check_in.state = 'active'
        and check_in.pending_runtime_session_id =
          ${input.runtimeSessionId}
        and check_in.pending_turn_id = ${input.turnId}
        and exists (
          select 1
          from public.conversation_deliveries delivery
          where delivery.id = ${input.deliveryId}
            and delivery.family_id = ${input.familyId}
            and delivery.recipient_member_user_id
              is not distinct from
                check_in.prompt_recipient_member_user_id
            and delivery.status = 'sent'
            and delivery.replied_at is null
        )
      returning check_in.id
    `;
    if (rows[0] === undefined) return null;
    return loadCheckInRow(
      this.sql,
      input.familyId,
      rows[0].id,
      true,
    );
  }
}

/**
 * Postgres adapter for the server-only ChildProgress repository seam.
 */
export class PostgresChildProgressRepository
  implements ProgressCheckInRepository
{
  /**
   * The injectable database factory is the credential-free Task 10 test seam.
   * Production callers use mapDb; local integration tests provide a temp DB.
   */
  constructor(
    private readonly getDatabase: ChildProgressTestDatabaseFactory =
      mapDb,
    private readonly testHooks: ChildProgressPostgresTestHooks = {},
  ) {}

  async withTransaction<T>(
    operation: (
      transaction: ProgressCheckInTransaction,
    ) => Promise<T>,
  ): Promise<T> {
    const sql = this.getDatabase();
    const wrapped = await sql.begin(async (transactionSql) => {
      await transactionSql`
        select pg_advisory_xact_lock_shared(
          ${CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY}::bigint
        )
      `;
      return {
        value: await operation(
        new PostgresChildProgressTransaction(
          transactionSql,
          this.testHooks,
        ),
        ),
      };
    });
    return wrapped.value;
  }

  async loadLiveView(
    familyId: string,
    childId: string,
    now: Date,
  ): Promise<ChildProgressView | null> {
    const sql = this.getDatabase();
    const rows = await sql<
      (PostgresLiveProgressRow & { time_zone: string | null })[]
    >`
      select live.projection, live.bank_version,
             live.projection_version,
             live.projection_date::text as projection_date,
             live.source_revision::text as source_revision,
             live.evidence_count, live.open_conflict_count,
             child.name as child_name,
             to_char(child.birth_month, 'YYYY-MM-DD') as birth_date,
             family.time_zone,
             (
               select count(*)::integer
               from public.child_progress_evidence evidence
               where evidence.child_id = ${childId}
                 and evidence.family_id = ${familyId}
             ) as actual_evidence_count,
             (
               select count(*)::integer
               from public.child_progress_conflicts conflict
               where conflict.child_id = ${childId}
                 and conflict.family_id = ${familyId}
                 and conflict.state = 'open'
             ) as actual_open_conflict_count,
             coalesce(
               (
                 select revision.revision::text
                 from public.child_progress_revisions revision
                 where revision.child_id = ${childId}
                   and revision.family_id = ${familyId}
               ),
               '0'
             ) as actual_source_revision
      from public.child_progress_live live
      join public.children child
        on child.id = live.child_id
       and child.id = ${childId}
       and child.family_id = live.family_id
       and child.family_id = ${familyId}
      join public.families family
        on family.id = live.family_id
       and family.id = ${familyId}
      where live.child_id = ${childId}
        and live.family_id = ${familyId}
      limit 1
    `;
    const row = rows[0];
    if (row === undefined) return null;
    return validatePostgresLiveProgressRow(row, {
      childId,
      projectionDate: zonedDateString(
        now,
        effectiveTimeZone(row.time_zone),
      ),
    });
  }

  async loadProjectionInput(
    familyId: string,
    childId: string,
  ): Promise<ChildProgressProjectionInput | null> {
    const sql = this.getDatabase();
    const wrapped = await sql.begin(async (transactionSql) => ({
      value: await runRepeatableReadOnlyProgressSnapshot(
        async (statement) => {
          await transactionSql.unsafe(statement);
        },
        () =>
          loadProjectionInputWithSql(
            transactionSql,
            familyId,
            childId,
            false,
          ),
      ),
    }));
    return wrapped.value;
  }

  async listNonterminalCheckInsByFamily(
    familyId: string,
  ): Promise<ProgressCheckInRecord[]> {
    const sql = this.getDatabase();
    const wrapped = await sql.begin(async (transactionSql) => ({
      value: await runRepeatableReadOnlyProgressSnapshot(
        async (statement) => {
          await transactionSql.unsafe(statement);
        },
        async () =>
          (await loadFamilyCheckInRows(transactionSql, familyId))
            .filter(
              (checkIn) =>
                checkIn.state === "active" ||
                checkIn.state === "paused",
            ),
      ),
    }));
    return wrapped.value;
  }

  async loadNonterminalCheckInByChild(
    familyId: string,
    childId: string,
  ): Promise<ProgressCheckInRecord | null> {
    const checkIns =
      await this.listNonterminalCheckInsByFamily(familyId);
    return (
      checkIns.find((checkIn) => checkIn.childId === childId) ??
      null
    );
  }

  async loadActiveCheckInByRecipientOrDelivery(
    input: LoadActiveProgressCheckInInput,
  ): Promise<ProgressCheckInRecord | null> {
    const sql = this.getDatabase();
    const wrapped = await sql.begin(async (transactionSql) => ({
      value: await runRepeatableReadOnlyProgressSnapshot(
        async (statement) => {
          await transactionSql.unsafe(statement);
        },
        async () => {
          const matches = (
            await loadFamilyCheckInRows(
              transactionSql,
              input.familyId,
            )
          ).filter(
            (checkIn) =>
              checkIn.state === "active" &&
              checkIn.recipientMemberUserId ===
                input.memberUserId &&
              checkIn.currentDeliveryId ===
                input.repliedDeliveryId,
          );
          return matches.length === 1 ? matches[0] : null;
        },
      ),
    }));
    return wrapped.value;
  }

  async markObservationUsed(
    input: MarkChildObservationUsedInput,
  ): Promise<MarkChildObservationUsedResult> {
    const sql = this.getDatabase();
    const updated = await sql<{ child_id: string }[]>`
      update public.child_observations
      set status = 'used',
          used_at = ${input.usedAt},
          used_task_run_id = ${input.usedTaskRunId}
      where id = ${input.observationId}
        and family_id = ${input.familyId}
        and status = 'new'
      returning child_id
    `;
    if (updated[0] !== undefined) {
      return { outcome: "used", childId: updated[0].child_id };
    }
    const existing = await sql<
      { status: "new" | "used"; child_id: string }[]
    >`
      select status, child_id
      from public.child_observations
      where id = ${input.observationId}
        and family_id = ${input.familyId}
    `;
    const row = existing[0];
    if (row === undefined || row.status !== "used") {
      return { outcome: "unknown_observation" };
    }
    return { outcome: "already_used", childId: row.child_id };
  }
}
