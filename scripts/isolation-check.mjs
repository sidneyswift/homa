#!/usr/bin/env node
/**
 * Isolation guard for selected anonymous and authenticated operations.
 * It creates and deletes temporary Auth users and family fixtures in the
 * configured Supabase project when SUPABASE_DB_PASSWORD is available. Confirm
 * the target before running it. Covered checks include:
 *   1. waitlist and events are write-only (reads return nothing)
 *   2. tenancy tables are invisible and unwritable to anonymous traffic
 *   3. the events namespace and waitlist status cannot be abused on insert
 *   4. authenticated members cannot read or write another family's rows
 *   5. ChildProgress tables are family-readable and server-write-only
 *
 * Usage: node scripts/isolation-check.mjs
 * Env: reads apps/web/.env.local (NEXT_PUBLIC_SUPABASE_URL /
 * _PUBLISHABLE_KEY / SUPABASE_DB_PASSWORD).
 * Exit code 0 = all covered checks passed, not proof of every possible table
 * operation or application query path.
 */

import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Fine in CI, where the vars arrive via the environment.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(2);
}

const failures = [];
const coveredTables = new Set();
const fixtureFamilyIds = [];
const fixtureKnowledgeIds = [];
const fixtureUserIds = [];
let morningResearchBriefV2SchemaAvailable = false;
let morningOfferFunnelSchemaAvailable = false;

const projectRef = new URL(url).hostname.split(".")[0];
const sql = dbPassword
  ? postgres({
      host: "aws-0-us-east-1.pooler.supabase.com",
      port: 6543,
      database: "postgres",
      username: `postgres.${projectRef}`,
      password: dbPassword,
      ssl: "require",
      prepare: false,
      max: 1,
      idle_timeout: 10,
      connect_timeout: 15,
    })
  : null;

async function rest(pathname, init = {}) {
  const response = await fetch(`${url}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...init.headers,
    },
  });
  return response;
}

async function restAs(accessToken, pathname, init = {}) {
  return rest(pathname, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });
}

async function authRequest(pathname, body) {
  const response = await fetch(`${url}/auth/v1/${pathname}`, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(`auth ${pathname} returned non-JSON body ${raw.slice(0, 100)}`);
  }
  if (!response.ok) {
    throw new Error(`auth ${pathname} failed with HTTP ${response.status}: ${raw.slice(0, 160)}`);
  }
  return parsed;
}

async function jsonResponse(response, label) {
  const raw = await response.text();
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(`${label} returned non-JSON body ${raw.slice(0, 100)}`);
  }
  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}: ${raw.slice(0, 160)}`);
  }
  return parsed;
}

async function signUpFixtureUser(label, suffix) {
  const email = `isolation-${label}-${suffix}@example.com`;
  const password = `Homa-isolation-${suffix}-${label}-A1!`;
  const signedUp = await authRequest("signup", { email, password });
  let accessToken = signedUp.access_token;
  let userId = signedUp.user?.id;
  if (!accessToken) {
    const signedIn = await authRequest("token?grant_type=password", { email, password });
    accessToken = signedIn.access_token;
    userId = userId ?? signedIn.user?.id;
  }
  if (!accessToken || !userId) {
    throw new Error(`auth signup for ${label} did not return a usable session`);
  }
  fixtureUserIds.push(userId);
  return { accessToken, userId };
}

async function createFixtureFamily(user, label) {
  const body = await jsonResponse(
    await restAs(user.accessToken, "rpc/create_my_family", {
      method: "POST",
      body: JSON.stringify({
        family_name: `Isolation ${label}`,
        family_us_state: "AZ",
        parent_name: `Isolation ${label}`,
      }),
      headers: { Prefer: "return=representation" },
    }),
    `create fixture family ${label}`,
  );
  const familyId = Array.isArray(body) ? body[0]?.family_id : body?.family_id;
  if (!familyId) throw new Error(`create_my_family for ${label} returned no family_id`);
  fixtureFamilyIds.push(familyId);
  return familyId;
}

async function insertFixtureRow(user, table, row, label) {
  const body = await jsonResponse(
    await restAs(user.accessToken, `${table}?select=id`, {
      method: "POST",
      body: JSON.stringify(row),
      headers: { Prefer: "return=representation" },
    }),
    label,
  );
  const id = Array.isArray(body) ? body[0]?.id : body?.id;
  if (!id) throw new Error(`${label} returned no id`);
  return id;
}

async function expectAuthenticatedRead(
  accessToken,
  table,
  id,
  expectedCount,
  label,
  keyColumn = "id",
) {
  coveredTables.add(table);
  const response = await restAs(
    accessToken,
    `${table}?select=${keyColumn}&${keyColumn}=eq.${id}&limit=2`,
    { headers: { Prefer: "" } },
  );
  const raw = await response.text();
  if (!response.ok) {
    report(label, false, `HTTP ${response.status}, ${raw.slice(0, 100)}`);
    return;
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    report(label, false, `HTTP ${response.status}, non-JSON body ${raw.slice(0, 100)}`);
    return;
  }
  const ok = Array.isArray(body) && body.length === expectedCount;
  report(label, ok, `HTTP ${response.status}, ${JSON.stringify(body).slice(0, 100)}`);
}

async function expectAuthenticatedReadDenied(accessToken, table, label) {
  coveredTables.add(table);
  const response = await restAs(accessToken, `${table}?select=*&limit=1`, {
    headers: { Prefer: "" },
  });
  const ok = response.status === 401 || response.status === 403;
  report(label, ok, `HTTP ${response.status}`);
}

async function expectAuthenticatedInsertDenied(accessToken, table, row, label) {
  coveredTables.add(table);
  const response = await restAs(accessToken, table, {
    method: "POST",
    body: JSON.stringify(row),
  });
  const ok = response.status === 401 || response.status === 403;
  report(label, ok, `HTTP ${response.status}`);
}

