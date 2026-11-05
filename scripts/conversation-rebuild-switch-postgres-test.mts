import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import path from "node:path";

import { persistCanonicalMessage } from "../apps/web/lib/conversation-continuity/ledger";
import { EVAL_FIXTURE_FAMILY_ID } from "../apps/web/lib/family-context-eval-fixture";
import { mapDb } from "../apps/web/lib/map/db";

// gh#1158: the rebuild migrations ship before anyone turns the feature on.
// With the database switch off, the live product's writes must behave exactly
// as before: no rebuild rows, no index jobs, no embedding changes. Then the
// same writes with the switch on must reach the rebuild feed, proving the
// gate (not a broken trigger) is what kept the first half quiet.
assert(process.env.HOMA_EVAL_DATABASE_URL && process.env.HOMA_EVAL_BLOB_DIR);
assert(!process.env.VERCEL && process.env.HOMA_EVAL_ALLOW_PROD_WRITES !== "1");
const sql = mapDb();
try {
  const [target] = await sql`select current_setting('data_directory') as directory, current_database() as database`;
  const root = path.dirname(realpathSync(process.env.HOMA_EVAL_BLOB_DIR));
  assert.match(path.basename(root), /^homa-eval-sandbox-/u);
  assert.equal(realpathSync(target.directory), path.join(root, "data"));
  assert.equal(target.database, "homa_eval");

  async function rebuildRows(memberUserId: string) {
    const [row] = await sql`select
      (select count(*)::int from public.conversation_records where member_user_id = ${memberUserId}) as records,
      (select count(*)::int from public.conversation_feed_changes f join public.conversation_records c on c.id = f.conversation_id
        where c.member_user_id = ${memberUserId}) as feed,
      (select count(*)::int from public.conversation_index_jobs where member_user_id = ${memberUserId}) as index_jobs`;
    return row as { records: number; feed: number; index_jobs: number };
  }

  const [switchRow] = await sql`select enabled from public.conversation_rebuild_settings`;
  assert.equal(switchRow.enabled, false, "the switch ships off");

  const familyId = EVAL_FIXTURE_FAMILY_ID;
  const memberUserId = randomUUID();
  await sql`insert into auth.users(id, email) values (${memberUserId}, ${`${memberUserId}@example.test`})`;
  await sql`insert into public.family_members(family_id, user_id) values (${familyId}, ${memberUserId})`;
  const attributes = { familyId, memberUserId };
  const sessionId = `switch-off-${randomUUID()}`;

  // Ordinary /app traffic: a user message, a draft, its terminal replacement.
  const user = await persistCanonicalMessage({ attributes, sessionId, turnId: "t1", sequence: 0,
    channel: "web", role: "user", content: "Can you make a counting page?" });
  const draft = await persistCanonicalMessage({ attributes, sessionId, turnId: "t1", sequence: 0,
    channel: "web", role: "assistant", content: "On it.", terminal: false });
  assert(user && draft);
  await sql`update public.conversation_messages set embedding = ${`[${Array(1536).fill(0.01).join(",")}]`} where id = ${user.id}`;
  const [before] = await sql`select embedding is not null as embedded, search_revision from public.conversation_messages where id = ${user.id}`;
  await sql`update public.conversation_messages set content = 'Can you make two counting pages?' where id = ${user.id}`;
  const [after] = await sql`select embedding is not null as embedded, search_revision from public.conversation_messages where id = ${user.id}`;
  assert.equal(after.embedded, before.embedded, "switch off: a content edit keeps the existing embedding");
  assert.equal(after.search_revision, before.search_revision, "switch off: search revision does not advance");

  // Materials, attachments and deliveries each carry a rebuild trigger.
  const [material] = await sql`insert into public.materials(family_id, title, html, preview_url, pdf_url, status, generation)
    values (${familyId}, 'Switch-off worksheet', '<p>Count</p>', 'https://example.test/p.png', 'https://example.test/p.pdf', 'final',
      ${sql.json({ sessionId })}) returning id`;
  await sql`update public.materials set title = 'Switch-off worksheet v2' where id = ${material.id}`;
  const [episode] = await sql`select episode_id from public.conversation_messages where id = ${draft.id}`;
  const [delivery] = await sql`insert into public.conversation_deliveries(family_id, episode_id, message_id, recipient_member_user_id, channel, destination_hash, status)
    values (${familyId}, ${episode.episode_id}, ${draft.id}, ${memberUserId}, 'web', ${"a".repeat(64)}, 'pending') returning id`;
  await sql`update public.conversation_deliveries set status = 'sent', sent_at = now() where id = ${delivery.id}`;
  await sql`delete from public.materials where id = ${material.id}`;
  await sql`delete from public.conversation_messages where id = ${draft.id}`;

  assert.deepEqual(await rebuildRows(memberUserId), { records: 0, feed: 0, index_jobs: 0 },
    "switch off: live writes create no rebuild records, feed changes or index jobs");

  // Account-style erasure with the switch off leaves nothing behind.
  await sql`delete from public.conversation_messages where id = ${user.id}`;
  assert.deepEqual(await rebuildRows(memberUserId), { records: 0, feed: 0, index_jobs: 0 },
    "switch off: deleting messages never inserts rebuild records");

  // Positive control: the same kind of write reaches the feed once on.
  await sql`update public.conversation_rebuild_settings set enabled = true`;
  try {
    const on = await persistCanonicalMessage({ attributes, sessionId, turnId: "t2", sequence: 1,
      channel: "web", role: "user", content: "And a shapes page?" });
    assert(on);
    const rows = await rebuildRows(memberUserId);
    assert.equal(rows.records, 1, "switch on: the adult's record is created");
    assert(rows.feed > 0, "switch on: the message reaches the feed");
    assert(rows.index_jobs > 0, "switch on: the message is queued for indexing");
  } finally {
    await sql`update public.conversation_rebuild_settings set enabled = false`;
  }
  console.log("CONVERSATION REBUILD SWITCH CHECKS PASSED");
} finally {
  await sql.end({ timeout: 5 });
}
