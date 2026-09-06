import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { screenDeliveryHook } from "../apps/web/agent/hooks/continuity-web-delivery";
import { ToolDeadlineError, withToolDeadline } from "../apps/web/lib/agent-tool-deadline";
import { assessmentStatusFromReceipt } from "../apps/web/lib/child-progress/assessment-status";
import { parseProgressCheckInStartOutcome } from "../apps/web/lib/child-progress/check-in-schema";
import { ProgressCheckInService } from "../apps/web/lib/child-progress/check-in-service";
import { PostgresChildProgressRepository } from "../apps/web/lib/child-progress/postgres-repository";
import { ChildProgressService } from "../apps/web/lib/child-progress/progress-service";
import { buildChildProgressView } from "../apps/web/lib/child-progress/projection";
import { progressQuestionResult } from "../apps/web/lib/child-progress/tool-result-payloads";
import type { ProgressCheckInContext, ProgressCheckInResult } from "../apps/web/lib/child-progress/types";
import { persistCanonicalMessage } from "../apps/web/lib/conversation-continuity/ledger";
import { EVAL_FIXTURE_FAMILY_ID, EVAL_FIXTURE_PARENT_USER_ID } from "../apps/web/lib/family-context-eval-fixture";
import { mapDb } from "../apps/web/lib/map/db";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname) || process.env.VERCEL || process.env.HOMA_EVAL_ALLOW_PROD_WRITES === "1") {
  throw new Error("Run this test only through the disposable eval sandbox.");
}
process.env.HOMA_LIVE_PROGRESS_ENABLED = "true";
const sql = mapDb();
const repository = new PostgresChildProgressRepository(() => sql);
const service = new ProgressCheckInService(repository, new ChildProgressService(repository, {buildView: buildChildProgressView}));
const completed = screenDeliveryHook.events["message.completed"] as (event: unknown, context: unknown) => Promise<void>;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {resolve = done;});
  return {promise, resolve};
}
type Started = Extract<ProgressCheckInResult, {status: "started"}>;
try {
  const familyId = EVAL_FIXTURE_FAMILY_ID;
  const memberUserId = EVAL_FIXTURE_PARENT_USER_ID;
  const partner = randomUUID();
  await sql`insert into auth.users (id) values (${partner})`;
  await sql`insert into public.family_members (family_id, user_id, role, display_name) values (${familyId}, ${partner}, 'partner', 'Fixture partner')`;
  for (const channel of ["web", "mobile"] as const) {
    const childId = randomUUID();
    const episodeId = randomUUID();
    const runtimeSessionId = `delivery-fixture-${randomUUID()}`;
    const originalTurnId = randomUUID();
    await sql`insert into public.children (id, family_id, name, birth_month) values (${childId}, ${familyId}, 'Delivery fixture', '2020-07-01')`;
    await sql`insert into public.conversation_episodes (id, family_id, member_user_id, scope) values (${episodeId}, ${familyId}, ${memberUserId}, 'member')`;
    const selected = {requestId: randomUUID(), childId, subjectId: "gross_motor"};
    const context: ProgressCheckInContext = {familyId, memberUserId, channel: "web", providerMessageId: null, repliedDeliveryId: null,
      episodeId, runtimeSessionId, turnId: originalTurnId, canonicalInboundText: null, inboundMessageId: null, now: new Date().toISOString(), selectedAssessment: selected};
    const startInput = {childId, purpose: "subject_deep_dive" as const, subjectIds: [selected.subjectId], idempotencyKey: selected.requestId};
    const attributes = {familyId, memberUserId, episodeId, channel};
    const session = {session: {id: runtimeSessionId, auth: {current: {attributes}}}};
    const emit = (message: string, turnId: string, sequence: number, incoming = session) =>
      completed({data: {finishReason: "stop", message, turnId, sequence}}, incoming);
    const canonical = (message: string, turnId: string, sequence: number, terminal: boolean) => persistCanonicalMessage({
      attributes, sessionId: runtimeSessionId, channel: "web", role: "assistant", content: message, turnId, sequence, terminal,
    });
    const current = () => repository.loadNonterminalCheckInByChild(familyId, childId);
    const counts = async () => (await sql`select
      (select count(*)::integer from public.progress_check_in_responses where family_id = ${familyId} and child_id = ${childId}) responses,
      (select count(*)::integer from public.child_progress_evidence where family_id = ${familyId} and child_id = ${childId}) evidence`)[0];
    const readSnapshot = (userId = memberUserId) => sql.begin(async tx => {
      await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      await tx`set local role authenticated`;
      return tx`select * from public.progress_check_in_start_request_status where request_id = ${selected.requestId}`;
    });
    const status = async () => {
      const [row] = await readSnapshot();
      assert.ok(row);
      return assessmentStatusFromReceipt({result: parseProgressCheckInStartOutcome(row.result), current: row.current, memberUserId,
        issuedCheckInId: row.issued_check_in_id, issuedRevision: row.issued_revision, deliveredAt: row.delivered_at});
    };

    // Use the production deadline wrapper: work commits, but no successful
    // question result reaches the parent-facing turn before it times out.
    const committed = deferred<Started>();
    const releaseResult = deferred<void>();
    const workFinished = deferred<void>();
    let emittedQuestionResults = 0;
    const timedOut = assert.rejects(withToolDeadline(25, async () => {
      try {
        const started = await service.startCheckIn(context, startInput);
        if (started.status !== "started") throw new Error("Missing initial fixture question");
        committed.resolve(started);
        await releaseResult.promise;
        return progressQuestionResult(started.prompt);
      } finally {workFinished.resolve();}
    }).then(() => {emittedQuestionResults += 1;}), ToolDeadlineError);
    const started = await committed.promise;
    await timedOut;
    releaseResult.resolve();
    await workFinished.promise;
    assert.equal(emittedQuestionResults, 0);
    const statement = started.prompt.personalizedStatement;
    const apology = "I could not confirm that step. Please try again.";
    const draft = await canonical(statement, originalTurnId, 1, false);
    await emit(apology, originalTurnId, 1);
    const apologyCanonical = await canonical(statement, originalTurnId, 1, false);
    assert.equal(apologyCanonical?.id, draft?.id, "terminal update and nonterminal replay share one canonical row");
    assert.equal(apologyCanonical?.content, apology, "late draft cannot replace the canonical apology");
    await emit(apology, originalTurnId, 1);
    assert.equal((await sql`select count(*)::integer count from public.conversation_deliveries where family_id = ${familyId} and message_id = ${draft!.id}`)[0].count, 1);
    assert.equal((await current())?.currentDeliveryId, null, "an apology with no emitted question result cannot bind");
    assert.deepEqual(await status(), {status: "accepted", checkInId: started.checkIn.id, revision: 1});
    assert.equal((await readSnapshot(partner)).length, 0, "view preserves adult-owned receipt RLS");
    assert.equal((await readSnapshot(randomUUID())).length, 0, "view does not expose a foreign family's action");
    const [apologyDelivery] = await sql`select id from public.conversation_deliveries where family_id = ${familyId} and message_id = ${draft!.id}`;
    const premature = await persistCanonicalMessage({attributes, sessionId: runtimeSessionId, channel: "web", sequence: 2,
      role: "user", content: "She does that independently.", turnId: randomUUID()});
    assert.ok(premature);
    assert.deepEqual(await service.respondCheckIn({...context, selectedAssessment: null, repliedDeliveryId: apologyDelivery.id,
      inboundMessageId: premature.id, canonicalInboundText: premature.content},
      {checkInId: started.checkIn.id, answer: "easily", idempotencyKey: premature.id}), {status: "wrong_delivery"});
    assert.deepEqual(await counts(), {responses: 0, evidence: 0});
    assert.equal((await service.startCheckIn({...context, turnId: randomUUID()}, startInput)).status, "duplicate_start");

    // A reader that straddles the retry observes either whole snapshot,
    // never old receipt revision plus new sitting revision.
    const recoveredTurnId = randomUUID();
    await sql.begin(async tx => {
      await tx`set transaction isolation level repeatable read`;
      await tx`select set_config('request.jwt.claim.sub', ${memberUserId}, true)`;
      await tx`set local role authenticated`;
      const [before] = await tx`select * from public.progress_check_in_start_request_status where request_id = ${selected.requestId}`;
      const recovered = await service.startCheckIn({...context, turnId: recoveredTurnId,
        selectedAssessment: {...selected, retryRevision: started.checkIn.revision}}, startInput);
      assert.equal(recovered.status, "existing");
      const [during] = await tx`select * from public.progress_check_in_start_request_status where request_id = ${selected.requestId}`;
      assert.equal(before.issued_revision, 1);
      assert.equal(during.issued_revision, during.current.revision);
      assert.equal(during.issued_revision, 1);
    });
    assert.deepEqual(await status(), {status: "accepted", checkInId: started.checkIn.id, revision: 2});
    assert.equal((await current())?.currentItemId, started.checkIn.currentItemId);
    await emit(statement, originalTurnId, 1);
    assert.equal((await current())?.currentDeliveryId, null, "late old-turn exact text cannot bind the recovered revision");
    let sequence = 3;
    for (const message of ["Choose an answer on the card.", statement.split(" ").reverse().join(" "), statement.replace("Delivery fixture", "Another child"), "word ".repeat(1600) + statement]) {
      await emit(message, recoveredTurnId, sequence++);
      assert.equal((await current())?.currentDeliveryId, null);
      assert.equal((await status()).status, "accepted");
    }
    if (channel === "mobile") {
      const before = (await sql`select count(*)::integer count from public.conversation_messages where family_id = ${familyId} and session_id = ${runtimeSessionId}`)[0].count;
      await emit(statement, recoveredTurnId, sequence++, {session: {...session.session, auth: {current: {attributes: {...attributes, voiceBridge: "true"}}}}} as typeof session);
      assert.equal((await sql`select count(*)::integer count from public.conversation_messages where family_id = ${familyId} and session_id = ${runtimeSessionId}`)[0].count, before);
    }
    const finalSequence = sequence++;
    const questionText = `One question:\n${statement}\nWhich answer fits?`;
    const questionDraft = await canonical("Getting your question ready.", recoveredTurnId, finalSequence, false);
    await emit(questionText, recoveredTurnId, finalSequence);
    await emit(questionText, recoveredTurnId, finalSequence);
    const lateDraft = await canonical(apology, recoveredTurnId, finalSequence, false);
    assert.equal(lateDraft?.id, questionDraft?.id);
    assert.equal(lateDraft?.content, questionText);
    const bound = await current();
    assert.ok(bound?.currentDeliveryId);
    const [proof] = await sql`select message.id, message.content, delivery.recipient_member_user_id, delivery.channel, delivery.status,
      request.delivered_at, request.issued_revision from public.progress_check_in_start_requests request
      join public.progress_check_ins check_in on check_in.id = request.issued_check_in_id and check_in.family_id = request.family_id
      join public.conversation_deliveries delivery on delivery.id = check_in.current_delivery_id and delivery.family_id = check_in.family_id
      join public.conversation_messages message on message.id = delivery.message_id and message.family_id = delivery.family_id
      where request.family_id = ${familyId} and request.request_id = ${selected.requestId}`;
    assert.equal(proof.id, questionDraft!.id);
    assert.equal(proof.content, questionText);
    assert.equal(proof.recipient_member_user_id, memberUserId);
    assert.equal(proof.channel, "web");
    assert.equal(proof.status, "sent");
    assert.ok(proof.delivered_at);
    assert.equal(proof.issued_revision, 2);
    assert.equal((await status()).status, "delivered");
    assert.equal((await sql`select count(*)::integer count from public.conversation_deliveries where family_id = ${familyId} and message_id = ${proof.id}`)[0].count, 1);
    assert.equal((await sql`select count(*)::integer count from public.conversation_open_loops where family_id = ${familyId} and delivery_id = ${bound.currentDeliveryId} and state = 'open'`)[0].count, 1);
    assert.deepEqual(await counts(), {responses: 0, evidence: 0});

    // The actual persisted reply is the evidence provenance. Replay the same
    // canonical inbound and response to prove only one bound answer is saved.
    const answerTurn = randomUUID();
    const answerInput = {attributes: {...attributes, repliedDeliveryId: bound.currentDeliveryId, replyToMessageId: proof.id,
      resolvedOutcome: "answered" as const, resolutionMethod: "provider_reply" as const},
      sessionId: runtimeSessionId, channel: "web" as const, sequence: sequence++, role: "user" as const,
      content: "She does that independently.", turnId: answerTurn};
    const inbound = await persistCanonicalMessage(answerInput);
    assert.ok(inbound);
    assert.equal((await persistCanonicalMessage({...answerInput, content: "Different duplicate content"}))?.content, inbound.content);
    const answerContext = {...context, selectedAssessment: null, turnId: answerTurn, repliedDeliveryId: bound.currentDeliveryId,
      inboundMessageId: inbound.id, canonicalInboundText: inbound.content, providerMessageId: inbound.id};
    const answer = {checkInId: bound.id, expectedRevision: bound.revision, answer: "easily" as const, idempotencyKey: inbound.id};
    const result = await service.respondCheckIn(answerContext, answer);
    assert.equal(result.status, "advanced");
    assert.equal((await service.respondCheckIn(answerContext, answer)).status, "duplicate");
    assert.deepEqual(await counts(), {responses: 1, evidence: 1});
    const [evidence] = await sql`select item_id, answer, source, derivation, message_id, member_user_id, check_in_id, channel
      from public.child_progress_evidence where family_id = ${familyId} and child_id = ${childId}`;
    assert.deepEqual(evidence, {item_id: started.checkIn.currentItemId, answer: "easily", source: "check_in", derivation: "direct",
      message_id: inbound.id, member_user_id: memberUserId, check_in_id: bound.id, channel: "web"});
    assert.ok(await repository.loadLiveView(familyId, childId, new Date()));
    assert.equal((await status()).status, "delivered", "answer advancement never erases the delivered action receipt");
    assert.equal((await service.startCheckIn({...context, turnId: randomUUID(), selectedAssessment: {...selected, retryRevision: 2}}, startInput)).status, "duplicate_start");
    assert.deepEqual(await counts(), {responses: 1, evidence: 1});
    console.log(`PASS ${channel}: deadline/no-question -> canonical duplicate/upsert -> snapshot recovery -> exact delivery -> canonical bound answer/provenance/replay`);
  }
  // Other web check-in purposes share the fleet's exact-statement contract.
  // Onboarding's full-screen checklist uses its own start_child_checklist
  // delivery path; it never reaches this check-in binder.
  for (const purpose of ["whole_map_refresh", "age_refresh", "journal_followup"] as const) {
    const childId = randomUUID();
    const episodeId = randomUUID();
    const sessionId = `web-purpose-fixture-${randomUUID()}`;
    const turnId = randomUUID();
    await sql`insert into public.children (id, family_id, name, birth_month) values (${childId}, ${familyId}, 'Purpose fixture', '2020-07-01')`;
    await sql`insert into public.conversation_episodes (id, family_id, member_user_id, scope) values (${episodeId}, ${familyId}, ${memberUserId}, 'member')`;
    const attributes = {familyId, memberUserId, episodeId, channel: "web"};
    const context: ProgressCheckInContext = {familyId, memberUserId, channel: "web", providerMessageId: null, repliedDeliveryId: null,
      episodeId, runtimeSessionId: sessionId, turnId, canonicalInboundText: null, inboundMessageId: null, now: new Date().toISOString()};
    const started = await service.startCheckIn(context, {childId, purpose, idempotencyKey: randomUUID()});
    if (started.status !== "started") throw new Error(`Missing ${purpose} question`);
    await completed({data: {finishReason: "stop", message: started.prompt.personalizedStatement, turnId, sequence: 1}},
      {session: {id: sessionId, auth: {current: {attributes}}}});
    const bound = await repository.loadNonterminalCheckInByChild(familyId, childId);
    assert.ok(bound?.currentDeliveryId);
    const inbound = await persistCanonicalMessage({attributes, sessionId, channel: "web", sequence: 2, role: "user", content: "Not sure", turnId: randomUUID()});
    assert.ok(inbound);
    const accepted = await service.respondCheckIn({...context, repliedDeliveryId: bound.currentDeliveryId, inboundMessageId: inbound.id, canonicalInboundText: inbound.content},
      {checkInId: bound.id, expectedRevision: bound.revision, answer: "not_sure", idempotencyKey: inbound.id});
    assert.ok(accepted.status === "advanced" || accepted.status === "completed");
    console.log(`PASS ${purpose}: exact canonical web question binds and accepts its answer`);
  }
} finally {
  await sql.end({timeout: 5});
}
