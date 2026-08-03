import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import postgres from "postgres";

import {
  EVAL_FIXTURE_PARENT_USER_ID,
  EVAL_FIXTURE_PLAN_CHILD_ID,
  EVAL_FIXTURE_PLAN_SUBJECT,
} from "../apps/web/lib/family-context-eval-fixture";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Run through `pnpm eval:sandbox --exec ...`.");
}

interface StoredPlan {
  id: string;
  family_id: string;
  report_token: string;
  plan: {
    weeks: Array<{
      week: number;
      focus: string;
      activities: string[];
    }>;
    [key: string]: unknown;
  };
}

interface ActivityIdentity {
  weekIndex: number;
  week: number;
  activityIndex: number;
  key: string;
  text: string;
}

const sql = postgres(databaseUrl, { prepare: false, max: 4 });
const reportToken = `plan-rebuild-e2e-${randomUUID()}`;
const initialPlan = {
  subjectId: EVAL_FIXTURE_PLAN_SUBJECT,
  subjectName: "Math",
  childAgeLabel: "4-year-old",
  startingLine: "Counts to 10 with one-to-one pointing.",
  targets: ["Counting to 20", "Comparing small groups"],
  weeks: [1, 2, 3, 4].map((week) => ({
    week,
    focus: `Week ${week} counting practice`,
    activities: [
      `Count the red blocks in week ${week}.`,
      `Match two groups in week ${week}.`,
    ],
  })),
  styleNote: null,
  bankVersion: "plan-rebuild-e2e",
};

async function readAsAuthenticated(
  userId: string,
  historyId: string,
): Promise<Array<{ id: string }>> {
  return sql.begin(async (transaction) => {
    await transaction`
      select set_config('request.jwt.claim.sub', ${userId}, true)
    `;
    await transaction`set local role authenticated`;
    return transaction<Array<{ id: string }>>`
      select id
      from public.child_plan_rebuild_history
      where id = ${historyId}
    `;
  });
}

async function expectAuthenticatedWriteDenied(
  historyId: string,
  operation: "insert" | "update" | "delete",
): Promise<void> {
  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`
        select set_config(
          'request.jwt.claim.sub',
          ${EVAL_FIXTURE_PARENT_USER_ID},
          true
        )
      `;
      await transaction`set local role authenticated`;
      if (operation === "insert") {
        await transaction`
          insert into public.child_plan_rebuild_history (
            child_id, subject_id, plan_id, plan_revision, progress_revision,
            plan, progress, remapped_progress, source_links, scheduled_days,
            archived_done_count, preserved_done_count, reason
          )
          select
            child_id, subject_id, plan_id, plan_revision, progress_revision,
            plan, progress, remapped_progress, source_links, scheduled_days,
            archived_done_count, preserved_done_count, reason
          from public.child_plan_rebuild_history
          where id = ${historyId}
        `;
      } else if (operation === "update") {
        await transaction`
          update public.child_plan_rebuild_history
          set archived_done_count = archived_done_count
          where id = ${historyId}
        `;
      } else {
        await transaction`
          delete from public.child_plan_rebuild_history
          where id = ${historyId}
        `;
      }
    }),
    /permission denied for table child_plan_rebuild_history/u,
  );
}

