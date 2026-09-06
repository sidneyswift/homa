import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import postgres from "postgres";

import { recordPlannerLearningActivity } from "../apps/web/lib/planner-learning-activities";
import { armVoiceActionThenMutate, recordVoiceAction, undoVoiceAction } from "../apps/web/lib/voice/action-receipts";

import { EVAL_FIXTURE_FAMILY_ID, EVAL_FIXTURE_PARENT_USER_ID } from "../apps/web/lib/family-context-eval-fixture";

/** Runs only in the existing disposable Planner PostgreSQL harness. */
export async function runHoursEditContract(sql: postgres.Sql) {
  const family = EVAL_FIXTURE_FAMILY_ID;
  const children = await sql<{ id: string }[]>`select id from public.children where family_id = ${family} order by id limit 2`;
  const childIds = children.map((child) => child.id);
  const otherUser = randomUUID();
  const date = "2026-09-06";
  async function asUser<T>(fn: (tx: postgres.TransactionSql) => Promise<T>, user = EVAL_FIXTURE_PARENT_USER_ID) {
    return sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub', ${user}, true)`;
      await tx`set local role authenticated`;
      return fn(tx);
    }) as Promise<T>;
  }
  async function context(id: string, user?: string) {
    const [row] = await asUser((tx) => tx`select public.get_hours_entry_edit_context(${id}) as receipt`, user);
    return row.receipt;
  }
  async function edit(id: string, revision: string, minutes: number, subject = "math", note = "Edited Hours note", label: string | null = "My category") {
    const [row] = await asUser((tx) => tx`select public.update_hours_entry(${id}, ${revision}, ${subject}, ${minutes}, ${label}, ${note}) as receipt`);
    return row.receipt;
  }
  async function remove(id: string, revision: string, user?: string) {
    const [row] = await asUser((tx) => tx`select public.delete_hours_entry(${id}, ${revision}) as receipt`, user);
    return row.receipt;
  }
  async function activity(audience: string[], minutes: number, subject = "math") {
    const id = randomUUID();
    await sql`insert into public.planner_learning_activities
      (id, family_id, title, subject, activity_date, status, duration_minutes, note, source_channel, source_quote,
       source_message_id, idempotency_key, completion_source_channel, completion_source_quote, completed_at)
      values (${id}, ${family}, 'Original activity title', ${subject}, ${date}, 'completed', ${minutes}, 'Planner annotation',
       'voice', 'Exact original parent quote', ${randomUUID()}, ${randomUUID()}, 'voice', 'Exact completion quote', now())`;
    const hours: string[] = [];
    for (const childId of audience) {
      await sql`insert into public.planner_learning_activity_children (family_id, activity_id, child_id) values (${family}, ${id}, ${childId})`;
    }
    for (const childId of audience.length ? audience : [null]) {
      const hoursId = randomUUID();
      await sql`insert into public.hours_log (id, family_id, child_id, subject, minutes, happened_on, source, note)
        values (${hoursId}, ${family}, ${childId}, ${subject}, ${minutes}, ${date}, 'call', 'Original Hours note')`;
      await sql`insert into public.planner_learning_activity_hours (family_id, activity_id, hours_entry_id) values (${family}, ${id}, ${hoursId})`;
      hours.push(hoursId);
    }
    return { id, hours };
  }
  async function snapshot(id: string) {
    const [row] = await sql`select to_jsonb(a) as activity,
      (select jsonb_agg(to_jsonb(h) order by h.id) from public.hours_log h join public.planner_learning_activity_hours l
        on l.hours_entry_id = h.id where l.activity_id = a.id) as hours
      from public.planner_learning_activities a where a.id = ${id}`;
    return row;
  }
  async function plannerEdit(id: string, revision: string, minutes: number | null, title = "Corrected title") {
    const [row] = await asUser((tx) => tx`select public.update_planner_learning_activity_record(${id}, ${revision}::text::timestamptz,
      ${title}, 'Corrected Planner note', ${minutes}) as receipt`);
    return row.receipt;
  }

  const single = await activity([childIds[0]], 10);
  // Reproduce the already-known reverse-direction inconsistency deliberately.
  await sql`update public.hours_log set minutes = 11 where id = ${single.hours[0]}`;
  const original = await snapshot(single.id);
  const initial = await context(single.hours[0]);
  assert.equal(initial.result, "ready");
  assert.equal(initial.activity.children.length, 1);
  assert.equal(initial.activity.title, "Original activity title");
  assert.equal(JSON.stringify(initial).includes("Exact original parent quote"), false, "lookup does not expose raw source quotes");
  assert.equal((await edit(single.hours[0], initial.revision, 11, "science")).result, "applied");
  const corrected = await snapshot(single.id);
  assert.equal(corrected.activity.duration_minutes, 11);
  assert.equal(corrected.activity.subject, "science");
  assert.equal(corrected.hours[0].id, single.hours[0]);
  assert.equal(corrected.hours[0].source, "call");
  assert.equal(corrected.hours[0].created_at, original.hours[0].created_at);
  for (const key of ["source_quote", "source_channel", "source_message_id", "idempotency_key", "completion_source_quote", "completed_at", "title", "note"]) {
    assert.deepEqual(corrected.activity[key], original.activity[key], key);
  }
  assert.equal((await edit(single.hours[0], initial.revision, 12)).reason, "stale");
  assert.equal((await context(single.hours[0], otherUser)).result, "not_found");
  assert.equal((await remove(single.hours[0], initial.revision, otherUser)).result, "not_found");
  assert.equal((await context(randomUUID())).result, "not_found");
  await assert.rejects(asUser((tx) => tx`select public.get_hours_entry_edit_context('malformed')`), /uuid/u);
  await assert.rejects(sql.begin(async (tx) => {
    await tx`set local role anon`;
    await tx`select public.get_hours_entry_edit_context(${single.hours[0]})`;
  }), /permission denied/u);
  await assert.rejects(asUser((tx) => tx`select public.lock_hours_entry_edit_context(${single.hours[0]})`), /permission denied/u);

  const shared = await activity(childIds, 20);
  const sharedContext = await context(shared.hours[0]);
  assert.equal(sharedContext.activity.children.length, 2);
  assert.equal((await edit(shared.hours[0], sharedContext.revision, 25, "spanish")).result, "applied");
  const sharedAfter = await snapshot(shared.id);
  assert.equal(sharedAfter.activity.duration_minutes, 25);
  assert.equal(sharedAfter.activity.subject, "spanish");
  assert.equal(sharedAfter.hours.length, 2);
  for (const hour of sharedAfter.hours) { assert.equal(hour.minutes, 25); assert.equal(hour.subject, "spanish"); }
  assert.equal(sharedAfter.hours.find((hour: { id: string }) => hour.id === shared.hours[1]).note, "Original Hours note");
  assert.equal(sharedAfter.hours.find((hour: { id: string }) => hour.id === shared.hours[1]).custom_label, null);
  const sharedFresh = await context(shared.hours[0]);
  assert.equal((await remove(shared.hours[0], sharedFresh.revision)).result, "applied");
  const sharedDeleted = await snapshot(shared.id);
  assert.equal(sharedDeleted.activity.status, "completed");
  assert.equal(sharedDeleted.activity.duration_minutes, null);
  assert.equal(sharedDeleted.activity.source_quote, "Exact original parent quote");
  assert.equal(sharedDeleted.hours, null);
  assert.equal((await remove(shared.hours[0], sharedFresh.revision)).result, "not_found");

  const whole = await activity([], 30);
  const wholeContext = await context(whole.hours[0]);
  assert.equal(wholeContext.entry.childId, null);
  assert.deepEqual(wholeContext.activity.children, []);
  assert.equal((await edit(whole.hours[0], wholeContext.revision, 31)).result, "applied");
  assert.equal((await snapshot(whole.id)).hours.length, 1);
  assert.equal((await remove(whole.hours[0], (await context(whole.hours[0])).revision)).result, "applied");
  assert.equal((await snapshot(whole.id)).activity.status, "completed");

  const standaloneId = randomUUID();
  await sql`insert into public.hours_log(id, family_id, child_id, subject, minutes, happened_on, source, note)
    values (${standaloneId}, ${family}, null, 'art', 42, ${date}, 'email', 'Original standalone note')`;
  const standalone = await context(standaloneId);
  assert.equal(standalone.activity, null);
  assert.equal(standalone.entry.source, "email");
  assert.equal((await edit(standaloneId, standalone.revision, 43, "art", "🧡".repeat(200))).result, "applied");
  const standFresh = await context(standaloneId);
  assert.equal(standFresh.entry.source, "email");
  assert.equal(standFresh.entry.childId, null);
  assert.equal(standFresh.entry.happenedOn, date);
  for (const minutes of [0, 601]) assert.equal((await edit(standaloneId, standFresh.revision, minutes)).result, "invalid");
  assert.equal((await edit(standaloneId, standFresh.revision, 43, "invented")).result, "invalid");
  assert.equal((await edit(standaloneId, standFresh.revision, 43, "art", "a".repeat(201))).result, "invalid");
  assert.equal((await edit(standaloneId, standFresh.revision, 43, "art", "fine", "a".repeat(41))).result, "invalid");
  assert.equal((await remove(standaloneId, standFresh.revision)).result, "applied");

  const malformed = await activity(childIds, 50);
  await sql`delete from public.hours_log where id = ${malformed.hours[1]}`;
  assert.equal((await context(malformed.hours[0])).reason, "link-shape");
  const malformedBefore = await snapshot(malformed.id);
  assert.equal((await edit(malformed.hours[0], "bad", 51)).reason, "link-shape");
  assert.deepEqual(await snapshot(malformed.id), malformedBefore);
  const secondOwner = await activity([childIds[0]], 60);
  await sql`insert into public.planner_learning_activity_hours(family_id, activity_id, hours_entry_id)
    values (${family}, ${secondOwner.id}, ${single.hours[0]})`;
  assert.equal((await context(single.hours[0])).reason, "link-shape");
  await sql`delete from public.planner_learning_activity_hours where activity_id = ${secondOwner.id} and hours_entry_id = ${single.hours[0]}`;

  const atomic = await activity([childIds[0]], 70, "music");
  const conflictId = randomUUID();
  await sql`insert into public.hours_log(id, family_id, child_id, subject, minutes, happened_on, source)
    values (${conflictId}, ${family}, ${childIds[0]}, 'music', 71, ${date}, 'chat')`;
  const beforeConflict = await snapshot(atomic.id);
  assert.equal((await plannerEdit(atomic.id, beforeConflict.activity.updated_at, 71)).reason, "duplicate");
  assert.deepEqual(await snapshot(atomic.id), beforeConflict, "failed time rolls back title and Planner notes");
  const atomicContext = await context(atomic.hours[0]);
  assert.equal((await edit(atomic.hours[0], atomicContext.revision, 71, "music", "Should not save", null)).reason, "duplicate");
  assert.deepEqual(await snapshot(atomic.id), beforeConflict, "failed Hours edit rolls back every requested field");
  assert.equal((await plannerEdit(atomic.id, beforeConflict.activity.updated_at, 72)).result, "applied");
  const atomAfter = await snapshot(atomic.id);
  assert.equal(atomAfter.activity.title, "Corrected title");
  assert.equal(atomAfter.activity.note, "Corrected Planner note");
  assert.equal(atomAfter.hours[0].note, "Original Hours note");
  assert.equal(atomAfter.hours[0].minutes, 72);
  assert.equal((await plannerEdit(atomic.id, beforeConflict.activity.updated_at, 73)).reason, "stale");
  assert.equal((await plannerEdit(atomic.id, atomAfter.activity.updated_at, null)).result, "applied");
  assert.equal((await snapshot(atomic.id)).activity.status, "completed");

  const siblingChange = await activity(childIds, 80, "music");
  const siblingContext = await context(siblingChange.hours[0]);
  await sql`update public.hours_log set note = 'New sibling annotation' where id = ${siblingChange.hours[1]}`;
  assert.equal((await edit(siblingChange.hours[0], siblingContext.revision, 82)).reason, "stale", "sibling metadata changes invalidate the affected context");
  const [unfinish] = await asUser((tx) => tx`select * from public.set_planner_learning_activity_status(${siblingChange.id}, 'completed', 'planned', 'web')`);
  assert.equal(unfinish.activity_status, "planned");
  const plannedBefore = await snapshot(siblingChange.id);
  assert.equal((await plannerEdit(siblingChange.id, plannedBefore.activity.updated_at, 83)).result, "applied");
  const plannedAfter = await snapshot(siblingChange.id);
  assert.equal(plannedAfter.activity.status, "completed");
  assert.equal(plannedAfter.hours.length, 2);
  assert.equal(plannedAfter.hours.every((row: { minutes: number }) => row.minutes === 83), true);

  const race = await activity([childIds[0]], 95, "PE");
  const raceContext = await context(race.hours[0]);
  const secondary = postgres(process.env.HOMA_EVAL_DATABASE_URL!, { prepare: false, max: 1 });
  try {
    const results = await Promise.all([
      edit(race.hours[0], raceContext.revision, 96, "PE"),
      secondary.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.sub', ${EVAL_FIXTURE_PARENT_USER_ID}, true)`;
        await tx`set local role authenticated`;
        const [row] = await tx`select public.delete_hours_entry(${race.hours[0]}, ${raceContext.revision}) as receipt`;
        return row.receipt;
      }),
    ]);
    assert.equal(results.filter((row) => row.result === "applied").length, 1);
    const raced = await snapshot(race.id);
    assert.equal(raced.activity.status, "completed");
    if (raced.hours === null) assert.equal(raced.activity.duration_minutes, null);
    else assert.equal(raced.hours[0].minutes, raced.activity.duration_minutes);
  } finally { await secondary.end({ timeout: 1 }); }

  const voiceId = randomUUID();
  const voiceHoursId = randomUUID();
  const voiceMessageId = randomUUID();
  const voiceKey = randomUUID();
  const voiceNow = new Date("2026-09-06T12:00:00Z");
  const voiceQuote = "We did ninety minutes of math.";
  const voiceHours = [{ id: voiceHoursId, childId: childIds[0], subject: "math" as const,
    minutes: 90, happenedOn: date, source: "call", note: voiceQuote }];
  const voice = await armVoiceActionThenMutate({
    familyId: family,
    record: () => recordVoiceAction({ familyId: family, actorUserId: EVAL_FIXTURE_PARENT_USER_ID,
      runtimeSessionId: "hours-edit-voice-contract", turnId: "capture", objectKind: "plan_activity",
      objectId: voiceId, effect: "planner_activity.recorded", namedEffect: "recorded math",
      undoCapability: "exact_delete", now: voiceNow,
      payload: { effect: "planner_activity.recorded", after: { title: "Voice math", subject: "math",
        activityDate: date, status: "completed", durationMinutes: 90, note: null, sourceChannel: "voice",
        sourceQuote: voiceQuote, sourceMessageId: voiceMessageId, idempotencyKey: voiceKey,
        childIds: [childIds[0]], hours: voiceHours } } }),
    mutate: () => recordPlannerLearningActivity({ familyId: family, activityId: voiceId, title: "Voice math",
      subject: "math", activityDate: date, status: "completed", durationMinutes: 90, childIds: [childIds[0]],
      sourceChannel: "voice", sourceQuote: voiceQuote, sourceMessageId: voiceMessageId, idempotencyKey: voiceKey,
      hoursEntryIds: [voiceHoursId] }),
    replay: async () => { throw new Error("Fresh fixture must not replay"); },
    succeeded: (result) => result.status === "recorded" && result.created,
  });
  assert.equal((await edit(voiceHoursId, (await context(voiceHoursId)).revision, 90, "math", voiceQuote, "Parent category correction")).result, "applied");
  const undo = await undoVoiceAction({ familyId: family, actorUserId: EVAL_FIXTURE_PARENT_USER_ID,
    runtimeSessionId: "hours-edit-voice-contract", undoTurnId: "undo", receiptId: voice.actionReceipt.id,
    now: new Date(voiceNow.getTime() + 60_000) });
  assert.equal(undo.status, "not_undoable");
  assert.equal((await snapshot(voiceId)).activity.duration_minutes, 90);
  assert.equal((await snapshot(voiceId)).hours[0].custom_label, "Parent category correction");

  console.log("Hours atomic edit/delete contract passed: standalone, shared, family, provenance, stale/foreign/missing IDs, malformed links and rollback.");
}
