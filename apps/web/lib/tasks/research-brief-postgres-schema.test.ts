import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Sql } from "postgres";

import {
  enrichDeliveryAttemptProviderMessageIdWithDatabase,
  finishDeliveryAttemptWithDatabase,
  type DeliveryAttempt,
} from "../conversation-continuity/delivery-ledger";
import { applyResendWebhookReceiptWithDatabase } from "../email-webhook";
import {
  adultAId,
  adultBId,
  childAId,
  childBId,
  createDisposableResearchBriefPostgresHarness,
  familyAId,
  fleetRunId,
  knowledgeId,
  postgresErrorCode,
  runId,
} from "./research-brief-postgres-harness";
import { researchBriefSourceLockIdentity } from "./research-brief-preparation";
import {
  beginManualTaskRunWithDatabase,
  beginTaskRunWithDatabase,
} from "./store";
import { deliveryVersionForNewTaskRun } from "./delivery-version";

const harness = createDisposableResearchBriefPostgresHarness("schema");

async function insertTaskSchedule(
  database: Sql,
  scheduleId: string,
): Promise<void> {
  await database`
    insert into public.agent_schedules (
      id, family_id, kind, next_run_at, local_hour, weekdays
    )
    values (
      ${scheduleId}, ${familyAId}, 'morning_brief',
      '2026-07-16T13:00:00.000Z', 9,
      ${database.array([1, 2, 3, 4, 5])}::smallint[]
    )
  `;
}

