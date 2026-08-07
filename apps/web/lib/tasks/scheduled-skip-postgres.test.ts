import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  adultAId,
  createDisposableResearchBriefPostgresHarness,
  familyAId,
} from "./research-brief-postgres-harness";
import {
  recordSkippedScheduledTaskRunWithDatabase,
  type DueFamilyTask,
} from "./store";

const harness = createDisposableResearchBriefPostgresHarness("scheduled_skip");

function scheduledTask(scheduleId: string): DueFamilyTask {
  return {
    scheduleId,
    familyId: familyAId,
    familySandbox: true,
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
    sourceOfferDeliveryId: null,
  };
}

describe("atomic scheduled no-candidate skip", () => {
  before(async () => await harness.start());
  after(async () => await harness.stop());

  it("inserts one final skipped run and advances the due schedule in one transaction", async () => {
    const database = harness.database();
    const scheduleId = "00000000-0000-4000-8000-000000000301";
    const now = new Date("2026-07-17T13:00:00.000Z");
    await database`
      insert into public.agent_schedules (
        id, family_id, kind, next_run_at, lease_until, local_hour, weekdays
      )
      values (
        ${scheduleId}, ${familyAId}, 'morning_brief',
        ${new Date(now.getTime() - 60_000).toISOString()},
        ${new Date(now.getTime() + 600_000).toISOString()},
        9, ${database.array([1, 2, 3, 4, 5])}::smallint[]
      )
    `;
    const events: Array<{ name: string; props: Record<string, unknown> }> = [];

    const result = await recordSkippedScheduledTaskRunWithDatabase(
      database,
      {
        task: scheduledTask(scheduleId),
        now,
        deliveryVersion: "research_brief_v2",
        reason: "no eligible morning brief candidate",
      },
      async (name, props) => {
        events.push({ name, props });
      },
    );

    assert.equal(result.inserted, true);
    const [run] = await database<{
      status: string;
      error: string | null;
      delivery_version: string;
      finished_at: string | null;
    }[]>`
      select status, error, delivery_version, finished_at::text
      from public.homa_task_runs
      where schedule_id = ${scheduleId}
    `;
    assert.deepEqual(
      {
        status: run.status,
        error: run.error,
        deliveryVersion: run.delivery_version,
        finished: Boolean(run.finished_at),
      },
      {
        status: "skipped",
        error: "no eligible morning brief candidate",
        deliveryVersion: "research_brief_v2",
        finished: true,
      },
    );
    const [schedule] = await database<{
      next_run_at: string;
      lease_until: string | null;
      last_run_at: string | null;
    }[]>`
      select next_run_at::text, lease_until::text, last_run_at::text
      from public.agent_schedules
      where id = ${scheduleId}
    `;
    assert.ok(Date.parse(schedule.next_run_at) > now.getTime());
    assert.equal(schedule.lease_until, null);
    assert.ok(schedule.last_run_at);
    const [effects] = await database<{
      messages: number;
      deliveries: number;
      preparations: number;
      source_uses: number;
    }[]>`
      select
        (select count(*)::int
         from public.conversation_messages
         where task_run_id = ${result.inserted ? result.runId : null}) as messages,
        (select count(*)::int
         from public.conversation_deliveries
         where task_run_id = ${result.inserted ? result.runId : null}) as deliveries,
        (select count(*)::int
         from public.research_brief_preparations
         where task_run_id = ${result.inserted ? result.runId : null}) as preparations,
        (select count(*)::int
         from public.family_knowledge_use
         where task_run_id = ${result.inserted ? result.runId : null}) as source_uses
    `;
    assert.deepEqual(effects, {
      messages: 0,
      deliveries: 0,
      preparations: 0,
      source_uses: 0,
    });
    assert.deepEqual(events, [{
      name: "tasks.run_completed",
      props: {
        family_id: familyAId,
        kind: "morning_brief",
        status: "skipped",
      },
    }]);
  });

  for (const [index, status] of ["running", "done", "skipped"].entries()) {
    it(`advances and clears a due schedule when the outbox conflicts with a prior ${status} row`, async () => {
      const database = harness.database();
      const scheduleId =
        `00000000-0000-4000-8000-${String(304 + index).padStart(12, "0")}`;
      const now = new Date("2026-07-17T13:00:00.000Z");
      await database`
        insert into public.agent_schedules (
          id, family_id, kind, next_run_at, lease_until, local_hour, weekdays
        )
        values (
          ${scheduleId}, ${familyAId}, 'morning_brief',
          ${new Date(now.getTime() - 60_000).toISOString()},
          ${new Date(now.getTime() + 600_000).toISOString()},
          9, ${database.array([1, 2, 3, 4, 5])}::smallint[]
        )
      `;
      await database`
        insert into public.homa_task_runs (
          family_id, schedule_id, kind, status, scheduled_for, title,
          delivery_version, finished_at
        )
        values (
          ${familyAId}, ${scheduleId}, 'morning_brief', ${status},
          '2026-07-17', 'Existing outbox run', 'legacy',
          ${status === "running" ? null : now.toISOString()}
        )
      `;
      const events: string[] = [];

      const result = await recordSkippedScheduledTaskRunWithDatabase(
        database,
        {
          task: scheduledTask(scheduleId),
          now,
          deliveryVersion: "research_brief_v2",
          reason: "no eligible morning brief candidate",
        },
        async (name) => {
          events.push(name);
        },
      );
      const [schedule] = await database<{
        next_run_at: string;
        lease_until: string | null;
      }[]>`
        select next_run_at::text, lease_until::text
        from public.agent_schedules
        where id = ${scheduleId}
      `;
      const [run] = await database<{
        count: number;
        status: string;
        delivery_version: string;
      }[]>`
        select count(*)::int as count, min(status) as status,
               min(delivery_version) as delivery_version
        from public.homa_task_runs
        where schedule_id = ${scheduleId}
      `;

      assert.equal(result.inserted, false);
      assert.equal(run.count, 1);
      assert.equal(run.status, status);
      assert.equal(run.delivery_version, "legacy");
      assert.ok(Date.parse(schedule.next_run_at) > now.getTime());
      assert.equal(schedule.lease_until, null);
      assert.deepEqual(events, []);
    });
  }

  it("does not advance an already-advanced schedule or emit a replay event", async () => {
    const database = harness.database();
    const scheduleId = "00000000-0000-4000-8000-000000000302";
    const now = new Date("2026-07-17T13:00:00.000Z");
    await database`
      insert into public.agent_schedules (
        id, family_id, kind, next_run_at, lease_until, local_hour, weekdays
      )
      values (
        ${scheduleId}, ${familyAId}, 'morning_brief',
        ${new Date(now.getTime() - 60_000).toISOString()},
        ${new Date(now.getTime() + 600_000).toISOString()},
        9, ${database.array([1, 2, 3, 4, 5])}::smallint[]
      )
    `;
    const events: string[] = [];
    const input = {
      task: scheduledTask(scheduleId),
      now,
      deliveryVersion: "research_brief_v2" as const,
      reason: "no eligible morning brief candidate" as const,
    };

    const first = await recordSkippedScheduledTaskRunWithDatabase(
      database,
      input,
      async (name) => {
        events.push(name);
      },
    );
    const [afterFirst] = await database<{ next_run_at: string }[]>`
      select next_run_at::text
      from public.agent_schedules
      where id = ${scheduleId}
    `;
    const replay = await recordSkippedScheduledTaskRunWithDatabase(
      database,
      input,
      async (name) => {
        events.push(name);
      },
    );
    const [afterReplay] = await database<{ next_run_at: string }[]>`
      select next_run_at::text
      from public.agent_schedules
      where id = ${scheduleId}
    `;
    const [{ count }] = await database<{ count: number }[]>`
      select count(*)::int as count
      from public.homa_task_runs
      where schedule_id = ${scheduleId}
    `;

    assert.equal(first.inserted, true);
    assert.equal(replay.inserted, false);
    assert.equal(count, 1);
    assert.equal(afterReplay.next_run_at, afterFirst.next_run_at);
    assert.deepEqual(events, ["tasks.run_completed"]);
  });

  it("rolls back the inserted run when the schedule is no longer due", async () => {
    const database = harness.database();
    const scheduleId = "00000000-0000-4000-8000-000000000303";
    const now = new Date("2026-07-17T13:00:00.000Z");
    const futureRunAt = new Date(now.getTime() + 86_400_000).toISOString();
    const leaseUntil = new Date(now.getTime() + 600_000).toISOString();
    await database`
      insert into public.agent_schedules (
        id, family_id, kind, next_run_at, lease_until, local_hour, weekdays
      )
      values (
        ${scheduleId}, ${familyAId}, 'morning_brief', ${futureRunAt},
        ${leaseUntil}, 9,
        ${database.array([1, 2, 3, 4, 5])}::smallint[]
      )
    `;
    const events: string[] = [];

    await assert.rejects(
      () =>
        recordSkippedScheduledTaskRunWithDatabase(
          database,
          {
            task: scheduledTask(scheduleId),
            now,
            deliveryVersion: "research_brief_v2",
            reason: "no eligible morning brief candidate",
          },
          async (name) => {
            events.push(name);
          },
        ),
      /schedule was no longer due/,
    );
    const [{ count }] = await database<{ count: number }[]>`
      select count(*)::int as count
      from public.homa_task_runs
      where schedule_id = ${scheduleId}
    `;
    const [schedule] = await database<{
      next_run_at: string;
      lease_until: string | null;
    }[]>`
      select next_run_at::text, lease_until::text
      from public.agent_schedules
      where id = ${scheduleId}
    `;

    assert.equal(count, 0);
    assert.equal(Date.parse(schedule.next_run_at), Date.parse(futureRunAt));
    assert.ok(schedule.lease_until);
    assert.deepEqual(events, []);
  });
});
