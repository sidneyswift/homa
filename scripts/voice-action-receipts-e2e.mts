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
    return await commitVoiceAction({ familyId: input.familyId, receiptId: pending.id });
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

  console.log(
    "PASS voice action receipts: lifecycle, undo, retry, scope, expiry, interruption, and concurrent-state guards",
  );
} finally {
  await sql.end();
}
