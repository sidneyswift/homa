import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { updateConversationMessageEmbedding } from "../apps/web/lib/conversation-log";
import { pendingConversationIndexes } from "../apps/web/lib/deferred-conversation-index";
import { mapDb } from "../apps/web/lib/map/db";

test("deferred index SQL isolates families and sessions and rejects stale vectors", async () => {
  assert.equal(process.env.VERCEL, undefined, "local database test only");
  const directory = mkdtempSync(path.join(tmpdir(), "homa-index-postgres-"));
  const bin = process.env.HOMA_POSTGRES_BIN ?? "/opt/homebrew/opt/postgresql@17/bin";
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  let started = false;
  try {
    execFileSync(path.join(bin, "initdb"), ["-D", path.join(directory, "data"), "-U", "homa_index", "--auth=trust", "--no-locale"], { stdio: "pipe", timeout: 30_000 });
    execFileSync(path.join(bin, "pg_ctl"), ["-D", path.join(directory, "data"), "-l", path.join(directory, "postgres.log"), "-o", `-p ${port} -h 127.0.0.1 -k ${directory}`, "-w", "start"], { stdio: "pipe", timeout: 30_000 });
    started = true;
    process.env.HOMA_EVAL_DATABASE_URL = `postgres://homa_index@127.0.0.1:${port}/postgres`;
    const sql = mapDb();
    try {
      // Minimal relational contract, not a substitute for migration tests.
      await sql`create table public.conversation_messages (
        id text primary key, family_id text, session_id text, channel text,
        role text, visibility text, content text, embedding text,
        created_at timestamptz default now()
      )`;
      const base = { family_id: "a", session_id: "s", channel: "web", role: "user", visibility: "family", content: "Saved message", embedding: null };
      const rows = [
        { ...base, id: "eligible" },
        { ...base, id: "other-family", family_id: "b" },
        { ...base, id: "other-session", session_id: "t" },
        { ...base, id: "internal", visibility: "internal" },
        { ...base, id: "assistant", role: "assistant" },
        { ...base, id: "sms", channel: "sms" },
        { ...base, id: "short", content: "ok" },
        { ...base, id: "indexed", embedding: "old-vector" },
      ];
      await sql`insert into public.conversation_messages ${sql(rows)}`;
      assert.deepEqual([...await pendingConversationIndexes({ familyId: "a", sessionId: "s" })], [{ id: "eligible", content: "Saved message" }]);
      const write = { familyId: "b", messageId: "eligible", embedding: "new-vector", sourceContent: "Saved message", replaceExisting: false };
      await updateConversationMessageEmbedding(write);
      await updateConversationMessageEmbedding({ ...write, familyId: "a", sourceContent: "Stale message" });
      assert.equal((await sql`select embedding from public.conversation_messages where id = 'eligible'`)[0].embedding, null);
      await updateConversationMessageEmbedding({ ...write, familyId: "a" });
      await updateConversationMessageEmbedding({ ...write, familyId: "a", embedding: "replayed-vector" });
      assert.equal((await sql`select embedding from public.conversation_messages where id = 'eligible'`)[0].embedding, "new-vector");
      assert.equal((await pendingConversationIndexes({ familyId: "a", sessionId: "s" })).length, 0);
      await sql`insert into public.conversation_messages ${sql(Array.from({ length: 10 }, (_, index) => ({ ...base, id: `batch-${index}` })))}`;
      assert.equal((await pendingConversationIndexes({ familyId: "a", sessionId: "s" })).length, 8);
    } finally {
      await sql.end({ timeout: 2 });
    }
  } finally {
    if (started) execFileSync(path.join(bin, "pg_ctl"), ["-D", path.join(directory, "data"), "-m", "immediate", "-w", "stop"], { stdio: "pipe", timeout: 30_000 });
    rmSync(directory, { recursive: true, force: true });
    delete process.env.HOMA_EVAL_DATABASE_URL;
  }
});
