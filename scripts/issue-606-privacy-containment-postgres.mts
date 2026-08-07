import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
assert.ok(
  databaseUrl,
  "Issue 606 containment test refused outside the disposable eval sandbox.",
);

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = join(
  repositoryRoot,
  "supabase",
  "migrations",
  "20260807040000_conversation_privacy_attribution_containment.sql",
);
const psql = process.env.HOMA_POSTGRES_BIN
  ? join(process.env.HOMA_POSTGRES_BIN, "psql")
  : "psql";
const sql = postgres(databaseUrl, { max: 1 });

const ADULT_A = "60600000-0000-4000-8000-000000000001";
const ADULT_B = "60600000-0000-4000-8000-000000000002";
const FAMILY = "60600000-0000-4000-8000-000000000010";

await sql.unsafe(
  [
    "alter table public.conversation_messages",
    "  disable trigger conversation_guard_message_owner;",
    "alter table public.conversation_messages",
    "  disable trigger conversation_revalidate_user_provenance;",
    "alter table public.conversation_episodes",
    "  disable trigger conversation_guard_episode_owner;",
    "alter table public.call_transcripts",
    "  disable trigger conversation_guard_call_owner;",
  ].join("\n"),
);

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
    },
  );
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    result.stderr || "Issue 606 containment migration failed.",
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
  ].join("\n"),
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
  ].join("\n"),
);

applyContainment();

await sql.unsafe(
  [
    "alter table public.conversation_messages",
    "  enable trigger conversation_guard_message_owner;",
    "alter table public.conversation_messages",
    "  enable trigger conversation_revalidate_user_provenance;",
    "alter table public.conversation_episodes",
    "  enable trigger conversation_guard_episode_owner;",
    "alter table public.call_transcripts",
    "  enable trigger conversation_guard_call_owner;",
  ].join("\n"),
);

const assistants = await sql.unsafe<
  { session_id: string; member_user_id: string | null }[]
>(
  [
    "select session_id, member_user_id::text",
    "from public.conversation_messages",
    "where family_id = '60600000-0000-4000-8000-000000000010'",
    "  and role = 'assistant'",
    "order by session_id",
  ].join("\n"),
);
const assistantOwner = new Map(
  assistants.map((message) => [message.session_id, message.member_user_id]),
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
  ].join("\n"),
);
assert.ok(episodeRows.every((episode) => episode.scope === "member"));
const episodeOwner = new Map(
  episodeRows.map((episode) => [
    episode.summary_version,
    episode.member_user_id,
  ]),
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
  ].join("\n"),
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
  ].join("\n"),
);
assert.equal(userRows.length, 9);
assert.equal(
  userRows.find(
    (row) => row.session_id === "issue606-mixed-null" && row.sequence === 1,
  )?.member_user_id,
  null,
);
assert.equal(
  userRows.find(
    (row) => row.session_id === "issue606-conflicting" && row.sequence === 1,
  )?.member_user_id,
  ADULT_B,
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
  ].join("\n"),
);

const staleOwnershipWrites = await sql.unsafe<
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
    "  and message.role = 'assistant'",
  ].join("\n"),
);
assert.deepEqual(Array.from(staleOwnershipWrites), [
  { message_owner: null, episode_owner: null },
]);

async function visibleMessages(
  adultId: typeof ADULT_A | typeof ADULT_B,
): Promise<string[]> {
  return await sql.begin(async (transaction) => {
    await transaction.unsafe("set local role authenticated");
    await transaction.unsafe(
      "select set_config('request.jwt.claim.sub', '" + adultId + "', true)",
    );
    const rows = await transaction.unsafe<{ content: string }[]>(
      [
        "select content",
        "from public.conversation_messages",
        "where family_id = '60600000-0000-4000-8000-000000000010'",
        "order by content",
      ].join("\n"),
    );
    return Array.from(rows, (row) => row.content);
  });
}

async function visibleEpisodeLabels(
  adultId: typeof ADULT_A | typeof ADULT_B,
): Promise<string[]> {
  return await sql.begin(async (transaction) => {
    await transaction.unsafe("set local role authenticated");
    await transaction.unsafe(
      "select set_config('request.jwt.claim.sub', '" + adultId + "', true)",
    );
    const rows = await transaction.unsafe<{ summary_version: string }[]>(
      [
        "select summary_version",
        "from public.conversation_episodes",
        "where family_id = '60600000-0000-4000-8000-000000000010'",
        "order by summary_version",
      ].join("\n"),
    );
    return Array.from(rows, (row) => row.summary_version);
  });
}

async function ownershipProofs(
  adultId: typeof ADULT_A | typeof ADULT_B,
): Promise<{ session_owned: boolean; episode_owned: boolean }> {
  return await sql.begin(async (transaction) => {
    await transaction.unsafe("set local role authenticated");
    await transaction.unsafe(
      "select set_config('request.jwt.claim.sub', '" + adultId + "', true)",
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
      ].join("\n"),
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
  ].join("\n"),
);

const { recallPinned } = await import("../apps/web/lib/agent-pinned");
const { exportConversationMessagesForAdult, loadAdultSessionReviewMessages } =
  await import("../apps/web/lib/conversation-visibility");
const { PostgresContinuityRepository } = await import(
  "../apps/web/lib/conversation-continuity/postgres-repository"
);
const { hashContinuityKey } = await import(
  "../apps/web/lib/conversation-continuity/continuity-service"
);
const {
  createProactiveEpisode,
  persistCanonicalMessage,
  resolveInboundContinuity,
} = await import("../apps/web/lib/conversation-continuity/ledger");
const {
  acceptedOfferDestinationStillCurrentWithDatabase,
  reserveAcceptedOfferFulfillmentWithDatabase,
} = await import(
  "../apps/web/lib/conversation-continuity/offer-fulfillment"
);
const {
  findCurrentOfferRecoveryRecipient,
  findRecoverableOffers,
} = await import(
  "../apps/web/lib/conversation-continuity/offer-recovery"
);
const { createEveSessionOwnerStore } = await import(
  "../apps/web/lib/conversation-continuity/eve-session-owners"
);
const { webSessionThreadHash } = await import(
  "../apps/web/lib/conversation-continuity/web-session-binding"
);
const { extractCallMemories } = await import(
  "../apps/web/lib/learning/call-memory"
);
const { mapDb } = await import("../apps/web/lib/map/db");
const { createCustomTask } = await import("../apps/web/lib/tasks/custom");
const { insertMaterialRowPinned } = await import(
  "../apps/web/lib/materials/artifact-store"
);
const { default: createTaskTool } = await import(
  "../apps/web/agent/tools/create_task"
);
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
  ["known user"],
);