async function expectAuthenticatedUpdateDenied(
  accessToken,
  table,
  keyColumn,
  keyValue,
  changes,
  label,
) {
  coveredTables.add(table);
  const response = await restAs(accessToken, `${table}?${keyColumn}=eq.${keyValue}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
  const ok = response.status === 401 || response.status === 403;
  report(label, ok, `HTTP ${response.status}`);
}

async function expectAuthenticatedDeleteDenied(
  accessToken,
  table,
  keyColumn,
  keyValue,
  label,
) {
  coveredTables.add(table);
  const response = await restAs(accessToken, `${table}?${keyColumn}=eq.${keyValue}`, {
    method: "DELETE",
  });
  const ok = response.status === 401 || response.status === 403;
  report(label, ok, `HTTP ${response.status}`);
}

async function expectAuthenticatedWritesDenied(
  accessToken,
  table,
  fixture,
  label,
) {
  await expectAuthenticatedInsertDenied(
    accessToken,
    table,
    fixture.insertRow,
    `${label} insert`,
  );
  await expectAuthenticatedUpdateDenied(
    accessToken,
    table,
    fixture.keyColumn,
    fixture.keyValue,
    fixture.updateRow,
    `${label} update`,
  );
  await expectAuthenticatedDeleteDenied(
    accessToken,
    table,
    fixture.keyColumn,
    fixture.keyValue,
    `${label} delete`,
  );
}

async function expectEmptyRead(table) {
  coveredTables.add(table);
  const response = await rest(`${table}?select=*&limit=5`, { headers: { Prefer: "" } });
  const raw = await response.text();
  if (!response.ok) {
    report(
      `anon read of ${table} exposes nothing`,
      false,
      `HTTP ${response.status}, ${raw.slice(0, 100)}`,
    );
    return;
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    report(
      `anon read of ${table} exposes nothing`,
      false,
      `HTTP ${response.status}, non-JSON body ${raw.slice(0, 100)}`,
    );
    return;
  }

  const ok = Array.isArray(body) && body.length === 0;
  report(
    `anon read of ${table} exposes nothing`,
    ok,
    `HTTP ${response.status}, ${JSON.stringify(body).slice(0, 100)}`,
  );
}

async function expectReadDenied(table) {
  coveredTables.add(table);
  const response = await rest(`${table}?select=*&limit=5`, { headers: { Prefer: "" } });
  const raw = await response.text();
  const ok = response.status === 401 || response.status === 403;
  report(
    `anon read of ${table} is denied`,
    ok,
    `HTTP ${response.status}, ${raw.slice(0, 100)}`,
  );
}

async function expectAnonymousNoRowsOrDenied(table) {
  coveredTables.add(table);
  const response = await rest(`${table}?select=*&limit=5`, { headers: { Prefer: "" } });
  const raw = await response.text();
  if (response.status === 401 || response.status === 403) {
    report(`anon read of ${table} exposes nothing`, true, `HTTP ${response.status}`);
    return;
  }
  if (!response.ok) {
    report(
      `anon read of ${table} exposes nothing`,
      false,
      `HTTP ${response.status}, ${raw.slice(0, 100)}`,
    );
    return;
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    report(
      `anon read of ${table} exposes nothing`,
      false,
      `HTTP ${response.status}, non-JSON body ${raw.slice(0, 100)}`,
    );
    return;
  }
  const ok = Array.isArray(body) && body.length === 0;
  report(
    `anon read of ${table} exposes nothing`,
    ok,
    `HTTP ${response.status}, ${JSON.stringify(body).slice(0, 100)}`,
  );
}

async function expectInsertDenied(table, row, label) {
  coveredTables.add(table);
  const response = await rest(table, { method: "POST", body: JSON.stringify(row) });
  const ok = response.status === 401 || response.status === 403;
  report(label, ok, `HTTP ${response.status}`);
}

async function childProgressSchemaExists() {
  const rows = await sql`
    select count(*)::integer as table_count
    from unnest(array[
      'public.child_progress_evidence',
      'public.child_progress_operations',
      'public.child_progress_revisions',
      'public.child_progress_live',
      'public.progress_check_ins',
      'public.progress_check_in_responses',
      'public.child_progress_conflicts',
      'public.child_progress_snapshots',
      'public.map_walk_prompts',
      'public.child_observations'
    ]) as expected(table_name)
    where to_regclass(expected.table_name) is not null
  `;
  return rows[0]?.table_count === 10;
}

async function morningResearchBriefV2SchemaExists() {
  const rows = await sql`
    select count(*)::integer as table_count
    from unnest(array[
      'public.research_brief_preparations',
      'public.family_knowledge_use',
      'public.research_brief_feedback'
    ]) as expected(table_name)
    where to_regclass(expected.table_name) is not null
  `;
  return rows[0]?.table_count === 3;
}

async function morningOfferFunnelSchemaExists() {
  const rows = await sql`
    select
      to_regclass(
        'public.conversation_offer_fulfillments'
      ) is not null as table_exists,
      (
        select count(*)::integer
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'conversation_open_loops'
          and column_name in ('resolution_method', 'classifier_version')
      ) = 2 as audit_columns_exist,
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'conversation_offer_fulfillments'
          and column_name = 'completed_at'
      ) as outbox_column_exists,
      exists (
        select 1
        from pg_trigger
        where tgname = 'protect_material_offer_provenance'
          and not tgisinternal
      ) as provenance_trigger_exists,
      (
        select count(*)::integer
        from information_schema.columns
        where table_schema = 'public'
          and (
            (
              table_name = 'conversation_thread_bindings'
              and column_name = 'pending_offer_delivery_id'
            )
            or (
              table_name in ('materials', 'agent_schedules')
              and column_name = 'source_offer_delivery_id'
            )
          )
      ) = 3 as provenance_columns_exist
  `;
  return (
    rows[0]?.table_exists &&
    rows[0]?.audit_columns_exist &&
    rows[0]?.outbox_column_exists &&
    rows[0]?.provenance_trigger_exists &&
    rows[0]?.provenance_columns_exist
  );
}

async function expectPrivilegedSqlRejected(
  label,
  operation,
  expectedCode = null,
) {
  const acceptedSentinel = `constraint probe accepted: ${label}`;
  try {
    await sql.begin(async (transaction) => {
      await operation(transaction);
      await transaction`set constraints all immediate`;
      throw new Error(acceptedSentinel);
    });
  } catch (error) {
    if (error instanceof Error && error.message === acceptedSentinel) {
      report(label, false, "privileged SQL was accepted");
      return;
    }
    const code = typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "unknown";
    const expectedConstraintCode = expectedCode === null
      ? code === "23503" || code === "23505" || code === "23514"
      : code === expectedCode;
    const message =
      error instanceof Error ? error.message.replace(/\s+/gu, " ") : "unknown";
    report(
      label,
      expectedConstraintCode,
      `SQLSTATE ${code}: ${message.slice(0, 180)}`,
    );
    return;
  }
  report(label, false, "constraint probe returned without a result");
}

async function insertFixtureFamilyMember(familyId, userId, label) {
  const rows = await sql`
    insert into public.family_members (family_id, user_id, role)
    values (${familyId}, ${userId}, 'partner')
    returning user_id
  `;
  if (rows[0]?.user_id !== userId) {
    throw new Error(`${label} returned no member user id`);
  }
}

async function expectMorningResearchBriefV2Isolation(context) {
  const [knowledge] = await sql`
    insert into public.knowledge_bank (
      topic_type,
      topic_key,
      title,
      summary,
      content,
      citations,
      confidence,
      contributed_by,
      status
    )
    values (
      'study',
      'isolation-morning-brief',
      'Isolation morning brief source',
      'A fixture used only to verify morning brief tenant isolation.',
      'This fixture carries enough content to satisfy the knowledge bank contract.',
      '[]'::jsonb,
      'high',
      'founder',
      'active'
    )
    returning id
  `;
  fixtureKnowledgeIds.push(knowledge.id);
  const taskRuns = await sql`
    insert into public.homa_task_runs (
      family_id,
      kind,
      status,
      title
    )
    values
      (
        ${context.familyBId},
        'morning_brief',
        'done',
        'Isolation morning brief'
      ),
      (
        ${context.familyBId},
        'morning_brief',
        'done',
        'Isolation morning brief write probe'
      )
    returning id
  `;
  const fixtureTaskRunId = taskRuns[0].id;
  const writeProbeTaskRunId = taskRuns[1].id;
  await sql`
    insert into public.research_brief_preparations (
      task_run_id,
      family_id,
      child_id,
      knowledge_bank_id,
      draft,
      draft_hash,
      source_snapshot,
      prepared_at,
      delivered_at
    )
    values (
      ${fixtureTaskRunId},
      ${context.familyBId},
      ${context.childBId},
      ${knowledge.id},
      'Isolation prepared brief.',
      ${"a".repeat(64)},
      '{"title":"Isolation source"}'::jsonb,
      now(),
      now()
    )
  `;
  const [knowledgeUse] = await sql`
    insert into public.family_knowledge_use (
      family_id,
      knowledge_bank_id,
      task_run_id,
      used_at
    )
    values (
      ${context.familyBId},
      ${knowledge.id},
      ${fixtureTaskRunId},
      now()
    )
    returning id
  `;
  const [feedback] = await sql`
    insert into public.research_brief_feedback (
      family_id,
      task_run_id,
      member_user_id,
      signal,
      created_at,
      updated_at
    )
    values (
      ${context.familyBId},
      ${fixtureTaskRunId},
      ${context.familyBUserId},
      'helpful',
      now(),
      now()
    )
    returning id
  `;

  await expectAuthenticatedRead(
    context.familyBAccessToken,
    "research_brief_feedback",
    fixtureTaskRunId,
    1,
    "auth member can read own family research brief feedback",
    "task_run_id",
  );
  await expectAuthenticatedRead(
    context.familyAAccessToken,
    "research_brief_feedback",
    fixtureTaskRunId,
    0,
    "auth member cannot read another family's research brief feedback",
    "task_run_id",
  );

  const writeFixtures = [
    {
      table: "research_brief_preparations",
      label: "research brief preparation",
      keyColumn: "task_run_id",
      keyValue: fixtureTaskRunId,
      insertRow: {
        task_run_id: writeProbeTaskRunId,
        family_id: context.familyBId,
        child_id: context.childBId,
        knowledge_bank_id: knowledge.id,
        draft: "Authenticated clients must not prepare briefs.",
        draft_hash: "b".repeat(64),
        source_snapshot: { title: "Forged source" },
        prepared_at: new Date().toISOString(),
      },
      updateRow: { draft: "Authenticated clients must not edit briefs." },
    },
    {
      table: "family_knowledge_use",
      label: "family knowledge use",
      keyColumn: "id",
      keyValue: knowledgeUse.id,
      insertRow: {
        family_id: context.familyBId,
        knowledge_bank_id: knowledge.id,
        task_run_id: writeProbeTaskRunId,
        used_at: new Date().toISOString(),
      },
      updateRow: { used_at: new Date().toISOString() },
    },
    {
      table: "research_brief_feedback",
      label: "research brief feedback",
      keyColumn: "id",
      keyValue: feedback.id,
      insertRow: {
        family_id: context.familyBId,
        task_run_id: writeProbeTaskRunId,
        member_user_id: context.familyBUserId,
        signal: "not_for_us",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      updateRow: {
        signal: "not_for_us",
        updated_at: new Date().toISOString(),
      },
    },
  ];
  for (const fixture of writeFixtures) {
    await expectAuthenticatedWritesDenied(
      context.familyBAccessToken,
      fixture.table,
      fixture,
      `auth member cannot mutate own ${fixture.label}`,
    );
  }

  await expectPrivilegedSqlRejected(
    "constraint rejects preparation paired with another family's task run",
    async (transaction) => {
      await transaction`
        insert into public.research_brief_preparations (
          task_run_id,
          family_id,
          child_id,
          knowledge_bank_id,
          draft,
          draft_hash,
          source_snapshot,
          prepared_at
        )
        values (
          ${writeProbeTaskRunId},
          ${context.familyAId},
          ${context.childAId},
          ${knowledge.id},
          'Cross-family preparation.',
          ${"c".repeat(64)},
          '{}'::jsonb,
          now()
        )
      `;
    },
    "23503",
  );
  await expectPrivilegedSqlRejected(
    "constraint rejects knowledge use paired with another family's task run",
    async (transaction) => {
      await transaction`
        insert into public.family_knowledge_use (
          family_id,
          knowledge_bank_id,
          task_run_id,
          used_at
        )
        values (
          ${context.familyAId},
          ${knowledge.id},
          ${writeProbeTaskRunId},
          now()
        )
      `;
    },
    "23503",
  );
  await expectPrivilegedSqlRejected(
    "constraint rejects feedback paired with another family's task run",
    async (transaction) => {
      await transaction`
        insert into public.research_brief_feedback (
          family_id,
          task_run_id,
          member_user_id,
          signal,
          created_at,
          updated_at
        )
        values (
          ${context.familyAId},
          ${writeProbeTaskRunId},
          ${context.familyAUserId},
          'helpful',
          now(),
          now()
        )
      `;
    },
    "23503",
  );
}

async function insertChildProgressFixtures(
  childId,
  familyId,
  evidenceMemberUserIdA,
  evidenceMemberUserIdB,
) {
  const [evidenceA] = await sql`
    insert into public.child_progress_evidence (
      child_id,
      family_id,
      item_id,
      answer,
      source,
      member_user_id,
      quote,
      idempotency_key
    )
    values (
      ${childId},
      ${familyId},
      'isolation.progress.item',
      'easily',
      'checklist',
      ${evidenceMemberUserIdA},
      'Isolation evidence A.',
      'isolation:evidence:a'
    )
    returning id
  `;
  const [evidenceB] = await sql`
    insert into public.child_progress_evidence (
      child_id,
      family_id,
      item_id,
      answer,
      source,
      member_user_id,
      quote,
      idempotency_key
    )
    values (
      ${childId},
      ${familyId},
      'isolation.progress.item',
      'not_yet',
      'checklist',
      ${evidenceMemberUserIdB},
      'Isolation evidence B.',
      'isolation:evidence:b'
    )
    returning id
  `;
  const [inboundMessage] = await sql`
    insert into public.conversation_messages (
      family_id,
      session_id,
      sequence,
      role,
      content,
      channel,
      member_user_id,
      provider_message_id
    )
    values (
      ${familyId},
      ${`isolation-progress:${childId}`},
      1,
      'user',
      'Isolation progress response.',
      'web',
      ${evidenceMemberUserIdA},
      ${`isolation-progress:${childId}`}
    )
    returning id
  `;
  const [live] = await sql`
    insert into public.child_progress_live (
      child_id,
      family_id,
      projection,
      scores,
      bank_version,
      projection_version,
      projection_date,
      source_revision,
      evidence_count,
      open_conflict_count
    )
    values (
      ${childId},
      ${familyId},
      '{}'::jsonb,
      '{}'::jsonb,
      'isolation-bank',
      'isolation-projection',
      current_date,
      2,
      2,
      1
    )
    returning child_id
  `;
  const [checkIn] = await sql`
    insert into public.progress_check_ins (
      child_id,
      family_id,
      purpose,
      scope,
      state,
      active_member_user_id,
      prompt_recipient_member_user_id,
      revision,
      current_item_id,
      pending_runtime_session_id,
      pending_turn_id
    )
    values (
      ${childId},
      ${familyId},
      'whole_map_refresh',
      '{}'::jsonb,
      'active',
      ${evidenceMemberUserIdA},
      ${evidenceMemberUserIdA},
      1,
      'isolation.progress.item',
      'isolation-progress-session',
      'isolation-progress-turn'
    )
    returning id
  `;
  const [response] = await sql`
    insert into public.progress_check_in_responses (
      child_id,
      family_id,
      check_in_id,
      revision,
      item_id,
      answer,
      member_user_id,
      inbound_message_id,
      idempotency_key
    )
    values (
      ${childId},
      ${familyId},
      ${checkIn.id},
      1,
      'isolation.progress.item',
      'skip',
      ${evidenceMemberUserIdA},
      ${inboundMessage.id},
      'isolation:response:1'
    )
    returning id
  `;
  const [conflict] = await sql`
    insert into public.child_progress_conflicts (
      child_id,
      family_id,
      item_id,
      evidence_id_a,
      evidence_id_b
    )
    values (
      ${childId},
      ${familyId},
      'isolation.progress.item',
      ${evidenceA.id},
      ${evidenceB.id}
    )
    returning id
  `;
  const operationKey = 'isolation:operation:1';
  await sql`
    insert into public.child_progress_operations (
      child_id,
      family_id,
      idempotency_key,
      payload_hash,
      status,
      evidence_ids,
      affected_item_ids,
      conflict_ids,
      result
    )
    values (
      ${childId},
      ${familyId},
      ${operationKey},
      ${"a".repeat(64)},
      'conflict_open',
      array[${evidenceB.id}::uuid],
      array['isolation.progress.item'],
      array[${conflict.id}::uuid],
      ${sql.json({
        status: "conflict_open",
        evidenceIds: [evidenceB.id],
        affectedItemIds: ["isolation.progress.item"],
        conflictIds: [conflict.id],
      })}
    )
  `;
  const [snapshot] = await sql`
    insert into public.child_progress_snapshots (
      child_id,
      family_id,
      snapshot_kind,
      check_in_id,
      evidence_ids,
      age_months,
      bank_version,
      scorer_version,
      projection,
      scores
    )
    values (
      ${childId},
      ${familyId},
      'check_in_group',
      ${checkIn.id},
      array[${evidenceA.id}::uuid, ${evidenceB.id}::uuid],
      72,
      'isolation-bank',
      'isolation-scorer',
      '{}'::jsonb,
      '{}'::jsonb
    )
    returning id
  `;
  const [observation] = await sql`
    insert into public.child_observations (
      child_id,
      family_id,
      member_user_id,
      quote,
      channel,
      classification,
      observed_at
    )
    values (
      ${childId},
      ${familyId},
      ${evidenceMemberUserIdA},
      'Isolation observation quote.',
      'web',
      'no_match',
      now()
    )
    returning id
  `;

  return {
    childId: live.child_id,
    checkInId: checkIn.id,
    conflictId: conflict.id,
    evidenceId: evidenceA.id,
    evidenceIdB: evidenceB.id,
    observationId: observation.id,
    operationKey,
    responseId: response.id,
    snapshotId: snapshot.id,
  };
}

async function expectChildProgressConstraintRejections(context) {
  await expectPrivilegedSqlRejected(
    "constraint rejects wrong-family child progress operation",
    async (transaction) => {
      await transaction`
        insert into public.child_progress_operations (
          child_id,
          family_id,
          idempotency_key,
          payload_hash,
          status,
          result
        )
        values (
          ${context.childBId},
          ${context.familyAId},
          'isolation:operation:wrong-family',
          ${"e".repeat(64)},
          'pending',
          '{"status":"pending"}'::jsonb
        )
      `;
    },
  );
  await expectPrivilegedSqlRejected(
    "constraint rejects operation evidence outside its child",
    async (transaction) => {
      const missingEvidenceId = await transaction`
        select gen_random_uuid() as id
      `;
      await transaction`
        insert into public.child_progress_operations (
          child_id,
          family_id,
          idempotency_key,
          payload_hash,
          status,
          evidence_ids,
          affected_item_ids,
          result
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'isolation:operation:missing-evidence',
          ${"f".repeat(64)},
          'recorded',
          array[${missingEvidenceId[0].id}::uuid],
          array['math.probe'],
          ${transaction.json({
            status: "recorded",
            evidenceIds: [missingEvidenceId[0].id],
            affectedItemIds: ["math.probe"],
            conflictIds: [],
          })}
        )
      `;
    },
  );
  await expectPrivilegedSqlRejected(
    "constraint rejects wrong-family child evidence",
    async (transaction) => {
      await transaction`
        insert into public.child_progress_evidence (
          child_id,
          family_id,
          item_id,
          answer,
          source,
          idempotency_key
        )
        values (
          ${context.childBId},
          ${context.familyAId},
          'isolation.probe.wrong-family',
          'easily',
          'checklist',
          'isolation:probe:wrong-family'
        )
      `;
    },
  );

  await expectPrivilegedSqlRejected(
    "constraint rejects member outside evidence family",
    async (transaction) => {
      await transaction`
        insert into public.child_progress_evidence (
          child_id,
          family_id,
          item_id,
          answer,
          source,
          member_user_id,
          idempotency_key
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'isolation.probe.bad-member',
          'easily',
          'checklist',
          ${context.familyAUserId},
          'isolation:probe:bad-member'
        )
      `;
    },
  );

  await expectPrivilegedSqlRejected(
    "constraint rejects open conflict without attributed adults",
    async (transaction) => {
      const evidence = await transaction`
        insert into public.child_progress_evidence (
          child_id,
          family_id,
          item_id,
          answer,
          source,
          idempotency_key
        )
        values
          (
            ${context.childBId},
            ${context.familyBId},
            'isolation.probe.unattributed',
            'easily',
            'checklist',
            'isolation:probe:unattributed:a'
          ),
          (
            ${context.childBId},
            ${context.familyBId},
            'isolation.probe.unattributed',
            'not_yet',
            'checklist',
            'isolation:probe:unattributed:b'
          )
        returning id
      `;
      await transaction`
        insert into public.child_progress_conflicts (
          child_id,
          family_id,
          item_id,
          evidence_id_a,
          evidence_id_b
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'isolation.probe.unattributed',
          ${evidence[0].id},
          ${evidence[1].id}
        )
      `;
    },
  );

  await expectPrivilegedSqlRejected(
    "constraint rejects resolved conflict inserted without resolver",
    async (transaction) => {
      await transaction`
        insert into public.child_progress_conflicts (
          child_id,
          family_id,
          item_id,
          evidence_id_a,
          evidence_id_b,
          state,
          resolved_answer,
          resolved_evidence_id,
          resolved_at
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'isolation.progress.item',
          ${context.evidenceId},
          ${context.evidenceIdB},
          'resolved',
          'easily',
          ${context.evidenceId},
          now()
        )
      `;
    },
  );

  await expectPrivilegedSqlRejected(
    "constraint rejects third-row conflict resolution",
    async (transaction) => {
      const [thirdEvidence] = await transaction`
        insert into public.child_progress_evidence (
          child_id,
          family_id,
          item_id,
          answer,
          source,
          member_user_id,
          idempotency_key
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'isolation.progress.item',
          'easily',
          'checklist',
          ${context.familyBUserId},
          'isolation:probe:third-resolution-row'
        )
        returning id
      `;
      await transaction`
        update public.child_progress_conflicts
        set state = 'resolved',
            resolved_answer = 'easily',
            resolved_evidence_id = ${thirdEvidence.id},
            resolved_by_member_user_id = ${context.familyBUserId},
            resolved_at = now()
        where id = ${context.conflictId}
          and child_id = ${context.childBId}
          and family_id = ${context.familyBId}
      `;
    },
  );

  await expectPrivilegedSqlRejected(
    "constraint rejects unattributed resolved conflict insert",
    async (transaction) => {
      const evidence = await transaction`
        insert into public.child_progress_evidence (
          child_id,
          family_id,
          item_id,
          answer,
          source,
          idempotency_key
        )
        values
          (
            ${context.childBId},
            ${context.familyBId},
            'isolation.probe.resolved-unattributed',
            'easily',
            'checklist',
            'isolation:probe:resolved-unattributed:a'
          ),
          (
            ${context.childBId},
            ${context.familyBId},
            'isolation.probe.resolved-unattributed',
            'not_yet',
            'checklist',
            'isolation:probe:resolved-unattributed:b'
          )
        returning id
      `;
      await transaction`
        insert into public.child_progress_conflicts (
          child_id,
          family_id,
          item_id,
          evidence_id_a,
          evidence_id_b,
          state,
          resolved_answer,
          resolved_evidence_id,
          resolved_by_member_user_id,
          resolved_at
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'isolation.probe.resolved-unattributed',
          ${evidence[0].id},
          ${evidence[1].id},
          'resolved',
          'easily',
          ${evidence[0].id},
          ${context.familyBUserId},
          now()
        )
      `;
    },
  );

  await expectPrivilegedSqlRejected(
    "constraint rejects conflict with the same evidence twice",
    async (transaction) => {
      const evidence = await transaction`
        insert into public.child_progress_evidence (
          child_id,
          family_id,
          item_id,
          answer,
          source,
          member_user_id,
          idempotency_key
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'isolation.probe.same-evidence',
          'easily',
          'checklist',
          ${context.familyBUserId},
          'isolation:probe:same-evidence'
        )
        returning id
      `;
      await transaction`
        insert into public.child_progress_conflicts (
          child_id,
          family_id,
          item_id,
          evidence_id_a,
          evidence_id_b
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'isolation.probe.same-evidence',
          ${evidence[0].id},
          ${evidence[0].id}
        )
      `;
    },
  );

  await expectPrivilegedSqlRejected(
    "constraint rejects conflict evidence with equal answers",
    async (transaction) => {
      const evidence = await transaction`
        insert into public.child_progress_evidence (
          child_id,
          family_id,
          item_id,
          answer,
          source,
          member_user_id,
          idempotency_key
        )
        values
          (
            ${context.childBId},
            ${context.familyBId},
            'isolation.probe.equal-answers',
            'easily',
            'checklist',
            ${context.familyBUserId},
            'isolation:probe:equal-answers:a'
          ),
          (
            ${context.childBId},
            ${context.familyBId},
            'isolation.probe.equal-answers',
            'easily',
            'checklist',
            ${context.familyBSecondUserId},
            'isolation:probe:equal-answers:b'
          )
        returning id
      `;
      await transaction`
        insert into public.child_progress_conflicts (
          child_id,
          family_id,
          item_id,
          evidence_id_a,
          evidence_id_b
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'isolation.probe.equal-answers',
          ${evidence[0].id},
          ${evidence[1].id}
        )
      `;
    },
  );

  await expectPrivilegedSqlRejected(
    "constraint rejects response evidence from another member",
    async (transaction) => {
      const [inboundMessage] = await transaction`
        insert into public.conversation_messages (
          family_id,
          session_id,
          sequence,
          role,
          content,
          channel,
          member_user_id
        )
        values (
          ${context.familyBId},
          'isolation-probe-response-member',
          1,
          'user',
          'Isolation member mismatch response.',
          'web',
          ${context.familyBSecondUserId}
        )
        returning id
      `;
      const checkIns = await transaction`
        insert into public.progress_check_ins (
          child_id,
          family_id,
          purpose,
          scope,
          state,
          revision,
          completed_at
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'age_refresh',
          '{}'::jsonb,
          'completed',
          1,
          now()
        )
        returning id
      `;
      const evidence = await transaction`
        insert into public.child_progress_evidence (
          child_id,
          family_id,
          item_id,
          answer,
          source,
          member_user_id,
          channel,
          message_id,
          check_in_id,
          idempotency_key
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'isolation.probe.response-member',
          'easily',
          'check_in',
          ${context.familyBUserId},
          'web',
          ${inboundMessage.id},
          ${checkIns[0].id},
          'isolation:probe:response-member'
        )
        returning id
      `;
      await transaction`
        insert into public.progress_check_in_responses (
          child_id,
          family_id,
          check_in_id,
          revision,
          item_id,
          answer,
          member_user_id,
          inbound_message_id,
          is_evidence,
          evidence_id,
          idempotency_key
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          ${checkIns[0].id},
          1,
          'isolation.probe.response-member',
          'easily',
          ${context.familyBSecondUserId},
          ${inboundMessage.id},
          true,
          ${evidence[0].id},
          'isolation:probe:response-member'
        )
      `;
    },
  );

  await expectPrivilegedSqlRejected(
    "constraint rejects response evidence for another item",
    async (transaction) => {
      const [inboundMessage] = await transaction`
        insert into public.conversation_messages (
          family_id,
          session_id,
          sequence,
          role,
          content,
          channel,
          member_user_id
        )
        values (
          ${context.familyBId},
          'isolation-probe-response-item',
          1,
          'user',
          'Isolation item mismatch response.',
          'web',
          ${context.familyBUserId}
        )
        returning id
      `;
      const [evidence] = await transaction`
        insert into public.child_progress_evidence (
          child_id,
          family_id,
          item_id,
          answer,
          source,
          member_user_id,
          channel,
          message_id,
          check_in_id,
          idempotency_key
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'isolation.progress.item',
          'easily',
          'check_in',
          ${context.familyBUserId},
          'web',
          ${inboundMessage.id},
          ${context.checkInId},
          'isolation:probe:wrong-item-evidence'
        )
        returning id
      `;
      await transaction`
        insert into public.progress_check_in_responses (
          child_id,
          family_id,
          check_in_id,
          revision,
          item_id,
          answer,
          member_user_id,
          inbound_message_id,
          is_evidence,
          evidence_id,
          idempotency_key
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          ${context.checkInId},
          2,
          'isolation.probe.wrong-item',
          'easily',
          ${context.familyBUserId},
          ${inboundMessage.id},
          true,
          ${evidence.id},
          'isolation:probe:wrong-item'
        )
      `;
    },
  );

  await expectPrivilegedSqlRejected(
    "constraint rejects snapshot check-in from another family",
    async (transaction) => {
      const children = await transaction`
        insert into public.children (family_id, name, birth_month)
        values (
          ${context.familyAId},
          'Isolation probe child',
          '2020-01-01'
        )
        returning id
      `;
      await transaction`
        insert into public.child_progress_snapshots (
          child_id,
          family_id,
          snapshot_kind,
          check_in_id,
          age_months,
          bank_version,
          scorer_version,
          projection,
          scores
        )
        values (
          ${children[0].id},
          ${context.familyAId},
          'legacy',
          ${context.checkInId},
          72,
          'isolation-bank',
          'isolation-scorer',
          '{}'::jsonb,
          '{}'::jsonb
        )
      `;
    },
  );

  await expectPrivilegedSqlRejected(
    "constraint rejects snapshot evidence from another family",
    async (transaction) => {
      const children = await transaction`
        insert into public.children (family_id, name, birth_month)
        values (
          ${context.familyAId},
          'Isolation evidence child',
          '2020-01-01'
        )
        returning id
      `;
      const evidence = await transaction`
        insert into public.child_progress_evidence (
          child_id,
          family_id,
          item_id,
          answer,
          source,
          member_user_id,
          idempotency_key
        )
        values (
          ${children[0].id},
          ${context.familyAId},
          'isolation.probe.foreign-snapshot',
          'easily',
          'checklist',
          ${context.familyAUserId},
          'isolation:probe:foreign-snapshot'
        )
        returning id
      `;
      await transaction`
        insert into public.child_progress_snapshots (
          child_id,
          family_id,
          snapshot_kind,
          evidence_ids,
          age_months,
          bank_version,
          scorer_version,
          projection,
          scores
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'legacy',
          array[${evidence[0].id}::uuid],
          72,
          'isolation-bank',
          'isolation-scorer',
          '{}'::jsonb,
          '{}'::jsonb
        )
      `;
    },
  );

  await expectPrivilegedSqlRejected(
    "constraint rejects self-superseding evidence",
    async (transaction) => {
      const identities = await transaction`select gen_random_uuid() as id`;
      await transaction`
        insert into public.child_progress_evidence (
          id,
          child_id,
          family_id,
          item_id,
          answer,
          source,
          supersedes_id,
          idempotency_key
        )
        values (
          ${identities[0].id},
          ${context.childBId},
          ${context.familyBId},
          'isolation.probe.self-supersession',
          'easily',
          'checklist',
          ${identities[0].id},
          'isolation:probe:self-supersession'
        )
      `;
    },
  );

  await expectPrivilegedSqlRejected(
    "constraint rejects cross-item evidence supersession",
    async (transaction) => {
      const evidence = await transaction`
        insert into public.child_progress_evidence (
          child_id,
          family_id,
          item_id,
          answer,
          source,
          idempotency_key
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'isolation.probe.supersession-a',
          'easily',
          'checklist',
          'isolation:probe:supersession:a'
        )
        returning id
      `;
      await transaction`
        insert into public.child_progress_evidence (
          child_id,
          family_id,
          item_id,
          answer,
          source,
          supersedes_id,
          idempotency_key
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'isolation.probe.supersession-b',
          'not_yet',
          'checklist',
          ${evidence[0].id},
          'isolation:probe:supersession:b'
        )
      `;
    },
  );

  await expectPrivilegedSqlRejected(
    "constraint rejects duplicate open child check-ins",
    async (transaction) => {
      await transaction`
        insert into public.progress_check_ins (
          child_id,
          family_id,
          purpose,
          scope,
          state,
          current_item_id
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'whole_map_refresh',
          '{}'::jsonb,
          'active',
          'isolation.progress.duplicate'
        )
      `;
    },
  );

  await expectPrivilegedSqlRejected(
    "constraint rejects duplicate open child-item conflicts",
    async (transaction) => {
      await transaction`
        insert into public.child_progress_conflicts (
          child_id,
          family_id,
          item_id,
          evidence_id_a,
          evidence_id_b
        )
        values (
          ${context.childBId},
          ${context.familyBId},
          'isolation.progress.item',
          ${context.evidenceId},
          ${context.evidenceIdB}
        )
      `;
    },
  );
}

async function expectAuthenticatedChildAnswersWritesDenied(
  accessToken,
  childId,
  familyId,
) {
  await sql`
    insert into public.child_answers (
      child_id,
      question_id,
      answer,
      source
    )
    values (
      ${childId},
      'isolation.boundary.fixture',
      'easily',
      'checklist'
    )
    on conflict (child_id, question_id)
    do update set answer = excluded.answer, source = excluded.source
  `;
  const before = await sql`
    select
      count(*)::integer as total_count,
      count(*) filter (where superseded_at is null)::integer as active_count,
      max(created_at)::text as newest_created_at
    from public.child_progress_evidence
    where child_id = ${childId}
      and family_id = ${familyId}
      and idempotency_key like 'legacy-reconcile:%'
  `;

  await expectAuthenticatedInsertDenied(
    accessToken,
    "child_answers",
    {
      child_id: childId,
      question_id: "isolation.boundary.forged",
      answer: "easily",
      source: "checklist",
    },
    "auth member cannot insert child answers directly",
  );
  await expectAuthenticatedUpdateDenied(
    accessToken,
    "child_answers",
    "child_id",
    childId,
    { answer: "not_yet", source: "correction" },
    "auth member cannot update child answers directly",
  );
  await expectAuthenticatedDeleteDenied(
    accessToken,
    "child_answers",
    "child_id",
    childId,
    "auth member cannot delete child answers directly",
  );

  const after = await sql`
    select
      count(*)::integer as total_count,
      count(*) filter (where superseded_at is null)::integer as active_count,
      max(created_at)::text as newest_created_at
    from public.child_progress_evidence
    where child_id = ${childId}
      and family_id = ${familyId}
      and idempotency_key like 'legacy-reconcile:%'
  `;
  const unchanged =
    before[0]?.total_count === after[0]?.total_count
    && before[0]?.active_count === after[0]?.active_count
    && before[0]?.newest_created_at === after[0]?.newest_created_at;
  report(
    "denied child_answers writes create no reconciliation evidence",
    unchanged,
    JSON.stringify({ before: before[0], after: after[0] }),
  );
}

async function expectMultiColumnMemberDeletion(childId, familyId, userId) {
  try {
    await sql.begin(async (transaction) => {
      const checkIns = await transaction`
        update public.progress_check_ins
        set active_member_user_id = ${userId},
            prompt_recipient_member_user_id = ${userId}
        where child_id = ${childId}
          and family_id = ${familyId}
          and state = 'active'
        returning id
      `;
      if (checkIns.length !== 1) {
        throw new Error("member-removal fixture has no active check-in");
      }
      await transaction`delete from auth.users where id = ${userId}`;
      await transaction`set constraints all immediate`;
      const finalRows = await transaction`
        select state, pause_reason, active_member_user_id,
               prompt_recipient_member_user_id, revision
        from public.progress_check_ins
        where id = ${checkIns[0].id}
      `;
      if (
        finalRows[0]?.state !== "paused"
        || finalRows[0]?.pause_reason !== "member_removed"
        || finalRows[0]?.active_member_user_id !== null
        || finalRows[0]?.prompt_recipient_member_user_id !== null
        || finalRows[0]?.revision !== 2
      ) {
        throw new Error("member removal did not pause and clear check-in ownership");
      }
    });
    report(
      "Auth deletion pauses and clears owned check-ins",
      true,
      "paused with cleared ownership",
    );
  } catch (error) {
    report(
      "Auth deletion pauses and clears owned check-ins",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function cleanupIsolationFixtures() {
  if (!sql) return;
  try {
    if (fixtureFamilyIds.length > 0) {
      await sql`delete from public.families where id in ${sql(fixtureFamilyIds)}`;
    }
    if (fixtureKnowledgeIds.length > 0) {
      await sql`
        delete from public.knowledge_bank
        where id in ${sql(fixtureKnowledgeIds)}
      `;
    }
    if (fixtureUserIds.length > 0) {
      await sql`delete from auth.users where id in ${sql(fixtureUserIds)}`;
    }
  } catch (error) {
    report(
      "authenticated fixture cleanup",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function expectAuthenticatedIsolation() {
  if (!sql) {
    report(
      "authenticated cross-family fixture cleanup is configured",
      false,
      "missing SUPABASE_DB_PASSWORD",
    );
    return;
  }

  try {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const familyAUser = await signUpFixtureUser("a", suffix);
    const familyBUser = await signUpFixtureUser("b", suffix);
    const familyBSecondUser = await signUpFixtureUser("b-second", suffix);
    const familyBMultiColumnUser = await signUpFixtureUser("b-multi", suffix);
    const familyAId = await createFixtureFamily(familyAUser, "A");
    const familyBId = await createFixtureFamily(familyBUser, "B");
    await insertFixtureFamilyMember(
      familyBId,
      familyBSecondUser.userId,
      "create second Family B adult fixture",
    );
    await insertFixtureFamilyMember(
      familyBId,
      familyBMultiColumnUser.userId,
      "create multi-column Family B adult fixture",
    );

    await expectAuthenticatedReadDenied(
      familyAUser.accessToken,
      "family_sms_invites",
      "auth member cannot read family SMS invites",
    );
    await expectAuthenticatedReadDenied(
      familyAUser.accessToken,
      "family_phone_access_epochs",
      "auth member cannot read phone access epochs",
    );
    await expectAuthenticatedInsertDenied(
      familyAUser.accessToken,
      "family_sms_invites",
      {
        family_id: familyAId,
        phone_e164: "+15550002222",
        learning_update: "Authenticated clients must not forge this invite.",
      },
      "auth member cannot forge family SMS invites",
    );
    await expectAuthenticatedInsertDenied(
      familyAUser.accessToken,
      "family_phone_access_epochs",
      { phone_e164: "+15550002222" },
      "auth member cannot rotate phone access epochs",
    );

    const childAId = await insertFixtureRow(
      familyAUser,
      "children",
      { family_id: familyAId, name: "Isolation A child", birth_month: "2020-01-01" },
      "create Family A child fixture",
    );
    const childBId = await insertFixtureRow(
      familyBUser,
      "children",
      { family_id: familyBId, name: "Isolation B child", birth_month: "2020-01-01" },
      "create Family B child fixture",
    );
    if (morningResearchBriefV2SchemaAvailable) {
      await expectMorningResearchBriefV2Isolation({
        childAId,
        childBId,
        familyAAccessToken: familyAUser.accessToken,
        familyAId,
        familyAUserId: familyAUser.userId,
        familyBAccessToken: familyBUser.accessToken,
        familyBId,
        familyBUserId: familyBUser.userId,
      });
    }
    if (morningOfferFunnelSchemaAvailable) {
      await expectAuthenticatedReadDenied(
        familyAUser.accessToken,
        "conversation_offer_fulfillments",
        "auth member cannot read offer fulfillment attribution",
      );
      await expectAuthenticatedInsertDenied(
        familyAUser.accessToken,
        "conversation_offer_fulfillments",
        {
          family_id: familyAId,
          source_delivery_id: "00000000-0000-0000-0000-000000000000",
          kind: "material",
          reference_id: "00000000-0000-0000-0000-000000000000",
        },
        "auth member cannot forge offer fulfillment attribution",
      );
    }
    if (!(await childProgressSchemaExists())) {
      throw new Error("ChildProgress migration is not applied to the target");
    }
    const childProgressFixtures = await insertChildProgressFixtures(
      childBId,
      familyBId,
      familyBUser.userId,
      familyBSecondUser.userId,
    );
    await expectAuthenticatedChildAnswersWritesDenied(
      familyBUser.accessToken,
      childBId,
      familyBId,
    );
    await expectChildProgressConstraintRejections({
      familyAId,
      familyAUserId: familyAUser.userId,
      childBId,
      familyBId,
      familyBUserId: familyBUser.userId,
      familyBSecondUserId: familyBSecondUser.userId,
      checkInId: childProgressFixtures.checkInId,
      conflictId: childProgressFixtures.conflictId,
      evidenceId: childProgressFixtures.evidenceId,
      evidenceIdB: childProgressFixtures.evidenceIdB,
    });
    await expectMultiColumnMemberDeletion(
      childBId,
      familyBId,
      familyBMultiColumnUser.userId,
    );
    const memoryBId = await insertFixtureRow(
      familyBUser,
      "family_memories",
      {
        family_id: familyBId,
        child_id: childBId,
        kind: "fact",
        content: "Isolation check memory for Family B.",
        source: "parent",
      },
      "create Family B memory fixture",
    );
    const materialBId = await insertFixtureRow(
      familyBUser,
      "materials",
      {
        family_id: familyBId,
        child_id: childBId,
        title: "Isolation fixture",
        skill: "tenant isolation",
        pdf_url: "https://example.com/isolation.pdf",
        preview_url: "https://example.com/isolation.jpg",
        html: "<p>Isolation fixture.</p>",
      },
      "create Family B material fixture",
    );
    await expectAuthenticatedInsertDenied(
      familyBUser.accessToken,
      "materials",
      {
        family_id: familyBId,
        child_id: childBId,
        title: "Forged offer provenance",
        pdf_url: "https://example.com/forged.pdf",
        preview_url: "https://example.com/forged.jpg",
        html: "<p>Forged provenance must be denied.</p>",
        source_offer_delivery_id:
          "00000000-0000-0000-0000-000000000000",
      },
      "auth member cannot forge material offer provenance on insert",
    );
    await expectAuthenticatedUpdateDenied(
      familyBUser.accessToken,
      "materials",
      "id",
      materialBId,
      {
        source_offer_delivery_id:
          "00000000-0000-0000-0000-000000000000",
      },
      "auth member cannot forge material offer provenance on update",
    );
    // Chat attachments are server-write-only, so the fixture goes in
    // through the privileged connection, like the ChildProgress rows.
    const [chatAttachmentB] = await sql`
      insert into public.chat_attachments (
        family_id, child_id, member_user_id, url, media_type, kind, caption
      )
      values (
        ${familyBId},
        ${childBId},
        ${familyBUser.userId},
        'https://example.public.blob.vercel-storage.com/families/isolation/chat/fixture.jpg',
        'image/jpeg',
        'image',
        'Isolation chat attachment fixture.'
      )
      returning id
    `;

    await expectAuthenticatedRead(
      familyBUser.accessToken,
      "children",
      childBId,
      1,
      "auth member can read own child",
    );
    await expectAuthenticatedRead(
      familyAUser.accessToken,
      "children",
      childBId,
      0,
      "auth member cannot read another family's child",
    );
    await expectAuthenticatedRead(
      familyBUser.accessToken,
      "family_memories",
      memoryBId,
      1,
      "auth member can read own family memory",
    );
    await expectAuthenticatedRead(
      familyAUser.accessToken,
      "family_memories",
      memoryBId,
      0,
      "auth member cannot read another family's memory",
    );
    await expectAuthenticatedRead(
      familyBUser.accessToken,
      "materials",
      materialBId,
      1,
      "auth member can read own material",
    );
    await expectAuthenticatedRead(
      familyAUser.accessToken,
      "materials",
      materialBId,
      0,
      "auth member cannot read another family's material",
    );
    await expectAuthenticatedRead(
      familyBUser.accessToken,
      "chat_attachments",
      chatAttachmentB.id,
      1,
      "auth member can read own chat attachment",
    );
    await expectAuthenticatedRead(
      familyAUser.accessToken,
      "chat_attachments",
      chatAttachmentB.id,
      0,
      "auth member cannot read another family's chat attachment",
    );
    const chatAttachmentWriteFixture = {
      keyColumn: "id",
      keyValue: chatAttachmentB.id,
      insertRow: {
        family_id: familyBId,
        url: "https://example.com/client-forge.jpg",
        media_type: "image/jpeg",
        kind: "image",
      },
      updateRow: { caption: "Clients must never alter attachments." },
    };
    await expectAuthenticatedWritesDenied(
      familyBUser.accessToken,
      "chat_attachments",
      chatAttachmentWriteFixture,
      "auth member cannot mutate own chat attachment",
    );
    await expectAuthenticatedWritesDenied(
      familyAUser.accessToken,
      "chat_attachments",
      chatAttachmentWriteFixture,
      "cross-family token cannot mutate Family B chat attachment",
    );

    const childProgressRows = [
      {
        table: "child_progress_evidence",
        keyColumn: "id",
        keyValue: childProgressFixtures.evidenceId,
      },
      {
        table: "child_progress_operations",
        keyColumn: "idempotency_key",
        keyValue: childProgressFixtures.operationKey,
      },
      {
        table: "child_progress_revisions",
        keyColumn: "child_id",
        keyValue: childProgressFixtures.childId,
      },
      {
        table: "child_progress_operations",
        label: "child progress operation",
        keyColumn: "idempotency_key",
        keyValue: childProgressFixtures.operationKey,
        insertRow: {
          child_id: childBId,
          family_id: familyBId,
          idempotency_key: "isolation:operation:client-forge",
          payload_hash: "b".repeat(64),
          status: "pending",
          result: { status: "pending" },
        },
        updateRow: { payload_hash: "c".repeat(64) },
      },
      {
        table: "child_progress_revisions",
        label: "child progress revision",
        keyColumn: "child_id",
        keyValue: childProgressFixtures.childId,
        insertRow: {
          child_id: childBId,
          family_id: familyBId,
          revision: 999,
        },
        updateRow: { revision: 999 },
      },
      {
        table: "child_progress_live",
        keyColumn: "child_id",
        keyValue: childProgressFixtures.childId,
      },
      {
        table: "progress_check_ins",
        keyColumn: "id",
        keyValue: childProgressFixtures.checkInId,
      },
      {
        table: "progress_check_in_responses",
        keyColumn: "id",
        keyValue: childProgressFixtures.responseId,
      },
      {
        table: "child_progress_conflicts",
        keyColumn: "id",
        keyValue: childProgressFixtures.conflictId,
      },
      {
        table: "child_progress_snapshots",
        keyColumn: "id",
        keyValue: childProgressFixtures.snapshotId,
      },
      {
        table: "child_observations",
        keyColumn: "id",
        keyValue: childProgressFixtures.observationId,
      },
    ];
    for (const row of childProgressRows) {
      await expectAuthenticatedRead(
        familyBUser.accessToken,
        row.table,
        row.keyValue,
        1,
        `auth member can read own ${row.table} row`,
        row.keyColumn,
      );
      await expectAuthenticatedRead(
        familyAUser.accessToken,
        row.table,
        row.keyValue,
        0,
        `auth member cannot read another family's ${row.table} row`,
        row.keyColumn,
      );
    }

    const childProgressWriteFixtures = [
      {
        table: "child_progress_evidence",
        label: "child progress evidence",
        keyColumn: "id",
        keyValue: childProgressFixtures.evidenceId,
        insertRow: {
          child_id: childBId,
          family_id: familyBId,
          item_id: "isolation.progress.client-forge",
          answer: "easily",
          source: "checklist",
          idempotency_key: "isolation:evidence:client-forge",
        },
        updateRow: { quote: "Authenticated clients cannot alter evidence." },
      },
      {
        table: "child_progress_live",
        label: "live child progress",
        keyColumn: "child_id",
        keyValue: childProgressFixtures.childId,
        insertRow: {
          child_id: childBId,
          family_id: familyBId,
          projection: {},
          scores: {},
          bank_version: "client-forge",
          projection_version: "client-forge",
          projection_date: "2026-07-11",
          source_revision: 0,
        },
        updateRow: { evidence_count: 99 },
      },
      {
        table: "progress_check_ins",
        label: "progress check-in",
        keyColumn: "id",
        keyValue: childProgressFixtures.checkInId,
        insertRow: {
          child_id: childBId,
          family_id: familyBId,
          purpose: "age_refresh",
          scope: {},
          state: "completed",
          revision: 1,
          current_item_id: null,
          completed_at: new Date().toISOString(),
        },
        updateRow: { state: "stopped" },
      },
      {
        table: "progress_check_in_responses",
        label: "progress check-in response",
        keyColumn: "id",
        keyValue: childProgressFixtures.responseId,
        insertRow: {
          child_id: childBId,
          family_id: familyBId,
          check_in_id: childProgressFixtures.checkInId,
          revision: 2,
          item_id: "isolation.progress.item",
          answer: "skip",
          is_evidence: false,
          idempotency_key: "isolation:response:client-forge",
        },
        updateRow: { idempotency_key: "isolation:response:client-update" },
      },
      {
        table: "child_progress_conflicts",
        label: "child progress conflict",
        keyColumn: "id",
        keyValue: childProgressFixtures.conflictId,
        insertRow: {
          child_id: childBId,
          family_id: familyBId,
          item_id: "isolation.progress.item",
          evidence_id_a: childProgressFixtures.evidenceId,
          evidence_id_b: childProgressFixtures.evidenceIdB,
          state: "resolved",
          resolved_answer: "easily",
          resolved_evidence_id: childProgressFixtures.evidenceId,
          resolved_by_member_user_id: familyBUser.userId,
          resolved_at: new Date().toISOString(),
        },
        updateRow: {
          state: "resolved",
          resolved_answer: "easily",
          resolved_evidence_id: childProgressFixtures.evidenceId,
          resolved_by_member_user_id: familyBUser.userId,
          resolved_at: new Date().toISOString(),
        },
      },
      {
        table: "child_progress_snapshots",
        label: "child progress snapshot",
        keyColumn: "id",
        keyValue: childProgressFixtures.snapshotId,
        insertRow: {
          child_id: childBId,
          family_id: familyBId,
          snapshot_kind: "legacy",
          age_months: 72,
          bank_version: "client-forge",
          scorer_version: "client-forge",
          projection: {},
          scores: {},
        },
        updateRow: { scorer_version: "client-forge" },
      },
      {
        table: "child_observations",
        label: "child observation",
        keyColumn: "id",
        keyValue: childProgressFixtures.observationId,
        insertRow: {
          child_id: childBId,
          family_id: familyBId,
          quote: "Client-forged observation should be denied.",
          channel: "web",
          classification: "no_match",
          observed_at: new Date().toISOString(),
        },
        updateRow: { status: "used", used_at: new Date().toISOString() },
      },
    ];
    for (const fixture of childProgressWriteFixtures) {
      await expectAuthenticatedWritesDenied(
        familyBUser.accessToken,
        fixture.table,
        fixture,
        `auth member cannot mutate own ${fixture.label}`,
      );
      await expectAuthenticatedWritesDenied(
        familyAUser.accessToken,
        fixture.table,
        fixture,
        `cross-family token cannot mutate Family B ${fixture.label}`,
      );
    }

    await expectAuthenticatedInsertDenied(
      familyAUser.accessToken,
      "children",
      { family_id: familyBId, name: "Cross-family child", birth_month: "2020-01-01" },
      "auth member cannot create a child in another family",
    );
    await expectAuthenticatedInsertDenied(
      familyAUser.accessToken,
      "family_memories",
      {
        family_id: familyBId,
        child_id: childBId,
        kind: "fact",
        content: "Cross-family memory should be denied.",
        source: "parent",
      },
      "auth member cannot create another family's memory",
    );
    await expectAuthenticatedInsertDenied(
      familyAUser.accessToken,
      "materials",
      {
        family_id: familyBId,
        child_id: childBId,
        title: "Cross-family material",
        pdf_url: "https://example.com/cross.pdf",
        preview_url: "https://example.com/cross.jpg",
        html: "<p>Cross-family material should be denied.</p>",
      },
      "auth member cannot create another family's material",
    );

    report(
      "authenticated cross-family fixture families were distinct",
      familyAId !== familyBId,
      `A ${familyAId}, B ${familyBId}`,
    );
  } catch (error) {
    report(
      "authenticated cross-family isolation phase",
      false,
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    await cleanupIsolationFixtures();
  }
}

