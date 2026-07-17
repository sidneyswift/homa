import type { Sql } from "postgres";

import type { DeliveryAggregate } from "../conversation-continuity/delivery-policy";
import { mapDb } from "../map/db";
import {
  operationalDiagnostic,
  type OperationalPhase,
} from "../operational-diagnostics";
import {
  aggregateResearchBriefDeliveryAttempts,
  recoverPreparedResearchBriefFromDurableDelivery,
  type PreparedResearchBriefAggregateRecoveryResult,
} from "./research-brief-delivery";
import { emitResearchBriefRecoveryCompletion } from "./research-brief-events";
import {
  researchBriefSourceLockIdentity,
  type ResearchBriefSourceSnapshot,
} from "./research-brief-preparation";

export interface PreparedResearchBriefForDelivery {
  familyId: string;
  taskRunId: string;
  childId: string;
  knowledgeId: string;
  observationId: string | undefined;
  draft: string;
  sourceSnapshot: ResearchBriefSourceSnapshot;
}

export interface FinalizeResearchBriefDeliveryInput {
  familyId: string;
  taskRunId: string;
  canonicalMessageId: string;
  sessionId?: string | null;
}

export interface FinalizedPreparedResearchBriefDelivery {
  prepared: PreparedResearchBriefForDelivery;
  delivery: DeliveryAggregate;
}