const continuity = new PostgresContinuityRepository();

const adultBEpisodeId = await continuity.createEpisode({
  familyId: FAMILY,
  memberUserId: ADULT_B,
  now: new Date("2030-01-01T00:00:00.000Z"),
});
const [existingPendingDelivery] = await sql.unsafe<{ id: string }[]>(
  `select id::text from public.conversation_deliveries ` +
    `where family_id = '${FAMILY}' ` +
    `and recipient_member_user_id = '${ADULT_B}' limit 1`,
);
assert.ok(existingPendingDelivery);
const bindingTupleHash = "b".repeat(64);
await continuity.upsertBinding({
  familyId: FAMILY,
  memberUserId: ADULT_B,
  channel: "sms",
  threadKeyHash: bindingTupleHash,
  runtimeSessionId: "issue606-binding-runtime-b",
  episodeId: adultBEpisodeId,
  pendingOfferDeliveryId: existingPendingDelivery.id,
  lastSeenAt: new Date("2030-01-01T00:01:00.000Z"),
});
await continuity.upsertBinding(
  {
    familyId: FAMILY,
    memberUserId: ADULT_A,
    channel: "sms",
    threadKeyHash: bindingTupleHash,
    runtimeSessionId: "issue606-stale-runtime-a",
    episodeId: "60600000-0000-4000-8000-000000000101",
    pendingOfferDeliveryId: null,
    lastSeenAt: new Date("2030-01-01T00:02:00.000Z"),
  },
  { preserveExistingBinding: true },
);
const preservedTuple = await sql.unsafe<
  {
    member_user_id: string | null;
    runtime_session_id: string | null;
    episode_id: string;
    pending_offer_delivery_id: string | null;
  }[]
>(
  `select member_user_id::text, runtime_session_id, episode_id::text, ` +
    `pending_offer_delivery_id::text from public.conversation_thread_bindings ` +
    `where channel = 'sms' and thread_key_hash = '${bindingTupleHash}'`,
);
assert.deepEqual(Array.from(preservedTuple), [
  {
    member_user_id: ADULT_B,
    runtime_session_id: "issue606-binding-runtime-b",
    episode_id: adultBEpisodeId,
    pending_offer_delivery_id: existingPendingDelivery.id,
  },
]);

await continuity.upsertBinding({
  familyId: FAMILY,
  memberUserId: ADULT_A,
  channel: "sms",
  threadKeyHash: bindingTupleHash,
  runtimeSessionId: "issue606-binding-runtime-a",
  episodeId: "60600000-0000-4000-8000-000000000101",
  pendingOfferDeliveryId: existingPendingDelivery.id,
  lastSeenAt: new Date("2030-01-01T00:03:00.000Z"),
});
await continuity.upsertBinding({
  familyId: FAMILY,
  memberUserId: ADULT_B,
  channel: "sms",
  threadKeyHash: bindingTupleHash,
  runtimeSessionId: "issue606-rebound-runtime-b",
  episodeId: adultBEpisodeId,
  pendingOfferDeliveryId: null,
  lastSeenAt: new Date("2030-01-01T00:04:00.000Z"),
});
const reboundTuple = await sql.unsafe<
  {
    member_user_id: string | null;
    runtime_session_id: string | null;
    episode_id: string;
    pending_offer_delivery_id: string | null;
  }[]
>(
  `select member_user_id::text, runtime_session_id, episode_id::text, ` +
    `pending_offer_delivery_id::text from public.conversation_thread_bindings ` +
    `where channel = 'sms' and thread_key_hash = '${bindingTupleHash}'`,
);
assert.deepEqual(Array.from(reboundTuple), [
  {
    member_user_id: ADULT_B,
    runtime_session_id: "issue606-rebound-runtime-b",
    episode_id: adultBEpisodeId,
    pending_offer_delivery_id: null,
  },
]);

await sql.unsafe(
  [
    "insert into public.conversation_episodes",
    "  (id, family_id, scope, member_user_id, summary_version)",
    "values ('60600000-0000-4000-8000-000000000108',",
    "  '60600000-0000-4000-8000-000000000010', 'household',",
    "  '60600000-0000-4000-8000-000000000001', 'guarded-live');",
    "",
    "insert into public.conversation_messages",
    "  (family_id, session_id, sequence, channel, role, content, visibility,",
    "   member_user_id, episode_id)",
    "values ('60600000-0000-4000-8000-000000000010',",
    "  'issue606-guarded-live', 0, 'web', 'user', 'guarded user', 'family',",
    "  '60600000-0000-4000-8000-000000000001',",
    "  '60600000-0000-4000-8000-000000000108');",
    "",
    "update public.conversation_episodes",
    "set member_user_id = '60600000-0000-4000-8000-000000000001',",
    "    scope = 'household'",
    "where id = '60600000-0000-4000-8000-000000000108';",
    "",
    "insert into public.conversation_messages",
    "  (family_id, session_id, sequence, channel, role, content, visibility,",
    "   member_user_id, episode_id)",
    "values",
    "  ('60600000-0000-4000-8000-000000000010',",
    "   'issue606-guarded-live', 1, 'web', 'assistant',",
    "   'guarded safe assistant', 'family',",
    "   '60600000-0000-4000-8000-000000000001',",
    "   '60600000-0000-4000-8000-000000000108'),",
    "  ('60600000-0000-4000-8000-000000000010',",
    "   'issue606-guarded-live', 2, 'web', 'assistant',",
    "   'guarded forged assistant', 'family',",
    "   '60600000-0000-4000-8000-000000000002',",
    "   '60600000-0000-4000-8000-000000000108');",
    "",
    "update public.conversation_messages",
    "set member_user_id = '60600000-0000-4000-8000-000000000001'",
    "where family_id = '60600000-0000-4000-8000-000000000010'",
    "  and session_id = 'issue606-null-only' and role = 'user';",
  ].join("\n"),
);