function migrationPublicTables() {
  const migrationsDir = path.join(repoRoot, "supabase/migrations");
  const tables = new Set();
  for (const file of readdirSync(migrationsDir).filter((entry) => entry.endsWith(".sql")).sort()) {
    const source = readFileSync(path.join(migrationsDir, file), "utf8");
    for (const match of source.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_]+)/gi,
    )) {
      tables.add(match[1]);
    }
    for (const match of source.matchAll(
      /alter\s+table\s+public\.([a-z_]+)\s+rename\s+to\s+([a-z_]+)/gi,
    )) {
      tables.delete(match[1]);
      tables.add(match[2]);
    }
    for (const match of source.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?public\.([a-z_]+)/gi)) {
      tables.delete(match[1]);
    }
  }
  return tables;
}

function expectEveryPublicTableCovered() {
  const missing = [...migrationPublicTables()].filter((table) => !coveredTables.has(table)).sort();
  report(
    "isolation guard covers every public table from migrations",
    missing.length === 0,
    missing.join(", "),
  );
}

function report(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failures.push(label);
}

await expectEmptyRead("waitlist");
await expectEmptyRead("events");
await expectEmptyRead("families");
await expectEmptyRead("family_members");
await expectEmptyRead("children");
// Homa's durable memory (migration #13): family-scoped, members only.
await expectEmptyRead("family_memories");
// Family skill library (migration #14): family-scoped, members only.
await expectEmptyRead("family_skills");
// Shared skills bank (migration #15): members read published rows; anon
// sees nothing and nobody writes through the Data API (no write policies).
await expectEmptyRead("skill_bank");
// State requirements reference table (migration #21): members read, anon
// sees nothing, and nobody writes through the Data API (no write policies).
await expectEmptyRead("state_requirements");
// Family texting line (migration #22): deny-all like the lead tables; the
// phone number routes texts INTO a family, so no Data API role may touch it.
await expectReadDenied("family_phones");
// Session-access generations retain phone identity after unlinking and are
// server-only for the same reason as family_phones.
await expectReadDenied("family_phone_access_epochs");
// One-world onboarding tables (migration #24): the family row is the
// account container from the first tap, memberless until signup, so
// anonymous traffic must see nothing in any of them, ever.
await expectEmptyRead("child_answers");
await expectEmptyRead("child_reports");
await expectEmptyRead("child_plans");
// Product report tables (migration #23): family-scoped by RLS through
// is_child_family_member. Anon has no policy, so reads return nothing;
// cross-family access is proven by the same identity model as children.
await expectEmptyRead("child_reports");
await expectEmptyRead("child_answers");
await expectEmptyRead("child_plans");
// ChildProgress storage is read-only through the authenticated Data API.
// Anon receives no table grant; older deployments that still return an
// RLS-filtered empty set are also safe during rollout.
for (const table of [
  "child_progress_evidence",
  "child_progress_operations",
  "child_progress_revisions",
  "child_progress_live",
  "progress_check_ins",
  "progress_check_in_responses",
  "child_progress_conflicts",
  "child_progress_snapshots",
  "map_walk_prompts",
  "child_observations",
]) {
  await expectAnonymousNoRowsOrDenied(table);
}
// Lesson listen (plan 2026-07-13-lesson-listen.md): same posture as the
// ChildProgress tables. Members read their own family's rows, every
// write rides the server-only connection, anon sees and writes nothing.
// NoRowsOrDenied keeps this check honest before AND after the additive
// migration applies.
for (const table of [
  "lesson_recordings",
  "lesson_segments",
  "lesson_media",
  "lesson_reviews",
]) {
  await expectAnonymousNoRowsOrDenied(table);
}
// "Call Homa" curriculum feature (migration #24): same is_child_family_member
// posture. Only the server-only connection ever writes a curriculum, so a
// signed-in member can start a call (their own insert policy) but never
// forge one directly, and anon sees and writes nothing in either table.
await expectEmptyRead("child_curriculum_calls");
await expectEmptyRead("child_curricula");
// Raw call transcripts (migration #25): family-scoped by is_family_member.
// Only the server-only connection writes (capture webhook + sync job), so
// anon reads nothing and has no write policy; unknown-caller rows carry a
// null family_id and are invisible to every Data API role by construction.
await expectEmptyRead("call_transcripts");
// The durable chat record (migration #34): members read their own rows;
// only the persist-conversation hook's server connection ever writes.
await expectReadDenied("conversation_messages");
// Canonical cross-channel continuity: episodes, deliveries, and open loops
// are family-readable to authenticated members only; anon and transport
// bindings have explicit revoked Data API privileges.
await expectReadDenied("conversation_episodes");
await expectReadDenied("conversation_thread_bindings");
await expectReadDenied("conversation_deliveries");
await expectReadDenied("conversation_open_loops");
await expectReadDenied("conversation_inbound_receipts");
// Accepted-offer fulfillment is server-only attribution. Parents see the
// resulting material or task, never this analytics edge.
await expectReadDenied("conversation_offer_fulfillments");
// Post-turn review bookkeeping (migration #35): deny-all, server-only.
await expectEmptyRead("learning_reviews");
// Capture-time hours record (migration #37): family-scoped, members only.
await expectEmptyRead("hours_log");
// Task rows (migrations #39 + #49): members read their OWN family's
// rows only; anon sees nothing and nobody writes over the Data API.
await expectEmptyRead("agent_schedules");
// Task run history (migration #49): same member-select posture; fleet
// rows (family_id null) are invisible to every Data API role.
await expectEmptyRead("homa_task_runs");
// Curriculum build jobs (migration 20260718120000, additive, lands via
// MCP ahead of the repo replay): members read their own family's builds
// (the progress/cancel UI); no write policies exist, so the Stage-2
// Workflow's server connection is the only writer. Same posture as
// homa_task_runs. Until the migration reaches this target, the tables'
// absence itself exposes nothing (PGRST205), and every check below arms
// automatically the run after it lands.
async function curriculumJobTablesPresent() {
  const response = await rest(`curriculum_jobs?select=id&limit=1`, {
    headers: { Prefer: "" },
  });
  if (response.status !== 404) return true;
  const raw = await response.text();
  return !raw.includes("PGRST205");
}
const curriculumJobSchemaAvailable = await curriculumJobTablesPresent();
if (curriculumJobSchemaAvailable) {
  await expectEmptyRead("curriculum_jobs");
  await expectEmptyRead("curriculum_job_weeks");
} else {
  coveredTables.add("curriculum_jobs");
  coveredTables.add("curriculum_job_weeks");
  report(
    "curriculum job tables absent from target (additive migration not applied yet); nothing exposed",
    true,
  );
}
// The fleet research corpus (migration #50): deny-all; only the gate
// (lib/knowledge/gate.ts) writes, only server code reads.
await expectReadDenied("knowledge_bank");
// Morning research brief v2 durable records are server-write-only. Feedback
// alone is family-readable after authentication; anonymous traffic sees no
// rows and can never create any of the three records.
for (const table of [
  "research_brief_preparations",
  "family_knowledge_use",
  "research_brief_feedback",
]) {
  await expectAnonymousNoRowsOrDenied(table);
}
// Phone-first leads (migration #41): deny-all, server-only.
await expectReadDenied("phone_leads");
// Phone-link confirmations (migration #46): deny-all, server-only.
await expectReadDenied("phone_link_requests");
// Verified phone claim codes (migration #47): deny-all, server-only.
await expectReadDenied("phone_claim_codes");
// Co-parent invite tokens (migration #51): deny-all, server-only.
await expectReadDenied("family_invites");
// Consent-first family SMS invitations: the destination number and saved
// learning update stay server-only before and after the recipient responds.
await expectReadDenied("family_sms_invites");
// Materials studio artifacts (migrations #42 + #44): family-scoped,
// members only.
await expectEmptyRead("materials");
// Per-family AI consumption ledger (migration #43): deny-all, server-only.
await expectReadDenied("model_usage");
// Thank-you card outbox (migration #53): deny-all, server-only. It holds
// mailing-address snapshots, so no Data API role may ever see or touch it.
await expectEmptyRead("thank_you_cards");
// Founder console ledgers (migration #73): deny-all, server-only. The
// email ledger holds address hashes and delivery errors; the cron
// heartbeat is pure ops state. No Data API role reads or writes either.
await expectReadDenied("email_sends");
await expectReadDenied("cron_runs");
// Founder alert acks (migration #81): deny-all, server-only; only the
// founder-gated /admin action writes.
await expectReadDenied("admin_alert_acknowledgments");
// The agent flight recorder (migration #79): tool calls and injected
// context snapshots hold family conversation material, deny-all,
// server-only writes, founder-console reads only.
await expectReadDenied("agent_tool_calls");
await expectReadDenied("session_context_snapshots");
// Chat attachments (migration #80): members read their own family's
// rows; anon has explicit revokes; only the server-side attachment
// routes write.
await expectReadDenied("chat_attachments");
// Self-improving system tables (Layer 1-5): all admin-only, no client policies.
await expectReadDenied("conversation_signals");
await expectReadDenied("system_policies");
await expectReadDenied("policy_proposals");
await expectReadDenied("eval_results");
await expectReadDenied("fix_effectiveness");
await expectReadDenied("signal_patterns");
await expectReadDenied("skill_evolution_log");
await expectReadDenied("response_engagement");
await expectReadDenied("knowledge_gaps");

