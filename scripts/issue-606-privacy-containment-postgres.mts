import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
assert.ok(
  databaseUrl,
  "Issue 606 containment test refused outside the disposable eval sandbox."
);

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = join(
  repositoryRoot,
  "supabase",
  "migrations",
  "20260807040000_conversation_privacy_attribution_containment.sql"
);
const psql = process.env.HOMA_POSTGRES_BIN
  ? join(process.env.HOMA_POSTGRES_BIN, "psql")
  : "psql";
const sql = postgres(databaseUrl, { max: 1 });

const ADULT_A = "60600000-0000-4000-8000-000000000001";
const ADULT_B = "60600000-0000-4000-8000-000000000002";
const FAMILY = "60600000-0000-4000-8000-000000000010";

function applyContainment(): void {
  const result = spawnSync(
    psql,
    [
      "--dbname",
      databaseUrl,
      "-qX",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      migrationPath,
    ],
    {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 30_000,
    }
  );
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    result.stderr || "Issue 606 containment migration failed."
  );
}

await sql.unsafe(
  [
    "insert into auth.users (id) values",
    "  ('60600000-0000-4000-8000-000000000001'),",
    "  ('60600000-0000-4000-8000-000000000002');",
    "",
    "insert into public.families (id, name) values",
    "  ('60600000-0000-4000-8000-000000000010', 'Issue 606 containment fixture');",
    "",
    "insert into public.family_members",
    "  (family_id, user_id, role, display_name)",
    "values",
    "  ('60600000-0000-4000-8000-000000000010',",
    "   '60600000-0000-4000-8000-000000000001', 'parent', 'Adult A fixture'),",
    "  ('60600000-0000-4000-8000-000000000010',",
    "   '60600000-0000-4000-8000-000000000002', 'parent', 'Adult B fixture');",
    "",
    "insert into public.family_memories (family_id, kind, content, source)",
    "values ('60600000-0000-4000-8000-000000000010', 'fact',",
    "  'recallboundary shared distilled memory', 'parent');",
    "",
    "insert into public.conversation_episodes",
    "  (id, family_id, scope, member_user_id, summary, summary_version)",
    "values",
    "  ('60600000-0000-4000-8000-000000000101',",
    "   '60600000-0000-4000-8000-000000000010', 'household',",
    "   '60600000-0000-4000-8000-000000000001', 'safe fixture', 'safe'),",
    "  ('60600000-0000-4000-8000-000000000102',",
    "   '60600000-0000-4000-8000-000000000010', 'member',",
    "   '60600000-0000-4000-8000-000000000001', 'mixed null fixture', 'mixed-null'),",
    "  ('60600000-0000-4000-8000-000000000103',",
    "   '60600000-0000-4000-8000-000000000010', 'member',",
    "   '60600000-0000-4000-8000-000000000001', 'conflicting fixture', 'conflicting'),",
    "  ('60600000-0000-4000-8000-000000000104',",
    "   '60600000-0000-4000-8000-000000000010', 'member',",
    "   '60600000-0000-4000-8000-000000000001', 'null only fixture', 'null-only'),",
    "  ('60600000-0000-4000-8000-000000000105',",
    "   '60600000-0000-4000-8000-000000000010', 'member',",
    "   '60600000-0000-4000-8000-000000000001', 'assistant only fixture',",
    "   'assistant-only'),",
    "  ('60600000-0000-4000-8000-000000000106',",
    "   '60600000-0000-4000-8000-000000000010', 'member',",
    "   '60600000-0000-4000-8000-000000000001', 'message conflict fixture',",
    "   'message-conflict'),",
    "  ('60600000-0000-4000-8000-000000000107',",
    "   '60600000-0000-4000-8000-000000000010', 'member',",
    "   '60600000-0000-4000-8000-000000000001', 'delivery conflict fixture',",
    "   'delivery-conflict');",
  ].join("\n")
);