const guardedWrites = await sql.unsafe<
  {
    content: string;
    member_user_id: string | null;
  }[]
>(
  [
    "select content, member_user_id::text",
    "from public.conversation_messages",
    "where family_id = '60600000-0000-4000-8000-000000000010'",
    "  and (session_id = 'issue606-guarded-live'",
    "       or session_id = 'issue606-null-only')",
    "order by content",
  ].join("\n"),
);
const guardedOwner = new Map(
  guardedWrites.map((message) => [message.content, message.member_user_id]),
);
assert.equal(guardedOwner.get("guarded user"), ADULT_A);
assert.equal(guardedOwner.get("guarded safe assistant"), ADULT_A);
assert.equal(guardedOwner.get("guarded forged assistant"), null);
assert.equal(guardedOwner.get("unknown only"), null);
const guardedEpisode = await sql.unsafe<
  { scope: string; member_user_id: string | null }[]
>(
  "select scope, member_user_id::text from public.conversation_episodes " +
    "where id = '60600000-0000-4000-8000-000000000108'",
);
assert.deepEqual(Array.from(guardedEpisode), [
  { scope: "member", member_user_id: ADULT_A },
]);

const eveOwners = createEveSessionOwnerStore(sql);
const eveBinding = {
  episodeId: "60600000-0000-4000-8000-000000000108",
  threadKeyHash: webSessionThreadHash(ADULT_A),
};
await sql.unsafe(
  [
    "insert into public.conversation_thread_bindings",
    "  (family_id, member_user_id, channel, thread_key_hash,",
    "   runtime_session_id, episode_id)",
    `values ('${FAMILY}', '${ADULT_A}', 'web',`,
    `  '${eveBinding.threadKeyHash}', null, '${eveBinding.episodeId}')`,
  ].join("\n"),
);
assert.equal(
  await eveOwners.provision(
    {
      familyId: FAMILY,
      memberUserId: "60600000-0000-4000-8000-000000000099",
    },
    "issue606-nonmember-token",
  ),
  null,
);
await sql.unsafe(
  [
    "insert into auth.users (id) values",
    "  ('60600000-0000-4000-8000-000000000003');",
    "insert into public.families (id, name, status) values",
    "  ('60600000-0000-4000-8000-000000000020',",
    "   'Issue 606 deleted family fixture', 'deleted');",
    "insert into public.family_members",
    "  (family_id, user_id, role, display_name)",
    "values ('60600000-0000-4000-8000-000000000020',",
    "  '60600000-0000-4000-8000-000000000003', 'parent',",
    "  'Deleted family member');",
  ].join("\n"),
);
assert.equal(
  await eveOwners.provision(
    {
      familyId: "60600000-0000-4000-8000-000000000020",
      memberUserId: "60600000-0000-4000-8000-000000000003",
    },
    "issue606-deleted-family-token",
  ),
  null,
);

const provisionRace = await Promise.all([
  eveOwners.provision(
    { familyId: FAMILY, memberUserId: ADULT_A },
    "issue606-provision-race-a",
  ),
  eveOwners.provision(
    { familyId: FAMILY, memberUserId: ADULT_A },
    "issue606-provision-race-b",
  ),
]);
assert.equal(provisionRace.filter((value) => value !== null).length, 1);
const winningProvisionIndex = provisionRace[0] === null ? 1 : 0;
assert.equal(
  await eveOwners.cancel(
    provisionRace[winningProvisionIndex]!,
    { familyId: FAMILY, memberUserId: ADULT_A },
    winningProvisionIndex === 0
      ? "issue606-provision-race-a"
      : "issue606-provision-race-b",
  ),
  true,
);

const mismatchProvision = await eveOwners.provision(
  { familyId: FAMILY, memberUserId: ADULT_A },
  "issue606-binding-mismatch-provisional",
);
assert.ok(mismatchProvision);
const mismatchOwner = {
  sessionId: "issue606-eve-binding-mismatch",
  familyId: FAMILY,
  memberUserId: ADULT_A,
};
assert.equal(
  await eveOwners.activate(
    mismatchProvision,
    mismatchOwner,
    "issue606-binding-mismatch-provisional",
    "issue606-binding-mismatch-stable",
    { ...eveBinding, episodeId: "60600000-0000-4000-8000-000000000101" },
  ),
  false,
);
assert.equal(await eveOwners.owns(mismatchOwner), false);
assert.equal(
  await eveOwners.cancel(
    mismatchProvision,
    { familyId: FAMILY, memberUserId: ADULT_A },
    "issue606-binding-mismatch-provisional",
  ),
  true,
);

const ownerProvision = await eveOwners.provision(
  { familyId: FAMILY, memberUserId: ADULT_A },
  "issue606-owner-provisional",
);
assert.ok(ownerProvision);
const eveOwner = {
  sessionId: "issue606-eve-session-a",
  familyId: FAMILY,
  memberUserId: ADULT_A,
};
assert.equal(
  await eveOwners.activate(
    ownerProvision,
    eveOwner,
    "issue606-owner-provisional",
    "issue606-owner-stable-token",
    eveBinding,
  ),
  true,
);
assert.equal(await eveOwners.owns(eveOwner), true);
const activatedBinding = await sql.unsafe<
  { runtime_session_id: string | null }[]
>(
  `select runtime_session_id from public.conversation_thread_bindings ` +
    `where family_id = '${FAMILY}' and member_user_id = '${ADULT_A}' ` +
    `and channel = 'web' and thread_key_hash = '${eveBinding.threadKeyHash}'`,
);
assert.deepEqual(Array.from(activatedBinding), [
  { runtime_session_id: eveOwner.sessionId },
]);
const storedOwnerSecrets = await sql.unsafe<
  {
    continuation_token_hash: string;
    continuation_reservation_hash: string | null;
  }[]
