import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  beginDeliveryAttemptWithDatabase,
  enrichDeliveryAttemptProviderMessageIdWithDatabase,
  finishDeliveryAttemptWithDatabase,
} from "../conversation-continuity/delivery-ledger";
import { deliverReactiveEmailWithRetry } from "../conversation-continuity/reactive-email-delivery";
import { applyResendWebhookReceiptWithDatabase } from "../email-webhook";
import {
  adultAId,
  adultBId,
  createDisposableResearchBriefPostgresHarness,
  familyAId,
  runId,
} from "./research-brief-postgres-harness";
import {
  finishStaleTaskRunFromDurableDeliveriesWithDatabase,
  finishTaskRunFromDurableDeliveriesWithDatabase,
} from "./store";

const harness = createDisposableResearchBriefPostgresHarness("email_delivery");

async function insertTerminalEmailRun(input: {
  runSequence: number;
  messageId: string;
  deliveredChannel: "sms" | "email";
  deliveries: Array<{
    id: string;
    memberUserId: string | null;
    channel: "sms" | "email";
    status: "sent" | "failed";
    providerSubmissionId?: string;
  }>;
}): Promise<void> {
  const db = harness.database();
  const selectedRunId = runId(input.runSequence);
  await db`
    insert into public.homa_task_runs (
      id, family_id, kind, status, title, delivered_channel, finished_at
    )
    values (
      ${selectedRunId}, ${familyAId}, 'morning_brief', 'done',
      'Email delivery fixture', ${input.deliveredChannel}, now()
    )
  `;
  await db`
    insert into public.conversation_messages (
      id, family_id, task_run_id, role, visibility
    )
    values (
      ${input.messageId}, ${familyAId}, ${selectedRunId},
      'assistant', 'family'
    )
  `;
  for (const [index, delivery] of input.deliveries.entries()) {
    await db`
      insert into public.conversation_deliveries (
        id, family_id, message_id, task_run_id, recipient_member_user_id,
        destination_hash, channel, status, provider_submission_id, sent_at
      )
      values (
        ${delivery.id}, ${familyAId}, ${input.messageId}, ${selectedRunId},
        ${delivery.memberUserId}, ${`email-fixture-${input.runSequence}-${index}`},
        ${delivery.channel}, ${delivery.status},
        ${delivery.providerSubmissionId ?? null},
        ${delivery.status === "sent" ? new Date().toISOString() : null}
      )
    `;
  }
}

