/**
 * Disposable same-family, two-adult privacy acceptance test for gh#606.
 *
 * The eval sandbox applies every migration before this script runs. This
 * fixture exercises direct caller RLS, server-pinned continuity and recall,
 * semantic recall, text and in-app Voice rows, Telnyx call transcripts, an
 * explicitly delivered proactive message, and account deletion.
 */

import assert from "node:assert/strict";
import type { TransactionSql } from "postgres";

if (!process.env.HOMA_EVAL_DATABASE_URL) {
  throw new Error(
    "Conversation privacy E2E refused outside the disposable eval sandbox.",
  );
}

const { mapDb } = await import("../apps/web/lib/map/db");
const {
  createProactiveEpisode,
  loadContinuityContext,
  loadRecentContinuityForMember,
  markCanonicalMessageDelivered,
  persistCanonicalMessage,
} = await import(
  "../apps/web/lib/conversation-continuity/ledger"
);
const { recallPinned } = await import("../apps/web/lib/agent-pinned");

const sql = mapDb();
const VECTOR = `[${Array.from(
  { length: 1536 },
  (_, index) => (index === 0 ? "1" : "0"),
).join(",")}]`;
const A_CHAT = "privacyfixture sidneyprivatetext";
const A_REPLY = "privacyfixture sidneyprivateanswer";
const B_VOICE = "privacyfixture alessaprivatevoice";
const B_REPLY = "privacyfixture alessaprivateanswer";
const DELIVERED = "privacyfixture sidneyexplicitdelivery";
const LEGACY = "privacyfixture ambiguouslegacytext";
const A_CALL = "privacyfixture sidneyprivatecall";
const B_CALL = "privacyfixture alessaprivatecall";
const LEGACY_CALL = "privacyfixture ambiguouslegacycall";

function pass(label: string): void {
  console.log(`PASS  ${label}`);
}

async function asAdult<T>(
  memberUserId: string,
  operation: (transaction: TransactionSql) => Promise<T>,
): Promise<T> {
  return await sql.begin(async (transaction) => {
    await transaction`set local role authenticated`;
    await transaction`
      select set_config('request.jwt.claim.sub', ${memberUserId}, true)
    `;
    return await operation(transaction);
  });
}

async function visibleMessageContents(memberUserId: string, familyId: string) {
  return await asAdult(memberUserId, async (transaction) =>
    await transaction<{ content: string }[]>`
      select content
      from public.conversation_messages
      where family_id = ${familyId}
      order by created_at
    `,
  );
}

async function visibleCallContents(memberUserId: string, familyId: string) {
  return await asAdult(memberUserId, async (transaction) =>
    await transaction<{ transcript_text: string }[]>`
      select transcript_text
      from public.call_transcripts
      where family_id = ${familyId}
      order by created_at
    `,
  );
}

const users = await sql<{ id: string }[]>`
  insert into auth.users (id)
  values (gen_random_uuid()), (gen_random_uuid())
  returning id
`;
const sidneyUserId = users[0].id;
const alessaUserId = users[1].id;
let familyId: string | null = null;

