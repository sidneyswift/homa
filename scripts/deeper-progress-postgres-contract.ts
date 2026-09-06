import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type postgres from "postgres";

import { ProgressCheckInService } from "../apps/web/lib/child-progress/check-in-service";
import { PostgresChildProgressRepository } from "../apps/web/lib/child-progress/postgres-repository";
import { ChildProgressService } from "../apps/web/lib/child-progress/progress-service";
import { buildChildProgressView } from "../apps/web/lib/child-progress/projection";
import type { ProgressCheckInContext, ProgressCheckInRecord } from "../apps/web/lib/child-progress/types";

/** Runs only on the caller's disposable cluster, never discovers credentials. */
export async function assertDeeperProgressPostgres(sql: postgres.Sql): Promise<void> {
  const familyId = randomUUID();
  const adult = randomUUID();
  const partner = randomUUID();
  const outsider = randomUUID();
  const childId = randomUUID();
  const siblingId = randomUUID();
  const episodeId = randomUUID();
  const now = "2026-09-06T18:00:00.000Z";
  const repository = new PostgresChildProgressRepository(() => sql);
  const progress = new ChildProgressService(repository, {buildView: buildChildProgressView, now: () => new Date(now)});
  const service = new ProgressCheckInService(repository, progress);
  await sql`insert into auth.users (id) values (${adult}), (${partner}), (${outsider})`;
  await sql`insert into public.families (id, sandbox) values (${familyId}, true)`;
  await sql`insert into public.family_members (family_id, user_id, role, display_name)
    values (${familyId}, ${adult}, 'parent', 'Fixture parent'), (${familyId}, ${partner}, 'partner', 'Fixture partner')`;
  await sql`insert into public.children (id, family_id, name, birth_month)
    values (${childId}, ${familyId}, 'Deeper fixture', '2020-07-01'), (${siblingId}, ${familyId}, 'Sibling fixture', '2021-01-01')`;
  await sql`insert into public.conversation_episodes (id, family_id) values (${episodeId}, ${familyId})`;
  const context = (overrides: Partial<ProgressCheckInContext> = {}): ProgressCheckInContext => ({
    familyId, memberUserId: adult, channel: "web", providerMessageId: null, repliedDeliveryId: null,
    episodeId, runtimeSessionId: "deeper-pg-runtime", turnId: randomUUID(), canonicalInboundText: null,
    inboundMessageId: null, now, ...overrides,
  });
  const selected = {requestId: randomUUID(), childId, subjectId: "gross_motor"};
  const startInput = {childId, purpose: "subject_deep_dive" as const, subjectIds: [selected.subjectId], idempotencyKey: "deeper-start"};
  const missingAction = {...selected, requestId: randomUUID(), retryRevision: 1};
  await assert.rejects(service.startCheckIn(context({selectedAssessment: missingAction}), startInput),
    /Question recovery requires an existing start receipt/u);
  assert.equal(Number((await sql`select count(*) as count from public.progress_check_in_start_requests where family_id = ${familyId}`)[0].count), 0);
  assert.equal(Number((await sql`select count(*) as count from public.progress_check_ins where family_id = ${familyId}`)[0].count), 0);
  const starts = await Promise.all([1, 2].map(index => service.startCheckIn(context({selectedAssessment: selected}), {...startInput, idempotencyKey: `transport-${index}`})));
  assert.deepEqual(starts.map(row => row.status).sort(), ["duplicate_start", "started"]);
  const started = starts.find(row => row.status === "started");
  if (started?.status !== "started") throw new Error("Missing initial question");
  const receiptCount = async () => Number((await sql`select count(*) as count from public.progress_check_in_start_requests where family_id = ${familyId}`)[0].count);
  assert.equal(await receiptCount(), 1);
  assert.equal(started.checkIn.revision, 1);
  for (const changed of [{...selected, childId: siblingId}, {...selected, subjectId: "music"}]) {
    assert.deepEqual(await service.startCheckIn(context({selectedAssessment: changed}), {...startInput, childId: changed.childId, subjectIds: [changed.subjectId]}), {status: "idempotency_mismatch"});
  }
  assert.equal(await receiptCount(), 1);
  assert.equal((await service.startCheckIn(context({memberUserId: outsider, selectedAssessment: selected}), startInput)).status, "wrong_recipient");

  // RLS reads are scoped to the requesting adult as well as their family.
  await sql`grant select on public.family_members to authenticated`;
  for (const relation of [
    "public.progress_check_in_start_requests",
    "public.progress_check_in_start_request_status",
  ]) {
    const [grants] = await sql`
      select has_table_privilege('authenticated', ${relation}, 'SELECT') as member_read,
        has_table_privilege('authenticated', ${relation}, 'INSERT,UPDATE,DELETE') as member_write,
        has_table_privilege('anon', ${relation}, 'SELECT,INSERT,UPDATE,DELETE') as anon_access
    `;
    assert.deepEqual({...grants}, {member_read: true, member_write: false, anon_access: false});
    const readAs = (userId: string) => sql.begin(async tx => {
      await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      await tx`set local role authenticated`;
      return tx`select request_id from ${tx(relation)} where family_id = ${familyId}`;
    });
    assert.equal((await readAs(adult)).length, 1, `${relation}: owner`);
    assert.equal((await readAs(partner)).length, 0, `${relation}: same-family adult`);
    assert.equal((await readAs(outsider)).length, 0, `${relation}: outsider`);
    await assert.rejects(sql.begin(async tx => {
      await tx`set local role anon`;
      await tx`select request_id from ${tx(relation)}`;
    }), /permission denied/u);
    for (const statement of [
      `update ${relation} set subject_id = 'music'`,
      `delete from ${relation}`,
      `insert into ${relation} default values`,
    ]) {
      for (const userId of [adult, partner, outsider]) {
        await assert.rejects(sql.begin(async tx => {
          await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
          await tx`set local role authenticated`;
          await tx.unsafe(statement);
        }), (error: unknown) => {
          const code = (error as {code?: string}).code;
          return code === "42501" || (relation.endsWith("_status") && code === "55000");
        });
      }
    }
  }

  const counts = async () => (await sql`select
    (select count(*)::integer from public.progress_check_in_responses where family_id = ${familyId}) responses,
    (select count(*)::integer from public.child_progress_evidence where family_id = ${familyId}) evidence,
    (select count(*)::integer from public.child_progress_operations where family_id = ${familyId}) operations`)[0];
  let current: ProgressCheckInRecord = started.checkIn;
  const bind = async (record: ProgressCheckInRecord, channel: "web" | "sms" | "email") => {
    const deliveryId = randomUUID();
    await sql`insert into public.conversation_deliveries (id, family_id, episode_id, recipient_member_user_id, channel, status)
      values (${deliveryId}, ${familyId}, ${episodeId}, ${adult}, ${channel}, 'sent')`;
    const result = await service.bindCurrentDelivery(context({channel, runtimeSessionId: record.pendingRuntimeSessionId!, turnId: record.pendingTurnId!}), {
      checkInId: record.id, expectedRevision: record.revision, deliveryId,
    });
    assert.equal(result.status, "bound");
    return deliveryId;
  };
  const beforeAnswer = await counts();
  assert.deepEqual(await service.respondCheckIn(context(), {checkInId: current.id, answer: "easily", idempotencyKey: "unbound"}), {status: "wrong_delivery"});
  assert.deepEqual(await counts(), beforeAnswer);
  // Crash after the durable start, before any delivered question. Passive
  // reload preserves it; only one explicit retry can replace its old marker.
  const originalReceipt = (await sql`select result from public.progress_check_in_start_requests where family_id = ${familyId} and request_id = ${selected.requestId}`)[0].result;
  assert.equal((await service.startCheckIn(context({selectedAssessment: selected}), startInput)).status, "duplicate_start");
  const retries = await Promise.all([1, 2].map(index => service.startCheckIn(context({turnId: `recovery-${index}`,
    selectedAssessment: {...selected, retryRevision: current.revision}}), startInput)));
  assert.deepEqual(retries.map(row => row.status).sort(), ["duplicate_start", "existing"]);
  const recovered = retries.find(row => row.status === "existing");
  if (recovered?.status !== "existing") throw new Error("Missing recovered question");
  assert.equal(recovered.checkIn.id, current.id);
  assert.equal(recovered.checkIn.currentItemId, current.currentItemId);
  assert.equal(recovered.checkIn.revision, current.revision + 1);
  assert.deepEqual(await service.bindCurrentDelivery(context({runtimeSessionId: current.pendingRuntimeSessionId!, turnId: current.pendingTurnId!}), {
    checkInId: current.id, expectedRevision: current.revision, deliveryId: randomUUID(),
  }), {status: "stale_prompt"});
  current = recovered.checkIn;
  assert.deepEqual(await counts(), beforeAnswer);
  assert.deepEqual((await sql`select result from public.progress_check_in_start_requests where family_id = ${familyId} and request_id = ${selected.requestId}`)[0].result, originalReceipt);
  const seen = new Set<string>();
  for (let index = 0; index < 8; index += 1) {
    assert.ok(current.currentItemId && !seen.has(current.currentItemId));
    seen.add(current.currentItemId!);
    // Native text shares web canonical provenance; SMS/email retain their own.
    const channel = (["web", "sms", "email", "web"] as const)[index % 4];
    const deliveryId = await bind(current, channel);
    if (index === 0) {
      const [receipt] = await sql`select delivered_at, issued_revision from public.progress_check_in_start_requests where family_id = ${familyId} and request_id = ${selected.requestId}`;
      assert.ok(receipt.delivered_at, "actual delivery atomically stamps the selected receipt");
      assert.equal(receipt.issued_revision, current.revision);
      assert.equal((await service.startCheckIn(context({selectedAssessment: {...selected, retryRevision: current.revision}}), startInput)).status, "duplicate_start");
      assert.equal((await repository.loadNonterminalCheckInByChild(familyId, childId))?.currentDeliveryId, deliveryId);
    }
    const inboundMessageId = randomUUID();
    await sql`insert into public.conversation_messages (id, family_id) values (${inboundMessageId}, ${familyId})`;
    const ctx = context({channel, repliedDeliveryId: deliveryId, inboundMessageId, canonicalInboundText: index === 0 ? "She does that by herself without any help." : "I haven't seen that yet, so I'm not sure.", providerMessageId: `deeper-answer-${index}`});
    const input = {checkInId: current.id, expectedRevision: current.revision, answer: index === 0 ? "easily" as const : "not_sure" as const, idempotencyKey: `deeper-answer-${index}`};
    const before = await counts();
    assert.deepEqual(await service.respondCheckIn(ctx, {...input, expectedRevision: current.revision - 1}), {status: "stale_prompt"});
    assert.deepEqual(await service.respondCheckIn({...ctx, memberUserId: partner}, input), {status: "wrong_recipient"});
    assert.deepEqual(await counts(), before);
    const result = await service.respondCheckIn(ctx, input);
    assert.equal(result.status, index === 7 ? "completed" : "advanced");
    if (result.status !== "advanced" && result.status !== "completed") throw new Error("Missing durable answer");
    current = result.checkIn;
    assert.equal(current.acceptedResponseCount, index + 1);
    assert.equal(current.uncertainResponseCount, index);
    const after = await counts();
    assert.equal((await service.respondCheckIn(ctx, input)).status, "duplicate");
    assert.deepEqual(await counts(), after);
    if (index === 0) {
      const [evidence] = await sql`select item_id, answer, source, derivation, member_user_id, message_id, check_in_id, channel
        from public.child_progress_evidence where family_id = ${familyId}`;
      assert.deepEqual(evidence, {item_id: started.checkIn.currentItemId, answer: "easily", source: "check_in", derivation: "direct", member_user_id: adult, message_id: inboundMessageId, check_in_id: current.id, channel});
      const live = await repository.loadLiveView(familyId, childId, new Date(now));
      assert.ok(live, "real canonical scorer persisted the live projection");
      const [compatibility] = await sql`select answer, source from public.child_answers where child_id = ${childId} and question_id = ${started.checkIn.currentItemId}`;
      assert.deepEqual(compatibility, {answer: "easily", source: "check_in"});
      await service.pauseCheckIn(context(), {checkInId: current.id, reason: "explicit_pause"});
      const resumed = await service.startCheckIn(context({selectedAssessment: {...selected, requestId: randomUUID()}}), {...startInput, idempotencyKey: "resume-selection"});
      assert.equal(resumed.status, "existing");
      if (resumed.status !== "existing") throw new Error("Missing selected resume");
      assert.equal(resumed.checkIn.state, "active");
      assert.equal(resumed.checkIn.currentItemId, current.currentItemId);
      current = resumed.checkIn;
    }
  }
  assert.equal(current.terminalReason, "sitting_limit");
  assert.equal(current.currentItemId, null);
  assert.equal(current.terminalMixedEvidence, false);
  assert.deepEqual(await counts(), {responses: 8, evidence: 1, operations: 1});
  const saved = await sql`select * from public.progress_check_ins where family_id = ${familyId} order by id`;
  const replay = await service.startCheckIn(context({selectedAssessment: selected}), startInput);
  assert.equal(replay.status, "duplicate_start");
  assert.deepEqual(await sql`select * from public.progress_check_ins where family_id = ${familyId} order by id`, saved);

  const rollbackId = randomUUID();
  await assert.rejects(repository.withTransaction(async tx => {
    await tx.claimCheckInStartRequest({familyId, memberUserId: adult, requestId: rollbackId, childId, subjectId: "music", runtimeSessionId: "rollback", turnId: "rollback"});
    throw new Error("rollback this request");
  }), /rollback this request/u);
  assert.equal((await sql`select count(*)::integer count from public.progress_check_in_start_requests where request_id = ${rollbackId}`)[0].count, 0);

  // Separate new sitting can stop early without losing accepted evidence.
  const next = await service.startCheckIn(context({selectedAssessment: {requestId: randomUUID(), childId: siblingId, subjectId: "music"}}), {...startInput, childId: siblingId, subjectIds: ["music"], idempotencyKey: "sibling-stop"});
  assert.equal(next.status, "started");
  if (next.status !== "started") throw new Error("Missing stop fixture");
  const stopped = await service.stopCheckIn(context(), {checkInId: next.checkIn.id});
  assert.equal(stopped.status, "stopped");
  if (stopped.status === "stopped") assert.equal(stopped.checkIn.terminalReason, "parent_stopped");
  const beforeDelete = await receiptCount();
  await sql`delete from public.children where id = ${siblingId} and family_id = ${familyId}`;
  assert.equal(await receiptCount(), beforeDelete - 1);

  // An unaccepted selected action follows its child across the existing fold.
  const destination = randomUUID();
  const foldingChild = randomUUID();
  const foldingRequest = randomUUID();
  await sql`insert into public.families (id, sandbox) values (${destination}, true)`;
  await sql`insert into public.children (id, family_id, name, birth_month) values (${foldingChild}, ${familyId}, 'Fold fixture', '2020-01-01')`;
  await sql`insert into public.progress_check_in_start_requests
    (family_id, member_user_id, request_id, child_id, subject_id, runtime_session_id, turn_id)
    values (${familyId}, ${adult}, ${foldingRequest}, ${foldingChild}, 'music', 'fold-runtime', 'fold-turn')`;
  await sql`update public.children set family_id = ${destination} where id = ${foldingChild}`;
  assert.equal((await sql`select count(*)::integer count from public.progress_check_in_start_requests where family_id = ${destination}`)[0].count, 1);
  await sql`delete from public.children where id = ${foldingChild}`;
  await sql`delete from auth.users where id = ${adult}`;
  assert.equal(await receiptCount(), 0, "Auth deletion removes all personal start receipts");
  assert.equal((await counts()).evidence, 1, "member removal follows the existing evidence retention contract");
  // Family erasure follows the same guarded protocol as the existing harness.
  const familyDeleteRequest = randomUUID();
  await sql`insert into public.progress_check_in_start_requests
    (family_id, member_user_id, request_id, child_id, subject_id, runtime_session_id, turn_id)
    values (${familyId}, ${partner}, ${familyDeleteRequest}, ${childId}, 'music', 'delete-runtime', 'delete-turn')`;
  const deletionJob = randomUUID();
  await sql`insert into public.account_deletion_jobs (id, family_id, status) values (${deletionJob}, ${familyId}, 'running')`;
  await sql`insert into public.account_deletion_artifact_tombstones (family_id, deletion_job_id) values (${familyId}, ${deletionJob})`;
  await sql.begin(async tx => {
    await tx`select set_config('homa.family_delete_mode', 'account-deletion-v2', true)`;
    await tx`update public.families set status = 'deleted' where id = ${familyId}`;
    await tx`delete from public.families where id = ${familyId}`;
  });
  assert.equal(await receiptCount(), 0);
  // The old minimal harness omits children.family_id -> families cascade.
  // Match its existing family-deletion fixture by removing that child explicitly.
  await sql`delete from public.children where id = ${childId}`;
  assert.equal((await counts()).evidence, 0);
  console.log("PASS  deeper-progress-e2e atomic-start-replay-rls-eight-bound-answers-provenance-stop-child-auth-lifecycle");
}
