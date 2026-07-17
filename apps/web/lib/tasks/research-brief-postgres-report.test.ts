import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { DeliveryAttempt } from "../conversation-continuity/delivery-ledger";
import {
  deliverTaskMessage,
  type TaskDeliveryLedger,
} from "../conversation-continuity/task-delivery";
import {
  selectBriefKnowledge,
  type BriefKnowledgeRow,
} from "../knowledge/select-brief";
import {
  assertMorningResearchBriefReportIsPiiFree,
  buildMorningResearchBriefRolloutReport,
  loadMorningResearchBriefRolloutReportRows,
  runReadOnlyMorningResearchBriefReport,
} from "../../../../scripts/morning-research-brief-v2-report-lib";
import {
  deliverPreparedResearchBrief,
  type PreparedResearchBrief,
} from "./research-brief-delivery";
import {
  adultAId,
  adultASecondId,
  childAId,
  createDisposableResearchBriefPostgresHarness,
  familyAId,
  journeyKnowledgeId,
  observationId,
  postgresErrorCode,
  runId,
  wrongStageKnowledgeId,
} from "./research-brief-postgres-harness";
import {
  createResearchBriefPreparationService,
  reserveResearchBriefPreparationWithDatabase,
} from "./research-brief-preparation";
import {
  recordResearchBriefFeedbackWithDatabase,
} from "./research-brief-feedback";
import {
  finalizePreparedResearchBriefDeliveryWithDatabase,
} from "./research-brief-store";

const harness = createDisposableResearchBriefPostgresHarness("report");