try {
  const [fixtureChild] = await sql<Array<{ family_id: string }>>`
    select family_id
    from public.children
    where id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
  `;
  assert.ok(fixtureChild, "the eval fixture includes the plan child");
  await sql`
    insert into public.child_reports (child_id, scores, bank_version, token)
    values (
      ${EVAL_FIXTURE_PLAN_CHILD_ID}, '{}'::jsonb,
      'plan-rebuild-e2e', ${reportToken}
    )
    on conflict (child_id) do update
    set scores = excluded.scores,
        bank_version = excluded.bank_version,
        token = excluded.token
  `;
  await sql`
    insert into public.child_plans (
      child_id, subject_id, plan, bank_version, progress, retest_at
    ) values (
      ${EVAL_FIXTURE_PLAN_CHILD_ID}, ${EVAL_FIXTURE_PLAN_SUBJECT},
      ${sql.json(initialPlan)}, 'plan-rebuild-e2e', '{}'::jsonb,
      now() + interval '28 days'
    )
    on conflict (child_id, subject_id) do update
    set plan = excluded.plan,
        bank_version = excluded.bank_version,
        progress = excluded.progress,
        retest_at = excluded.retest_at
  `;

  const [stored] = await sql<StoredPlan[]>`
    select
      p.id,
      c.family_id,
      r.token as report_token,
      p.plan
    from public.child_plans p
    join public.children c on c.id = p.child_id
    join public.child_reports r on r.child_id = p.child_id
    where p.child_id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
      and p.subject_id = ${EVAL_FIXTURE_PLAN_SUBJECT}
    limit 1
  `;
  assert.ok(stored, "the eval fixture includes a report-backed plan");

  const activities: ActivityIdentity[] = stored.plan.weeks.flatMap(
    (week, weekIndex) =>
      week.activities.map((text, activityIndex) => ({
        weekIndex,
        week: week.week,
        activityIndex,
        key: `${week.week}.${activityIndex}`,
        text,
      })),
  );
  const textCounts = new Map<string, number>();
  for (const activity of activities) {
    textCounts.set(activity.text, (textCounts.get(activity.text) ?? 0) + 1);
  }
  const [kept, archivedOnly] = activities.filter(
    (activity) => textCounts.get(activity.text) === 1,
  );
  assert.ok(kept && archivedOnly, "the fixture has two uniquely worded activities");

  await sql`
    update public.child_plans
    set progress = ${sql.json({ [kept.key]: true, [archivedOnly.key]: true })}
    where id = ${stored.id}
  `;
  await sql`
    delete from public.plan_activity_schedule
    where family_id = ${stored.family_id}
      and child_id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
      and subject_id = ${EVAL_FIXTURE_PLAN_SUBJECT}
  `;
  await sql`
    insert into public.plan_activity_schedule (
      family_id, child_id, subject_id, week, activity_index, scheduled_date
    ) values (
      ${stored.family_id}, ${EVAL_FIXTURE_PLAN_CHILD_ID},
      ${EVAL_FIXTURE_PLAN_SUBJECT}, ${kept.week}, ${kept.activityIndex},
      '2026-08-05'::date
    )
  `;

  const nextPlan = structuredClone(stored.plan);
  nextPlan.weeks[kept.weekIndex].activities[kept.activityIndex] =
    `Fresh rebuild activity ${randomUUID()}`;
  nextPlan.weeks[archivedOnly.weekIndex].activities[archivedOnly.activityIndex] =
    kept.text;

  const { getPlanRebuildReceipt, writeRebuiltPlan } = await import(
    "../apps/web/lib/map/store"
  );
  const result = await writeRebuiltPlan(
    sql as Parameters<typeof writeRebuiltPlan>[0],
    {
      familyId: stored.family_id,
      childId: EVAL_FIXTURE_PLAN_CHILD_ID,
      subjectId: EVAL_FIXTURE_PLAN_SUBJECT,
      plan: nextPlan as Parameters<typeof writeRebuiltPlan>[1]["plan"],
    },
  );
  assert.equal(result.wasNew, false);
  assert.equal(result.archivedDoneCount, 2);
  assert.equal(result.preservedDoneCount, 1);
  assert.equal(result.archivedUnmatchedDoneCount, 1);
  assert.equal(result.clearedScheduledDays, 1);
  assert.ok(result.rebuildHistoryId);
  assert.deepEqual(result.progress, { [archivedOnly.key]: true });

  const [history] = await sql<
    Array<{
      plan: unknown;
      progress: Record<string, boolean>;
      remapped_progress: Record<string, boolean>;
      archived_done_count: number;
      preserved_done_count: number;
      scheduled_day_count: number;
    }>
  >`
    select
      plan,
      progress,
      remapped_progress,
      archived_done_count,
      preserved_done_count,
      jsonb_array_length(scheduled_days) as scheduled_day_count
    from public.child_plan_rebuild_history
    where id = ${result.rebuildHistoryId}
  `;
  assert.deepEqual(history.plan, stored.plan);
  assert.deepEqual(history.progress, {
    [kept.key]: true,
    [archivedOnly.key]: true,
  });
  assert.deepEqual(history.remapped_progress, { [archivedOnly.key]: true });
  assert.equal(history.archived_done_count, 2);
  assert.equal(history.preserved_done_count, 1);
  assert.equal(history.scheduled_day_count, 1);

  const receipt = await getPlanRebuildReceipt(
    stored.report_token,
    EVAL_FIXTURE_PLAN_SUBJECT,
    result.rebuildHistoryId,
    sql as Parameters<typeof getPlanRebuildReceipt>[3],
  );
  assert.deepEqual(receipt, {
    preservedDoneCount: 1,
    archivedUnmatchedDoneCount: 1,
    clearedScheduledDays: 1,
  });
  assert.equal(
    await getPlanRebuildReceipt(
      stored.report_token,
      EVAL_FIXTURE_PLAN_SUBJECT,
      randomUUID(),
      sql as Parameters<typeof getPlanRebuildReceipt>[3],
    ),
    null,
  );

  assert.equal(
    (await readAsAuthenticated(EVAL_FIXTURE_PARENT_USER_ID, result.rebuildHistoryId))
      .length,
    1,
  );
  assert.equal(
    (await readAsAuthenticated(randomUUID(), result.rebuildHistoryId)).length,
    0,
  );
  await expectAuthenticatedWriteDenied(result.rebuildHistoryId, "insert");
  await expectAuthenticatedWriteDenied(result.rebuildHistoryId, "update");
  await expectAuthenticatedWriteDenied(result.rebuildHistoryId, "delete");

  const [serverVersion] = await sql<Array<{ version_num: string }>>`
    select current_setting('server_version_num') as version_num
  `;
  if (Number(serverVersion.version_num) >= 170000) {
    const [maintainAcl] = await sql<
      Array<{
        authenticated_can_maintain: boolean;
        anon_can_maintain: boolean;
        service_can_maintain: boolean;
      }>
    >`
      select
        has_table_privilege(
          'authenticated',
          'public.child_plan_rebuild_history',
          'MAINTAIN'
        ) as authenticated_can_maintain,
        has_table_privilege(
          'anon',
          'public.child_plan_rebuild_history',
          'MAINTAIN'
        ) as anon_can_maintain,
        has_table_privilege(
          'service_role',
          'public.child_plan_rebuild_history',
          'MAINTAIN'
        ) as service_can_maintain
    `;
    assert.equal(maintainAcl.authenticated_can_maintain, false);
    assert.equal(maintainAcl.anon_can_maintain, false);
    assert.equal(maintainAcl.service_can_maintain, true);
  }

  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`set local role anon`;
      await transaction`
        select id
        from public.child_plan_rebuild_history
        where id = ${result.rebuildHistoryId}
      `;
    }),
    /permission denied for table child_plan_rebuild_history/u,
  );

  await assert.rejects(
    sql`
      insert into public.child_plan_rebuild_history (
        child_id, subject_id, plan_id, plan_revision, progress_revision,
        plan, progress, remapped_progress, source_links, scheduled_days,
        archived_done_count, preserved_done_count, reason
      )
      select
        child_id, subject_id, plan_id, plan_revision, progress_revision,
        plan, progress, remapped_progress, source_links, scheduled_days,
        0, 1, reason
      from public.child_plan_rebuild_history
      where id = ${result.rebuildHistoryId}
    `,
    /violates check constraint/u,
  );

  console.log("PASS  plan rebuild archives the complete old meaning before replacement");
  console.log("PASS  exact unique completion survives and unmatched completion stays archived");
  console.log("PASS  rebuild receipts are scoped to the report, subject, archive, and current plan");
  console.log("PASS  rebuild history is family-readable and server-write-only");
} finally {
  const { mapDb } = await import("../apps/web/lib/map/db");
  await mapDb().end({ timeout: 5 });
  await sql.end({ timeout: 5 });
}
