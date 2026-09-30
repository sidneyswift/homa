import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { persistCanonicalMessage } from "./conversation-continuity/ledger";
import { finishConversationIndexJob, leaseConversationIndexJobs, runConversationIndexing,
  type ConversationIndexDependencies, type ConversationIndexLease } from "./conversation-indexing";
import { EVAL_FIXTURE_FAMILY_ID, EVAL_FIXTURE_PARENT_USER_ID } from "./family-context-eval-fixture";
import { mapDb } from "./map/db";

function lease(content = "The saved assistant reply"): ConversationIndexLease {
  return { messageId: randomUUID(), familyId: randomUUID(), memberUserId: randomUUID(),
    revision: randomUUID(), leaseToken: randomUUID(), content };
}
test("indexer sends exact canonical content with family attribution and finishes only after provider result", async () => {
  const value = lease("  Canonical words\n"), calls: unknown[] = [];
  const outcomes = await runConversationIndexing({ lease: async () => [value],
    embed: async (content, attribution) => { calls.push([content, attribution.familyId]); return "[1]"; },
    finish: async (job, result) => { calls.push([job, result]); return "applied"; } });
  assert.deepEqual(outcomes, ["applied"]);
  assert.deepEqual(calls, [[value.content, value.familyId], [value, { embedding: "[1]", skipped: false }]]);
});
test("hidden directives and empty or very short revisions never reach the provider", async () => {
  const completed: unknown[] = [];
  await runConversationIndexing({ lease: async () => [lease("[[homa:onboarding start]]"), lease("  "), lease("hi")],
    embed: async () => { throw new Error("Private directive must not be embedded"); },
    finish: async (_, result) => { completed.push(result); return "skipped"; } });
  assert.deepEqual(completed, Array(3).fill({ embedding: null, skipped: true }));
});
test("one failed or hanging provider cannot prevent other jobs completing; late results cannot publish", async () => {
  const jobs = [lease("healthy"), lease("failed"), lease("hanging")], completions: unknown[] = [];
  let late!: (value: string) => void;
  let aborted = false;
  const outcomes = await runConversationIndexing({ lease: async () => jobs, deadlineMs: 10,
    embed: async (content, { signal }) => {
      if (content === "healthy") return "[1]";
      if (content === "failed") throw new Error("provider unavailable");
      signal.addEventListener("abort", () => { aborted = true; });
      return new Promise<string>(resolve => { late = resolve; });
    }, finish: async (job, result) => { completions.push([job.content, result.embedding]); return result.embedding ? "applied" : "retry"; } });
  assert.deepEqual(outcomes, ["applied", "retry", "retry"]);
  assert.equal(aborted, true);
  late("[2]");
  await Promise.resolve();
  assert.equal(completions.length, 3);
});
test("an uncertain finish retains retry obligation without retrying a write inside the provider pass", async () => {
  let finishes = 0;
  const deps: ConversationIndexDependencies = { lease: async () => [lease()], embed: async () => "[1]",
    finish: async () => { finishes++; throw new Error("connection lost during commit"); } };
  assert.deepEqual(await runConversationIndexing(deps), ["retry"]);
  assert.equal(finishes, 1);
});

