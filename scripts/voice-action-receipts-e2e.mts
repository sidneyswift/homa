import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import postgres from "postgres";

import {
  armVoiceActionThenMutate,
  commitVoiceAction,
  recordVoiceAction,
  type RecordVoiceActionInput,
  undoVoiceAction,
} from "../apps/web/lib/voice/action-receipts";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Run through `pnpm eval:sandbox --exec ...`.");
}

const sql = postgres(databaseUrl, { prepare: false, max: 1 });
const actor = randomUUID();
const otherActor = randomUUID();
const now = new Date("2026-08-01T16:00:00.000Z");

interface EventSnapshot {
  childId: string | null;
  title: string;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
}

const eventSnapshot: EventSnapshot = {
  childId: null,
  title: "Library visit",
  startsOn: "2026-08-05",
  endsOn: "2026-08-05",
  startTime: "10:00",
  endTime: "11:00",
  note: "Bring library cards",
};

try {
  const [family] = await sql<{ id: string }[]>`
    select id from public.families order by created_at limit 1
  `;
  assert.ok(family?.id, "eval fixture family exists");
  const [familyChild] = await sql<{ id: string }[]>`
    select id from public.children where family_id = ${family.id}
    order by created_at limit 1
  `;
  assert.ok(familyChild?.id, "eval fixture child exists");

  let hoursSequence = 0;
  const insertHours = async (familyId: string) => {
    hoursSequence += 1;
    const minutes = 40 + hoursSequence;
    const id = randomUUID();
    await sql`
      insert into public.hours_log
        (id, family_id, child_id, subject, minutes, happened_on, source, note)
      values
        (${id}, ${familyId}, null, 'math', ${minutes}, '2026-08-01',
         'chat', 'receipt e2e')
    `;
    return {
      id,
      after: {
        childId: null,
        subject: "math",
        minutes,
        happenedOn: "2026-08-01",
        source: "chat",
        note: "receipt e2e",
      },
    };
  };
  const hoursExists = async (familyId: string, id: string) => {
    const [row] = await sql<{ count: number }[]>`
      select count(*)::int as count from public.hours_log
      where family_id = ${familyId} and id = ${id}
    `;
    return row.count === 1;
  };
  const committedReceipt = async (input: RecordVoiceActionInput) => {
    const pending = await recordVoiceAction(input);
    return await commitVoiceAction({
      familyId: input.familyId,
      receiptId: pending.receipt.id,
    });
  };
  const insertEvent = async (input: {
    id: string;
    familyId: string;
    snapshot: EventSnapshot;
  }) => {
    await sql`
      insert into public.family_events
        (id, family_id, child_id, title, starts_on, ends_on,
         start_time, end_time, note)
      values
        (${input.id}, ${input.familyId}, ${input.snapshot.childId},
         ${input.snapshot.title}, ${input.snapshot.startsOn},
         ${input.snapshot.endsOn}, ${input.snapshot.startTime},
         ${input.snapshot.endTime}, ${input.snapshot.note})
    `;
  };

  const hours = await insertHours(family.id);
  const receipt = await committedReceipt({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-e2e",
    turnId: "turn-1",
    objectKind: "hours_entry",
    objectId: hours.id,
    effect: "hours.logged",
    namedEffect: `logging ${hours.after.minutes} minutes of math`,
    undoCapability: "exact_delete",
    payload: { effect: "hours.logged", after: hours.after },
    now,
  });
  assert.equal(receipt.familyId, family.id);
  assert.equal(receipt.actorUserId, actor);

  const undone = await undoVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-e2e",
    undoTurnId: "turn-2",
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(undone.status, "undone");
  assert.equal(await hoursExists(family.id, hours.id), false);

  const retry = await undoVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-e2e",
    undoTurnId: "turn-2-retry",
    receiptId: receipt.id,
    now: new Date(now.getTime() + 90_000),
  });
  assert.equal(retry.status, "undone");
  assert.equal(retry.status === "undone" && retry.alreadyUndone, true);

  const expiredHours = await insertHours(family.id);
  const expiredReceipt = await committedReceipt({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-expired",
    turnId: "turn-old",
    objectKind: "hours_entry",
    objectId: expiredHours.id,
    effect: "hours.logged",
    namedEffect: "logging old math time",
    undoCapability: "exact_delete",
    payload: { effect: "hours.logged", after: expiredHours.after },
    now: new Date(now.getTime() - 11 * 60_000),
  });
  const expired = await undoVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-expired",
    undoTurnId: "turn-now",
    receiptId: expiredReceipt.id,
    now,
  });
  assert.equal(expired.status, "expired");
  assert.equal(await hoursExists(family.id, expiredHours.id), true);

  const wrongActor = await undoVoiceAction({
    familyId: family.id,
    actorUserId: otherActor,
    runtimeSessionId: "voice-expired",
    undoTurnId: "turn-foreign",
    receiptId: expiredReceipt.id,
    now,
  });
  assert.equal(wrongActor.status, "not_found");
  assert.equal(await hoursExists(family.id, expiredHours.id), true);

  const interruptedHours = await insertHours(family.id);
  const interrupted = await undoVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-interrupted",
    undoTurnId: "turn-after-interruption",
    now,
  });
  assert.equal(interrupted.status, "not_found");
  assert.equal(await hoursExists(family.id, interruptedHours.id), true);

  const failedObjectId = randomUUID();
  const failed = await armVoiceActionThenMutate({
    familyId: family.id,
    record: () => recordVoiceAction({
      familyId: family.id,
      actorUserId: actor,
      runtimeSessionId: "voice-mutation-failed",
      turnId: "turn-failed",
      objectKind: "hours_entry",
      objectId: failedObjectId,
      effect: "hours.logged",
      namedEffect: "logging a failed math block",
      undoCapability: "exact_delete",
      payload: {
        effect: "hours.logged",
        after: {
          childId: null,
          subject: "math",
          minutes: 30,
          happenedOn: "2026-08-01",
          source: "chat",
          note: null,
        },
      },
      now,
    }),
    mutate: async () => ({ ok: false }),
    replay: async () => ({ ok: true }),
    succeeded: (result) => result.ok,
  });
  const [failedRow] = await sql<{ status: string }[]>`
    select status from public.voice_action_receipts where id = ${failed.actionReceipt.id}
  `;
  assert.equal(failedRow.status, "cancelled");
  const failedPlainUndo = await undoVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-mutation-failed",
    undoTurnId: "turn-after-failure",
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(failedPlainUndo.status, "not_found");

  const retryHoursId = randomUUID();
  const retryAfter = {
    childId: null,
    subject: "science",
    minutes: 35,
    happenedOn: "2026-08-01",
    source: "chat",
    note: "idempotency e2e",
  };
  const retryRecord = () => recordVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-retry",
    turnId: "turn-retry",
    objectKind: "hours_entry",
    objectId: retryHoursId,
    effect: "hours.logged",
    namedEffect: "logging science time once",
    undoCapability: "exact_delete",
    payload: { effect: "hours.logged", after: retryAfter },
    now,
  });
  let retryMutationCount = 0;
  const retryMutation = async () => {
    retryMutationCount += 1;
    await sql`
      insert into public.hours_log
        (id, family_id, child_id, subject, minutes, happened_on, source, note)
      values
        (${retryHoursId}, ${family.id}, ${retryAfter.childId},
         ${retryAfter.subject}, ${retryAfter.minutes}, ${retryAfter.happenedOn},
         ${retryAfter.source}, ${retryAfter.note})
    `;
    return { present: true };
  };
  const replayRetry = async () => ({
    present: await hoursExists(family.id, retryHoursId),
  });
  const firstAttempt = await armVoiceActionThenMutate({
    familyId: family.id,
    record: retryRecord,
    mutate: retryMutation,
    replay: replayRetry,
    succeeded: (result) => result.present,
  });
  assert.equal(firstAttempt.replayed, false);
  assert.equal(retryMutationCount, 1);
  const retryAfterSuccess = await armVoiceActionThenMutate({
    familyId: family.id,
    record: retryRecord,
    mutate: retryMutation,
    replay: replayRetry,
    succeeded: (result) => result.present,
  });
  assert.equal(retryAfterSuccess.replayed, true);
  assert.equal(retryAfterSuccess.result.present, true);
  assert.equal(retryMutationCount, 1);
  const retryUndo = await undoVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-retry",
    undoTurnId: "turn-retry-undo",
    receiptId: firstAttempt.actionReceipt.id,
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(retryUndo.status, "undone");
  const retryAfterUndo = await armVoiceActionThenMutate({
    familyId: family.id,
    record: retryRecord,
    mutate: retryMutation,
    replay: replayRetry,
    succeeded: (result) => result.present,
  });
  assert.equal(retryAfterUndo.replayed, true);
  assert.ok(retryAfterUndo.actionReceipt.undoneAt);
  assert.equal(retryAfterUndo.result.present, false);
  assert.equal(retryMutationCount, 1);

  const concurrentObjectId = randomUUID();
  const concurrentRecord = () => recordVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-concurrent",
    turnId: "turn-concurrent",
    objectKind: "hours_entry",
    objectId: concurrentObjectId,
    effect: "hours.logged",
    namedEffect: "the concurrent math entry in Hours",
    undoCapability: "exact_delete",
    payload: {
      effect: "hours.logged",
      after: {
        childId: null,
        subject: "math",
        minutes: 25,
        happenedOn: "2026-08-01",
        source: "chat",
        note: "concurrent lease e2e",
      },
    },
    now,
  });
  let concurrentMutationCount = 0;
  let signalMutationStarted = () => {};
  const mutationStarted = new Promise<void>((resolve) => {
    signalMutationStarted = resolve;
  });
  let releaseFirstMutation = () => {};
  const firstMutationMayFinish = new Promise<void>((resolve) => {
    releaseFirstMutation = resolve;
  });
  const concurrentMutation = async () => {
    concurrentMutationCount += 1;
    if (concurrentMutationCount === 1) {
      signalMutationStarted();
      await firstMutationMayFinish;
    }
    return { ok: true };
  };
  const firstConcurrentAttempt = armVoiceActionThenMutate({
    familyId: family.id,
    record: concurrentRecord,
    mutate: concurrentMutation,
    replay: async () => ({ ok: true }),
    succeeded: (result) => result.ok,
  });
  await mutationStarted;
  try {
    await assert.rejects(
      armVoiceActionThenMutate({
        familyId: family.id,
        record: concurrentRecord,
        mutate: concurrentMutation,
        replay: async () => ({ ok: true }),
        succeeded: (result) => result.ok,
      }),
      /already in progress or did not complete/u,
    );
  } finally {
    releaseFirstMutation();
  }
  const firstConcurrentResult = await firstConcurrentAttempt;
  assert.equal(firstConcurrentResult.replayed, false);
  assert.equal(concurrentMutationCount, 1);

  const laterHours = await insertHours(family.id);
  const laterHoursReceipt = await committedReceipt({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-hours-changed",
    turnId: "turn-hours",
    objectKind: "hours_entry",
    objectId: laterHours.id,
    effect: "hours.logged",
    namedEffect: "logging math before a later edit",
    undoCapability: "exact_delete",
    payload: { effect: "hours.logged", after: laterHours.after },
    now,
  });
  await sql`
    update public.hours_log set minutes = ${laterHours.after.minutes + 1}
    where id = ${laterHours.id} and family_id = ${family.id}
  `;
  const changedHoursUndo = await undoVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-hours-changed",
    undoTurnId: "turn-hours-undo",
    receiptId: laterHoursReceipt.id,
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(changedHoursUndo.status, "not_undoable");
  assert.equal(await hoursExists(family.id, laterHours.id), true);

  const addedEventId = randomUUID();
  await insertEvent({ id: addedEventId, familyId: family.id, snapshot: eventSnapshot });
  const addedEventReceipt = await committedReceipt({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-event-added-changed",
    turnId: "turn-add-event",
    objectKind: "family_event",
    objectId: addedEventId,
    effect: "family_event.added",
    namedEffect: "adding the library visit",
    undoCapability: "exact_delete",
    payload: { effect: "family_event.added", after: eventSnapshot },
    now,
  });
  await sql`
    update public.family_events set title = 'Library visit moved'
    where id = ${addedEventId} and family_id = ${family.id}
  `;
  const changedAddedEventUndo = await undoVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-event-added-changed",
    undoTurnId: "turn-add-event-undo",
    receiptId: addedEventReceipt.id,
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(changedAddedEventUndo.status, "not_undoable");
  const [changedAddedEvent] = await sql<{ title: string }[]>`
    select title from public.family_events where id = ${addedEventId}
  `;
  assert.equal(changedAddedEvent.title, "Library visit moved");

  const updatedEventId = randomUUID();
  const beforeUpdate = { ...eventSnapshot, title: "Library morning" };
  const afterUpdate = { ...eventSnapshot, title: "Library afternoon" };
  await insertEvent({ id: updatedEventId, familyId: family.id, snapshot: afterUpdate });
  const updatedEventReceipt = await committedReceipt({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-event-updated-again",
    turnId: "turn-update-event",
    objectKind: "family_event",
    objectId: updatedEventId,
    effect: "family_event.updated",
    namedEffect: "moving the library visit",
    undoCapability: "exact_restore",
    payload: { effect: "family_event.updated", before: beforeUpdate, after: afterUpdate },
    now,
  });
  await sql`
    update public.family_events set note = 'A later note from the parent'
    where id = ${updatedEventId} and family_id = ${family.id}
  `;
  const changedUpdatedEventUndo = await undoVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-event-updated-again",
    undoTurnId: "turn-update-event-undo",
    receiptId: updatedEventReceipt.id,
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(changedUpdatedEventUndo.status, "not_undoable");
  const [changedUpdatedEvent] = await sql<{ title: string; note: string }[]>`
    select title, note from public.family_events where id = ${updatedEventId}
  `;
  assert.equal(changedUpdatedEvent.title, "Library afternoon");
  assert.equal(changedUpdatedEvent.note, "A later note from the parent");

  const removedEventId = randomUUID();
  const removedEventReceipt = await committedReceipt({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-event-remove-collision",
    turnId: "turn-remove-event",
    objectKind: "family_event",
    objectId: removedEventId,
    effect: "family_event.removed",
    namedEffect: "removing the library visit",
    undoCapability: "append_only_restore",
    payload: { effect: "family_event.removed", before: eventSnapshot },
    now,
  });
  const replacementEvent = { ...eventSnapshot, title: "Replacement event" };
  await insertEvent({ id: removedEventId, familyId: family.id, snapshot: replacementEvent });
  const removedCollisionUndo = await undoVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-event-remove-collision",
    undoTurnId: "turn-remove-event-undo",
    receiptId: removedEventReceipt.id,
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(removedCollisionUndo.status, "not_undoable");
  const [replacementRow] = await sql<{ title: string }[]>`
    select title from public.family_events where id = ${removedEventId}
  `;
  assert.equal(replacementRow.title, "Replacement event");

  const scheduledActivityId = randomUUID();
  const scheduledActivity = {
    childId: familyChild.id,
    subjectId: "math",
    week: 1,
    activityIndex: 0,
    scheduledDate: "2026-08-07",
  };
  await sql`
    insert into public.plan_activity_schedule
      (id, family_id, child_id, subject_id, week, activity_index, scheduled_date)
    values
      (${scheduledActivityId}, ${family.id}, ${scheduledActivity.childId},
       ${scheduledActivity.subjectId}, ${scheduledActivity.week},
       ${scheduledActivity.activityIndex}, ${scheduledActivity.scheduledDate})
  `;
  const scheduleReceipt = await committedReceipt({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-plan-schedule",
    turnId: "turn-plan-schedule",
    objectKind: "plan_activity",
    objectId: scheduledActivityId,
    effect: "plan_activity.scheduled",
    namedEffect: "scheduling the math activity for Friday",
    undoCapability: "exact_delete",
    payload: {
      effect: "plan_activity.scheduled",
      before: null,
      after: scheduledActivity,
    },
    now,
  });
  const scheduleUndo = await undoVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-plan-schedule",
    undoTurnId: "turn-plan-schedule-undo",
    receiptId: scheduleReceipt.id,
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(scheduleUndo.status, "undone");
  const [scheduleCount] = await sql<{ count: number }[]>`
    select count(*)::int as count from public.plan_activity_schedule
    where id = ${scheduledActivityId} and family_id = ${family.id}
  `;
  assert.equal(scheduleCount.count, 0);

  const movedActivityId = randomUUID();
  const movedActivityBefore = {
    ...scheduledActivity,
    activityIndex: 1,
    scheduledDate: "2026-08-06",
  };
  const movedActivityAfter = {
    ...movedActivityBefore,
    scheduledDate: "2026-08-08",
  };
  await sql`
    insert into public.plan_activity_schedule
      (id, family_id, child_id, subject_id, week, activity_index, scheduled_date)
    values
      (${movedActivityId}, ${family.id}, ${movedActivityAfter.childId},
       ${movedActivityAfter.subjectId}, ${movedActivityAfter.week},
       ${movedActivityAfter.activityIndex}, ${movedActivityAfter.scheduledDate})
  `;
  const movedActivityReceipt = await committedReceipt({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-plan-moved",
    turnId: "turn-plan-moved",
    objectKind: "plan_activity",
    objectId: movedActivityId,
    effect: "plan_activity.scheduled",
    namedEffect: "moving the math activity to Saturday",
    undoCapability: "exact_restore",
    payload: {
      effect: "plan_activity.scheduled",
      before: movedActivityBefore,
      after: movedActivityAfter,
    },
    now,
  });
  const movedActivityUndo = await undoVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-plan-moved",
    undoTurnId: "turn-plan-moved-undo",
    receiptId: movedActivityReceipt.id,
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(movedActivityUndo.status, "undone");
  const [restoredActivity] = await sql<{ scheduled_date: string }[]>`
    select to_char(scheduled_date, 'YYYY-MM-DD') as scheduled_date
    from public.plan_activity_schedule
    where id = ${movedActivityId} and family_id = ${family.id}
  `;
  assert.equal(restoredActivity.scheduled_date, movedActivityBefore.scheduledDate);

  const taskCreatedAt = "2026-08-01T15:00:00.000Z";
  const taskNextRunAt = "2026-08-03T13:00:00.000Z";
  const taskId = randomUUID();
  const taskSnapshot = {
    kind: "custom" as const,
    label: "Sunday prep",
    prompt: "Help me prepare the coming homeschool week.",
    localHour: 9,
    weekdays: [0],
    deliveryPref: "text" as const,
    paused: false,
    pausedAt: null,
    enabled: true,
    nextRunAt: taskNextRunAt,
    lastRunAt: null,
    createdBy: "homa" as const,
    recipientMemberUserId: null,
    sourceOfferDeliveryId: null,
    createdAt: taskCreatedAt,
  };
  await sql`
    insert into public.agent_schedules
      (id, family_id, kind, next_run_at, enabled, created_at, local_hour,
       weekdays, delivery_pref, label, prompt, created_by)
    values
      (${taskId}, ${family.id}, ${taskSnapshot.kind}, ${taskSnapshot.nextRunAt},
       ${taskSnapshot.enabled}, ${taskSnapshot.createdAt}, ${taskSnapshot.localHour},
       ${sql.array(taskSnapshot.weekdays)}::smallint[], ${taskSnapshot.deliveryPref},
       ${taskSnapshot.label}, ${taskSnapshot.prompt}, ${taskSnapshot.createdBy})
  `;
  const createdTaskReceipt = await committedReceipt({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-task-created",
    turnId: "turn-task-created",
    objectKind: "task",
    objectId: taskId,
    effect: "task.created",
    namedEffect: "creating the Sunday prep task",
    undoCapability: "exact_delete",
    payload: { effect: "task.created", after: taskSnapshot },
    now,
  });
  const createdTaskUndo = await undoVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-task-created",
    undoTurnId: "turn-task-created-undo",
    receiptId: createdTaskReceipt.id,
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(createdTaskUndo.status, "undone");
  const [createdTaskCount] = await sql<{ count: number }[]>`
    select count(*)::int as count from public.agent_schedules
    where id = ${taskId} and family_id = ${family.id}
  `;
  assert.equal(createdTaskCount.count, 0);

  const updatedTaskId = randomUUID();
  const updatedTaskBefore = {
    ...taskSnapshot,
    label: "Monday preview",
    prompt: "Show me the homeschool plan before Monday begins.",
    localHour: 8,
    weekdays: [1],
  };
  const updatedTaskAfter = {
    ...updatedTaskBefore,
    label: "Monday morning preview",
    localHour: 7,
    paused: true,
    pausedAt: "2026-08-01T15:30:00.000Z",
  };
  await sql`
    insert into public.agent_schedules
      (id, family_id, kind, next_run_at, enabled, created_at, local_hour,
       weekdays, delivery_pref, label, prompt, created_by, paused_at)
    values
      (${updatedTaskId}, ${family.id}, ${updatedTaskAfter.kind},
       ${updatedTaskAfter.nextRunAt}, ${updatedTaskAfter.enabled},
       ${updatedTaskAfter.createdAt}, ${updatedTaskAfter.localHour},
       ${sql.array(updatedTaskAfter.weekdays)}::smallint[],
       ${updatedTaskAfter.deliveryPref}, ${updatedTaskAfter.label},
       ${updatedTaskAfter.prompt}, ${updatedTaskAfter.createdBy},
       ${updatedTaskAfter.pausedAt})
  `;
  const updatedTaskReceipt = await committedReceipt({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-task-updated",
    turnId: "turn-task-updated",
    objectKind: "task",
    objectId: updatedTaskId,
    effect: "task.updated",
    namedEffect: "changing the Monday preview task",
    undoCapability: "exact_restore",
    payload: {
      effect: "task.updated",
      before: updatedTaskBefore,
      after: updatedTaskAfter,
    },
    now,
  });
  const updatedTaskUndo = await undoVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-task-updated",
    undoTurnId: "turn-task-updated-undo",
    receiptId: updatedTaskReceipt.id,
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(updatedTaskUndo.status, "undone");
  const [restoredUpdatedTask] = await sql<{
    label: string;
    local_hour: number;
    paused_at: string | null;
  }[]>`
    select label, local_hour, paused_at::text from public.agent_schedules
    where id = ${updatedTaskId} and family_id = ${family.id}
  `;
  assert.equal(restoredUpdatedTask.label, updatedTaskBefore.label);
  assert.equal(restoredUpdatedTask.local_hour, updatedTaskBefore.localHour);
  assert.equal(restoredUpdatedTask.paused_at, null);

  const deletedTaskId = randomUUID();
  const deletedTaskSnapshot = {
    ...taskSnapshot,
    label: "Friday review",
    prompt: "Help me review what worked in homeschool this week.",
    localHour: 16,
    weekdays: [5],
  };
  const deletedTaskReceipt = await committedReceipt({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-task-deleted",
    turnId: "turn-task-deleted",
    objectKind: "task",
    objectId: deletedTaskId,
    effect: "task.deleted",
    namedEffect: "deleting the Friday review task",
    undoCapability: "append_only_restore",
    payload: { effect: "task.deleted", before: deletedTaskSnapshot },
    now,
  });
  const deletedTaskUndo = await undoVoiceAction({
    familyId: family.id,
    actorUserId: actor,
    runtimeSessionId: "voice-task-deleted",
    undoTurnId: "turn-task-deleted-undo",
    receiptId: deletedTaskReceipt.id,
    now: new Date(now.getTime() + 60_000),
  });
  assert.equal(deletedTaskUndo.status, "undone");
  const [restoredTask] = await sql<{ label: string; local_hour: number }[]>`
    select label, local_hour from public.agent_schedules
    where id = ${deletedTaskId} and family_id = ${family.id}
  `;
  assert.deepEqual(restoredTask, {
    label: deletedTaskSnapshot.label,
    local_hour: deletedTaskSnapshot.localHour,
  });

  console.log(
    "PASS voice action receipts: lifecycle, undo, retry, scope, expiry, interruption, planner, task, and concurrent-state guards",
  );
} finally {
  await sql.end();
}
