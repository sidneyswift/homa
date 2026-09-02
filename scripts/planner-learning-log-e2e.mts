import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import postgres from "postgres";

import {
  EVAL_FIXTURE_FAMILY_ID,
  EVAL_FIXTURE_PARENT_USER_ID,
  EVAL_FIXTURE_PLAN_CHILD_ID,
  EVAL_FIXTURE_PLAN_SUBJECT,
} from "../apps/web/lib/family-context-eval-fixture";
import { mapDb } from "../apps/web/lib/map/db";
import {
  completeGeneratedPlanActivity,
  completePlannerLearningActivity,
  getGeneratedPlanActivityCompletionTarget,
  getPlannerLearningActivityPinned,
  plannerHoursNote,
  plannerHoursSourceForChannel,
  plannerLearningIdempotencyKey,
  plannerLearningMutationUuid,
  recordPlannerLearningActivity,
} from "../apps/web/lib/planner-learning-activities";
import {
  armVoiceActionThenMutate,
  recordVoiceAction,
  undoVoiceAction,
} from "../apps/web/lib/voice/action-receipts";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Run through `pnpm eval:sandbox --exec ...`.");
}

const sql = postgres(databaseUrl, { prepare: false, max: 1 });
const now = new Date("2026-08-03T14:00:00.000Z");
const sourceChannel = "voice" as const;

