import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { beginDeliveryAttempt, finishDeliveryAttempt, recordReactiveDelivery } from "./conversation-continuity/delivery-ledger";
import { persistCanonicalMessage } from "./conversation-continuity/ledger";
import { readConversationFeed, readConversationFeedChanges } from "./conversation-feed";
import { loadConversationRequestContext } from "./conversation-request-context";
import { readConversationAccess, type ConversationRequestPrincipal } from "./conversation-requests";
import { EVAL_FIXTURE_FAMILY_ID } from "./family-context-eval-fixture";
import { mapDb } from "./map/db";

test("PostgreSQL prospective delivery snapshots preserve only the addressed revision", {
  skip: !process.env.HOMA_EVAL_DATABASE_URL,
}, async t => {
  assert(process.env.HOMA_EVAL_DATABASE_URL && process.env.HOMA_EVAL_BLOB_DIR);
  assert(!process.env.VERCEL && process.env.HOMA_EVAL_ALLOW_PROD_WRITES !== "1");
  const sql = mapDb(), originalFlag = process.env.HOMA_CONVERSATION_RECORDING;
  await sql`update public.conversation_rebuild_settings set enabled = true`; // gh#1158: these suites exercise the rebuild itself.
  try {
    const [target] = await sql`select current_setting('data_directory') as directory,
      host(inet_server_addr()) as address,current_database() as database,current_user as owner`;
    const root = path.dirname(realpathSync(process.env.HOMA_EVAL_BLOB_DIR));
    assert.match(path.basename(root), /^homa-eval-sandbox-/u);
    assert.equal(realpathSync(target.directory), path.join(root, "data"));
    assert.equal(target.database, "homa_eval"); assert.equal(target.owner, "homa_eval");
    assert([null, "127.0.0.1", "::1"].includes(target.address));
    process.env.HOMA_CONVERSATION_RECORDING = "1";
    async function owner(): Promise<ConversationRequestPrincipal> {
      const memberUserId = randomUUID(), familyId = EVAL_FIXTURE_FAMILY_ID;
      await sql`insert into auth.users(id,email) values (${memberUserId},${`${memberUserId}@example.test`})`;
      await sql`insert into public.family_members(family_id,user_id) values (${familyId},${memberUserId})`;
      return { familyId, memberUserId, ...(await readConversationAccess({ familyId, memberUserId })) };
    }
    async function source(principal: ConversationRequestPrincipal) {
      const sessionId = `delivery-source-${randomUUID()}`;
      await persistCanonicalMessage({ attributes: principal, sessionId, turnId: "first", sequence: 0,
        channel: "web", role: "user", content: "Private source conversation" });
      const message = await persistCanonicalMessage({ attributes: principal, sessionId, turnId: "first", sequence: 0,
        channel: "web", role: "assistant", content: "The source owner's answer", terminal: true });
      assert(message);
      return { ...message, sessionId };
    }
    function attemptInput(recipient: ConversationRequestPrincipal, message: Awaited<ReturnType<typeof source>>, content?: string) {
      return { familyId: recipient.familyId, memberUserId: recipient.memberUserId, episodeId: message.episodeId,
        messageId: message.id, taskRunId: null, channel: "sms" as const, destination: `test:${recipient.memberUserId}`,
        ...(content !== undefined ? { content } : {}) };
    }

    await t.test("capture precedes transport and later canonical edits never change the recipient entry", async () => {
      const author = await owner(), recipient = await owner(), message = await source(author);
      const text = "  The exact addressed line.\nA second line.  ";
      const before = await readConversationFeed(recipient);
      const attempt = await beginDeliveryAttempt(attemptInput(recipient, message, text));
      assert.equal(attempt.shouldSend, true);
      assert.equal((await readConversationFeed(recipient)).messages.length, 0);
      const [snapshot] = await sql`select id,content,published_at from public.conversation_delivery_snapshots where delivery_id=${attempt.id}`;
      assert.equal(snapshot.content, text); assert.equal(snapshot.published_at, null);
      await sql`update public.conversation_messages set content='PRIVATE OWNER ADDITION' where id=${message.id}`;
      await finishDeliveryAttempt(attempt, { delivered: true, providerMessageId: "actual-provider-receipt" });
      const page = await readConversationFeed(recipient);
      assert.equal(page.messages.length, 1); assert.equal(page.messages[0].id, snapshot.id);
      assert.equal(page.messages[0].content, text); assert.equal(page.messages[0].channel, "sms");
      assert.equal(page.messages[0].responseComplete, true);
      assert.equal(page.messages[0].sessionId, `delivery:${snapshot.id}`);
      const changes = await readConversationFeedChanges(recipient, { after: before.changeCursor });
      assert(changes.changes.some(change => change.kind === "upsert" && change.message.id === snapshot.id && change.message.content === text));
      assert(!JSON.stringify(changes).includes("PRIVATE OWNER ADDITION"));
      const context = await loadConversationRequestContext(recipient);
      assert(context.includes("The exact addressed line."));
      assert(!context.includes("PRIVATE OWNER ADDITION"));
      assert(!context.includes("Private source conversation"));
      assert((await readConversationFeed(author)).messages.some(row => row.id === message.id && row.content === "PRIVATE OWNER ADDITION"));
      const [artifact] = await sql`insert into public.materials(family_id,title,html,preview_url,pdf_url,status,generation)
        values (${author.familyId},'Private source artifact','<p>Private</p>','https://example.test/private.png','https://example.test/private.pdf','final',
          ${sql.json({ sessionId: message.sessionId })}) returning id`;
      assert(artifact.id); assert.equal((await readConversationFeed(recipient)).materials.length, 0);
      await assert.rejects(sql`update public.conversation_delivery_snapshots set content='Forged later content' where id=${snapshot.id}`, /Immutable/u);
      const duplicate = await beginDeliveryAttempt(attemptInput(recipient, message, "A later private edit"));
      assert.equal(duplicate.shouldSend, false); assert.equal(duplicate.id, attempt.id);
      assert.equal((await readConversationFeed(recipient)).messages[0].content, text);
      await sql`update public.conversation_deliveries set recipient_member_user_id=null where id=${attempt.id}`;
      const revoked = await readConversationFeedChanges(recipient, { after: page.changeCursor });
      assert(revoked.changes.some(change => change.kind === "delete" && change.messageId === snapshot.id));
      assert(!(await loadConversationRequestContext(recipient)).includes("The exact addressed line."));
      assert((await readConversationFeed(author)).messages.some(row => row.id === message.id));
    });

    await t.test("a failed retry retains its exact prepared body and conflicting retry rolls back", async () => {
      const author = await owner(), recipient = await owner(), message = await source(author);
      const input = attemptInput(recipient, message, "Only this body may be retried");
      const initial = await beginDeliveryAttempt(input);
      await finishDeliveryAttempt(initial, { delivered: false });
      await assert.rejects(beginDeliveryAttempt({ ...input, content: "Different body" }), /Conflicting/u);
      const [unchanged] = await sql`select status,attempt_count from public.conversation_deliveries where id=${initial.id}`;
      assert.equal(unchanged.status, "failed"); assert.equal(unchanged.attempt_count, 1);
      const retry = await beginDeliveryAttempt(input);
      assert.equal(retry.id, initial.id); assert.equal(retry.shouldSend, true);
      await finishDeliveryAttempt(retry, { delivered: true });
      assert.equal((await readConversationFeed(recipient)).messages[0].content, input.content);
    });

    await t.test("sent legacy rows are never backfilled from current canonical content", async () => {
      const author = await owner(), recipient = await owner(), message = await source(author);
      const input = attemptInput(recipient, message);
      const legacy = await beginDeliveryAttempt(input);
      await finishDeliveryAttempt(legacy, { delivered: true });
      await sql`update public.conversation_messages set content='Later private correction' where id=${message.id}`;
      const replay = await beginDeliveryAttempt({ ...input, content: "Later private correction" });
      assert.equal(replay.shouldSend, false);
      const [count] = await sql`select count(*)::int as total from public.conversation_delivery_snapshots where delivery_id=${legacy.id}`;
      assert.equal(count.total, 0); assert.equal((await readConversationFeed(recipient)).messages.length, 0);
      await assert.rejects(sql`insert into public.conversation_delivery_snapshots
        (delivery_id,conversation_id,family_id,recipient_member_user_id,access_epoch,source_message_id,channel,content,content_hash)
        select ${legacy.id},c.id,c.family_id,c.member_user_id,c.access_epoch,${message.id},'sms','guessed',
          encode(sha256(convert_to('guessed','UTF8')),'hex') from public.conversation_records c
        where c.family_id=${recipient.familyId} and c.member_user_id=${recipient.memberUserId}`, /Invalid conversation delivery snapshot scope/u);
    });

    await t.test("web delivery uses the supplied visible event text without duplicating its owner", async () => {
      const author = await owner(), message = await source(author);
      const result = await recordReactiveDelivery({ familyId: author.familyId, episodeId: message.episodeId, messageId: message.id,
        memberUserId: author.memberUserId, channel: "web", destination: `member:${author.memberUserId}`,
        content: "Actual completed visible event", delivered: true });
      const [snapshot] = await sql`select content,published_at from public.conversation_delivery_snapshots where delivery_id=${result.attempt.id}`;
      assert.equal(snapshot.content, "Actual completed visible event"); assert(snapshot.published_at);
      assert.equal((await readConversationFeed(author)).messages.filter(row => row.role === "assistant").length, 1);
    });

    await t.test("wrong family and removed recipient cannot admit a snapshot", async () => {
      const author = await owner(), recipient = await owner(), message = await source(author);
      const input = attemptInput(recipient, message, "Scoped output");
      await assert.rejects(beginDeliveryAttempt({ ...input, familyId: randomUUID() }), /source unavailable/u);
      await sql`delete from public.family_members where family_id=${recipient.familyId} and user_id=${recipient.memberUserId}`;
      await assert.rejects(beginDeliveryAttempt(input), /recipient unavailable/u);
      const [count] = await sql`select count(*)::int as total from public.conversation_deliveries where message_id=${message.id}`;
      assert.equal(count.total, 0);
    });

    await t.test("late confirmation after membership rejoin cannot publish an old grant", async () => {
      const author = await owner(), recipient = await owner(), message = await source(author);
      const attempt = await beginDeliveryAttempt(attemptInput(recipient, message, "Old grant"));
      await sql`delete from public.family_members where family_id=${recipient.familyId} and user_id=${recipient.memberUserId}`;
      await sql`insert into public.family_members(family_id,user_id) values (${recipient.familyId},${recipient.memberUserId})`;
      await finishDeliveryAttempt(attempt, { delivered: true });
      const rejoined = { ...recipient, ...(await readConversationAccess(recipient)) };
      assert.equal((await readConversationFeed(rejoined)).messages.length, 0);
      const [snapshot] = await sql`select published_at from public.conversation_delivery_snapshots where delivery_id=${attempt.id}`;
      assert.equal(snapshot.published_at, null);
    });

    await t.test("an old failed delivery cannot be silently retried under a rejoined membership", async () => {
      const author = await owner(), recipient = await owner(), message = await source(author);
      const input = attemptInput(recipient, message, "Old failed grant");
      const attempt = await beginDeliveryAttempt(input);
      await finishDeliveryAttempt(attempt, { delivered: false });
      await sql`delete from public.family_members where family_id=${recipient.familyId} and user_id=${recipient.memberUserId}`;
      await sql`insert into public.family_members(family_id,user_id) values (${recipient.familyId},${recipient.memberUserId})`;
      await assert.rejects(beginDeliveryAttempt(input), /recipient unavailable/u);
      const [receipt] = await sql`select attempt_count,status from public.conversation_deliveries where id=${attempt.id}`;
      assert.equal(receipt.attempt_count, 1); assert.equal(receipt.status, "failed");
    });

    await t.test("deleting a source erases snapshots and emits recipient tombstones", async () => {
      const author = await owner(), recipient = await owner(), message = await source(author);
      const attempt = await beginDeliveryAttempt(attemptInput(recipient, message, "Erase this delivered copy"));
      await finishDeliveryAttempt(attempt, { delivered: true });
      const page = await readConversationFeed(recipient), id = page.messages[0].id;
      await sql`delete from public.conversation_messages where id=${message.id}`;
      const [count] = await sql`select count(*)::int as total from public.conversation_delivery_snapshots where delivery_id=${attempt.id}`;
      assert.equal(count.total, 0);
      const changes = await readConversationFeedChanges(recipient, { after: page.changeCursor });
      assert(changes.changes.some(change => change.kind === "delete" && change.messageId === id));
      await assert.rejects(sql.begin(async tx => { await tx`set local role authenticated`;
        await tx`select * from public.conversation_delivery_snapshots`; }), /permission denied/u);
    });
  } finally {
    if (originalFlag === undefined) delete process.env.HOMA_CONVERSATION_RECORDING;
    else process.env.HOMA_CONVERSATION_RECORDING = originalFlag;
    await sql.end();
  }
});