await expectInsertDenied(
  "families",
  { name: "intruder family" },
  "anon cannot create families",
);
await expectInsertDenied(
  "children",
  { family_id: "00000000-0000-0000-0000-000000000000", name: "x", birth_month: "2022-01-01" },
  "anon cannot create children",
);
await expectInsertDenied(
  "events",
  { name: "account.signup_completed", props: {} },
  "anon cannot emit non-waitlist events",
);
await expectInsertDenied(
  "events",
  { name: "chat.turn_completed", props: {}, family_id: "00000000-0000-0000-0000-000000000000" },
  "anon cannot emit chat events",
);
await expectInsertDenied(
  "family_memories",
  { family_id: "00000000-0000-0000-0000-000000000000", content: "intruder note" },
  "anon cannot write family memories",
);
await expectInsertDenied(
  "family_skills",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    name: "intruder-skill",
    description: "Use when injecting.",
    markdown: "This should never be writable anonymously.",
  },
  "anon cannot write family skills",
);
await expectInsertDenied(
  "skill_bank",
  {
    name: "intruder-bank-skill",
    description: "Use when injecting fleet-wide.",
    markdown: "This must never be writable over the Data API.",
    published: true,
  },
  "anon cannot write the skills bank",
);
await expectInsertDenied(
  "knowledge_bank",
  {
    topic_type: "study",
    topic_key: "intruder-topic",
    title: "Intruder row",
    summary: "This must never be writable over the Data API; the gate is the only door.",
    content: "Fleet-wide injection attempt; the deny-all posture must hold.",
  },
  "anon cannot write the knowledge bank",
);
await expectInsertDenied(
  "agent_schedules",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    kind: "custom",
    next_run_at: new Date().toISOString(),
    label: "intruder task",
    prompt: "This must never be writable over the Data API.",
  },
  "anon cannot create task schedules",
);
await expectInsertDenied(
  "homa_task_runs",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    kind: "custom",
    title: "intruder run",
  },
  "anon cannot forge task runs",
);
if (curriculumJobSchemaAvailable) {
  await expectInsertDenied(
    "curriculum_jobs",
    {
      family_id: "00000000-0000-0000-0000-000000000000",
      title: "intruder build",
      total_stages: 1,
    },
    "anon cannot forge curriculum jobs",
  );
  await expectInsertDenied(
    "curriculum_job_weeks",
    {
      job_id: "00000000-0000-0000-0000-000000000000",
      family_id: "00000000-0000-0000-0000-000000000000",
      week_number: 1,
    },
    "anon cannot forge curriculum job weeks",
  );
}
await expectInsertDenied(
  "research_brief_preparations",
  {
    task_run_id: "00000000-0000-0000-0000-000000000000",
    family_id: "00000000-0000-0000-0000-000000000000",
    child_id: "00000000-0000-0000-0000-000000000000",
    knowledge_bank_id: "00000000-0000-0000-0000-000000000000",
    draft: "Anonymous clients must not prepare research briefs.",
    draft_hash: "0".repeat(64),
    source_snapshot: {},
    prepared_at: new Date().toISOString(),
  },
  "anon cannot forge research brief preparations",
);
await expectInsertDenied(
  "family_knowledge_use",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    knowledge_bank_id: "00000000-0000-0000-0000-000000000000",
    task_run_id: "00000000-0000-0000-0000-000000000000",
    used_at: new Date().toISOString(),
  },
  "anon cannot forge family knowledge use",
);
await expectInsertDenied(
  "research_brief_feedback",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    task_run_id: "00000000-0000-0000-0000-000000000000",
    member_user_id: "00000000-0000-0000-0000-000000000000",
    signal: "helpful",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  "anon cannot forge research brief feedback",
);
await expectInsertDenied(
  "conversation_offer_fulfillments",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    source_delivery_id: "00000000-0000-0000-0000-000000000000",
    kind: "material",
    reference_id: "00000000-0000-0000-0000-000000000000",
  },
  "anon cannot forge offer fulfillment attribution",
);
await expectInsertDenied(
  "state_requirements",
  {
    state_code: "ZZ",
    state_name: "Intruder",
    regulation_level: "none",
    notification_required: false,
    assessment_required: false,
    payload: {},
    source_verification_status: "verified",
    source_last_verified: "2026-01-01",
    pulled_at: "2026-01-01T00:00:00Z",
  },
  "anon cannot write state requirements",
);
await expectInsertDenied(
  "family_phones",
  { family_id: "00000000-0000-0000-0000-000000000000", phone_e164: "+15550000000" },
  "anon cannot link a phone to a family",
);
await expectInsertDenied(
  "family_phone_access_epochs",
  { phone_e164: "+15550000000" },
  "anon cannot rotate a phone access epoch",
);
await expectInsertDenied(
  "waitlist",
  { email: `probe-${Date.now()}@example.com`, status: "invited" },
  "anon cannot self-invite via waitlist status",
);
await expectInsertDenied(
  "child_reports",
  { child_id: "00000000-0000-0000-0000-000000000000", scores: {}, bank_version: "x", token: "probe" },
  "anon cannot forge child_reports",
);
await expectInsertDenied(
  "child_answers",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    question_id: "math.probe",
    answer: "easily",
  },
  "anon cannot forge child_answers",
);
await expectInsertDenied(
  "child_plans",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    subject_id: "math",
    plan: {},
    bank_version: "x",
    retest_at: "2026-01-01T00:00:00Z",
  },
  "anon cannot forge child_plans",
);
await expectInsertDenied(
  "child_progress_evidence",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    family_id: "00000000-0000-0000-0000-000000000000",
    item_id: "math.probe",
    answer: "easily",
    source: "checklist",
    idempotency_key: "isolation:anon:evidence",
  },
  "anon cannot forge child progress evidence",
);
await expectInsertDenied(
  "child_progress_operations",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    family_id: "00000000-0000-0000-0000-000000000000",
    idempotency_key: "isolation:anon:operation",
    payload_hash: "d".repeat(64),
    status: "pending",
    result: { status: "pending" },
  },
  "anon cannot forge child progress operations",
);
await expectInsertDenied(
  "child_progress_revisions",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    family_id: "00000000-0000-0000-0000-000000000000",
    revision: 999,
  },
  "anon cannot forge child progress revisions",
);
await expectInsertDenied(
  "child_progress_live",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    family_id: "00000000-0000-0000-0000-000000000000",
    projection: {},
    scores: {},
    bank_version: "isolation",
    projection_version: "isolation",
    projection_date: "2026-07-11",
    source_revision: 0,
  },
  "anon cannot forge live child progress",
);
await expectInsertDenied(
  "progress_check_ins",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    family_id: "00000000-0000-0000-0000-000000000000",
    purpose: "whole_map_refresh",
    scope: {},
  },
  "anon cannot forge progress check-ins",
);
await expectInsertDenied(
  "progress_check_in_responses",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    family_id: "00000000-0000-0000-0000-000000000000",
    check_in_id: "00000000-0000-0000-0000-000000000000",
    revision: 1,
    item_id: "math.probe",
    answer: "skip",
    idempotency_key: "isolation:anon:response",
  },
  "anon cannot forge progress check-in responses",
);
await expectInsertDenied(
  "child_progress_conflicts",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    family_id: "00000000-0000-0000-0000-000000000000",
    item_id: "math.probe",
    evidence_id_a: "00000000-0000-0000-0000-000000000001",
    evidence_id_b: "00000000-0000-0000-0000-000000000002",
  },
  "anon cannot forge child progress conflicts",
);
await expectInsertDenied(
  "child_progress_snapshots",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    family_id: "00000000-0000-0000-0000-000000000000",
    snapshot_kind: "legacy",
    age_months: 0,
    bank_version: "isolation",
    scorer_version: "isolation",
    projection: {},
    scores: {},
  },
  "anon cannot forge child progress snapshots",
);
await expectInsertDenied(
  "map_walk_prompts",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    family_id: "00000000-0000-0000-0000-000000000000",
    subject_id: "math",
    topic_id: "math.comparing-groups-more-or-fewer",
    sitting: 1,
    source_revision: 0,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  },
  "anon cannot forge map walk prompts",
);
await expectInsertDenied(
  "child_observations",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    family_id: "00000000-0000-0000-0000-000000000000",
    quote: "Anon-forged observation should be denied.",
    channel: "web",
    classification: "no_match",
    observed_at: new Date().toISOString(),
  },
  "anon cannot forge child observations",
);
await expectInsertDenied(
  "lesson_recordings",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    child_id: "00000000-0000-0000-0000-000000000000",
  },
  "anon cannot forge lesson recordings",
);
await expectInsertDenied(
  "lesson_reviews",
  {
    lesson_id: "00000000-0000-0000-0000-000000000000",
    family_id: "00000000-0000-0000-0000-000000000000",
    child_id: "00000000-0000-0000-0000-000000000000",
    summary: "Anon-forged review should be denied.",
    insights: {},
  },
  "anon cannot forge lesson reviews",
);
await expectInsertDenied(
  "child_curriculum_calls",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    family_id: "00000000-0000-0000-0000-000000000000",
    phone_e164: "+15550000000",
  },
  "anon cannot forge curriculum calls",
);
await expectInsertDenied(
  "child_curricula",
  { child_id: "00000000-0000-0000-0000-000000000000", curriculum: {}, model: "x" },
  "anon cannot forge a curriculum",
);
await expectInsertDenied(
  "call_transcripts",
  { conversation_id: `probe-${Date.now()}`, messages: [] },
  "anon cannot forge a call transcript",
);
await expectInsertDenied(
  "conversation_messages",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    session_id: "probe",
    sequence: 0,
    role: "user",
    content: "intruder message",
  },
  "anon cannot forge chat history",
);
await expectInsertDenied(
  "learning_reviews",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    session_id: "probe",
    upto_sequence: 0,
  },
  "anon cannot forge review claims",
);
await expectInsertDenied(
  "hours_log",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    subject: "math",
    minutes: 60,
  },
  "anon cannot forge hours",
);
await expectInsertDenied(
  "agent_schedules",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    kind: "journal_prompt",
    next_run_at: "2026-01-01T00:00:00Z",
  },
  "anon cannot forge dispatcher schedules",
);
await expectInsertDenied(
  "phone_leads",
  {
    phone_e164: "+15550001111",
    first_channel: "sms",
  },
  "anon cannot forge phone leads",
);
await expectInsertDenied(
  "family_invites",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    email: "intruder@example.com",
    token_hash: "intruder",
  },
  "anon cannot forge family invites",
);
await expectInsertDenied(
  "family_sms_invites",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    phone_e164: "+15550001111",
    learning_update: "This must never enter a family invitation.",
  },
  "anon cannot forge family SMS invites",
);
await expectInsertDenied(
  "materials",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    title: "intruder page",
    pdf_url: "https://example.com/x.pdf",
    preview_url: "https://example.com/x.jpg",
    html: "<p>intruder</p>",
  },
  "anon cannot forge materials",
);
await expectInsertDenied(
  "model_usage",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    surface: "chat",
    model: "intruder/model",
    modality: "text",
  },
  "anon cannot forge usage rows",
);
await expectInsertDenied(
  "thank_you_cards",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    recipient_first_name: "Intruder",
    address_line: "1 Nowhere St",
    address_city: "Nowhere",
    us_state: "AZ",
    address_zip: "00000",
    message: "This must never be writable over the Data API.",
  },
  "anon cannot forge thank-you cards",
);
await expectInsertDenied(
  "email_sends",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    kind: "report_link",
    to_hash: "0".repeat(64),
    status: "submitted",
  },
  "anon cannot forge email ledger rows",
);
await expectInsertDenied(
  "cron_runs",
  { job: "map_cron", ok: true },
  "anon cannot forge cron heartbeats",
);
await expectInsertDenied(
  "admin_alert_acknowledgments",
  {
    source: "task_run",
    source_id: "00000000-0000-0000-0000-000000000000",
    acknowledged_by: "intruder@example.com",
  },
  "anon cannot forge alert acknowledgments",
);
await expectInsertDenied(
  "agent_tool_calls",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    session_id: "intruder",
    call_id: "intruder",
    tool: "intruder",
  },
  "anon cannot forge tool-call trace rows",
);
await expectInsertDenied(
  "chat_attachments",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    url: "https://example.com/intruder.jpg",
    media_type: "image/jpeg",
    kind: "image",
  },
  "anon cannot forge chat attachments",
);
await expectInsertDenied(
  "session_context_snapshots",
  {
    family_id: "00000000-0000-0000-0000-000000000000",
    session_id: "intruder",
    content: "intruder",
    content_hash: "0".repeat(64),
  },
  "anon cannot forge context snapshots",
);
await expectInsertDenied(
  "child_reports",
  { child_id: "00000000-0000-0000-0000-000000000000", scores: {}, bank_version: "x" },
  "anon cannot forge product child reports",
);
await expectInsertDenied(
  "child_answers",
  { child_id: "00000000-0000-0000-0000-000000000000", question_id: "math.probe", answer: "easily" },
  "anon cannot forge product child answers",
);
await expectInsertDenied(
  "child_plans",
  { child_id: "00000000-0000-0000-0000-000000000000", subject_id: "math", plan: {}, bank_version: "x" },
  "anon cannot forge product child plans",
);