describe("research brief PostgreSQL schema", () => {
  before(async () => await harness.start());
  after(async () => await harness.stop());

  it("defaults existing task runs to legacy and constrains delivery versions", async () => {
    const db = harness.database();
    const [stored] = await db<{ delivery_version: string }[]>`
      select delivery_version
      from public.homa_task_runs
      where id = ${fleetRunId}
    `;
    assert.equal(stored.delivery_version, "legacy");
    assert.equal(
      await postgresErrorCode(db`
        update public.homa_task_runs
        set delivery_version = 'future-version'
        where id = ${fleetRunId}
      `),
      "23514",
    );
  });

  it("persists the delivery version selected when a scheduled run begins", async () => {
    const db = harness.database();
    await insertTaskSchedule(
      db,
      "00000000-0000-4000-8000-000000000201",
    );
    const started = await beginTaskRunWithDatabase(
      db,
      {
        scheduleId: "00000000-0000-4000-8000-000000000201",
        familyId: familyAId,
        familySandbox: false,
        kind: "morning_brief",
        timeZone: "America/New_York",
        localHour: 9,
        weekdays: [1, 2, 3, 4, 5],
        deliveryPref: "text",
        label: null,
        prompt: null,
        parentFirstName: "Parent",
        kidPhrase: "Child A",
        phoneNumbers: [],
        email: "parent@example.test",
        recipientMemberUserId: adultAId,
      },
      new Date("2026-07-16T13:00:00.000Z"),
      {
        deliveryVersion: "research_brief_v2",
      },
    );
    assert.equal(started?.deliveryVersion, "research_brief_v2");
    const [stored] = await db<{ delivery_version: string }[]>`
      select delivery_version
      from public.homa_task_runs
      where id = ${started?.id ?? null}
    `;
    assert.equal(stored.delivery_version, "research_brief_v2");
  });

  it("pins sandbox-only v2 for sandbox scheduled runs, but keeps other families legacy", async () => {
    const db = harness.database();
    const environment = { HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY: "true" };
    const runAt = new Date("2026-07-16T14:00:00.000Z");
    await insertTaskSchedule(
      db,
      "00000000-0000-4000-8000-000000000202",
    );
    await insertTaskSchedule(
      db,
      "00000000-0000-4000-8000-000000000203",
    );
    const sandboxVersion = deliveryVersionForNewTaskRun(
      "morning_brief",
      environment,
      true,
    );
    const regularVersion = deliveryVersionForNewTaskRun(
      "morning_brief",
      environment,
      false,
    );
    environment.HOMA_RESEARCH_BRIEF_V2_SANDBOX_ONLY = "false";
    const sandboxRun = await beginTaskRunWithDatabase(
      db,
      {
        scheduleId: "00000000-0000-4000-8000-000000000202",
        familyId: familyAId,
        familySandbox: true,
        kind: "morning_brief",
        timeZone: "America/New_York",
        localHour: 9,
        weekdays: [1, 2, 3, 4, 5],
        deliveryPref: "text",
        label: null,
        prompt: null,
        parentFirstName: "Sandbox parent",
        kidPhrase: "Child A",
        phoneNumbers: [],
        email: "sandbox@example.test",
        recipientMemberUserId: adultAId,
      },
      runAt,
      { deliveryVersion: sandboxVersion },
    );
    const regularRun = await beginTaskRunWithDatabase(
      db,
      {
        scheduleId: "00000000-0000-4000-8000-000000000203",
        familyId: familyAId,
        familySandbox: false,
        kind: "morning_brief",
        timeZone: "America/New_York",
        localHour: 9,
        weekdays: [1, 2, 3, 4, 5],
        deliveryPref: "text",
        label: null,
        prompt: null,
        parentFirstName: "Regular parent",
        kidPhrase: "Child A",
        phoneNumbers: [],
        email: "regular@example.test",
        recipientMemberUserId: adultAId,
      },
      runAt,
      { deliveryVersion: regularVersion },
    );

    assert.equal(sandboxRun?.deliveryVersion, "research_brief_v2");
    assert.equal(regularRun?.deliveryVersion, "legacy");
  });

  it("pins a sandbox manual run before its version reaches dispatch", async () => {
    await insertTaskSchedule(
      harness.database(),
      "00000000-0000-4000-8000-000000000204",
    );
    const started = await beginManualTaskRunWithDatabase(
      harness.database(),
      {
        scheduleId: "00000000-0000-4000-8000-000000000204",
        familyId: familyAId,
        familySandbox: true,
        kind: "morning_brief",
        timeZone: "America/New_York",
        localHour: 9,
        weekdays: [1, 2, 3, 4, 5],
        deliveryPref: "text",
        label: null,
        prompt: null,
        parentFirstName: "Sandbox parent",
        kidPhrase: "Child A",
        phoneNumbers: [],
        email: "sandbox@example.test",
        recipientMemberUserId: adultAId,
      },
      { deliveryVersion: "research_brief_v2" },
    );

    assert.equal(started.deliveryVersion, "research_brief_v2");
  });

  it("correlates Resend webhooks by submission id, never RFC Message-ID", async () => {
    const db = harness.database();
    const selectedRunId = runId(39);
    const messageId = "00000000-0000-4000-a000-000000000038";
    const deliveryId = "00000000-0000-4000-b000-000000000038";
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, visibility
      )
      values (
        ${messageId}, ${familyAId}, ${selectedRunId}, 'assistant', 'family'
      )
    `;
    await db`
      insert into public.conversation_deliveries (
        id, family_id, message_id, task_run_id, channel, status,
        provider_submission_id, provider_message_id
      )
      values (
        ${deliveryId}, ${familyAId}, ${messageId}, ${selectedRunId},
        'email', 'sent', 'resend-submission-38',
        '<native-message-38@example.com>'
      )
    `;
    await db`
      insert into public.email_sends (provider_message_id, status)
      values ('resend-submission-38', 'submitted')
    `;

    await applyResendWebhookReceiptWithDatabase(db, {
      emailId: "resend-submission-38",
      eventType: "email.bounced",
      ledgerStatus: "bounced",
      failsDelivery: true,
    });
    const [bounced] = await db<{
      deliveryStatus: string;
      emailStatus: string;
    }[]>`
      select
        d.status as "deliveryStatus",
        e.status as "emailStatus"
      from public.conversation_deliveries d
      cross join public.email_sends e
      where d.id = ${deliveryId}
        and e.provider_message_id = 'resend-submission-38'
    `;
    assert.deepEqual(bounced, {
      deliveryStatus: "failed",
      emailStatus: "bounced",
    });

    await db`
      update public.conversation_deliveries
      set status = 'sent', error = null
      where id = ${deliveryId}
    `;
    await applyResendWebhookReceiptWithDatabase(db, {
      emailId: "<native-message-38@example.com>",
      eventType: "email.bounced",
      ledgerStatus: "bounced",
      failsDelivery: true,
    });
    const [nativeIdAttempt] = await db<{ status: string }[]>`
      select status
      from public.conversation_deliveries
      where id = ${deliveryId}
    `;
    assert.equal(nativeIdAttempt.status, "sent");
  });

  it("stores Resend POST acceptance before fail-soft RFC Message-ID enrichment", async () => {
    const db = harness.database();
    const selectedRunId = runId(5);
    const messageId = "00000000-0000-4000-a000-000000000205";
    const deliveryId = "00000000-0000-4000-b000-000000000205";
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
        id, family_id, message_id, task_run_id, channel, status
      )
      values (
        ${deliveryId}, ${familyAId}, ${messageId}, ${selectedRunId},
        'email', 'pending'
      )
    `;
    const attempt: DeliveryAttempt = {
      id: deliveryId,
      familyId: familyAId,
      episodeId: "00000000-0000-4000-8000-000000000205",
      messageId,
      taskRunId: selectedRunId,
      memberUserId: adultAId,
      channel: "email",
      destination: "parent@example.test",
      providerThreadKey: "email:parent@example.test",
      existingStatus: "pending",
      shouldSend: true,
    };

    await finishDeliveryAttemptWithDatabase(db, attempt, {
      delivered: true,
      providerSubmissionId: "resend-submission-205",
    });
    const [accepted] = await db<{
      status: string;
      providerSubmissionId: string | null;
      providerMessageId: string | null;
    }[]>`
      select
        status,
        provider_submission_id as "providerSubmissionId",
        provider_message_id as "providerMessageId"
      from public.conversation_deliveries
      where id = ${deliveryId}
    `;
    assert.deepEqual(accepted, {
      status: "sent",
      providerSubmissionId: "resend-submission-205",
      providerMessageId: null,
    });

    await enrichDeliveryAttemptProviderMessageIdWithDatabase(
      db,
      attempt,
      "resend-submission-205",
      "<native-205@example.test>",
    );
    const [enriched] = await db<{
      providerSubmissionId: string | null;
      providerMessageId: string | null;
    }[]>`
      select
        provider_submission_id as "providerSubmissionId",
        provider_message_id as "providerMessageId"
      from public.conversation_deliveries
      where id = ${deliveryId}
    `;
    assert.deepEqual(enriched, {
      providerSubmissionId: "resend-submission-205",
      providerMessageId: "<native-205@example.test>",
    });
  });

  it("rejects a preparation whose child belongs to another family", async () => {
    const db = harness.database();
    assert.equal(
      await postgresErrorCode(db`
        insert into public.research_brief_preparations (
          task_run_id, family_id, child_id, knowledge_bank_id, draft,
          draft_hash, source_snapshot, prepared_at
        )
        values (
          ${runId(1)}, ${familyAId}, ${childBId}, ${knowledgeId}, 'Draft',
          ${"a".repeat(64)}, '{}'::jsonb, now()
        )
      `),
      "23503",
    );
  });

  it("rejects a preparation paired with another family's task run", async () => {
    const db = harness.database();
    assert.equal(
      await postgresErrorCode(db`
        insert into public.research_brief_preparations (
          task_run_id, family_id, child_id, knowledge_bank_id, draft,
          draft_hash, source_snapshot, prepared_at
        )
        values (
          ${runId(2)}, ${familyAId}, ${childAId}, ${knowledgeId}, 'Draft',
          ${"b".repeat(64)}, '{}'::jsonb, now()
        )
      `),
      "23503",
    );
  });

  it("rejects a knowledge use paired with another family's task run", async () => {
    const db = harness.database();
    assert.equal(
      await postgresErrorCode(db`
        insert into public.family_knowledge_use (
          family_id, knowledge_bank_id, task_run_id, used_at
        )
        values (${familyAId}, ${knowledgeId}, ${runId(3)}, now())
      `),
      "23503",
    );
  });

  it("rejects feedback paired with another family's task run", async () => {
    const db = harness.database();
    assert.equal(
      await postgresErrorCode(db`
        insert into public.research_brief_feedback (
          family_id, task_run_id, member_user_id, signal,
          created_at, updated_at
        )
        values (
          ${familyAId}, ${runId(4)}, ${adultAId}, 'helpful', now(), now()
        )
      `),
      "23503",
    );
  });

  it("rejects feedback attributed to an adult from another family", async () => {
    const db = harness.database();
    assert.equal(
      await postgresErrorCode(db`
        insert into public.research_brief_feedback (
          family_id, task_run_id, member_user_id, signal,
          created_at, updated_at
        )
        values (
          ${familyAId}, ${runId(9)}, ${adultBId}, 'helpful', now(), now()
        )
      `),
      "23503",
    );
  });

  it("rejects a fleet task run from every family-scoped brief record", async () => {
    const db = harness.database();
    assert.equal(
      await postgresErrorCode(db`
        insert into public.research_brief_preparations (
          task_run_id, family_id, child_id, knowledge_bank_id, draft,
          draft_hash, source_snapshot, prepared_at
        )
        values (
          ${fleetRunId}, ${familyAId}, ${childAId}, ${knowledgeId}, 'Draft',
          ${"c".repeat(64)}, '{}'::jsonb, now()
        )
      `),
      "23503",
    );
    assert.equal(
      await postgresErrorCode(db`
        insert into public.family_knowledge_use (
          family_id, knowledge_bank_id, task_run_id, used_at
        )
        values (${familyAId}, ${knowledgeId}, ${fleetRunId}, now())
      `),
      "23503",
    );
    assert.equal(
      await postgresErrorCode(db`
        insert into public.research_brief_feedback (
          family_id, task_run_id, member_user_id, signal,
          created_at, updated_at
        )
        values (
          ${familyAId}, ${fleetRunId}, ${adultAId}, 'helpful', now(), now()
        )
      `),
      "23503",
    );
  });

  it("stores one preparation per task run idempotently", async () => {
    const db = harness.database();
    for (const draft of ["First draft", "Revised draft"]) {
      await db`
        insert into public.research_brief_preparations (
          task_run_id, family_id, child_id, knowledge_bank_id, draft,
          draft_hash, source_snapshot, prepared_at
        )
        values (
          ${runId(5)}, ${familyAId}, ${childAId}, ${knowledgeId}, ${draft},
          ${"d".repeat(64)}, '{}'::jsonb, now()
        )
        on conflict (task_run_id) do update
        set draft = excluded.draft,
            draft_hash = excluded.draft_hash,
            source_snapshot = excluded.source_snapshot,
            prepared_at = excluded.prepared_at
      `;
    }
    const [stored] = await db<{ count: number; draft: string }[]>`
      select count(*)::integer as count, max(draft) as draft
      from public.research_brief_preparations
      where task_run_id = ${runId(5)}
    `;
    assert.deepEqual(stored, { count: 1, draft: "Revised draft" });
  });

  it("uses one shared family-source lock identity for preparation and finalization", () => {
    assert.equal(
      researchBriefSourceLockIdentity(familyAId, knowledgeId),
      `research-brief-source:${familyAId}:${knowledgeId}`,
    );
  });
});
