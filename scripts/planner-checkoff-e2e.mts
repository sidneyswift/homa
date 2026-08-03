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

type CheckStatus = "applied" | "conflict";

interface CheckReceipt {
  status: CheckStatus;
  plan_id: string;
  plan_revision: string | number;
  progress_key: string;
  done: boolean;
}

interface PlanState {
  plan: {
    weeks: Array<{ week: number; activities: string[] }>;
  };
  progress: Record<string, boolean>;
  plan_revision: string | number;
}

const sql = postgres(databaseUrl, { prepare: false, max: 4 });

async function setCheck(input: {
  childId?: string;
  subjectId?: string;
  checkKey: string;
  done: boolean;
  expectedText: string;
  revision: number;
  userId?: string;
}): Promise<CheckReceipt> {
  const rows = await sql.begin(async (transaction) => {
    await transaction`
      select set_config(
        'request.jwt.claim.sub',
        ${input.userId ?? EVAL_FIXTURE_PARENT_USER_ID},
        true
      )
    `;
    await transaction`set local role authenticated`;
    return transaction<CheckReceipt[]>`
      select *
      from public.set_plan_activity_check(
        ${input.childId ?? EVAL_FIXTURE_PLAN_CHILD_ID},
        ${input.subjectId ?? EVAL_FIXTURE_PLAN_SUBJECT},
        ${input.checkKey},
        ${input.done},
        ${input.expectedText},
        ${input.revision}
      )
    `;
  });
  assert.equal(rows.length, 1, "the check operation returns one receipt");
  return rows[0];
}

async function readPlan(): Promise<PlanState> {
  const [row] = await sql<PlanState[]>`
    select plan, progress, plan_revision
    from public.child_plans
    where child_id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
      and subject_id = ${EVAL_FIXTURE_PLAN_SUBJECT}
  `;
  assert.ok(row, "the eval fixture includes a plan");
  return row;
}