if (sql) {
  try {
    morningResearchBriefV2SchemaAvailable =
      await morningResearchBriefV2SchemaExists();
    report(
      "morning research brief v2 migration is applied to the isolation target",
      morningResearchBriefV2SchemaAvailable,
      morningResearchBriefV2SchemaAvailable
        ? "all three durable tables exist"
        : "morning research brief v2 tables are missing",
    );
  } catch (error) {
    report(
      "morning research brief v2 migration is applied to the isolation target",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }
  try {
    morningOfferFunnelSchemaAvailable =
      await morningOfferFunnelSchemaExists();
    report(
      "morning offer funnel migration is applied to the isolation target",
      morningOfferFunnelSchemaAvailable,
      morningOfferFunnelSchemaAvailable
        ? "fulfillment outbox, reply audit, and protected exact provenance exist"
        : "morning offer funnel schema is missing",
    );
  } catch (error) {
    report(
      "morning offer funnel migration is applied to the isolation target",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }
} else {
  report(
    "morning research brief v2 migration is applied to the isolation target",
    false,
    "missing SUPABASE_DB_PASSWORD",
  );
  report(
    "morning offer funnel migration is applied to the isolation target",
    false,
    "missing SUPABASE_DB_PASSWORD",
  );
}

await expectAuthenticatedIsolation();
expectEveryPublicTableCovered();
if (sql) await sql.end({ timeout: 5 });

if (failures.length > 0) {
  console.error(`\n${failures.length} isolation check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll isolation checks passed.");
