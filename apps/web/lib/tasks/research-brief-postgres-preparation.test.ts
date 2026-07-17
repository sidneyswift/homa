import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  childAId,
  concurrentKnowledgeId,
  createDisposableResearchBriefPostgresHarness,
  deliveredKnowledgeId,
  familyAId,
  idempotentKnowledgeId,
  preparationRecord,
  recentlyUsedKnowledgeId,
  reservedKnowledgeId,
  runId,
  supersessionKnowledgeId,
  terminalRunKnowledgeId,
} from "./research-brief-postgres-harness";
import {
  reserveResearchBriefPreparationWithDatabase,
} from "./research-brief-preparation";

const harness = createDisposableResearchBriefPostgresHarness("preparation");

describe("research brief PostgreSQL preparation", () => {
  before(async () => await harness.start());
  after(async () => await harness.stop());

  it("rejects a task run that finished after context loading", async () => {
    const db = harness.database();
    await db`
      update public.homa_task_runs
      set status = 'done'
      where id = ${runId(10)}
    `;
    assert.deepEqual(
      await reserveResearchBriefPreparationWithDatabase(
        db,
        preparationRecord(10, idempotentKnowledgeId),
      ),
      { prepared: false, reason: "inactive_run" },
    );
    const [stored] = await db<{ count: number }[]>`
      select count(*)::integer as count
      from public.research_brief_preparations
      where task_run_id = ${runId(10)}
    `;
    assert.equal(stored?.count, 0);
  });

  it("rejects a source delivered after context loading", async () => {
    const db = harness.database();
    const now = new Date("2026-07-16T12:00:00.000Z");
    await db`
      insert into public.family_knowledge_use (
        family_id, knowledge_bank_id, task_run_id, used_at
      )
      values (
        ${familyAId}, ${recentlyUsedKnowledgeId}, ${runId(11)},
        ${now.toISOString()}
      )
    `;
    assert.deepEqual(
      await reserveResearchBriefPreparationWithDatabase(
        db,
        preparationRecord(12, recentlyUsedKnowledgeId),
        now,
      ),
      { prepared: false, reason: "knowledge_row_recently_used" },
    );
    const [stored] = await db<{ count: number }[]>`
      select count(*)::integer as count
      from public.research_brief_preparations
      where task_run_id = ${runId(12)}
    `;
    assert.equal(stored?.count, 0);
  });

  it("rejects a source reserved after context loading", async () => {
    const db = harness.database();
    await db`
      insert into public.research_brief_preparations (
        task_run_id, family_id, child_id, knowledge_bank_id, draft,
        draft_hash, source_snapshot, prepared_at
      )
      values (
        ${runId(13)}, ${familyAId}, ${childAId}, ${reservedKnowledgeId},
        'Existing reservation', ${"b".repeat(64)}, '{}'::jsonb, now()
      )
    `;
    assert.deepEqual(
      await reserveResearchBriefPreparationWithDatabase(
        db,
        preparationRecord(14, reservedKnowledgeId),
      ),
      { prepared: false, reason: "source_reserved" },
    );
    const [stored] = await db<{ count: number }[]>`
      select count(*)::integer as count
      from public.research_brief_preparations
      where task_run_id = ${runId(14)}
    `;
    assert.equal(stored?.count, 0);
  });

  it("preserves terminal audit evidence without reserving its source", async () => {
    const db = harness.database();
    await db`
      insert into public.research_brief_preparations (
        task_run_id, family_id, child_id, knowledge_bank_id, draft,
        draft_hash, source_snapshot, prepared_at
      )
      values (
        ${runId(17)}, ${familyAId}, ${childAId}, ${terminalRunKnowledgeId},
        'Failed run audit draft', ${"b".repeat(64)}, '{}'::jsonb, now()
      )
    `;
    await db`
      update public.homa_task_runs
      set status = 'failed'
      where id = ${runId(17)}
    `;

    assert.deepEqual(
      await reserveResearchBriefPreparationWithDatabase(
        db,
        preparationRecord(20, terminalRunKnowledgeId, "New reservation"),
      ),
      { prepared: true },
    );
    const [stored] = await db<{
      total: number;
      failedAudit: number;
      newReservation: number;
    }[]>`
      select
        count(*)::integer as total,
        count(*) filter (
          where task_run_id = ${runId(17)}
        )::integer as "failedAudit",
        count(*) filter (
          where task_run_id = ${runId(20)}
        )::integer as "newReservation"
      from public.research_brief_preparations
      where family_id = ${familyAId}
        and knowledge_bank_id = ${terminalRunKnowledgeId}
        and delivered_at is null
    `;
    assert.deepEqual(stored, {
      total: 2,
      failedAudit: 1,
      newReservation: 1,
    });
  });

  it("reports when a delivered preparation blocks the conditional upsert", async () => {
    const db = harness.database();
    await db`
      insert into public.research_brief_preparations (
        task_run_id, family_id, child_id, knowledge_bank_id, draft,
        draft_hash, source_snapshot, prepared_at, delivered_at
      )
      values (
        ${runId(15)}, ${familyAId}, ${childAId}, ${deliveredKnowledgeId},
        'Delivered draft', ${"c".repeat(64)}, '{}'::jsonb, now(), now()
      )
    `;
    assert.deepEqual(
      await reserveResearchBriefPreparationWithDatabase(
        db,
        preparationRecord(15, deliveredKnowledgeId, "Forbidden revision"),
      ),
      { prepared: false, reason: "already_delivered" },
    );
    const [stored] = await db<{ draft: string }[]>`
      select draft
      from public.research_brief_preparations
      where task_run_id = ${runId(15)}
    `;
    assert.equal(stored?.draft, "Delivered draft");
  });

  it("reports successful inserts and idempotent revisions", async () => {
    const db = harness.database();
    for (const draft of ["Initial prepared draft", "Revised prepared draft"]) {
      assert.deepEqual(
        await reserveResearchBriefPreparationWithDatabase(
          db,
          preparationRecord(16, idempotentKnowledgeId, draft),
        ),
        { prepared: true },
      );
    }
    const [stored] = await db<{ count: number; draft: string }[]>`
      select count(*)::integer as count, max(draft) as draft
      from public.research_brief_preparations
      where task_run_id = ${runId(16)}
    `;
    assert.deepEqual(stored, {
      count: 1,
      draft: "Revised prepared draft",
    });
  });

  it("serializes concurrent reservations for one family and source", async () => {
    const db = harness.database();
    const outcomes = await Promise.all([
      reserveResearchBriefPreparationWithDatabase(
        db,
        preparationRecord(18, concurrentKnowledgeId, "First contender"),
      ),
      reserveResearchBriefPreparationWithDatabase(
        db,
        preparationRecord(19, concurrentKnowledgeId, "Second contender"),
      ),
    ]);
    assert.equal(
      outcomes.filter((outcome) => outcome.prepared).length,
      1,
    );
    assert.equal(
      outcomes.filter(
        (outcome) =>
          !outcome.prepared && outcome.reason === "source_reserved",
      ).length,
      1,
    );
    const [stored] = await db<{ count: number }[]>`
      select count(*)::integer as count
      from public.research_brief_preparations
      where family_id = ${familyAId}
        and knowledge_bank_id = ${concurrentKnowledgeId}
        and delivered_at is null
    `;
    assert.equal(stored?.count, 1);
  });

  it("rejects a knowledge row superseded while preparation waits for its topic lock", async () => {
    const db = harness.database();
    let markLockAcquired: (() => void) | undefined;
    const lockAcquired = new Promise<void>((resolve) => {
      markLockAcquired = resolve;
    });
    let releaseSupersession: (() => void) | undefined;
    const waitForRelease = new Promise<void>((resolve) => {
      releaseSupersession = resolve;
    });
    const supersession = db.begin(async (transaction) => {
      await transaction`
        select pg_advisory_xact_lock(hashtextextended('test-topic', 0))
      `;
      await transaction`
        update public.knowledge_bank
        set status = 'superseded',
            superseded_by = ${concurrentKnowledgeId}
        where id = ${supersessionKnowledgeId}
      `;
      markLockAcquired?.();
      await waitForRelease;
    });
    await lockAcquired;

    const reservation = reserveResearchBriefPreparationWithDatabase(
      db,
      preparationRecord(39, supersessionKnowledgeId),
    );
    releaseSupersession?.();
    await supersession;

    assert.deepEqual(await reservation, {
      prepared: false,
      reason: "knowledge_row_changed",
    });
  });
});