>(
  `select continuation_token_hash, continuation_reservation_hash ` +
    `from public.eve_web_session_owners where session_id = '${eveOwner.sessionId}'`,
);
assert.match(storedOwnerSecrets[0]!.continuation_token_hash, /^[0-9a-f]{64}$/u);
assert.doesNotMatch(
  JSON.stringify(storedOwnerSecrets),
  /issue606-owner-(?:provisional|stable-token)/u,
);

const continuationRace = await Promise.all([
  eveOwners.reserveContinuation(
    eveOwner,
    "issue606-owner-stable-token",
    "issue606-reservation-a",
  ),
  eveOwners.reserveContinuation(
    eveOwner,
    "issue606-owner-stable-token",
    "issue606-reservation-b",
  ),
]);
assert.equal(continuationRace.filter(Boolean).length, 1);
const winningReservation = continuationRace[0]
  ? "issue606-reservation-a"
  : "issue606-reservation-b";
assert.equal(
  await eveOwners.restoreContinuation(eveOwner, winningReservation),
  true,
);
assert.equal(
  await eveOwners.reserveContinuation(
    eveOwner,
    "issue606-owner-stable-token",
    "issue606-reservation-after-restore",
  ),
  true,
);
assert.equal(
  await eveOwners.completeContinuation(
    eveOwner,
    "issue606-reservation-after-restore",
    "issue606-owner-stable-token",
  ),
  true,
);
assert.equal(
  await eveOwners.reserveContinuation(
    eveOwner,
    "issue606-owner-stable-token",
    "issue606-ambiguous-reservation",
  ),
  true,
);
assert.equal(
  await eveOwners.revokeContinuation(
    eveOwner,
    "issue606-ambiguous-reservation",
  ),
  true,
);
assert.equal(await eveOwners.owns(eveOwner), false);

const removalOwnerProvision = await eveOwners.provision(
  { familyId: FAMILY, memberUserId: ADULT_A },
  "issue606-removal-owner-provisional",
);
assert.ok(removalOwnerProvision);
const eveOwnerForRemoval = {
  sessionId: "issue606-eve-session-removal",
  familyId: FAMILY,
  memberUserId: ADULT_A,
};
assert.equal(
  await eveOwners.activate(
    removalOwnerProvision,
    eveOwnerForRemoval,
    "issue606-removal-owner-provisional",
    "issue606-removal-owner-stable",
    eveBinding,
  ),
  true,
);

const reassignedDestination = "+15555550123";
const reassignedDestinationHash = hashContinuityKey(
  `sms:${reassignedDestination}`,
);
const offerRows = await sql.unsafe<
  { delivery_id: string; message_id: string }[]
>(
  [
    "with message as (",
    "  select id, episode_id",
    "  from public.conversation_messages",
    "  where family_id = '60600000-0000-4000-8000-000000000010'",
    "    and session_id = 'issue606-safe' and role = 'assistant'",
    "), delivery as (",
    "  insert into public.conversation_deliveries",
    "    (family_id, episode_id, message_id, recipient_member_user_id,",
    "     channel, destination_hash, status, sent_at)",
    "  select '60600000-0000-4000-8000-000000000010', episode_id, id,",
    "    '60600000-0000-4000-8000-000000000001', 'sms',",
    `    '${reassignedDestinationHash}', 'sent', '2030-01-01T00:00:00Z'`,
    "  from message",
    "  returning id, message_id, episode_id",
    "), loop as (",
    "  insert into public.conversation_open_loops",
    "    (family_id, episode_id, message_id, delivery_id, kind, expires_at)",
    "  select '60600000-0000-4000-8000-000000000010', episode_id,",
    "    message_id, id, 'yes_no', '2030-01-02T00:00:00Z'",
    "  from delivery",
    ")",
    "select id::text as delivery_id, message_id::text from delivery",
  ].join("\n"),
);
const reassignedOffer = offerRows[0]!;
const candidatesForB = await continuity.listPendingDeliveries({
  familyId: FAMILY,
  memberUserId: ADULT_B,
  destinationHash: reassignedDestinationHash,
  now: new Date("2030-01-01T00:05:00.000Z"),
});
assert.deepEqual(candidatesForB, []);

const reassignedTurn = await resolveInboundContinuity({
  familyId: FAMILY,
  memberUserId: ADULT_B,
  channel: "sms",
  transportThreadKey: "telnyx:homa:reassigned-phone",
  runtimeSessionId: "issue606-reassigned-phone-b",
  providerMessageId: "issue606-reassigned-phone-inbound",
  providerReplyTo: null,
  destinationKey: reassignedDestination,
  text: "Yes",
  now: new Date("2030-01-01T00:05:00.000Z"),
});
assert.equal(reassignedTurn.resolution, "none");
assert.equal(reassignedTurn.replyToMessageId, null);
assert.equal(reassignedTurn.repliedDeliveryId, null);
assert.doesNotMatch(reassignedTurn.contextMarkdown, /safe assistant/u);
assert.notEqual(
  reassignedTurn.episodeId,
  "60600000-0000-4000-8000-000000000101",
);

const forgedClaim = await persistCanonicalMessage({
  attributes: {
    familyId: FAMILY,
    memberUserId: ADULT_B,
    episodeId: reassignedTurn.episodeId,
    continuityThreadHash: reassignedTurn.threadKeyHash,
    repliedDeliveryId: reassignedOffer.delivery_id,
    replyToMessageId: reassignedOffer.message_id,
    resolvedOutcome: "accepted",
    resolutionMethod: "bounded_polarity",
    replyClassifierVersion: "reply-intent-v3",
  },
  sessionId: "issue606-reassigned-phone-b",
  channel: "sms",
  sequence: 0,
  role: "user",
  content: "Yes",
  turnId: "issue606-reassigned-phone-turn",
  providerMessageId: "issue606-reassigned-phone-inbound",
});
assert.equal(forgedClaim?.replyClaimed, false);
const unchangedOffer = await sql.unsafe<
  { replied_at: string | null; state: string }[]
