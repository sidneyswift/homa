import {
  CAPTURE_LOOP_EVENT_NAME,
  captureLoopEventPropsSchema,
  type CaptureLoopEventProps,
} from "@homa/core";

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
              and row.status <> 'pending'
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
          )
        ) as corrected_event_matches
    ), inserted as (
      insert into public.events (name, props, family_id)
      select
        ${CAPTURE_LOOP_EVENT_NAME},
        ${serialized},
        ${familyId}::uuid
      from validity
      where object_in_family
        and parent_loop_in_family
        and corrected_event_matches
      on conflict (family_id, ((props ->> 'event_id')))
        where name = 'product.loop_stage_recorded'
      do nothing
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
  if (result?.existing_event_id) {
    throw new Error("capture loop event idempotency payload mismatch");
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