try {
  const children = await sql<{ id: string }[]>`
    select id from public.children
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
    order by id
    limit 2
  `;
  assert.equal(children.length, 2, "fixture has two children for a shared activity");
  const childIds = children.map((child) => child.id);

  const plannedMessageId = randomUUID();
  const plannedKey = plannerLearningIdempotencyKey({
    action: "record",
    sourceMessageId: plannedMessageId,
    identity: ["Horizons lesson 42", "math", "2026-08-03", "planned", null, childIds.join(",")],
  });
  const plannedActivityId = plannerLearningMutationUuid(plannedKey, "activity");
  const planned = await recordPlannerLearningActivity({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    title: "Horizons lesson 42",
    subject: "math",
    activityDate: "2026-08-03",
    status: "planned",
    childIds,
    sourceChannel,
    sourceQuote: "We will do Horizons lesson 42.",
    sourceMessageId: plannedMessageId,
    idempotencyKey: plannedKey,
    activityId: plannedActivityId,
    hoursEntryIds: [],
  });
  assert.equal(planned.status, "recorded");
  assert.equal(planned.status === "recorded" && planned.created, true);

  const completionMessageId = randomUUID();
  const completionQuote = "We finished Horizons lesson 42 in 25 minutes.";
  const completionKey = plannerLearningIdempotencyKey({
    action: "complete-independent",
    sourceMessageId: completionMessageId,
    identity: [plannedActivityId, 25],
  });
  const completionHoursIds = childIds.map((_, index) =>
    plannerLearningMutationUuid(completionKey, `hours:${index}`));
  const completionHours = childIds.map((childId, index) => ({
    id: completionHoursIds[index],
    childId,
    subject: "math" as const,
    minutes: 25,
    happenedOn: "2026-08-03",
    source: plannerHoursSourceForChannel(sourceChannel),
    note: plannerHoursNote(completionQuote),
  }));
  const completed = await armVoiceActionThenMutate({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    record: () => recordVoiceAction({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      actorUserId: EVAL_FIXTURE_PARENT_USER_ID,
      runtimeSessionId: "planner-log-e2e-complete",
      turnId: "turn-1",
      objectKind: "plan_activity",
      objectId: plannedActivityId,
      effect: "planner_activity.completed",
      namedEffect: "marked Horizons lesson 42 finished in Planner",
      undoCapability: "exact_restore",
      payload: {
        effect: "planner_activity.completed",
        beforeStatus: "planned",
        after: {
          title: "Horizons lesson 42",
          subject: "math",
          activityDate: "2026-08-03",
          durationMinutes: 25,
          note: null,
          sourceChannel,
          sourceQuote: "We will do Horizons lesson 42.",
          sourceMessageId: plannedMessageId,
          childIds,
          completionSourceChannel: sourceChannel,
          completionSourceQuote: completionQuote,
          completionSourceMessageId: completionMessageId,
          completionIdempotencyKey: completionKey,
          hours: completionHours,
        },
      },
      now,
    }),
    mutate: () => completePlannerLearningActivity({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      activityId: plannedActivityId,
      expectedStatus: "planned",
      durationMinutes: 25,
      sourceChannel,
      sourceQuote: completionQuote,
      sourceMessageId: completionMessageId,
      idempotencyKey: completionKey,
      hoursEntryIds: completionHoursIds,
    }),
    replay: async () => {
      throw new Error("first completion must not replay");
    },
    succeeded: (result) => result.status === "completed" && result.changed,
  });
  assert.equal(completed.result.status, "completed");
  assert.equal(completed.actionReceipt.lifecycleStatus, "committed");
  const savedCompletion = await getPlannerLearningActivityPinned({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    activityId: plannedActivityId,
  });
  assert.equal(savedCompletion?.status, "completed");
  assert.equal(savedCompletion?.hoursEntryIds.length, 2);

  const completionUndo = await undoVoiceAction({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    actorUserId: EVAL_FIXTURE_PARENT_USER_ID,
    runtimeSessionId: "planner-log-e2e-complete",
    undoTurnId: "turn-2",
    receiptId: completed.actionReceipt.id,
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(completionUndo.status, "undone");
  const restoredPlan = await getPlannerLearningActivityPinned({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    activityId: plannedActivityId,
  });
  assert.equal(restoredPlan?.status, "planned");
  assert.equal(restoredPlan?.hoursEntryIds.length, 0);
  const [{ count: completionHoursCount }] = await sql<{ count: number }[]>`
    select count(*)::integer as count from public.hours_log
    where id = any(${sql.array(completionHoursIds)}::uuid[])
  `;
  assert.equal(completionHoursCount, 0);

  const correctionMessageId = randomUUID();
  const correctionQuote = "Piano practice took 20 minutes.";
  const correctionKey = plannerLearningIdempotencyKey({
    action: "record",
    sourceMessageId: correctionMessageId,
    identity: ["Piano practice", "music", "2026-08-03", "completed", 20, childIds[0]],
  });
  const correctionActivityId = plannerLearningMutationUuid(correctionKey, "activity");
  const correctionHoursId = plannerLearningMutationUuid(correctionKey, "hours:0");
  const correction = await recordPlannerLearningActivity({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    title: "Piano practice",
    subject: "music",
    activityDate: "2026-08-03",
    status: "completed",
    durationMinutes: 20,
    childIds: [childIds[0]],
    sourceChannel,
    sourceQuote: correctionQuote,
    sourceMessageId: correctionMessageId,
    idempotencyKey: correctionKey,
    activityId: correctionActivityId,
    hoursEntryIds: [correctionHoursId],
  });
  assert.equal(correction.status, "recorded");
  const [correctionReceipt] = await sql.begin(async (transaction) => {
    await transaction`
      select set_config(
        'request.jwt.claim.sub',
        ${EVAL_FIXTURE_PARENT_USER_ID},
        true
      )
    `;
    await transaction`set local role authenticated`;
    return transaction<{
      result: string;
      activity_status: string;
      changed: boolean;
    }[]>`
      select result, activity_status, changed
      from public.set_planner_learning_activity_status(
        ${correctionActivityId},
        'completed',
        'planned',
        'web'
      )
    `;
  });
  assert.equal(correctionReceipt.result, "applied");
  assert.equal(correctionReceipt.activity_status, "planned");
  assert.equal(correctionReceipt.changed, true);
  const [correctedState] = await sql<{
    status: string;
    duration_minutes: number | null;
    hours_count: number;
  }[]>`
    select activity.status, activity.duration_minutes,
      (select count(*)::integer from public.hours_log where id = ${correctionHoursId}) as hours_count
    from public.planner_learning_activities activity
    where activity.id = ${correctionActivityId}
  `;
  assert.equal(correctedState.status, "planned");
  assert.equal(correctedState.duration_minutes, null);
  assert.equal(correctedState.hours_count, 0);

  const recordedMessageId = randomUUID();
  const recordedQuote = "Gymnastics was PE for 40 minutes today.";
  const recordedKey = plannerLearningIdempotencyKey({
    action: "record",
    sourceMessageId: recordedMessageId,
    identity: ["Gymnastics", "PE", "2026-08-03", "completed", 40, childIds[0]],
  });
  const recordedActivityId = plannerLearningMutationUuid(recordedKey, "activity");
  const recordedHoursId = plannerLearningMutationUuid(recordedKey, "hours:0");
  const recordedHours = [{
    id: recordedHoursId,
    childId: childIds[0],
    subject: "PE" as const,
    minutes: 40,
    happenedOn: "2026-08-03",
    source: plannerHoursSourceForChannel(sourceChannel),
    note: plannerHoursNote(recordedQuote),
  }];
  const recorded = await armVoiceActionThenMutate({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    record: () => recordVoiceAction({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      actorUserId: EVAL_FIXTURE_PARENT_USER_ID,
      runtimeSessionId: "planner-log-e2e-record",
      turnId: "turn-1",
      objectKind: "plan_activity",
      objectId: recordedActivityId,
      effect: "planner_activity.recorded",
      namedEffect: "recorded Gymnastics in Planner",
      undoCapability: "exact_delete",
      payload: {
        effect: "planner_activity.recorded",
        after: {
          title: "Gymnastics",
          subject: "PE",
          activityDate: "2026-08-03",
          status: "completed",
          durationMinutes: 40,
          note: null,
          sourceChannel,
          sourceQuote: recordedQuote,
          sourceMessageId: recordedMessageId,
          idempotencyKey: recordedKey,
          childIds: [childIds[0]],
          hours: recordedHours,
        },
      },
      now,
    }),
    mutate: () => recordPlannerLearningActivity({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      title: "Gymnastics",
      subject: "PE",
      activityDate: "2026-08-03",
      status: "completed",
      durationMinutes: 40,
      childIds: [childIds[0]],
      sourceChannel,
      sourceQuote: recordedQuote,
      sourceMessageId: recordedMessageId,
      idempotencyKey: recordedKey,
      activityId: recordedActivityId,
      hoursEntryIds: [recordedHoursId],
    }),
    replay: async () => {
      throw new Error("first record must not replay");
    },
    succeeded: (result) => result.status === "recorded" && result.created,
  });
  assert.equal(recorded.result.status, "recorded");
  const recordedUndo = await undoVoiceAction({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    actorUserId: EVAL_FIXTURE_PARENT_USER_ID,
    runtimeSessionId: "planner-log-e2e-record",
    undoTurnId: "turn-2",
    receiptId: recorded.actionReceipt.id,
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(recordedUndo.status, "undone");
  assert.equal(await getPlannerLearningActivityPinned({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    activityId: recordedActivityId,
  }), null);

  const [planRow] = await sql<{ plan_revision: number }[]>`
    select plan_revision::integer as plan_revision
    from public.child_plans
    where child_id = ${EVAL_FIXTURE_PLAN_CHILD_ID}
      and subject_id = ${EVAL_FIXTURE_PLAN_SUBJECT}
  `;
  assert.ok(planRow);
  const expectedText = "Ten minutes of counting to 20 out loud, week 2 rhythm.";
  const target = await getGeneratedPlanActivityCompletionTarget({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    childId: EVAL_FIXTURE_PLAN_CHILD_ID,
    subjectId: EVAL_FIXTURE_PLAN_SUBJECT,
    week: 2,
    activityIndex: 0,
    expectedText,
    planRevision: planRow.plan_revision,
  });
  assert.equal(target.status, "ready");
  if (target.status !== "ready") throw new Error(target.note);
  const generatedMessageId = randomUUID();
  const generatedQuote = "We did the week two counting activity in 15 minutes.";
  const generatedKey = plannerLearningIdempotencyKey({
    action: "complete-generated",
    sourceMessageId: generatedMessageId,
    identity: [EVAL_FIXTURE_PLAN_CHILD_ID, EVAL_FIXTURE_PLAN_SUBJECT, 2, 0, expectedText, planRow.plan_revision, "2026-08-03", 15, "math"],
  });
  const generatedHoursId = plannerLearningMutationUuid(generatedKey, "hours:0");
  const generatedHours = [{
    id: generatedHoursId,
    childId: EVAL_FIXTURE_PLAN_CHILD_ID,
    subject: "math" as const,
    minutes: 15,
    happenedOn: "2026-08-03",
    source: plannerHoursSourceForChannel(sourceChannel),
    note: plannerHoursNote(generatedQuote),
  }];
  const generated = await armVoiceActionThenMutate({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    record: () => recordVoiceAction({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      actorUserId: EVAL_FIXTURE_PARENT_USER_ID,
      runtimeSessionId: "planner-log-e2e-generated",
      turnId: "turn-1",
      objectKind: "plan_activity",
      objectId: target.planId,
      effect: "plan_activity.completed",
      namedEffect: "marked counting activity finished in Planner",
      undoCapability: "exact_restore",
      payload: {
        effect: "plan_activity.completed",
        completion: {
          childId: EVAL_FIXTURE_PLAN_CHILD_ID,
          subjectId: EVAL_FIXTURE_PLAN_SUBJECT,
          week: 2,
          activityIndex: 0,
          expectedText,
          planRevision: planRow.plan_revision,
          progressKey: target.progressKey,
          beforeProgressRevision: target.progressRevision,
          beforeValue: target.previousValue,
          afterProgressRevision: target.progressRevision + 1,
          hours: generatedHours,
        },
      },
      now,
    }),
    mutate: () => completeGeneratedPlanActivity({
      familyId: EVAL_FIXTURE_FAMILY_ID,
      childId: EVAL_FIXTURE_PLAN_CHILD_ID,
      subjectId: EVAL_FIXTURE_PLAN_SUBJECT,
      week: 2,
      activityIndex: 0,
      expectedText,
      planRevision: planRow.plan_revision,
      happenedOn: "2026-08-03",
      durationMinutes: 15,
      hoursSubject: "math",
      sourceChannel,
      sourceQuote: generatedQuote,
      hoursEntryId: generatedHoursId,
    }),
    replay: async () => {
      throw new Error("first generated completion must not replay");
    },
    succeeded: (result) => result.status === "completed" && result.changed,
  });
  assert.equal(generated.result.status, "completed");
  const generatedUndo = await undoVoiceAction({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    actorUserId: EVAL_FIXTURE_PARENT_USER_ID,
    runtimeSessionId: "planner-log-e2e-generated",
    undoTurnId: "turn-2",
    receiptId: generated.actionReceipt.id,
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(generatedUndo.status, "undone");
  const [generatedAfterUndo] = await sql<{
    checked: boolean;
    hours_count: number;
  }[]>`
    select
      coalesce(plan.progress -> ${target.progressKey} = 'true'::jsonb, false) as checked,
      (select count(*)::integer from public.hours_log where id = ${generatedHoursId}) as hours_count
    from public.child_plans plan
    where plan.id = ${target.planId}
  `;
  assert.equal(generatedAfterUndo.checked, false);
  assert.equal(generatedAfterUndo.hours_count, 0);

  // set_planner_learning_activity_time (2026-09-02, Carolyng feedback:
  // "add the reported time manually"). Reuses the same authenticated-RPC
  // shape as set_planner_learning_activity_status above.
  async function callSetTime(activityId: string, durationMinutes: number | null) {
    const [row] = await sql.begin(async (transaction) => {
      await transaction`
        select set_config('request.jwt.claim.sub', ${EVAL_FIXTURE_PARENT_USER_ID}, true)
      `;
      await transaction`set local role authenticated`;
      return transaction<{
        result: string;
        reason: string | null;
        activity_status: string;
        duration_minutes: number | null;
        hours_entry_ids: string[];
      }[]>`
        select result, reason, activity_status, duration_minutes, hours_entry_ids
        from public.set_planner_learning_activity_time(${activityId}, ${durationMinutes})
      `;
    });
    return row;
  }

  const natureWalkMessageId = randomUUID();
  const natureWalkKey = plannerLearningIdempotencyKey({
    action: "record",
    sourceMessageId: natureWalkMessageId,
    identity: ["Nature walk", "science", "2026-08-03", "planned", null, childIds[0]],
  });
  const natureWalkActivityId = plannerLearningMutationUuid(natureWalkKey, "activity");
  const natureWalk = await recordPlannerLearningActivity({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    title: "Nature walk",
    subject: "science",
    activityDate: "2026-08-03",
    status: "planned",
    childIds: [childIds[0]],
    sourceChannel,
    sourceQuote: "We are doing a nature walk.",
    sourceMessageId: natureWalkMessageId,
    idempotencyKey: natureWalkKey,
    activityId: natureWalkActivityId,
    hoursEntryIds: [],
  });
  assert.equal(natureWalk.status, "recorded");

  // Setting a duration on a still-planned item marks it completed and
  // creates its Hours row (the web checkbox never did either).
  const firstTime = await callSetTime(natureWalkActivityId, 35);
  assert.equal(firstTime.result, "applied");
  assert.equal(firstTime.activity_status, "completed");
  assert.equal(firstTime.duration_minutes, 35);
  assert.equal(firstTime.hours_entry_ids.length, 1);
  const natureWalkHoursId = firstTime.hours_entry_ids[0];
  const [firstHoursRow] = await sql<{
    subject: string;
    minutes: number;
    happened_on: string;
    child_id: string | null;
  }[]>`
    select subject, minutes, happened_on::text as happened_on, child_id
    from public.hours_log where id = ${natureWalkHoursId}
  `;
  assert.equal(firstHoursRow.subject, "science");
  assert.equal(firstHoursRow.minutes, 35);
  assert.equal(firstHoursRow.happened_on, "2026-08-03");
  assert.equal(firstHoursRow.child_id, childIds[0]);

  // Editing an existing reported time updates that row in place; it does
  // not orphan the old one or mint a second Hours entry.
  const secondTime = await callSetTime(natureWalkActivityId, 50);
  assert.equal(secondTime.result, "applied");
  assert.equal(secondTime.duration_minutes, 50);
  assert.deepEqual(secondTime.hours_entry_ids, [natureWalkHoursId]);
  const [updatedHoursRow] = await sql<{ minutes: number }[]>`
    select minutes from public.hours_log where id = ${natureWalkHoursId}
  `;
  assert.equal(updatedHoursRow.minutes, 50);
  const [{ count: hoursRowCountAfterEdit }] = await sql<{ count: number }[]>`
    select count(*)::integer as count
    from public.planner_learning_activity_hours
    where activity_id = ${natureWalkActivityId}
  `;
  assert.equal(hoursRowCountAfterEdit, 1);

  // Clearing the reported time removes the Hours row but leaves the
  // activity finished: taking the number back out doesn't unfinish it.
  const clearedTime = await callSetTime(natureWalkActivityId, null);
  assert.equal(clearedTime.result, "applied");
  assert.equal(clearedTime.activity_status, "completed");
  assert.equal(clearedTime.duration_minutes, null);
  assert.deepEqual(clearedTime.hours_entry_ids, []);
  const [{ count: hoursRowCountAfterClear }] = await sql<{ count: number }[]>`
    select count(*)::integer as count from public.hours_log where id = ${natureWalkHoursId}
  `;
  assert.equal(hoursRowCountAfterClear, 0);

  // A genuine collision with an unrelated Hours entry (same family,
  // subject, minutes, day, child, and no custom label on either side) is
  // reported as a conflict instead of a raw constraint error, and
  // changes nothing.
  const [unrelatedBlock] = await sql<{ id: string }[]>`
    insert into public.hours_log (family_id, child_id, subject, minutes, happened_on, source, note)
    values (${EVAL_FIXTURE_FAMILY_ID}, ${childIds[0]}, 'science', 20, '2026-08-03', 'chat', 'Unrelated block')
    returning id
  `;
  const secondScienceMessageId = randomUUID();
  const secondScienceKey = plannerLearningIdempotencyKey({
    action: "record",
    sourceMessageId: secondScienceMessageId,
    identity: ["Second science block", "science", "2026-08-03", "planned", null, childIds[0]],
  });
  const secondScienceActivityId = plannerLearningMutationUuid(secondScienceKey, "activity");
  const secondScience = await recordPlannerLearningActivity({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    title: "Second science block",
    subject: "science",
    activityDate: "2026-08-03",
    status: "planned",
    childIds: [childIds[0]],
    sourceChannel,
    sourceQuote: "We are doing another science thing.",
    sourceMessageId: secondScienceMessageId,
    idempotencyKey: secondScienceKey,
    activityId: secondScienceActivityId,
    hoursEntryIds: [],
  });
  assert.equal(secondScience.status, "recorded");
  const conflictTime = await callSetTime(secondScienceActivityId, 20);
  assert.equal(conflictTime.result, "conflict");
  assert.equal(conflictTime.reason, "duplicate");
  const [secondScienceState] = await sql<{
    status: string;
    duration_minutes: number | null;
  }[]>`
    select status, duration_minutes from public.planner_learning_activities
    where id = ${secondScienceActivityId}
  `;
  assert.equal(secondScienceState.status, "planned");
  assert.equal(secondScienceState.duration_minutes, null);
  const [{ count: unrelatedStillAlone }] = await sql<{ count: number }[]>`
    select count(*)::integer as count from public.hours_log
    where family_id = ${EVAL_FIXTURE_FAMILY_ID} and subject = 'science' and minutes = 20
      and happened_on = '2026-08-03' and child_id = ${childIds[0]}
  `;
  assert.equal(unrelatedStillAlone, 1, "the conflict must not have inserted a second row");
  assert.ok(unrelatedBlock.id);

  console.log("set_planner_learning_activity_time PostgreSQL contract passed.");

  console.log("Planner learning log PostgreSQL contract passed.");
} finally {
  await sql.end({ timeout: 1 });
  await mapDb().end({ timeout: 1 });
}
