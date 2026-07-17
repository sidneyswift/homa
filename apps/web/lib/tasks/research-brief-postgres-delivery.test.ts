import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { applyResendWebhookReceiptWithDatabase } from "../email-webhook";
import {
  adultAId,
  adultBId,
  atomicFinalizationKnowledgeId,
  childAId,
  createDisposableResearchBriefPostgresHarness,
  familyAId,
  finalizationKnowledgeId,
  knowledgeId,
  observationId,
  recoveryKnowledgeId,
  runId,
} from "./research-brief-postgres-harness";
import {
  finalizePreparedResearchBriefDeliveryWithDatabase,
  recordPreparedResearchBriefSaveOnlyAcceptanceWithDatabase,
  recoverPreparedResearchBriefDeliveryWithDatabase,
} from "./research-brief-store";

const harness = createDisposableResearchBriefPostgresHarness("delivery");

describe("research brief PostgreSQL delivery and recovery", () => {
  before(async () => await harness.start());
  after(async () => await harness.stop());

  it("rolls back every finalization effect when canonical visibility fails inside the transaction", async () => {
    const db = harness.database();
    const selectedRunId = runId(40);
    const messageId = "00000000-0000-4000-a000-000000000040";
    await db`
      insert into public.research_brief_preparations (
        task_run_id, family_id, child_id, knowledge_bank_id, draft,
        draft_hash, source_snapshot, prepared_at
      )
      values (
        ${selectedRunId}, ${familyAId}, ${childAId},
        ${atomicFinalizationKnowledgeId}, 'Atomic draft',
        ${"f".repeat(64)}, ${db.json({
          kind: "knowledge_cited",
          id: atomicFinalizationKnowledgeId,
          title: "Atomic finalization research",
          sourceNames: ["Test Source"],
          citationUrls: ["https://example.test/research"],
        })}, now()
      )
    `;
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, visibility
      )
      values (
        ${messageId}, ${familyAId}, ${selectedRunId}, 'assistant', 'internal'
      )
    `;
    await db`
      insert into public.conversation_deliveries (
        family_id, message_id, task_run_id, recipient_member_user_id,
        destination_hash, channel, status, sent_at
      )
      values (
        ${familyAId}, ${messageId}, ${selectedRunId}, ${adultAId},
        ${"0".repeat(64)}, 'sms', 'sent', now()
      )
    `;
    await db`
      create function public.fail_atomic_brief_visibility()
      returns trigger language plpgsql as $$
      begin
        if new.visibility = 'family' then
          raise exception 'simulated visibility crash';
        end if;
        return new;
      end
      $$
    `;
    await db`
      create trigger fail_atomic_brief_visibility
      before update on public.conversation_messages
      for each row execute function public.fail_atomic_brief_visibility()
    `;

    try {
      await assert.rejects(
        finalizePreparedResearchBriefDeliveryWithDatabase(db, {
          familyId: familyAId,
          taskRunId: selectedRunId,
          canonicalMessageId: messageId,
        }),
        /simulated visibility crash/u,
      );
    } finally {
      await db`
        drop trigger if exists fail_atomic_brief_visibility
        on public.conversation_messages
      `;
      await db`
        drop function if exists public.fail_atomic_brief_visibility()
      `;
    }

    const [state] = await db<{
      uses: number;
      delivered: boolean;
      summary: string | null;
      artifactCount: number;
      visibility: string;
      runStatus: string;
      finished: boolean;
    }[]>`
      select
        (
          select count(*)::integer
          from public.family_knowledge_use
          where task_run_id = ${selectedRunId}
        ) as uses,
        p.delivered_at is not null as delivered,
        r.summary,
        jsonb_array_length(r.artifacts) as "artifactCount",
        m.visibility,
        r.status as "runStatus",
        r.finished_at is not null as finished
      from public.research_brief_preparations p
      join public.homa_task_runs r on r.id = p.task_run_id
      join public.conversation_messages m on m.id = ${messageId}
      where p.task_run_id = ${selectedRunId}
    `;
    assert.deepEqual(state, {
      uses: 0,
      delivered: false,
      summary: null,
      artifactCount: 0,
      visibility: "internal",
      runStatus: "running",
      finished: false,
    });
  });

  it("finalizes one delivered knowledge-use row", async () => {
    const db = harness.database();
    await db`
      insert into public.research_brief_preparations (
        task_run_id, family_id, child_id, knowledge_bank_id, draft,
        draft_hash, source_snapshot, prepared_at
      )
      values (
        ${runId(6)}, ${familyAId}, ${childAId}, ${knowledgeId}, 'Delivered',
        ${"e".repeat(64)}, '{}'::jsonb, now()
      )
    `;
    await db.begin(async (transaction) => {
      await transaction`
        update public.research_brief_preparations
        set delivered_at = now()
        where task_run_id = ${runId(6)}
      `;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await transaction`
          insert into public.family_knowledge_use (
            family_id, knowledge_bank_id, task_run_id, used_at
          )
          values (${familyAId}, ${knowledgeId}, ${runId(6)}, now())
          on conflict (family_id, knowledge_bank_id, task_run_id) do nothing
        `;
      }
    });
    const [result] = await db<{ uses: number; delivered: boolean }[]>`
      select
        (
          select count(*)::integer
          from public.family_knowledge_use
          where task_run_id = ${runId(6)}
        ) as uses,
        delivered_at is not null as delivered
      from public.research_brief_preparations
      where task_run_id = ${runId(6)}
    `;
    assert.deepEqual(result, { uses: 1, delivered: true });
  });

  it("finalizes SMS, email, and save-only prepared drafts exactly once", async () => {
    const db = harness.database();
    for (const [sequence, channel] of [
      [9, "sms"],
      [10, "email"],
      [11, "none"],
    ] as const) {
      const selectedRunId = runId(sequence);
      const canonicalMessageId = runId(100 + sequence);
      await db`
        update public.homa_task_runs
        set status = 'running'
        where id = ${selectedRunId}
      `;
      await db`
        insert into public.research_brief_preparations (
          task_run_id, family_id, child_id, knowledge_bank_id, observation_id,
          draft, draft_hash, source_snapshot, prepared_at
        )
        values (
          ${selectedRunId}, ${familyAId}, ${childAId}, ${finalizationKnowledgeId},
          ${observationId(2)}, ${`Prepared ${channel} draft`}, ${"g".repeat(64)},
          ${db.json({
            kind: "knowledge_cited",
            id: finalizationKnowledgeId,
            title: "Finalized research",
            sourceNames: ["Test Source"],
            citationUrls: ["https://example.test/finalized"],
          })}, now()
        )
      `;
      await db`
        insert into public.conversation_messages (
          id, family_id, task_run_id, role, visibility
        )
        values (
          ${canonicalMessageId}, ${familyAId}, ${selectedRunId},
          'assistant', 'internal'
        )
      `;
      if (channel === "none") {
        assert.equal(
          await recordPreparedResearchBriefSaveOnlyAcceptanceWithDatabase(db, {
            familyId: familyAId,
            taskRunId: selectedRunId,
            draft: `Prepared ${channel} draft`,
          }),
          true,
        );
      } else {
        await db`
          insert into public.conversation_deliveries (
            family_id, message_id, task_run_id, recipient_member_user_id,
            destination_hash, channel, status, sent_at
          )
          values (
            ${familyAId}, ${canonicalMessageId}, ${selectedRunId}, ${adultAId},
            ${`${sequence}`.repeat(64).slice(0, 64)}, ${channel}, 'sent', now()
          )
        `;
      }
      await Promise.all([
        finalizePreparedResearchBriefDeliveryWithDatabase(db, {
          familyId: familyAId,
          taskRunId: selectedRunId,
          canonicalMessageId,
        }),
        finalizePreparedResearchBriefDeliveryWithDatabase(db, {
          familyId: familyAId,
          taskRunId: selectedRunId,
          canonicalMessageId,
        }),
      ]);
    }
    const [result] = await db<{
      uses: number;
      delivered: number;
      artifacts: number;
      observationsUsed: number;
    }[]>`
      select
        (select count(*)::integer from public.family_knowledge_use
          where knowledge_bank_id = ${finalizationKnowledgeId}) as uses,
        (select count(*)::integer from public.research_brief_preparations
          where knowledge_bank_id = ${finalizationKnowledgeId}
            and delivered_at is not null) as delivered,
        (select count(*)::integer from public.homa_task_runs
          where artifacts @> ${db.json([{
            kind: "knowledge_cited",
            id: finalizationKnowledgeId,
          }])}) as artifacts,
        (select count(*)::integer from public.child_observations
          where id = ${observationId(2)} and status = 'used') as "observationsUsed"
    `;
    assert.deepEqual(result, {
      uses: 3,
      delivered: 3,
      artifacts: 3,
      observationsUsed: 1,
    });
  });

  it("records a durable save-only receipt before finalization", async () => {
    const db = harness.database();
    const selectedRunId = runId(23);
    const draft = "Prepared save-only recovery draft";
    await db`
      insert into public.research_brief_preparations (
        task_run_id, family_id, child_id, knowledge_bank_id, draft,
        draft_hash, source_snapshot, prepared_at
      )
      values (
        ${selectedRunId}, ${familyAId}, ${childAId}, ${recoveryKnowledgeId},
        ${draft}, ${"i".repeat(64)},
        ${db.json({
          kind: "knowledge_cited",
          id: recoveryKnowledgeId,
          title: "Recovered research",
          sourceNames: ["Recovery Source"],
          citationUrls: ["https://example.test/recovery"],
        })}, now()
      )
    `;
    assert.equal(
      await recordPreparedResearchBriefSaveOnlyAcceptanceWithDatabase(db, {
        familyId: familyAId,
        taskRunId: selectedRunId,
        draft,
      }),
      true,
    );
    const [receipt] = await db<{
      summary: string;
      deliveredChannel: string;
      status: string;
    }[]>`
      select summary, delivered_channel as "deliveredChannel", status
      from public.homa_task_runs
      where id = ${selectedRunId}
    `;
    assert.deepEqual(receipt, {
      summary: draft,
      deliveredChannel: "none",
      status: "running",
    });
    const messageId = "00000000-0000-4000-a000-000000000003";
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, visibility
      )
      values (
        ${messageId}, ${familyAId}, ${selectedRunId}, 'assistant', 'family'
      )
    `;
    assert.deepEqual(
      await recoverPreparedResearchBriefDeliveryWithDatabase(db, {
        familyId: familyAId,
        taskRunId: selectedRunId,
      }),
      {
        status: "recovered",
        delivery: {
          status: "done",
          deliveredChannel: "none",
          deliveredCount: 1,
          failedCount: 0,
        },
      },
    );
    const [recovered] = await db<{
      deliveries: number;
      uses: number;
      artifacts: number;
      preparationDelivered: boolean;
      runStatus: string;
    }[]>`
      select
        (select count(*)::integer from public.conversation_deliveries
          where task_run_id = ${selectedRunId}) as deliveries,
        (select count(*)::integer from public.family_knowledge_use
          where task_run_id = ${selectedRunId}) as uses,
        (select jsonb_array_length(artifacts) from public.homa_task_runs
          where id = ${selectedRunId}) as artifacts,
        (select delivered_at is not null from public.research_brief_preparations
          where task_run_id = ${selectedRunId}) as "preparationDelivered",
        (select status from public.homa_task_runs
          where id = ${selectedRunId}) as "runStatus"
    `;
    assert.deepEqual(recovered, {
      deliveries: 0,
      uses: 1,
      artifacts: 1,
      preparationDelivered: true,
      runStatus: "done",
    });
  });

  it("recovers one accepted delivery without duplicating delivery or effects", async () => {
    const db = harness.database();
    const selectedRunId = runId(21);
    const messageId = "00000000-0000-4000-a000-000000000001";
    const deliveryId = "00000000-0000-4000-b000-000000000001";
    const draft = "Prepared recovery draft";
    await db`
      insert into public.research_brief_preparations (
        task_run_id, family_id, child_id, knowledge_bank_id, observation_id,
        draft, draft_hash, source_snapshot, prepared_at
      )
      values (
        ${selectedRunId}, ${familyAId}, ${childAId}, ${recoveryKnowledgeId},
        ${observationId(3)}, ${draft}, ${"h".repeat(64)},
        ${db.json({
          kind: "knowledge_cited",
          id: recoveryKnowledgeId,
          title: "Recovered research",
          sourceNames: ["Recovery Source"],
          citationUrls: ["https://example.test/recovery"],
        })}, now()
      )
    `;
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, visibility
      )
      values (
        ${messageId}, ${familyAId}, ${selectedRunId}, 'assistant', 'internal'
      )
    `;
    await db`
      insert into public.conversation_deliveries (
        id, family_id, message_id, task_run_id, channel, status, sent_at
      )
      values (
        ${deliveryId}, ${familyAId}, ${messageId}, ${selectedRunId},
        'email', 'sent', now()
      )
    `;

    assert.deepEqual(
      await recoverPreparedResearchBriefDeliveryWithDatabase(db, {
        familyId: familyAId,
        taskRunId: selectedRunId,
      }),
      {
        status: "recovered",
        delivery: {
          status: "done",
          deliveredChannel: "email",
          deliveredCount: 1,
          failedCount: 0,
        },
      },
    );
    assert.deepEqual(
      await recoverPreparedResearchBriefDeliveryWithDatabase(db, {
        familyId: familyAId,
        taskRunId: selectedRunId,
      }),
      { status: "not_found" },
    );

    const [result] = await db<{
      deliveries: number;
      uses: number;
      artifacts: number;
      observationStatus: string;
      preparationDelivered: boolean;
      messageVisibility: string;
      runStatus: string;
      runSummary: string;
      deliveredChannel: string;
      finished: boolean;
    }[]>`
      select
        (select count(*)::integer from public.conversation_deliveries
          where task_run_id = ${selectedRunId}) as deliveries,
        (select count(*)::integer from public.family_knowledge_use
          where task_run_id = ${selectedRunId}) as uses,
        (select jsonb_array_length(artifacts) from public.homa_task_runs
          where id = ${selectedRunId}) as artifacts,
        (select status from public.child_observations
          where id = ${observationId(3)}) as "observationStatus",
        (select delivered_at is not null from public.research_brief_preparations
          where task_run_id = ${selectedRunId}) as "preparationDelivered",
        (select visibility from public.conversation_messages
          where id = ${messageId}) as "messageVisibility",
        (select status from public.homa_task_runs
          where id = ${selectedRunId}) as "runStatus",
        (select summary from public.homa_task_runs
          where id = ${selectedRunId}) as "runSummary",
        (select delivered_channel from public.homa_task_runs
          where id = ${selectedRunId}) as "deliveredChannel",
        (select finished_at is not null from public.homa_task_runs
          where id = ${selectedRunId}) as finished
    `;
    assert.deepEqual(result, {
      deliveries: 1,
      uses: 1,
      artifacts: 1,
      observationStatus: "used",
      preparationDelivered: true,
      messageVisibility: "family",
      runStatus: "done",
      runSummary: draft,
      deliveredChannel: "email",
      finished: true,
    });
  });

  it("turns a provider-accepted pending ledger row into uncertain without effects", async () => {
    const db = harness.database();
    const selectedRunId = runId(24);
    const messageId = "00000000-0000-4000-a000-000000000004";
    await db`
      insert into public.research_brief_preparations (
        task_run_id, family_id, child_id, knowledge_bank_id, observation_id,
        draft, draft_hash, source_snapshot, prepared_at
      )
      values (
        ${selectedRunId}, ${familyAId}, ${childAId}, ${recoveryKnowledgeId},
        ${observationId(4)}, 'Pending provider receipt', ${"j".repeat(64)},
        ${db.json({
          kind: "knowledge_cited",
          id: recoveryKnowledgeId,
          title: "Recovered research",
          sourceNames: ["Recovery Source"],
          citationUrls: ["https://example.test/recovery"],
        })}, now()
      )
    `;
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, visibility
      )
      values (
        ${messageId}, ${familyAId}, ${selectedRunId}, 'assistant', 'internal'
      )
    `;
    await db`
      insert into public.conversation_deliveries (
        id, family_id, message_id, task_run_id, recipient_member_user_id,
        channel, status
      )
      values (
        ${"00000000-0000-4000-b000-000000000004"}, ${familyAId},
        ${messageId}, ${selectedRunId}, ${adultAId}, 'sms', 'pending'
      )
    `;

    assert.deepEqual(
      await recoverPreparedResearchBriefDeliveryWithDatabase(db, {
        familyId: familyAId,
        taskRunId: selectedRunId,
      }),
      {
        status: "recovered",
        delivery: {
          status: "uncertain",
          deliveredChannel: null,
          deliveredCount: 0,
          failedCount: 0,
        },
      },
    );
    const [result] = await db<{
      deliveryStatus: string;
      runStatus: string;
      uses: number;
      preparationDelivered: boolean;
      observationStatus: string;
      messageVisibility: string;
    }[]>`
      select
        (select status from public.conversation_deliveries
          where task_run_id = ${selectedRunId}) as "deliveryStatus",
        (select status from public.homa_task_runs
          where id = ${selectedRunId}) as "runStatus",
        (select count(*)::integer from public.family_knowledge_use
          where task_run_id = ${selectedRunId}) as uses,
        (select delivered_at is not null from public.research_brief_preparations
          where task_run_id = ${selectedRunId}) as "preparationDelivered",
        (select status from public.child_observations
          where id = ${observationId(4)}) as "observationStatus",
        (select visibility from public.conversation_messages
          where id = ${messageId}) as "messageVisibility"
    `;
    assert.deepEqual(result, {
      deliveryStatus: "uncertain",
      runStatus: "uncertain",
      uses: 0,
      preparationDelivered: false,
      observationStatus: "new",
      messageVisibility: "internal",
    });
  });

  it("recovers all durable recipient attempts as partial", async () => {
    const db = harness.database();
    const selectedRunId = runId(25);
    const messageId = "00000000-0000-4000-a000-000000000005";
    await db`
      insert into public.research_brief_preparations (
        task_run_id, family_id, child_id, knowledge_bank_id, draft,
        draft_hash, source_snapshot, prepared_at
      )
      values (
        ${selectedRunId}, ${familyAId}, ${childAId}, ${recoveryKnowledgeId},
        'Partial recovery draft', ${"k".repeat(64)},
        ${db.json({
          kind: "knowledge_cited",
          id: recoveryKnowledgeId,
          title: "Recovered research",
          sourceNames: ["Recovery Source"],
          citationUrls: ["https://example.test/recovery"],
        })}, now()
      )
    `;
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, visibility
      )
      values (
        ${messageId}, ${familyAId}, ${selectedRunId}, 'assistant', 'internal'
      )
    `;
    await db`
      insert into public.conversation_deliveries (
        id, family_id, message_id, task_run_id, recipient_member_user_id,
        channel, status, sent_at
      )
      values
        (
          ${"00000000-0000-4000-b000-000000000005"}, ${familyAId},
          ${messageId}, ${selectedRunId}, ${adultAId}, 'sms', 'sent', now()
        ),
        (
          ${"00000000-0000-4000-b000-000000000006"}, ${familyAId},
          ${messageId}, ${selectedRunId}, ${adultBId}, 'sms', 'failed', null
        )
    `;

    assert.deepEqual(
      await recoverPreparedResearchBriefDeliveryWithDatabase(db, {
        familyId: familyAId,
        taskRunId: selectedRunId,
      }),
      {
        status: "recovered",
        delivery: {
          status: "partial",
          deliveredChannel: "sms",
          deliveredCount: 1,
          failedCount: 1,
        },
      },
    );
    const [result] = await db<{
      runStatus: string;
      deliveredChannel: string;
      uses: number;
      preparationDelivered: boolean;
      messageVisibility: string;
    }[]>`
      select
        (select status from public.homa_task_runs
          where id = ${selectedRunId}) as "runStatus",
        (select delivered_channel from public.homa_task_runs
          where id = ${selectedRunId}) as "deliveredChannel",
        (select count(*)::integer from public.family_knowledge_use
          where task_run_id = ${selectedRunId}) as uses,
        (select delivered_at is not null from public.research_brief_preparations
          where task_run_id = ${selectedRunId}) as "preparationDelivered",
        (select visibility from public.conversation_messages
          where id = ${messageId}) as "messageVisibility"
    `;
    assert.deepEqual(result, {
      runStatus: "partial",
      deliveredChannel: "sms",
      uses: 1,
      preparationDelivered: true,
      messageVisibility: "family",
    });
  });

  it("keeps a running v2 run open through an early bounce, then finalizes the locked multi-recipient aggregate", async () => {
    const db = harness.database();
    const selectedRunId = runId(68);
    const messageId = "00000000-0000-4000-a000-000000000068";
    await db`
      insert into public.homa_task_runs (
        id, family_id, kind, status, title, delivery_version
      )
      values (
        ${selectedRunId}, ${familyAId}, 'morning_brief', 'running',
        'Early bounce race', 'research_brief_v2'
      )
    `;
    await db`
      insert into public.research_brief_preparations (
        task_run_id, family_id, child_id, knowledge_bank_id, draft,
        draft_hash, source_snapshot, prepared_at
      )
      values (
        ${selectedRunId}, ${familyAId}, ${childAId},
        ${finalizationKnowledgeId}, 'Early bounce prepared draft',
        ${"q".repeat(64)}, ${db.json({
          kind: "knowledge_cited",
          id: finalizationKnowledgeId,
          title: "Early bounce research",
          sourceNames: ["Test Source"],
          citationUrls: ["https://example.test/early-bounce"],
        })}, now()
      )
    `;
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, visibility
      )
      values (
        ${messageId}, ${familyAId}, ${selectedRunId}, 'assistant', 'internal'
      )
    `;
    await db`
      insert into public.conversation_deliveries (
        family_id, message_id, task_run_id, recipient_member_user_id,
        destination_hash, channel, status, provider_submission_id, sent_at
      )
      values
        (
          ${familyAId}, ${messageId}, ${selectedRunId}, ${adultAId},
          ${"e".repeat(64)}, 'sms', 'sent', null, now()
        ),
        (
          ${familyAId}, ${messageId}, ${selectedRunId}, ${adultBId},
          ${"f".repeat(64)}, 'email', 'sent', 'early-bounce-68', now()
        )
    `;

    const deliveredWebhook = await applyResendWebhookReceiptWithDatabase(db, {
      emailId: "early-bounce-68",
      eventType: "email.delivered",
      ledgerStatus: "delivered",
      failsDelivery: false,
    });
    assert.equal(deliveredWebhook.recomputedTaskRuns, 0);
    const webhook = await applyResendWebhookReceiptWithDatabase(db, {
      emailId: "early-bounce-68",
      eventType: "email.bounced",
      ledgerStatus: "bounced",
      failsDelivery: true,
    });
    assert.equal(webhook.recomputedTaskRuns, 0);
    const [beforeFinalization] = await db<{ status: string }[]>`
      select status from public.homa_task_runs where id = ${selectedRunId}
    `;
    assert.equal(beforeFinalization.status, "running");

    const finalized =
      await finalizePreparedResearchBriefDeliveryWithDatabase(db, {
        familyId: familyAId,
        taskRunId: selectedRunId,
        canonicalMessageId: messageId,
        sessionId: "early-bounce-session",
      });
    assert.equal(finalized?.delivery.status, "partial");
    const [afterFinalization] = await db<{
      status: string;
      deliveredChannel: string | null;
      sessionId: string | null;
      finished: boolean;
      visibility: string;
      uses: number;
    }[]>`
      select
        r.status,
        r.delivered_channel as "deliveredChannel",
        r.session_id as "sessionId",
        r.finished_at is not null as finished,
        m.visibility,
        (
          select count(*)::integer from public.family_knowledge_use u
          where u.task_run_id = r.id
        ) as uses
      from public.homa_task_runs r
      join public.conversation_messages m on m.task_run_id = r.id
      where r.id = ${selectedRunId}
    `;
    assert.deepEqual(afterFinalization, {
      status: "partial",
      deliveredChannel: "sms",
      sessionId: "early-bounce-session",
      finished: true,
      visibility: "family",
      uses: 1,
    });
  });

  it("reconciles a bounce after atomic v2 completion without a later dispatch finish overwrite", async () => {
    const db = harness.database();
    const selectedRunId = runId(69);
    const messageId = "00000000-0000-4000-a000-000000000069";
    await db`
      insert into public.homa_task_runs (
        id, family_id, kind, status, title, delivery_version
      )
      values (
        ${selectedRunId}, ${familyAId}, 'morning_brief', 'running',
        'Late bounce race', 'research_brief_v2'
      )
    `;
    await db`
      insert into public.research_brief_preparations (
        task_run_id, family_id, child_id, knowledge_bank_id, draft,
        draft_hash, source_snapshot, prepared_at
      )
      values (
        ${selectedRunId}, ${familyAId}, ${childAId},
        ${finalizationKnowledgeId}, 'Late bounce prepared draft',
        ${"w".repeat(64)}, ${db.json({
          kind: "knowledge_cited",
          id: finalizationKnowledgeId,
          title: "Late bounce research",
          sourceNames: ["Test Source"],
          citationUrls: ["https://example.test/late-bounce"],
        })}, now()
      )
    `;
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, visibility
      )
      values (
        ${messageId}, ${familyAId}, ${selectedRunId}, 'assistant', 'internal'
      )
    `;
    await db`
      insert into public.conversation_deliveries (
        family_id, message_id, task_run_id, recipient_member_user_id,
        destination_hash, channel, status, provider_submission_id, sent_at
      )
      values (
        ${familyAId}, ${messageId}, ${selectedRunId}, ${adultAId},
        ${"g".repeat(64)}, 'email', 'sent', 'late-bounce-69', now()
      )
    `;

    const finalized =
      await finalizePreparedResearchBriefDeliveryWithDatabase(db, {
        familyId: familyAId,
        taskRunId: selectedRunId,
        canonicalMessageId: messageId,
        sessionId: "late-bounce-session",
      });
    assert.equal(finalized?.delivery.status, "done");
    const [completed] = await db<{
      status: string;
      sessionId: string | null;
      finished: boolean;
    }[]>`
      select status, session_id as "sessionId",
             finished_at is not null as finished
      from public.homa_task_runs
      where id = ${selectedRunId}
    `;
    assert.deepEqual(completed, {
      status: "done",
      sessionId: "late-bounce-session",
      finished: true,
    });

    const webhook = await applyResendWebhookReceiptWithDatabase(db, {
      emailId: "late-bounce-69",
      eventType: "email.bounced",
      ledgerStatus: "bounced",
      failsDelivery: true,
    });
    assert.equal(webhook.recomputedTaskRuns, 1);
    const [reconciled] = await db<{
      status: string;
      deliveredChannel: string | null;
      sessionId: string | null;
    }[]>`
      select status, delivered_channel as "deliveredChannel",
             session_id as "sessionId"
      from public.homa_task_runs
      where id = ${selectedRunId}
    `;
    assert.deepEqual(reconciled, {
      status: "failed",
      deliveredChannel: null,
      sessionId: "late-bounce-session",
    });
  });

});
