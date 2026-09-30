import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { ToolContext } from "eve/tools";

import { withToolDeadline, ToolDeadlineError } from "./agent-tool-deadline";
import { executeConversationOperation, prepareConversationOperation, operationJson, ConversationOperationUnknown } from "./conversation-operations";
import { admitConversationRequest, CONVERSATION_DISPATCH_AUTHENTICATOR, CONVERSATION_DISPATCH_CHANNEL } from "./conversation-request-admission";
import { acceptConversationRequest, ConversationRequestError, finishConversationRequest, finishConversationQuestionTurn,
  leaseConversationRequest, readConversationAccess, recordConversationQuestion, requestTransaction,
  type ConversationRequestPrincipal } from "./conversation-requests";
import { EVAL_FIXTURE_FAMILY_ID } from "./family-context-eval-fixture";
import { mapDb } from "./map/db";

function code(expected: ConversationRequestError["code"]) {
  return (error: unknown) => error instanceof ConversationRequestError && error.code === expected;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

test("operation fingerprints preserve JSON identity and refuse lossy authored results", () => {
  assert.deepEqual(operationJson({ z: [null, true], a: 0 }), { a: 0, z: [null, true] });
  assert.deepEqual(operationJson(Object.assign(Object.create(null), { kept: true })), { kept: true });
  for (const value of [undefined, Infinity, NaN, new Date(), Array(2), { missing: undefined }, { toJSON() { return "hidden"; } }]) {
    assert.throws(() => operationJson(value), /not lossless JSON/u);
  }
});

test("PostgreSQL operation receipts fence duplicate effects, uncertainty and erased context", {
  skip: !process.env.HOMA_EVAL_DATABASE_URL,
}, async t => {
  assert(process.env.HOMA_EVAL_DATABASE_URL && process.env.HOMA_EVAL_BLOB_DIR);
  assert(!process.env.VERCEL && process.env.HOMA_EVAL_ALLOW_PROD_WRITES !== "1");
  const sql = mapDb();
  try {
    const [target] = await sql`select current_setting('data_directory') as directory,
      host(inet_server_addr()) as address,current_database() as database,current_user as owner`;
    const root = path.dirname(realpathSync(process.env.HOMA_EVAL_BLOB_DIR));
    assert.match(path.basename(root), /^homa-eval-sandbox-/u);
    assert.equal(realpathSync(target.directory), path.join(root, "data"));
    assert.equal(target.database, "homa_eval"); assert.equal(target.owner, "homa_eval");
    assert([null, "127.0.0.1", "::1"].includes(target.address));

    async function owner(): Promise<ConversationRequestPrincipal> {
      const memberUserId = randomUUID(), familyId = EVAL_FIXTURE_FAMILY_ID;
      await sql`insert into auth.users(id,email) values (${memberUserId},${`${memberUserId}@example.test`})`;
      await sql`insert into public.family_members(family_id,user_id) values (${familyId},${memberUserId})`;
      return { familyId, memberUserId, ...(await readConversationAccess({ familyId, memberUserId })) };
    }
    async function running(principal: ConversationRequestPrincipal, replyToQuestionId?: string) {
      const request = await acceptConversationRequest(principal, { intentId: randomUUID(), text: "Make something helpful", replyToQuestionId });
      const lease = await leaseConversationRequest(principal);
      assert.equal(lease.kind, "leased");
      if (lease.kind !== "leased") throw new Error("Expected isolated fixture lease");
      const execution = { requestId: request.requestId, leaseToken: lease.leaseToken,
        sessionId: `operation-${randomUUID()}`, turnId: "first", sequence: 0 };
      const auth = { authenticator: CONVERSATION_DISPATCH_AUTHENTICATOR, principalId: principal.memberUserId,
        attributes: { channel: CONVERSATION_DISPATCH_CHANNEL, familyId: principal.familyId, memberUserId: principal.memberUserId,
          conversationRequestId: request.requestId, conversationRequestLease: lease.leaseToken,
          conversationRequestAccessEpoch: principal.accessEpoch } };
      await admitConversationRequest({ auth, ...execution, text: lease.text });
      const context = (callId = "call_1", name = "save_example") => ({ session: { id: execution.sessionId,
        turn: { id: execution.turnId }, auth: { current: structuredClone(auth) } }, toolExecution: { callId, name } }) as unknown as ToolContext;
      return { request, execution, context };
    }

    await t.test("same actual tool identity executes once and replays durable output", async () => {
      const principal = await owner(), active = await running(principal);
      const ctx = active.context();
      const prepared = await prepareConversationOperation(ctx, { b: 2, a: 1 }, 45_000);
      let effects = 0;
      const expected = { savedId: randomUUID(), value: ["kept", 0, false] };
      assert.deepEqual(await executeConversationOperation(prepared, () => { effects++; return expected; }), expected);
      const replay = await prepareConversationOperation(ctx, { a: 1, b: 2 }, 45_000);
      assert.equal(replay.id, prepared.id); assert.equal(replay.replayed, true);
      assert.deepEqual(await executeConversationOperation(replay, () => { effects++; return expected; }), expected);
      assert.equal(effects, 1);
      await assert.rejects(prepareConversationOperation(ctx, { a: 2, b: 2 }, 45_000), code("conflict"));
      await assert.rejects(prepareConversationOperation(active.context("call_1", "another_tool"), { a: 1, b: 2 }, 45_000), code("conflict"));
      await finishConversationRequest(principal, active.execution, "completed");
      await assert.rejects(prepareConversationOperation(ctx, { a: 1, b: 2 }, 45_000), code("execution"));
      await assert.rejects(prepareConversationOperation(active.context("new_call"), {}, 45_000), code("execution"));
    });

    await t.test("simultaneous same-call delivery admits one body", async () => {
      const active = await running(await owner());
      const attempts = await Promise.allSettled([prepareConversationOperation(active.context(), {}, 45_000),
        prepareConversationOperation(active.context(), {}, 45_000)]);
      assert.equal(attempts.filter(value => value.status === "fulfilled").length, 1);
      const rejected = attempts.find(value => value.status === "rejected");
      assert(rejected?.status === "rejected" && rejected.reason instanceof ConversationOperationUnknown);
      const [count] = await sql`select count(*)::int as total from public.conversation_operations where request_id=${active.request.requestId}`;
      assert.equal(count.total, 1);
    });

    await t.test("runtime, adult, root lineage, authenticator and lease spoofing deny", async () => {
      const active = await running(await owner()), other = await owner();
      const variants = [
        (ctx: ToolContext) => { Object.assign(ctx.session, { id: "another-runtime" }); },
        (ctx: ToolContext) => { Object.assign(ctx.session.turn, { id: "another-turn" }); },
        (ctx: ToolContext) => { Object.assign(ctx.session.auth.current!, { principalId: other.memberUserId }); },
        (ctx: ToolContext) => { Object.assign(ctx.session.auth.current!, { principalId: other.memberUserId });
          Object.assign(ctx.session.auth.current!.attributes, { memberUserId: other.memberUserId, conversationRequestAccessEpoch: other.accessEpoch }); },
        (ctx: ToolContext) => { Object.assign(ctx.session.auth.current!, { authenticator: "supabase" }); },
        (ctx: ToolContext) => { Object.assign(ctx.session.auth.current!.attributes, { conversationRequestLease: randomUUID() }); },
        (ctx: ToolContext) => { Object.assign(ctx.session, { parent: { rootSessionId: "wrong-root" } }); },
      ];
      for (const change of variants) {
        const ctx = active.context(); change(ctx);
        await assert.rejects(prepareConversationOperation(ctx, {}, 45_000), code("execution"));
      }
      const child = active.context("child-call");
      Object.assign(child.session, { id: `child-${randomUUID()}`, parent: { rootSessionId: active.execution.sessionId } });
      const admitted = await prepareConversationOperation(child, {}, 45_000);
      assert.equal(admitted.requestId, active.request.requestId);
    });

    await t.test("unknown and expired actions block a new call while late completion can settle the same action", async () => {
      const active = await running(await owner());
      const prepared = await prepareConversationOperation(active.context(), {}, 45_000);
      const finish = deferred<{ id: string }>();
      const pending = executeConversationOperation(prepared, () => finish.promise);
      await assert.rejects(withToolDeadline(5, () => pending, false), ToolDeadlineError);
      await sql`update public.conversation_operations set deadline_at=clock_timestamp()-interval '1 second' where id=${prepared.id}`;
      await assert.rejects(prepareConversationOperation(active.context("new-call"), {}, 45_000), ConversationOperationUnknown);
      finish.resolve({ id: "confirmed-original-action" });
      assert.deepEqual(await pending, { id: "confirmed-original-action" });
      assert.equal((await prepareConversationOperation(active.context(), {}, 45_000)).replayed, true);
      const next = await prepareConversationOperation(active.context("new-call"), {}, 45_000);
      await assert.rejects(executeConversationOperation(next, () => { throw new Error("private provider failure"); }), /private provider failure/u);
      await assert.rejects(prepareConversationOperation(active.context("third-call"), {}, 45_000), ConversationOperationUnknown);
      const [unknown] = await sql`select state,result from public.conversation_operations where id=${next.id}`;
      assert.equal(unknown.state, "unknown"); assert.equal(unknown.result, null);
    });

    await t.test("connection and lock wait consume the admission deadline", async () => {
      const principal = await owner(), active = await running(principal), hold = deferred<void>(), entered = deferred<void>();
      const lock = sql.begin(async tx => {
        await tx`select id from public.conversation_records where family_id=${principal.familyId} and member_user_id=${principal.memberUserId} for update`;
        entered.resolve(); await hold.promise;
      });
      await entered.promise;
      const late = assert.rejects(prepareConversationOperation(active.context(), {}, 10), code("execution"));
      await delay(30); hold.resolve(); await lock; await late;
      const [count] = await sql`select count(*)::int as total from public.conversation_operations where request_id=${active.request.requestId}`;
      assert.equal(count.total, 0);
    });

    await t.test("input erasure clears completed receipts and refuses late result writes", async () => {
      const active = await running(await owner());
      const completed = await prepareConversationOperation(active.context("complete"), {}, 45_000);
      await executeConversationOperation(completed, () => ({ private: "saved result" }));
      const prepared = await prepareConversationOperation(active.context("pending"), {}, 45_000), finish = deferred<object>();
      const result = executeConversationOperation(prepared, () => finish.promise);
      const denied = assert.rejects(result, code("execution"));
      await sql`delete from public.conversation_messages where id=${active.request.messageId}`;
      finish.resolve({ private: "late result" }); await denied;
      const rows = await sql`select state,result from public.conversation_operations where request_id=${active.request.requestId}`;
      assert.equal(rows.length, 2); assert(rows.every(row => row.state === "erased" && row.result === null));
      await assert.rejects(prepareConversationOperation(active.context("another"), {}, 45_000), code("execution"));
    });

    await t.test("attachment deletion clears existing receipts and blocks late extracted content", async () => {
      const principal = await owner(), active = await running(principal);
      const [file] = await sql`insert into public.chat_attachments(family_id,member_user_id,url,media_type,kind)
        values (${principal.familyId},${principal.memberUserId},'https://example.test/file.pdf','application/pdf','document') returning id`;
      await sql`insert into public.conversation_attachment_preparations(attachment_id,family_id,member_user_id,blob_url,payload)
        values (${file.id},${principal.familyId},${principal.memberUserId},'https://example.test/file.pdf',${sql.json({ filename: "file.pdf" })})`;
      await sql`insert into public.conversation_request_attachments(request_id,ordinal,original_attachment_id,attachment_id)
        values (${active.request.requestId},0,${file.id},${file.id})`;
      const completed = await prepareConversationOperation(active.context("complete"), {}, 45_000);
      await executeConversationOperation(completed, () => ({ extracted: "old text" }));
      const pending = await prepareConversationOperation(active.context("pending"), {}, 45_000), finish = deferred<object>();
      const denied = assert.rejects(executeConversationOperation(pending, () => finish.promise), code("execution"));
      await sql`delete from public.chat_attachments where id=${file.id}`;
      finish.resolve({ extracted: "late text" }); await denied;
      const rows = await sql`select state,result from public.conversation_operations where request_id=${active.request.requestId}`;
      assert(rows.length === 2 && rows.every(row => row.state === "erased" && row.result === null));
      await assert.rejects(prepareConversationOperation(active.context("another"), {}, 45_000), code("execution"));
    });

    await t.test("erasing a linked question erases answer-operation receipts and prevents resurrection", async () => {
      const principal = await owner(), source = await running(principal);
      const q = await recordConversationQuestion(principal, source.execution, { callId: "card", sourceSequence: 0, stepIndex: 0,
        card: { questions: [{ header: "Plan", question: "Which plan?", multiSelect: false,
          options: [{ label: "Drawing", description: "Draw outside" }, { label: "Reading", description: "Read inside" }] }] } });
      await finishConversationQuestionTurn(principal, source.execution);
      const active = await running(principal, q.id);
      const completed = await prepareConversationOperation(active.context("complete"), {}, 45_000);
      await executeConversationOperation(completed, () => ({ questionContext: "old card" }));
      const pending = await prepareConversationOperation(active.context("pending"), {}, 45_000), finish = deferred<object>();
      const denied = assert.rejects(executeConversationOperation(pending, () => finish.promise), code("execution"));
      await sql`delete from public.conversation_messages where id=${q.messageId}`;
      finish.resolve({ questionContext: "late card copy" }); await denied;
      const rows = await sql`select state,result from public.conversation_operations where request_id=${active.request.requestId}`;
      assert(rows.length === 2 && rows.every(row => row.state === "erased" && row.result === null));
    });

    await t.test("membership removal and rejoin cannot settle old-generation results", async () => {
      const principal = await owner(), active = await running(principal);
      const prepared = await prepareConversationOperation(active.context(), {}, 45_000), finish = deferred<object>();
      const denied = assert.rejects(executeConversationOperation(prepared, () => finish.promise), code("execution"));
      await sql`delete from public.family_members where family_id=${principal.familyId} and user_id=${principal.memberUserId}`;
      await sql`insert into public.family_members(family_id,user_id) values (${principal.familyId},${principal.memberUserId})`;
      finish.resolve({ private: "old-generation result" }); await denied;
      await assert.rejects(prepareConversationOperation(active.context(), {}, 45_000), code("execution"));
      const [row] = await sql`select state,result from public.conversation_operations where id=${prepared.id}`;
      assert.equal(row.state, "unknown"); assert.equal(row.result, null);
    });

    await t.test("canonical erasure and competing admission settle without leaking a deadlock", async () => {
      for (let index = 0; index < 5; index++) {
        const active = await running(await owner());
        const outcomes = await Promise.allSettled([prepareConversationOperation(active.context(), {}, 45_000),
          requestTransaction(tx => tx`delete from public.conversation_messages where id=${active.request.messageId}`)]);
        assert.equal(outcomes[1].status, "fulfilled");
        if (outcomes[0].status === "rejected") assert(code("execution")(outcomes[0].reason));
        const rows = await sql`select state,result from public.conversation_operations where request_id=${active.request.requestId}`;
        assert(rows.every(row => row.state === "erased" && row.result === null));
      }
    });

    await t.test("raw operation payloads are unavailable to browser database roles", async () => {
      await assert.rejects(sql.begin(async tx => {
        await tx`set local role authenticated`;
        await tx`select * from public.conversation_operations`;
      }), /permission denied/u);
    });
  } finally { await sql.end(); }
});