await sql.unsafe(
  [
    "insert into public.conversation_messages",
    "  (family_id, session_id, sequence, channel, role, content, visibility,",
    "   member_user_id, episode_id)",
    "values",
    "  ('60600000-0000-4000-8000-000000000010', 'issue606-safe', 0, 'web',",
    "   'user', 'safe user one', 'family',",
    "   '60600000-0000-4000-8000-000000000001',",
    "   '60600000-0000-4000-8000-000000000101'),",
    "  ('60600000-0000-4000-8000-000000000010', 'issue606-safe', 1, 'web',",
    "   'user', 'safe user two', 'family',",
    "   '60600000-0000-4000-8000-000000000001',",
    "   '60600000-0000-4000-8000-000000000101'),",
    "  ('60600000-0000-4000-8000-000000000010', 'issue606-safe', 2, 'web',",
    "   'assistant', 'safe assistant', 'family',",
    "   '60600000-0000-4000-8000-000000000001',",
    "   '60600000-0000-4000-8000-000000000101'),",
    "  ('60600000-0000-4000-8000-000000000010', 'issue606-mixed-null', 0,",
    "   'web', 'user', 'known user', 'family',",
    "   '60600000-0000-4000-8000-000000000001',",
    "   '60600000-0000-4000-8000-000000000102'),",
    "  ('60600000-0000-4000-8000-000000000010', 'issue606-mixed-null', 1,",
    "   'web', 'user', 'unknown user', 'family', null,",
    "   '60600000-0000-4000-8000-000000000102'),",
    "  ('60600000-0000-4000-8000-000000000010', 'issue606-mixed-null', 2,",
    "   'web', 'assistant', 'unsafe mixed assistant', 'family',",
    "   '60600000-0000-4000-8000-000000000001',",
    "   '60600000-0000-4000-8000-000000000102'),",
    "  ('60600000-0000-4000-8000-000000000010', 'issue606-conflicting', 0,",
    "   'web', 'user', 'adult a user', 'family',",
    "   '60600000-0000-4000-8000-000000000001',",
    "   '60600000-0000-4000-8000-000000000103'),",
    "  ('60600000-0000-4000-8000-000000000010', 'issue606-conflicting', 1,",
    "   'web', 'user', 'adult b user', 'family',",
    "   '60600000-0000-4000-8000-000000000002',",
    "   '60600000-0000-4000-8000-000000000103'),",
    "  ('60600000-0000-4000-8000-000000000010', 'issue606-conflicting', 2,",
    "   'web', 'assistant', 'unsafe conflicting assistant', 'family',",
    "   '60600000-0000-4000-8000-000000000001',",
    "   '60600000-0000-4000-8000-000000000103'),",
    "  ('60600000-0000-4000-8000-000000000010', 'issue606-null-only', 0,",
    "   'web', 'user', 'unknown only', 'family', null,",
    "   '60600000-0000-4000-8000-000000000104'),",
    "  ('60600000-0000-4000-8000-000000000010', 'issue606-null-only', 1,",
    "   'web', 'assistant', 'unsafe null only assistant', 'family',",
    "   '60600000-0000-4000-8000-000000000001',",
    "   '60600000-0000-4000-8000-000000000104'),",
    "  ('60600000-0000-4000-8000-000000000010', 'issue606-assistant-only', 0,",
    "   'web', 'assistant', 'unsafe assistant only', 'family',",
    "   '60600000-0000-4000-8000-000000000001',",
    "   '60600000-0000-4000-8000-000000000105'),",
    "  ('60600000-0000-4000-8000-000000000010',",
    "   'issue606-message-conflict', 0, 'web', 'user',",
    "   'message conflict user', 'family',",
    "   '60600000-0000-4000-8000-000000000001',",
    "   '60600000-0000-4000-8000-000000000106'),",
    "  ('60600000-0000-4000-8000-000000000010',",
    "   'issue606-message-conflict', 1, 'web', 'assistant',",
    "   'message conflict assistant', 'family',",
    "   '60600000-0000-4000-8000-000000000002',",
    "   '60600000-0000-4000-8000-000000000106'),",
    "  ('60600000-0000-4000-8000-000000000010',",
    "   'issue606-delivery-conflict', 0, 'web', 'user',",
    "   'delivery conflict user', 'family',",
    "   '60600000-0000-4000-8000-000000000001',",
    "   '60600000-0000-4000-8000-000000000107'),",
    "  ('60600000-0000-4000-8000-000000000010',",
    "   'issue606-delivery-conflict', 1, 'web', 'assistant',",
    "   'delivery conflict assistant', 'family',",
    "   '60600000-0000-4000-8000-000000000001',",
    "   '60600000-0000-4000-8000-000000000107');",
    "",
    "insert into public.call_transcripts",
    "  (conversation_id, family_id, member_user_id, line, transcript_text,",
    "   started_at)",
    "values",
    "  ('issue606-historical-assigned',",
    "   '60600000-0000-4000-8000-000000000010',",
    "   '60600000-0000-4000-8000-000000000001', 'general',",
    "   'historical assigned fixture', now() - interval '2 days'),",
    "  ('issue606-historical-null',",
    "   '60600000-0000-4000-8000-000000000010', null, 'general',",
    "   'historical null fixture', now() - interval '1 day');",
    "",
    "insert into public.conversation_deliveries",
    "  (family_id, episode_id, message_id, recipient_member_user_id, channel,",
    "   destination_hash, status, sent_at)",
    "select family_id, episode_id, id,",
    "  '60600000-0000-4000-8000-000000000002', 'web', repeat('6', 64),",
    "  'sent', now()",
    "from public.conversation_messages",
    "where family_id = '60600000-0000-4000-8000-000000000010'",
    "  and session_id = 'issue606-assistant-only'",
    "  and role = 'assistant';",
    "",
    "insert into public.conversation_deliveries",
    "  (family_id, episode_id, message_id, recipient_member_user_id, channel,",
    "   destination_hash, status, sent_at)",
    "select family_id, episode_id, id,",
    "  '60600000-0000-4000-8000-000000000002', 'web', repeat('7', 64),",
    "  'sent', now()",
    "from public.conversation_messages",
    "where family_id = '60600000-0000-4000-8000-000000000010'",
    "  and session_id = 'issue606-delivery-conflict'",
    "  and role = 'assistant';",
  ].join("\n")
);