try {
  const families = await sql<{ id: string }[]>`
    insert into public.families (name)
    values ('Conversation privacy fixture')
    returning id
  `;
  familyId = families[0].id;
  await sql`
    insert into public.family_members
      (family_id, user_id, role, display_name)
    values
      (${familyId}, ${sidneyUserId}, 'parent', 'Sidney fixture'),
      (${familyId}, ${alessaUserId}, 'parent', 'Alessa fixture')
  `;

  const sidneyMessage = await persistCanonicalMessage({
    attributes: { familyId, memberUserId: sidneyUserId },
    sessionId: "privacy-sidney-chat",
    channel: "web",
    sequence: 0,
    role: "user",
    content: A_CHAT,
    turnId: "sidney-turn",
  });
  assert.ok(sidneyMessage);
  const sidneyReply = await persistCanonicalMessage({
    attributes: { familyId, memberUserId: sidneyUserId },
    sessionId: "privacy-sidney-chat",
    channel: "web",
    sequence: 0,
    role: "assistant",
    content: A_REPLY,
    turnId: "sidney-turn",
    terminal: true,
  });
  assert.ok(sidneyReply);

  const alessaMessage = await persistCanonicalMessage({
    attributes: { familyId, memberUserId: alessaUserId },
    sessionId: "privacy-alessa-voice",
    channel: "web",
    sequence: 0,
    role: "user",
    content: B_VOICE,
    turnId: "alessa-turn",
    modality: "voice",
  });
  assert.ok(alessaMessage);
  const alessaReply = await persistCanonicalMessage({
    attributes: { familyId, memberUserId: alessaUserId },
    sessionId: "privacy-alessa-voice",
    channel: "web",
    sequence: 0,
    role: "assistant",
    content: B_REPLY,
    turnId: "alessa-turn",
    modality: "voice",
    terminal: true,
  });
  assert.ok(alessaReply);

  const proactiveEpisodeId = await createProactiveEpisode({ familyId });
  const proactive = await persistCanonicalMessage({
    attributes: { familyId, episodeId: proactiveEpisodeId },
    sessionId: "privacy-dispatch",
    channel: "dispatch",
    sequence: 0,
    role: "assistant",
    content: DELIVERED,
    turnId: "dispatch-turn",
    terminal: true,
  });
  assert.ok(proactive);
  await sql`
    insert into public.conversation_deliveries
      (family_id, episode_id, message_id, recipient_member_user_id, channel,
       destination_hash, status, sent_at)
    values
      (${familyId}, ${proactiveEpisodeId}, ${proactive.id}, ${sidneyUserId},
       'web', ${"a".repeat(64)}, 'sent', now())
  `;
  await markCanonicalMessageDelivered({ familyId, messageId: proactive.id });

  await sql`
    insert into public.conversation_messages
      (family_id, session_id, sequence, channel, role, content, visibility,
       member_user_id, embedding)
    values
      (${familyId}, 'privacy-legacy', 0, 'web', 'user', ${LEGACY}, 'family',
       null, ${VECTOR}::extensions.vector(1536))
  `;
  await sql`
    update public.conversation_messages
    set embedding = ${VECTOR}::extensions.vector(1536)
    where id in (
      ${sidneyMessage.id}, ${sidneyReply.id},
      ${alessaMessage.id}, ${alessaReply.id}, ${proactive.id}
    )
  `;
  await sql`
    insert into public.call_transcripts
      (conversation_id, family_id, member_user_id, line, transcript_text,
       embedding, started_at)
    values
      ('privacy-call-sidney', ${familyId}, ${sidneyUserId}, 'general',
       ${A_CALL}, ${VECTOR}::extensions.vector(1536), now()),
      ('privacy-call-alessa', ${familyId}, ${alessaUserId}, 'general',
       ${B_CALL}, ${VECTOR}::extensions.vector(1536), now()),
      ('privacy-call-legacy', ${familyId}, null, 'general',
       ${LEGACY_CALL}, ${VECTOR}::extensions.vector(1536), now())
  `;
  await sql`
    update public.conversation_episodes
    set last_activity_at = case
      when id in (${sidneyMessage.episodeId}, ${alessaMessage.episodeId})
        then now()
      else now() - interval '5 minutes'
    end
    where family_id = ${familyId}
  `;

  const sidneyRows = (await visibleMessageContents(sidneyUserId, familyId))
    .map((row) => row.content);
  assert.deepEqual(
    new Set(sidneyRows),
    new Set([A_CHAT, A_REPLY, DELIVERED]),
  );
  const alessaRows = (await visibleMessageContents(alessaUserId, familyId))
    .map((row) => row.content);
  assert.deepEqual(new Set(alessaRows), new Set([B_VOICE, B_REPLY]));
  pass("direct caller RLS isolates text, Voice, legacy, and delivery rows");

  const sidneyCalls = (await visibleCallContents(sidneyUserId, familyId))
    .map((row) => row.transcript_text);
  const alessaCalls = (await visibleCallContents(alessaUserId, familyId))
    .map((row) => row.transcript_text);
  assert.deepEqual(sidneyCalls, [A_CALL]);
  assert.deepEqual(alessaCalls, [B_CALL]);
  pass("direct caller RLS isolates call transcripts and hides ambiguity");

  const sidneyHydration = await loadContinuityContext({
    familyId,
    memberUserId: sidneyUserId,
    episodeId: sidneyMessage.episodeId,
    runtimeSessionId: "privacy-new-sidney-runtime",
  });
  assert.match(sidneyHydration, /sidneyprivatetext/u);
  assert.match(sidneyHydration, /sidneyprivateanswer/u);
  assert.doesNotMatch(sidneyHydration, /alessaprivate/u);
  const alessaHydration = await loadContinuityContext({
    familyId,
    memberUserId: alessaUserId,
    episodeId: alessaMessage.episodeId,
    runtimeSessionId: "privacy-new-alessa-runtime",
  });
  assert.match(alessaHydration, /alessaprivatevoice/u);
  assert.doesNotMatch(alessaHydration, /sidneyprivate/u);
  const sidneyDelivery = await loadContinuityContext({
    familyId,
    memberUserId: sidneyUserId,
    episodeId: proactiveEpisodeId,
    runtimeSessionId: "privacy-new-delivery-runtime",
  });
  const alessaDelivery = await loadContinuityContext({
    familyId,
    memberUserId: alessaUserId,
    episodeId: proactiveEpisodeId,
    runtimeSessionId: "privacy-new-delivery-runtime",
  });
  assert.match(sidneyDelivery, /sidneyexplicitdelivery/u);
  assert.equal(alessaDelivery, "");
  pass("model hydration requires owner or exact successful delivery");

  const sidneyRecent = await loadRecentContinuityForMember({
    familyId,
    memberUserId: sidneyUserId,
  });
  const alessaRecent = await loadRecentContinuityForMember({
    familyId,
    memberUserId: alessaUserId,
  });
  assert.match(sidneyRecent, /sidneyprivate/u);
  assert.doesNotMatch(sidneyRecent, /alessaprivate/u);
  assert.match(alessaRecent, /alessaprivate/u);
  assert.doesNotMatch(alessaRecent, /sidneyprivate/u);
  pass("recent episode reuse is per adult");

  const sidneyPinnedChat = await recallPinned({
    familyId,
    memberUserId: sidneyUserId,
    query: "privacyfixture",
    scope: "chats",
    limit: 1,
  });
  const alessaPinnedChat = await recallPinned({
    familyId,
    memberUserId: alessaUserId,
    query: "privacyfixture",
    scope: "chats",
    limit: 1,
  });
  assert.ok(sidneyPinnedChat[0]?.snippet.includes("sidney"));
  assert.ok(alessaPinnedChat[0]?.snippet.includes("alessa"));
  const sidneyPinnedCall = await recallPinned({
    familyId,
    memberUserId: sidneyUserId,
    query: "privacyfixture",
    scope: "calls",
    limit: 1,
  });
  const alessaPinnedCall = await recallPinned({
    familyId,
    memberUserId: alessaUserId,
    query: "privacyfixture",
    scope: "calls",
    limit: 1,
  });
  assert.ok(sidneyPinnedCall[0]?.snippet.includes("sidneyprivatecall"));
  assert.ok(alessaPinnedCall[0]?.snippet.includes("alessaprivatecall"));
  pass("server-pinned lexical recall is per adult");

  const sidneySemantic = await asAdult(sidneyUserId, async (transaction) =>
    await transaction<{ source: string; content: string }[]>`
      select source, content
      from public.recall_semantic(${VECTOR}, 12, array['chat', 'call'])
    `,
  );
  const alessaSemantic = await asAdult(alessaUserId, async (transaction) =>
    await transaction<{ source: string; content: string }[]>`
      select source, content
      from public.recall_semantic(${VECTOR}, 12, array['chat', 'call'])
    `,
  );
  assert.ok(sidneySemantic.some((row) => row.content.includes("sidney")));
  assert.ok(sidneySemantic.some((row) => row.content === DELIVERED));
  assert.ok(sidneySemantic.every((row) => !row.content.includes("alessa")));
  assert.ok(sidneySemantic.every((row) => !row.content.includes("ambiguous")));
  assert.ok(alessaSemantic.some((row) => row.content.includes("alessa")));
  assert.ok(alessaSemantic.every((row) => !row.content.includes("sidney")));
  assert.ok(alessaSemantic.every((row) => !row.content.includes("ambiguous")));
  pass("semantic recall applies the same ownership wall");

  await sql`delete from auth.users where id = ${sidneyUserId}`;

  const postDeleteMessages = (
    await visibleMessageContents(alessaUserId, familyId)
  ).map((row) => row.content);
  const postDeleteCalls = (
    await visibleCallContents(alessaUserId, familyId)
  ).map((row) => row.transcript_text);
  assert.deepEqual(new Set(postDeleteMessages), new Set([B_VOICE, B_REPLY]));
  assert.deepEqual(postDeleteCalls, [B_CALL]);
  const postDeleteHydration = await loadContinuityContext({
    familyId,
    memberUserId: alessaUserId,
    episodeId: sidneyMessage.episodeId,
    runtimeSessionId: "privacy-post-delete-runtime",
  });
  assert.equal(postDeleteHydration, "");
  const anonymized = await sql<
    { private_messages: number; private_calls: number; private_deliveries: number }[]
  >`
    select
      count(*) filter (
        where content in (${A_CHAT}, ${A_REPLY}) and member_user_id is null
      )::int as private_messages,
      (
        select count(*)::int from public.call_transcripts
        where family_id = ${familyId}
          and transcript_text = ${A_CALL}
          and member_user_id is null
      ) as private_calls,
      (
        select count(*)::int from public.conversation_deliveries
        where family_id = ${familyId}
          and message_id = ${proactive.id}
          and recipient_member_user_id is null
      ) as private_deliveries
    from public.conversation_messages
    where family_id = ${familyId}
  `;
  assert.deepEqual(anonymized[0], {
    private_messages: 2,
    private_calls: 1,
    private_deliveries: 1,
  });
  pass("account deletion anonymizes private rows without exposing them");
} finally {
  if (familyId) await sql`delete from public.families where id = ${familyId}`;
  await sql`delete from auth.users where id in (${sidneyUserId}, ${alessaUserId})`;
  await sql.end();
}

console.log("ALL CONVERSATION PRIVACY CHECKS PASSED");
