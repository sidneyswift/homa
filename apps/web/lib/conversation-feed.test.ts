import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { conversationFeedResponse, decodeConversationFeedCursor, encodeConversationFeedCursor,
  decodeConversationChangeCursor, encodeConversationChangeCursor, readConversationFeed, readConversationFeedChanges, readConversationFeedMaterials,
  type ConversationFeedDependencies, type ConversationFeedPage } from "./conversation-feed";
import { persistCanonicalMessage } from "./conversation-continuity/ledger";
import { loadConversationRequestContext } from "./conversation-request-context";
import { acceptConversationRequest, acceptConversationQuestionAnswer, claimConversationExecution,
  ConversationRequestError, finishConversationQuestionTurn, finishConversationRequest,
  leaseConversationRequest, readConversationAccess, recordConversationQuestion } from "./conversation-requests";
import { EVAL_FIXTURE_FAMILY_ID } from "./family-context-eval-fixture";
import { mapDb } from "./map/db";

const familyId = randomUUID(), memberUserId = randomUUID(), accessEpoch = randomUUID();
const account = `${familyId}:${memberUserId}`;
const page: ConversationFeedPage = { account, conversationId: randomUUID(), accessEpoch, mode: "snapshot",
  messages: [], materials: [], requests: [], requestsTruncated: false, hasOlder: false, nextCursor: null,
  changeCursor: encodeConversationChangeCursor({ version: 1, kind: "changes", account, accessEpoch, position: "0" }) };
function fixture(overrides: Partial<ConversationFeedDependencies> = {}) {
  const calls: unknown[] = [];
  const dependencies: ConversationFeedDependencies = {
    enabled: () => true, principal: async () => ({ familyId, memberUserId }), limited: () => false,
    access: async value => { calls.push({ access: value }); return { conversationId: page.conversationId, accessEpoch }; },
    read: async (principal, options) => { calls.push({ principal, options }); return page; },
    materials: async () => { throw new Error("Unexpected material request"); },
    changes: async () => { throw new Error("Unexpected change request"); }, ...overrides,
  };
  return { calls, dependencies };
}
function request(params: Record<string, string> = { account, accessEpoch }, authorization = "Bearer exact-token") {
  return new Request(`https://homa.test/api/conversation/feed?${new URLSearchParams(params)}`, { headers: { authorization } });
}

test("feed authenticates exact bearer and account before reading", async () => {
  const { calls, dependencies } = fixture();
  assert.equal((await conversationFeedResponse(request(undefined, "Basic bad"), dependencies)).status, 401);
  assert.equal((await conversationFeedResponse(request({ account: randomUUID(), accessEpoch }), dependencies)).status, 409);
  assert.equal((await conversationFeedResponse(request(), { ...dependencies, enabled: () => false })).status, 503);
  assert.deepEqual(calls, []);
  const response = await conversationFeedResponse(request(), dependencies);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("vary"), "Authorization");
  assert.deepEqual(await response.json(), page);
  assert.deepEqual(calls, [{ principal: { familyId, memberUserId, accessEpoch }, options: { limit: 40 } }]);
});

test("newest snapshot discovers current epoch but older pages cannot omit it", async () => {
  const { calls, dependencies } = fixture();
  assert.equal((await conversationFeedResponse(request({ account }), dependencies)).status, 200);
  assert.deepEqual(calls[0], { access: { familyId, memberUserId } });
  const cursor = encodeConversationFeedCursor({ version: 1, account, accessEpoch, at: "2026-09-12T15:00:00.123456Z", id: randomUUID() });
  const invalid = await conversationFeedResponse(request({ account, before: cursor }), dependencies);
  assert.equal(invalid.status, 400);
  assert.equal(calls.length, 2);
});