try {
  const initial = await readPlan();
  const revision = Number(initial.plan_revision);
  const activityA = initial.plan.weeks[1]?.activities[0];
  const activityB = initial.plan.weeks[1]?.activities[1];
  assert.ok(activityA && activityB, "the fixture has two week-two activities");
  assert.equal(revision, 1);

  await sql`
    update public.child_plans
    set progress = '{}'::jsonb
    where child_id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
      and subject_id = ${EVAL_FIXTURE_PLAN_SUBJECT}
  `;

  const [receiptA, receiptB] = await Promise.all([
    setCheck({
      checkKey: "2.0",
      done: true,
      expectedText: activityA,
      revision,
    }),
    setCheck({
      checkKey: "2.1",
      done: true,
      expectedText: activityB,
      revision,
    }),
  ]);
  assert.equal(receiptA.status, "applied");
  assert.equal(receiptB.status, "applied");
  const concurrent = await readPlan();
  assert.equal(concurrent.progress["2.0"], true);
  assert.equal(concurrent.progress["2.1"], true);
  assert.equal(Number(concurrent.plan_revision), revision);

  await sql`
    insert into public.child_plans (
      child_id, subject_id, plan, bank_version, progress, retest_at,
      plan_revision
    ) values (
      ${EVAL_FIXTURE_PLAN_CHILD_ID}, 'revision-insert-test',
      ${sql.json(initial.plan)}, 'eval-fixture', '{}'::jsonb,
      now() + interval '18 days', 999
    )
  `;
  const [insertedRevision] = await sql<{ plan_revision: string | number }[]>`
    select plan_revision
    from public.child_plans
    where child_id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
      and subject_id = 'revision-insert-test'
  `;
  assert.equal(Number(insertedRevision.plan_revision), 1);

  await sql`
    update public.child_plans
    set progress = '{}'::jsonb
    where child_id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
      and subject_id = ${EVAL_FIXTURE_PLAN_SUBJECT}
  `;
  const textConflict = await setCheck({
    checkKey: "2.0",
    done: true,
    expectedText: "A different activity at the same position.",
    revision,
  });
  assert.equal(textConflict.status, "conflict");
  assert.equal((await readPlan()).progress["2.0"], undefined);

  await sql`
    update public.child_plans
    set
      plan = jsonb_set(
        plan,
        '{styleNote}',
        to_jsonb('Revision-only test metadata'::text),
        true
      ),
      progress = '{}'::jsonb
    where child_id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
      and subject_id = ${EVAL_FIXTURE_PLAN_SUBJECT}
  `;
  const metadataRebuilt = await readPlan();
  assert.equal(Number(metadataRebuilt.plan_revision), revision + 1);
  assert.equal(metadataRebuilt.plan.weeks[1]?.activities[0], activityA);
  const revisionConflict = await setCheck({
    checkKey: "2.0",
    done: true,
    expectedText: activityA,
    revision,
  });
  assert.equal(revisionConflict.status, "conflict");
  assert.equal((await readPlan()).progress["2.0"], undefined);

  const replacement = "Read one chapter, then tell the funniest part.";
  await sql`
    update public.child_plans
    set
      plan = jsonb_set(
        plan,
        '{weeks,1,activities,0}',
        to_jsonb(${replacement}::text),
        false
      ),
      progress = '{}'::jsonb
    where child_id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
      and subject_id = ${EVAL_FIXTURE_PLAN_SUBJECT}
  `;
  const rebuilt = await readPlan();
  assert.equal(Number(rebuilt.plan_revision), revision + 2);

  const staleReceipt = await setCheck({
    checkKey: "2.0",
    done: true,
    expectedText: activityA,
    revision: revision + 1,
  });
  assert.equal(staleReceipt.status, "conflict");
  assert.equal((await readPlan()).progress["2.0"], undefined);

  const currentReceipt = await setCheck({
    checkKey: "2.0",
    done: true,
    expectedText: replacement,
    revision: revision + 2,
  });
  assert.equal(currentReceipt.status, "applied");
  assert.equal(currentReceipt.done, true);
  const afterProgress = await readPlan();
  assert.equal(afterProgress.progress["2.0"], true);
  assert.equal(Number(afterProgress.plan_revision), revision + 2);

  await sql`
    update public.child_plans
    set plan_revision = 999
    where child_id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
      and subject_id = ${EVAL_FIXTURE_PLAN_SUBJECT}
  `;
  assert.equal(Number((await readPlan()).plan_revision), revision + 2);

  await sql`
    update public.child_plans
    set
      plan = jsonb_set(
        plan,
        '{weeks}',
        (plan -> 'weeks') || (plan -> 'weeks' -> 1),
        false
      ),
      progress = '{}'::jsonb
    where child_id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
      and subject_id = ${EVAL_FIXTURE_PLAN_SUBJECT}
  `;
  const duplicateWeekPlan = await readPlan();
  const duplicateWeekConflict = await setCheck({
    checkKey: "2.0",
    done: true,
    expectedText: replacement,
    revision: Number(duplicateWeekPlan.plan_revision),
  });
  assert.equal(duplicateWeekConflict.status, "conflict");
  assert.equal((await readPlan()).progress["2.0"], undefined);

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
      await transaction`
        select *
        from public.set_plan_activity_check(
          ${EVAL_FIXTURE_PLAN_CHILD_ID},
          ${EVAL_FIXTURE_PLAN_SUBJECT},
          '2.0',
          null,
          ${replacement},
          ${Number(duplicateWeekPlan.plan_revision)}
        )
      `;
    }),
    /done, expected text, and a positive plan revision are required/u,
  );

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
  await assert.rejects(
    setCheck({
      childId: foreignChildId,
      checkKey: "1.0",
      done: true,
      expectedText: "Anything",
      revision: 1,
    }),
    /child does not belong to the caller's family/u,
  );

  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`set local role authenticated`;
      await transaction`
        select *
        from public.set_plan_activity_check(
          ${EVAL_FIXTURE_PLAN_CHILD_ID},
          ${EVAL_FIXTURE_PLAN_SUBJECT},
          '2.0',
          true,
          ${replacement},
          ${Number(duplicateWeekPlan.plan_revision)}
        )
      `;
    }),
    /requires an authenticated caller/u,
  );

  const [legacy] = await sql<{ procedure: string | null }[]>`
    select to_regprocedure(
      'public.toggle_plan_activity_check(uuid,text,smallint,smallint,boolean)'
    )::text as procedure
  `;
  assert.ok(legacy.procedure, "expand phase keeps the legacy operation available");

  console.log("PASS  Planner check-offs preserve concurrent keys");
  console.log("PASS  Planner check-offs reject stale text and revisions");
  console.log("PASS  plan_revision changes only with plan meaning");
  console.log("PASS  Planner check-offs enforce family tenancy");
  console.log("PASS  expand phase preserves the legacy operation");
} finally {
  await sql.end({ timeout: 5 });
}