test("PostgreSQL indexing queue preserves revisions, privacy, retry, recovery and deletion", {
  skip: !process.env.HOMA_EVAL_DATABASE_URL,
}, async () => {
  assert(process.env.HOMA_EVAL_DATABASE_URL && process.env.HOMA_EVAL_BLOB_DIR);
  assert(!process.env.VERCEL && process.env.HOMA_EVAL_ALLOW_PROD_WRITES !== "1");
  const sql = mapDb();
  await sql`update public.conversation_rebuild_settings set enabled = true`; // gh#1158: these suites exercise the rebuild itself.
  process.env.HOMA_CONVERSATION_RECORDING ??= "1"; // exact-text recording is part of the rebuild under test.
  try {
    const [target] = await sql`select current_setting('data_directory') as directory,
      host(inet_server_addr()) as address,current_database() as database,current_user as owner`;
    const root = path.dirname(realpathSync(process.env.HOMA_EVAL_BLOB_DIR!));
    assert.match(path.basename(root), /^homa-eval-sandbox-/u);
    assert.equal(realpathSync(target.directory), path.join(root, "data"));
    assert.equal(target.database, "homa_eval");
    assert.equal(target.owner, "homa_eval");
    assert([null, "127.0.0.1", "::1"].includes(target.address));
    const principal = { familyId: EVAL_FIXTURE_FAMILY_ID, memberUserId: EVAL_FIXTURE_PARENT_USER_ID };
    const session = `index-${randomUUID()}`;
    const input = await persistCanonicalMessage({ attributes: principal, sessionId: session, channel: "web",
      sequence: 0, turnId: "turn", role: "user", content: "Please help me plan" });
    assert(input);
    const message = await persistCanonicalMessage({ attributes: principal, sessionId: session, channel: "web",
      sequence: 0, turnId: "turn", role: "assistant", content: "The first draft", terminal: true });
    assert(message);
    // Populate bounded repair once, then isolate only the target jobs as due.
    await leaseConversationIndexJobs(16);
    async function due(id: string) {
      await sql`update public.conversation_index_jobs set next_attempt_at=clock_timestamp()+interval '1 day'`;
      await sql`update public.conversation_index_jobs set state='pending',lease_token=null,lease_until=null,
        next_attempt_at=clock_timestamp()-interval '1 second' where message_id=${id}`;
      const jobs = await leaseConversationIndexJobs(16);
      const current = jobs.find(job => job.messageId === id);
      assert(current);
      return current;
    }
    const vector = `[${Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0).join(",")}]`;
    const first = await due(message.id);
    assert.equal(first.content, "The first draft");
    assert.deepEqual(await Promise.all([leaseConversationIndexJobs(), leaseConversationIndexJobs()]), [[], []]);
    await sql`update public.conversation_index_jobs set lease_until=clock_timestamp()-interval '1 second' where message_id=${message.id}`;
    const reclaimed = (await leaseConversationIndexJobs()).find(job => job.messageId === message.id);
    assert(reclaimed);
    assert.notEqual(reclaimed.leaseToken, first.leaseToken);
    assert.equal(await finishConversationIndexJob(first, { embedding: vector, skipped: false }), "stale");
    assert.equal(await finishConversationIndexJob(reclaimed, { embedding: null, skipped: false }), "retry");
    const [retry] = await sql`select state,attempts,next_attempt_at>clock_timestamp() as backed_off from public.conversation_index_jobs where message_id=${message.id}`;
    assert.equal(retry.state, "pending"); assert.equal(retry.backed_off, true); assert(retry.attempts > 0);
    assert.equal((await leaseConversationIndexJobs()).length, 0);
    const older = await due(message.id);
    await sql`update public.conversation_messages set content='The revised answer' where id=${message.id}`;
    assert.equal(await finishConversationIndexJob(older, { embedding: vector, skipped: false }), "stale");
    const current = await due(message.id);
    assert.notEqual(current.revision, older.revision);
    assert.equal(await finishConversationIndexJob(current, { embedding: vector, skipped: false }), "applied");
    assert.equal(await finishConversationIndexJob(current, { embedding: vector, skipped: false }), "stale");
    assert.equal((await sql`select embedding is not null as indexed from public.conversation_messages where id=${message.id}`)[0].indexed, true);
    // Content changes synchronously remove the stale vector, including ABA text.
    await sql`update public.conversation_messages set content='Elsewhere' where id=${message.id}`;
    await sql`update public.conversation_messages set content='The revised answer' where id=${message.id}`;
    assert.equal((await sql`select embedding from public.conversation_messages where id=${message.id}`)[0].embedding, null);
    assert.equal(await finishConversationIndexJob(current, { embedding: vector, skipped: false }), "stale");
    const foreign = { ...await due(message.id), memberUserId: randomUUID() };
    assert.equal(await finishConversationIndexJob(foreign, { embedding: vector, skipped: false }), "stale");
    // Missing legacy jobs are discovered without needing another conversation.
    await sql`delete from public.conversation_index_jobs where message_id=${message.id}`;
    const recovered = (await leaseConversationIndexJobs(16)).find(job => job.messageId === message.id);
    assert(recovered);
    await sql`delete from public.conversation_messages where id=${message.id}`;
    assert.equal(await finishConversationIndexJob(recovered, { embedding: vector, skipped: false }), "stale");
    assert.equal((await sql`select 1 from public.conversation_index_jobs where message_id=${message.id}`).length, 0);
    await assert.rejects(sql.begin(async tx => {
      await tx`set local role authenticated`;
      await tx`select * from public.conversation_index_jobs`;
    }), /permission denied/);
    const columns = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='conversation_index_jobs'`;
    assert(!columns.some(row => /content|text|embedding/.test(row.column_name)));
    const revoked = await due(input.id);
    await sql`delete from public.family_members where family_id=${principal.familyId} and user_id=${principal.memberUserId}`;
    await sql`insert into public.family_members(family_id,user_id) values(${principal.familyId},${principal.memberUserId})`;
    assert.equal(await finishConversationIndexJob(revoked, { embedding: vector, skipped: false }), "stale");
  } finally { await sql.end(); }
});
