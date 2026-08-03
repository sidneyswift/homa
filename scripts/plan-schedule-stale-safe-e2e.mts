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

type ScheduleReceipt = {
  status: "applied" | "conflict";
  reason: string | null;
  family_id: string | null;
  plan_id: string | null;
  plan_revision: string | number | null;
  scheduled_date: string | Date | null;
  activity_text: string | null;
  schedule_id: string | null;
};

type PlanState = {
  plan: { weeks: Array<{ week: number; activities: string[] }> };
  plan_revision: string | number;
};

const sql = postgres(databaseUrl, { prepare: false, max: 4 });

function dateOnly(value: string | Date | null): string | null {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

async function readPlan(): Promise<PlanState> {
  const [row] = await sql<PlanState[]>`
    select plan, plan_revision
    from public.child_plans
    where child_id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
      and subject_id = ${EVAL_FIXTURE_PLAN_SUBJECT}
  `;
  assert.ok(row, "the eval fixture includes a plan");
  return row;
}

async function schedule(input: {
  childId?: string;
  subjectId?: string;
  week: number;
  activityIndex: number;
  scheduledDate: string;
  expectedText: string;
  planRevision: number;
  userId?: string;
}): Promise<ScheduleReceipt> {
  const rows = await sql.begin(async (transaction) => {
    await transaction`
      select set_config(
        'request.jwt.claim.sub',
        ${input.userId ?? EVAL_FIXTURE_PARENT_USER_ID},
        true
      )
    `;
    await transaction`set local role authenticated`;
    return transaction<ScheduleReceipt[]>`
      select *
      from public.schedule_plan_activity_v2(
        ${input.childId ?? EVAL_FIXTURE_PLAN_CHILD_ID},
        ${input.subjectId ?? EVAL_FIXTURE_PLAN_SUBJECT},
        ${input.week},
        ${input.activityIndex},
        ${input.scheduledDate},
        ${input.expectedText},
        ${input.planRevision},
        null::uuid
      )
    `;
  });
  assert.equal(rows.length, 1, "the schedule operation returns one receipt");
  return rows[0];
}

try {
  const initial = await readPlan();
  const revision = Number(initial.plan_revision);
  const activity = initial.plan.weeks[1]?.activities[0];
  assert.ok(activity, "the fixture has a week-two activity");

  await sql`
    delete from public.plan_activity_schedule
    where child_id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
      and subject_id = ${EVAL_FIXTURE_PLAN_SUBJECT}
  `;

  const applied = await schedule({
    week: 2,
    activityIndex: 0,
    scheduledDate: "2026-08-06",
    expectedText: activity,
    planRevision: revision,
  });
  assert.equal(applied.status, "applied");
  assert.equal(applied.reason, null);
  assert.equal(dateOnly(applied.scheduled_date), "2026-08-06");
  assert.equal(applied.activity_text, activity);
  assert.ok(applied.schedule_id);
  console.log("PASS  current plan snapshot schedules with an exact receipt");

  const textConflict = await schedule({
    week: 2,
    activityIndex: 0,
    scheduledDate: "2026-08-07",
    expectedText: "A different activity at the same position.",
    planRevision: revision,
  });
  assert.equal(textConflict.status, "conflict");
  assert.equal(textConflict.reason, "activity-mismatch");
  console.log("PASS  exact activity text rejects a positional guess");

  await sql`
    update public.child_plans
    set plan = jsonb_set(
      plan,
      '{styleNote}',
      to_jsonb('Schedule revision test metadata'::text),
      true
    )
    where child_id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
      and subject_id = ${EVAL_FIXTURE_PLAN_SUBJECT}
  `;
  const rebuilt = await readPlan();
  const rebuiltRevision = Number(rebuilt.plan_revision);
  assert.equal(rebuiltRevision, revision + 1);
  const revisionConflict = await schedule({
    week: 2,
    activityIndex: 0,
    scheduledDate: "2026-08-07",
    expectedText: activity,
    planRevision: revision,
  });
  assert.equal(revisionConflict.status, "conflict");
  assert.equal(revisionConflict.reason, "revision-mismatch");
  console.log("PASS  a plan rebuild rejects an old revision before writing");

  const rescheduled = await schedule({
    week: 2,
    activityIndex: 0,
    scheduledDate: "2026-08-08",
    expectedText: activity,
    planRevision: rebuiltRevision,
  });
  assert.equal(rescheduled.status, "applied");
  const [scheduleRow] = await sql<{ scheduled_date: string; row_count: string }[]>`
    select to_char(scheduled_date, 'YYYY-MM-DD') as scheduled_date,
           count(*) over ()::text as row_count
    from public.plan_activity_schedule
    where child_id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
      and subject_id = ${EVAL_FIXTURE_PLAN_SUBJECT}
      and week = 2
      and activity_index = 0
  `;
  assert.equal(scheduleRow.scheduled_date, "2026-08-08");
  assert.equal(scheduleRow.row_count, "1");
  console.log("PASS  the current revision moves one natural-key row");

  const foreignUserId = randomUUID();
  const foreignFamilyId = randomUUID();
  const foreignChildId = randomUUID();
  await sql`
    insert into auth.users (id, email)
    values (${foreignUserId}, ${`foreign-${foreignUserId}@homatest.invalid`})
  `;
  await sql`
    insert into public.families (id, name, us_state)
    values (${foreignFamilyId}, 'Foreign family', 'VA')
  `;
  await sql`
    insert into public.family_members (family_id, user_id, role)
    values (${foreignFamilyId}, ${foreignUserId}, 'parent')
  `;
  await sql`
    insert into public.children (id, family_id, name, birth_month)
    values (${foreignChildId}, ${foreignFamilyId}, 'Robin', '2020-01-01')
  `;
  await sql`
    insert into public.child_plans (
      child_id, subject_id, plan, bank_version, progress, retest_at
    ) values (
      ${foreignChildId}, 'foreign-schedule', ${sql.json(initial.plan)},
      'eval-fixture', '{}'::jsonb, now() + interval '18 days'
    )
  `;
  await assert.rejects(
    schedule({
      childId: foreignChildId,
      subjectId: "foreign-schedule",
      week: 2,
      activityIndex: 0,
      scheduledDate: "2026-08-09",
      expectedText: activity,
      planRevision: 1,
    }),
    /child does not belong to the caller's family/u,
  );
  console.log("PASS  a caller cannot schedule another family's child");

  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`set local role anon`;
      await transaction`
        select *
        from public.schedule_plan_activity_v2(
          ${EVAL_FIXTURE_PLAN_CHILD_ID}::uuid,
          ${EVAL_FIXTURE_PLAN_SUBJECT}::text,
          2::smallint,
          0::smallint,
          '2026-08-10'::date,
          ${activity}::text,
          ${rebuiltRevision}::bigint,
          null::uuid
        )
      `;
    }),
    /permission denied for function|requires an authenticated caller/u,
  );
  console.log("PASS  anonymous callers cannot invoke the schedule operation");
} finally {
  await sql.end({ timeout: 2 });
}