applyContainment();

const assistants = await sql.unsafe<
  { session_id: string; member_user_id: string | null }[]
>(
  [
    "select session_id, member_user_id::text",
    "from public.conversation_messages",
    "where family_id = '60600000-0000-4000-8000-000000000010'",
    "  and role = 'assistant'",
    "order by session_id",
  ].join("\n")
);
const assistantOwner = new Map(
  assistants.map((message) => [message.session_id, message.member_user_id])
);
assert.equal(assistantOwner.get("issue606-safe"), ADULT_A);
assert.equal(assistantOwner.get("issue606-mixed-null"), null);
assert.equal(assistantOwner.get("issue606-conflicting"), null);
assert.equal(assistantOwner.get("issue606-null-only"), null);
assert.equal(assistantOwner.get("issue606-assistant-only"), null);
assert.equal(assistantOwner.get("issue606-message-conflict"), null);
assert.equal(assistantOwner.get("issue606-delivery-conflict"), ADULT_A);

const episodeRows = await sql.unsafe<
  {
    summary_version: string;
    scope: string;
    member_user_id: string | null;
  }[]
>(
  [
    "select summary_version, scope, member_user_id::text",
    "from public.conversation_episodes",
    "where family_id = '60600000-0000-4000-8000-000000000010'",
    "order by summary_version",
  ].join("\n")
);
assert.ok(episodeRows.every((episode) => episode.scope === "member"));
const episodeOwner = new Map(
  episodeRows.map((episode) => [
    episode.summary_version,
    episode.member_user_id,
  ])
);
assert.equal(episodeOwner.get("safe"), ADULT_A);
assert.equal(episodeOwner.get("mixed-null"), null);
assert.equal(episodeOwner.get("conflicting"), null);
assert.equal(episodeOwner.get("null-only"), null);
assert.equal(episodeOwner.get("assistant-only"), null);
assert.equal(episodeOwner.get("message-conflict"), null);
assert.equal(episodeOwner.get("delivery-conflict"), null);

const calls = await sql.unsafe<
  { conversation_id: string; member_user_id: string | null }[]
