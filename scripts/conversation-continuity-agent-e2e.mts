/**
 * Live agent E2E for cross-session continuity.
 *
 * Prepares a synthetic signed-in parent with a morning brief delivered in a
 * dispatch episode, then starts a brand-new web Eve session containing only
 * "Yes". The agent must hydrate the canonical episode and provide the promised
 * game instead of asking "Yes to what?" This exercises the same resolver and
 * context path used by SMS/email without depending on provider webhooks.
 *
 * Usage:
 *   pnpm tsx scripts/conversation-continuity-agent-e2e.mts \
 *     --base http://localhost:3233
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
} = await import("../apps/web/lib/conversation-continuity/ledger");
const {
  beginDeliveryAttempt,
  finishDeliveryAttempt,
  openReplyLoop,
} = await import(
  "../apps/web/lib/conversation-continuity/delivery-ledger"
);

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

const base = argValue("--base") ?? "http://localhost:3233";
const sql = mapDb();
let familyId: string | null = null;
let userId: string | null = null;
let fixtureEmail: string | null = null;
const startedAt = new Date();

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

async function waitForAssistant(): Promise<string | null> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const rows = await sql<{ content: string }[]>`
      select content from public.conversation_messages
      where family_id = ${familyId}
        and channel = 'web'
        and role = 'assistant'
        and created_at >= ${startedAt.toISOString()}
      order by created_at desc
      limit 1
    `;
    if (rows[0]?.content) return rows[0].content;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  return null;
}

try {
  await sql`select 1 as live_fixture_database_ready`;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `continuity-agent-${suffix}@example.com`;
  fixtureEmail = email;
  const password = `Homa-continuity-${suffix}-A1!`;
  const auth = await authRequest("signup", { email, password });
  userId = auth.user?.id ?? null;
  const accessToken = auth.access_token as string | undefined;
  if (!userId || !accessToken) throw new Error("Signup returned no session.");

  const familyResponse = await fetch(
    `${supabaseUrl}/rest/v1/rpc/create_my_family`,
    {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        family_name: "Continuity agent E2E",
        family_us_state: "NY",
        parent_name: "Sam fixture",
      }),
    },
  );
  const familyText = await familyResponse.text();
  if (!familyResponse.ok) {
    throw new Error(
      `create family HTTP ${familyResponse.status}: ${familyText.slice(0, 160)}`,
    );
  }
  const familyJson = JSON.parse(familyText);
  familyId = Array.isArray(familyJson)
    ? familyJson[0]?.family_id
    : familyJson?.family_id;
  if (!familyId) throw new Error("Create family returned no id.");
  const sandboxRows = await sql<{ id: string }[]>`
    update public.families
    set sandbox = true, email = ${email}, time_zone = 'America/New_York',
        profile_completed_at = now()
    where id = ${familyId}
    returning id
  `;
  if (sandboxRows.length !== 1) {
    throw new Error("continuity agent fixture family was not marked as sandbox");
  }
  await sql`
    update public.family_members set display_name = 'Sam fixture'
    where family_id = ${familyId} and user_id = ${userId}
  `;
  await sql`
    insert into public.children
      (family_id, name, birth_month, profile)
    values
      (${familyId}, 'Story fixture', '2022-11-01',
       ${sql.json({ interests: ["movement games"], focus: "self-regulation" } as never)})
  `;
  const runs = await sql<{ id: string }[]>`
    insert into public.homa_task_runs
      (family_id, kind, status, scheduled_for, title)
    values
      (${familyId}, 'morning_brief', 'done', current_date,
       'Continuity agent E2E brief')
    returning id
  `;
  const runId = runs[0].id;
  const episodeId = await createProactiveEpisode({ familyId });
  const dispatchSession = `continuity-agent-dispatch-${suffix}`;
  await persistCanonicalMessage({
    attributes: { familyId, episodeId, taskRunId: runId },
    sessionId: dispatchSession,
    channel: "dispatch",
    sequence: 0,
    role: "user",
    content: "Internal instruction: compose the morning brief.",
    turnId: "turn-0",
  });
  const briefText =
    "Story fixture is ready to practice self-regulation through movement. Want a quick stop-and-go game to try today?";
  const brief = await persistCanonicalMessage({
    attributes: { familyId, episodeId, taskRunId: runId },
    sessionId: dispatchSession,
    channel: "dispatch",
    sequence: 0,
    role: "assistant",
    content: briefText,
    turnId: "turn-0",
  });
  if (!brief) throw new Error("Could not persist synthetic brief.");

  const attempt = await beginDeliveryAttempt({
    familyId,
    episodeId,
    messageId: brief.id,
    taskRunId: runId,
    memberUserId: userId,
    channel: "sms",
    destination: "+15550000000",
    providerThreadKey: "telnyx:+13467588011:+15550000000",
  });
  await finishDeliveryAttempt(attempt, { delivered: true });
  await markCanonicalMessageDelivered({ familyId, messageId: brief.id });
  await openReplyLoop({
    attempt,
    contract: {
      kind: "yes_no",
      promptKey: "morning-brief-offer",
      expiresAfterMs: 24 * 60 * 60_000,
    },
  });

  const response = await fetch(`${base}/eve/v1/session`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: "Yes" }),
  });
  if (!response.ok) {
    throw new Error(
      `Eve session returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }

  const assistant = await waitForAssistant();
  if (!assistant) throw new Error("Timed out waiting for the agent reply.");
  const confused = /yes to|what were you hoping|what do you mean/iu.test(
    assistant,
  );
  const answeredOffer =
    /game|stop|go|freeze|move|movement/iu.test(assistant);
  console.log(`Agent reply: ${assistant}`);
  console.log(
    !confused && answeredOffer
      ? "\nPASS  Agent resolved Yes to the cross-channel brief"
      : "\nFAIL  Agent did not resolve the cross-channel brief",
  );
  if (confused || !answeredOffer) process.exitCode = 1;
} finally {
  if (familyId) {
    await sql`delete from public.events where family_id = ${familyId}`;
    await sql`delete from public.model_usage where family_id = ${familyId}`;
    await sql`delete from public.families where id = ${familyId}`;
  }
  if (userId) {
    await sql`delete from auth.users where id = ${userId}`;
  }
  if (fixtureEmail) {
    await sql`delete from auth.users where lower(email) = ${fixtureEmail.toLowerCase()}`;
  }
  await sql.end();
}
