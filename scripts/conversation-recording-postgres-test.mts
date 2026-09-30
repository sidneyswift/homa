import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import path from "node:path";

import type { HandleMessageStreamEvent } from "eve/client";
import { leaseConversationSources, applyConversationSourceBatch, releaseConversationSource } from "../apps/web/lib/conversation-source";
import conversationHook from "../apps/web/agent/hooks/persist-conversation";
import { mapDb } from "../apps/web/lib/map/db";
import { recordConversationContent, linkConversationRecording, type ConversationContentEvent } from "../apps/web/lib/conversation-recording";
import { beginDeliveryAttempt, finishDeliveryAttempt } from "../apps/web/lib/conversation-continuity/delivery-ledger";
import { persistCanonicalMessage } from "../apps/web/lib/conversation-continuity/ledger";
import { acceptConversationRequest, readConversationRequest, leaseConversationRequest,
  acceptConversationQuestionAnswer, recordConversationQuestion, finishConversationQuestionTurn, readConversationQuestions,
  listConversationDispatchOwners, observeConversationRequestOutcome, authorizeConversationRequest, claimConversationExecution, finishConversationRequest, ConversationRequestError, readConversationAccess } from "../apps/web/lib/conversation-requests";
import { loadConversationRequestContext } from "../apps/web/lib/conversation-request-context";
import { EVAL_FIXTURE_FAMILY_ID, EVAL_FIXTURE_PARENT_USER_ID } from "../apps/web/lib/family-context-eval-fixture";