>(
  [
    "select conversation_id, member_user_id::text",
    "from public.call_transcripts",
    "where family_id = '60600000-0000-4000-8000-000000000010'",
    "order by conversation_id",
  ].join("\n")
);
assert.deepEqual(Array.from(calls), [
  {
    conversation_id: "issue606-historical-assigned",
    member_user_id: null,
  },
  {
    conversation_id: "issue606-historical-null",
    member_user_id: null,
  },
]);

const userRows = await sql.unsafe<
  { session_id: string; sequence: number; member_user_id: string | null }[]
>(
  [
    "select session_id, sequence, member_user_id::text",
    "from public.conversation_messages",
    "where family_id = '60600000-0000-4000-8000-000000000010'",
    "  and role = 'user'",
    "order by session_id, sequence",
  ].join("\n")
);
assert.equal(userRows.length, 9);
assert.equal(
  userRows.find(
    (row) => row.session_id === "issue606-mixed-null" && row.sequence === 1
  )?.member_user_id,
  null
);
assert.equal(
  userRows.find(
    (row) => row.session_id === "issue606-conflicting" && row.sequence === 1
  )?.member_user_id,
  ADULT_B
);

await sql.unsafe(
  [
    "update public.conversation_messages",
    "set member_user_id = '60600000-0000-4000-8000-000000000001'",
    "where family_id = '60600000-0000-4000-8000-000000000010'",
    "  and session_id = 'issue606-mixed-null'",
    "  and role = 'assistant';",
    "",
    "update public.conversation_episodes",
    "set member_user_id = '60600000-0000-4000-8000-000000000001'",
    "where id = '60600000-0000-4000-8000-000000000102';",
  ].join("\n")
);

async function visibleMessages(
  adultId: typeof ADULT_A | typeof ADULT_B
): Promise<string[]> {
  return await sql.begin(async (transaction) => {
    await transaction.unsafe("set local role authenticated");
    await transaction.unsafe(
      "select set_config('request.jwt.claim.sub', '" + adultId + "', true)"
    );
    const rows = await transaction.unsafe<{ content: string }[]>(
      [
        "select content",
        "from public.conversation_messages",
        "where family_id = '60600000-0000-4000-8000-000000000010'",
        "order by content",
      ].join("\n")
    );
    return Array.from(rows, (row) => row.content);
  });
}

async function visibleEpisodeLabels(
  adultId: typeof ADULT_A | typeof ADULT_B
): Promise<string[]> {
  return await sql.begin(async (transaction) => {
    await transaction.unsafe("set local role authenticated");
    await transaction.unsafe(
      "select set_config('request.jwt.claim.sub', '" + adultId + "', true)"
    );
    const rows = await transaction.unsafe<{ summary_version: string }[]>(
      [
        "select summary_version",
        "from public.conversation_episodes",
        "where family_id = '60600000-0000-4000-8000-000000000010'",
        "order by summary_version",
      ].join("\n")
    );
    return Array.from(rows, (row) => row.summary_version);
  });
}

async function ownershipProofs(
  adultId: typeof ADULT_A | typeof ADULT_B
): Promise<{ session_owned: boolean; episode_owned: boolean }> {
  return await sql.begin(async (transaction) => {
    await transaction.unsafe("set local role authenticated");
    await transaction.unsafe(
      "select set_config('request.jwt.claim.sub', '" + adultId + "', true)"
    );
    const rows = await transaction.unsafe<
      { session_owned: boolean; episode_owned: boolean }[]
    >(
      [
        "select",
        "  public.conversation_session_owned_by_caller(",
        "    '60600000-0000-4000-8000-000000000010', 'issue606-safe'",
        "  ) as session_owned,",
        "  public.conversation_episode_owned_by_caller(",
        "    '60600000-0000-4000-8000-000000000010',",
        "    '60600000-0000-4000-8000-000000000101'",
        "  ) as episode_owned",
      ].join("\n")
    );
    return rows[0]!;
  });
}

const adultAMessages = await visibleMessages(ADULT_A);
assert.ok(adultAMessages.includes("safe assistant"));
assert.ok(adultAMessages.includes("known user"));
assert.ok(!adultAMessages.includes("unsafe mixed assistant"));
assert.ok(!adultAMessages.includes("unsafe assistant only"));