describe("email delivery PostgreSQL reconciliation", () => {
  before(async () => await harness.start());
  after(async () => await harness.stop());

  it("recomputes a completed email-fallback run after a hard bounce", async () => {
    await insertTerminalEmailRun({
      runSequence: 61,
      messageId: "00000000-0000-4000-a000-000000000061",
      deliveredChannel: "email",
      deliveries: [
        {
          id: "00000000-0000-4000-b000-000000000061",
          memberUserId: adultAId,
          channel: "sms",
          status: "failed",
        },
        {
          id: "00000000-0000-4000-b000-000000000062",
          memberUserId: adultAId,
          channel: "email",
          status: "sent",
          providerSubmissionId: "resend-bounce-fallback-61",
        },
      ],
    });
    const db = harness.database();
    await applyResendWebhookReceiptWithDatabase(db, {
      emailId: "resend-bounce-fallback-61",
      eventType: "email.bounced",
      ledgerStatus: "bounced",
      failsDelivery: true,
    });
    const [result] = await db<{
      runStatus: string;
      deliveredChannel: string | null;
      emailStatus: string;
    }[]>`
      select r.status as "runStatus",
             r.delivered_channel as "deliveredChannel",
             d.status as "emailStatus"
      from public.homa_task_runs r
      join public.conversation_deliveries d
        on d.task_run_id = r.id and d.channel = 'email'
      where r.id = ${runId(61)}
    `;
    assert.deepEqual(result, {
      runStatus: "failed",
      deliveredChannel: null,
      emailStatus: "failed",
    });
  });

  it("keeps a multi-recipient run partial when another delivery remains sent", async () => {
    await insertTerminalEmailRun({
      runSequence: 62,
      messageId: "00000000-0000-4000-a000-000000000062",
      deliveredChannel: "sms",
      deliveries: [
        {
          id: "00000000-0000-4000-b000-000000000063",
          memberUserId: adultAId,
          channel: "sms",
          status: "sent",
        },
        {
          id: "00000000-0000-4000-b000-000000000064",
          memberUserId: adultBId,
          channel: "email",
          status: "sent",
          providerSubmissionId: "resend-partial-bounce-62",
        },
      ],
    });
    const db = harness.database();
    await applyResendWebhookReceiptWithDatabase(db, {
      emailId: "resend-partial-bounce-62",
      eventType: "email.bounced",
      ledgerStatus: "bounced",
      failsDelivery: true,
    });
    const [result] = await db<{
      status: string;
      delivered_channel: string | null;
    }[]>`
      select status, delivered_channel
      from public.homa_task_runs
      where id = ${runId(62)}
    `;
    assert.deepEqual(result, {
      status: "partial",
      delivered_channel: "sms",
    });
  });

  it("reports an unmatched webhook race and applies the later retry", async () => {
    const db = harness.database();
    const selectedRunId = runId(63);
    const messageId = "00000000-0000-4000-a000-000000000063";
    const deliveryId = "00000000-0000-4000-b000-000000000065";
    await insertTerminalEmailRun({
      runSequence: 63,
      messageId,
      deliveredChannel: "email",
      deliveries: [{
        id: deliveryId,
        memberUserId: adultAId,
        channel: "email",
        status: "sent",
      }],
    });
    const first = await applyResendWebhookReceiptWithDatabase(db, {
      emailId: "resend-race-63",
      eventType: "email.bounced",
      ledgerStatus: "bounced",
      failsDelivery: true,
    });
    assert.deepEqual(first, {
      matched: false,
      matchedEmailSends: 0,
      matchedDeliveries: 0,
      recomputedTaskRuns: 0,
    });
    await db`
      update public.conversation_deliveries
      set provider_submission_id = 'resend-race-63'
      where id = ${deliveryId}
    `;
    assert.equal(
      (
        await applyResendWebhookReceiptWithDatabase(db, {
          emailId: "resend-race-63",
          eventType: "email.bounced",
          ledgerStatus: "bounced",
          failsDelivery: true,
        })
      ).matched,
      true,
    );
    const [run] = await db<{ status: string; delivered_channel: string | null }[]>`
      select status, delivered_channel
      from public.homa_task_runs
      where id = ${selectedRunId}
    `;
    assert.deepEqual(run, { status: "failed", delivered_channel: null });
    assert.equal(
      (
        await applyResendWebhookReceiptWithDatabase(db, {
          emailId: "resend-race-63",
          eventType: "email.bounced",
          ledgerStatus: "bounced",
          failsDelivery: true,
        })
      ).matched,
      true,
    );
  });

  it("acknowledges an idempotent delivered receipt for the map email ledger", async () => {
    const db = harness.database();
    await db`
      insert into public.email_sends (provider_message_id, status)
      values ('resend-map-delivered-64', 'delivered')
    `;
    const result = await applyResendWebhookReceiptWithDatabase(db, {
      emailId: "resend-map-delivered-64",
      eventType: "email.delivered",
      ledgerStatus: "delivered",
      failsDelivery: false,
    });
    assert.equal(result.matched, true);
    assert.equal(result.matchedEmailSends, 1);
  });

  it("clears retry identifiers and rejects stale RFC enrichment", async () => {
    const db = harness.database();
    const selectedRunId = runId(64);
    const messageId = "00000000-0000-4000-a000-000000000064";
    const deliveryId = "00000000-0000-4000-b000-000000000066";
    await db`
      insert into public.homa_task_runs (
        id, family_id, kind, status, title
      )
      values (
        ${selectedRunId}, ${familyAId}, 'morning_brief', 'running',
        'Retry identifiers'
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
        channel, destination_hash, provider_thread_key_hash, status,
        attempt_count, provider_submission_id, provider_message_id
      )
      values (
        ${deliveryId}, ${familyAId}, ${messageId}, ${selectedRunId},
        ${adultAId}, 'email',
        encode(digest('email:parent@example.test', 'sha256'), 'hex'),
        encode(digest('email:parent@example.test', 'sha256'), 'hex'),
        'failed', 1, 'stale-submission', '<stale@example.test>'
      )
    `;
    const attempt = await beginDeliveryAttemptWithDatabase(db, {
      familyId: familyAId,
      episodeId: "00000000-0000-4000-8000-000000000064",
      messageId,
      taskRunId: selectedRunId,
      memberUserId: adultAId,
      channel: "email",
      destination: "parent@example.test",
      providerThreadKey: "email:parent@example.test",
    });
    const [reopened] = await db<{
      status: string;
      providerSubmissionId: string | null;
      providerMessageId: string | null;
    }[]>`
      select status,
             provider_submission_id as "providerSubmissionId",
             provider_message_id as "providerMessageId"
      from public.conversation_deliveries where id = ${deliveryId}
    `;
    assert.deepEqual(reopened, {
      status: "pending",
      providerSubmissionId: null,
      providerMessageId: null,
    });
    await finishDeliveryAttemptWithDatabase(db, attempt, {
      delivered: true,
      providerSubmissionId: "submission-current",
      providerMessageId: "<current-initial@example.test>",
    });
    await enrichDeliveryAttemptProviderMessageIdWithDatabase(
      db,
      attempt,
      "submission-stale",
      "<stale-late@example.test>",
    );
    await enrichDeliveryAttemptProviderMessageIdWithDatabase(
      db,
      attempt,
      "submission-current",
      "<current-final@example.test>",
    );
    const [finished] = await db<{
      status: string;
      providerSubmissionId: string | null;
      providerMessageId: string | null;
    }[]>`
      select status,
             provider_submission_id as "providerSubmissionId",
             provider_message_id as "providerMessageId"
      from public.conversation_deliveries where id = ${deliveryId}
    `;
    assert.deepEqual(finished, {
      status: "sent",
      providerSubmissionId: "submission-current",
      providerMessageId: "<current-final@example.test>",
    });
  });

  it("retries accepted reactive-email postprocessing without a second provider submission", async () => {
    const db = harness.database();
    const messageId = "00000000-0000-4000-a000-000000000067";
    await db`
      insert into public.conversation_messages (
        id, family_id, role, visibility
      )
      values (${messageId}, ${familyAId}, 'assistant', 'internal')
    `;
    let providerSubmissions = 0;
    let finalizationAttempts = 0;
    let completedReceipts = 0;
    const dependencies = {
      beginAttempt: async () =>
        await beginDeliveryAttemptWithDatabase(db, {
          familyId: familyAId,
          episodeId: "00000000-0000-4000-8000-000000000067",
          messageId,
          taskRunId: null,
          memberUserId: adultAId,
          channel: "email" as const,
          destination: "parent@example.test",
          providerThreadKey: "email:parent@example.test",
        }),
      sendEmail: async () => {
        providerSubmissions += 1;
        return {
          status: "submitted" as const,
          providerSubmissionId: "reactive-submission-67",
          retrieveProviderMessageId: async () =>
            "<reactive-67@example.test>",
        };
      },
      finishAttempt: async (
        attempt: Awaited<ReturnType<typeof beginDeliveryAttemptWithDatabase>>,
        outcome: Parameters<typeof finishDeliveryAttemptWithDatabase>[2],
      ) =>
        await finishDeliveryAttemptWithDatabase(db, attempt, outcome),
      enrichProviderMessageId: async (
        attempt: Awaited<ReturnType<typeof beginDeliveryAttemptWithDatabase>>,
        providerSubmissionId: string,
        providerMessageId: string,
      ) =>
        await enrichDeliveryAttemptProviderMessageIdWithDatabase(
          db,
          attempt,
          providerSubmissionId,
          providerMessageId,
        ),
      retrieveProviderMessageId: async () =>
        "<reactive-67@example.test>",
      finalizeOutcome: async () => {
        finalizationAttempts += 1;
        if (finalizationAttempts === 1) {
          throw new Error("simulated canonical visibility failure");
        }
        await db`
          update public.conversation_messages
          set visibility = 'family'
          where id = ${messageId}
        `;
      },
      completeInboundReceipt: async () => {
        completedReceipts += 1;
      },
    };
    await assert.rejects(
      deliverReactiveEmailWithRetry(dependencies),
      /phase=reactive_email_postprocess/u,
    );
    assert.equal(
      await deliverReactiveEmailWithRetry(dependencies),
      "sent",
    );
    const [stored] = await db<{
      deliveries: number;
      status: string;
      providerSubmissionId: string | null;
      providerMessageId: string | null;
      visibility: string;
    }[]>`
      select
        (select count(*)::integer
          from public.conversation_deliveries
          where message_id = ${messageId}) as deliveries,
        d.status,
        d.provider_submission_id as "providerSubmissionId",
        d.provider_message_id as "providerMessageId",
        m.visibility
      from public.conversation_deliveries d
      join public.conversation_messages m on m.id = d.message_id
      where d.message_id = ${messageId}
    `;
    assert.deepEqual(stored, {
      deliveries: 1,
      status: "sent",
      providerSubmissionId: "reactive-submission-67",
      providerMessageId: "<reactive-67@example.test>",
      visibility: "family",
    });
    assert.equal(providerSubmissions, 1);
    assert.equal(completedReceipts, 1);
  });

  it("finishes a journal from the bounced durable attempt instead of the stale sent result", async () => {
    const db = harness.database();
    const selectedRunId = runId(70);
    const messageId = "00000000-0000-4000-a000-000000000070";
    await db`
      insert into public.homa_task_runs (
        id, family_id, kind, status, title, delivery_version
      )
      values (
        ${selectedRunId}, ${familyAId}, 'journal_prompt', 'running',
        'Journal bounce race', 'legacy'
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
        'journal-bounce-destination', 'email', 'sent',
        'journal-bounce-70', now()
      )
    `;
    const webhook = await applyResendWebhookReceiptWithDatabase(db, {
      emailId: "journal-bounce-70",
      eventType: "email.bounced",
      ledgerStatus: "bounced",
      failsDelivery: true,
    });
    assert.equal(webhook.recomputedTaskRuns, 0);
    const [running] = await db<{ status: string; kind: string }[]>`
      select status, kind from public.homa_task_runs
      where id = ${selectedRunId}
    `;
    assert.deepEqual(running, {
      status: "running",
      kind: "journal_prompt",
    });

    const finished = await finishTaskRunFromDurableDeliveriesWithDatabase(
      db,
      {
        runId: selectedRunId,
        familyId: familyAId,
        kind: "journal_prompt",
        summary: "Stale local text",
        sessionId: "journal-session-70",
        saveOnlyAccepted: false,
        canonicalMessageId: messageId,
      },
    );
    assert.deepEqual(finished, {
      finished: true,
      delivery: {
        status: "failed",
        deliveredChannel: null,
        deliveredCount: 0,
        failedCount: 1,
      },
    });
    const [run] = await db<{
      status: string;
      deliveredChannel: string | null;
      summary: string | null;
      sessionId: string | null;
      finished: boolean;
    }[]>`
      select status, delivered_channel as "deliveredChannel", summary,
             session_id as "sessionId", finished_at is not null as finished
      from public.homa_task_runs
      where id = ${selectedRunId}
    `;
    assert.deepEqual(run, {
      status: "failed",
      deliveredChannel: null,
      summary: null,
      sessionId: "journal-session-70",
      finished: true,
    });
  });

  it("finishes a custom multi-recipient run as partial after an early bounce", async () => {
    const db = harness.database();
    const selectedRunId = runId(71);
    const messageId = "00000000-0000-4000-a000-000000000071";
    await db`
      insert into public.homa_task_runs (
        id, family_id, kind, status, title, delivery_version
      )
      values (
        ${selectedRunId}, ${familyAId}, 'custom', 'running',
        'Custom bounce race', 'legacy'
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
          'custom-sms-destination', 'sms', 'sent', null, now()
        ),
        (
          ${familyAId}, ${messageId}, ${selectedRunId}, ${adultBId},
          'custom-email-destination', 'email', 'sent',
          'custom-bounce-71', now()
        )
    `;
    const webhook = await applyResendWebhookReceiptWithDatabase(db, {
      emailId: "custom-bounce-71",
      eventType: "email.bounced",
      ledgerStatus: "bounced",
      failsDelivery: true,
    });
    assert.equal(webhook.recomputedTaskRuns, 0);
    const result = await finishTaskRunFromDurableDeliveriesWithDatabase(
      db,
      {
        runId: selectedRunId,
        familyId: familyAId,
        kind: "custom",
        summary: "Custom durable summary",
        sessionId: "custom-session-71",
        saveOnlyAccepted: false,
        canonicalMessageId: messageId,
      },
    );
    assert.deepEqual(result, {
      finished: true,
      delivery: {
        status: "partial",
        deliveredChannel: "sms",
        deliveredCount: 1,
        failedCount: 1,
      },
    });
    const [run] = await db<{
      status: string;
      deliveredChannel: string | null;
      summary: string | null;
    }[]>`
      select status, delivered_channel as "deliveredChannel", summary
      from public.homa_task_runs where id = ${selectedRunId}
    `;
    assert.deepEqual(run, {
      status: "partial",
      deliveredChannel: "sms",
      summary: "Custom durable summary",
    });
  });

  it("finishes a pinned legacy morning run as failed after an early bounce", async () => {
    const db = harness.database();
    const selectedRunId = runId(72);
    const messageId = "00000000-0000-4000-a000-000000000072";
    await db`
      insert into public.homa_task_runs (
        id, family_id, kind, status, title, delivery_version
      )
      values (
        ${selectedRunId}, ${familyAId}, 'morning_brief', 'running',
        'Legacy morning bounce race', 'legacy'
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
        'legacy-morning-destination', 'email', 'sent',
        'legacy-morning-bounce-72', now()
      )
    `;
    await applyResendWebhookReceiptWithDatabase(db, {
      emailId: "legacy-morning-bounce-72",
      eventType: "email.bounced",
      ledgerStatus: "bounced",
      failsDelivery: true,
    });
    const result = await finishTaskRunFromDurableDeliveriesWithDatabase(
      db,
      {
        runId: selectedRunId,
        familyId: familyAId,
        kind: "morning_brief",
        summary: "Legacy morning text",
        sessionId: "legacy-morning-session-72",
        saveOnlyAccepted: false,
        canonicalMessageId: messageId,
      },
    );
    assert.equal(result.finished, true);
    assert.equal(result.delivery?.status, "failed");
    const [run] = await db<{ status: string; summary: string | null }[]>`
      select status, summary from public.homa_task_runs
      where id = ${selectedRunId}
    `;
    assert.deepEqual(run, { status: "failed", summary: null });
  });

  it("preserves sent and explicit save-only durable outcomes", async () => {
    const db = harness.database();
    const sentRunId = runId(73);
    const saveOnlyRunId = runId(74);
    const messageId = "00000000-0000-4000-a000-000000000073";
    const saveOnlyMessageId = "00000000-0000-4000-a000-000000000074";
    await db`
      insert into public.homa_task_runs (
        id, family_id, kind, status, title, delivery_version
      )
      values
        (
          ${sentRunId}, ${familyAId}, 'journal_prompt', 'running',
          'Sent regression', 'legacy'
        ),
        (
          ${saveOnlyRunId}, ${familyAId}, 'custom', 'running',
          'Save-only regression', 'legacy'
        )
    `;
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, visibility
      )
      values
        (
          ${messageId}, ${familyAId}, ${sentRunId}, 'assistant', 'internal'
        ),
        (
          ${saveOnlyMessageId}, ${familyAId}, ${saveOnlyRunId},
          'assistant', 'internal'
        )
    `;
    await db`
      insert into public.conversation_deliveries (
        family_id, message_id, task_run_id, recipient_member_user_id,
        destination_hash, channel, status, sent_at
      )
      values (
        ${familyAId}, ${messageId}, ${sentRunId}, ${adultAId},
        'sent-regression-destination', 'sms', 'sent', now()
      )
    `;
    const sent = await finishTaskRunFromDurableDeliveriesWithDatabase(db, {
      runId: sentRunId,
      familyId: familyAId,
      kind: "journal_prompt",
      summary: "Sent durable summary",
      sessionId: "sent-session-73",
      saveOnlyAccepted: false,
      canonicalMessageId: messageId,
    });
    const saveOnly = await finishTaskRunFromDurableDeliveriesWithDatabase(
      db,
      {
        runId: saveOnlyRunId,
        familyId: familyAId,
        kind: "custom",
        summary: "Saved durable summary",
        sessionId: "save-session-74",
        saveOnlyAccepted: true,
        canonicalMessageId: saveOnlyMessageId,
      },
    );
    assert.deepEqual(sent, {
      finished: true,
      delivery: {
        status: "done",
        deliveredChannel: "sms",
        deliveredCount: 1,
        failedCount: 0,
      },
    });
    assert.deepEqual(saveOnly, {
      finished: true,
      delivery: {
        status: "done",
        deliveredChannel: "none",
        deliveredCount: 1,
        failedCount: 0,
      },
    });
    assert.deepEqual(
      await finishTaskRunFromDurableDeliveriesWithDatabase(db, {
        runId: sentRunId,
        familyId: familyAId,
        kind: "journal_prompt",
        summary: "Replay must not overwrite",
        sessionId: "replay-session",
        saveOnlyAccepted: false,
        canonicalMessageId: messageId,
      }),
      { finished: false, delivery: null },
    );
    const runs = await db<{
      id: string;
      status: string;
      deliveredChannel: string | null;
      summary: string | null;
    }[]>`
      select id, status, delivered_channel as "deliveredChannel", summary
      from public.homa_task_runs
      where id in (${sentRunId}, ${saveOnlyRunId})
      order by id
    `;
    assert.deepEqual([...runs], [
      {
        id: sentRunId,
        status: "done",
        deliveredChannel: "sms",
        summary: "Sent durable summary",
      },
      {
        id: saveOnlyRunId,
        status: "done",
        deliveredChannel: "none",
        summary: "Saved durable summary",
      },
    ]);
    const messages = await db<{ id: string; visibility: string }[]>`
      select id, visibility
      from public.conversation_messages
      where id in (${messageId}, ${saveOnlyMessageId})
      order by id
    `;
    assert.deepEqual([...messages], [
      { id: messageId, visibility: "family" },
      { id: saveOnlyMessageId, visibility: "family" },
    ]);
  });

  it("rolls back generic task completion when canonical visibility fails", async () => {
    const db = harness.database();
    const selectedRunId = runId(76);
    const messageId = "00000000-0000-4000-a000-000000000076";
    await db`
      insert into public.homa_task_runs (
        id, family_id, kind, status, title, delivery_version
      )
      values (
        ${selectedRunId}, ${familyAId}, 'custom', 'running',
        'Visibility rollback', 'legacy'
      )
    `;
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, content, visibility
      )
      values (
        ${messageId}, ${familyAId}, ${selectedRunId}, 'assistant',
        'Visibility rollback summary', 'internal'
      )
    `;
    await db`
      insert into public.conversation_deliveries (
        family_id, message_id, task_run_id, recipient_member_user_id,
        destination_hash, channel, status, sent_at
      )
      values (
        ${familyAId}, ${messageId}, ${selectedRunId}, ${adultAId},
        'visibility-rollback-destination', 'sms', 'sent', now()
      )
    `;
    await db`
      create function public.fail_generic_task_visibility()
      returns trigger language plpgsql as $$
      begin
        if new.visibility = 'family' then
          raise exception 'simulated generic visibility crash';
        end if;
        return new;
      end
      $$
    `;
    await db`
      create trigger fail_generic_task_visibility
      before update on public.conversation_messages
      for each row execute function public.fail_generic_task_visibility()
    `;
    try {
      await assert.rejects(
        finishTaskRunFromDurableDeliveriesWithDatabase(db, {
          runId: selectedRunId,
          familyId: familyAId,
          kind: "custom",
          summary: "Visibility rollback summary",
          sessionId: "visibility-session-76",
          saveOnlyAccepted: false,
          canonicalMessageId: messageId,
        }),
        /simulated generic visibility crash/u,
      );
    } finally {
      await db`
        drop trigger if exists fail_generic_task_visibility
        on public.conversation_messages
      `;
      await db`
        drop function if exists public.fail_generic_task_visibility()
      `;
    }
    const [state] = await db<{
      runStatus: string;
      summary: string | null;
      finished: boolean;
      visibility: string;
    }[]>`
      select r.status as "runStatus", r.summary,
             r.finished_at is not null as finished, m.visibility
      from public.homa_task_runs r
      join public.conversation_messages m on m.task_run_id = r.id
      where r.id = ${selectedRunId}
    `;
    assert.deepEqual(state, {
      runStatus: "running",
      summary: null,
      finished: false,
      visibility: "internal",
    });
    const recovered =
      await finishStaleTaskRunFromDurableDeliveriesWithDatabase(db, {
        runId: selectedRunId,
        familyId: familyAId,
        kind: "custom",
      });
    assert.equal(recovered.finished, true);
    assert.equal(recovered.delivery?.status, "done");
    const [afterRecovery] = await db<{
      status: string;
      visibility: string;
      summary: string | null;
    }[]>`
      select r.status, m.visibility, r.summary
      from public.homa_task_runs r
      join public.conversation_messages m on m.task_run_id = r.id
      where r.id = ${selectedRunId}
    `;
    assert.deepEqual(afterRecovery, {
      status: "done",
      visibility: "family",
      summary: "Visibility rollback summary",
    });
  });
});
