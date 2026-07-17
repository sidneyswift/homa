import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import type { Sql } from "postgres";

import { applyResendWebhookReceiptWithDatabase } from "../email-webhook";
import {
  adultAId,
  adultBId,
  childAId,
  createDisposableResearchBriefPostgresHarness,
  familyAId,
  knowledgeId,
  observationId,
  recoveryKnowledgeId,
  runId,
} from "./research-brief-postgres-harness";
import {
  finalizePreparedResearchBriefDeliveryWithDatabase,
  recoverPreparedResearchBriefDeliveryWithDatabase,
} from "./research-brief-store";
import { recoverPreparedResearchBriefFromDurableDelivery } from "./research-brief-delivery";
import { emitResearchBriefRecoveryCompletion } from "./research-brief-events";
import {
  finishStaleTaskRunFromDurableDeliveriesWithDatabase,
  finishTaskRunWithDatabase,
  loadLegacyStaleTaskRunOutcomeWithDatabase,
} from "./store";

const harness = createDisposableResearchBriefPostgresHarness("recovery");

interface RecoveryDeliveryFixture {
  memberUserId: string | null;
  destinationHash?: string;
  channel: "sms" | "email";
  status: "pending" | "sent" | "failed" | "uncertain";
}

async function insertRecoveryFixture(
  database: Sql,
  input: {
    runSequence: number;
    messageId: string;
    draft: string;
    deliveries: RecoveryDeliveryFixture[];
  },
): Promise<void> {
  const selectedRunId = runId(input.runSequence);
  await database`
    insert into public.research_brief_preparations (
      task_run_id, family_id, child_id, knowledge_bank_id, draft,
      draft_hash, source_snapshot, prepared_at
    )
    values (
      ${selectedRunId}, ${familyAId}, ${childAId}, ${recoveryKnowledgeId},
      ${input.draft}, ${"r".repeat(64)},
      ${database.json({
        kind: "knowledge_cited",
        id: recoveryKnowledgeId,
        title: "Recovered research",
        sourceNames: ["Recovery Source"],
        citationUrls: ["https://example.test/recovery"],
      })}, now()
    )
  `;
  await database`
    insert into public.conversation_messages (
      id, family_id, task_run_id, role, visibility
    )
    values (
      ${input.messageId}, ${familyAId}, ${selectedRunId},
      'assistant', 'internal'
    )
  `;
  for (const [index, delivery] of input.deliveries.entries()) {
    await database`
      insert into public.conversation_deliveries (
        family_id, message_id, task_run_id, recipient_member_user_id,
        destination_hash, channel, status, sent_at
      )
      values (
        ${familyAId}, ${input.messageId}, ${selectedRunId},
        ${delivery.memberUserId},
        ${delivery.destinationHash ?? `recovery-${input.runSequence}-${index}`},
        ${delivery.channel}, ${delivery.status},
        ${delivery.status === "sent" ? new Date().toISOString() : null}
      )
    `;
  }
}