>(
  [
    "select delivery.replied_at::text, loop.state",
    "from public.conversation_deliveries delivery",
    "join public.conversation_open_loops loop on loop.delivery_id = delivery.id",
    `where delivery.id = '${reassignedOffer.delivery_id}'`,
  ].join("\n"),
);
assert.deepEqual(Array.from(unchangedOffer), [
  { replied_at: null, state: "open" },
]);

const legacyMismatchRunId = "60600000-0000-4000-8000-000000000201";
const legacyMismatchDeliveryId =
  "60600000-0000-4000-8000-000000000301";
const legacyMismatchReferenceId =
  "60600000-0000-4000-8000-000000000401";
const [legacyMismatchMessages] = await sql<
  {
    assistant_message_id: string;
    resolver_message_id: string;
  }[]
>`
  select
    max(id::text) filter (where role = 'assistant') as assistant_message_id,
    max(id::text) filter (
      where role = 'user' and member_user_id = ${ADULT_B}
    ) as resolver_message_id
  from public.conversation_messages
  where family_id = ${FAMILY}
    and session_id = 'issue606-conflicting'
    and episode_id = '60600000-0000-4000-8000-000000000103'
`;
assert.ok(legacyMismatchMessages?.assistant_message_id);
assert.ok(legacyMismatchMessages.resolver_message_id);
await sql`
  insert into public.homa_task_runs (id, family_id, kind, title, status)
  values (
    ${legacyMismatchRunId}, ${FAMILY}, 'morning_brief',
    'Legacy mismatched resolver fixture', 'done'
  )
`;
await sql`
  insert into public.conversation_deliveries (
    id,
    family_id,
    episode_id,
    message_id,
    task_run_id,
    recipient_member_user_id,
    channel,
    destination_hash,
    status,
    sent_at
  )
  values (
    ${legacyMismatchDeliveryId},
    ${FAMILY},
    '60600000-0000-4000-8000-000000000103',
    ${legacyMismatchMessages.assistant_message_id},
    ${legacyMismatchRunId},
    ${ADULT_A},
    'sms',
    ${"8".repeat(64)},
    'sent',
    now() - interval '35 minutes'
  )
`;
await sql`
  insert into public.conversation_open_loops (
    family_id,
    episode_id,
    message_id,
    delivery_id,
    kind,
    state,
    expires_at,
    resolved_at,
    resolved_by_message_id,
    resolved_outcome
  )
  values (
    ${FAMILY},
    '60600000-0000-4000-8000-000000000103',
    ${legacyMismatchMessages.assistant_message_id},
    ${legacyMismatchDeliveryId},
    'yes_no',
    'resolved',
    now() + interval '23 hours',
    now() - interval '30 minutes',
    ${legacyMismatchMessages.resolver_message_id},
    'accepted'
  )
`;

const recoverableAfterLegacyMismatch = await findRecoverableOffers(
  sql,
  new Date(),
);
assert.equal(
  recoverableAfterLegacyMismatch.some(
    (offer) => offer.sourceDeliveryId === legacyMismatchDeliveryId,
  ),
  false,
);
assert.equal(
  await findCurrentOfferRecoveryRecipient(
    {
      familyId: FAMILY,
      sourceDeliveryId: legacyMismatchDeliveryId,
    },
    sql,
  ),
  null,
);
assert.deepEqual(
  await reserveAcceptedOfferFulfillmentWithDatabase(sql, {
    familyId: FAMILY,
    sourceDeliveryId: legacyMismatchDeliveryId,
    expectedRecipientMemberUserId: ADULT_A,
    kind: "material",
    referenceId: legacyMismatchReferenceId,
  }),
  {
    eligible: false,
    wrote: false,
    referenceId: null,
    recipientMemberUserId: null,
  },
);
const [legacyMismatchFulfillment] = await sql<{ count: number }[]>`
  select count(*)::int as count
  from public.conversation_offer_fulfillments
  where source_delivery_id = ${legacyMismatchDeliveryId}
`;
assert.equal(legacyMismatchFulfillment?.count, 0);

const safeContinuityForA = await continuity.listEpisodeMessages(
  FAMILY,
  "60600000-0000-4000-8000-000000000101",
  ADULT_A,
  null,
);
assert.equal(safeContinuityForA.length, 3);
const mixedContinuityForA = await continuity.listEpisodeMessages(
  FAMILY,
  "60600000-0000-4000-8000-000000000102",
  ADULT_A,
  null,
);
assert.deepEqual(
  mixedContinuityForA.map((message) => message.content),
  ["known user"],
);
const deliveredContinuityForB = await continuity.listEpisodeMessages(
  FAMILY,
  "60600000-0000-4000-8000-000000000105",
  ADULT_B,
  null,
);
assert.deepEqual(
  deliveredContinuityForB.map((message) => message.content),
  ["unsafe assistant only"],
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
  [],
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
  "recallboundary shared distilled memory",
);

const currentAdultCall = await loadRecentCallsContext({
  familyId: FAMILY,
  memberUserId: ADULT_A,
  timeZone: "UTC",
  sql,
});
assert.equal(currentAdultCall, "");
const reassignedCallOwner = await sql.unsafe<
  { member_user_id: string | null }[]
>(
  "select member_user_id::text from public.call_transcripts " +
    "where conversation_id = 'issue606-historical-assigned'",
);
assert.deepEqual(Array.from(reassignedCallOwner), [{ member_user_id: null }]);

