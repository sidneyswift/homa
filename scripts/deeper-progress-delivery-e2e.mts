import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { screenDeliveryHook } from "../apps/web/agent/hooks/continuity-web-delivery";
import { EVAL_FIXTURE_FAMILY_ID } from "../apps/web/lib/family-context-eval-fixture";
import { ProgressCheckInService } from "../apps/web/lib/child-progress/check-in-service";
import { PostgresChildProgressRepository } from "../apps/web/lib/child-progress/postgres-repository";
import { ChildProgressService } from "../apps/web/lib/child-progress/progress-service";
import { buildChildProgressView } from "../apps/web/lib/child-progress/projection";
import { mapDb } from "../apps/web/lib/map/db";
import type { ProgressCheckInContext } from "../apps/web/lib/child-progress/types";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname) || process.env.VERCEL || process.env.HOMA_EVAL_ALLOW_PROD_WRITES === "1") {
  throw new Error("Run this test only through the disposable eval sandbox.");
}
process.env.HOMA_LIVE_PROGRESS_ENABLED = "true";
const sql = mapDb();
const repository = new PostgresChildProgressRepository(() => sql);
const service = new ProgressCheckInService(repository, new ChildProgressService(repository, {buildView: buildChildProgressView}));
const completed = screenDeliveryHook.events["message.completed"] as (event: unknown, context: unknown) => Promise<void>;
try {
  const familyId = EVAL_FIXTURE_FAMILY_ID;
  const [{user_id: memberUserId}] = await sql<{user_id: string}[]>`select user_id from public.family_members where family_id = ${familyId} order by user_id limit 1`;
  for (const channel of ["mobile", "web"] as const) {
    const childId = randomUUID();
    const episodeId = randomUUID();
    const runtimeSessionId = `delivery-fixture-${randomUUID()}`;
    const turnId = randomUUID();
    await sql`insert into public.children (id, family_id, name, birth_month) values (${childId}, ${familyId}, 'Delivery fixture', '2020-07-01')`;
    await sql`insert into public.conversation_episodes (id, family_id, member_user_id, scope) values (${episodeId}, ${familyId}, ${memberUserId}, 'member')`;
    const selected = {requestId: randomUUID(), childId, subjectId: "gross_motor"};
    const context: ProgressCheckInContext = {familyId, memberUserId, channel: "web", providerMessageId: null, repliedDeliveryId: null,
      episodeId, runtimeSessionId, turnId, canonicalInboundText: null, inboundMessageId: null, now: new Date().toISOString(), selectedAssessment: selected};
    const started = await service.startCheckIn(context, {childId, purpose: "subject_deep_dive", subjectIds: [selected.subjectId], idempotencyKey: selected.requestId});
    if (started.status !== "started") throw new Error("Missing delivered-question fixture");
    // A committed start can outlive the turn that was supposed to deliver it.
    assert.equal((await service.startCheckIn({...context, turnId: randomUUID()}, {childId, purpose: "subject_deep_dive", subjectIds: [selected.subjectId], idempotencyKey: selected.requestId})).status, "duplicate_start");
    const recoveredTurnId = randomUUID();
    const recovered = await service.startCheckIn({...context, turnId: recoveredTurnId,
      selectedAssessment: {...selected, retryRevision: started.checkIn.revision}},
      {childId, purpose: "subject_deep_dive", subjectIds: [selected.subjectId], idempotencyKey: selected.requestId});
    if (recovered.status !== "existing" || !recovered.prompt) throw new Error("Missing recovered question");
    assert.equal(recovered.checkIn.id, started.checkIn.id);
    assert.equal(recovered.checkIn.currentItemId, started.checkIn.currentItemId);
    assert.equal(recovered.checkIn.revision, started.checkIn.revision + 1);
    const session = {session: {id: runtimeSessionId, auth: {current: {attributes: {familyId, memberUserId, episodeId, channel}}}}};
    let sequence = 1;
    const emit = (message: string, incoming = session) => completed({data: {finishReason: "stop", message, turnId: recoveredTurnId, sequence: sequence++}}, incoming);
    const statement = recovered.prompt.personalizedStatement;
    await completed({data: {finishReason: "stop", message: statement, turnId, sequence: sequence++}}, session);
    assert.equal((await repository.loadNonterminalCheckInByChild(familyId, childId))?.currentDeliveryId, null,
      "a late completed message from the crashed turn cannot bind the recovered question");
    if (channel === "mobile") {
      for (const message of ["Ready when you are.", statement.split(" ").reverse().join(" "), "word ".repeat(1600) + statement]) {
        await emit(message);
        const [persisted] = await sql`select content from public.conversation_messages where family_id = ${familyId} and session_id = ${runtimeSessionId} and sequence = ${sequence - 1}`;
        assert.equal(persisted.content, message.trim().slice(0, 8000));
        assert.equal((await repository.loadNonterminalCheckInByChild(familyId, childId))?.currentDeliveryId, null);
        const [receipt] = await sql`select delivered_at from public.progress_check_in_start_requests where family_id = ${familyId} and request_id = ${selected.requestId}`;
        assert.equal(receipt.delivered_at, null);
      }
      await emit(statement, {session: {...session.session, auth: {current: {attributes: {...session.session.auth.current.attributes, voiceBridge: "true"}}}}} as typeof session);
      assert.equal((await sql`select count(*)::integer count from public.conversation_messages where family_id = ${familyId} and session_id = ${runtimeSessionId}`)[0].count, 4, "voice bridge remains excluded");
    }
    await emit(channel === "mobile" ? `One question:\n${statement}\nWhich answer fits?` : "Choose an answer on the card.");
    const bound = await repository.loadNonterminalCheckInByChild(familyId, childId);
    assert.ok(bound?.currentDeliveryId);
    assert.equal((await service.startCheckIn({...context, turnId: randomUUID(), selectedAssessment: {...selected, retryRevision: bound.revision}},
      {childId, purpose: "subject_deep_dive", subjectIds: [selected.subjectId], idempotencyKey: selected.requestId})).status, "duplicate_start");
    assert.equal((await repository.loadNonterminalCheckInByChild(familyId, childId))?.currentDeliveryId, bound.currentDeliveryId);
    const [proof] = await sql`select message.content, delivery.recipient_member_user_id, delivery.channel, delivery.status,
      request.delivered_at from public.progress_check_in_start_requests request
      join public.progress_check_ins check_in on check_in.id = request.issued_check_in_id and check_in.family_id = request.family_id
      join public.conversation_deliveries delivery on delivery.id = check_in.current_delivery_id and delivery.family_id = check_in.family_id
      join public.conversation_messages message on message.id = delivery.message_id and message.family_id = delivery.family_id
      where request.family_id = ${familyId} and request.request_id = ${selected.requestId}`;
    assert.equal(proof.recipient_member_user_id, memberUserId);
    assert.equal(proof.channel, "web");
    assert.equal(proof.status, "sent");
    assert.ok(proof.delivered_at);
    if (channel === "mobile") assert.ok(proof.content.includes(statement));
    else assert.equal(proof.content, "Choose an answer on the card.");
    assert.equal((await sql`select count(*)::integer count from public.conversation_open_loops where family_id = ${familyId} and delivery_id = ${bound.currentDeliveryId} and state = 'open'`)[0].count, 1);
    assert.equal((await sql`select count(*)::integer count from public.progress_check_in_responses where family_id = ${familyId} and check_in_id = ${bound.id}`)[0].count, 0);
    console.log(`PASS deeper-progress actual ${channel} canonical persistence, delivery binding and selected receipt`);
  }
} finally {
  await sql.end({timeout: 5});
}