export async function loadPreparedResearchBriefForDelivery(
  input: Pick<FinalizeResearchBriefDeliveryInput, "familyId" | "taskRunId">,
): Promise<PreparedResearchBriefForDelivery | null> {
  const sql = mapDb();
  const rows = await sql<{
    family_id: string;
    task_run_id: string;
    child_id: string;
    knowledge_bank_id: string;
    observation_id: string | null;
    draft: string;
    source_snapshot: ResearchBriefSourceSnapshot;
  }[]>`
    select p.family_id, p.task_run_id, p.child_id, p.knowledge_bank_id,
           p.observation_id, p.draft, p.source_snapshot
    from public.research_brief_preparations p
    join public.homa_task_runs r
      on r.id = p.task_run_id and r.family_id = p.family_id
    where p.family_id = ${input.familyId}
      and p.task_run_id = ${input.taskRunId}
      and r.kind = 'morning_brief'
      and r.status = 'running'
      and r.delivery_version = 'research_brief_v2'
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    familyId: row.family_id,
    taskRunId: row.task_run_id,
    childId: row.child_id,
    knowledgeId: row.knowledge_bank_id,
    observationId: row.observation_id ?? undefined,
    draft: row.draft,
    sourceSnapshot: row.source_snapshot,
  };
}

export async function recordPreparedResearchBriefSaveOnlyAcceptanceWithDatabase(
  database: Sql,
  input: {
    familyId: string;
    taskRunId: string;
    draft: string;
  },
): Promise<boolean> {
  const recorded = await database<{ id: string }[]>`
    update public.homa_task_runs r
    set summary = p.draft,
        delivered_channel = 'none'
    from public.research_brief_preparations p
    where r.id = ${input.taskRunId}
      and r.family_id = ${input.familyId}
      and r.kind = 'morning_brief'
      and r.status = 'running'
      and r.delivery_version = 'research_brief_v2'
      and p.task_run_id = r.id
      and p.family_id = r.family_id
      and p.draft = ${input.draft}
    returning r.id
  `;
  return recorded.length === 1;
}

export async function recordPreparedResearchBriefSaveOnlyAcceptance(input: {
  familyId: string;
  taskRunId: string;
  draft: string;
}): Promise<boolean> {
  return await recordPreparedResearchBriefSaveOnlyAcceptanceWithDatabase(
    mapDb(),
    input,
  );
}

export async function finalizePreparedResearchBriefDeliveryWithDatabase(
  database: Sql,
  input: FinalizeResearchBriefDeliveryInput,
): Promise<FinalizedPreparedResearchBriefDelivery | null> {
  const staged = await database<{
    family_id: string;
    task_run_id: string;
    knowledge_bank_id: string;
  }[]>`
    select p.family_id, p.task_run_id, p.knowledge_bank_id
    from public.research_brief_preparations p
    where p.family_id = ${input.familyId}
      and p.task_run_id = ${input.taskRunId}
    limit 1
  `;
  const stagedPreparation = staged[0];
  if (!stagedPreparation) return null;

  return await database.begin(async (transaction) => {
    await transaction`
      select pg_advisory_xact_lock(
        hashtextextended(
          ${researchBriefSourceLockIdentity(
            stagedPreparation.family_id,
            stagedPreparation.knowledge_bank_id,
          )},
          0
        )
      )
    `;
    const [taskRun] = await transaction<{
      id: string;
      status: string;
      kind: string;
      delivery_version: string;
      delivered_channel: "sms" | "email" | "none" | null;
      summary: string | null;
    }[]>`
      select id, status, kind, delivery_version, delivered_channel, summary
      from public.homa_task_runs
      where id = ${input.taskRunId}
        and family_id = ${input.familyId}
      for update
    `;
    if (
      !taskRun ||
      taskRun.status !== "running" ||
      taskRun.kind !== "morning_brief" ||
      taskRun.delivery_version !== "research_brief_v2"
    ) {
      return null;
    }
    const preparations = await transaction<{
      family_id: string;
      task_run_id: string;
      child_id: string;
      knowledge_bank_id: string;
      observation_id: string | null;
      draft: string;
      source_snapshot: ResearchBriefSourceSnapshot;
    }[]>`
      select p.family_id, p.task_run_id, p.child_id, p.knowledge_bank_id,
             p.observation_id, p.draft, p.source_snapshot
      from public.research_brief_preparations p
      where p.family_id = ${input.familyId}
        and p.task_run_id = ${input.taskRunId}
        and p.knowledge_bank_id = ${stagedPreparation.knowledge_bank_id}
      for update
    `;
    const preparation = preparations[0];
    if (!preparation) return null;

    const canonicalMessages = await transaction<{ id: string }[]>`
      select id
      from public.conversation_messages
      where id = ${input.canonicalMessageId}
        and family_id = ${preparation.family_id}
        and task_run_id = ${preparation.task_run_id}
        and role = 'assistant'
      for update
    `;
    if (canonicalMessages.length !== 1) return null;

    await transaction`
      update public.conversation_deliveries
      set status = 'uncertain',
          error = coalesce(
            error,
            'delivery acceptance unknown at finalization'
          ),
          failed_at = coalesce(failed_at, now()),
          updated_at = now()
      where task_run_id = ${preparation.task_run_id}
        and family_id = ${preparation.family_id}
        and status = 'pending'
    `;
    const attempts = await transaction<{
      id: string;
      recipient_member_user_id: string | null;
      destination_hash: string | null;
      channel: "sms" | "email";
      status: "sent" | "failed" | "uncertain";
    }[]>`
      select id, recipient_member_user_id, destination_hash, channel, status
      from public.conversation_deliveries
      where task_run_id = ${preparation.task_run_id}
        and family_id = ${preparation.family_id}
        and channel in ('sms', 'email')
      order by created_at, id
    `;
    const saveOnlyAccepted =
      attempts.length === 0 &&
      taskRun.delivered_channel === "none" &&
      taskRun.summary === preparation.draft;
    const delivery: DeliveryAggregate = saveOnlyAccepted
      ? {
          status: "done",
          deliveredChannel: "none",
          deliveredCount: 1,
          failedCount: 0,
        }
      : aggregateResearchBriefDeliveryAttempts(
          attempts.map((attempt) => ({
            recipientKey: attempt.recipient_member_user_id
              ? `member:${attempt.recipient_member_user_id}`
              : attempt.destination_hash
                ? `destination:${attempt.destination_hash}`
                : `delivery:${attempt.id}`,
            channel: attempt.channel,
            status: attempt.status,
          })),
        );
    const confirmedDelivery = delivery.deliveredCount > 0;

    const artifact = {
      kind: preparation.source_snapshot.kind,
      id: preparation.source_snapshot.id,
      title: preparation.source_snapshot.title,
      sourceNames: preparation.source_snapshot.sourceNames,
      citationUrls: preparation.source_snapshot.citationUrls,
    };
    if (confirmedDelivery) {
      await transaction`
        insert into public.family_knowledge_use (
          family_id, knowledge_bank_id, task_run_id, used_at
        )
        values (
          ${preparation.family_id}, ${preparation.knowledge_bank_id},
          ${preparation.task_run_id}, now()
        )
        on conflict (family_id, knowledge_bank_id, task_run_id) do nothing
      `;
      if (preparation.observation_id) {
        await transaction`
          update public.child_observations
          set status = 'used',
              used_task_run_id = ${preparation.task_run_id},
              used_at = now()
          where id = ${preparation.observation_id}
            and family_id = ${preparation.family_id}
            and child_id = ${preparation.child_id}
            and status = 'new'
        `;
      }
      await transaction`
        update public.research_brief_preparations
        set delivered_at = coalesce(delivered_at, now())
        where task_run_id = ${preparation.task_run_id}
          and family_id = ${preparation.family_id}
      `;
      const visible = await transaction<{ id: string }[]>`
        update public.conversation_messages
        set visibility = 'family'
        where id = ${input.canonicalMessageId}
          and family_id = ${preparation.family_id}
          and task_run_id = ${preparation.task_run_id}
          and role = 'assistant'
        returning id
      `;
      if (visible.length !== 1) {
        throw new Error("canonical research brief visibility update failed");
      }
    }
    const finished = await transaction<{ id: string }[]>`
      update public.homa_task_runs
      set status = ${delivery.status},
          summary = ${confirmedDelivery
            ? preparation.draft.slice(0, 4000)
            : null},
          delivered_channel = ${delivery.deliveredChannel},
          session_id = coalesce(${input.sessionId ?? null}, session_id),
          finished_at = now(),
          error = case
            when ${delivery.status === "failed"}
              then coalesce(error, 'delivery failed for every intended recipient')
            else error
          end,
          artifacts = case
            when not ${confirmedDelivery} then artifacts
            when exists (
              select 1
              from jsonb_array_elements(artifacts) artifact_entry
              where artifact_entry->>'kind' = ${artifact.kind}
                and artifact_entry->>'id' = ${artifact.id}
            ) then artifacts
            else artifacts || jsonb_build_array(${transaction.json(artifact)})
          end
      where id = ${preparation.task_run_id}
        and family_id = ${preparation.family_id}
        and status = 'running'
      returning id
    `;
    if (finished.length !== 1) return null;
    const prepared = {
      familyId: preparation.family_id,
      taskRunId: preparation.task_run_id,
      childId: preparation.child_id,
      knowledgeId: preparation.knowledge_bank_id,
      observationId: preparation.observation_id ?? undefined,
      draft: preparation.draft,
      sourceSnapshot: preparation.source_snapshot,
    };
    return {
      prepared,
      delivery,
    };
  });
}

export async function finalizePreparedResearchBriefDelivery(
  input: FinalizeResearchBriefDeliveryInput,
): Promise<FinalizedPreparedResearchBriefDelivery | null> {
  return await finalizePreparedResearchBriefDeliveryWithDatabase(
    mapDb(),
    input,
  );
}

export async function recoverPreparedResearchBriefDeliveryWithDatabase(
  database: Sql,
  input: Pick<FinalizeResearchBriefDeliveryInput, "familyId" | "taskRunId">,
  logRecoveryPending: (phase: OperationalPhase) => void = () => undefined,
): Promise<PreparedResearchBriefAggregateRecoveryResult> {
  return await recoverPreparedResearchBriefFromDurableDelivery(input, {
    loadDelivery: async () => {
      const attempts = await database<{
        id: string;
        message_id: string;
        recipient_member_user_id: string | null;
        destination_hash: string | null;
        channel: "sms" | "email";
        status: "pending" | "sent" | "failed" | "uncertain";
      }[]>`
        select d.id, d.message_id, d.recipient_member_user_id,
               d.destination_hash, d.channel, d.status
        from public.conversation_deliveries d
        join public.homa_task_runs r
          on r.id = d.task_run_id and r.family_id = d.family_id
        join public.research_brief_preparations p
          on p.task_run_id = r.id and p.family_id = r.family_id
        where d.family_id = ${input.familyId}
          and d.task_run_id = ${input.taskRunId}
          and d.channel in ('sms', 'email')
          and r.kind = 'morning_brief'
          and r.status = 'running'
          and r.delivery_version = 'research_brief_v2'
        order by d.created_at, d.id
      `;
      if (attempts.length > 0) {
        const delivery = aggregateResearchBriefDeliveryAttempts(
          attempts.map((attempt) => ({
            recipientKey: attempt.recipient_member_user_id
              ? `member:${attempt.recipient_member_user_id}`
              : attempt.destination_hash
                ? `destination:${attempt.destination_hash}`
                : `delivery:${attempt.id}`,
            channel: attempt.channel,
            status: attempt.status,
          })),
        );
        const message =
          attempts.find((attempt) => attempt.status === "sent") ?? attempts[0];
        return { messageId: message.message_id, delivery };
      }

      const saveOnly = await database<{ message_id: string }[]>`
        select m.id as message_id
        from public.homa_task_runs r
        join public.research_brief_preparations p
          on p.task_run_id = r.id and p.family_id = r.family_id
        join public.conversation_messages m
          on m.task_run_id = r.id and m.family_id = r.family_id
        where r.id = ${input.taskRunId}
          and r.family_id = ${input.familyId}
          and r.kind = 'morning_brief'
          and r.status = 'running'
          and r.delivery_version = 'research_brief_v2'
          and r.delivered_channel = 'none'
          and r.summary = p.draft
          and m.role = 'assistant'
        order by m.id
        limit 1
      `;
      return saveOnly[0]
        ? {
            messageId: saveOnly[0].message_id,
            delivery: {
              status: "done",
              deliveredChannel: "none",
              deliveredCount: 1,
              failedCount: 0,
            },
          }
        : null;
    },
    finalize: async (snapshot) => {
      return await finalizePreparedResearchBriefDeliveryWithDatabase(
        database,
        {
          ...input,
          canonicalMessageId: snapshot.messageId,
        },
      );
    },
    logRecoveryPending,
  });
}

export async function recoverPreparedResearchBriefDelivery(
  input: Pick<FinalizeResearchBriefDeliveryInput, "familyId" | "taskRunId">,
): Promise<PreparedResearchBriefAggregateRecoveryResult> {
  const result = await recoverPreparedResearchBriefDeliveryWithDatabase(
    mapDb(),
    input,
    (phase) => {
      console.error(
        operationalDiagnostic(
          "morning_brief",
          phase,
          "retry_pending",
        ),
      );
    },
  );
  await emitResearchBriefRecoveryCompletion(input.familyId, result);
  return result;
}
