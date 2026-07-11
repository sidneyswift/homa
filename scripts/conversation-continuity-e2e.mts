/**
 * Production-shaped Conversation Continuity E2E against homa-prod.
 *
 * Creates a synthetic two-parent family, records one canonical proactive
 * brief, delivers it independently to both parent phones through the real
 * Postgres delivery ledger (transport calls are deterministic fakes), then
 * proves each parent's "Yes" resolves to their own delivery and the same
 * episode. Every synthetic row and auth user is cleaned in finally.
 *
 * Usage: pnpm tsx scripts/conversation-continuity-e2e.mts
 */

import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // CI supplies environment variables directly.
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !publishableKey) {
  throw new Error("Missing Supabase public configuration.");
}

const { mapDb } = await import("../apps/web/lib/map/db");
const {
  createProactiveEpisode,
  markCanonicalMessageDelivered,
  persistCanonicalMessage,
  resolveInboundContinuity,
  resolvedContinuityAttributes,
} = await import("../apps/web/lib/conversation-continuity/ledger");
const {
  beginDeliveryAttempt,
  listFamilyDeliveryRecipients,
} = await import(
  "../apps/web/lib/conversation-continuity/delivery-ledger"
);
const {
  claimInboundReceipt,
  completeInboundReceipt,
  failInboundReceipt,
} = await import(
  "../apps/web/lib/conversation-continuity/inbound-receipts"
);
const { foldStubFamilyInto } = await import("../apps/web/lib/family-fold");
const {
  deliverTaskMessage,
  postgresTaskDeliveryLedger,
} = await import(
  "../apps/web/lib/conversation-continuity/task-delivery"
);

const sql = mapDb();
const userIds: string[] = [];
let familyId: string | null = null;
let stubFamilyId: string | null = null;
const failures: string[] = [];

function report(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failures.push(label);
}

async function authRequest(pathname: string, body: unknown) {
  const response = await fetch(`${supabaseUrl}/auth/v1/${pathname}`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`auth ${pathname} HTTP ${response.status}: ${text.slice(0, 160)}`);
  }
  return parsed;
}

async function signUp(label: string, suffix: string) {
  const email = `continuity-${label}-${suffix}@example.com`;
  const password = `Homa-continuity-${suffix}-${label}-A1!`;
  const result = await authRequest("signup", { email, password });
  const userId = result.user?.id as string | undefined;
  const accessToken = result.access_token as string | undefined;
  if (!userId || !accessToken) {
    throw new Error(`signup did not return a session for ${label}`);
  }
  userIds.push(userId);
  return { userId, accessToken, email };
}