const adultBMessages = await visibleMessages(ADULT_B);
assert.ok(adultBMessages.includes("adult b user"));
assert.ok(adultBMessages.includes("unsafe assistant only"));
assert.ok(!adultBMessages.includes("safe assistant"));
assert.ok(!adultBMessages.includes("unsafe mixed assistant"));

assert.deepEqual(await visibleEpisodeLabels(ADULT_A), ["safe"]);
assert.deepEqual(await visibleEpisodeLabels(ADULT_B), []);
assert.deepEqual(await ownershipProofs(ADULT_A), {
  session_owned: true,
  episode_owned: true,
});

await sql.unsafe(
  [
    "update public.conversation_messages",
    "set content = 'recallboundary safe assistant',",
    "    created_at = now() + interval '1 minute'",
    "where family_id = '60600000-0000-4000-8000-000000000010'",
    "  and session_id = 'issue606-safe' and role = 'assistant';",
    "",
    "update public.conversation_messages",
    "set content = 'recallboundary unsafe mixed assistant',",
    "    created_at = now() + interval '2 minutes'",
    "where family_id = '60600000-0000-4000-8000-000000000010'",
    "  and session_id = 'issue606-mixed-null' and role = 'assistant';",
    "",
    "update public.call_transcripts",
    "set member_user_id = '60600000-0000-4000-8000-000000000001',",
    "    transcript_text = 'maliciously reassigned call boundary',",
    "    started_at = now()",
    "where conversation_id = 'issue606-historical-assigned';",
  ].join("\n")
);

const { recallPinned } = await import("../apps/web/lib/agent-pinned");
const { exportConversationMessagesForAdult, loadAdultSessionReviewMessages } =
  await import("../apps/web/lib/conversation-visibility");
const { PostgresContinuityRepository } = await import(
  "../apps/web/lib/conversation-continuity/postgres-repository"
);
const { extractCallMemories } = await import(
  "../apps/web/lib/learning/call-memory"
);
const { mapDb } = await import("../apps/web/lib/map/db");
const { loadRecentCallsContext } = await import(
  "../apps/web/lib/voice/recent-calls"
);

const exportedForA = await exportConversationMessagesForAdult(sql, {
  familyId: FAMILY,
  memberUserId: ADULT_A,
});
const exportedAContent = exportedForA.map((message) => message.content);
assert.ok(exportedAContent.includes("recallboundary safe assistant"));
assert.ok(exportedAContent.includes("known user"));
assert.ok(!exportedAContent.includes("recallboundary unsafe mixed assistant"));

const mixedReviewForA = await loadAdultSessionReviewMessages(sql, {
  familyId: FAMILY,
  memberUserId: ADULT_A,
  sessionId: "issue606-mixed-null",
  afterSequence: -1,
  limit: 10,
});
assert.deepEqual(
  mixedReviewForA.map((message) => message.content),
  ["known user"]
);

const continuity = new PostgresContinuityRepository();
const safeContinuityForA = await continuity.listEpisodeMessages(
  FAMILY,
  "60600000-0000-4000-8000-000000000101",
  ADULT_A,
  null
);
assert.equal(safeContinuityForA.length, 3);
const mixedContinuityForA = await continuity.listEpisodeMessages(
  FAMILY,
  "60600000-0000-4000-8000-000000000102",
  ADULT_A,
  null
);
assert.deepEqual(
  mixedContinuityForA.map((message) => message.content),
  ["known user"]
);
const deliveredContinuityForB = await continuity.listEpisodeMessages(
  FAMILY,
  "60600000-0000-4000-8000-000000000105",
  ADULT_B,
  null
);
assert.deepEqual(
  deliveredContinuityForB.map((message) => message.content),
  ["unsafe assistant only"]
);