const taskRaceRunId = "60600000-0000-4000-8000-000000000202";
const taskRaceDeliveryId = "60600000-0000-4000-8000-000000000302";
const taskRaceScheduleId = "60600000-0000-4000-8000-000000000402";
const taskRaceEpisodeId = await createProactiveEpisode({
  familyId: FAMILY,
  memberUserId: ADULT_A,
});
const taskRaceOfferMessage = await persistCanonicalMessage({
  attributes: {
    familyId: FAMILY,
    memberUserId: ADULT_A,
    episodeId: taskRaceEpisodeId,
  },
  sessionId: "issue606-task-race-offer",
  channel: "dispatch",
  sequence: 0,
  role: "assistant",
  content: "Want me to schedule the private accepted task?",
  turnId: "issue606-task-race-offer-turn",
});
assert.ok(taskRaceOfferMessage);
assert.equal(taskRaceOfferMessage.episodeId, taskRaceEpisodeId);
await sql`
  insert into public.homa_task_runs (id, family_id, kind, title, status)
  values (
    ${taskRaceRunId}, ${FAMILY}, 'morning_brief',
    'Task reservation race fixture', 'done'
  )
`;
await sql`
  insert into public.conversation_deliveries (
    id,
    family_id,
    episode_id,
    message_id,
    task_run_id,
    recipient_member_user_id,
    channel,
    destination_hash,
    status,
    sent_at
  )
  values (
    ${taskRaceDeliveryId}, ${FAMILY}, ${taskRaceEpisodeId},
    ${taskRaceOfferMessage.id}, ${taskRaceRunId}, ${ADULT_A}, 'sms',
    ${"9".repeat(64)}, 'sent', now()
  )
`;
await sql`
  insert into public.conversation_open_loops (
    family_id,
    episode_id,
    message_id,
    delivery_id,
    kind,
    state,
    expires_at
  )
  values (
    ${FAMILY}, ${taskRaceEpisodeId}, ${taskRaceOfferMessage.id},
    ${taskRaceDeliveryId}, 'yes_no', 'open', now() + interval '24 hours'
  )
`;
const taskRaceResolverMessage = await persistCanonicalMessage({
  attributes: {
    familyId: FAMILY,
    memberUserId: ADULT_A,
    episodeId: taskRaceEpisodeId,
  },
  sessionId: "issue606-task-race-resolver",
  channel: "web",
  sequence: 0,
  role: "user",
  content: "Yes",
  turnId: "issue606-task-race-resolver-turn",
});
assert.ok(taskRaceResolverMessage);
assert.equal(taskRaceResolverMessage.episodeId, taskRaceEpisodeId);
await sql`
  update public.conversation_open_loops
  set state = 'resolved',
      resolved_at = now(),
      resolved_by_message_id = ${taskRaceResolverMessage.id},
      resolved_outcome = 'accepted'
  where delivery_id = ${taskRaceDeliveryId}
`;
assert.deepEqual(
  await reserveAcceptedOfferFulfillmentWithDatabase(sql, {
    familyId: FAMILY,
    sourceDeliveryId: taskRaceDeliveryId,
    expectedRecipientMemberUserId: ADULT_A,
    kind: "task",
    referenceId: taskRaceScheduleId,
  }),
  {
    eligible: true,
    wrote: true,
    referenceId: taskRaceScheduleId,
    recipientMemberUserId: ADULT_A,
  },
);
const [taskRaceEpisodeAlignment] = await sql<
  {
    message_episode_id: string;
    delivery_episode_id: string;
    episode_owner: string | null;
  }[]
>`
  select
    message.episode_id::text as message_episode_id,
    delivery.episode_id::text as delivery_episode_id,
    episode.member_user_id::text as episode_owner
  from public.conversation_deliveries delivery
  join public.conversation_messages message on message.id = delivery.message_id
  join public.conversation_episodes episode on episode.id = delivery.episode_id
  where delivery.id = ${taskRaceDeliveryId}
`;
assert.deepEqual(taskRaceEpisodeAlignment, {
  message_episode_id: taskRaceEpisodeId,
  delivery_episode_id: taskRaceEpisodeId,
  episode_owner: ADULT_A,
});
await sql`update public.families set time_zone = 'UTC' where id = ${FAMILY}`;

type ExecutableCreateTaskTool = {
  execute(input: unknown, context: unknown): Promise<{
    created: boolean;
    taskId?: string;
    note?: string;
  }>;
};
const executeCreateTask = async (
  attributes: Record<string, unknown>,
  label: string,
) =>
  await (createTaskTool as unknown as ExecutableCreateTaskTool).execute(
    {
      label,
      prompt: "Send the exact private accepted task only to its adult.",
      weekdays: [1],
      localHour: 9,
      deliveryPref: "email",
    },
    {
      channel: { kind: "channel:dispatch", metadata: {} },
      session: {
        id: `issue606-${label}`,
        turn: { id: `issue606-${label}-turn` },
        auth: { current: { attributes } },
      },
    },
  );

const ordinaryDispatchCreate = await executeCreateTask(
  {
    channel: "dispatch",
    familyId: FAMILY,
    memberUserId: ADULT_A,
  },
  "Ordinary dispatch blocked",
);
assert.equal(ordinaryDispatchCreate.created, false);
assert.match(ordinaryDispatchCreate.note ?? "", /Automated runs cannot/u);
const recurringSourceDispatchCreate = await executeCreateTask(
  {
    channel: "dispatch",
    familyId: FAMILY,
    memberUserId: ADULT_A,
    taskRunId: taskRaceRunId,
    acceptedOfferDeliveryId: taskRaceDeliveryId,
  },
  "Recurring source dispatch blocked",
);
assert.equal(recurringSourceDispatchCreate.created, false);
assert.match(
  recurringSourceDispatchCreate.note ?? "",
  /Automated runs cannot/u,
);

const positiveRecoveryRunId = "60600000-0000-4000-8000-000000000203";
const positiveRecoveryDeliveryId =
  "60600000-0000-4000-8000-000000000303";
