import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  adultAId,
  createDisposableResearchBriefPostgresHarness,
  familyAId,
  fleetRunId,
  postgresErrorCode,
  runId,
} from "./research-brief-postgres-harness";
import {
  isResearchBriefFeedbackSignal,
  recordResearchBriefFeedbackWithDatabase,
} from "./research-brief-feedback";
import {
  RESEARCH_BRIEF_FEEDBACK_KIND,
  RESEARCH_BRIEF_FEEDBACK_OUTCOMES,
} from "./research-brief-feedback-contract";

const harness = createDisposableResearchBriefPostgresHarness("feedback");

describe("research brief PostgreSQL feedback and analytics", () => {
  before(async () => await harness.start());
  after(async () => await harness.stop());

  it("allows one member feedback row per run and adult", async () => {
    const db = harness.database();
    for (const signal of ["helpful", "not_for_us"]) {
      await db`
        insert into public.research_brief_feedback (
          family_id, task_run_id, member_user_id, signal,
          created_at, updated_at
        )
        values (
          ${familyAId}, ${runId(8)}, ${adultAId}, ${signal}, now(), now()
        )
        on conflict (task_run_id, member_user_id) do update
        set signal = excluded.signal, updated_at = excluded.updated_at
      `;
    }
    const [stored] = await db<{ count: number; signal: string }[]>`
      select count(*)::integer as count, max(signal) as signal
      from public.research_brief_feedback
      where task_run_id = ${runId(8)} and member_user_id = ${adultAId}
    `;
    assert.deepEqual(stored, { count: 1, signal: "not_for_us" });
  });

  it("records feedback only for a confirmed delivered morning brief", async () => {
    const db = harness.database();
    const taskRunId = runId(10);
    await db`
      update public.homa_task_runs
      set status = 'done', delivered_channel = 'sms'
      where id = ${taskRunId} and family_id = ${familyAId}
    `;

    const events: Array<{
      familyId: string;
      taskRunId: string;
      signal: string;
    }> = [];
    const result = await recordResearchBriefFeedbackWithDatabase(db, {
      familyId: familyAId,
      taskRunId,
      memberUserId: adultAId,
      signal: "helpful",
      emit: async ({ familyId, taskRunId: emittedTaskRunId, signal }) => {
        events.push({ familyId, taskRunId: emittedTaskRunId, signal });
      },
    });

    assert.deepEqual(result, {
      accepted: true,
      wrote: true,
      signal: "helpful",
    });
    assert.deepEqual(events, [{
      familyId: familyAId,
      taskRunId,
      signal: "helpful",
    }]);
  });

  it("does not emit again for a duplicate signal but emits for a changed signal", async () => {
    const db = harness.database();
    const taskRunId = runId(10);
    const events: string[] = [];
    const input = {
      familyId: familyAId,
      taskRunId,
      memberUserId: adultAId,
      emit: async ({
        taskRunId: emittedTaskRunId,
        signal,
      }: {
        familyId: string;
        taskRunId: string;
        signal: "helpful" | "not_for_us";
      }) => {
        events.push(`${emittedTaskRunId}:${signal}`);
      },
    };

    const duplicate = await recordResearchBriefFeedbackWithDatabase(db, {
      ...input,
      signal: "helpful",
    });
    const changed = await recordResearchBriefFeedbackWithDatabase(db, {
      ...input,
      signal: "not_for_us",
    });

    assert.deepEqual(duplicate, {
      accepted: true,
      wrote: false,
      signal: "helpful",
    });
    assert.deepEqual(changed, {
      accepted: true,
      wrote: true,
      signal: "not_for_us",
    });
    assert.deepEqual(events, [`${taskRunId}:not_for_us`]);
  });

  it("keeps durable feedback successful when best-effort analytics fails", async () => {
    const db = harness.database();
    const taskRunId = runId(37);
    await db`
      update public.homa_task_runs
      set status = 'done', delivered_channel = 'sms'
      where id = ${taskRunId}
    `;
    const originalConsoleError = console.error;
    const logs: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      logs.push(args);
    };
    try {
      const result = await recordResearchBriefFeedbackWithDatabase(db, {
        familyId: familyAId,
        taskRunId,
        memberUserId: adultAId,
        signal: "helpful",
        emit: async () => {
          throw new Error("private parent content must not be logged");
        },
      });
      assert.deepEqual(result, {
        accepted: true,
        wrote: true,
        signal: "helpful",
      });
      const retry = await recordResearchBriefFeedbackWithDatabase(db, {
        familyId: familyAId,
        taskRunId,
        memberUserId: adultAId,
        signal: "helpful",
        emit: async () => assert.fail("same signal must not emit again"),
      });
      assert.deepEqual(retry, {
        accepted: true,
        wrote: false,
        signal: "helpful",
      });
      assert.deepEqual(logs, [
        ["research brief feedback analytics emission failed"],
      ]);
    } finally {
      console.error = originalConsoleError;
    }
  });

  it("keeps database eligibility in parity with the shared typed contract", async () => {
    const db = harness.database();
    const taskRunId = runId(18);

    for (const [status, channel] of RESEARCH_BRIEF_FEEDBACK_OUTCOMES) {
      await db`
        update public.homa_task_runs
        set kind = ${RESEARCH_BRIEF_FEEDBACK_KIND},
            status = ${status},
            delivered_channel = ${channel}
        where id = ${taskRunId} and family_id = ${familyAId}
      `;
      await db`
        delete from public.research_brief_feedback
        where task_run_id = ${taskRunId} and member_user_id = ${adultAId}
      `;

      const result = await recordResearchBriefFeedbackWithDatabase(db, {
        familyId: familyAId,
        taskRunId,
        memberUserId: adultAId,
        signal: "helpful",
        emit: async () => undefined,
      });

      assert.deepEqual(
        result,
        { accepted: true, wrote: true, signal: "helpful" },
        `${status}/${channel}`,
      );
    }

    for (const status of ["partial", "partial_uncertain"] as const) {
      await db`
        update public.homa_task_runs
        set status = ${status}, delivered_channel = 'none'
        where id = ${taskRunId} and family_id = ${familyAId}
      `;
      await db`
        delete from public.research_brief_feedback
        where task_run_id = ${taskRunId} and member_user_id = ${adultAId}
      `;

      const result = await recordResearchBriefFeedbackWithDatabase(db, {
        familyId: familyAId,
        taskRunId,
        memberUserId: adultAId,
        signal: "helpful",
        emit: async () => assert.fail("invalid outcome must not emit an event"),
      });

      assert.deepEqual(
        result,
        { accepted: false, wrote: false, signal: null },
        `${status}/none`,
      );
    }
  });

  it("rejects cross-family, fleet, non-brief, and non-delivered runs", async () => {
    const db = harness.database();
    const rejected = [
      { taskRunId: runId(2), familyId: familyAId },
      { taskRunId: fleetRunId, familyId: familyAId },
      { taskRunId: runId(28), familyId: familyAId },
      { taskRunId: runId(11), familyId: familyAId },
      { taskRunId: runId(22), familyId: familyAId },
    ];
    await db`
      update public.homa_task_runs
      set status = 'failed', delivered_channel = 'sms'
      where id = ${runId(11)} and family_id = ${familyAId}
    `;
    await db`
      update public.homa_task_runs
      set status = 'done', delivered_channel = 'sms'
      where id = ${runId(22)} and family_id = ${familyAId}
    `;

    for (const input of rejected) {
      const result = await recordResearchBriefFeedbackWithDatabase(db, {
        ...input,
        memberUserId: adultAId,
        signal: "helpful",
        emit: async () => assert.fail("rejected feedback must not emit an event"),
      });
      assert.deepEqual(result, {
        accepted: false,
        wrote: false,
        signal: null,
      });
    }
  });

  it("rejects running, skipped, and uncertain-only brief outcomes", async () => {
    const db = harness.database();
    const statusByRun = new Map([
      [runId(12), "running"],
      [runId(13), "skipped"],
      [runId(14), "uncertain"],
    ]);
    for (const [taskRunId, status] of statusByRun) {
      await db`
        update public.homa_task_runs
        set status = ${status}, delivered_channel = 'sms'
        where id = ${taskRunId} and family_id = ${familyAId}
      `;
      const result = await recordResearchBriefFeedbackWithDatabase(db, {
        familyId: familyAId,
        taskRunId,
        memberUserId: adultAId,
        signal: "helpful",
        emit: async () => assert.fail("rejected feedback must not emit an event"),
      });
      assert.deepEqual(result, {
        accepted: false,
        wrote: false,
        signal: null,
      });
    }
  });

  it("accepts only the two explicit feedback signals", () => {
    assert.equal(isResearchBriefFeedbackSignal("helpful"), true);
    assert.equal(isResearchBriefFeedbackSignal("not_for_us"), true);
    assert.equal(isResearchBriefFeedbackSignal("liked_it"), false);
    assert.equal(isResearchBriefFeedbackSignal(null), false);
  });

  it("allows only causal resolved outcomes", async () => {
    const db = harness.database();
    for (const outcome of ["accepted", "declined", "answered"]) {
      await db`
        insert into public.conversation_open_loops (resolved_outcome)
        values (${outcome})
      `;
    }
    assert.equal(
      await postgresErrorCode(db`
        insert into public.conversation_open_loops (resolved_outcome)
        values ('maybe')
      `),
      "23514",
    );
  });
});