const chatRecallForA = await recallPinned({
  familyId: FAMILY,
  memberUserId: ADULT_A,
  query: "recallboundary",
  scope: "chats",
  limit: 1,
});
assert.equal(chatRecallForA[0]?.snippet, "recallboundary safe assistant");
const deliveredRecallForB = await recallPinned({
  familyId: FAMILY,
  memberUserId: ADULT_B,
  query: "unsafe assistant only",
  scope: "chats",
  limit: 1,
});
assert.equal(deliveredRecallForB[0]?.snippet, "unsafe assistant only");
assert.deepEqual(
  await recallPinned({
    familyId: FAMILY,
    memberUserId: null,
    query: "recallboundary",
    scope: "chats",
    limit: 1,
  }),
  []
);
const sharedRecallWithoutAdult = await recallPinned({
  familyId: FAMILY,
  memberUserId: null,
  query: "recallboundary shared distilled memory",
  scope: "memories",
  limit: 1,
});
assert.equal(
  sharedRecallWithoutAdult[0]?.snippet,
  "recallboundary shared distilled memory"
);

const currentAdultCall = await loadRecentCallsContext({
  familyId: FAMILY,
  memberUserId: ADULT_A,
  timeZone: "UTC",
  sql,
});
assert.match(currentAdultCall, /maliciously reassigned call boundary/u);

await sql.unsafe(
  "delete from public.family_members " +
    "where family_id = '60600000-0000-4000-8000-000000000010' " +
    "and user_id = '60600000-0000-4000-8000-000000000001'"
);

assert.deepEqual(
  await exportConversationMessagesForAdult(sql, {
    familyId: FAMILY,
    memberUserId: ADULT_A,
  }),
  []
);
assert.deepEqual(
  Array.from(
    await loadAdultSessionReviewMessages(sql, {
      familyId: FAMILY,
      memberUserId: ADULT_A,
      sessionId: "issue606-safe",
      afterSequence: -1,
      limit: 10,
    })
  ),
  []
);
assert.deepEqual(
  await continuity.listEpisodeMessages(
    FAMILY,
    "60600000-0000-4000-8000-000000000101",
    ADULT_A,
    null
  ),
  []
);
assert.equal(
  await loadRecentCallsContext({
    familyId: FAMILY,
    memberUserId: ADULT_A,
    timeZone: "UTC",
    sql,
  }),
  ""
);
assert.equal(await extractCallMemories("issue606-historical-assigned"), false);
const removedAdultRecall = await recallPinned({
  familyId: FAMILY,
  memberUserId: ADULT_A,
  query: "recallboundary",
  scope: "all",
  limit: 1,
});
assert.equal(removedAdultRecall[0]?.where, "saved memory");
assert.deepEqual(await visibleMessages(ADULT_A), []);
assert.deepEqual(await visibleEpisodeLabels(ADULT_A), []);
assert.deepEqual(await ownershipProofs(ADULT_A), {
  session_owned: false,
  episode_owned: false,
});
await assert.rejects(
  continuity.createEpisode({
    familyId: FAMILY,
    memberUserId: ADULT_A,
    now: new Date(),
  }),
  /current family membership/u
);

await sql.unsafe(
  [
    "insert into public.family_members",
    "  (family_id, user_id, role, display_name)",
    "values ('60600000-0000-4000-8000-000000000010',",
    "  '60600000-0000-4000-8000-000000000001', 'parent',",
    "  'Adult A fixture restored');",
  ].join("\n")
);

applyContainment();

const replayState = await sql.unsafe<
  { message_owner: string | null; episode_owner: string | null }[]
>(
  [
    "select message.member_user_id::text as message_owner,",
    "  episode.member_user_id::text as episode_owner",
    "from public.conversation_messages message",
    "join public.conversation_episodes episode",
    "  on episode.id = message.episode_id",
    "where message.family_id = '60600000-0000-4000-8000-000000000010'",
    "  and message.session_id = 'issue606-mixed-null'",
    "  and message.role = 'assistant';",
  ].join("\n")
);
assert.deepEqual(Array.from(replayState), [
  { message_owner: null, episode_owner: null },
]);

const replayCallOwner = await sql.unsafe<{ member_user_id: string | null }[]>(
  [
    "select member_user_id::text",
    "from public.call_transcripts",
    "where conversation_id = 'issue606-historical-assigned'",
  ].join("\n")
);
assert.deepEqual(Array.from(replayCallOwner), [{ member_user_id: null }]);

await mapDb().end();
await sql.end();

console.log(
  "Issue 606 containment passed exact-adult RLS and service reads, current-membership revocation, ambiguous ownership nulling, historical call nulling, and idempotent replay."
);