await sql`
  insert into public.homa_task_runs (id, family_id, kind, title, status)
  values (
    ${positiveRecoveryRunId}, ${FAMILY}, 'morning_brief',
    'Positive task recovery fixture', 'done'
  )
`;
await sql`
  insert into public.conversation_deliveries (
    id,
    family_id,
    episode_id,
    message_id,
    task_run_id,
    recipient_member_user_id,
    channel,
    destination_hash,
    status,
    sent_at
  )
  values (
    ${positiveRecoveryDeliveryId}, ${FAMILY}, ${taskRaceEpisodeId},
    ${taskRaceOfferMessage.id}, ${positiveRecoveryRunId}, ${ADULT_A}, 'sms',
    ${"a".repeat(64)}, 'sent', now()
  )
`;
await sql`
  insert into public.conversation_open_loops (
    family_id,
    episode_id,
    message_id,
    delivery_id,
    kind,
    state,
    expires_at,
    resolved_at,
    resolved_by_message_id,
    resolved_outcome
  )
  values (
    ${FAMILY}, ${taskRaceEpisodeId}, ${taskRaceOfferMessage.id},
    ${positiveRecoveryDeliveryId}, 'yes_no', 'resolved',
    now() + interval '24 hours', now(), ${taskRaceResolverMessage.id},
    'accepted'
  )
`;
const positiveRecoveryCreate = await executeCreateTask(
  {
    channel: "dispatch",
    familyId: FAMILY,
    memberUserId: ADULT_A,
    acceptedOfferDeliveryId: positiveRecoveryDeliveryId,
    offerRecovery: "true",
  },
  "Accepted offer recovered",
);
assert.equal(positiveRecoveryCreate.created, true);
assert.ok(positiveRecoveryCreate.taskId);
const [positiveRecoveryTask] = await sql<
  {
    recipient_member_user_id: string | null;
    source_offer_delivery_id: string | null;
  }[]
>`
  select
    recipient_member_user_id::text,
    source_offer_delivery_id::text
  from public.agent_schedules
  where id = ${positiveRecoveryCreate.taskId}
`;
assert.deepEqual(positiveRecoveryTask, {
  recipient_member_user_id: ADULT_A,
  source_offer_delivery_id: positiveRecoveryDeliveryId,
});

const materialRaceRunId = "60600000-0000-4000-8000-000000000204";
const materialRaceDeliveryId =
  "60600000-0000-4000-8000-000000000304";
const materialRaceId = "60600000-0000-4000-8000-000000000403";
await sql`
  insert into public.homa_task_runs (id, family_id, kind, title, status)
  values (
    ${materialRaceRunId}, ${FAMILY}, 'morning_brief',
    'Review-null material race fixture', 'done'
  )
`;
await sql`
  insert into public.conversation_deliveries (
    id,
    family_id,
    episode_id,
    message_id,
    task_run_id,
    recipient_member_user_id,
    channel,
    destination_hash,
    status,
    sent_at
  )
  values (
    ${materialRaceDeliveryId}, ${FAMILY}, ${taskRaceEpisodeId},
    ${taskRaceOfferMessage.id}, ${materialRaceRunId}, ${ADULT_A}, 'sms',
    ${"b".repeat(64)}, 'sent', now()
  )
`;
await sql`
  insert into public.conversation_open_loops (
    family_id,
    episode_id,
    message_id,
    delivery_id,
    kind,
    state,
    expires_at,
    resolved_at,
    resolved_by_message_id,
    resolved_outcome
  )
  values (
    ${FAMILY}, ${taskRaceEpisodeId}, ${taskRaceOfferMessage.id},
    ${materialRaceDeliveryId}, 'yes_no', 'resolved',
    now() + interval '24 hours', now(), ${taskRaceResolverMessage.id},
    'accepted'
  )
`;
assert.deepEqual(
  await reserveAcceptedOfferFulfillmentWithDatabase(sql, {
    familyId: FAMILY,
    sourceDeliveryId: materialRaceDeliveryId,
    expectedRecipientMemberUserId: ADULT_A,
    kind: "material",
    referenceId: materialRaceId,
  }),
  {
    eligible: true,
    wrote: true,
    referenceId: materialRaceId,
    recipientMemberUserId: ADULT_A,
  },
);

const acceptedOfferPhone = "+15555550124";
const acceptedOfferOldEmail = "issue606-a-old@example.test";
const acceptedOfferNewEmail = "issue606-a-new@example.test";
await sql`
  update auth.users
  set email = ${acceptedOfferOldEmail}
  where id = ${ADULT_A}
`;
await sql`
  insert into public.family_phones (
    family_id,
    phone_e164,
    added_by,
    member_user_id,
    source
  )
  values (
    ${FAMILY}, ${acceptedOfferPhone}, ${ADULT_A}, ${ADULT_A}, 'home'
  )
`;
assert.equal(
  await acceptedOfferDestinationStillCurrentWithDatabase(sql, {
    familyId: FAMILY,
    sourceDeliveryId: materialRaceDeliveryId,
    expectedRecipientMemberUserId: ADULT_A,
    channel: "sms",
    destination: acceptedOfferPhone,
  }),
  true,
);
await sql`
  update public.family_phones
  set member_user_id = ${ADULT_B}
  where phone_e164 = ${acceptedOfferPhone}
`;
assert.equal(
  await acceptedOfferDestinationStillCurrentWithDatabase(sql, {
    familyId: FAMILY,
    sourceDeliveryId: materialRaceDeliveryId,
    expectedRecipientMemberUserId: ADULT_A,
    channel: "sms",
    destination: acceptedOfferPhone,
  }),
  false,
);
await sql`
  update public.family_phones
  set member_user_id = ${ADULT_A}
  where phone_e164 = ${acceptedOfferPhone}
`;
assert.equal(
  await acceptedOfferDestinationStillCurrentWithDatabase(sql, {
    familyId: FAMILY,
    sourceDeliveryId: materialRaceDeliveryId,
    expectedRecipientMemberUserId: ADULT_A,
    channel: "email",
    destination: acceptedOfferOldEmail.toUpperCase(),
  }),
  true,
);
await sql`
  update auth.users
  set email = ${acceptedOfferNewEmail}
  where id = ${ADULT_A}
`;
assert.equal(
  await acceptedOfferDestinationStillCurrentWithDatabase(sql, {
    familyId: FAMILY,
    sourceDeliveryId: materialRaceDeliveryId,
    expectedRecipientMemberUserId: ADULT_A,
    channel: "email",
    destination: acceptedOfferOldEmail,
  }),
  false,
);
assert.equal(
  await acceptedOfferDestinationStillCurrentWithDatabase(sql, {
    familyId: FAMILY,
    sourceDeliveryId: materialRaceDeliveryId,
    expectedRecipientMemberUserId: ADULT_A,
    channel: "email",
    destination: acceptedOfferNewEmail,
  }),
  true,
);