describe("research brief PostgreSQL report integration", () => {
  before(async () => await harness.start());
  after(async () => await harness.stop());

  it("runs one complete v2 journey through selection, preparation, delivery, feedback, reporting, and replay", async () => {
    const db = harness.database();
    const selectedRunId = runId(31);
    const selectedObservationId = observationId(5);
    const now = new Date("2026-07-16T13:00:00.000Z");
    const draft = `Last night I researched keeping sounds together while reading

What I learned: Reading Rockets says a stretchy sound stays on into the next sound, so the word reaches the ear as one piece. In mat, mmm runs into a before the quick t closes mat.

Why it's interesting: Child A said "ship" sounds choppy in Bob Books. Child A can try "sh" running into "i" before the quick "p" closes "ship".

Want me to make Child A a mat-and-ship word strip for keeping sounds together while reading?`;
    const citation = {
      url: "https://www.readingrockets.org/reading-101/reading-101-learning-modules/course-modules/phonics/depth",
      claim: "Continuous sounds can be stretched into the next sound.",
      sourceName: "Reading Rockets",
    };
    await db`
      update public.knowledge_bank
      set topic_type = 'subject',
          topic_key = 'phonics_blending',
          lens = 'current_study',
          stage = 'early_elem',
          summary = 'Continuous sounds can support smooth blending practice.',
          confidence = 'high',
          source_tier = 1,
          citations = ${db.json([citation])},
          last_verified_at = ${now.toISOString()},
          freshness_ttl_days = 14,
          recent_delivered_use_count = 0
      where id = ${journeyKnowledgeId}
    `;
    await db`
      update public.knowledge_bank
      set topic_type = 'subject',
          topic_key = 'phonics_blending',
          lens = 'current_study',
          stage = 'high',
          summary = 'This deliberately mismatched stage must not be selected.',
          confidence = 'high',
          source_tier = 1,
          citations = ${db.json([citation])},
          last_verified_at = ${now.toISOString()},
          freshness_ttl_days = 14,
          recent_delivered_use_count = 0
      where id = ${wrongStageKnowledgeId}
    `;
    const rawRows = await db<BriefKnowledgeRow[]>`
      select
        id,
        topic_type as "topicType",
        topic_key as "topicKey",
        lens,
        stage,
        title,
        summary,
        confidence,
        source_tier as "sourceTier",
        citations,
        last_verified_at::text as "lastVerifiedAt",
        freshness_ttl_days as "freshnessTtlDays",
        recent_delivered_use_count as "recentDeliveredUseCount"
      from public.knowledge_bank
      where status = 'active'
        and id in (${journeyKnowledgeId}, ${wrongStageKnowledgeId})
      order by id
    `;
    const selected = selectBriefKnowledge(rawRows, {
      familyId: familyAId,
      localDate: "2026-07-16",
      now,
      stages: ["early_elem"],
      subjectKeys: ["phonics_blending"],
      frontierDomains: ["phonics_blending"],
      methodKeys: [],
      recentUses: [],
    });
    assert.equal(selected?.id, journeyKnowledgeId);
    if (!selected || selected.lens === null || selected.confidence === "low") {
      assert.fail("integrated fixture must select eligible v2 research");
    }
    const selectedLens = selected.lens;
    const selectedConfidence = selected.confidence;

    const prepare = createResearchBriefPreparationService({
      loadScope: async () => ({
        taskKind: "morning_brief",
        taskStatus: "running",
        child: {
          id: childAId,
          name: "Child A",
          stage: "early_elem",
          subjectKeys: ["phonics_blending"],
          frontierDomains: ["phonics_blending"],
          currentWorkFacts: ['Child A said "ship" sounds choppy.'],
          frontierFacts: ["Keep sounds together while blending."],
          candidates: [selected],
        },
        siblingNames: ["Child B"],
        observationIds: [selectedObservationId],
        sourceId: selected.id,
        sourceSnapshot: {
          kind: "knowledge_cited",
          id: selected.id,
          title: selected.title,
          sourceNames: selected.sourceNames,
          citationUrls: selected.citations.map((item) => item.url),
          topic: selected.topicKey,
          claims: selected.citations.map((item) => item.claim),
          topicType: selected.topicType,
          lens: selectedLens,
          stage: selected.stage,
          confidence: selectedConfidence,
          sourceTier: selected.sourceTier,
        },
      }),
      upsert: async (record) =>
        await reserveResearchBriefPreparationWithDatabase(db, record, now),
    });
    assert.deepEqual(
      await prepare({
        familyId: familyAId,
        taskRunId: selectedRunId,
        deliveryVersion: "research_brief_v2",
        knowledgeId: journeyKnowledgeId,
        childId: childAId,
        observationId: selectedObservationId,
        draft,
      }),
      { ok: true, draft },
    );

    const [beforeDelivery] = await db<{
      stagedDraft: string;
      delivered: boolean;
      uses: number;
      artifacts: number;
      observationStatus: string;
    }[]>`
      select
        p.draft as "stagedDraft",
        p.delivered_at is not null as delivered,
        (
          select count(*)::integer
          from public.family_knowledge_use u
          where u.task_run_id = p.task_run_id
        ) as uses,
        jsonb_array_length(r.artifacts)::integer as artifacts,
        o.status as "observationStatus"
      from public.research_brief_preparations p
      join public.homa_task_runs r on r.id = p.task_run_id
      join public.child_observations o on o.id = p.observation_id
      where p.task_run_id = ${selectedRunId}
    `;
    assert.deepEqual(beforeDelivery, {
      stagedDraft: draft,
      delivered: false,
      uses: 0,
      artifacts: 0,
      observationStatus: "new",
    });

    const episodeId = "00000000-0000-4000-a100-000000000031";
    const messageId = "00000000-0000-4000-a200-000000000031";
    const deliveryId = "00000000-0000-4000-a300-000000000031";
    const destinationHash = "journey-destination";
    let providerCalls = 0;
    let providerAccepted = false;
    const ledger: TaskDeliveryLedger = {
      async beginAttempt(input): Promise<DeliveryAttempt> {
        const [existing] = await db<{
          id: string;
          status: DeliveryAttempt["existingStatus"];
        }[]>`
          select id, status
          from public.conversation_deliveries
          where message_id = ${input.messageId}
            and channel = ${input.channel}
            and destination_hash = ${destinationHash}
          limit 1
        `;
        if (existing) {
          return {
            ...input,
            id: existing.id,
            existingStatus: existing.status,
            shouldSend: false,
          };
        }
        await db`
          insert into public.conversation_deliveries (
            id, family_id, episode_id, message_id, task_run_id,
            recipient_member_user_id, destination_hash, channel, status
          )
          values (
            ${deliveryId}, ${input.familyId}, ${input.episodeId},
            ${input.messageId}, ${input.taskRunId}, ${input.memberUserId},
            ${destinationHash}, ${input.channel}, 'pending'
          )
        `;
        return {
          ...input,
          id: deliveryId,
          existingStatus: "pending",
          shouldSend: true,
        };
      },
      async finishAttempt(attempt, outcome): Promise<void> {
        await db`
          update public.conversation_deliveries
          set status = ${outcome.delivered
              ? "sent"
              : outcome.uncertain
                ? "uncertain"
                : "failed"},
              sent_at = case when ${outcome.delivered} then now() else sent_at end,
              error = ${outcome.delivered ? null : (outcome.error ?? null)},
              updated_at = now()
          where id = ${attempt.id}
        `;
      },
      async openLoop(attempt): Promise<void> {
        await db`
          insert into public.conversation_open_loops (
            family_id, episode_id, message_id, delivery_id, state
          )
          values (
            ${attempt.familyId}, ${attempt.episodeId}, ${attempt.messageId},
            ${attempt.id}, 'open'
          )
        `;
      },
    };
    const loadPrepared = async (): Promise<PreparedResearchBrief | null> => {
      const [row] = await db<{
        familyId: string;
        taskRunId: string;
        childId: string;
        knowledgeId: string;
        observationId: string | null;
        draft: string;
        sourceSnapshot: PreparedResearchBrief["sourceSnapshot"];
      }[]>`
        select
          p.family_id as "familyId",
          p.task_run_id as "taskRunId",
          p.child_id as "childId",
          p.knowledge_bank_id as "knowledgeId",
          p.observation_id as "observationId",
          p.draft,
          p.source_snapshot as "sourceSnapshot"
        from public.research_brief_preparations p
        join public.homa_task_runs r
          on r.id = p.task_run_id and r.family_id = p.family_id
        where p.task_run_id = ${selectedRunId}
          and p.family_id = ${familyAId}
          and r.status = 'running'
      `;
      return row
        ? {
            ...row,
            observationId: row.observationId ?? undefined,
          }
        : null;
    };
    const dependencies = {
      loadPrepared,
      persistCanonical: async (storedDraft: string) => {
        const [existing] = await db<{ id: string; episodeId: string }[]>`
          select id, episode_id as "episodeId"
          from public.conversation_messages
          where task_run_id = ${selectedRunId} and role = 'assistant'
          limit 1
        `;
        if (existing) return existing;
        await db`
          insert into public.conversation_messages (
            id, family_id, task_run_id, role, content, visibility, episode_id
          )
          values (
            ${messageId}, ${familyAId}, ${selectedRunId}, 'assistant',
            ${storedDraft}, 'internal', ${episodeId}
          )
        `;
        return { id: messageId, episodeId };
      },
      deliver: async (
        storedDraft: string,
        message: { id: string; episodeId: string },
        markTransportAccepted: () => void,
      ) =>
        await deliverTaskMessage(
          {
            familyId: familyAId,
            episodeId: message.episodeId,
            messageId: message.id,
            taskRunId: selectedRunId,
            kind: "morning_brief",
            text: storedDraft,
            recipients: [{
              recipientKey: `member:${adultAId}`,
              memberUserId: adultAId,
              displayName: null,
              phoneNumbers: ["fixture-phone"],
              email: null,
            }],
          },
          {
            ledger,
            onTransportAccepted: () => markTransportAccepted(),
            transports: {
              async sendSms(_phone, text) {
                providerCalls += 1;
                providerAccepted = true;
                assert.equal(text, draft);
                return { status: "submitted", messageId: "provider-fixture" };
              },
              async sendEmail() {
                assert.fail("accepted SMS must not fall back to email");
              },
            },
          },
        ),
      recordAcceptance: async () => undefined,
      finalize: async (
        _prepared: PreparedResearchBrief,
        message: { id: string },
      ) => {
        assert.equal(providerAccepted, true);
        return await finalizePreparedResearchBriefDeliveryWithDatabase(db, {
          familyId: familyAId,
          taskRunId: selectedRunId,
          canonicalMessageId: message.id,
          sessionId: "journey-session-31",
        });
      },
      failRun: async (reason: string) => {
        assert.fail(`journey failed before delivery: ${reason}`);
      },
      logRecoveryPending: () => undefined,
    };
    const delivery = await deliverPreparedResearchBrief(
      {
        familyId: familyAId,
        taskRunId: selectedRunId,
        state: { transportAccepted: false, delivered: false },
      },
      dependencies,
    );
    assert.equal(delivery.status, "completed");
    assert.equal(providerCalls, 1);

    const [afterDelivery] = await db<{
      status: string;
      summary: string;
      deliveredChannel: string;
      uses: number;
      artifacts: number;
      observationStatus: string;
      delivered: boolean;
      deliveryRows: number;
      deliveredText: string;
      visibility: string;
    }[]>`
      select
        r.status,
        r.summary,
        r.delivered_channel as "deliveredChannel",
        (
          select count(*)::integer
          from public.family_knowledge_use u
          where u.task_run_id = r.id
        ) as uses,
        jsonb_array_length(r.artifacts)::integer as artifacts,
        o.status as "observationStatus",
        p.delivered_at is not null as delivered,
        (
          select count(*)::integer
          from public.conversation_deliveries d
          where d.task_run_id = r.id
        ) as "deliveryRows",
        m.content as "deliveredText",
        m.visibility
      from public.homa_task_runs r
      join public.research_brief_preparations p on p.task_run_id = r.id
      join public.child_observations o on o.id = p.observation_id
      join public.conversation_messages m
        on m.task_run_id = r.id and m.role = 'assistant'
      where r.id = ${selectedRunId}
    `;
    assert.deepEqual(afterDelivery, {
      status: "done",
      summary: draft,
      deliveredChannel: "sms",
      uses: 1,
      artifacts: 1,
      observationStatus: "used",
      delivered: true,
      deliveryRows: 1,
      deliveredText: draft,
      visibility: "family",
    });

    const emittedSignals: string[] = [];
    const feedbackInput = {
      familyId: familyAId,
      taskRunId: selectedRunId,
      memberUserId: adultAId,
      signal: "helpful" as const,
      emit: async ({ signal }: { signal: "helpful" | "not_for_us" }) => {
        emittedSignals.push(signal);
      },
    };
    assert.deepEqual(
      await recordResearchBriefFeedbackWithDatabase(db, feedbackInput),
      { accepted: true, wrote: true, signal: "helpful" },
    );
    assert.deepEqual(
      await recordResearchBriefFeedbackWithDatabase(db, feedbackInput),
      { accepted: true, wrote: false, signal: "helpful" },
    );
    assert.deepEqual(emittedSignals, ["helpful"]);

    const nearbyRunId = runId(32);
    const nearbyMessageId = "00000000-0000-4000-a200-000000000032";
    const nearbyDeliveryId = "00000000-0000-4000-a300-000000000032";
    await db`
      update public.homa_task_runs
      set status = 'done', delivered_channel = 'sms', finished_at = now()
      where id = ${nearbyRunId}
    `;
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, content, visibility, episode_id,
        created_at
      )
      values (
        ${nearbyMessageId}, ${familyAId}, ${nearbyRunId}, 'assistant',
        'Nearby brief fixture', 'family', ${episodeId},
        now() + interval '1 minute'
      )
    `;
    await db`
      insert into public.conversation_deliveries (
        id, family_id, episode_id, message_id, task_run_id, destination_hash,
        channel, status, sent_at
      )
      values (
        ${nearbyDeliveryId}, ${familyAId}, ${episodeId}, ${nearbyMessageId},
        ${nearbyRunId}, 'nearby-destination', 'sms', 'sent',
        now() + interval '1 minute'
      )
    `;
    await db`
      insert into public.conversation_messages (
        id, family_id, role, content, visibility, episode_id, created_at
      )
      values (
        ${"00000000-0000-4000-a200-000000000033"}, ${familyAId}, 'user',
        'Nearby activity fixture', 'family', ${episodeId},
        now() + interval '2 minutes'
      )
    `;
    await db`
      insert into public.model_usage (
        surface, channel, input_tokens, duration_ms, session_id
      )
      values (
        'morning_brief', 'dispatch', 321, 1234, 'journey-session-31'
      )
    `;

    const reportRows = await runReadOnlyMorningResearchBriefReport(
      db,
      async (transaction) =>
        await loadMorningResearchBriefRolloutReportRows(transaction, {
          since: new Date("2026-01-01T00:00:00.000Z"),
          until: new Date("2027-01-01T00:00:00.000Z"),
        }),
    );
    const rolloutReport = buildMorningResearchBriefRolloutReport(reportRows);
    const report = rolloutReport.cohorts.research_brief_v2;
    assertMorningResearchBriefReportIsPiiFree(rolloutReport);
    assert.equal(report.runStatus.done, 2);
    assert.equal(report.deliveryChannel.sms, 2);
    assert.equal(report.sms.sent, 2);
    assert.ok(report.formatCompliance.fullyCompliant >= 1);
    assert.equal(report.sourceQuality.repeatedKnowledgeRowRate, 0);
    assert.equal(report.modelUsage.composeSteps, 1);
    assert.equal(report.modelUsage.inputTokens, 321);
    assert.equal(report.possibleInterestWithinFourHours, 1);
    assert.deepEqual(report.explicitFeedback, { helpful: 1, notForUs: 0 });
    const serializedReport = JSON.stringify(rolloutReport);
    assert.equal(serializedReport.includes(familyAId), false);
    assert.equal(serializedReport.includes(childAId), false);
    assert.equal(serializedReport.includes(draft), false);
    assert.equal(serializedReport.includes(citation.url), false);
  });

  it("compares in-range legacy and v2 cohorts, includes v2 failures without preparations, and excludes unrelated runs", async () => {
    const db = harness.database();
    await db`
      update public.homa_task_runs
      set status = 'failed',
          started_at = '2026-07-10T12:00:00.000Z',
          finished_at = '2026-07-10T12:00:02.000Z',
          delivery_version = 'research_brief_v2',
          session_id = 'v2-cohort-session'
      where id = ${runId(33)}
    `;
    await db`
      update public.homa_task_runs
      set status = 'failed',
          started_at = '2026-07-10T12:00:00.000Z',
          finished_at = '2026-07-10T12:00:03.000Z',
          delivery_version = 'legacy',
          session_id = 'legacy-cohort-session'
      where id = ${runId(34)}
    `;
    await db`
      update public.homa_task_runs
      set status = 'failed',
          started_at = '2026-07-20T12:00:00.000Z',
          finished_at = '2026-07-20T12:00:04.000Z',
          delivery_version = 'research_brief_v2'
      where id = ${runId(35)}
    `;
    await db`
      insert into public.homa_task_runs (
        id, family_id, kind, status, started_at, finished_at, delivery_version
      )
      values (
        ${runId(65)}, ${familyAId}, 'custom', 'done',
        '2026-07-10T12:00:00.000Z', '2026-07-10T12:00:01.000Z',
        'research_brief_v2'
      )
    `;
    await db`
      insert into public.model_usage (
        surface, channel, input_tokens, session_id
      )
      values
        ('chat', 'dispatch', 111, 'legacy-cohort-session'),
        ('morning_brief', 'dispatch', 222, 'v2-cohort-session'),
        ('chat', 'web', 999, 'legacy-cohort-session'),
        ('chat', 'dispatch', 777, 'unrelated-session')
    `;

    const rows = await runReadOnlyMorningResearchBriefReport(
      db,
      async (transaction) =>
        await loadMorningResearchBriefRolloutReportRows(transaction, {
          since: new Date("2026-07-09T00:00:00.000Z"),
          until: new Date("2026-07-11T00:00:00.000Z"),
        }),
    );
    const rolloutReport = buildMorningResearchBriefRolloutReport(rows);
    const report = rolloutReport.cohorts.research_brief_v2;
    const baseline = rolloutReport.cohorts.legacy;

    assert.equal(baseline.runCount, 1);
    assert.deepEqual(baseline.runStatus, { failed: 1 });
    assert.deepEqual(baseline.runLatency, {
      observedRuns: 1,
      p50Ms: 3000,
      p90Ms: 3000,
    });
    assert.deepEqual(baseline.modelUsage, {
      composeSteps: 1,
      inputTokens: 111,
    });
    assert.equal(report.runCount, 1);
    assert.deepEqual(report.runStatus, { failed: 1 });
    assert.deepEqual(report.deliveryChannel, { undelivered: 1 });
    assert.deepEqual(report.modelUsage, {
      composeSteps: 1,
      inputTokens: 222,
    });
    assert.deepEqual(report.runLatency, {
      observedRuns: 1,
      p50Ms: 2000,
      p90Ms: 2000,
    });
    assert.equal(report.workflowRiskIndicators.terminalFailures, 1);
  });

  it("counts only confirmed same-recipient SMS to email fallback", async () => {
    const db = harness.database();
    await db`
      update public.homa_task_runs
      set status = 'done', delivered_channel = 'email', finished_at = now()
      where id in (${runId(35)}, ${runId(36)}, ${runId(37)}, ${runId(38)})
    `;
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, content, visibility
      )
      values
        (
          ${"00000000-0000-4000-a200-000000000035"}, ${familyAId},
          ${runId(35)}, 'assistant', 'Confirmed fallback fixture', 'family'
        ),
        (
          ${"00000000-0000-4000-a200-000000000036"}, ${familyAId},
          ${runId(36)}, 'assistant', 'Mixed recipient fixture', 'family'
        ),
        (
          ${"00000000-0000-4000-a200-000000000037"}, ${familyAId},
          ${runId(37)}, 'assistant', 'Email only fixture', 'family'
        ),
        (
          ${"00000000-0000-4000-a200-000000000038"}, ${familyAId},
          ${runId(38)}, 'assistant', 'Unattributed fixture', 'family'
        )
    `;
    await db`
      insert into public.conversation_deliveries (
        id, family_id, message_id, task_run_id, recipient_member_user_id,
        destination_hash, channel, status, sent_at
      )
      values
        (
          ${"00000000-0000-4000-a300-000000000035"}, ${familyAId},
          ${"00000000-0000-4000-a200-000000000035"}, ${runId(35)},
          ${adultAId}, 'confirmed-sms', 'sms', 'failed', null
        ),
        (
          ${"00000000-0000-4000-a400-000000000035"}, ${familyAId},
          ${"00000000-0000-4000-a200-000000000035"}, ${runId(35)},
          ${adultAId}, 'confirmed-email', 'email', 'sent', now()
        ),
        (
          ${"00000000-0000-4000-a300-000000000036"}, ${familyAId},
          ${"00000000-0000-4000-a200-000000000036"}, ${runId(36)},
          ${adultAId}, 'mixed-sms', 'sms', 'failed', null
        ),
        (
          ${"00000000-0000-4000-a400-000000000036"}, ${familyAId},
          ${"00000000-0000-4000-a200-000000000036"}, ${runId(36)},
          ${adultASecondId}, 'mixed-email', 'email', 'sent', now()
        ),
        (
          ${"00000000-0000-4000-a400-000000000037"}, ${familyAId},
          ${"00000000-0000-4000-a200-000000000037"}, ${runId(37)},
          ${adultAId}, 'email-only', 'email', 'sent', now()
        ),
        (
          ${"00000000-0000-4000-a300-000000000038"}, ${familyAId},
          ${"00000000-0000-4000-a200-000000000038"}, ${runId(38)},
          null, 'unattributed-sms', 'sms', 'failed', null
        ),
        (
          ${"00000000-0000-4000-a400-000000000038"}, ${familyAId},
          ${"00000000-0000-4000-a200-000000000038"}, ${runId(38)},
          null, 'unattributed-email', 'email', 'sent', now()
        )
    `;
    await db`
      update public.homa_task_runs
      set started_at = '2031-01-10T12:00:00.000Z'
      where id in (
        ${runId(33)}, ${runId(34)}, ${runId(35)},
        ${runId(36)}, ${runId(37)}, ${runId(38)}
      )
    `;

    const reportRows = await runReadOnlyMorningResearchBriefReport(
      db,
      async (transaction) =>
        await loadMorningResearchBriefRolloutReportRows(transaction, {
          since: new Date("2031-01-10T00:00:00.000Z"),
          until: new Date("2031-01-11T00:00:00.000Z"),
        }),
    );
    const rolloutReport = buildMorningResearchBriefRolloutReport(reportRows);
    const report = rolloutReport.cohorts.research_brief_v2;
    assert.equal(report.sms.confirmedSmsToEmailFallback, 1);
    assert.equal(report.sms.unattributedEmailDeliveries, 1);
    assert.equal("fallbackToEmail" in report.sms, false);
  });

  it("rejects inserts and updates inside the report read-only transaction", async () => {
    const db = harness.database();
    assert.equal(
      await postgresErrorCode(
        runReadOnlyMorningResearchBriefReport(db, async (transaction) => {
          await transaction`
            insert into public.model_usage (surface)
            values ('morning_brief')
          `;
        }),
      ),
      "25006",
    );
    assert.equal(
      await postgresErrorCode(
        runReadOnlyMorningResearchBriefReport(db, async (transaction) => {
          await transaction`
            update public.homa_task_runs
            set summary = 'forbidden report write'
            where id = ${runId(31)}
          `;
        }),
      ),
      "25006",
    );
  });

  it("uses the Task 8 indexes for outcome and proximate-interest reads", async () => {
    const db = harness.database();
    const episodeId = "00000000-0000-4000-b000-000000000001";
    await db`
      create table task8_analytics_fixture as
      select
        generate_series as sequence,
        gen_random_uuid() as outbound_message_id,
        gen_random_uuid() as user_message_id,
        gen_random_uuid() as delivery_id,
        gen_random_uuid() as loop_id,
        ${episodeId}::uuid as episode_id,
        case
          when generate_series <= 100
          then now() - (generate_series % 60) * interval '1 minute'
          else now() - interval '30 days'
            - (generate_series % 1440) * interval '1 minute'
        end as sent_at
      from generate_series(1, 20000)
    `;
    await db`
      insert into public.conversation_messages (
        id, family_id, task_run_id, role, visibility, episode_id, created_at
      )
      select
        outbound_message_id, ${familyAId}, ${runId(1)}, 'assistant',
        'family', episode_id, sent_at
      from task8_analytics_fixture
    `;
    await db`
      insert into public.conversation_messages (
        id, family_id, role, visibility, episode_id,
        replied_delivery_id, created_at
      )
      select
        user_message_id, ${familyAId}, 'user', 'family', episode_id,
        null, sent_at + interval '30 minutes'
      from task8_analytics_fixture
    `;
    await db`
      insert into public.conversation_deliveries (
        id, family_id, episode_id, message_id, task_run_id, channel,
        status, sent_at
      )
      select
        delivery_id, ${familyAId}, episode_id, outbound_message_id,
        ${runId(1)}, 'email', 'sent', sent_at
      from task8_analytics_fixture
    `;
    await db`
      insert into public.conversation_open_loops (
        id, family_id, episode_id, message_id, delivery_id, state,
        resolved_at, resolved_outcome
      )
      select
        loop_id, ${familyAId}, episode_id, outbound_message_id, delivery_id,
        'resolved', sent_at + interval '30 minutes', 'accepted'
      from task8_analytics_fixture
    `;
    await db`analyze public.conversation_messages`;
    await db`analyze public.conversation_deliveries`;
    await db`analyze public.conversation_open_loops`;

    const outcomePlanRows = await db<Record<string, unknown>[]>`
      explain (costs off)
      select r.kind, l.resolved_outcome
      from public.conversation_open_loops l
      join public.conversation_deliveries d on d.id = l.delivery_id
      join public.homa_task_runs r
        on r.id = d.task_run_id
       and r.family_id = d.family_id
      where r.kind in ('journal_prompt', 'morning_brief', 'custom')
        and l.state = 'resolved'
        and l.resolved_at >= now() - interval '7 days'
    `;
    const outcomePlan = outcomePlanRows
      .flatMap((row) => Object.values(row))
      .join("\n");
    assert.match(
      outcomePlan,
      /conversation_open_loops_resolved_range_idx/u,
    );

    const sentPlanRows = await db<Record<string, unknown>[]>`
      explain (costs off)
      select r.kind
      from public.conversation_deliveries d
      join public.conversation_open_loops l on l.delivery_id = d.id
      join public.homa_task_runs r
        on r.id = d.task_run_id
       and r.family_id = d.family_id
      where r.kind in ('journal_prompt', 'morning_brief', 'custom')
        and d.status = 'sent'
        and d.sent_at >= now() - interval '7 days'
    `;
    const sentPlan = sentPlanRows
      .flatMap((row) => Object.values(row))
      .join("\n");
    assert.match(
      sentPlan,
      /conversation_deliveries_sent_at_task_idx/u,
    );

    const proximityPlanRows = await db<Record<string, unknown>[]>`
      explain (costs off)
      select m.id
      from public.conversation_messages m
      join lateral (
        select d.sent_at
        from public.conversation_deliveries d
        join public.homa_task_runs r
          on r.id = d.task_run_id
         and r.family_id = d.family_id
        where d.family_id = m.family_id
          and d.episode_id = m.episode_id
          and d.status = 'sent'
          and r.kind = 'morning_brief'
          and d.sent_at <= m.created_at
          and m.created_at <= d.sent_at + interval '4 hours'
        order by d.sent_at desc
        limit 1
      ) brief on true
      where m.role = 'user'
        and m.replied_delivery_id is null
        and m.created_at >= now() - interval '7 days'
    `;
    const proximityPlan = proximityPlanRows
      .flatMap((row) => Object.values(row))
      .join("\n");
    assert.match(
      proximityPlan,
      /conversation_messages_unlinked_user_created_at_idx/u,
    );
    assert.match(
      proximityPlan,
      /conversation_deliveries_family_episode_sent_idx/u,
    );
  });
});
