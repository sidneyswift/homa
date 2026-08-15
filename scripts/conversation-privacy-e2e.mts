/**
 * Disposable same-family, two-adult privacy acceptance test for gh#606.
 *
 * The eval sandbox applies every migration before this script runs. This
 * fixture exercises direct caller RLS, server-pinned continuity and recall,
 * semantic recall, text and in-app Voice rows, Telnyx call transcripts, an
 * explicitly delivered proactive message, and account deletion.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { TransactionSql } from "postgres";

if (!process.env.HOMA_EVAL_DATABASE_URL) {
  throw new Error(
    "Conversation privacy E2E refused outside the disposable eval sandbox.",
  );
}

const { mapDb } = await import("../apps/web/lib/map/db");
const { createEveSessionOwnerStore } = await import(
  "../apps/web/lib/conversation-continuity/eve-session-owners"
);
const { createCachedRouteAuth, protectEveSessionRoutes } = await import(
  "../apps/web/lib/conversation-continuity/eve-session-channel"
);
const { webSessionThreadHash } = await import(
  "../apps/web/lib/conversation-continuity/web-session-binding"
);
const webRequire = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { eveChannel } = await import(
  pathToFileURL(webRequire.resolve("eve/channels/eve")).href
);
const { exportConversationMessagesForAdult, loadAdultSessionReviewMessages } =
  await import("../apps/web/lib/conversation-visibility");
const {
  createProactiveEpisode,
  loadContinuityContext,
  loadRecentContinuityForMember,
  markCanonicalMessageDelivered,
  persistCanonicalMessage,
} = await import("../apps/web/lib/conversation-continuity/ledger");
const { recallPinned } = await import("../apps/web/lib/agent-pinned");

const sql = mapDb();
const eveSessionOwners = createEveSessionOwnerStore(sql);
const VECTOR = `[${Array.from({ length: 1536 }, (_, index) =>
  index === 0 ? "1" : "0",
).join(",")}]`;
const A_CHAT = "privacyfixture sidneyprivatetext";
const A_REPLY = "privacyfixture sidneyprivateanswer";
const B_VOICE = "privacyfixture alessaprivatevoice";
const B_REPLY = "privacyfixture alessaprivateanswer";
const DELIVERED = "privacyfixture sidneyexplicitdelivery";
const LEGACY = "privacyfixture ambiguouslegacytext";
const INTERNAL = "privacyfixture sidneyinternalinstruction";
const A_CALL = "privacyfixture sidneyprivatecall";
const B_CALL = "privacyfixture alessaprivatecall";
const LEGACY_CALL = "privacyfixture ambiguouslegacycall";

function pass(label: string): void {
  console.log(`PASS  ${label}`);
}

function httpRoute(
  channel: ReturnType<typeof eveChannel>,
  method: string,
  path: string,
) {
  const route = channel.routes.find(
    (candidate) =>
      candidate.transport !== "websocket" &&
      candidate.method === method &&
      candidate.path === path,
  );
  if (!route || route.transport === "websocket") {
    throw new Error(`Missing ${method} ${path} route.`);
  }
  return route.handler;
}

function eveRouteArgs(input: {
  sessionId?: string;
  send: (
    payload: unknown,
    options: {
      auth: unknown;
      continuationToken: string;
    },
  ) => Promise<{
    id: string;
    continuationToken: string;
    getEventStream(options?: unknown): Promise<ReadableStream<unknown>>;
  }>;
  getSession?: (sessionId: string) => {
    id: string;
    continuationToken: string;
    getEventStream(options?: unknown): Promise<ReadableStream<unknown>>;
  };
}) {
  return {
    params: input.sessionId ? { sessionId: input.sessionId } : {},
    send: input.send,
    getSession:
      input.getSession ??
      (() => {
        throw new Error("Unexpected runtime lookup.");
      }),
    receive: async () => {
      throw new Error("Unexpected cross-channel receive.");
    },
    waitUntil: () => undefined,
    requestIp: null,
  };
}

function e2eRuntimeSession(
  sessionId: string,
  continuationToken: string,
  eventText = "private route event",
) {
  return {
    id: sessionId,
    continuationToken,
    async getEventStream() {
      return new ReadableStream<unknown>({
        start(controller) {
          controller.enqueue({
            type: "message.completed",
            data: {
              finishReason: "stop",
              message: eventText,
              sequence: 0,
              turnId: "privacy-route-turn",
            },
          });
          controller.close();
        },
      });
    },
  };
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
  return await asAdult(
    memberUserId,
    async (transaction) =>
      await transaction<{ content: string }[]>`
      select content
      from public.conversation_messages
      where family_id = ${familyId}
      order by created_at
    `,
  );
}

async function visibleCallContents(memberUserId: string, familyId: string) {
  return await asAdult(
    memberUserId,
    async (transaction) =>
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

  const sidneyEveOwner = {
    sessionId: "privacy-owned-eve-session",
    familyId,
    memberUserId: sidneyUserId,
  };
  const sidneyEveEpisodes = await sql<{ id: string }[]>`
    insert into public.conversation_episodes
      (family_id, scope, member_user_id)
    values (${familyId}, 'member', ${sidneyUserId})
    returning id
  `;
  const sidneyEveBinding = {
    episodeId: sidneyEveEpisodes[0].id,
    threadKeyHash: webSessionThreadHash(sidneyUserId),
  };
  await sql`
    insert into public.conversation_thread_bindings
      (family_id, member_user_id, channel, thread_key_hash,
       runtime_session_id, episode_id)
    values
      (${familyId}, ${sidneyUserId}, 'web',
       ${sidneyEveBinding.threadKeyHash}, null, ${sidneyEveBinding.episodeId})
  `;
  assert.equal(
    await eveSessionOwners.provision(
      { familyId, memberUserId: sidneyUserId },
      "privacy-invalid-binding-token",
      {
        episodeId: sidneyEveBinding.episodeId,
        threadKeyHash: webSessionThreadHash(alessaUserId),
      },
    ),
    null,
  );
  const sidneyProvisionId = await eveSessionOwners.provision(
    { familyId, memberUserId: sidneyUserId },
    "privacy-provisional-token",
    sidneyEveBinding,
  );
  assert.ok(sidneyProvisionId);
  assert.equal(await eveSessionOwners.owns(sidneyEveOwner), false);
  assert.equal(
    await eveSessionOwners.activate(
      sidneyProvisionId,
      sidneyEveOwner,
      "privacy-provisional-token",
      "privacy-token-1",
      sidneyEveBinding,
    ),
    true,
  );
  assert.equal(await eveSessionOwners.owns(sidneyEveOwner), true);
  const activatedBindings = await sql<{ runtime_session_id: string | null }[]>`
    select runtime_session_id
    from public.conversation_thread_bindings
    where family_id = ${familyId}
      and member_user_id = ${sidneyUserId}
      and channel = 'web'
      and thread_key_hash = ${sidneyEveBinding.threadKeyHash}
  `;
  assert.equal(
    activatedBindings[0]?.runtime_session_id,
    sidneyEveOwner.sessionId,
  );
  await assert.rejects(
    asAdult(
      sidneyUserId,
      async (transaction) =>
        await transaction`
        select session_id
        from public.eve_web_session_owners
        where session_id = ${sidneyEveOwner.sessionId}
      `,
    ),
    /permission denied/u,
  );
  assert.equal(
    await eveSessionOwners.owns({
      ...sidneyEveOwner,
      memberUserId: alessaUserId,
    }),
    false,
  );
  assert.equal(
    await eveSessionOwners.owns({
      ...sidneyEveOwner,
      sessionId: "privacy-legacy-eve-session",
    }),
    false,
  );
  const reservations = await Promise.all([
    eveSessionOwners.reserveContinuation(
      sidneyEveOwner,
      "privacy-token-1",
      "privacy-reservation-a",
    ),
    eveSessionOwners.reserveContinuation(
      sidneyEveOwner,
      "privacy-token-1",
      "privacy-reservation-b",
    ),
  ]);
  assert.equal(reservations.filter(Boolean).length, 1);
  const winningReservation = reservations[0]
    ? "privacy-reservation-a"
    : "privacy-reservation-b";
  assert.equal(
    await eveSessionOwners.completeContinuation(
      sidneyEveOwner,
      winningReservation,
      "privacy-token-1",
    ),
    true,
  );
  assert.equal(
    await eveSessionOwners.reserveContinuation(
      sidneyEveOwner,
      "privacy-token-1",
      "privacy-stable-token-reservation",
    ),
    true,
  );
  assert.equal(
    await eveSessionOwners.restoreContinuation(
      sidneyEveOwner,
      "privacy-stable-token-reservation",
    ),
    true,
  );
  pass(
    "Eve session ownership is exact-adult and continuations serialize atomically",
  );
  pass(
    "Eve session ids and token hashes stay outside authenticated Data API access",
  );

  const routeAuth = createCachedRouteAuth(async () => ({
    authenticator: "app",
    principalId: sidneyUserId,
    principalType: "user" as const,
    attributes: {
      channel: "web",
      continuityThreadHash: sidneyEveBinding.threadKeyHash,
      episodeId: sidneyEveBinding.episodeId,
      familyId,
      memberUserId: sidneyUserId,
    },
  }));
  const protectedEveChannel = protectEveSessionRoutes(
    eveChannel({ auth: routeAuth.auth }),
    {
      resolveAuth: routeAuth.resolve,
      owners: eveSessionOwners,
    },
  );
  const createSessionRoute = httpRoute(
    protectedEveChannel,
    "POST",
    "/eve/v1/session",
  );
  const createRequest = () =>
    new Request("https://homa.test/eve/v1/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Route privacy fixture" }),
    });
  let releaseCreate!: () => void;
  const createGate = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });
  let markCreateEntered!: () => void;
  const createEntered = new Promise<void>((resolve) => {
    markCreateEntered = resolve;
  });
  let routeCreates = 0;
  let provisionalSeenBeforeRuntime = false;
  const routeSessionId = "privacy-route-owned-eve-session";
  const firstCreate = createSessionRoute(
    createRequest(),
    eveRouteArgs({
      send: async () => {
        routeCreates += 1;
        const provisional = await sql<{ count: number }[]>`
          select count(*)::int as count
          from public.eve_web_session_owners
          where family_id = ${familyId}
            and member_user_id = ${sidneyUserId}
            and session_id is null
        `;
        provisionalSeenBeforeRuntime = provisional[0]?.count === 1;
        markCreateEntered();
        await createGate;
        return e2eRuntimeSession(routeSessionId, "privacy-route-token-1");
      },
    }),
  );
  await createEntered;
  const competingCreate = await createSessionRoute(
    createRequest(),
    eveRouteArgs({
      send: async () => {
        routeCreates += 1;
        return e2eRuntimeSession(
          "privacy-competing-eve-session",
          "privacy-competing-token",
        );
      },
    }),
  );
  assert.equal(competingCreate.status, 503);
  assert.equal(routeCreates, 1);
  releaseCreate();
  const createdRouteSession = await firstCreate;
  assert.equal(createdRouteSession.status, 202);
  assert.equal(
    createdRouteSession.headers.get("x-eve-session-id"),
    routeSessionId,
  );
  assert.equal(provisionalSeenBeforeRuntime, true);

  const routeOwner = {
    sessionId: routeSessionId,
    familyId,
    memberUserId: sidneyUserId,
  };
  assert.equal(await eveSessionOwners.owns(routeOwner), true);
  const routeBindings = await sql<{ runtime_session_id: string | null }[]>`
    select runtime_session_id
    from public.conversation_thread_bindings
    where family_id = ${familyId}
      and member_user_id = ${sidneyUserId}
      and channel = 'web'
      and thread_key_hash = ${sidneyEveBinding.threadKeyHash}
  `;
  assert.equal(routeBindings[0]?.runtime_session_id, routeSessionId);

  let runtimeLookups = 0;
  const streamRoute = httpRoute(
    protectedEveChannel,
    "GET",
    "/eve/v1/session/:sessionId/stream",
  );
  const streamResponse = await streamRoute(
    new Request(`https://homa.test/eve/v1/session/${routeSessionId}/stream`),
    eveRouteArgs({
      sessionId: routeSessionId,
      send: async () => {
        throw new Error("Unexpected stream send.");
      },
      getSession(sessionId) {
        runtimeLookups += 1;
        assert.equal(sessionId, routeSessionId);
        return e2eRuntimeSession(routeSessionId, "privacy-route-token-1");
      },
    }),
  );
  assert.equal(streamResponse.status, 200);
  assert.match(await streamResponse.text(), /private route event/u);
  assert.equal(runtimeLookups, 1);

  const continueRoute = httpRoute(
    protectedEveChannel,
    "POST",
    "/eve/v1/session/:sessionId",
  );
  const continued = await continueRoute(
    new Request(`https://homa.test/eve/v1/session/${routeSessionId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        continuationToken: "privacy-route-token-1",
        message: "Continue the private route fixture",
      }),
    }),
    eveRouteArgs({
      sessionId: routeSessionId,
      getSession(sessionId) {
        runtimeLookups += 1;
        assert.equal(sessionId, routeSessionId);
        return e2eRuntimeSession(routeSessionId, "privacy-route-token-1");
      },
      send: async (_payload, options) => {
        assert.equal(options.continuationToken, "privacy-route-token-1");
        return e2eRuntimeSession(routeSessionId, "privacy-route-token-1");
      },
    }),
  );
  assert.equal(continued.status, 200);
  assert.equal(
    await eveSessionOwners.reserveContinuation(
      routeOwner,
      "privacy-route-token-1",
      "privacy-route-old-token-check",
    ),
    true,
  );
  assert.equal(
    await eveSessionOwners.restoreContinuation(
      routeOwner,
      "privacy-route-old-token-check",
    ),
    true,
  );
  pass(
    "Eve create, binding, stream, and continuation share one exact-adult database lifecycle",
  );
  pass("simultaneous first creates admit only one runtime send");

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
    insert into public.conversation_deliveries
      (family_id, episode_id, message_id, recipient_member_user_id, channel,
       destination_hash, status, failed_at)
    values
      (${familyId}, ${sidneyMessage.episodeId}, ${sidneyMessage.id},
       ${alessaUserId}, 'web', ${"b".repeat(64)}, 'failed', now())
  `;

  await sql`
    insert into public.conversation_messages
      (family_id, session_id, sequence, channel, role, content, visibility,
       member_user_id, embedding)
    values
      (${familyId}, 'privacy-legacy', 0, 'web', 'user', ${LEGACY}, 'family',
       null, ${VECTOR}::extensions.vector(1536))
  `;
  await sql`
    insert into public.conversation_messages
      (family_id, session_id, sequence, channel, role, content, visibility,
       member_user_id)
    values
      (${familyId}, 'privacy-sidney-internal', 0, 'dispatch', 'user',
       ${INTERNAL}, 'internal', ${sidneyUserId})
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
      (conversation_id, family_id, member_user_id, owner_provenance, line, transcript_text,
       embedding, started_at)
    values
      ('privacy-call-sidney', ${familyId}, ${sidneyUserId}, 'telnyx_call_start_v1', 'general',
       ${A_CALL}, ${VECTOR}::extensions.vector(1536), now()),
      ('privacy-call-alessa', ${familyId}, ${alessaUserId}, 'telnyx_call_start_v1', 'general',
       ${B_CALL}, ${VECTOR}::extensions.vector(1536), now()),
      ('privacy-call-legacy', ${familyId}, null, null, 'general',
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

  const sidneyRows = (await visibleMessageContents(sidneyUserId, familyId)).map(
    (row) => row.content,
  );
  assert.deepEqual(new Set(sidneyRows), new Set([A_CHAT, A_REPLY, DELIVERED]));
  const alessaRows = (await visibleMessageContents(alessaUserId, familyId)).map(
    (row) => row.content,
  );
  assert.deepEqual(new Set(alessaRows), new Set([B_VOICE, B_REPLY]));
  pass("direct caller RLS isolates text, Voice, legacy, and delivery rows");

  const sidneyExport = await exportConversationMessagesForAdult(sql, {
    familyId,
    memberUserId: sidneyUserId,
  });
  const alessaExport = await exportConversationMessagesForAdult(sql, {
    familyId,
    memberUserId: alessaUserId,
  });
  assert.deepEqual(
    new Set(sidneyExport.map((row) => row.content)),
    new Set([A_CHAT, A_REPLY, DELIVERED]),
  );
  assert.deepEqual(
    new Set(alessaExport.map((row) => row.content)),
    new Set([B_VOICE, B_REPLY]),
  );
  assert.ok(sidneyExport.every((row) => row.content !== INTERNAL));
  assert.ok(alessaExport.every((row) => row.content !== A_CHAT));
  pass(
    "account export includes only owned or exactly delivered parent-visible rows",
  );

  const sidneyReview = await loadAdultSessionReviewMessages(sql, {
    familyId,
    memberUserId: sidneyUserId,
    sessionId: "privacy-sidney-chat",
    afterSequence: -1,
    limit: 60,
  });
  const alessaCrossAdultReview = await loadAdultSessionReviewMessages(sql, {
    familyId,
    memberUserId: alessaUserId,
    sessionId: "privacy-sidney-chat",
    afterSequence: -1,
    limit: 60,
  });
  const sidneyDeliveredReview = await loadAdultSessionReviewMessages(sql, {
    familyId,
    memberUserId: sidneyUserId,
    sessionId: "privacy-dispatch",
    afterSequence: -1,
    limit: 60,
  });
  const alessaUndeliveredReview = await loadAdultSessionReviewMessages(sql, {
    familyId,
    memberUserId: alessaUserId,
    sessionId: "privacy-dispatch",
    afterSequence: -1,
    limit: 60,
  });
  assert.deepEqual(
    Array.from(sidneyReview, (row) => row.content),
    [A_CHAT, A_REPLY],
  );
  assert.equal(alessaCrossAdultReview.length, 0);
  assert.deepEqual(
    Array.from(sidneyDeliveredReview, (row) => row.content),
    [DELIVERED],
  );
  assert.equal(alessaUndeliveredReview.length, 0);
  pass("session review reads only the exact adult's owned or delivered rows");

  const sidneyCalls = (await visibleCallContents(sidneyUserId, familyId)).map(
    (row) => row.transcript_text,
  );
  const alessaCalls = (await visibleCallContents(alessaUserId, familyId)).map(
    (row) => row.transcript_text,
  );
  assert.deepEqual(sidneyCalls, [A_CALL]);
  assert.deepEqual(alessaCalls, [B_CALL]);
  pass("call-start ownership shows each adult only their own proven call");

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
  assert.ok(sidneyPinnedCall[0]?.snippet.includes("sidney"));
  assert.ok(alessaPinnedCall[0]?.snippet.includes("alessa"));
  pass("server-pinned lexical recall keeps proven calls with their adult");

  const sidneySemantic = await asAdult(
    sidneyUserId,
    async (transaction) =>
      await transaction<{ source: string; content: string }[]>`
      select source, content
      from public.recall_semantic(${VECTOR}, 12, array['chat', 'call'])
    `,
  );
  const alessaSemantic = await asAdult(
    alessaUserId,
    async (transaction) =>
      await transaction<{ source: string; content: string }[]>`
      select source, content
      from public.recall_semantic(${VECTOR}, 12, array['chat', 'call'])
    `,
  );
  assert.ok(sidneySemantic.some((row) => row.content.includes("sidney")));
  assert.ok(sidneySemantic.some((row) => row.content === DELIVERED));
  assert.ok(sidneySemantic.some((row) => row.source === "call" && row.content.includes("sidney")));
  assert.ok(sidneySemantic.every((row) => !row.content.includes("alessa")));
  assert.ok(sidneySemantic.every((row) => !row.content.includes("ambiguous")));
  assert.ok(alessaSemantic.some((row) => row.content.includes("alessa")));
  assert.ok(alessaSemantic.some((row) => row.source === "call" && row.content.includes("alessa")));
  assert.ok(alessaSemantic.every((row) => !row.content.includes("sidney")));
  assert.ok(alessaSemantic.every((row) => !row.content.includes("ambiguous")));
  pass("semantic recall applies the same ownership wall");

  await sql`delete from auth.users where id = ${sidneyUserId}`;

  assert.equal(await eveSessionOwners.owns(sidneyEveOwner), false);
  const remainingEveOwners = await sql<{ count: number }[]>`
    select count(*)::int as count
    from public.eve_web_session_owners
    where session_id = ${sidneyEveOwner.sessionId}
  `;
  assert.equal(remainingEveOwners[0]?.count, 0);
  pass("adult removal revokes and deletes Eve session ownership");

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
    {
      private_messages: number;
      private_calls: number;
      private_deliveries: number;
    }[]
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
  pass("account deletion removes private call ownership without exposing it");
} finally {
  if (familyId) {
    await sql.begin(async (transaction) => {
      await transaction`
        insert into public.account_deletion_jobs (family_id, status)
        values (${familyId}, 'running')
      `;
      await transaction`
        select set_config('homa.family_delete_mode', 'account-deletion-v2', true)
      `;
      await transaction`
        update public.families
        set status = 'deleted', updated_at = now()
        where id = ${familyId}
      `;
      await transaction`delete from public.families where id = ${familyId}`;
    });
  }
  await sql`delete from auth.users where id in (${sidneyUserId}, ${alessaUserId})`;
  await sql.end();
}

console.log("ALL CONVERSATION PRIVACY CHECKS PASSED");