test("keyset cursor preserves microseconds and rejects another account or generation", () => {
  const value = { version: 1 as const, account, accessEpoch, at: "2026-09-12T15:00:00.123456Z", id: randomUUID() };
  const cursor = encodeConversationFeedCursor(value);
  assert.deepEqual(decodeConversationFeedCursor(cursor, account, accessEpoch), value);
  for (const [a, epoch] of [[`${familyId}:${randomUUID()}`, accessEpoch], [account, randomUUID()]]) {
    assert.throws(() => decodeConversationFeedCursor(cursor, a, epoch), /invalid/);
  }
  for (const invalid of ["", "%%%", "a".repeat(1025), Buffer.from('{"version":1}').toString("base64url")]) {
    assert.throws(() => decodeConversationFeedCursor(invalid, account, accessEpoch), /invalid/);
  }
});

test("feed rejects malformed selectors and keeps provider failure retryable", async () => {
  const { calls, dependencies } = fixture();
  const invalidParameters: Record<string, string>[] = [{ familyId }, { before: "bad" }, { limit: "0" }, { limit: "101" }, { limit: "5oops" }, { accessEpoch: "bad" }];
  for (const extra of invalidParameters) {
    assert.equal((await conversationFeedResponse(request({ account, accessEpoch, ...extra }), dependencies)).status, 400);
  }
  assert.deepEqual(calls, []);
  const limited = await conversationFeedResponse(request(), { ...dependencies, limited: () => true });
  assert.equal(limited.status, 429); assert.equal(limited.headers.get("retry-after"), "5");
  assert.equal((await conversationFeedResponse(request(), { ...dependencies,
    read: async () => { throw new ConversationRequestError("access_changed"); } })).status, 409);
  const failed = await conversationFeedResponse(request(), { ...dependencies, read: async () => { throw new Error("private database detail"); } });
  assert.equal(failed.status, 503); assert.equal((await failed.text()).includes("private"), false);
});

test("change feed cursors remain scoped and distinct from history cursors", async () => {
  const cursor = page.changeCursor;
  assert.equal(decodeConversationChangeCursor(cursor, account, accessEpoch).position, "0");
  assert.throws(() => decodeConversationChangeCursor(cursor, account, randomUUID()), /invalid/);
  assert.throws(() => decodeConversationFeedCursor(cursor, account, accessEpoch), /invalid/);
  const { dependencies } = fixture({ changes: async (owner, options) => {
    assert.equal(owner.accessEpoch, accessEpoch); assert.equal(options.after, cursor);
    return { account, conversationId: page.conversationId, accessEpoch, mode: "changes", changes: [],
      nextChangeCursor: cursor, hasMore: false, requests: [], requestsTruncated: false, materials: [], materialSessions: [] };
  } });
  assert.equal((await conversationFeedResponse(request({ account, accessEpoch, after: cursor }), dependencies)).status, 200);
  assert.equal((await conversationFeedResponse(request({ account, after: cursor }), dependencies)).status, 400);
  assert.equal((await conversationFeedResponse(request({ account, accessEpoch, after: cursor, before: cursor }), dependencies)).status, 400);
});

test("artifact retries select canonical IDs and require the existing access epoch", async () => {
  const messageId = randomUUID();
  const { dependencies } = fixture({ materials: async (owner, options) => {
    assert.equal(owner.accessEpoch, accessEpoch); assert.deepEqual(options.messageIds, [messageId]);
    return { account, conversationId: page.conversationId, accessEpoch, mode: "materials", materials: [],
      materialSessions: [], requestedMessageIds: [messageId] };
  } });
  assert.equal((await conversationFeedResponse(request({ account, accessEpoch, materialsFor: messageId }), dependencies)).status, 200);
  assert.equal((await conversationFeedResponse(request({ account, materialsFor: messageId }), dependencies)).status, 400);
  assert.equal((await conversationFeedResponse(request({ account, accessEpoch, materialsFor: "untrusted-session" }), dependencies)).status, 400);
});