describe("research brief PostgreSQL recovery and stale runs", () => {
  before(async () => await harness.start());
  after(async () => await harness.stop());

  it("recovers sent and pending recipients as partial uncertainty", async () => {
    const db = harness.database();
    const selectedRunId = runId(26);
    await insertRecoveryFixture(db, {
      runSequence: 26,
      messageId: "00000000-0000-4000-a000-000000000006",
      draft: "Partial uncertain recovery draft",
      deliveries: [
        {
          memberUserId: adultAId,
          channel: "email",
          status: "sent",
        },
        {
          memberUserId: adultBId,
          channel: "sms",
          status: "pending",
        },
      ],
    });

    assert.deepEqual(
      await recoverPreparedResearchBriefDeliveryWithDatabase(db, {
        familyId: familyAId,
        taskRunId: selectedRunId,
      }),
      {
        status: "recovered",
        delivery: {
          status: "partial_uncertain",
          deliveredChannel: "email",
          deliveredCount: 1,
          failedCount: 0,
        },
      },
    );
    const [result] = await db<{
      runStatus: string;
      deliveredChannel: string;
      pendingStatus: string;
      uses: number;
      messageVisibility: string;
    }[]>`
      select
        (select status from public.homa_task_runs
          where id = ${selectedRunId}) as "runStatus",
        (select delivered_channel from public.homa_task_runs
          where id = ${selectedRunId}) as "deliveredChannel",
        (select status from public.conversation_deliveries
          where task_run_id = ${selectedRunId}
            and recipient_member_user_id = ${adultBId}) as "pendingStatus",
        (select count(*)::integer from public.family_knowledge_use
          where task_run_id = ${selectedRunId}) as uses,
        (select visibility from public.conversation_messages
          where task_run_id = ${selectedRunId}) as "messageVisibility"
    `;
    assert.deepEqual(result, {
      runStatus: "partial_uncertain",
      deliveredChannel: "email",
      pendingStatus: "uncertain",
      uses: 1,
      messageVisibility: "family",
    });
  });

  it("keeps distinct loose-phone sent and failed recipients partial", async () => {
    const db = harness.database();
    const selectedRunId = runId(29);
    await insertRecoveryFixture(db, {
      runSequence: 29,
      messageId: "00000000-0000-4000-a000-000000000029",
      draft: "Loose phone partial draft",
      deliveries: [
        {
          memberUserId: null,
          destinationHash: "a".repeat(64),
          channel: "sms",
          status: "sent",
        },
        {
          memberUserId: null,
          destinationHash: "b".repeat(64),
          channel: "sms",
          status: "failed",
        },
      ],
    });

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
  });

  it("keeps distinct loose-phone sent and uncertain recipients partial uncertain", async () => {
    const db = harness.database();
    const selectedRunId = runId(30);
    await insertRecoveryFixture(db, {
      runSequence: 30,
      messageId: "00000000-0000-4000-a000-000000000030",
      draft: "Loose phone uncertain draft",
      deliveries: [
        {
          memberUserId: null,
          destinationHash: "c".repeat(64),
          channel: "email",
          status: "sent",
        },
        {
          memberUserId: null,
          destinationHash: "d".repeat(64),
          channel: "sms",
          status: "uncertain",
        },
      ],
    });

    assert.deepEqual(
      await recoverPreparedResearchBriefDeliveryWithDatabase(db, {
        familyId: familyAId,
        taskRunId: selectedRunId,
      }),
      {
        status: "recovered",
        delivery: {
          status: "partial_uncertain",
          deliveredChannel: "email",
          deliveredCount: 1,
          failedCount: 0,
        },
      },
    );
  });

  it("does not treat a legacy sent morning brief as a v2 recovery", async () => {
    const db = harness.database();
    const selectedRunId = runId(22);
    const messageId = "00000000-0000-4000-a000-000000000002";
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
        family_id, message_id, task_run_id, channel, status, sent_at
      )
      values (
        ${familyAId}, ${messageId}, ${selectedRunId}, 'sms', 'sent', now()
      )
    `;

    assert.deepEqual(
      await recoverPreparedResearchBriefDeliveryWithDatabase(db, {
        familyId: familyAId,
        taskRunId: selectedRunId,
      }),
      { status: "not_found" },
    );
    const [run] = await db<{ status: string }[]>`
      select status from public.homa_task_runs where id = ${selectedRunId}
    `;
    assert.equal(run?.status, "running");
  });

  it("does not consume an observation when delivery never succeeds", async () => {
    const db = harness.database();
    await db`
      insert into public.research_brief_preparations (
        task_run_id, family_id, child_id, knowledge_bank_id, observation_id,
        draft, draft_hash, source_snapshot, prepared_at
      )
      values (
        ${runId(7)}, ${familyAId}, ${childAId}, ${knowledgeId},
        ${observationId(1)}, 'Never delivered', ${"f".repeat(64)},
        '{}'::jsonb, now()
      )
    `;
    const [result] = await db<{
      uses: number;
      deliveredAt: string | null;
      observationStatus: string;
      observationUsedAt: string | null;
    }[]>`
      select
        (
          select count(*)::integer from public.family_knowledge_use
          where task_run_id = ${runId(7)}
        ) as uses,
        p.delivered_at::text as "deliveredAt",
        o.status as "observationStatus",
        o.used_at::text as "observationUsedAt"
      from public.research_brief_preparations p
      join public.child_observations o on o.id = p.observation_id
      where p.task_run_id = ${runId(7)}
    `;
    assert.deepEqual(result, {
      uses: 0,
      deliveredAt: null,
      observationStatus: "new",
      observationUsedAt: null,
    });
  });

  it("does not let a stale snapshot overwrite a concurrent completion", async () => {
    const db = harness.database();
    const selectedRunId = runId(27);
    await db`
      update public.homa_task_runs
      set status = 'done', summary = 'Dispatch completed', finished_at = now()
      where id = ${selectedRunId}
    `;

    assert.equal(
      await finishTaskRunWithDatabase(db, selectedRunId, {
        familyId: familyAId,
        kind: "morning_brief",
        status: "failed",
        error: "stale reaper result",
        onlyIfRunning: true,
      }),
      false,
    );
    const [result] = await db<{ status: string; summary: string }[]>`
      select status, summary from public.homa_task_runs
      where id = ${selectedRunId}
    `;
    assert.deepEqual(result, {
      status: "done",
      summary: "Dispatch completed",
    });
  });

  it("keeps a legacy pending-only stale run classified as failed", async () => {
    const db = harness.database();
    const selectedRunId = runId(28);
    const messageId = "00000000-0000-4000-a000-000000000028";
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
        family_id, message_id, task_run_id, channel, status
      )
      values (
        ${familyAId}, ${messageId}, ${selectedRunId}, 'sms', 'pending'
      )
    `;
    assert.deepEqual(
      await loadLegacyStaleTaskRunOutcomeWithDatabase(db, {
        taskRunId: selectedRunId,
        deliveredChannel: null,
        summary: null,
      }),
      { status: "failed", hasAcceptedOrUncertainDelivery: false },
    );
    const [delivery] = await db<{ status: string }[]>`
      select status from public.conversation_deliveries
      where task_run_id = ${selectedRunId}
    `;
    assert.equal(delivery?.status, "pending");
  });

  it("discards a stale recovery snapshot after a bounce and emits the finalization aggregate", async () => {
    const db = harness.database();
    const selectedRunId = runId(75);
    const messageId = "00000000-0000-4000-a000-000000000075";
    await db`
      insert into public.homa_task_runs (
        id, family_id, kind, status, title, delivery_version
      )
      values (
        ${selectedRunId}, ${familyAId}, 'morning_brief', 'running',
        'Recovery snapshot race', 'research_brief_v2'
      )
    `;
    await db`
      insert into public.research_brief_preparations (
        task_run_id, family_id, child_id, knowledge_bank_id, draft,
        draft_hash, source_snapshot, prepared_at
      )
      values (
        ${selectedRunId}, ${familyAId}, ${childAId}, ${recoveryKnowledgeId},
        'Recovery snapshot race draft', ${"v".repeat(64)},
        ${db.json({
          kind: "knowledge_cited",
          id: recoveryKnowledgeId,
          title: "Recovery race research",
          sourceNames: ["Recovery Source"],
          citationUrls: ["https://example.test/recovery-race"],
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
          'recovery-race-sms', 'sms', 'sent', null, now()
        ),
        (
          ${familyAId}, ${messageId}, ${selectedRunId}, ${adultBId},
          'recovery-race-email', 'email', 'sent',
          'recovery-race-bounce-75', now()
        )
    `;

    const recovery = await recoverPreparedResearchBriefFromDurableDelivery(
      { familyId: familyAId, taskRunId: selectedRunId },
      {
        loadDelivery: async () => ({
          messageId,
          delivery: {
            status: "done",
            deliveredChannel: "sms",
            deliveredCount: 2,
            failedCount: 0,
          },
        }),
        finalize: async () => {
          await applyResendWebhookReceiptWithDatabase(db, {
            emailId: "recovery-race-bounce-75",
            eventType: "email.bounced",
            ledgerStatus: "bounced",
            failsDelivery: true,
          });
          return await finalizePreparedResearchBriefDeliveryWithDatabase(db, {
            familyId: familyAId,
            taskRunId: selectedRunId,
            canonicalMessageId: messageId,
          });
        },
        logRecoveryPending: () =>
          assert.fail("authoritative finalization succeeded"),
      },
    );
    assert.deepEqual(recovery, {
      status: "recovered",
      delivery: {
        status: "partial",
        deliveredChannel: "sms",
        deliveredCount: 1,
        failedCount: 1,
      },
    });
    const events: Array<{ name: string; props: object }> = [];
    await emitResearchBriefRecoveryCompletion(
      familyAId,
      recovery,
      async (name, props) => {
        events.push({ name, props });
      },
    );
    assert.deepEqual(events, [
      {
        name: "tasks.run_completed",
        props: {
          family_id: familyAId,
          kind: "morning_brief",
          status: "partial",
        },
      },
      {
        name: "research.brief_sent",
        props: { family_id: familyAId, channel: "sms" },
      },
    ]);
  });

  it("fails model-crash runs with no output for every family task kind", async () => {
    const db = harness.database();
    const fixtures = [
      { sequence: 80, kind: "journal_prompt" as const, version: "legacy" },
      { sequence: 81, kind: "custom" as const, version: "legacy" },
      { sequence: 82, kind: "morning_brief" as const, version: "legacy" },
      {
        sequence: 83,
        kind: "morning_brief" as const,
        version: "research_brief_v2",
      },
    ];
    for (const fixture of fixtures) {
      await db`
        insert into public.homa_task_runs (
          id, family_id, kind, status, title, delivery_version
        )
        values (
          ${runId(fixture.sequence)}, ${familyAId}, ${fixture.kind}, 'running',
          'No-output fixture', ${fixture.version}
        )
      `;
      const result =
        await finishStaleTaskRunFromDurableDeliveriesWithDatabase(db, {
          runId: runId(fixture.sequence),
          familyId: familyAId,
          kind: fixture.kind,
        });
      assert.deepEqual(result, {
        finished: true,
        delivery: {
          status: "failed",
          deliveredChannel: null,
          deliveredCount: 0,
          failedCount: 0,
        },
      });
      assert.deepEqual(
        await finishStaleTaskRunFromDurableDeliveriesWithDatabase(db, {
          runId: runId(fixture.sequence),
          familyId: familyAId,
          kind: fixture.kind,
        }),
        { finished: false, delivery: null },
      );
    }
    const runs = await db<{
      status: string;
      error: string | null;
      running: boolean;
    }[]>`
      select status, error, status = 'running' as running
      from public.homa_task_runs
      where id in (${runId(80)}, ${runId(81)}, ${runId(82)}, ${runId(83)})
      order by id
    `;
    assert.equal(runs.every((run) => run.status === "failed"), true);
    assert.equal(runs.every((run) => run.running === false), true);
    assert.equal(
      runs.every(
        (run) => run.error === "stale task produced no canonical output",
      ),
      true,
    );
    assert.equal(
      JSON.stringify(runs).includes(familyAId),
      false,
    );
  });

  it("preserves a stale run when delivery or save-only evidence exists without an assistant message", async () => {
    const db = harness.database();
    const deliveryRunId = runId(85);
    const saveOnlyRunId = runId(86);
    const userMessageId = "00000000-0000-4000-a000-000000000085";
    await db`
      insert into public.homa_task_runs (
        id, family_id, kind, status, title, delivered_channel, summary
      )
      values
        (
          ${deliveryRunId}, ${familyAId}, 'custom', 'running',
          'Missing assistant with delivery', null, null
        ),
        (
          ${saveOnlyRunId}, ${familyAId}, 'custom', 'running',
          'Missing assistant save-only', 'none', 'Saved output'
        )
    `;
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, visibility
      )
      values (
        ${userMessageId}, ${familyAId}, ${deliveryRunId}, 'user', 'family'
      )
    `;
    await db`
      insert into public.conversation_deliveries (
        family_id, message_id, task_run_id, recipient_member_user_id,
        destination_hash, channel, status, sent_at
      )
      values (
        ${familyAId}, ${userMessageId}, ${deliveryRunId}, ${adultAId},
        'missing-assistant-delivery', 'sms', 'sent', now()
      )
    `;

    for (const taskRunId of [deliveryRunId, saveOnlyRunId]) {
      assert.deepEqual(
        await finishStaleTaskRunFromDurableDeliveriesWithDatabase(db, {
          runId: taskRunId,
          familyId: familyAId,
          kind: "custom",
        }),
        { finished: false, delivery: null },
      );
    }
    const states = await db<{ status: string }[]>`
      select status from public.homa_task_runs
      where id in (${deliveryRunId}, ${saveOnlyRunId})
      order by id
    `;
    assert.deepEqual(states.map((row) => row.status), ["running", "running"]);
  });

  it("rechecks delivery evidence after waiting for the stale run lock", async () => {
    const db = harness.database();
    const selectedRunId = runId(88);
    const userMessageId = "00000000-0000-4000-a000-000000000088";
    await db`
      insert into public.homa_task_runs (
        id, family_id, kind, status, title
      )
      values (
        ${selectedRunId}, ${familyAId}, 'custom', 'running',
        'Concurrent delivery evidence fixture'
      )
    `;
    let releaseEvidence!: () => void;
    let reportEvidenceLocked!: () => void;
    const evidenceLocked = new Promise<void>((resolve) => {
      reportEvidenceLocked = resolve;
    });
    const evidenceRelease = new Promise<void>((resolve) => {
      releaseEvidence = resolve;
    });
    const insertEvidence = db.begin(async (transaction) => {
      await transaction`
        select id from public.homa_task_runs
        where id = ${selectedRunId}
        for update
      `;
      await transaction`
        insert into public.conversation_messages (
          id, family_id, task_run_id, role, visibility
        )
        values (
          ${userMessageId}, ${familyAId}, ${selectedRunId}, 'user', 'family'
        )
      `;
      await transaction`
        insert into public.conversation_deliveries (
          family_id, message_id, task_run_id, recipient_member_user_id,
          destination_hash, channel, status, sent_at
        )
        values (
          ${familyAId}, ${userMessageId}, ${selectedRunId}, ${adultAId},
          'concurrent-delivery-evidence', 'sms', 'sent', now()
        )
      `;
      reportEvidenceLocked();
      await evidenceRelease;
    });
    await evidenceLocked;
    const staleFinish =
      finishStaleTaskRunFromDurableDeliveriesWithDatabase(db, {
        runId: selectedRunId,
        familyId: familyAId,
        kind: "custom",
      });
    await delay(50);
    releaseEvidence();
    await insertEvidence;
    assert.deepEqual(await staleFinish, {
      finished: false,
      delivery: null,
    });
    const [run] = await db<{ status: string }[]>`
      select status from public.homa_task_runs where id = ${selectedRunId}
    `;
    assert.equal(run?.status, "running");
  });

  it("rechecks a save-only receipt after waiting for the stale run lock", async () => {
    const db = harness.database();
    const selectedRunId = runId(89);
    await db`
      insert into public.homa_task_runs (
        id, family_id, kind, status, title
      )
      values (
        ${selectedRunId}, ${familyAId}, 'custom', 'running',
        'Concurrent save-only receipt fixture'
      )
    `;
    let releaseReceipt!: () => void;
    let reportReceiptLocked!: () => void;
    const receiptLocked = new Promise<void>((resolve) => {
      reportReceiptLocked = resolve;
    });
    const receiptRelease = new Promise<void>((resolve) => {
      releaseReceipt = resolve;
    });
    const recordReceipt = db.begin(async (transaction) => {
      await transaction`
        select id from public.homa_task_runs
        where id = ${selectedRunId}
        for update
      `;
      await transaction`
        update public.homa_task_runs
        set delivered_channel = 'none', summary = 'Saved output'
        where id = ${selectedRunId}
      `;
      reportReceiptLocked();
      await receiptRelease;
    });
    await receiptLocked;
    const staleFinish =
      finishStaleTaskRunFromDurableDeliveriesWithDatabase(db, {
        runId: selectedRunId,
        familyId: familyAId,
        kind: "custom",
      });
    await delay(50);
    releaseReceipt();
    await recordReceipt;
    assert.deepEqual(await staleFinish, {
      finished: false,
      delivery: null,
    });
    const [run] = await db<{
      status: string;
      deliveredChannel: string | null;
      summary: string | null;
    }[]>`
      select status, delivered_channel as "deliveredChannel", summary
      from public.homa_task_runs
      where id = ${selectedRunId}
    `;
    assert.deepEqual(run, {
      status: "running",
      deliveredChannel: "none",
      summary: "Saved output",
    });
  });

  it("does not overwrite a concurrent completion while failing no-output work", async () => {
    const db = harness.database();
    const selectedRunId = runId(87);
    await db`
      insert into public.homa_task_runs (
        id, family_id, kind, status, title
      )
      values (
        ${selectedRunId}, ${familyAId}, 'custom', 'running',
        'Concurrent no-output fixture'
      )
    `;
    let releaseCompletion!: () => void;
    let reportRunLocked!: () => void;
    const runLocked = new Promise<void>((resolve) => {
      reportRunLocked = resolve;
    });
    const completionRelease = new Promise<void>((resolve) => {
      releaseCompletion = resolve;
    });
    const completeRun = db.begin(async (transaction) => {
      await transaction`
        select id from public.homa_task_runs
        where id = ${selectedRunId}
        for update
      `;
      reportRunLocked();
      await completionRelease;
      await transaction`
        update public.homa_task_runs
        set status = 'done',
            summary = 'Concurrent completion',
            finished_at = now()
        where id = ${selectedRunId}
      `;
    });
    await runLocked;
    const staleFinish =
      finishStaleTaskRunFromDurableDeliveriesWithDatabase(db, {
        runId: selectedRunId,
        familyId: familyAId,
        kind: "custom",
      });
    await delay(50);
    releaseCompletion();
    await completeRun;
    assert.deepEqual(
      await staleFinish,
      { finished: false, delivery: null },
    );
    const [run] = await db<{ status: string; summary: string | null }[]>`
      select status, summary from public.homa_task_runs
      where id = ${selectedRunId}
    `;
    assert.deepEqual(run, {
      status: "done",
      summary: "Concurrent completion",
    });
  });
});