const removedMemberProvision = await eveOwners.provision(
  { familyId: FAMILY, memberUserId: ADULT_A },
  "issue606-membership-removal-provisional",
);
assert.ok(removedMemberProvision);

await sql.unsafe(
  "delete from public.family_members " +
    "where family_id = '60600000-0000-4000-8000-000000000010' " +
    "and user_id = '60600000-0000-4000-8000-000000000001'",
);

assert.equal(
  await acceptedOfferDestinationStillCurrentWithDatabase(sql, {
    familyId: FAMILY,
    sourceDeliveryId: materialRaceDeliveryId,
    expectedRecipientMemberUserId: ADULT_A,
    channel: "sms",
    destination: acceptedOfferPhone,
  }),
  false,
);
assert.equal(
  await acceptedOfferDestinationStillCurrentWithDatabase(sql, {
    familyId: FAMILY,
    sourceDeliveryId: materialRaceDeliveryId,
    expectedRecipientMemberUserId: ADULT_A,
    channel: "email",
    destination: acceptedOfferNewEmail,
  }),
  false,
);

assert.equal(
  await eveOwners.activate(
    removedMemberProvision,
    {
      sessionId: "issue606-eve-session-after-removal",
      familyId: FAMILY,
      memberUserId: ADULT_A,
    },
    "issue606-membership-removal-provisional",
    "issue606-membership-removal-stable",
    eveBinding,
  ),
  false,
);
assert.equal(await eveOwners.owns(eveOwnerForRemoval), false);
const removedOwnerRows = await sql.unsafe<{ count: string }[]>(
  `select count(*)::text from public.eve_web_session_owners ` +
    `where family_id = '${FAMILY}' and member_user_id = '${ADULT_A}'`,
);
assert.deepEqual(Array.from(removedOwnerRows), [{ count: "0" }]);

assert.deepEqual(
  await createCustomTask(
    FAMILY,
    {
      label: "Private accepted task",
      prompt: "Send the exact private accepted task only to its adult.",
      weekdays: [1],
      localHour: 9,
      deliveryPref: "email",
    },
    "homa",
    ADULT_A,
    taskRaceDeliveryId,
    taskRaceScheduleId,
    sql,
  ),
  {
    ok: false,
    note: "This accepted offer no longer has the same current adult recipient, so Homa did not create the task.",
  },
);
const [taskRaceScheduleCount] = await sql<{ count: number }[]>`
  select count(*)::int as count
  from public.agent_schedules
  where id = ${taskRaceScheduleId}
`;
assert.equal(taskRaceScheduleCount?.count, 0);

assert.deepEqual(
  await insertMaterialRowPinned({
    id: materialRaceId,
    familyId: FAMILY,
    childId: null,
    title: "Review-null private material",
    kind: "worksheet",
    skill: null,
    subject: null,
    curriculum: null,
    theme: null,
    characters: [],
    pdfUrl: "https://example.test/private.pdf",
    previewUrl: "https://example.test/private.jpg",
    html: "<main>Private review-null material</main>",
    source: "html",
    revises: null,
    channel: "dispatch",
    sourceOfferDeliveryId: materialRaceDeliveryId,
    sourceAuthorizationDeliveryId: materialRaceDeliveryId,
    sourceOfferRecipientMemberUserId: ADULT_A,
    subjectLessonId: null,
    subjectLessonAttempt: null,
    subjectLessonSubjectId: null,
    subjectLessonTargetStatement: null,
    generation: { review: null },
  }),
  {
    ok: false,
    note: "This accepted offer no longer has the same current adult recipient, so Homa did not create the material.",
  },
);
const [materialRaceCount] = await sql<{ count: number }[]>`
  select count(*)::int as count
  from public.materials
  where id = ${materialRaceId}
`;
assert.equal(materialRaceCount?.count, 0);

assert.deepEqual(
  await exportConversationMessagesForAdult(sql, {
    familyId: FAMILY,
    memberUserId: ADULT_A,
  }),
  [],
);
assert.deepEqual(
  Array.from(
    await loadAdultSessionReviewMessages(sql, {
      familyId: FAMILY,
      memberUserId: ADULT_A,
      sessionId: "issue606-safe",
      afterSequence: -1,
      limit: 10,
    }),
  ),
  [],
);
assert.deepEqual(
  await continuity.listEpisodeMessages(
    FAMILY,
    "60600000-0000-4000-8000-000000000101",
    ADULT_A,
    null,
  ),
  [],
);
assert.equal(
  await loadRecentCallsContext({
    familyId: FAMILY,
    memberUserId: ADULT_A,
    timeZone: "UTC",
    sql,
  }),
  "",
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
  /current family membership/u,
);

await sql.unsafe(
  [
    "insert into public.family_members",
    "  (family_id, user_id, role, display_name)",
    "values ('60600000-0000-4000-8000-000000000010',",
    "  '60600000-0000-4000-8000-000000000001', 'parent',",
    "  'Adult A fixture restored');",
  ].join("\n"),
);

assert.equal(await eveOwners.owns(eveOwnerForRemoval), false);
const restoredMembershipOwnerRows = await sql.unsafe<{ count: string }[]>(
  `select count(*)::text from public.eve_web_session_owners ` +
    `where family_id = '${FAMILY}' and member_user_id = '${ADULT_A}'`,
);
assert.deepEqual(Array.from(restoredMembershipOwnerRows), [{ count: "0" }]);

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
  ].join("\n"),
);
assert.deepEqual(Array.from(replayState), [
  { message_owner: null, episode_owner: null },
]);

const replayCallOwner = await sql.unsafe<{ member_user_id: string | null }[]>(
  [
    "select member_user_id::text",
    "from public.call_transcripts",
    "where conversation_id = 'issue606-historical-assigned'",
  ].join("\n"),
);
assert.deepEqual(Array.from(replayCallOwner), [{ member_user_id: null }]);

await mapDb().end();
await sql.end();

console.log(
  "Issue 606 containment passed exact-adult reads, write guards, Eve ownership, atomic binding tuples, phone reassignment, membership revocation, historical call nulling, and idempotent replay.",
);