test("PostgreSQL feed restores exact text, typed answers, ownership, snapshots and deletion", {
  skip: !process.env.HOMA_EVAL_DATABASE_URL,
}, async () => {
  // This regression may only run through the disposable eval sandbox.
  assert(process.env.HOMA_EVAL_DATABASE_URL && process.env.HOMA_EVAL_BLOB_DIR);
  assert(!process.env.VERCEL && process.env.HOMA_EVAL_ALLOW_PROD_WRITES !== "1");
  const sql = mapDb();
  await sql`update public.conversation_rebuild_settings set enabled = true`; // gh#1158: these suites exercise the rebuild itself.
  process.env.HOMA_CONVERSATION_RECORDING ??= "1"; // exact-text recording is part of the rebuild under test.
  try {
  const [target] = await sql`select current_setting('data_directory') as directory,
    host(inet_server_addr()) as address,current_database() as database,current_user as owner`;
  const root = path.dirname(realpathSync(process.env.HOMA_EVAL_BLOB_DIR));
  assert.match(path.basename(root), /^homa-eval-sandbox-/u);
  assert.equal(realpathSync(target.directory), path.join(root, "data"));
  assert.equal(target.database, "homa_eval"); assert.equal(target.owner, "homa_eval");
  assert([null, "127.0.0.1", "::1"].includes(target.address));
  // Other storage suites share this cluster and may record new fixture-parent
  // messages. Use an isolated adult so newest-page assertions stay meaningful.
  const owner = { familyId: EVAL_FIXTURE_FAMILY_ID, memberUserId: randomUUID() };
  await sql`insert into auth.users(id,email) values (${owner.memberUserId},${`${owner.memberUserId}@example.test`})`;
  await sql`insert into public.family_members(family_id,user_id) values (${owner.familyId},${owner.memberUserId})`;
  const principal = { ...owner, ...(await readConversationAccess(owner)) };
  const sessionId = `feed-${randomUUID()}`;
  const first = await persistCanonicalMessage({ attributes: owner, sessionId, turnId: "first", sequence: 0,
    channel: "web", role: "user", content: "  Keep exact spaces\nand lines.  " });
  const second = await persistCanonicalMessage({ attributes: owner, sessionId, turnId: "first", sequence: 0,
    channel: "web", role: "assistant", content: "Saved answer", terminal: true });
  assert(first && second);
  await sql`update public.conversation_messages set created_at='2026-09-12T15:00:00.123456Z' where id=${first.id}`;
  await sql`update public.conversation_messages set created_at='2026-09-12T15:00:00.123457Z' where id=${second.id}`;
  const newer = await readConversationFeed(principal, { limit: 1 });
  assert.equal(newer.messages[0]?.id, second.id); assert(newer.nextCursor);
  assert.equal(newer.messages[0].responseComplete, true);
  const older = await readConversationFeed(principal, { limit: 1, before: newer.nextCursor });
  assert.equal(older.messages[0]?.id, first.id);
  assert.equal(older.messages[0].content, "  Keep exact spaces\nand lines.  ");
  await sql`update public.conversation_messages set content='Corrected answer' where id=${second.id}`;
  const edit = await readConversationFeedChanges(principal, { after: newer.changeCursor });
  assert(edit.changes.some(change => change.kind === "upsert" && change.message.id === second.id && change.message.content === "Corrected answer"));
  assert.deepEqual(await readConversationFeedChanges(principal, { after: newer.changeCursor }), edit);
  assert.equal((await readConversationFeed(principal, { limit: 1 })).messages[0].content, "Corrected answer");
  await sql`delete from public.conversation_messages where id=${second.id}`;
  const deletion = await readConversationFeedChanges(principal, { after: edit.nextChangeCursor });
  assert(deletion.changes.some(change => change.kind === "delete" && change.messageId === second.id));
  assert.equal((await readConversationFeed(principal, { limit: 1 })).messages[0].id, first.id);

  const outsider = randomUUID();
  await sql`insert into auth.users(id,email) values (${outsider},${`${outsider}@example.test`})`;
  await sql`insert into public.family_members(family_id,user_id) values (${owner.familyId},${outsider})`;
  const otherSessionId = `other-${randomUUID()}`;
  const other = await persistCanonicalMessage({ attributes: { ...owner, memberUserId: outsider }, sessionId: otherSessionId,
    turnId: "private", sequence: 0, channel: "web", role: "user", content: "Other adult secret" });
  assert(other);
  const hidden = await persistCanonicalMessage({ attributes: owner, sessionId, turnId: "internal", sequence: 2,
    channel: "web", role: "assistant", content: "Internal narration", terminal: false });
  assert(hidden);
  const visible = await readConversationFeed(principal);
  assert(!visible.messages.some(message => message.id === other.id || message.id === hidden.id));
  const delivered = await persistCanonicalMessage({ attributes: { ...owner, memberUserId: outsider }, sessionId: otherSessionId,
    turnId: "private", sequence: 0, channel: "web", role: "assistant", content: "A later unaddressed revision", terminal: true });
  assert(delivered);
  const [deliveredRow] = await sql`select episode_id from public.conversation_messages where id=${delivered.id}`;
  await sql`insert into public.conversation_deliveries(family_id,episode_id,message_id,recipient_member_user_id,channel,destination_hash,status)
    values (${owner.familyId},${deliveredRow.episode_id},${delivered.id},${owner.memberUserId},'web',${"f".repeat(64)},'sent')`;
  assert(!(await readConversationFeed(principal)).messages.some(message => message.id === delivered.id));
  const outbound = await persistCanonicalMessage({ attributes: owner, sessionId, turnId: "outbound", sequence: 3,
    channel: "sms", role: "assistant", content: "Sent SMS", terminal: true });
  assert(outbound);
  await sql`update public.conversation_messages set visibility='family' where id=${outbound.id}`;
  assert(!(await readConversationFeed(principal)).messages.some(message => message.id === outbound.id));
  const [outboundRow] = await sql`select episode_id from public.conversation_messages where id=${outbound.id}`;
  const [delivery] = await sql`insert into public.conversation_deliveries(family_id,episode_id,message_id,recipient_member_user_id,channel,destination_hash,status)
    values (${owner.familyId},${outboundRow.episode_id},${outbound.id},${owner.memberUserId},'sms',${"e".repeat(64)},'sent') returning id`;
  const sent = await readConversationFeed(principal);
  assert(sent.messages.some(message => message.id === outbound.id));
  await sql`delete from public.conversation_deliveries where id=${delivery.id}`;
  const retracted = await readConversationFeedChanges(principal, { after: sent.changeCursor });
  assert(retracted.changes.some(change => change.kind === "delete" && change.messageId === outbound.id));
  const [material] = await sql`insert into public.materials(family_id,title,html,preview_url,pdf_url,status,generation)
    values (${owner.familyId},'Owned worksheet','<p>Owned</p>','https://example.test/owned.png','https://example.test/owned.pdf','final',
      ${sql.json({ sessionId, pageCount: 2, pagePreviewUrls: ["https://example.test/1.png", "https://example.test/2.png"] })}) returning id`;
  await sql`insert into public.materials(family_id,title,html,preview_url,pdf_url,status,generation)
    values (${owner.familyId},'Other conversation worksheet','<p>Other</p>','https://example.test/private.png','https://example.test/private.pdf','final',
      ${sql.json({ sessionId: otherSessionId })})`;
  const restored = await readConversationFeed(principal);
  assert.deepEqual(restored.materials.map(value => value.id), [material.id]);
  assert.equal(restored.materials[0].pageCount, 2);
  const targeted = await readConversationFeedMaterials(principal, { messageIds: [first.id, other.id] });
  assert.deepEqual(targeted.materials.map(value => value.id), [material.id]);
  assert.deepEqual(targeted.materialSessions, [sessionId]);
  await sql`update public.materials set deleted_at=clock_timestamp() where id=${material.id}`;
  assert.equal((await readConversationFeed(principal)).materials.length, 0);
  const materialChange = await readConversationFeedChanges(principal, { after: restored.changeCursor });
  assert(materialChange.materialSessions.includes(sessionId)); assert.equal(materialChange.materials.length, 0);

  const concurrent = await persistCanonicalMessage({ attributes: owner, sessionId, turnId: "concurrent", sequence: 4,
    channel: "web", role: "user", content: "Second committed message" });
  assert(concurrent);
  const beforeWrites = await readConversationFeed(principal);
  await assert.rejects(sql.begin(async tx => {
    await tx`update public.conversation_messages set content='Rolled back' where id=${first.id}`;
    throw new Error("abort this write");
  }), /abort this write/);
  assert.equal((await readConversationFeedChanges(principal, { after: beforeWrites.changeCursor })).changes.length, 0);
  let unlock!: () => void, entered!: () => void;
  const hold = new Promise<void>(resolve => { unlock = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const writerA = sql.begin(async tx => {
    await tx`update public.conversation_messages set content='First committed revision' where id=${first.id}`;
    entered(); await hold;
  });
  await started;
  try {
    const during = await readConversationFeed(principal);
    assert.equal(during.changeCursor, beforeWrites.changeCursor);
    assert.equal(during.messages.find(message => message.id === first.id)?.content, "  Keep exact spaces\nand lines.  ");
  } finally { unlock(); }
  const writerB = sql.begin(async tx => {
    await tx`update public.conversation_messages set content='Second committed revision' where id=${concurrent.id}`;
  });
  await Promise.all([writerA, writerB]);
  const oneChange = await readConversationFeedChanges(principal, { after: beforeWrites.changeCursor, limit: 1 });
  assert.equal(oneChange.hasMore, true);
  const rest = await readConversationFeedChanges(principal, { after: oneChange.nextChangeCursor, limit: 1 });
  assert.equal(rest.hasMore, false);
  assert.deepEqual([...oneChange.changes, ...rest.changes].map(change => change.kind === "upsert" ? change.message.id : change.messageId),
    [first.id, concurrent.id]);
  const ownAccount = `${owner.familyId}:${owner.memberUserId}`;
  const positionBefore = BigInt(decodeConversationChangeCursor(beforeWrites.changeCursor, ownAccount, principal.accessEpoch).position);
  assert.equal(BigInt(decodeConversationChangeCursor(rest.nextChangeCursor, ownAccount, principal.accessEpoch).position), positionBefore + BigInt(2));
  const otherPrincipal = { ...owner, memberUserId: outsider, ...(await readConversationAccess({ ...owner, memberUserId: outsider })) };
  await assert.rejects(readConversationFeedChanges(otherPrincipal, { after: beforeWrites.changeCursor }), /invalid/);
  await assert.rejects(sql.begin(async tx => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claim.sub',${owner.memberUserId},true)`;
    await tx`select * from public.conversation_feed_changes`;
  }), /permission denied/);

  const accepted = await acceptConversationRequest(principal, { intentId: randomUUID(), text: "Make a card" });
  const leased = await leaseConversationRequest(principal); assert.equal(leased.kind, "leased");
  if (leased.kind !== "leased") throw new Error("Request not leased");
  const execution = { requestId: accepted.requestId, leaseToken: leased.leaseToken, sessionId: `feed-request-${randomUUID()}`,
    turnId: "request-turn", sequence: 0 };
  await claimConversationExecution(principal, execution, leased.text);
  const output = await persistCanonicalMessage({ attributes: owner, sessionId: execution.sessionId, turnId: execution.turnId,
    sequence: 0, channel: "web", role: "assistant", content: "Unprojected output", terminal: true });
  assert(output);
  assert(!(await readConversationFeed(principal)).messages.some(message => message.id === output.id));
  await sql`update public.conversation_messages set recording_position=1 where id=${output.id}`;
  const duringResponse = await readConversationFeed(principal);
  assert.equal(duringResponse.messages.find(message => message.id === output.id)?.responseComplete, false);
  assert.equal(duringResponse.messages.find(message => message.id === accepted.messageId)?.responseComplete, true);
  const card = await recordConversationQuestion(principal, execution, { sourceSequence: 0, stepIndex: 0, callId: "choices",
    card: { questions: [{ header: "Activity", question: "Which activity?", multiSelect: false,
      options: [{ label: "Game", description: "Outdoors" }, { label: "Game", description: "Indoors" }] }] } });
  assert.equal((await readConversationFeed(principal)).messages.find(message => message.id === card.messageId)?.question?.state, "recorded");
  assert.equal((await readConversationFeed(principal)).messages.find(message => message.id === card.messageId)?.responseComplete, false);
  await finishConversationQuestionTurn(principal, execution);
  const completedResponse = await readConversationFeedChanges(principal, { after: duringResponse.changeCursor });
  assert(completedResponse.changes.some(change => change.kind === "upsert" && change.message.id === output.id && change.message.responseComplete));
  assert(completedResponse.changes.some(change => change.kind === "upsert" && change.message.id === card.messageId && change.message.responseComplete));
  const answer = await acceptConversationQuestionAnswer(principal, { intentId: randomUUID(),
    questionAnswer: { questionId: card.id, answers: [{ question: 0, kind: "choice", options: [1] }] } });
  const [file] = await sql`insert into public.chat_attachments(family_id,member_user_id,url,media_type,kind,caption)
    values (${owner.familyId},${owner.memberUserId},'https://example.test/parent.pdf','application/pdf','document','Parent file') returning id`;
  await sql`insert into public.conversation_attachment_preparations(attachment_id,family_id,member_user_id,blob_url,payload)
    values (${file.id},${owner.familyId},${owner.memberUserId},'https://example.test/parent.pdf',
      ${sql.json({ filename: "parent.pdf", block: "PRIVATE EXTRACTION MUST NOT REACH FEED", marker: "private marker" })})`;
  await sql`insert into public.conversation_request_attachments(request_id,ordinal,original_attachment_id,attachment_id)
    values (${answer.requestId},0,${file.id},${file.id})`;
  const withFile = await readConversationFeed(principal);
  assert.deepEqual(withFile.messages.find(message => message.id === answer.messageId)?.attachments, [{ id: file.id,
    url: "https://example.test/parent.pdf", mediaType: "application/pdf", kind: "document", name: "parent.pdf", caption: "Parent file" }]);
  assert(!JSON.stringify(withFile).includes("PRIVATE EXTRACTION"));
  await sql`delete from public.chat_attachments where id=${file.id}`;
  const erasedFile = await readConversationFeedChanges(principal, { after: withFile.changeCursor });
  assert(erasedFile.changes.some(change => change.kind === "upsert" && change.message.id === answer.messageId && change.message.attachments?.length === 0));
  const answered = (await readConversationFeed(principal)).messages.find(message => message.id === card.messageId)?.question;
  assert.equal(answered?.state, "answered");
  assert.deepEqual(answered?.answers, [{ question: 0, kind: "choice", options: [1] }]);
  assert.equal((await readConversationFeed(principal)).messages.find(message => message.id === answer.messageId)?.request?.state, "revoked");
  await sql`delete from public.conversation_messages where id=${card.messageId}`;
  assert(!(await readConversationFeed(principal)).messages.some(message => message.id === card.messageId));
  await finishConversationRequest(principal, execution, "completed");
  const next = await acceptConversationRequest(principal, { intentId: randomUUID(), text: "Next native continuation input" });
  const nextLease = await leaseConversationRequest(principal); assert.equal(nextLease.kind, "leased");
  if (nextLease.kind !== "leased") throw new Error("Next request not leased");
  const nextExecution = { requestId: next.requestId, leaseToken: nextLease.leaseToken,
    sessionId: execution.sessionId, turnId: "next-turn", sequence: 1 };
  await claimConversationExecution(principal, nextExecution, nextLease.text);
  await persistCanonicalMessage({ attributes: owner, sessionId: execution.sessionId, turnId: "next-turn",
    sequence: 1, channel: "web", role: "assistant", content: "Private unfinished continuation", terminal: true });
  const continuedContext = await loadConversationRequestContext(principal);
  assert(continuedContext.includes("Unprojected output"));
  assert(!continuedContext.includes("Next native continuation input"));
  assert(!continuedContext.includes("Private unfinished continuation"));
  await sql`delete from public.family_members where family_id=${owner.familyId} and user_id=${owner.memberUserId}`;
  await assert.rejects(readConversationFeed(principal), /membership/);
  await sql`insert into public.family_members(family_id,user_id) values (${owner.familyId},${owner.memberUserId})`;
  await assert.rejects(readConversationFeed(principal), /access_changed/);
  } finally { await sql.end(); }
});
