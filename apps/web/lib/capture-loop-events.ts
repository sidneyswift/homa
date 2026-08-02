import {
  CAPTURE_LOOP_EVENT_NAME,
  captureLoopEventPropsSchema,
  type CaptureLoopEventProps,
} from "@homa/core";
import type { TransactionSql } from "postgres";

import {
  captureLoopEventLockKey,
  captureLoopReceiptLockKey,
} from "./capture-loop-locks";
import { mapDb, type DbJson } from "./map/db";

type CaptureLoopSql = ReturnType<typeof mapDb>;

interface CaptureLoopPersistenceResult {
  inserted: boolean;
  existing_event_id: boolean;
  duplicate_matches: boolean;
}

/**
 * Persists one canonical loop stage with storage-level idempotency. The
 * family is a server-authenticated argument and stays in the row scope, not
 * the client props. A replay receives the same successful acknowledgement
 * while the unique partial index retains one event.
 */
export async function persistCaptureLoopEvent(
  familyId: string,
  rawProps: unknown,
): Promise<void> {
  await persistCaptureLoopEventWithSql(mapDb(), familyId, rawProps);
}

/**
 * The injected form exists for the disposable PostgreSQL contract harness.
 * Every opaque reference is re-scoped before the row becomes durable.
 */
export async function persistCaptureLoopEventWithSql(
  sql: CaptureLoopSql,
  familyId: string,
  rawProps: unknown,
): Promise<void> {
  const props = captureLoopEventPropsSchema.parse(rawProps);
  const lockKeys = new Set<string>();
  if (props.receipt_id !== null) {
    lockKeys.add(captureLoopReceiptLockKey(familyId, props.receipt_id));
  }
  const eventLockId =
    props.corrects_event_id ??
    (props.stage === "outcome_verified" ? props.event_id : null);
  if (eventLockId !== null) {
    lockKeys.add(captureLoopEventLockKey(familyId, eventLockId));
  }
  await sql.begin(async (tx) => {
    for (const lockKey of [...lockKeys].sort()) {
      await tx`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    }
    await persistCaptureLoopEventInTransaction(tx, familyId, props);
  });
}

async function persistCaptureLoopEventInTransaction(
  sql: TransactionSql,
  familyId: string,
  props: CaptureLoopEventProps,
): Promise<void> {
  const serialized = sql.json(props as unknown as DbJson);
  const rows = await sql<CaptureLoopPersistenceResult[]>`
    with validity as (
      select
        case
          when ${props.object_id}::uuid is null then true
          when ${props.object_kind}::text = 'conversation' then exists (
            select 1 from public.conversation_episodes row
            where row.id = ${props.object_id}::uuid
              and row.family_id = ${familyId}::uuid
          )
          when ${props.object_kind}::text = 'material' then exists (
            select 1 from public.materials row
            where row.id = ${props.object_id}::uuid
              and row.family_id = ${familyId}::uuid
          )
          when ${props.object_kind}::text = 'plan' then exists (
            select 1
            from public.child_plans plan
            join public.children child on child.id = plan.child_id
            where plan.id = ${props.object_id}::uuid
              and child.family_id = ${familyId}::uuid
          ) or exists (
            select 1 from public.month_plan_approvals approval
            where approval.draft_id = ${props.object_id}::uuid
              and approval.family_id = ${familyId}::uuid
          )
          when ${props.object_kind}::text = 'plan_activity' then exists (
            select 1 from public.plan_activity_schedule row
            where row.id = ${props.object_id}::uuid
              and row.family_id = ${familyId}::uuid
          )
          when ${props.object_kind}::text = 'family_event' then exists (
            select 1 from public.family_events row
            where row.id = ${props.object_id}::uuid
              and row.family_id = ${familyId}::uuid
          )
          when ${props.object_kind}::text = 'progress_operation' then exists (
            select 1 from public.child_progress_operations row
            where row.id = ${props.object_id}::uuid
              and row.family_id = ${familyId}::uuid
          )
          when ${props.object_kind}::text = 'hours_record' then exists (
            select 1 from public.hours_log row
            where row.id = ${props.object_id}::uuid
              and row.family_id = ${familyId}::uuid
          )
          when ${props.object_kind}::text = 'compliance_record' then exists (
            select 1 from public.materials row
            where row.id = ${props.object_id}::uuid
              and row.family_id = ${familyId}::uuid
              and row.kind = 'packet'
              and (
                (row.subject = 'state-pack' and row.generation ? 'statePack')
                or
                (row.subject = 'state-filing' and row.generation ? 'stateFiling')
              )
          )
          when ${props.object_kind}::text = 'task_run' then exists (
            select 1 from public.homa_task_runs row
            where row.id = ${props.object_id}::uuid
              and row.family_id = ${familyId}::uuid
          )
          else false
        end as object_in_family,
        case
          when ${props.receipt_kind}::text = 'none'
            then ${props.receipt_id}::uuid is null
          when ${props.stage}::text = 'outcome_verified'
            and ${props.receipt_kind}::text = 'artifact_receipt'
            and ${props.object_kind}::text = 'material'
            then exists (
              select 1 from public.materials receipt
              where receipt.id = ${props.receipt_id}::uuid
                and receipt.family_id = ${familyId}::uuid
                and receipt.status = 'final'
                and receipt.approved_at is not null
                and btrim(receipt.pdf_url) <> ''
                and btrim(receipt.preview_url) <> ''
                and receipt.id = ${props.revision_id}::uuid
                and not (
                  receipt.kind = 'packet'
                  and (
                    (receipt.subject = 'state-pack' and receipt.generation ? 'statePack')
                    or
                    (receipt.subject = 'state-filing' and receipt.generation ? 'stateFiling')
                  )
                )
                and exists (
                  with recursive lineage as (
                    select
                      leaf.id,
                      leaf.revises,
                      1 as depth,
                      array[leaf.id]::uuid[] as path
                    from public.materials leaf
                    where leaf.id = receipt.id
                      and leaf.family_id = ${familyId}::uuid
                    union all
                    select
                      parent.id,
                      parent.revises,
                      lineage.depth + 1,
                      lineage.path || parent.id
                    from lineage
                    join public.materials parent on parent.id = lineage.revises
                    where parent.family_id = ${familyId}::uuid
                      and not parent.id = any(lineage.path)
                  )
                  select 1 from lineage
                  where lineage.id = ${props.object_id}::uuid
                    and lineage.depth = ${props.revision}::integer
                    and lineage.revises is null
                )
            )
          when ${props.stage}::text = 'outcome_verified'
            and ${props.receipt_kind}::text = 'database_receipt'
            then case
              when ${props.object_kind}::text = 'plan' then (
                ${props.receipt_id}::uuid = ${props.object_id}::uuid
                and exists (
                  select 1
                  from public.month_plan_approvals receipt
                  where receipt.draft_id = ${props.receipt_id}::uuid
                    and receipt.family_id = ${familyId}::uuid
                    and receipt.final_revision = ${props.revision}::smallint
                    and receipt.draft_id = ${props.revision_id}::uuid
                )
              )
              when ${props.object_kind}::text = 'plan_activity' then exists (
                  select 1 from public.voice_action_receipts receipt
                  where receipt.id = ${props.receipt_id}::uuid
                    and receipt.family_id = ${familyId}::uuid
                    and receipt.object_kind = 'plan_activity'
                    and receipt.object_id = ${props.object_id}::uuid
                    and receipt.effect = 'plan_activity.scheduled'
                    and receipt.status = 'committed'
                    and receipt.undone_at is null
              )
              when ${props.object_kind}::text = 'progress_operation' then exists (
                select 1 from public.child_progress_operations receipt
                where receipt.id = ${props.receipt_id}::uuid
                  and receipt.id = ${props.object_id}::uuid
                  and receipt.family_id = ${familyId}::uuid
                  and not exists (
                    select 1
                    from public.child_progress_operations reversal
                    where reversal.family_id = ${familyId}::uuid
                      and reversal.status = 'undone'
                      and cardinality(reversal.evidence_ids) > 0
                      and cardinality(reversal.affected_item_ids) > 0
                      and reversal.result ->> 'operationId' = receipt.id::text
                  )
                  and (
                    cardinality(receipt.evidence_ids) = 0
                    or exists (
                      select 1
                      from unnest(receipt.evidence_ids) as source_evidence(id)
                      where not exists (
                        select 1
                        from public.child_progress_operations reversal
                        where reversal.family_id = ${familyId}::uuid
                          and reversal.status = 'undone'
                          and cardinality(reversal.evidence_ids) = 1
                          and cardinality(reversal.affected_item_ids) > 0
                          and reversal.evidence_ids[1] = source_evidence.id
                          and reversal.result ->> 'evidenceId' =
                            source_evidence.id::text
                      )
                    )
                  )
                  and (
                    (
                      ${props.intent}::text = 'complete_learning'
                      and (
                        (
                          ${props.result_state}::text = 'complete'
                          and receipt.status = 'recorded'
                        )
                        or (
                          ${props.result_state}::text = 'partial'
                          and receipt.status = 'conflict_open'
                        )
                      )
                      and cardinality(receipt.evidence_ids) > 0
                      and cardinality(receipt.affected_item_ids) > 0
                    )
                    or (
                      ${props.intent}::text = 'record_observation'
                      and (
                        (
                          ${props.result_state}::text = 'complete'
                          and receipt.status in (
                            'recorded', 'activity_only', 'no_match', 'ambiguous'
                          )
                        )
                        or (
                          ${props.result_state}::text = 'partial'
                          and receipt.status = 'conflict_open'
                        )
                      )
                      and (
                        receipt.status in ('activity_only', 'no_match', 'ambiguous')
                        or (
                          cardinality(receipt.evidence_ids) > 0
                          and cardinality(receipt.affected_item_ids) > 0
                        )
                      )
                    )
                  )
              )
              when ${props.object_kind}::text = 'hours_record' then exists (
                  select 1 from public.voice_action_receipts receipt
                  where receipt.id = ${props.receipt_id}::uuid
                    and receipt.family_id = ${familyId}::uuid
                    and receipt.object_kind = 'hours_entry'
                    and receipt.object_id = ${props.object_id}::uuid
                    and receipt.effect = 'hours.logged'
                    and receipt.status = 'committed'
                    and receipt.undone_at is null
              )
              when ${props.object_kind}::text = 'compliance_record' then (
                ${props.receipt_id}::uuid = ${props.object_id}::uuid
                and ${props.revision}::integer = 1
                and exists (
                  select 1 from public.materials receipt
                  where receipt.id = ${props.receipt_id}::uuid
                    and receipt.family_id = ${familyId}::uuid
                    and receipt.kind = 'packet'
                    and receipt.status = 'final'
                    and receipt.approved_at is not null
                    and btrim(receipt.pdf_url) <> ''
                    and btrim(receipt.preview_url) <> ''
                    and (
                      ${props.profile}::text = 'direct_mutation'
                      or receipt.id = ${props.revision_id}::uuid
                    )
                    and (
                      (receipt.subject = 'state-pack' and receipt.generation ? 'statePack')
                      or
                      (receipt.subject = 'state-filing' and receipt.generation ? 'stateFiling')
                    )
                )
              )
              else false
            end
          when ${props.stage}::text in (
            'correction_or_undo_verified', 'rollback_verified'
          ) and ${props.receipt_kind}::text = 'artifact_receipt'
            then (
              ${props.stage}::text = 'correction_or_undo_verified'
              and ${props.correction_result}::text = 'corrected'
              and ${props.object_kind}::text = 'material'
              and exists (
                select 1 from public.materials receipt
                where receipt.id = ${props.receipt_id}::uuid
                  and receipt.family_id = ${familyId}::uuid
                  and receipt.status = 'final'
                  and receipt.approved_at is not null
                  and btrim(receipt.pdf_url) <> ''
                  and btrim(receipt.preview_url) <> ''
                  and not (
                    receipt.kind = 'packet'
                    and (
                      (receipt.subject = 'state-pack' and receipt.generation ? 'statePack')
                      or
                      (receipt.subject = 'state-filing' and receipt.generation ? 'stateFiling')
                    )
                  )
                  and exists (
                    with recursive lineage as (
                      select
                        leaf.id,
                        leaf.revises,
                        array[leaf.id]::uuid[] as path
                      from public.materials leaf
                      where leaf.id = receipt.id
                        and leaf.family_id = ${familyId}::uuid
                      union all
                      select
                        parent.id,
                        parent.revises,
                        lineage.path || parent.id
                      from lineage
                      join public.materials parent on parent.id = lineage.revises
                      where parent.family_id = ${familyId}::uuid
                        and not parent.id = any(lineage.path)
                    )
                    select 1 from lineage
                    where lineage.id = ${props.object_id}::uuid
                      and lineage.id <> receipt.id
                      and lineage.revises is null
                  )
              )
            )
          when ${props.stage}::text in (
            'correction_or_undo_verified', 'rollback_verified'
          ) and ${props.receipt_kind}::text = 'database_receipt'
            then (
              (
                (
                  ${props.stage}::text = 'correction_or_undo_verified'
                  and ${props.correction_result}::text = 'reversed'
                )
                or (
                  ${props.stage}::text = 'rollback_verified'
                  and ${props.intent}::text <> 'correct_or_undo'
                )
              )
              and (
                (
                  ${props.object_kind}::text = 'progress_operation'
                  and exists (
                    select 1 from public.child_progress_operations receipt
                    where receipt.id = ${props.receipt_id}::uuid
                      and receipt.family_id = ${familyId}::uuid
                      and receipt.id <> ${props.object_id}::uuid
                      and receipt.status = 'undone'
                      and cardinality(receipt.evidence_ids) > 0
                      and cardinality(receipt.affected_item_ids) > 0
                      and (
                        receipt.result ->> 'operationId' = ${props.object_id}::text
                        or (
                          receipt.result ->> 'evidenceId' is not null
                          and cardinality(receipt.evidence_ids) = 1
                          and receipt.evidence_ids[1]::text =
                            receipt.result ->> 'evidenceId'
                          and exists (
                            select 1
                            from public.child_progress_operations source
                            where source.id = ${props.object_id}::uuid
                              and source.family_id = ${familyId}::uuid
                              and cardinality(source.evidence_ids) > 0
                              and source.evidence_ids @> receipt.evidence_ids
                              and not exists (
                                select 1
                                from unnest(source.evidence_ids)
                                  as source_evidence(id)
                                where not exists (
                                  select 1
                                  from public.child_progress_operations reversal
                                  where reversal.family_id = ${familyId}::uuid
                                    and reversal.status = 'undone'
                                    and cardinality(reversal.evidence_ids) = 1
                                    and cardinality(reversal.affected_item_ids) > 0
                                    and reversal.evidence_ids[1] =
                                      source_evidence.id
                                    and reversal.result ->> 'evidenceId' =
                                      source_evidence.id::text
                                )
                              )
                          )
                        )
                      )
                  )
                )
                or exists (
                  select 1 from public.voice_action_receipts receipt
                  where receipt.id = ${props.receipt_id}::uuid
                    and receipt.family_id = ${familyId}::uuid
                    and receipt.object_id = ${props.object_id}::uuid
                    and receipt.status = 'committed'
                    and receipt.undone_at is not null
                    and (
                      (
                        ${props.object_kind}::text = 'hours_record'
                        and receipt.object_kind = 'hours_entry'
                        and receipt.effect = 'hours.logged'
                      )
                      or (
                        ${props.object_kind}::text = 'plan_activity'
                        and receipt.object_kind = 'plan_activity'
                        and receipt.effect = 'plan_activity.scheduled'
                      )
                      or (
                        ${props.object_kind}::text = 'family_event'
                        and ${props.stage}::text = 'rollback_verified'
                        and receipt.object_kind = 'family_event'
                        and receipt.effect in (
                          'family_event.added',
                          'family_event.updated',
                          'family_event.removed'
                        )
                      )
                    )
                )
              )
            )
          else false
        end as receipt_matches,
        (
          ${props.parent_loop_id}::uuid is null
          or exists (
            select 1 from public.events parent
            where parent.family_id = ${familyId}::uuid
              and parent.name = ${CAPTURE_LOOP_EVENT_NAME}
              and parent.props ->> 'loop_id' = ${props.parent_loop_id}::text
          )
        ) as parent_loop_in_family,
        (
          ${props.corrects_event_id}::uuid is null
          or exists (
            select 1 from public.events original
            where original.family_id = ${familyId}::uuid
              and original.name = ${CAPTURE_LOOP_EVENT_NAME}
              and original.props ->> 'event_id' = ${props.corrects_event_id}::text
              and original.props ->> 'loop_id' = ${props.parent_loop_id}::text
              and original.props ->> 'stage' = 'outcome_verified'
              and original.props ->> 'object_kind' = ${props.object_kind}
              and original.props ->> 'object_id' = ${props.object_id}::text
              and original.props ->> 'receipt_kind' = ${props.receipt_kind}
              and (
                ${props.correction_result}::text <> 'corrected'
                or ${props.object_kind}::text <> 'material'
                or exists (
                  with recursive corrected_lineage as (
                    select
                      receipt.id,
                      receipt.revises,
                      array[receipt.id]::uuid[] as path
                    from public.materials receipt
                    where receipt.id = ${props.receipt_id}::uuid
                      and receipt.family_id = ${familyId}::uuid
                    union all
                    select
                      parent.id,
                      parent.revises,
                      corrected_lineage.path || parent.id
                    from corrected_lineage
                    join public.materials parent
                      on parent.id = corrected_lineage.revises
                    where parent.family_id = ${familyId}::uuid
                      and not parent.id = any(corrected_lineage.path)
                  )
                  select 1 from corrected_lineage
                  where corrected_lineage.id =
                    (original.props ->> 'receipt_id')::uuid
                    and corrected_lineage.id <> ${props.receipt_id}::uuid
                )
              )
              and (
                ${props.correction_result}::text <> 'reversed'
                or (
                  ${props.object_kind}::text = 'progress_operation'
                  and original.props ->> 'receipt_id' = ${props.object_id}::text
                  and original.props ->> 'receipt_id' <> ${props.receipt_id}::text
                )
                or (
                  ${props.object_kind}::text <> 'progress_operation'
                  and original.props ->> 'receipt_id' = ${props.receipt_id}::text
                )
              )
          )
        ) as corrected_event_matches
    ), inserted as (
      insert into public.events (name, props, family_id)
      select
        ${CAPTURE_LOOP_EVENT_NAME},
        ${serialized},
        ${familyId}::uuid
      from validity
      where (
          object_in_family
          or (
            ${props.stage}::text in (
              'correction_or_undo_verified', 'rollback_verified'
            )
            and receipt_matches
          )
        )
        and receipt_matches
        and parent_loop_in_family
        and corrected_event_matches
      on conflict do nothing
      returning 1
    )
    select
      exists (select 1 from inserted) as inserted,
      exists (
        select 1 from public.events existing
        where existing.family_id = ${familyId}::uuid
          and existing.name = ${CAPTURE_LOOP_EVENT_NAME}
          and existing.props ->> 'event_id' = ${props.event_id}
      ) as existing_event_id,
      coalesce((
        select existing.props = ${serialized}::jsonb
        from public.events existing
        where existing.family_id = ${familyId}::uuid
          and existing.name = ${CAPTURE_LOOP_EVENT_NAME}
          and existing.props ->> 'event_id' = ${props.event_id}
        limit 1
      ), false) as duplicate_matches
  `;

  const result = rows[0];
  if (result?.inserted || result?.duplicate_matches) return;
  const replayRows = await sql<{ duplicate_matches: boolean }[]>`
    select existing.props = ${serialized}::jsonb as duplicate_matches
    from public.events existing
    where existing.family_id = ${familyId}::uuid
      and existing.name = ${CAPTURE_LOOP_EVENT_NAME}
      and existing.props ->> 'event_id' = ${props.event_id}
    limit 1
  `;
  if (replayRows[0]?.duplicate_matches) return;
  if (result?.existing_event_id || replayRows[0]) {
    throw new Error("capture loop event idempotency payload mismatch");
  }
  const claimsPositiveReceipt =
    props.stage === "outcome_verified" ||
    (props.stage === "correction_or_undo_verified" &&
      props.correction_result === "corrected");
  if (claimsPositiveReceipt && props.receipt_id !== null) {
    const receiptRows = await sql<{ event_id: string }[]>`
      select existing.props ->> 'event_id' as event_id
      from public.events existing
      where existing.family_id = ${familyId}::uuid
        and existing.name = ${CAPTURE_LOOP_EVENT_NAME}
        and existing.props ->> 'receipt_kind' = ${props.receipt_kind}
        and existing.props ->> 'receipt_id' = ${props.receipt_id}
        and (
          existing.props ->> 'stage' = 'outcome_verified'
          or (
            existing.props ->> 'stage' = 'correction_or_undo_verified'
            and existing.props ->> 'correction_result' = 'corrected'
          )
        )
      limit 1
    `;
    if (receiptRows[0]) {
      throw new Error("capture loop outcome receipt is already claimed");
    }
  }
  throw new Error("capture loop event references are outside the authenticated family");
}

export type WebCaptureLoopEventInput = Omit<
  CaptureLoopEventProps,
  "client_context"
>;

function webClientContext() {
  return {
    client: "web" as const,
    app_version:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 40) ?? "development",
    build_number: null,
    runtime_version: null,
    update_id: null,
  };
}

/**
 * Best-effort web adapter for consumer issues. It uses the same core props
 * schema and persistence receipt as native, but analytics can never break
 * the product action that owns the real effect.
 */
export async function emitWebCaptureLoopStage(
  familyId: string,
  input: WebCaptureLoopEventInput,
): Promise<void> {
  try {
    await persistCaptureLoopEvent(familyId, {
      ...input,
      client_context: webClientContext(),
    });
  } catch (error) {
    console.error(
      `emitWebCaptureLoopStage(${input.stage}) failed:`,
      error instanceof Error ? error.message : "unknown",
    );
  }
}
