/**
 * Live local Eve regression for delegated session continuity.
 *
 * Creates one synthetic signed-in family, asks a root web session to delegate
 * a fixed marker task, and proves the child remains internal to Eve while the
 * root result reaches the family's durable history.
 *
 * Usage:
 *   pnpm exec tsx scripts/parented-session-continuity-e2e.mts \
 *     --base http://localhost:3233
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { mapDb } from "../apps/web/lib/map/db";

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

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

function hashSessionId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function waitForRootSessionToSettle(input: {
  accessToken: string;
  base: string;
  sessionId: string;
  timeoutMs: number;
}): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch(
      `${input.base}/eve/v1/session/${encodeURIComponent(input.sessionId)}/stream`,
      {
        headers: { Authorization: `Bearer ${input.accessToken}` },
        signal: controller.signal,
      },
    );
    if (!response.ok || !response.body) {
      throw new Error(
        `Eve stream returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    while (true) {
      const chunk = await reader.read();
      buffered += decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as {
          type?: string;
          data?: { message?: string };
        };
        if (
          event.type === "session.waiting" ||
          event.type === "session.completed"
        ) {
          return;
        }
        if (event.type === "session.failed" || event.type === "turn.failed") {
          throw new Error(
            `Eve root session failed: ${event.data?.message ?? "unknown failure"}`,
          );
        }
      }
      if (chunk.done) {
        throw new Error("Eve stream ended before the root session settled.");
      }
    }
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

async function authRequest(
  pathname: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${supabaseUrl}/auth/v1/${pathname}`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `auth ${pathname} HTTP ${response.status}: ${text.slice(0, 160)}`,
    );
  }
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

async function createFamily(accessToken: string): Promise<string> {
  const response = await fetch(
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
        family_name: "Parented session E2E",
        family_us_state: "NY",
        parent_name: "Sam fixture",
      }),
    },
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `create family HTTP ${response.status}: ${text.slice(0, 160)}`,
    );
  }
  const parsed = JSON.parse(text) as
    | { family_id?: string }
    | Array<{ family_id?: string }>;
  const familyId = Array.isArray(parsed)
    ? parsed[0]?.family_id
    : parsed.family_id;
  if (!familyId) {
    throw new Error("Create family returned no id.");
  }
  return familyId;
}

async function waitForRootAssistantText(input: {
  familyId: string;
  rootSessionId: string;
  timeoutMs: number;
}): Promise<string> {
  const deadline = Date.now() + input.timeoutMs;
  while (Date.now() < deadline) {
    const rows = await sql<{ content: string }[]>`
      select content
      from public.conversation_messages
      where family_id = ${input.familyId}
        and session_id = ${input.rootSessionId}
        and role = 'assistant'
        and content like '%CHILD_RESULT_OK%'
      order by created_at desc
      limit 1
    `;
    if (rows[0]?.content) {
      return rows[0].content;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("Timed out waiting for the root delegated result.");
}

const base = argValue("--base") ?? "http://localhost:3233";
const sql = mapDb();
let familyId: string | null = null;
let userId: string | null = null;

try {
  await sql`select 1 as live_fixture_database_ready`;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `parented-session-${suffix}@example.com`;
  const password = `Homa-parented-session-${suffix}-A1!`;
  const auth = await authRequest("signup", { email, password });
  const authUser = auth.user as { id?: unknown } | undefined;
  userId = typeof authUser?.id === "string" ? authUser.id : null;
  const accessToken =
    typeof auth.access_token === "string" ? auth.access_token : null;
  if (!userId || !accessToken) {
    throw new Error("Signup returned no authenticated session.");
  }

  familyId = await createFamily(accessToken);
  const sandboxRows = await sql<{ id: string }[]>`
    update public.families
    set sandbox = true, email = ${email}, time_zone = 'America/New_York',
        profile_completed_at = now()
    where id = ${familyId}
    returning id
  `;
  if (sandboxRows.length !== 1) {
    throw new Error("parented session fixture family was not marked as sandbox");
  }
  await sql`
    update public.family_members
    set display_name = 'Sam fixture'
    where family_id = ${familyId} and user_id = ${userId}
  `;

  const response = await fetch(`${base}/eve/v1/session`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message:
        'Use the built-in agent tool exactly once. Delegate this exact task: "Return exactly CHILD_RESULT_OK and do nothing else." After the child returns, reply with its result and include CHILD_RESULT_OK. Do not use another tool.',
    }),
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Eve session returned HTTP ${response.status}: ${responseText.slice(0, 300)}`,
    );
  }
  const session = JSON.parse(responseText) as { sessionId?: string };
  if (!session.sessionId) {
    throw new Error("Eve session returned no session id.");
  }

  await waitForRootSessionToSettle({
    accessToken,
    base,
    sessionId: session.sessionId,
    timeoutMs: 180_000,
  });
  const rootAssistantText = await waitForRootAssistantText({
    familyId,
    rootSessionId: session.sessionId,
    timeoutMs: 180_000,
  });
  const delegatedEvents = await sql<
    {
      child_session_hash: string;
      parent_session_hash: string;
      root_session_hash: string;
    }[]
  >`
    select
      props->>'child_session_hash' as child_session_hash,
      props->>'parent_session_hash' as parent_session_hash,
      props->>'root_session_hash' as root_session_hash
    from public.events
    where family_id = ${familyId}
      and name = 'conversation.session_delegated'
    order by created_at
  `;
  const familyMessages = await sql<{ session_id: string }[]>`
    select session_id
    from public.conversation_messages
    where family_id = ${familyId}
  `;
  const webDeliveries = await sql<{ session_id: string }[]>`
    select message.session_id
    from public.conversation_deliveries delivery
    join public.conversation_messages message
      on message.id = delivery.message_id
    where delivery.family_id = ${familyId}
      and delivery.channel = 'web'
  `;
  const delegatedChildHashes = new Set(
    delegatedEvents.map((row) => row.child_session_hash),
  );

  assert.match(rootAssistantText, /CHILD_RESULT_OK/u);
  assert.equal(delegatedEvents.length, 1);
  assert.equal(
    delegatedEvents[0]?.parent_session_hash,
    hashSessionId(session.sessionId),
  );
  assert.equal(
    delegatedEvents[0]?.root_session_hash,
    hashSessionId(session.sessionId),
  );
  assert.equal(
    familyMessages.filter((row) =>
      delegatedChildHashes.has(hashSessionId(row.session_id)),
    ).length,
    0,
  );
  assert.equal(
    webDeliveries.filter((row) =>
      delegatedChildHashes.has(hashSessionId(row.session_id)),
    ).length,
    0,
  );

  console.log(
    "PASS  Root result persisted with one PII-free delegated event and no child persistence or delivery.",
  );
} finally {
  if (familyId) {
    await sql`delete from public.families where id = ${familyId}`;
  }
  if (userId) {
    await sql`delete from auth.users where id = ${userId}`;
  }
  await sql.end();
}