// This suite can only touch the disposable eval-sandbox cluster.
assert(process.env.HOMA_EVAL_DATABASE_URL && process.env.HOMA_EVAL_BLOB_DIR);
assert(!process.env.VERCEL && process.env.HOMA_EVAL_ALLOW_PROD_WRITES !== "1");
const sql = mapDb();
await sql`update public.conversation_rebuild_settings set enabled = true`; // gh#1158: these suites exercise the rebuild itself.
try {
  const [target] = await sql`select current_setting('data_directory') as directory,
    host(inet_server_addr()) as address, current_database() as database, current_user as owner`;
  assert.equal(target.database, "homa_eval");
  assert.equal(target.owner, "homa_eval");
  const root = path.dirname(realpathSync(process.env.HOMA_EVAL_BLOB_DIR!));
  assert.match(path.basename(root), /^homa-eval-sandbox-/u);
  assert.equal(realpathSync(target.directory), path.join(root, "data"));
  assert([null, "127.0.0.1", "::1"].includes(target.address));
  const principal = { familyId: EVAL_FIXTURE_FAMILY_ID, memberUserId: EVAL_FIXTURE_PARENT_USER_ID, accessEpoch: "" };
  const beforeRecording = await persistCanonicalMessage({ attributes: principal, sessionId: "delete-before-recording",
    channel: "web", role: "user", sequence: 0, turnId: "first", content: "Erase before recording starts" });
  assert(beforeRecording);
  assert.equal((await sql`select id from public.conversation_records where family_id=${principal.familyId}
    and member_user_id=${principal.memberUserId}`).length, 1);
  assert.equal((await sql`select 1 from public.conversation_record_events where source_session_id='delete-before-recording'`).length, 0);
  await sql`delete from public.conversation_messages where id=${beforeRecording.id}`;
  await assert.rejects(recordConversationContent(principal, "delete-before-recording", {
    type: "message.received", data: { message: "Erase before recording starts", sequence: 0, turnId: "first" },
  }, 0), /deleted/);
  console.log("PASS deletion before first recording cannot resurrect content");
  const session = `recording-${randomUUID()}`;
  const event: ConversationContentEvent = { type: "message.appended", data: {
    turnId: "turn-1", sequence: 0, stepIndex: 0, messageDelta: "yes ", messageSoFar: "yes ",
  } };
  const first = await recordConversationContent(principal, session, event, 0);
  const replay = await recordConversationContent(principal, session, event, 0);
  assert.equal(first.position, replay.position);
  assert.equal(replay.replayed, true);
  await assert.rejects(recordConversationContent(principal, session, { ...event, data: {
    ...event.data, messageDelta: "no ", messageSoFar: "no ",
  } }, 0), /Conflicting/);
  const second = await recordConversationContent(principal, session, { ...event, data: {
    ...event.data, messageSoFar: "yes yes ",
  } }, 1);
  assert.equal(BigInt(second.position), BigInt(first.position) + 1n);
  console.log("PASS retries preserve identity and equal words remain separate events");

  const simultaneous = await Promise.all(Array.from({ length: 12 }, (_, i) =>
    recordConversationContent(principal, session, { type: "message.received", data: {
      turnId: `concurrent-${i}`, sequence: i + 1, message: `message ${i}`,
    } }, i + 2)));
  const positions = simultaneous.map(r => BigInt(r.position)).sort((a, b) => a < b ? -1 : 1);
  assert.equal(new Set(positions).size, 12);
  positions.forEach((value, i) => assert.equal(value, BigInt(second.position) + BigInt(i + 1)));
  console.log("PASS concurrent writes commit a complete ordered cursor");

  const outsider = randomUUID();
  await assert.rejects(recordConversationContent({ ...principal, memberUserId: outsider }, session, event, 0), /membership/);
  await sql`insert into auth.users(id,email) values (${outsider}, ${`${outsider}@example.test`})`;
  await sql`insert into public.family_members(family_id,user_id) values (${principal.familyId},${outsider})`;
  const other = await recordConversationContent({ ...principal, memberUserId: outsider }, session, event, 0);
  assert.notEqual(other.conversationId, first.conversationId);
  await sql.begin(async tx => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claim.sub',${principal.memberUserId},true)`;
    const own = await tx`select id from public.conversation_records`;
    assert.deepEqual(own.map(r => r.id), [first.conversationId]);
  });
  for (const query of ["select * from public.conversation_record_events", "insert into public.conversation_records(family_id,member_user_id) values (gen_random_uuid(),gen_random_uuid())"]) {
    await assert.rejects(sql.begin(async tx => {
      await tx`set local role authenticated`;
      await tx`select set_config('request.jwt.claim.sub',${principal.memberUserId},true)`;
      await tx.unsafe(query);
    }), /permission denied/);
  }
  console.log("PASS same-family adult isolation, revoked membership and no browser-forged recording");

  await sql`delete from public.family_members where family_id=${principal.familyId} and user_id=${outsider}`;
  await assert.rejects(recordConversationContent({ ...principal, memberUserId: outsider }, session, event, 0), /membership/);
  const retained = await sql`select id from public.conversation_records where id=${other.conversationId}`;
  assert.equal(retained.length, 1);
  await sql`insert into public.family_members(family_id,user_id) values (${principal.familyId},${outsider})`;
  assert.equal((await recordConversationContent({ ...principal, memberUserId: outsider }, session, event, 0)).replayed, true);
  await sql`delete from auth.users where id=${outsider}`;
  assert.equal((await sql`select id from public.conversation_records where id=${other.conversationId}`).length, 0);
  console.log("PASS access revocation preserves history; actual account erasure removes it");

  const long = "  " + "Exact words 🧡\n".repeat(1500) + "  ";
  // Establish the real parent-input provenance required by the existing guards.
  await persistCanonicalMessage({
    attributes: principal, sessionId: session, channel: "web", role: "user",
    sequence: 0, turnId: "turn-1", content: "Please help.",
  });
  const canonical = await persistCanonicalMessage({
    attributes: principal, sessionId: session, channel: "web", role: "assistant",
    sequence: 0, turnId: "turn-1", content: long, terminal: true,
  });
  assert(canonical);
  assert.equal(canonical.content, long);
  const [saved] = await sql`select content, created_at from public.conversation_messages where id=${canonical.id}`;
  assert.equal(saved.content, long);
  await persistCanonicalMessage({
    attributes: principal, sessionId: session, channel: "web", role: "assistant",
    sequence: 0, turnId: "turn-1", content: long + "Revised", terminal: true,
  });
  const [revised] = await sql`select created_at from public.conversation_messages where id=${canonical.id}`;
  assert.equal(String(revised.created_at), String(saved.created_at));
  await linkConversationRecording(principal, canonical.id);
  const linked = await sql`select content from public.conversation_record_events where canonical_message_id=${canonical.id} order by position`;
  assert.deepEqual(linked.map(r => r.content), ["yes ", "yes "]);
  // Simulate the failure window between a canonical commit and linkage.
  await sql`update public.conversation_record_events set canonical_message_id=null where canonical_message_id=${canonical.id}`;
  await sql`delete from public.conversation_messages where id=${canonical.id}`;
  const removed = await sql`select position from public.conversation_record_events
    where conversation_id=${first.conversationId} and source_session_id=${session}
      and turn_id='turn-1' and role='assistant'`;
  assert.equal(removed.length, 0);
  await assert.rejects(recordConversationContent(principal, session, event, 0), /deleted/);
  console.log("PASS exact long canonical text and recording deletion follows its canonical message");
  principal.accessEpoch = (await readConversationAccess(principal)).accessEpoch;
  const intentId = randomUUID();
  const sentText = "  Exact submitted request 🧡\n".repeat(700);
  const accepted = await Promise.all(Array.from({ length: 8 }, () =>
    acceptConversationRequest(principal, { intentId, text: sentText })));
  const original = accepted[0];
  assert.equal(new Set(accepted.map(r => r.requestId)).size, 1);
  assert.equal(new Set(accepted.map(r => r.messageId)).size, 1);
  assert.equal(accepted.filter(r => !r.replayed).length, 1);
  assert.equal((await readConversationRequest(principal, intentId))?.requestId, original.requestId);
  await assert.rejects(acceptConversationRequest(principal, { intentId, text: sentText + "changed" }),
    (e: unknown) => e instanceof ConversationRequestError && e.code === "conflict");
  const [storedInput] = await sql`select content, created_at from public.conversation_messages where id=${original.messageId}`;
  assert.equal(storedInput.content, sentText);
  console.log("PASS concurrent acceptance and lost-confirmation retry create one exact canonical input");

  // Fail after the canonical insert but before request receipt commit.
  await sql.unsafe(`create function public.reject_test_request() returns trigger language plpgsql as $$
    begin raise exception 'synthetic request insert failure'; end; $$;
    create trigger reject_test_request before insert on public.conversation_requests
      for each row execute function public.reject_test_request()`);
  const [beforeFailure] = await sql`select count(*)::integer as n from public.conversation_messages`;
  await assert.rejects(acceptConversationRequest(principal, { intentId: randomUUID(), text: "Must roll back" }), /synthetic/);
  const [afterFailure] = await sql`select count(*)::integer as n from public.conversation_messages`;
  assert.equal(beforeFailure.n, afterFailure.n);
  await sql.unsafe("drop trigger reject_test_request on public.conversation_requests; drop function public.reject_test_request()");
  console.log("PASS failed acceptance rolls back the canonical input too");

  assert((await listConversationDispatchOwners()).some(owner => owner.memberUserId === principal.memberUserId));
  const leases = await Promise.all([leaseConversationRequest(principal), leaseConversationRequest(principal)]);
  assert.equal(leases.filter(r => r.kind === "leased").length, 1);
  const lease1 = leases.find(r => r.kind === "leased")!;
  assert(!(await listConversationDispatchOwners()).some(owner => owner.memberUserId === principal.memberUserId));
  await sql`update public.conversation_requests set lease_until=clock_timestamp()-interval '1 second' where id=${original.requestId}`;
  const lease2 = await leaseConversationRequest(principal);
  assert(lease2.kind === "leased");
  const firstExecution = { requestId: original.requestId, leaseToken: lease1.leaseToken,
    sessionId: `request-execution-${randomUUID()}`, turnId: "turn-0", sequence: 0 };
  await assert.rejects(claimConversationExecution(principal, firstExecution, sentText), /lease/);
  const execution = { ...firstExecution, leaseToken: lease2.leaseToken };
  await authorizeConversationRequest(principal, { ...execution, phase: "prepare" });
  await assert.rejects(authorizeConversationRequest(principal, { ...execution, phase: "execute" }), /execution/);
  await assert.rejects(authorizeConversationRequest(principal, { ...firstExecution, phase: "prepare" }), /execution/);
  await assert.rejects(claimConversationExecution(principal, execution, "Changed after acceptance"), /conflict/);
  const competing = await Promise.allSettled([
    claimConversationExecution(principal, execution, sentText),
    claimConversationExecution(principal, { ...execution, sessionId: "losing-execution" }, sentText),
  ]);
  assert.equal(competing.filter(r => r.status === "fulfilled").length, 1);
  const [winner] = await sql`select execution_session_id from public.conversation_requests where id=${original.requestId}`;
  execution.sessionId = winner.execution_session_id;
  await authorizeConversationRequest(principal, { ...execution, phase: "execute" });
  await assert.rejects(authorizeConversationRequest(principal, { ...execution, sessionId: "other-runtime", phase: "execute" }), /execution/);
  await assert.rejects(authorizeConversationRequest(principal, { ...execution, turnId: "other-turn", phase: "execute" }), /execution/);
  const rebound = await claimConversationExecution(principal, execution, sentText);
  assert.equal(rebound.messageId, original.messageId);
  assert.equal(rebound.replayed, true);
  assert.notEqual((await leaseConversationRequest(principal)).kind, "leased");
  const [afterBinding] = await sql`select created_at from public.conversation_messages where id=${original.messageId}`;
  assert.equal(String(afterBinding.created_at), String(storedInput.created_at));
  // The existing canonical hook now encounters the already-bound UUID.
  const persistedAgain = await persistCanonicalMessage({ attributes: { ...principal, episodeId: rebound.episodeId },
    channel: "web", sessionId: execution.sessionId, turnId: execution.turnId, sequence: 0, role: "user", content: sentText });
  assert.equal(persistedAgain?.id, original.messageId);
  console.log("PASS expired dispatch lease is fenced; one runtime owns the original canonical UUID");

  const nextIntent = randomUUID();
  const next = await acceptConversationRequest(principal, { intentId: nextIntent, text: "The next request" });
  assert.equal(await observeConversationRequestOutcome(principal, { ...execution, sessionId: "wrong-session", outcome: "recovery_required" }), null);
  assert.equal(await observeConversationRequestOutcome(principal, { ...execution, leaseToken: randomUUID(), outcome: "recovery_required" }), null);
  assert.equal(await observeConversationRequestOutcome(principal, { ...execution, turnId: "wrong-turn", outcome: "recovery_required" }), null);
  await observeConversationRequestOutcome(principal, { ...execution, outcome: "recovery_required" });
  assert(!(await listConversationDispatchOwners()).some(owner => owner.memberUserId === principal.memberUserId));
  await assert.rejects(authorizeConversationRequest(principal, { ...execution, phase: "execute" }), /execution/);
  assert.notEqual((await leaseConversationRequest(principal)).kind, "leased");
  await assert.rejects(claimConversationExecution(principal, { ...execution, sessionId: "retry-new-runtime" }, sentText), /execution/);
  await assert.rejects(observeConversationRequestOutcome(principal, { ...execution, outcome: "completed" }), /execution/);
  await assert.rejects(observeConversationRequestOutcome(principal, { ...execution, outcome: "completed", responseMessageId: original.messageId }), /execution/);
  const response = await persistCanonicalMessage({ attributes: { ...principal, episodeId: rebound.episodeId },
    channel: "web", sessionId: execution.sessionId, turnId: execution.turnId, sequence: 0, role: "assistant", content: "Finished answer" });
  assert(response);
  await observeConversationRequestOutcome(principal, { ...execution, outcome: "completed", responseMessageId: response.id });
  await finishConversationRequest(principal, execution, "completed");
  assert.equal((await observeConversationRequestOutcome(principal, { ...execution, outcome: "recovery_required" }))?.state, "completed");
  assert((await listConversationDispatchOwners()).some(owner => owner.memberUserId === principal.memberUserId));
  await assert.rejects(finishConversationRequest(principal, execution, "recovery_required"), /conflict/);
  await assert.rejects(claimConversationExecution(principal, execution, sentText), /execution/);
  const requestContext = await loadConversationRequestContext(principal);
  assert.match(requestContext, /Finished answer/);
  assert(!requestContext.includes("The next request"));
  const nextLease = await leaseConversationRequest(principal);
  assert(nextLease.kind === "leased");
  assert.equal(nextLease.requestId, next.requestId);
  console.log("PASS uncertain execution is never requeued and terminal completion cannot regress");

  const peerId = randomUUID();
  await sql`insert into auth.users(id,email) values (${peerId}, ${`${peerId}@example.test`})`;
  await sql`insert into public.family_members(family_id,user_id) values (${principal.familyId},${peerId})`;
  const peer = { ...principal, memberUserId: peerId };
  peer.accessEpoch = (await readConversationAccess(peer)).accessEpoch;
  assert.equal(await readConversationRequest(peer, intentId), null);
  await assert.rejects(claimConversationExecution(peer, execution, sentText), /missing/);
  const peerRequest = await acceptConversationRequest(peer, { intentId, text: "Peer's separate intent" });
  assert.notEqual(peerRequest.requestId, original.requestId);
  const peerPrivate = await persistCanonicalMessage({ attributes: peer, channel: "web",
    sessionId: "peer-private-context", turnId: "turn-private", sequence: 0, role: "user", content: "Private words for other adult" });
  assert(peerPrivate);
  assert(!(await loadConversationRequestContext(principal)).includes("Private words for other adult"));
  assert((await loadConversationRequestContext(peer)).includes("Private words for other adult"));
  assert(!(await loadConversationRequestContext(peer)).includes("Finished answer"));
  const addressed = await persistCanonicalMessage({ attributes: peer, channel: "web",
    sessionId: "addressed-context", turnId: "turn-addressed", sequence: 0, role: "assistant", content: "Explicitly addressed update" });
  assert(addressed);
  const [addressedRow] = await sql`select episode_id from public.conversation_messages where id=${addressed.id}`;
  await sql`insert into public.conversation_deliveries(family_id,episode_id,message_id,recipient_member_user_id,channel,destination_hash,status)
    values (${principal.familyId},${addressedRow.episode_id},${addressed.id},${principal.memberUserId},'web',${"a".repeat(64)},'pending')`;
  assert(!(await loadConversationRequestContext(principal)).includes("Explicitly addressed update"));
  await sql`update public.conversation_deliveries set status='sent' where message_id=${addressed.id}`;
  assert(!(await loadConversationRequestContext(principal)).includes("Explicitly addressed update"), "legacy receipts cannot prove the exact delivered revision");
  const previousRecordingFlag = process.env.HOMA_CONVERSATION_RECORDING;
  process.env.HOMA_CONVERSATION_RECORDING = "1";
  const exactAddressed = await beginDeliveryAttempt({ familyId: principal.familyId, memberUserId: principal.memberUserId,
    episodeId: addressedRow.episode_id, messageId: addressed.id, taskRunId: null, channel: "web",
    destination: "synthetic-addressed-recipient", content: "Explicitly addressed update" });
  await finishDeliveryAttempt(exactAddressed, { delivered: true });
  assert((await loadConversationRequestContext(principal)).includes("Explicitly addressed update"));
  console.log("PASS worker context spans completed episodes but excludes queued input and other adults; addressed rows require sent delivery");
  const peerLease = await leaseConversationRequest(peer);
  assert(peerLease.kind === "leased");
  const peerExecution = { requestId: peerRequest.requestId, leaseToken: peerLease.leaseToken,
    sessionId: "peer-execution", turnId: "first", sequence: 0 };
  await claimConversationExecution(peer, peerExecution, peerLease.text);
  const workingUpdate = await persistCanonicalMessage({ attributes: { ...peer, episodeId: peerLease.episodeId }, channel: "web",
    sessionId: peerExecution.sessionId, turnId: peerExecution.turnId, sequence: 0, role: "assistant", content: "Already delivered while work continues" });
  assert(workingUpdate);
  assert(!(await loadConversationRequestContext(peer)).includes("Already delivered while work continues"));
  const exactWorking = await beginDeliveryAttempt({ familyId: principal.familyId, memberUserId: principal.memberUserId,
    episodeId: workingUpdate.episodeId, messageId: workingUpdate.id, taskRunId: null, channel: "web",
    destination: "synthetic-working-recipient", content: "Already delivered while work continues" });
  await finishDeliveryAttempt(exactWorking, { delivered: true });
  assert((await loadConversationRequestContext(principal)).includes("Already delivered while work continues"));
  assert(!(await loadConversationRequestContext(peer)).includes("Already delivered while work continues"));
  if (previousRecordingFlag === undefined) delete process.env.HOMA_CONVERSATION_RECORDING;
  else process.env.HOMA_CONVERSATION_RECORDING = previousRecordingFlag;
  await sql.begin(async tx => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claim.sub',${peerId},true)`;
    const seen = await tx`select id from public.conversation_messages where id in (${original.messageId},${peerRequest.messageId})`;
    assert.deepEqual(seen.map(r => r.id), [peerRequest.messageId]);
  });
  for (const query of ["select * from public.conversation_requests", "delete from public.conversation_requests"]) {
    await assert.rejects(sql.begin(async tx => {
      await tx`set local role authenticated`;
      await tx.unsafe(query);
    }), /permission denied/);
  }
  const peerPendingId = randomUUID();
  await acceptConversationRequest(peer, { intentId: peerPendingId, text: "Queued before revocation" });
  await sql`delete from public.family_members where family_id=${principal.familyId} and user_id=${peerId}`;
  await assert.rejects(authorizeConversationRequest(peer, { ...peerExecution, phase: "execute" }), /execution/);
  await assert.rejects(readConversationRequest(peer, intentId), /membership/);
  assert.equal(await loadConversationRequestContext(peer), "");
  await assert.rejects(leaseConversationRequest(peer), /membership/);
  await assert.rejects(claimConversationExecution(peer, peerExecution, peerLease.text), /membership/);
  // Revocation cannot prevent the trusted executor from recording an observed
  // outcome, but neither a wrong receipt owner nor a new execution is admitted.
  await assert.rejects(finishConversationRequest(peer, { ...peerExecution, leaseToken: randomUUID() }, "completed"), /execution/);
  await finishConversationRequest(peer, peerExecution, "completed");
  await sql`insert into public.family_members(family_id,user_id) values (${principal.familyId},${peerId})`;
  await assert.rejects(readConversationRequest(peer, intentId), /access_changed/);
  const previousEpoch = peer.accessEpoch;
  peer.accessEpoch = (await readConversationAccess(peer)).accessEpoch;
  assert.notEqual(peer.accessEpoch, previousEpoch);
  await assert.rejects(authorizeConversationRequest(peer, { ...peerExecution, phase: "execute" }), /execution/);
  assert.equal((await readConversationRequest(peer, peerPendingId))?.state, "revoked");
  assert.equal((await leaseConversationRequest(peer)).kind, "empty");
  await assert.rejects(acceptConversationRequest(peer, { intentId: peerPendingId, text: "Queued before revocation" }), /access_changed/);
  assert.equal((await readConversationRequest(peer, intentId))?.requestId, peerRequest.requestId);
  assert.equal((await readConversationRequest(peer, intentId))?.state, "completed");
  await sql`delete from auth.users where id=${peerId}`;
  assert.equal((await sql`select id from public.conversation_requests where id=${peerRequest.requestId}`).length, 0);
  console.log("PASS private receipts, current membership, browser write denial and account erasure");

  await sql`delete from public.conversation_messages where id=${next.messageId}`;
  assert.equal((await readConversationRequest(principal, nextIntent))?.state, "deleted");
  assert.notEqual((await leaseConversationRequest(principal)).kind, "leased");
  await assert.rejects(acceptConversationRequest(principal, { intentId: nextIntent, text: "The next request" }), /deleted/);
  const [tombstone] = await sql`select payload_hash,canonical_message_id from public.conversation_requests where id=${next.requestId}`;
  assert.equal(tombstone.payload_hash, null);
  assert.equal(tombstone.canonical_message_id, null);
  console.log("PASS deletion cancels dispatch and prevents retry resurrection without retaining content");
  for (let i = 0; i < 8; i++) {
    const race = await acceptConversationRequest(principal, { intentId: randomUUID(), text: "Delete during claim" });
    const lease = await leaseConversationRequest(principal);
    assert(lease.kind === "leased");
    const owner = { requestId: race.requestId, leaseToken: lease.leaseToken,
      sessionId: `delete-race-${i}`, turnId: "first", sequence: 0 };
    const results = await Promise.allSettled([
      claimConversationExecution(principal, owner, lease.text),
      (async () => {
        for (let attempt = 0; ; attempt++) {
          try { await sql`delete from public.conversation_messages where id=${race.messageId}`; break; }
          catch (e) { if ((e as {code?:string}).code !== "40P01" || attempt >= 2) throw e; }
        }
      })(),
    ]);
    assert.equal(results[1].status, "fulfilled");
    const [state] = await sql`select state from public.conversation_requests where id=${race.requestId}`;
    assert.equal(state.state, "deleted");
    await assert.rejects(claimConversationExecution(principal, owner, lease.text), /deleted/);
  }
  console.log("PASS concurrent deletion and execution claiming converge on a non-executable tombstone");
  const cardIntent = randomUUID();
  const cardRequest = await acceptConversationRequest(principal, { intentId: cardIntent, text: "Help me choose an activity" });
  const cardLease = await leaseConversationRequest(principal);
  assert(cardLease.kind === "leased");
  const cardExecution = { requestId: cardRequest.requestId, leaseToken: cardLease.leaseToken,
    sessionId: `question-${randomUUID()}`, turnId: "first", sequence: 0 };
  await claimConversationExecution(principal, cardExecution, cardLease.text);
  const cardInput = { callId: "choices", sourceSequence: 0, stepIndex: 1, card: { questions: [{
    header: "Activity", question: "Which activity would help?", multiSelect: false,
    options: [{ label: "A worksheet", description: "Print it" }, { label: "A game", description: null }],
  }] } };
  // Force the second half of the transaction to fail, proving no orphan text.
  await sql.unsafe(`create function public.reject_test_card() returns trigger language plpgsql as $$
    begin raise exception 'test card failure'; end $$;
    create trigger reject_test_card before insert on public.conversation_question_cards
    for each row execute function public.reject_test_card()`);
  await assert.rejects(recordConversationQuestion(principal, cardExecution, cardInput), /test card failure/);
  assert.equal((await sql`select id from public.conversation_messages where turn_id like 'question-card:%'`).length, 0);
  await sql.unsafe("drop trigger reject_test_card on public.conversation_question_cards; drop function public.reject_test_card()");
  const cardCopies = await Promise.all(Array.from({ length: 8 }, () => recordConversationQuestion(principal, cardExecution, cardInput)));
  const card = cardCopies[0];
  assert.equal(new Set(cardCopies.map(value => value.id)).size, 1);
  assert.equal(cardCopies.filter(value => !value.replayed).length, 1);
  await assert.rejects(recordConversationQuestion(principal, { ...cardExecution, turnId: "other" }, cardInput), /execution/);
  await assert.rejects(recordConversationQuestion(principal, { ...cardExecution, leaseToken: randomUUID() }, cardInput), /execution/);
  await assert.rejects(recordConversationQuestion(principal, cardExecution, { ...cardInput, stepIndex: 2 }), /conflict/);
  await assert.rejects(recordConversationQuestion(principal, cardExecution, { ...cardInput, sourceSequence: 1 }), /execution/);
  const otherCard = await recordConversationQuestion(principal, cardExecution, { ...cardInput, callId: "next-choices", stepIndex: 2 });
  assert.notEqual(otherCard.id, card.id);
  assert.deepEqual(await readConversationQuestions(principal), []);
  assert(!(await loadConversationRequestContext(principal)).includes("Which activity would help?"));
  assert.equal((await finishConversationQuestionTurn(principal, cardExecution))?.state, "awaiting_parent");
  assert.equal((await finishConversationQuestionTurn(principal, cardExecution))?.state, "awaiting_parent");
  assert.equal((await readConversationQuestions(principal)).length, 2);
  assert((await loadConversationRequestContext(principal)).includes("Which activity would help?"));
  assert.equal((await finishConversationRequest(principal, cardExecution, "recovery_required")).state, "awaiting_parent");
  assert.equal((await observeConversationRequestOutcome(principal, { ...cardExecution, outcome: "recovery_required" }))?.state, "awaiting_parent");
  await assert.rejects(authorizeConversationRequest(principal, { ...cardExecution, phase: "execute" }), /execution/);
  const answerIntent = randomUUID();
  const questionAnswer = { questionId: card.id, answers: [{ question: 0, kind: "choice", options: [1] }] };
  await assert.rejects(acceptConversationQuestionAnswer(principal, { intentId: randomUUID(),
    questionAnswer: { ...questionAnswer, answers: [{ question: 0, kind: "choice", options: [0,1] }] } }), /invalid/);
  const answerCopies = await Promise.all(Array.from({ length: 8 }, () =>
    acceptConversationQuestionAnswer(principal, { intentId: answerIntent, questionAnswer })));
  const answer = answerCopies[0];
  assert.equal(new Set(answerCopies.map(value => value.requestId)).size, 1);
  assert.equal(answerCopies.filter(value => !value.replayed).length, 1);
  await assert.rejects(acceptConversationQuestionAnswer(principal, { intentId: randomUUID(), questionAnswer }), /conflict/);
  await assert.rejects(acceptConversationQuestionAnswer(principal, { intentId: answerIntent,
    questionAnswer: { ...questionAnswer, answers: [{ question: 0, kind: "skip" }] } }), /conflict/);
  await assert.rejects(acceptConversationRequest(principal, { intentId: answerIntent, text: "Which activity would help?\nA game" }), /conflict/);
  assert.equal((await sql`select content from public.conversation_messages where id=${answer.messageId}`)[0].content,
    "Which activity would help?\nA game");
  assert.equal((await readConversationRequest(principal, cardIntent))?.state, "continued");
  const restoredCards = await readConversationQuestions(principal);
  assert.equal(restoredCards.find(value => value.id === card.id)?.state, "answered");
  assert.equal(restoredCards.find(value => value.id === otherCard.id)?.state, "continued");
  const answerLease = await leaseConversationRequest(principal);
  assert(answerLease.kind === "leased" && answerLease.requestId === answer.requestId);
  const answerExecution = { ...cardExecution, requestId: answer.requestId, leaseToken: answerLease.leaseToken,
    sessionId: `question-answer-${randomUUID()}` };
  await claimConversationExecution(principal, answerExecution, answerLease.text);
  await authorizeConversationRequest(principal, { ...answerExecution, phase: "execute" });
  // The linked question survives context window paging without relying on prose matching.
  await sql`update public.conversation_messages set created_at='2000-01-01' where id=${card.messageId}`;
  assert((await loadConversationRequestContext(principal, answer.requestId)).includes('"description":"Print it"'));
  assert((await loadConversationRequestContext(principal, answer.requestId)).includes('"options":[1]'));
  assert.deepEqual(restoredCards.find(value => value.id === card.id)?.answers, questionAnswer.answers);
  const [originalClaim] = await sql`select execution_session_id,execution_turn_id from public.conversation_requests where id=${cardRequest.requestId}`;
  assert.equal(originalClaim.execution_session_id, cardExecution.sessionId);
  assert.equal(originalClaim.execution_turn_id, cardExecution.turnId);
  console.log("PASS atomic question recording, replay identity, card-only completion and next-message admission");
  await sql`delete from public.conversation_messages where id=${card.messageId}`;
  await assert.rejects(recordConversationQuestion(principal, cardExecution, cardInput), /deleted/);
  await assert.rejects(authorizeConversationRequest(principal, { ...answerExecution, phase: "execute" }), /execution/);
  await assert.rejects(claimConversationExecution(principal, answerExecution, answerLease.text), /deleted/);
  const [erasedCard] = await sql`select payload,payload_hash,canonical_message_id,state from public.conversation_question_cards where id=${card.id}`;
  assert.deepEqual(erasedCard, { payload: null, payload_hash: null, canonical_message_id: null, state: "deleted" });
  await sql`delete from public.conversation_messages where id=${cardRequest.messageId}`;
  assert.deepEqual(await readConversationQuestions(principal), []);
  assert.equal((await sql`select id from public.conversation_question_cards where request_id=${cardRequest.requestId} and payload is not null`).length, 0);
  await sql`delete from public.conversation_messages where id=${answer.messageId}`;
  assert.equal((await sql`select submission_hash from public.conversation_requests where id=${answer.requestId}`)[0].submission_hash, null);
  assert.equal((await sql`select answer_payload from public.conversation_question_cards where id=${card.id}`)[0].answer_payload, null);
  for (const query of ["select * from public.conversation_question_cards", "delete from public.conversation_question_cards"]) {
    await assert.rejects(sql.begin(async tx => {
      await tx`set local role authenticated`;
      await tx`select set_config('request.jwt.claim.sub',${principal.memberUserId},true)`;
      await tx.unsafe(query);
    }), /permission denied/);
  }
  await assert.rejects(readConversationQuestions({ ...principal, accessEpoch: randomUUID() }), /access_changed/);
  console.log("PASS erased question payload stays erased and browser access cannot forge choices");
  // A parent can send while Homa is still asking. Completion must release that
  // already queued message, without pretending that it answered the question.
  const concurrentQuestion = await acceptConversationRequest(principal, { intentId: randomUUID(), text: "Another activity" });
  const concurrentLease = await leaseConversationRequest(principal);
  assert(concurrentLease.kind === "leased");
  const concurrentExecution = { ...cardExecution, requestId: concurrentQuestion.requestId,
    leaseToken: concurrentLease.leaseToken, sessionId: `question-${randomUUID()}` };
  await claimConversationExecution(principal, concurrentExecution, concurrentLease.text);
  // The standalone .mts runner imports this CommonJS-authored module through
  // Node's default wrapper; production Eve compiles the hook as ESM.
  const hooks = "events" in conversationHook ? conversationHook
    : (conversationHook as unknown as { default: typeof conversationHook }).default;
  const questionHandler = hooks.events!["action.result"]!;
  const completionHandler = hooks.events!["turn.completed"]!;
  const hookContext = { session: { id: concurrentExecution.sessionId, parent: null, auth: { current: {
    authenticator: "conversation-request-dispatcher", principalId: principal.memberUserId,
    attributes: { familyId: principal.familyId, memberUserId: principal.memberUserId, channel: "conversation-request",
      conversationRequestId: concurrentExecution.requestId, conversationRequestLease: concurrentExecution.leaseToken,
      conversationRequestAccessEpoch: principal.accessEpoch },
  } } } } as unknown as Parameters<typeof questionHandler>[1];
  await questionHandler({ type: "action.result", data: { turnId: concurrentExecution.turnId,
    sequence: 0, stepIndex: 1, status: "completed", result: { kind: "tool-result", toolName: "ask_user_questions",
      callId: cardInput.callId, output: { asked: true, ...cardInput.card } },
  } } as Parameters<typeof questionHandler>[0], hookContext);
  const alreadySent = await acceptConversationRequest(principal, { intentId: randomUUID(), text: "Actually let's do math" });
  await completionHandler({ type: "turn.completed", data: { turnId: concurrentExecution.turnId } } as Parameters<typeof completionHandler>[0], hookContext);
  assert.equal((await sql`select state from public.conversation_requests where id=${concurrentQuestion.requestId}`)[0].state, "continued");
  const released = await leaseConversationRequest(principal);
  assert(released.kind === "leased" && released.requestId === alreadySent.requestId);
  await sql`delete from public.conversation_messages where id in (${concurrentQuestion.messageId},${alreadySent.messageId})`;
  console.log("PASS a message sent before the question finishes is released without rerunning the original");
  for (const ending of ["erased-card", "revoked-card", "revoked-no-card"] as const) {
    const request = await acceptConversationRequest(principal, { intentId: randomUUID(), text: `Test ${ending}` });
    const lease = await leaseConversationRequest(principal);
    assert(lease.kind === "leased");
    const execution = { ...cardExecution, requestId: request.requestId,
      leaseToken: lease.leaseToken, sessionId: `question-ending-${randomUUID()}` };
    await claimConversationExecution(principal, execution, lease.text);
    const card = ending === "revoked-no-card" ? null : await recordConversationQuestion(principal, execution, cardInput);
    if (ending === "erased-card") await sql`delete from public.conversation_messages where id=${card!.messageId}`;
    else await sql`delete from public.family_members where family_id=${principal.familyId} and user_id=${principal.memberUserId}`;
    const outcome = await finishConversationQuestionTurn(principal, execution);
    if (ending === "revoked-no-card") {
      assert.equal(outcome, null);
      assert.equal((await observeConversationRequestOutcome(principal, { ...execution, outcome: "recovery_required" }))?.state, "recovery_required");
    } else assert.equal(outcome?.state, "continued");
    if (ending !== "erased-card") {
      await assert.rejects(readConversationQuestions(principal), /membership/);
      await assert.rejects(recordConversationQuestion(principal, execution, cardInput), /membership/);
      const previousEpoch = principal.accessEpoch;
      await sql`insert into public.family_members(family_id,user_id) values (${principal.familyId},${principal.memberUserId})`;
      principal.accessEpoch = (await readConversationAccess(principal)).accessEpoch;
      assert.notEqual(principal.accessEpoch, previousEpoch);
      assert.deepEqual(await readConversationQuestions(principal), []);
    }
    await sql`delete from public.conversation_messages where id=${request.messageId}`;
  }
  console.log("PASS deleted cards release the queue and revoked executions can record endings without regaining access");
  await sql`update public.conversation_sources set state='complete'`;
  for (const eraseOutput of [false, true]) {
    const input = await acceptConversationRequest(principal, { intentId: randomUUID(), text: "Record the whole response" });
    const lease = await leaseConversationRequest(principal);
    assert(lease.kind === "leased");
    const execution = { requestId: input.requestId, leaseToken: lease.leaseToken,
      sessionId: `source-${randomUUID()}`, turnId: "first", sequence: 0 };
    await claimConversationExecution(principal, execution, lease.text);
    const sources = await leaseConversationSources(1);
    assert.equal(sources.length, 1);
    const source = sources[0];
    assert.equal(source.sessionId, execution.sessionId);
    const identity = { turnId: execution.turnId, sequence: 0, stepIndex: 0 };
    const events = [
      { type: "message.received", data: { ...identity, message: lease.text } },
      { type: "reasoning.appended", data: { secret: "Never retain private reasoning" } },
      { type: "message.appended", data: { ...identity, messageDelta: "yes ", messageSoFar: "yes " } },
      { type: "message.completed", data: { ...identity, message: "yes ", finishReason: "tool-calls" } },
      { type: "action.result", data: { status: "completed", result: { kind: "tool-result", toolName: "unrelated", output: { secret: "private" } } } },
      { type: "message.appended", data: { ...identity, messageDelta: "yes ", messageSoFar: "yes " } },
      { type: "message.completed", data: { ...identity, message: "yes ", finishReason: "stop" } },
      { type: "turn.completed", data: { turnId: execution.turnId } },
      { type: "session.completed", data: {} },
    ] as unknown as HandleMessageStreamEvent[];
    const partial = await applyConversationSourceBatch(source, 0, events.slice(0, 3));
    assert.equal(partial.nextIndex, 3);
    assert(partial.messageId);
    assert.equal((await sql`select content from public.conversation_messages where id=${partial.messageId}`)[0].content, "yes ");
    await assert.rejects(applyConversationSourceBatch({ ...source, leaseToken: randomUUID() }, 3, events.slice(3)), /lease/);
    await assert.rejects(applyConversationSourceBatch(source, 0, events.slice(0,3)), /cursor/);
    if (eraseOutput) await sql`delete from public.conversation_messages where id=${partial.messageId}`;
    else {
      await sql.unsafe(`create function public.reject_test_projection() returns trigger language plpgsql as $$
        begin raise exception 'test projection failure'; end $$;
        create trigger reject_test_projection before update on public.conversation_messages
        for each row execute function public.reject_test_projection()`);
      await assert.rejects(applyConversationSourceBatch(source, 3, events.slice(3)), /test projection failure/);
      assert.equal(Number((await sql`select next_source_index from public.conversation_sources where session_id=${source.sessionId}`)[0].next_source_index), 3);
      assert.equal((await sql`select content from public.conversation_record_events where source_session_id=${source.sessionId}`).length, 2);
      await sql.unsafe("drop trigger reject_test_projection on public.conversation_messages; drop function public.reject_test_projection()");
    }
    const final = await applyConversationSourceBatch(source, 3, events.slice(3));
    assert.equal(final.nextIndex, events.length);
    assert.equal(final.complete, true);
    if (!eraseOutput) {
      assert.equal(final.messageId, partial.messageId);
      assert.equal((await sql`select content from public.conversation_messages where id=${final.messageId}`)[0].content, "yes yes ");
      const records = await sql`select source_event_key,content from public.conversation_record_events
        where source_session_id=${source.sessionId} order by position`;
      assert.deepEqual(records.map(value => value.source_event_key), ["0","2","3","5","6"]);
      assert(!JSON.stringify(records).includes("private"));
      assert.equal((await sql`select state from public.conversation_requests where id=${input.requestId}`)[0].state, "completed");
    } else {
      assert.equal(final.messageId, null);
      assert.equal((await sql`select content from public.conversation_record_events where source_session_id=${source.sessionId} and role='assistant'`).length, 0);
      assert.equal((await sql`select state from public.conversation_requests where id=${input.requestId}`)[0].state, "continued");
    }
    await releaseConversationSource(source);
  }
  console.log("PASS source bookmark, exact repeated segments, visible partials and endings commit atomically; erased output is skipped without blocking recovery");
  for (const snapshot of [null, ""]) {
    const input = await acceptConversationRequest(principal, { intentId: randomUUID(), text: "Keep interrupted words" });
    const lease = await leaseConversationRequest(principal);
    assert(lease.kind === "leased");
    const execution = { requestId: input.requestId, leaseToken: lease.leaseToken, sessionId: `partial-${randomUUID()}`, turnId: "first", sequence: 0 };
    await claimConversationExecution(principal, execution, lease.text);
    const [source] = await leaseConversationSources(1);
    const identity = { turnId: "first", sequence: 0, stepIndex: 0 };
    const first = await applyConversationSourceBatch(source, 0, [{ type: "message.appended", data: { ...identity, messageDelta: "Hel", messageSoFar: "Hel" } }] as HandleMessageStreamEvent[]);
    await assert.rejects(applyConversationSourceBatch(source, 1, [{ type: "message.appended", data: { ...identity, messageDelta: "lo", messageSoFar: "Byelo" } }] as HandleMessageStreamEvent[]), /Conflicting/);
    assert.equal(Number((await sql`select next_source_index from public.conversation_sources where session_id=${source.sessionId}`)[0].next_source_index), 1);
    const end = await applyConversationSourceBatch(source, 1, [
      { type: "message.completed", data: { ...identity, message: snapshot, finishReason: "stop" } },
      { type: "turn.completed", data: { turnId: "first" } }, { type: "session.completed", data: {} },
    ] as HandleMessageStreamEvent[]);
    assert.equal(end.messageId, first.messageId);
    assert.equal((await sql`select content from public.conversation_messages where id=${end.messageId}`)[0].content, snapshot === null ? "Hel" : "");
    await releaseConversationSource(source);
  }
  console.log("PASS interrupted partials, empty revisions, and conflicting prefix rollback preserve exact content and identity");
  // Eleven old billing-blocked owners must not monopolize the ten-owner page.
  // The worker leases before checking billing, advancing pickup age on each try.
  const blockedOwners: typeof principal[] = [];
  for (let i = 0; i < 12; i++) {
    const userId = randomUUID();
    await sql`insert into auth.users(id,email) values (${userId}, ${`${userId}@example.test`})`;
    await sql`insert into public.family_members(family_id,user_id) values (${principal.familyId},${userId})`;
    const owner = { ...principal, memberUserId: userId };
    owner.accessEpoch = (await readConversationAccess(owner)).accessEpoch;
    await acceptConversationRequest(owner, { intentId: randomUUID(), text: "Fair pickup" });
    blockedOwners.push(owner);
  }
  const firstPage = await listConversationDispatchOwners(10);
  assert.equal(firstPage.length, 10);
  for (const owner of firstPage) assert.equal((await leaseConversationRequest(owner)).kind, "leased");
  await sql`update public.conversation_requests set lease_until=clock_timestamp()-interval '1 second' where state='leased'`;
  const secondPage = await listConversationDispatchOwners(10);
  assert(secondPage.some(owner => owner.memberUserId === blockedOwners.at(-1)!.memberUserId));
  console.log("PASS blocked owners rotate out of a full pickup page so later adults can run");
  console.log("All conversation recording and request PostgreSQL checks passed.");
} finally {
  await sql.end();
}