async function createFamily(
  user: { userId: string; accessToken: string },
): Promise<string> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/create_my_family`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${user.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      family_name: "Continuity E2E family",
      family_us_state: "NY",
      parent_name: "Sidney fixture",
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`create family HTTP ${response.status}: ${text.slice(0, 160)}`);
  }
  const parsed = JSON.parse(text);
  const id = Array.isArray(parsed) ? parsed[0]?.family_id : parsed?.family_id;
  if (!id) throw new Error("create family returned no id");
  return id;
}

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

try {
  const sidney = await signUp("sidney", suffix);
  const alessa = await signUp("alessa", suffix);
  familyId = await createFamily(sidney);
  await sql`
    update public.family_members
    set display_name = 'Sidney fixture'
    where family_id = ${familyId} and user_id = ${sidney.userId}
  `;
  await sql`
    insert into public.family_members (family_id, user_id, role, display_name)
    values (${familyId}, ${alessa.userId}, 'parent', 'Alessa fixture')
  `;
  const digits = String(Date.now()).slice(-7);
  const sidneyPhone = `+1555${digits}`;
  const alessaPhone = `+1556${digits}`;
  await sql`
    insert into public.family_phones
      (family_id, phone_e164, source, member_user_id)
    values
      (${familyId}, ${sidneyPhone}, 'home', ${sidney.userId}),
      (${familyId}, ${alessaPhone}, 'home', ${alessa.userId})
  `;

  const firstReceipt = await claimInboundReceipt({
    familyId,
    channel: "sms",
    providerMessageId: `receipt-complete-${suffix}`,
  });
  const concurrentReceipt = await claimInboundReceipt({
    familyId,
    channel: "sms",
    providerMessageId: `receipt-complete-${suffix}`,
  });
  await completeInboundReceipt(firstReceipt.id);
  const completedReplay = await claimInboundReceipt({
    familyId,
    channel: "sms",
    providerMessageId: `receipt-complete-${suffix}`,
  });
  report(
    "durable receipt blocks concurrent and completed provider replays",
    firstReceipt.claimed &&
      !concurrentReceipt.claimed &&
      !completedReplay.claimed,
  );

  const failedReceipt = await claimInboundReceipt({
    familyId,
    channel: "email",
    providerMessageId: `receipt-failed-${suffix}`,
  });
  await failInboundReceipt(failedReceipt.id, new Error("fixture failure"));
  const reclaimedReceipt = await claimInboundReceipt({
    familyId,
    channel: "email",
    providerMessageId: `receipt-failed-${suffix}`,
  });
  report(
    "a turn that failed before Eve can be reclaimed once",
    failedReceipt.claimed && reclaimedReceipt.claimed,
  );

  const runRows = await sql<{ id: string }[]>`
    insert into public.homa_task_runs
      (family_id, kind, status, scheduled_for, title)
    values (${familyId}, 'morning_brief', 'running', current_date,
            'Continuity E2E brief')
    returning id
  `;
  const runId = runRows[0].id;
  const episodeId = await createProactiveEpisode({ familyId });
  const dispatchSession = `continuity-dispatch-${suffix}`;

  await persistCanonicalMessage({
    attributes: { familyId, episodeId, taskRunId: runId },
    sessionId: dispatchSession,
    channel: "dispatch",
    sequence: 0,
    role: "user",
    content: "Compose the morning brief from internal task instructions.",
    turnId: "turn-0",
  });
  const briefText =
    "Story is ready for a new stop-and-go game. Want the quick version?";
  const brief = await persistCanonicalMessage({
    attributes: { familyId, episodeId, taskRunId: runId },
    sessionId: dispatchSession,
    channel: "dispatch",
    sequence: 0,
    role: "assistant",
    content: briefText,
    turnId: "turn-0",
  });
  if (!brief) throw new Error("brief did not persist");

  const recipients = await listFamilyDeliveryRecipients(familyId);
  report("two parent recipients resolved", recipients.length === 2);
  const delivery = await deliverTaskMessage(
    {
      familyId,
      episodeId,
      messageId: brief.id,
      taskRunId: runId,
      kind: "morning_brief",
      text: briefText,
      recipients,
      deliveryMode: "text",
    },
    {
      ledger: postgresTaskDeliveryLedger,
      transports: {
        async sendSms() {
          return true;
        },
        async sendEmail() {
          return true;
        },
      },
    },
  );
  report(
    "both parent deliveries recorded independently",
    delivery.status === "done" && delivery.deliveredCount === 2,
  );
  const sentReplay = await beginDeliveryAttempt({
    familyId,
    episodeId,
    messageId: brief.id,
    taskRunId: runId,
    memberUserId: sidney.userId,
    channel: "sms",
    destination: sidneyPhone,
    providerThreadKey: `telnyx:homa:${sidneyPhone}`,
  });
  report(
    "a sent destination is terminal and cannot be submitted twice",
    !sentReplay.shouldSend && sentReplay.existingStatus === "sent",
  );
  await markCanonicalMessageDelivered({
    familyId,
    messageId: brief.id,
  });
  await persistCanonicalMessage({
    attributes: { familyId, episodeId, taskRunId: runId },
    sessionId: dispatchSession,
    channel: "dispatch",
    sequence: 0,
    role: "assistant",
    content: briefText,
    turnId: "turn-0",
  });
  const replayedVisibility = await sql<{ visibility: string }[]>`
    select visibility from public.conversation_messages where id = ${brief.id}
  `;
  report(
    "event replay cannot demote a delivered message back to internal",
    replayedVisibility[0]?.visibility === "family",
  );

  const sidneyContinuity = await resolveInboundContinuity({
    familyId,
    memberUserId: sidney.userId,
    channel: "sms",
    transportThreadKey: `telnyx:homa:${sidneyPhone}`,
    runtimeSessionId: "sms-sidney",
    providerMessageId: `provider-sidney-${suffix}`,
    providerReplyTo: null,
    destinationKey: sidneyPhone,
    text: "Yes",
  });
  report(
    "Sidney Yes resolves to the brief",
    sidneyContinuity.replyToMessageId === brief.id &&
      sidneyContinuity.resolution === "matched",
  );
  report(
    "internal dispatch prompt is excluded from active context",
    sidneyContinuity.contextMarkdown.includes(briefText) &&
      !sidneyContinuity.contextMarkdown.includes("internal task instructions"),
  );
  const sidneyReply = await persistCanonicalMessage({
    attributes: {
      familyId,
      ...resolvedContinuityAttributes(sidneyContinuity, {
        memberUserId: sidney.userId,
        providerMessageId: `provider-sidney-${suffix}`,
      }),
    },
    sessionId: "sms-sidney",
    channel: "sms",
    sequence: 1,
    role: "user",
    content: "Yes",
    turnId: "turn-1",
  });
  if (!sidneyReply) throw new Error("Sidney reply did not persist");

  const statesAfterSidney = await sql<
    { recipient_member_user_id: string | null; state: string }[]
  >`
    select d.recipient_member_user_id, l.state
    from public.conversation_open_loops l
    join public.conversation_deliveries d on d.id = l.delivery_id
    where l.message_id = ${brief.id}
    order by d.recipient_member_user_id
  `;
  report(
    "Sidney loop resolved while Alessa remains open",
    statesAfterSidney.some(
      (row) =>
        row.recipient_member_user_id === sidney.userId &&
        row.state === "resolved",
    ) &&
      statesAfterSidney.some(
        (row) =>
          row.recipient_member_user_id === alessa.userId &&
          row.state === "open",
      ),
  );

  const alessaContinuity = await resolveInboundContinuity({
    familyId,
    memberUserId: alessa.userId,
    channel: "sms",
    transportThreadKey: `telnyx:homa:${alessaPhone}`,
    runtimeSessionId: "sms-alessa",
    providerMessageId: `provider-alessa-${suffix}`,
    providerReplyTo: null,
    destinationKey: alessaPhone,
    text: "Yes",
  });
  report(
    "Alessa independently resolves the same family brief",
    alessaContinuity.replyToMessageId === brief.id &&
      alessaContinuity.repliedDeliveryId !==
        sidneyContinuity.repliedDeliveryId,
  );

  const visibleRows = await sql<{ visibility: string; content: string }[]>`
    select visibility, content from public.conversation_messages
    where episode_id = ${episodeId}
    order by created_at
  `;
  report(
    "canonical episode separates internal and family-visible messages",
    visibleRows.some(
      (row) =>
        row.visibility === "internal" &&
        row.content.includes("internal task instructions"),
    ) &&
      visibleRows.some(
        (row) => row.visibility === "family" && row.content === briefText,
      ),
  );

  const stubs = await sql<{ id: string }[]>`
    insert into public.families (name, status)
    values ('Continuity fold stub', 'open')
    returning id
  `;
  stubFamilyId = stubs[0].id;
  const stubEpisodes = await sql<{ id: string }[]>`
    insert into public.conversation_episodes (family_id, scope)
    values (${stubFamilyId}, 'household')
    returning id
  `;
  const bindingHash = "b".repeat(64);
  await sql`
    insert into public.conversation_thread_bindings
      (family_id, channel, thread_key_hash, episode_id)
    values (${stubFamilyId}, 'sms', ${bindingHash}, ${stubEpisodes[0].id})
  `;
  const folded = await foldStubFamilyInto(stubFamilyId, familyId);
  const movedBinding = await sql<{ family_id: string }[]>`
    select family_id from public.conversation_thread_bindings
    where channel = 'sms' and thread_key_hash = ${bindingHash}
  `;
  report(
    "family fold preserves the canonical transport binding",
    folded && movedBinding[0]?.family_id === familyId,
  );
  if (folded) stubFamilyId = null;
} finally {
  if (stubFamilyId) {
    await sql`delete from public.families where id = ${stubFamilyId}`;
  }
  if (familyId) {
    await sql`delete from public.families where id = ${familyId}`;
  }
  if (userIds.length > 0) {
    await sql`delete from auth.users where id in ${sql(userIds)}`;
  }
  await sql.end();
}

console.log(
  failures.length === 0
    ? "\nALL CONTINUITY E2E CHECKS PASSED"
    : `\nFAILURES: ${failures.length}`,
);
process.exit(failures.length === 0 ? 0 : 1);
