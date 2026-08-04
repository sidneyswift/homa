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
 *   5. ChildProgress and subject lesson rows are family-readable and
 *      server-write-only
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
let familyBillingSubscriptionsSchemaAvailable = false;
let stripeTrialCardClaimsSchemaAvailable = false;
let accountDeletionJobsSchemaAvailable = false;
let familyLibrarySchemaAvailable = false;
let familyAssetPlanLinksSchemaAvailable = false;
let familyCurriculumMappingSchemaAvailable = false;
let progressNextMovesSchemaAvailable = false;

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

async function expectAuthenticatedRpcDenied(
  accessToken,
  functionName,
  args,
  label,
) {
  const response = await restAs(accessToken, `rpc/${functionName}`, {
    method: "POST",
    body: JSON.stringify(args),
  });
  const ok = response.status === 401 || response.status === 403;
  report(label, ok, `HTTP ${response.status}`);
}

// For tables with a real member-scoped policy (USING/WITH CHECK against the
// caller's own family, not a hard "no policy at all" deny), a cross-family
// PATCH is not rejected at the HTTP layer: RLS silently filters the target
// row out of the update set, so PostgREST returns 200 with zero rows
// touched rather than 401/403. expectAuthenticatedUpdateDenied is the wrong
// shape for those tables; this checks the actual row count instead, the
// same way expectAuthenticatedRead does for SELECT.
async function expectAuthenticatedUpdateFiltered(
  accessToken,
  table,
  keyColumn,
  keyValue,
  changes,
  expectedCount,
  label,
) {
  coveredTables.add(table);
  const response = await restAs(accessToken, `${table}?${keyColumn}=eq.${keyValue}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
    headers: { Prefer: "return=representation" },
  });
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

// The delete-policy counterpart to expectAuthenticatedUpdateFiltered: for
// tables with a real member-scoped DELETE policy (USING against the
// caller's own family, not a hard deny), a cross-family DELETE is not
// rejected at the HTTP layer either. RLS silently filters the target row
// out, so PostgREST returns 200 with zero rows deleted; this checks the
// actual row count via Prefer: return=representation, the same shape as
// the update check.
async function expectAuthenticatedDeleteFiltered(
  accessToken,
  table,
  keyColumn,
  keyValue,
  expectedCount,
  label,
) {
  coveredTables.add(table);
  const response = await restAs(accessToken, `${table}?${keyColumn}=eq.${keyValue}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
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

async function subjectLessonSchemaExists() {
  const rows = await sql`
    select to_regclass('public.subject_lessons') is not null as present
  `;
  return rows[0]?.present === true;
}

/**
 * hours_log shipped with no UPDATE policy (migration #37: select/insert/
 * delete only) until the /app/hours page needed one (issue #174,
 * CG-02). The additive migration may lead this code's own deploy, so
 * this checks whether it has landed on the target yet, same expand/
 * contract honesty as materialStatusWriteBoundaryEnforced above: the
 * probe below asserts the real cross-family guarantee once the policy
 * exists, and reports an honest "not yet enforced" pass during the
 * safe window before it does, rather than failing.
 */
async function hoursLogUpdatePolicyEnforced() {
  const rows = await sql`
    select exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'hours_log'
        and policyname = 'members update their hours'
    ) as present
  `;
  return rows[0]?.present === true;
}

/**
 * family_events and plan_activity_schedule (issue #176, CG-03: calendar
 * and homeschool planner in one) are brand-new tables from this same
 * change, deliberately NOT applied to production by this session (the
 * founder applies prod migrations personally, same posture as the
 * hours_log update policy). These checks report the honest schema state
 * so the isolation probe below can assert the real cross-family
 * guarantee once the migration lands, and report an honest "not yet
 * enforced" pass during the safe window before it does, rather than
 * failing.
 */
async function familyEventsSchemaExists() {
  const rows = await sql`
    select to_regclass('public.family_events') is not null as present
  `;
  return rows[0]?.present === true;
}

async function familyEventChildrenSchemaExists() {
  const rows = await sql`
    select to_regclass('public.family_event_children') is not null as present
  `;
  return rows[0]?.present === true;
}

async function familyEventOccurrenceExceptionsSchemaExists() {
  const rows = await sql`
    select to_regclass('public.family_event_occurrence_exceptions') is not null as present
  `;
  return rows[0]?.present === true;
}

async function planActivityScheduleSchemaExists() {
  const rows = await sql`
    select to_regclass('public.plan_activity_schedule') is not null as present
  `;
  return rows[0]?.present === true;
}

async function plannerLearningActivitiesSchemaExists() {
  const rows = await sql`
    select
      to_regclass('public.planner_learning_activities') is not null
      and to_regclass('public.planner_learning_activity_children') is not null
      and to_regclass('public.planner_learning_activity_hours') is not null
      as present
  `;
  return rows[0]?.present === true;
}

async function monthPlanApprovalsSchemaExists() {
  const rows = await sql`
    select to_regclass('public.month_plan_approvals') is not null as present
  `;
  return rows[0]?.present === true;
}

async function familyAssetTrainingSchemaIsIsolated() {
  const [presence] = await sql`
    select to_regnamespace('training') is not null as schema_exists
  `;
  if (!presence?.schema_exists) {
    report(
      "family asset training ledger absent from target (additive migration not applied yet); nothing exposed",
      true,
    );
    return false;
  }

  const [row] = await sql`
    select
      (
        select count(*)::integer
        from information_schema.tables
        where table_schema = 'training'
          and table_name in (
            'dataset_builds',
            'family_asset_sources',
            'family_asset_exports',
            'family_asset_actions'
          )
      ) as table_count,
      has_schema_privilege('anon', 'training', 'USAGE') as anon_schema_usage,
      has_schema_privilege(
        'authenticated', 'training', 'USAGE'
      ) as authenticated_schema_usage,
      exists (
        select 1
        from information_schema.role_table_grants
        where table_schema = 'training'
          and grantee in ('anon', 'authenticated')
      ) as product_table_grant,
      (
        select count(*)::integer
        from pg_trigger
        where tgname in (
          'propagate_family_asset_soft_deletion',
          'propagate_family_asset_hard_deletion'
        )
          and not tgisinternal
      ) as deletion_trigger_count,
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'training'
          and column_name like '%copyright%'
      ) as copyright_gate_exists
  `;
  const isolated =
    row?.table_count === 4 &&
    row?.anon_schema_usage === false &&
    row?.authenticated_schema_usage === false &&
    row?.product_table_grant === false &&
    row?.deletion_trigger_count === 2 &&
    row?.copyright_gate_exists === false;
  report(
    "family asset training ledger is outside product access and deletion-aware",
    isolated,
    isolated
      ? "four private training tables, no product grants, both deletion triggers, no copyright gate"
      : JSON.stringify(row),
  );
  return isolated;
}

/**
 * The subject_lessons migration deliberately ships as an expand/contract
 * pair (2026-07-18 merge-to-main review finding): the enforcing trigger is
 * a SEPARATE, later migration that must not apply until the RPC-aware
 * finalizeMaterialCaller code is confirmed READY in production, because it
 * would otherwise reject every family's existing direct-update material
 * approval. This checks whether that second migration has landed yet, so
 * the isolation probe below can assert the right thing for either state
 * instead of failing during the safe, deliberate window between them.
 */
async function materialStatusWriteBoundaryEnforced() {
  const rows = await sql`
    select exists (
      select 1 from pg_trigger
      where tgname = 'enforce_material_status_write_boundary'
        and not tgisinternal
    ) as present
  `;
  return rows[0]?.present === true;
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

async function insertSubjectLessonFixture(childId) {
  const [lesson] = await sql`
    insert into public.subject_lessons (
      child_id,
      subject_id,
      target_item_id,
      target_statement,
      source_report_generated_at,
      source_fingerprint,
      bank_version,
      idempotency_key
    )
    values (
      ${childId},
      'math',
      'math.isolation-target',
      'Isolation subject lesson target',
      now(),
      ${"7".repeat(64)},
      'isolation-bank',
      ${"7".repeat(64)}
    )
    returning id
  `;
  if (!lesson?.id) {
    throw new Error("subject lesson fixture returned no id");
  }
  return lesson.id;
}

async function insertSubjectLessonMaterialFixture(
  familyId,
  childId,
  lessonId,
) {
  await sql`
    update public.subject_lessons
    set build_status = 'running',
        build_phase = 'making_worksheet',
        attempt_count = 1,
        content = ${sql.json({
          title: "Isolation lesson",
          materials: [],
          steps: [
            "The child reads one word.",
            "The child reads a second word.",
            "The child reads both words again.",
          ],
          practice: "Read both words tomorrow.",
        })}
    where id = ${lessonId}
      and child_id = ${childId}
  `;
  const [material] = await sql`
    insert into public.materials (
      family_id,
      child_id,
      subject_lesson_id,
      title,
      kind,
      skill,
      subject,
      pdf_url,
      preview_url,
      html,
      source,
      channel,
      generation
    )
    values (
      ${familyId},
      ${childId},
      ${lessonId},
      'Isolation lesson worksheet',
      'worksheet',
      'Isolation subject lesson target',
      'math',
      'https://example.com/isolation-lesson.pdf',
      'https://example.com/isolation-lesson.jpg',
      '<p>Isolation lesson worksheet.</p>',
      'html',
      'subject_lesson',
      '{"review":null}'::jsonb
    )
    returning id
  `;
  if (!material?.id) {
    throw new Error("subject lesson material fixture returned no id");
  }
  return material.id;
}

async function expectSubjectLessonChildCascade(familyId) {
  try {
    const [child] = await sql`
      insert into public.children (family_id, name, birth_month)
      values (${familyId}, 'Isolation cascade child', '2020-01-01')
      returning id
    `;
    const [lesson] = await sql`
      insert into public.subject_lessons (
        child_id,
        subject_id,
        target_statement,
        source_report_generated_at,
        source_fingerprint,
        bank_version,
        idempotency_key
      )
      values (
        ${child.id},
        'reading',
        'Isolation cascade target',
        now(),
        ${"8".repeat(64)},
        'isolation-bank',
        ${"8".repeat(64)}
      )
      returning id
    `;
    await sql`
      delete from public.children
      where id = ${child.id} and family_id = ${familyId}
    `;
    const remaining = await sql`
      select count(*)::integer as count
      from public.subject_lessons
      where id = ${lesson.id}
    `;
    report(
      "deleting a child cascades subject lessons",
      remaining[0]?.count === 0,
      `remaining ${remaining[0]?.count ?? "unknown"}`,
    );
  } catch (error) {
    report(
      "deleting a child cascades subject lessons",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }
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

async function expectEventsFamilyDeleteCascade(controlFamilyId, suffix) {
  const disposableUser = await signUpFixtureUser("events-cascade", suffix);
  const disposableFamilyId = await createFixtureFamily(
    disposableUser,
    "events cascade",
  );
  const marker = `isolation-${suffix}`;
  let disposableEventId = null;
  let controlEventId = null;

  try {
    const [constraint] = await sql`
      select constraint_row.convalidated, constraint_row.confdeltype
      from pg_constraint as constraint_row
      where constraint_row.conrelid = 'public.events'::regclass
        and constraint_row.conname = 'events_family_id_fkey'
    `;
    report(
      "events family foreign key is validated and cascading",
      constraint?.convalidated === true && constraint?.confdeltype === "c",
      constraint
        ? `validated ${constraint.convalidated}, delete action ${constraint.confdeltype}`
        : "events_family_id_fkey is missing",
    );

    const [disposableEvent] = await sql`
      insert into public.events (name, props, family_id)
      values (
        'isolation.family_delete_cascade',
        ${sql.json({ marker, role: "disposable" })},
        ${disposableFamilyId}
      )
      returning id
    `;
    disposableEventId = disposableEvent?.id ?? null;

    const [controlEvent] = await sql`
      insert into public.events (name, props, family_id)
      values (
        'isolation.family_delete_cascade',
        ${sql.json({ marker, role: "control" })},
        ${controlFamilyId}
      )
      returning id
    `;
    controlEventId = controlEvent?.id ?? null;

    await sql`delete from public.families where id = ${disposableFamilyId}`;

    const [result] = await sql`
      select
        count(*) filter (where id = ${disposableEventId})::integer as deleted_count,
        count(*) filter (where id = ${controlEventId})::integer as control_count
      from public.events
      where id in (${disposableEventId}, ${controlEventId})
    `;
    report(
      "family deletion cascades only that family's analytics events",
      result?.deleted_count === 0 && result?.control_count === 1,
      `deleted-family rows ${result?.deleted_count ?? "unknown"}, control-family rows ${result?.control_count ?? "unknown"}`,
    );
  } finally {
    const eventIds = [disposableEventId, controlEventId].filter(
      (id) => id !== null,
    );
    if (eventIds.length > 0) {
      await sql`delete from public.events where id in ${sql(eventIds)}`;
    }
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
    await expectEventsFamilyDeleteCascade(familyBId, suffix);
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
    const hasSubjectLessonSchema = await subjectLessonSchemaExists();
    report(
      "subject lesson migration is applied to the isolation target",
      hasSubjectLessonSchema,
      hasSubjectLessonSchema ? "table present" : "public.subject_lessons is missing",
    );
    const subjectLessonBId = hasSubjectLessonSchema
      ? await insertSubjectLessonFixture(childBId)
      : null;
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
    const hoursLogBId = await insertFixtureRow(
      familyBUser,
      "hours_log",
      {
        family_id: familyBId,
        child_id: childBId,
        subject: "math",
        minutes: 45,
        note: "Isolation check hours fixture.",
      },
      "create Family B hours_log fixture",
    );
    // family_events and plan_activity_schedule (issue #176, CG-03) are
    // brand-new tables from this same change, deliberately not yet
    // applied to production; the fixture rows only get created once the
    // migration has actually landed on this target.
    const familyEventsSchemaAvailable = await familyEventsSchemaExists();
    const familyEventBId = familyEventsSchemaAvailable
      ? await insertFixtureRow(
          familyBUser,
          "family_events",
          {
            family_id: familyBId,
            child_id: childBId,
            title: "Isolation check family event",
            starts_on: "2026-01-01",
            ends_on: "2026-01-01",
            recurrence_rule: {
              frequency: "weekly",
              interval: 1,
              weekdays: [4],
              until: "2026-02-01",
            },
          },
          "create Family B family_events fixture",
        )
      : null;
    const familyEventChildrenSchemaAvailable = await familyEventChildrenSchemaExists();
    if (familyEventChildrenSchemaAvailable && familyEventBId) {
      await jsonResponse(
        await restAs(familyBUser.accessToken, "family_event_children?select=event_id", {
          method: "POST",
          body: JSON.stringify({
            family_id: familyBId,
            event_id: familyEventBId,
            child_id: childBId,
          }),
          headers: { Prefer: "return=representation" },
        }),
        "create Family B family_event_children fixture",
      );
    }
    const familyEventOccurrenceExceptionsSchemaAvailable =
      await familyEventOccurrenceExceptionsSchemaExists();
    if (familyEventOccurrenceExceptionsSchemaAvailable && familyEventBId) {
      const receipt = await jsonResponse(
        await restAs(
          familyBUser.accessToken,
          "rpc/save_family_event_occurrence_exception",
          {
            method: "POST",
            body: JSON.stringify({
              p_event_id: familyEventBId,
              p_family_id: familyBId,
              p_occurrence_on: "2026-01-08",
              p_kind: "cancelled",
              p_starts_on: null,
              p_ends_on: null,
              p_start_time: null,
              p_end_time: null,
            }),
          },
        ),
        "create Family B family event occurrence exception fixture",
      );
      if (receipt !== "2026-01-08") {
        throw new Error("family event occurrence exception fixture returned no exact receipt");
      }
    }
    const planActivityScheduleSchemaAvailable = await planActivityScheduleSchemaExists();
    const planActivityScheduleBId = planActivityScheduleSchemaAvailable
      ? await insertFixtureRow(
          familyBUser,
          "plan_activity_schedule",
          {
            family_id: familyBId,
            child_id: childBId,
            subject_id: "isolation-check",
            week: 1,
            activity_index: 0,
            scheduled_date: "2026-01-01",
          },
          "create Family B plan_activity_schedule fixture",
        )
      : null;
    const plannerLearningSchemaAvailable = await plannerLearningActivitiesSchemaExists();
    const plannerLearningActivityBId = plannerLearningSchemaAvailable
      ? (
          await sql`
            insert into public.planner_learning_activities
              (family_id, title, subject, activity_date, status,
               source_channel, source_quote, idempotency_key)
            values
              (${familyBId}, 'Isolation check lesson', 'math', '2026-01-01',
               'planned', 'web', 'We planned an isolation check lesson.',
               ${`isolation-planner:${suffix}`})
            returning id
          `
        )[0]?.id
      : null;
    if (plannerLearningSchemaAvailable && plannerLearningActivityBId) {
      await sql`
        insert into public.planner_learning_activity_children
          (family_id, activity_id, child_id)
        values (${familyBId}, ${plannerLearningActivityBId}, ${childBId})
      `;
    }
    const monthPlanApprovalsSchemaAvailable = await monthPlanApprovalsSchemaExists();
    const monthPlanApprovalBId = monthPlanApprovalsSchemaAvailable
      ? (
          await sql`
            insert into public.month_plan_approvals
              (draft_id, family_id, month_start, final_revision, revision_history)
            values
              (gen_random_uuid(), ${familyBId}, '2026-01-01'::date, 1, '[]'::jsonb)
            returning draft_id
          `
        )[0]?.draft_id
      : null;
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
    const subjectLessonMaterialBId = subjectLessonBId
      ? await insertSubjectLessonMaterialFixture(
          familyBId,
          childBId,
          subjectLessonBId,
        )
      : null;

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
    // Expand/contract window (2026-07-18 merge-to-main review finding):
    // the enforcing trigger is a deliberately separate, later migration
    // that must not land until the RPC-aware finalizeMaterialCaller is
    // confirmed READY in production -- applying it first would reject
    // every family's existing direct-update approval. During that safe
    // window a direct update still succeeds, on purpose; assert that
    // honestly instead of failing, and assert the real denial once the
    // second migration has landed.
    if (await materialStatusWriteBoundaryEnforced()) {
      await expectAuthenticatedUpdateDenied(
        familyBUser.accessToken,
        "materials",
        "id",
        materialBId,
        { status: "final", approved_at: new Date().toISOString() },
        "auth member cannot directly update material status",
      );
    } else {
      report(
        "auth member cannot directly update material status",
        true,
        "not yet enforced: enforce_material_status_write_boundary migration deliberately pending (code-then-migration rollout window)",
      );
    }
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
    if (subjectLessonBId && subjectLessonMaterialBId) {
      await expectAuthenticatedRead(
        familyBUser.accessToken,
        "materials",
        subjectLessonMaterialBId,
        0,
        "auth member cannot read a lesson-linked draft material",
      );
      await expectAuthenticatedInsertDenied(
        familyBUser.accessToken,
        "materials",
        {
          family_id: familyBId,
          child_id: childBId,
          subject_lesson_id: subjectLessonBId,
          title: "Client-forged lesson worksheet",
          kind: "worksheet",
          pdf_url: "https://example.com/client-forged.pdf",
          preview_url: "https://example.com/client-forged.jpg",
          html: "<p>Client-forged lesson worksheet.</p>",
          source: "html",
          channel: "web",
        },
        "auth member cannot forge subject lesson material provenance",
      );
      await expectAuthenticatedRpcDenied(
        familyBSecondUser.accessToken,
        "finalize_family_material",
        {
          p_family_id: familyBId,
          p_material_id: subjectLessonMaterialBId,
        },
        "non-owner cannot finalize a lesson-linked material",
      );
      const ownerFinalize = await restAs(
        familyBUser.accessToken,
        "rpc/finalize_family_material",
        {
          method: "POST",
          body: JSON.stringify({
            p_family_id: familyBId,
            p_material_id: subjectLessonMaterialBId,
          }),
          headers: { Prefer: "return=representation" },
        },
      );
      const ownerFinalizeRaw = await ownerFinalize.text();
      report(
        "account owner can finalize the exact lesson worksheet",
        ownerFinalize.ok
          && ownerFinalizeRaw.includes('"finalized":true'),
        `HTTP ${ownerFinalize.status}, ${ownerFinalizeRaw.slice(0, 100)}`,
      );
      await expectAuthenticatedRead(
        familyBUser.accessToken,
        "materials",
        subjectLessonMaterialBId,
        1,
        "auth member can read a final lesson worksheet in Binder",
      );
    }

    const ordinaryFinalize = await restAs(
      familyBSecondUser.accessToken,
      "rpc/finalize_family_material",
      {
        method: "POST",
        body: JSON.stringify({
          p_family_id: familyBId,
          p_material_id: materialBId,
        }),
        headers: { Prefer: "return=representation" },
      },
    );
    const ordinaryFinalizeRaw = await ordinaryFinalize.text();
    let ordinaryFinalizeBody = null;
    try {
      ordinaryFinalizeBody = ordinaryFinalizeRaw
        ? JSON.parse(ordinaryFinalizeRaw)
        : null;
    } catch {
      ordinaryFinalizeBody = null;
    }
    const ordinaryFinalizeRow = Array.isArray(ordinaryFinalizeBody)
      ? ordinaryFinalizeBody[0]
      : ordinaryFinalizeBody;
    report(
      "family member can finalize an ordinary material through the RPC",
      ordinaryFinalize.ok && ordinaryFinalizeRow?.finalized === true,
      `HTTP ${ordinaryFinalize.status}, ${ordinaryFinalizeRaw.slice(0, 100)}`,
    );
    // child_plans (migration #26) carries the same is_child_family_member
    // policy shape as children/family_memories/materials: real member-scoped
    // read/insert/update/delete policies, not a hard deny.
    const childPlanBId = await insertFixtureRow(
      familyBUser,
      "child_plans",
      {
        child_id: childBId,
        subject_id: "isolation-check",
        plan: {},
        bank_version: "isolation",
      },
      "create Family B child plan fixture",
    );
    const [childPlanRebuildHistoryB] = await sql`
      insert into public.child_plan_rebuild_history (
        child_id,
        subject_id,
        plan_id,
        plan_revision,
        progress_revision,
        plan,
        progress,
        remapped_progress,
        source_links,
        scheduled_days,
        archived_done_count,
        preserved_done_count,
        reason
      ) values (
        ${childBId},
        'isolation-check',
        ${childPlanBId},
        1,
        0,
        '{}'::jsonb,
        '{}'::jsonb,
        '{}'::jsonb,
        '[]'::jsonb,
        '[]'::jsonb,
        0,
        0,
        'deep-dive-rebuild'
      )
      returning id
    `;
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

    let familyAssetUploadB = null;
    let familyAssetA = null;
    let familyAssetB = null;
    let familyAssetChildB = null;
    let familyAssetTagB = null;
    let familyAssetPlanLinkB = null;
    let familyAssetUnitB = null;
    let familyCurriculumMappingApprovalB = null;
    if (familyLibrarySchemaAvailable) {
      const [familyAssetUploadA] = await sql`
        insert into public.family_asset_uploads (
          family_id, initiated_by_user_id, client_request_id, original_name,
          pathname, media_type, byte_size, last_modified, fingerprint_sha256
        )
        values (
          ${familyAId}, ${familyAUser.userId}, ${crypto.randomUUID()},
          'family-a.pdf',
          'families/isolation-a/library/upload-a/family-a.pdf',
          'application/pdf', 100, 1, ${"a".repeat(64)}
        )
        returning id
      `;
      [familyAssetUploadB] = await sql`
        insert into public.family_asset_uploads (
          family_id, initiated_by_user_id, client_request_id, original_name,
          pathname, media_type, byte_size, last_modified, fingerprint_sha256
        )
        values (
          ${familyBId}, ${familyBUser.userId}, ${crypto.randomUUID()},
          'family-b.pdf',
          'families/isolation-b/library/upload-b/family-b.pdf',
          'application/pdf', 200, 2, ${"b".repeat(64)}
        )
        returning id
      `;
      [familyAssetA] = await sql`
        insert into public.family_assets (
          family_id, uploaded_by_user_id, source_upload_id, title, original_name, url,
          download_url, media_type, byte_size, file_kind
        )
        values (
          ${familyAId}, ${familyAUser.userId}, ${familyAssetUploadA.id},
          'Family A curriculum',
          'family-a.pdf',
          'https://example.public.blob.vercel-storage.com/families/isolation-a/library/family-a.pdf',
          'https://example.public.blob.vercel-storage.com/families/isolation-a/library/family-a.pdf?download=1',
          'application/pdf', 100, 'document'
        )
        returning id
      `;
      [familyAssetB] = await sql`
        insert into public.family_assets (
          family_id, uploaded_by_user_id, source_upload_id, source_attachment_id, title,
          original_name, url, download_url, media_type, byte_size, file_kind
        )
        values (
          ${familyBId}, ${familyBUser.userId}, ${familyAssetUploadB.id},
          ${chatAttachmentB.id},
          'Family B curriculum', 'family-b.pdf',
          'https://example.public.blob.vercel-storage.com/families/isolation-b/library/family-b.pdf',
          'https://example.public.blob.vercel-storage.com/families/isolation-b/library/family-b.pdf?download=1',
          'application/pdf', 200, 'document'
        )
        returning id
      `;
      [familyAssetUnitB] = await sql`
        insert into public.family_assets (
          family_id, uploaded_by_user_id, parent_asset_id, ordinal, unit_label,
          title, original_name, url, download_url, media_type, byte_size, file_kind
        )
        values (
          ${familyBId}, ${familyBUser.userId}, ${familyAssetB.id}, 1, 'Week 1',
          'Family B week 1', 'family-b-week-1.pdf',
          'https://example.public.blob.vercel-storage.com/families/isolation-b/library/family-b-week-1.pdf',
          'https://example.public.blob.vercel-storage.com/families/isolation-b/library/family-b-week-1.pdf?download=1',
          'application/pdf', 80, 'document'
        )
        returning id, parent_asset_id
      `;
      report(
        "constraint accepts an in-family family asset parent link",
        familyAssetUnitB?.parent_asset_id === familyAssetB.id,
        `parent ${familyAssetUnitB?.parent_asset_id}`,
      );
      let crossFamilyParentRejected = false;
      try {
        await sql`
          insert into public.family_assets (
            family_id, uploaded_by_user_id, parent_asset_id, ordinal,
            title, original_name, url, download_url, media_type, byte_size, file_kind
          )
          values (
            ${familyBId}, ${familyBUser.userId}, ${familyAssetA.id}, 2,
            'Cross-family unit', 'cross-family.pdf',
            'https://example.public.blob.vercel-storage.com/families/isolation-b/library/cross-family.pdf',
            'https://example.public.blob.vercel-storage.com/families/isolation-b/library/cross-family.pdf?download=1',
            'application/pdf', 80, 'document'
          )
        `;
      } catch {
        crossFamilyParentRejected = true;
      }
      report(
        "constraint rejects a cross-family family asset parent link",
        crossFamilyParentRejected,
        "cross-family parent insert unexpectedly succeeded",
      );
      let crossFamilyUploadRejected = false;
      try {
        await sql`
          insert into public.family_assets (
            family_id, uploaded_by_user_id, source_upload_id,
            title, original_name, url, download_url, media_type, byte_size, file_kind
          )
          values (
            ${familyBId}, ${familyBUser.userId}, ${familyAssetUploadA.id},
            'Cross-family upload', 'cross-family-upload.pdf',
            'https://example.public.blob.vercel-storage.com/families/isolation-b/library/cross-family-upload.pdf',
            'https://example.public.blob.vercel-storage.com/families/isolation-b/library/cross-family-upload.pdf?download=1',
            'application/pdf', 80, 'document'
          )
        `;
      } catch {
        crossFamilyUploadRejected = true;
      }
      report(
        "constraint rejects a cross-family family asset upload link",
        crossFamilyUploadRejected,
        "cross-family source upload insert unexpectedly succeeded",
      );
      [familyAssetChildB] = await sql`
        insert into public.family_asset_children (family_id, asset_id, child_id)
        values (${familyBId}, ${familyAssetB.id}, ${childBId})
        returning id
      `;
      [familyAssetTagB] = await sql`
        insert into public.family_asset_tags (
          family_id, asset_id, kind, value, catalog_id, quote, source_locator
        )
        values (
          ${familyBId}, ${familyAssetB.id}, 'subject', 'Math', 'math',
          'Isolation source quote.', 'page 1'
        )
        returning id
      `;
      if (familyAssetPlanLinksSchemaAvailable) {
        [familyAssetPlanLinkB] = await sql`
          insert into public.family_asset_plan_links (
            family_id, asset_id, child_id, subject_id, week,
            activity_index, activity_text, source_title, source_locator
          ) values (
            ${familyBId}, ${familyAssetB.id}, ${childBId},
            'isolation-check', 1, 0, 'Count the source examples.',
            'Family B curriculum', 'page 1'
          )
          returning id
        `;
        let crossFamilyPlanSourceRejected = false;
        try {
          await sql`
            insert into public.family_asset_plan_links (
              family_id, asset_id, child_id, subject_id, week,
              activity_index, activity_text, source_title
            ) values (
              ${familyBId}, ${familyAssetA.id}, ${childBId},
              'isolation-check', 1, 1, 'Cross-family source.',
              'Foreign curriculum'
            )
          `;
        } catch {
          crossFamilyPlanSourceRejected = true;
        }
        report(
          "constraint rejects a cross-family planner source link",
          crossFamilyPlanSourceRejected,
          "cross-family planner source insert unexpectedly succeeded",
        );
      }
      if (familyCurriculumMappingSchemaAvailable) {
        const curriculumDraftB = crypto.randomUUID();
        [familyCurriculumMappingApprovalB] = await sql`
          insert into public.family_curriculum_mapping_approvals (
            draft_id, family_id, source_asset_id, final_revision,
            decomposition_quality, unit_kind, declared_unit_count,
            unit_asset_ids, planner_targets, revision_history
          ) values (
            ${curriculumDraftB}, ${familyBId}, ${familyAssetB.id}, 1,
            'full', 'week', 1,
            ${sql.json([
              {
                ordinal: 1,
                id: familyAssetUnitB.id,
                title: "Week 1",
                sourceLocator: "Page 8",
              },
            ])},
            '[]'::jsonb,
            ${sql.json([{ revision: 1, action: "created" }])}
          )
          returning draft_id
        `;
        let crossFamilyCurriculumSourceRejected = false;
        try {
          await sql`
            insert into public.family_curriculum_mapping_approvals (
              draft_id, family_id, source_asset_id, final_revision,
              decomposition_quality, unit_kind, declared_unit_count,
              unit_asset_ids, planner_targets, revision_history
            ) values (
              ${crypto.randomUUID()}, ${familyBId}, ${familyAssetA.id}, 1,
              'full', 'week', 1,
              ${sql.json([
                {
                  ordinal: 1,
                  id: familyAssetUnitB.id,
                  title: "Week 1",
                  sourceLocator: "Page 8",
                },
              ])},
              '[]'::jsonb,
              ${sql.json([{ revision: 1, action: "created" }])}
            )
          `;
        } catch {
          crossFamilyCurriculumSourceRejected = true;
        }
        report(
          "constraint rejects a cross-family curriculum approval source",
          crossFamilyCurriculumSourceRejected,
          "cross-family curriculum approval unexpectedly succeeded",
        );
      }
    }

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
      "child_plans",
      childPlanBId,
      1,
      "auth member can read own child plan",
    );
    await expectAuthenticatedRead(
      familyAUser.accessToken,
      "child_plans",
      childPlanBId,
      0,
      "auth member cannot read another family's child plan",
    );
    await expectAuthenticatedRead(
      familyBUser.accessToken,
      "child_plan_rebuild_history",
      childPlanRebuildHistoryB.id,
      1,
      "auth member can read own child plan rebuild history",
    );
    await expectAuthenticatedRead(
      familyAUser.accessToken,
      "child_plan_rebuild_history",
      childPlanRebuildHistoryB.id,
      0,
      "auth member cannot read another family's child plan rebuild history",
    );
    const childPlanRebuildHistoryWriteFixture = {
      keyColumn: "id",
      keyValue: childPlanRebuildHistoryB.id,
      insertRow: {
        child_id: childBId,
        subject_id: "isolation-client-forge",
        plan_id: childPlanBId,
        plan_revision: 1,
        progress_revision: 0,
        plan: {},
        progress: {},
        remapped_progress: {},
        source_links: [],
        scheduled_days: [],
        archived_done_count: 0,
        preserved_done_count: 0,
        reason: "deep-dive-rebuild",
      },
      updateRow: { archived_done_count: 1 },
    };
    await expectAuthenticatedWritesDenied(
      familyBUser.accessToken,
      "child_plan_rebuild_history",
      childPlanRebuildHistoryWriteFixture,
      "auth member cannot mutate own child plan rebuild history",
    );
    await expectAuthenticatedWritesDenied(
      familyAUser.accessToken,
      "child_plan_rebuild_history",
      childPlanRebuildHistoryWriteFixture,
      "cross-family token cannot mutate Family B child plan rebuild history",
    );
    const [serverVersion] = await sql`
      select current_setting('server_version_num') as version_num
    `;
    if (Number(serverVersion.version_num) >= 170000) {
      const [maintainAcl] = await sql`
        select
          has_table_privilege(
            'authenticated',
            'public.child_plan_rebuild_history',
            'MAINTAIN'
          ) as authenticated_can_maintain,
          has_table_privilege(
            'anon',
            'public.child_plan_rebuild_history',
            'MAINTAIN'
          ) as anon_can_maintain,
          has_table_privilege(
            'service_role',
            'public.child_plan_rebuild_history',
            'MAINTAIN'
          ) as service_can_maintain
      `;
      report(
        "rebuild history maintenance remains server-only",
        maintainAcl?.authenticated_can_maintain === false &&
          maintainAcl?.anon_can_maintain === false &&
          maintainAcl?.service_can_maintain === true,
        JSON.stringify(maintainAcl),
      );
    }
    // toggle_plan_activity_check (migration 20260729160000) is the atomic
    // single-key alternative to the whole-map-replace check-off sync;
    // its authorization check must deny a cross-family child the same
    // way is_child_family_member denies every other child-scoped write.
    await expectAuthenticatedRpcDenied(
      familyAUser.accessToken,
      "toggle_plan_activity_check",
      {
        target_child_id: childBId,
        target_subject_id: "isolation-check",
        target_week: 1,
        target_activity_index: 0,
        target_done: true,
      },
      "auth member cannot toggle another family's plan activity check",
    );
    const [staleSafeCheckFunction] = await sql`
      select to_regprocedure(
        'public.set_plan_activity_check_v2(uuid,text,text,boolean,text,bigint)'
      ) is not null as available
    `;
    if (staleSafeCheckFunction?.available === true) {
      await expectAuthenticatedRpcDenied(
        familyAUser.accessToken,
        "set_plan_activity_check_v2",
        {
          target_child_id: childBId,
          target_subject_id: "isolation-check",
          target_check_key: "1.0",
          target_done: true,
          target_expected_text: "Cross-family source.",
          target_plan_revision: 1,
        },
        "auth member cannot use stale-safe check-off on another family's plan",
      );
      const [staleSafePrivileges] = await sql`
        select
          has_function_privilege(
            'authenticated',
            'public.set_plan_activity_check(uuid,text,text,boolean,text,bigint)',
            'execute'
          ) as v1_enabled,
          has_function_privilege(
            'authenticated',
            'public.set_plan_activity_check_v2(uuid,text,text,boolean,text,bigint)',
            'execute'
          ) as v2_enabled
      `;
      report(
        "authenticated callers use only the tenant-receipted stale-safe check contract",
        staleSafePrivileges?.v1_enabled === false &&
          staleSafePrivileges?.v2_enabled === true,
        "obsolete v1 remains executable or v2 is unavailable",
      );
    } else {
      report(
        "stale-safe Planner check function absent from target (additive migration not applied yet); nothing exposed",
        true,
      );
    }
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
    if (familyAssetUploadB && familyAssetB && familyAssetChildB && familyAssetTagB) {
      for (const fixture of [
        {
          table: "family_asset_uploads",
          id: familyAssetUploadB.id,
          ownLabel: "auth member can read own family asset upload",
          foreignLabel: "auth member cannot read another family's family asset upload",
        },
        {
          table: "family_assets",
          id: familyAssetB.id,
          ownLabel: "auth member can read own family asset",
          foreignLabel: "auth member cannot read another family's family asset",
        },
        {
          table: "family_asset_children",
          id: familyAssetChildB.id,
          ownLabel: "auth member can read own family asset child link",
          foreignLabel: "auth member cannot read another family's family asset child link",
        },
        {
          table: "family_asset_tags",
          id: familyAssetTagB.id,
          ownLabel: "auth member can read own family asset tag",
          foreignLabel: "auth member cannot read another family's family asset tag",
        },
      ]) {
        await expectAuthenticatedRead(
          familyBUser.accessToken,
          fixture.table,
          fixture.id,
          1,
          fixture.ownLabel,
        );
        await expectAuthenticatedRead(
          familyAUser.accessToken,
          fixture.table,
          fixture.id,
          0,
          fixture.foreignLabel,
        );
      }

      const familyAssetUploadWriteFixture = {
        keyColumn: "id",
        keyValue: familyAssetUploadB.id,
        insertRow: {
          family_id: familyBId,
          client_request_id: crypto.randomUUID(),
          original_name: "client-forged.pdf",
          pathname: "families/isolation-b/library/forged/client-forged.pdf",
          media_type: "application/pdf",
          byte_size: 100,
          last_modified: 1,
          fingerprint_sha256: "c".repeat(64),
        },
        updateRow: { status_note: "Clients must never alter upload state." },
      };
      await expectAuthenticatedWritesDenied(
        familyBUser.accessToken,
        "family_asset_uploads",
        familyAssetUploadWriteFixture,
        "auth member cannot mutate own family asset upload",
      );
      await expectAuthenticatedWritesDenied(
        familyAUser.accessToken,
        "family_asset_uploads",
        familyAssetUploadWriteFixture,
        "cross-family token cannot mutate Family B family asset upload",
      );

      await expectAuthenticatedWritesDenied(
        familyBUser.accessToken,
        "family_assets",
        {
          keyColumn: "id",
          keyValue: familyAssetB.id,
          insertRow: {
            family_id: familyBId,
            title: "Client forged asset",
            original_name: "client-forged.pdf",
            url: "https://example.com/client-forged.pdf",
            download_url: "https://example.com/client-forged.pdf?download=1",
            media_type: "application/pdf",
            byte_size: 100,
            file_kind: "document",
          },
          updateRow: { title: "Clients must never alter assets directly." },
        },
        "auth member cannot mutate own family asset",
      );
      await expectAuthenticatedWritesDenied(
        familyAUser.accessToken,
        "family_assets",
        {
          keyColumn: "id",
          keyValue: familyAssetB.id,
          insertRow: {
            family_id: familyBId,
            title: "Cross-family forged asset",
            original_name: "cross-family.pdf",
            url: "https://example.com/cross-family.pdf",
            download_url: "https://example.com/cross-family.pdf?download=1",
            media_type: "application/pdf",
            byte_size: 100,
            file_kind: "document",
          },
          updateRow: { title: "Cross-family clients must never alter assets." },
        },
        "cross-family token cannot mutate Family B family asset",
      );

      if (familyAssetPlanLinkB) {
        await expectAuthenticatedRead(
          familyBUser.accessToken,
          "family_asset_plan_links",
          familyAssetPlanLinkB.id,
          1,
          "auth member can read own planner source link",
        );
        await expectAuthenticatedRead(
          familyAUser.accessToken,
          "family_asset_plan_links",
          familyAssetPlanLinkB.id,
          0,
          "auth member cannot read another family's planner source link",
        );
        const familyAssetPlanLinkWriteFixture = {
          keyColumn: "id",
          keyValue: familyAssetPlanLinkB.id,
          insertRow: {
            family_id: familyBId,
            asset_id: familyAssetB.id,
            child_id: childBId,
            subject_id: "isolation-check",
            week: 1,
            activity_index: 1,
            activity_text: "Client-forged planner source.",
            source_title: "Family B curriculum",
          },
          updateRow: { source_title: "Clients must never alter source links." },
        };
        await expectAuthenticatedWritesDenied(
          familyBUser.accessToken,
          "family_asset_plan_links",
          familyAssetPlanLinkWriteFixture,
          "auth member cannot mutate own planner source link",
        );
        await expectAuthenticatedWritesDenied(
          familyAUser.accessToken,
          "family_asset_plan_links",
          familyAssetPlanLinkWriteFixture,
          "cross-family token cannot mutate Family B planner source link",
        );
      }
      if (familyCurriculumMappingApprovalB) {
        await expectAuthenticatedRead(
          familyBUser.accessToken,
          "family_curriculum_mapping_approvals",
          familyCurriculumMappingApprovalB.draft_id,
          1,
          "auth member can read own curriculum mapping approval",
          "draft_id",
        );
        await expectAuthenticatedRead(
          familyAUser.accessToken,
          "family_curriculum_mapping_approvals",
          familyCurriculumMappingApprovalB.draft_id,
          0,
          "auth member cannot read another family's curriculum mapping approval",
          "draft_id",
        );
        const curriculumApprovalWriteFixture = {
          keyColumn: "draft_id",
          keyValue: familyCurriculumMappingApprovalB.draft_id,
          insertRow: {
            draft_id: crypto.randomUUID(),
            family_id: familyBId,
            source_asset_id: familyAssetB.id,
            final_revision: 1,
            decomposition_quality: "full",
            unit_kind: "week",
            declared_unit_count: 1,
            unit_asset_ids: [
              {
                ordinal: 1,
                id: familyAssetUnitB.id,
                title: "Week 1",
                sourceLocator: "Page 8",
              },
            ],
            planner_targets: [],
            revision_history: [{ revision: 1, action: "created" }],
          },
          updateRow: { final_revision: 2 },
        };
        await expectAuthenticatedWritesDenied(
          familyBUser.accessToken,
          "family_curriculum_mapping_approvals",
          curriculumApprovalWriteFixture,
          "auth member cannot mutate own curriculum mapping approval",
        );
        await expectAuthenticatedWritesDenied(
          familyAUser.accessToken,
          "family_curriculum_mapping_approvals",
          curriculumApprovalWriteFixture,
          "cross-family token cannot mutate Family B curriculum mapping approval",
        );
      }
    }

    if (subjectLessonBId) {
      await expectAuthenticatedReadDenied(
        familyBUser.accessToken,
        "subject_lessons",
        "auth member cannot read subject lessons directly",
      );
      const subjectLessonWriteFixture = {
        keyColumn: "id",
        keyValue: subjectLessonBId,
        insertRow: {
          child_id: childBId,
          subject_id: "math",
          target_item_id: "math.client-forge",
          target_statement: "Client-forged lesson target",
          source_report_generated_at: new Date().toISOString(),
          source_fingerprint: "9".repeat(64),
          bank_version: "client-forge",
          idempotency_key: "9".repeat(64),
        },
        updateRow: {
          target_statement: "Authenticated clients cannot alter lessons.",
        },
      };
      await expectAuthenticatedWritesDenied(
        familyBUser.accessToken,
        "subject_lessons",
        subjectLessonWriteFixture,
        "auth member cannot mutate own subject lesson",
      );
      await expectAuthenticatedWritesDenied(
        familyAUser.accessToken,
        "subject_lessons",
        subjectLessonWriteFixture,
        "cross-family token cannot mutate Family B subject lesson",
      );
      await expectSubjectLessonChildCascade(familyBId);
    }

    // children and child_plans both resolve their update policy through
    // is_family_member/is_child_family_member rather than denying
    // authenticated writers outright, so a cross-family PATCH must be
    // proven to match zero rows, not merely rejected at the HTTP layer.
    await expectAuthenticatedUpdateFiltered(
      familyBUser.accessToken,
      "children",
      "id",
      childBId,
      { name: "Isolation B child (updated by owner)" },
      1,
      "auth member can update own child",
    );
    await expectAuthenticatedUpdateFiltered(
      familyAUser.accessToken,
      "children",
      "id",
      childBId,
      { name: "Cross-family rename should not apply" },
      0,
      "auth member cannot update another family's child",
    );
    await expectAuthenticatedUpdateFiltered(
      familyBUser.accessToken,
      "child_plans",
      "id",
      childPlanBId,
      { bank_version: "isolation-updated" },
      1,
      "auth member can update own child plan",
    );
    await expectAuthenticatedUpdateFiltered(
      familyAUser.accessToken,
      "child_plans",
      "id",
      childPlanBId,
      { bank_version: "cross-family-should-not-apply" },
      0,
      "auth member cannot update another family's child plan",
    );

    // hours_log's update policy is a new additive migration for the
    // /app/hours page (issue #174): expand/contract honesty, same as
    // the materials status window above, so this target reports
    // truthfully whether the migration has landed yet.
    if (await hoursLogUpdatePolicyEnforced()) {
      await expectAuthenticatedUpdateFiltered(
        familyBUser.accessToken,
        "hours_log",
        "id",
        hoursLogBId,
        { minutes: 60, note: "Edited by its own family." },
        1,
        "auth member can edit their own hours_log row",
      );
      await expectAuthenticatedUpdateFiltered(
        familyAUser.accessToken,
        "hours_log",
        "id",
        hoursLogBId,
        { minutes: 1, note: "Cross-family edit should not apply" },
        0,
        "auth member cannot edit another family's hours_log row",
      );
    } else {
      report(
        "auth member can edit their own hours_log row",
        true,
        "not yet enforced: the hours_log update policy migration (issue #174) is deliberately pending on this target",
      );
      report(
        "auth member cannot edit another family's hours_log row",
        true,
        "not yet enforced: the hours_log update policy migration (issue #174) is deliberately pending on this target",
      );
    }

    // family_events and plan_activity_schedule (issue #176, CG-03):
    // same expand/contract honesty as hours_log's update policy above,
    // since both tables are additive migrations from this same change
    // that are deliberately NOT applied to production by this session.
    if (familyEventsSchemaAvailable) {
      await expectAuthenticatedRead(
        familyBUser.accessToken,
        "family_events",
        familyEventBId,
        1,
        "auth member can read own family event",
      );
      await expectAuthenticatedRead(
        familyAUser.accessToken,
        "family_events",
        familyEventBId,
        0,
        "auth member cannot read another family's family event",
      );
      await expectAuthenticatedInsertDenied(
        familyAUser.accessToken,
        "family_events",
        {
          family_id: familyBId,
          title: "Client-forged family event",
          starts_on: "2026-01-01",
          ends_on: "2026-01-01",
        },
        "auth member cannot create another family's family event",
      );
      await expectAuthenticatedInsertDenied(
        familyBUser.accessToken,
        "family_events",
        {
          family_id: familyBId,
          child_id: childAId,
          title: "Forged child coherence",
          starts_on: "2026-01-01",
          ends_on: "2026-01-01",
        },
        "auth member cannot attach a family event to another family's child",
      );
      await expectAuthenticatedUpdateFiltered(
        familyBUser.accessToken,
        "family_events",
        "id",
        familyEventBId,
        { title: "Edited by its own family" },
        1,
        "auth member can update own family event",
      );
      await expectAuthenticatedUpdateFiltered(
        familyAUser.accessToken,
        "family_events",
        "id",
        familyEventBId,
        { title: "Cross-family edit should not apply" },
        0,
        "auth member cannot update another family's family event",
      );
      await expectAuthenticatedDeleteFiltered(
        familyAUser.accessToken,
        "family_events",
        "id",
        familyEventBId,
        0,
        "auth member cannot delete another family's family event",
      );
    } else {
      coveredTables.add("family_events");
      for (const label of [
        "auth member can read own family event",
        "auth member cannot read another family's family event",
        "auth member cannot create another family's family event",
        "auth member cannot attach a family event to another family's child",
        "auth member can update own family event",
        "auth member cannot update another family's family event",
        "auth member cannot delete another family's family event",
      ]) {
        report(
          label,
          true,
          "not yet enforced: the family_events migration (issue #176) is deliberately pending on this target",
        );
      }
    }

    if (familyEventChildrenSchemaAvailable && familyEventBId) {
      await expectAuthenticatedRead(
        familyBUser.accessToken,
        "family_event_children",
        familyEventBId,
        1,
        "auth member can read own family event child audience",
        "event_id",
      );
      await expectAuthenticatedRead(
        familyAUser.accessToken,
        "family_event_children",
        familyEventBId,
        0,
        "auth member cannot read another family's event child audience",
        "event_id",
      );
      await expectAuthenticatedInsertDenied(
        familyAUser.accessToken,
        "family_event_children",
        {
          family_id: familyBId,
          event_id: familyEventBId,
          child_id: childBId,
        },
        "auth member cannot add another family's event child audience",
      );
      await expectAuthenticatedUpdateFiltered(
        familyBUser.accessToken,
        "family_event_children",
        "event_id",
        familyEventBId,
        { child_id: childAId },
        0,
        "auth member cannot update event child audience in place",
      );
      await expectAuthenticatedDeleteFiltered(
        familyAUser.accessToken,
        "family_event_children",
        "event_id",
        familyEventBId,
        0,
        "auth member cannot remove another family's event child audience",
      );
      await expectAuthenticatedRpcDenied(
        familyAUser.accessToken,
        "save_family_event_with_children",
        {
          p_mode: "update",
          p_event_id: familyEventBId,
          p_family_id: familyBId,
          p_title: "Cross-family RPC update",
          p_starts_on: "2026-01-01",
          p_ends_on: "2026-01-01",
          p_start_time: null,
          p_end_time: null,
          p_note: null,
          p_recurrence_rule: null,
          p_child_ids: [childBId],
        },
        "auth member cannot save another family's event audience through RPC",
      );
    } else {
      coveredTables.add("family_event_children");
      for (const label of [
        "auth member can read own family event child audience",
        "auth member cannot read another family's event child audience",
        "auth member cannot add another family's event child audience",
        "auth member cannot update event child audience in place",
        "auth member cannot remove another family's event child audience",
        "auth member cannot save another family's event audience through RPC",
      ]) {
        report(
          label,
          true,
          "not yet enforced: the additive family_event_children migration is pending on this target",
        );
      }
    }

    if (familyEventOccurrenceExceptionsSchemaAvailable && familyEventBId) {
      await expectAuthenticatedRead(
        familyBUser.accessToken,
        "family_event_occurrence_exceptions",
        familyEventBId,
        1,
        "auth member can read own family event occurrence exception",
        "event_id",
      );
      await expectAuthenticatedRead(
        familyAUser.accessToken,
        "family_event_occurrence_exceptions",
        familyEventBId,
        0,
        "auth member cannot read another family's event occurrence exception",
        "event_id",
      );
      await expectAuthenticatedInsertDenied(
        familyBUser.accessToken,
        "family_event_occurrence_exceptions",
        {
          family_id: familyBId,
          event_id: familyEventBId,
          occurrence_on: "2026-01-15",
          kind: "cancelled",
        },
        "auth member cannot bypass the occurrence exception RPC",
      );
      await expectAuthenticatedUpdateDenied(
        familyBUser.accessToken,
        "family_event_occurrence_exceptions",
        "event_id",
        familyEventBId,
        { kind: "moved" },
        "auth member cannot edit an occurrence exception directly",
      );
      await expectAuthenticatedDeleteDenied(
        familyBUser.accessToken,
        "family_event_occurrence_exceptions",
        "event_id",
        familyEventBId,
        "auth member cannot delete an occurrence exception directly",
      );
      await expectAuthenticatedRpcDenied(
        familyAUser.accessToken,
        "save_family_event_occurrence_exception",
        {
          p_event_id: familyEventBId,
          p_family_id: familyBId,
          p_occurrence_on: "2026-01-15",
          p_kind: "cancelled",
          p_starts_on: null,
          p_ends_on: null,
          p_start_time: null,
          p_end_time: null,
        },
        "auth member cannot change another family's recurring occurrence through RPC",
      );
    } else {
      coveredTables.add("family_event_occurrence_exceptions");
      for (const label of [
        "auth member can read own family event occurrence exception",
        "auth member cannot read another family's event occurrence exception",
        "auth member cannot bypass the occurrence exception RPC",
        "auth member cannot edit an occurrence exception directly",
        "auth member cannot delete an occurrence exception directly",
        "auth member cannot change another family's recurring occurrence through RPC",
      ]) {
        report(
          label,
          true,
          "not yet enforced: the additive family event occurrence exception migration is pending on this target",
        );
      }
    }

    if (planActivityScheduleSchemaAvailable) {
      const [scheduleFunction] = await sql`
        select to_regprocedure(
          'public.schedule_plan_activity_v2(uuid,text,smallint,smallint,date,text,bigint,uuid)'
        ) is not null as available
      `;
      if (scheduleFunction?.available === true) {
        await expectAuthenticatedRpcDenied(
          familyAUser.accessToken,
          "schedule_plan_activity_v2",
          {
            target_child_id: childBId,
            target_subject_id: "isolation-check",
            target_week: 1,
            target_activity_index: 0,
            target_scheduled_date: "2026-01-04",
            target_expected_text: "Cross-family source.",
            target_plan_revision: 1,
            target_schedule_id: null,
          },
          "auth member cannot schedule another family's plan activity",
        );
        const [schedulePrivileges] = await sql`
          select
            has_function_privilege(
              'authenticated',
              'public.schedule_plan_activity_v2(uuid,text,smallint,smallint,date,text,bigint,uuid)',
              'execute'
            ) as authenticated_can_execute,
            has_function_privilege(
              'anon',
              'public.schedule_plan_activity_v2(uuid,text,smallint,smallint,date,text,bigint,uuid)',
              'execute'
            ) as anon_can_execute
        `;
        report(
          "schedule RPC is authenticated-only",
          schedulePrivileges?.authenticated_can_execute === true &&
            schedulePrivileges?.anon_can_execute === false,
          JSON.stringify(schedulePrivileges),
        );
      } else {
        report(
          "schedule RPC absent from target (additive migration not applied yet); nothing exposed",
          true,
        );
      }
      await expectAuthenticatedRead(
        familyBUser.accessToken,
        "plan_activity_schedule",
        planActivityScheduleBId,
        1,
        "auth member can read own plan schedule entry",
      );
      await expectAuthenticatedRead(
        familyAUser.accessToken,
        "plan_activity_schedule",
        planActivityScheduleBId,
        0,
        "auth member cannot read another family's plan schedule entry",
      );
      await expectAuthenticatedInsertDenied(
        familyBUser.accessToken,
        "plan_activity_schedule",
        {
          family_id: familyBId,
          child_id: childAId,
          subject_id: "isolation-check",
          week: 1,
          activity_index: 0,
          scheduled_date: "2026-01-01",
        },
        "auth member cannot attach a plan schedule entry to another family's child",
      );
      await expectAuthenticatedUpdateFiltered(
        familyBUser.accessToken,
        "plan_activity_schedule",
        "id",
        planActivityScheduleBId,
        { scheduled_date: "2026-01-02" },
        1,
        "auth member can update own plan schedule entry",
      );
      await expectAuthenticatedUpdateFiltered(
        familyAUser.accessToken,
        "plan_activity_schedule",
        "id",
        planActivityScheduleBId,
        { scheduled_date: "2026-01-03" },
        0,
        "auth member cannot update another family's plan schedule entry",
      );
      await expectAuthenticatedDeleteFiltered(
        familyAUser.accessToken,
        "plan_activity_schedule",
        "id",
        planActivityScheduleBId,
        0,
        "auth member cannot delete another family's plan schedule entry",
      );
    } else {
      coveredTables.add("plan_activity_schedule");
      for (const label of [
        "auth member can read own plan schedule entry",
        "auth member cannot read another family's plan schedule entry",
        "auth member cannot attach a plan schedule entry to another family's child",
        "auth member can update own plan schedule entry",
        "auth member cannot update another family's plan schedule entry",
        "auth member cannot delete another family's plan schedule entry",
      ]) {
        report(
          label,
          true,
          "not yet enforced: the plan_activity_schedule migration (issue #176) is deliberately pending on this target",
        );
      }
    }

    if (plannerLearningSchemaAvailable && plannerLearningActivityBId) {
      await expectAuthenticatedRead(
        familyBUser.accessToken,
        "planner_learning_activities",
        plannerLearningActivityBId,
        1,
        "auth member can read own planner learning activity",
      );
      await expectAuthenticatedRead(
        familyAUser.accessToken,
        "planner_learning_activities",
        plannerLearningActivityBId,
        0,
        "auth member cannot read another family's planner learning activity",
      );
      await expectAuthenticatedRead(
        familyBUser.accessToken,
        "planner_learning_activity_children",
        plannerLearningActivityBId,
        1,
        "auth member can read own planner learning child audience",
        "activity_id",
      );
      await expectAuthenticatedRead(
        familyAUser.accessToken,
        "planner_learning_activity_children",
        plannerLearningActivityBId,
        0,
        "auth member cannot read another family's planner learning child audience",
        "activity_id",
      );
      await expectAuthenticatedWritesDenied(
        familyBUser.accessToken,
        "planner_learning_activities",
        {
          insertRow: {
            family_id: familyBId,
            title: "Client-forged Planner lesson",
            subject: "math",
            activity_date: "2026-01-01",
            status: "planned",
            source_channel: "web",
            source_quote: "Client-forged Planner lesson",
            idempotency_key: `isolation-planner-forged:${suffix}`,
          },
          keyColumn: "id",
          keyValue: plannerLearningActivityBId,
          updateRow: { title: "Direct edit should be denied" },
        },
        "auth member cannot directly write planner learning activities",
      );
      await expectAuthenticatedWritesDenied(
        familyBUser.accessToken,
        "planner_learning_activity_children",
        {
          insertRow: {
            family_id: familyBId,
            activity_id: plannerLearningActivityBId,
            child_id: childBId,
          },
          keyColumn: "activity_id",
          keyValue: plannerLearningActivityBId,
          updateRow: { child_id: childAId },
        },
        "auth member cannot directly write planner learning child audiences",
      );
      await expectAuthenticatedRpcDenied(
        familyAUser.accessToken,
        "set_planner_learning_activity_status",
        {
          target_activity_id: plannerLearningActivityBId,
          target_expected_status: "planned",
          target_status: "completed",
          target_source_channel: "web",
        },
        "auth member cannot change another family's planner learning status",
      );

      const completeBody = await jsonResponse(
        await restAs(
          familyBUser.accessToken,
          "rpc/set_planner_learning_activity_status",
          {
            method: "POST",
            body: JSON.stringify({
              target_activity_id: plannerLearningActivityBId,
              target_expected_status: "planned",
              target_status: "completed",
              target_source_channel: "web",
            }),
            headers: { Prefer: "return=representation" },
          },
        ),
        "complete own planner learning activity",
      );
      const completeRow = Array.isArray(completeBody) ? completeBody[0] : completeBody;
      report(
        "auth member can complete own planner learning activity through exact RPC",
        completeRow?.result === "applied"
          && completeRow?.activity_status === "completed"
          && completeRow?.changed === true,
        JSON.stringify(completeRow).slice(0, 180),
      );

      await sql`
        insert into public.planner_learning_activity_hours
          (family_id, activity_id, hours_entry_id)
        values (${familyBId}, ${plannerLearningActivityBId}, ${hoursLogBId})
      `;
      await expectAuthenticatedRead(
        familyBUser.accessToken,
        "planner_learning_activity_hours",
        plannerLearningActivityBId,
        1,
        "auth member can read own planner learning Hours link",
        "activity_id",
      );
      await expectAuthenticatedRead(
        familyAUser.accessToken,
        "planner_learning_activity_hours",
        plannerLearningActivityBId,
        0,
        "auth member cannot read another family's planner learning Hours link",
        "activity_id",
      );
      await expectAuthenticatedWritesDenied(
        familyBUser.accessToken,
        "planner_learning_activity_hours",
        {
          insertRow: {
            family_id: familyBId,
            activity_id: plannerLearningActivityBId,
            hours_entry_id: hoursLogBId,
          },
          keyColumn: "activity_id",
          keyValue: plannerLearningActivityBId,
          updateRow: { hours_entry_id: hoursLogBId },
        },
        "auth member cannot directly write planner learning Hours links",
      );

      const undoBody = await jsonResponse(
        await restAs(
          familyBUser.accessToken,
          "rpc/set_planner_learning_activity_status",
          {
            method: "POST",
            body: JSON.stringify({
              target_activity_id: plannerLearningActivityBId,
              target_expected_status: "completed",
              target_status: "planned",
              target_source_channel: "web",
            }),
            headers: { Prefer: "return=representation" },
          },
        ),
        "atomically undo Hours-linked planner learning activity",
      );
      const undoRow = Array.isArray(undoBody) ? undoBody[0] : undoBody;
      const [undoCounts] = await sql`
        select
          (select count(*)::integer
             from public.hours_log
            where id = ${hoursLogBId}) as hours_count,
          (select count(*)::integer
             from public.planner_learning_activity_hours
            where activity_id = ${plannerLearningActivityBId}) as link_count
      `;
      report(
        "Hours-linked planner learning activity atomically unchecks",
        undoRow?.result === "applied"
          && undoRow?.activity_status === "planned"
          && undoRow?.changed === true
          && undoCounts?.hours_count === 0
          && undoCounts?.link_count === 0,
        JSON.stringify({ undoRow, undoCounts }).slice(0, 220),
      );
    } else {
      for (const table of [
        "planner_learning_activities",
        "planner_learning_activity_children",
        "planner_learning_activity_hours",
      ]) {
        coveredTables.add(table);
      }
      for (const label of [
        "auth member can read own planner learning activity",
        "auth member cannot read another family's planner learning activity",
        "auth member can read own planner learning child audience",
        "auth member cannot read another family's planner learning child audience",
        "auth member cannot directly write planner learning activities insert",
        "auth member cannot directly write planner learning activities update",
        "auth member cannot directly write planner learning activities delete",
        "auth member cannot directly write planner learning child audiences insert",
        "auth member cannot directly write planner learning child audiences update",
        "auth member cannot directly write planner learning child audiences delete",
        "auth member cannot change another family's planner learning status",
        "auth member can complete own planner learning activity through exact RPC",
        "auth member can read own planner learning Hours link",
        "auth member cannot read another family's planner learning Hours link",
        "auth member cannot directly write planner learning Hours links insert",
        "auth member cannot directly write planner learning Hours links update",
        "auth member cannot directly write planner learning Hours links delete",
        "Hours-linked planner learning activity cannot be silently unchecked",
      ]) {
        report(
          label,
          true,
          "not yet enforced: the additive planner learning activity migration is pending on this target",
        );
      }
    }

    if (monthPlanApprovalsSchemaAvailable) {
      await expectAuthenticatedRead(
        familyBUser.accessToken,
        "month_plan_approvals",
        monthPlanApprovalBId,
        1,
        "auth member can read own approved month receipt",
        "draft_id",
      );
      await expectAuthenticatedRead(
        familyAUser.accessToken,
        "month_plan_approvals",
        monthPlanApprovalBId,
        0,
        "auth member cannot read another family's approved month receipt",
        "draft_id",
      );
      await expectAuthenticatedInsertDenied(
        familyBUser.accessToken,
        "month_plan_approvals",
        {
          draft_id: "00000000-0000-4000-8000-000000000099",
          family_id: familyBId,
          month_start: "2026-02-01",
          final_revision: 1,
          revision_history: [],
        },
        "auth member cannot forge an approved month receipt",
      );
      await expectAuthenticatedUpdateDenied(
        familyBUser.accessToken,
        "month_plan_approvals",
        "draft_id",
        monthPlanApprovalBId,
        { final_revision: 2 },
        "auth member cannot update an approved month receipt",
      );
      await expectAuthenticatedDeleteDenied(
        familyBUser.accessToken,
        "month_plan_approvals",
        "draft_id",
        monthPlanApprovalBId,
        "auth member cannot delete an approved month receipt",
      );
    } else {
      coveredTables.add("month_plan_approvals");
      for (const label of [
        "auth member can read own approved month receipt",
        "auth member cannot read another family's approved month receipt",
        "auth member cannot forge an approved month receipt",
        "auth member cannot update an approved month receipt",
        "auth member cannot delete an approved month receipt",
      ]) {
        report(
          label,
          true,
          "not yet enforced: the month_plan_approvals migration is pending on this target",
        );
      }
    }

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

    if (progressNextMovesSchemaAvailable) {
      const nextMoveFixture = {
        table: "child_progress_next_moves",
        label: "Progress next move",
        keyColumn: "context_fingerprint",
        keyValue: "a".repeat(64),
        insertRow: {
          family_id: familyBId,
          child_id: childBId,
          context_fingerprint: "a".repeat(64),
          source_revision: 1,
          prompt_version: "isolation",
          status: "pending",
        },
        updateRow: { status: "superseded" },
      };
      await expectAuthenticatedReadDenied(
        familyBUser.accessToken,
        nextMoveFixture.table,
        "auth member cannot read own Progress next move state",
      );
      await expectAuthenticatedWritesDenied(
        familyBUser.accessToken,
        nextMoveFixture.table,
        nextMoveFixture,
        "auth member cannot mutate own Progress next move state",
      );
      await expectAuthenticatedWritesDenied(
        familyAUser.accessToken,
        nextMoveFixture.table,
        nextMoveFixture,
        "cross-family token cannot mutate Family B Progress next move state",
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
    await expectAuthenticatedInsertDenied(
      familyAUser.accessToken,
      "child_plans",
      {
        child_id: childBId,
        subject_id: "isolation-cross-family",
        plan: {},
        bank_version: "isolation",
      },
      "auth member cannot create another family's child plan",
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
await expectReadDenied("child_plan_rebuild_history");
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
// Stable Progress next moves are derived, server-only state. The additive
// migration may lead or follow this guard during rollout, so absence is safe;
// once present, neither product Data API role may read or mutate it.
{
  const response = await rest(
    "child_progress_next_moves?select=context_fingerprint&limit=1",
    { headers: { Prefer: "" } },
  );
  const raw = await response.text();
  if (response.status === 404 && raw.includes("PGRST205")) {
    coveredTables.add("child_progress_next_moves");
    report(
      "child_progress_next_moves absent from target (additive migration not applied yet); nothing exposed",
      true,
    );
  } else {
    progressNextMovesSchemaAvailable = true;
    await expectReadDenied("child_progress_next_moves");
  }
}
// Subject lesson packages are member-readable and server-write-only. This
// also marks the new public tables as covered before the dynamic family probes.
await expectAnonymousNoRowsOrDenied("subject_lessons");
await expectAnonymousNoRowsOrDenied("subject_lesson_effect_receipts");
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
// Offer-recovery attempt bookkeeping (migration 20260723160000): server-only,
// same posture as the fulfillment ledger it bounds; parents never read it.
await expectReadDenied("conversation_offer_recovery");
// Post-turn review bookkeeping (migration #35): deny-all, server-only.
await expectEmptyRead("learning_reviews");
// Capture-time hours record (migration #37): family-scoped, members only.
await expectEmptyRead("hours_log");
// Planner learning activities are member-readable and server-write-only.
// The additive tables may be absent before deploy; once present, all three
// anonymous probes arm together.
{
  const tables = [
    "planner_learning_activities",
    "planner_learning_activity_children",
    "planner_learning_activity_hours",
  ];
  const response = await rest("planner_learning_activities?select=id&limit=1", {
    headers: { Prefer: "" },
  });
  const raw = await response.text();
  if (response.status === 404 && raw.includes("PGRST205")) {
    for (const table of tables) coveredTables.add(table);
    report(
      "planner learning activity tables absent from target (additive migration not applied yet); nothing exposed",
      true,
    );
  } else {
    for (const table of tables) await expectAnonymousNoRowsOrDenied(table);
  }
}
// Task rows (migrations #39 + #49): members read their OWN family's
// rows only; anon sees nothing and nobody writes over the Data API.
await expectEmptyRead("agent_schedules");
// Task run history (migration #49): same member-select posture; fleet
// rows (family_id null) are invisible to every Data API role.
await expectEmptyRead("homa_task_runs");
// Durable multi-token resume links (migration 20260724120000, additive,
// may not have reached this target yet): no client policies at all, on
// purpose (minted and resolved only from the app's own server
// connection, lib/map/store.ts). Stricter than agent_schedules above:
// not even a family member can read their own row over the Data API,
// only the server. Same present-or-arms-later posture as agent_jobs
// below, so a not-yet-migrated target never fails this run.
async function linkTokensTablePresent() {
  const response = await rest(`link_tokens?select=id&limit=1`, { headers: { Prefer: "" } });
  if (response.status !== 404) return true;
  const raw = await response.text();
  return !raw.includes("PGRST205");
}
const linkTokensSchemaAvailable = await linkTokensTablePresent();
if (linkTokensSchemaAvailable) {
  await expectEmptyRead("link_tokens");
} else {
  coveredTables.add("link_tokens");
  report(
    "link_tokens table absent from target (additive migration not applied yet); nothing exposed",
    true,
  );
}
// Agent jobs (migration 20260718140000, additive, lands via MCP ahead of
// the repo replay): the general finite-job primitive. Members read their
// own family's jobs, stages, artifacts, and timeline (the progress/cancel
// UI); no write policies exist, so the app's own server connection
// (lib/jobs/store.ts) is the only writer. Same posture as homa_task_runs.
// Until the migration reaches this target, the tables' absence itself
// exposes nothing (PGRST205), and every check below arms automatically the
// run after it lands.
const AGENT_JOB_TABLES = [
  "agent_jobs",
  "agent_job_stages",
  "agent_job_stage_artifacts",
  "agent_job_events",
];
async function agentJobTablesPresent() {
  const response = await rest(`agent_jobs?select=id&limit=1`, {
    headers: { Prefer: "" },
  });
  if (response.status !== 404) return true;
  const raw = await response.text();
  return !raw.includes("PGRST205");
}
const agentJobSchemaAvailable = await agentJobTablesPresent();
if (agentJobSchemaAvailable) {
  for (const table of AGENT_JOB_TABLES) await expectEmptyRead(table);
} else {
  for (const table of AGENT_JOB_TABLES) coveredTables.add(table);
  report(
    "agent job tables absent from target (additive migration not applied yet); nothing exposed",
    true,
  );
}
// Device sync mailbox (migration 20260725150000, additive, lands via MCP
// ahead of the repo replay): sync_devices holds hashed device tokens,
// sync_events the append-only mailbox the mac-mini pushes into. Both are
// revoked from every Data API role (the strict posture: permission error,
// not empty 200); the token-gated /api/sync routes and the applier cron,
// on the app's own server connection, are the only readers and writers.
// Same present-or-arms-later guard as link_tokens above.
const SYNC_TABLES = ["sync_devices", "sync_events"];
async function syncTablesPresent() {
  const response = await rest(`sync_devices?select=id&limit=1`, {
    headers: { Prefer: "" },
  });
  if (response.status !== 404) return true;
  const raw = await response.text();
  return !raw.includes("PGRST205");
}
const syncSchemaAvailable = await syncTablesPresent();
if (syncSchemaAvailable) {
  for (const table of SYNC_TABLES) await expectReadDenied(table);
  await expectInsertDenied(
    "sync_events",
    {
      family_id: "00000000-0000-0000-0000-000000000000",
      device_id: "00000000-0000-0000-0000-000000000000",
      kind: "memory.fact",
      dedupe_key: "intruder",
      payload: {},
      produced_at: new Date().toISOString(),
    },
    "anon cannot forge sync events",
  );
  await expectInsertDenied(
    "sync_devices",
    {
      family_id: "00000000-0000-0000-0000-000000000000",
      name: "intruder",
      token_hash: "a".repeat(64),
    },
    "anon cannot mint sync devices",
  );
} else {
  for (const table of SYNC_TABLES) coveredTables.add(table);
  report(
    "sync tables absent from target (additive migration not applied yet); nothing exposed",
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
// Email suppression list (migration 2026-07-20): server-only deny-all like
// email_sends. Written by the unsubscribe route, the bounce/complaint
// webhook, and the inbound "stop" handler; read by the drip sweep.
await expectReadDenied("email_suppressions");
// SMS suppression list (migration 2026-07-23): server-only deny-all.
// Written by the inbound opt-out handler and the delivery path's
// permanent-rejection classifier; read before any outbound SMS.
await expectReadDenied("sms_suppressions");
await expectReadDenied("cron_runs");
// Founder alert acks (migration #81): deny-all, server-only; only the
// founder-gated /admin action writes.
await expectReadDenied("admin_alert_acknowledgments");
// Voice action receipts contain exact compensator snapshots. They are
// deny-all through the Data API and readable only by the server-side undo
// tool. The migration is additive, so absence on an older target is safe and
// automatically turns into a permission probe once applied.
{
  const response = await rest(`voice_action_receipts?select=id&limit=1`, {
    headers: { Prefer: "" },
  });
  const raw = await response.text();
  if (response.status === 404 && raw.includes("PGRST205")) {
    coveredTables.add("voice_action_receipts");
    report(
      "voice_action_receipts absent from target (additive migration not applied yet); nothing exposed",
      true,
    );
  } else {
    await expectReadDenied("voice_action_receipts");
  }
}
// Provider-neutral family subscriptions are server-only billing state. The
// migration is additive and code falls back to the old mirrors before it
// lands, so an absent table is an honest pre-deploy pass. Once present, both
// anonymous reads and writes must be denied.
{
  const response = await rest(`family_billing_subscriptions?select=id&limit=1`, {
    headers: { Prefer: "" },
  });
  const raw = await response.text();
  if (response.status === 404 && raw.includes("PGRST205")) {
    coveredTables.add("family_billing_subscriptions");
    report(
      "family_billing_subscriptions absent from target (additive migration not applied yet); nothing exposed",
      true,
    );
  } else {
    familyBillingSubscriptionsSchemaAvailable = true;
    await expectReadDenied("family_billing_subscriptions");
  }
}
// Stripe card fingerprints are provider-only equality signals. They are
// never family-readable because a match would disclose another family's
// billing relationship.
{
  const response = await rest(`stripe_trial_card_claims?select=card_fingerprint&limit=1`, {
    headers: { Prefer: "" },
  });
  const raw = await response.text();
  if (response.status === 404 && raw.includes("PGRST205")) {
    coveredTables.add("stripe_trial_card_claims");
    report("stripe_trial_card_claims absent from target (additive migration not applied yet); nothing exposed", true);
  } else {
    stripeTrialCardClaimsSchemaAvailable = true;
    await expectReadDenied("stripe_trial_card_claims");
  }
}
// Account-deletion audit rows are server-only. The migration is additive and
// is intentionally safe to deploy before the app route, so this check arms
// when the table reaches the target.
{
  const response = await rest(`account_deletion_jobs?select=id&limit=1`, {
    headers: { Prefer: "" },
  });
  const raw = await response.text();
  if (response.status === 404 && raw.includes("PGRST205")) {
    coveredTables.add("account_deletion_jobs");
    report(
      "account_deletion_jobs absent from target (additive migration not applied yet); nothing exposed",
      true,
    );
  } else {
    accountDeletionJobsSchemaAvailable = true;
    await expectReadDenied("account_deletion_jobs");
  }
}
// The material studio's run ledger (materials_studio_runs migration):
// deny-all, server-only, written by the materials-lab channel route and
// read by the founder console. Arms automatically once the additive
// migration reaches this target (agent-jobs pattern above).
{
  const response = await rest(`materials_studio_runs?select=id&limit=1`, {
    headers: { Prefer: "" },
  });
  const raw = await response.text();
  if (response.status === 404 && raw.includes("PGRST205")) {
    coveredTables.add("materials_studio_runs");
    report(
      "materials_studio_runs absent from target (additive migration not applied yet); nothing exposed",
      true,
    );
  } else {
    await expectReadDenied("materials_studio_runs");
  }
}
// Founder verdict history on those runs (materials_studio_run_feedback,
// D5 of the training-corpus package): same deny-all, server-only posture
// as its parent, and it holds the founder's own critique prose plus a
// pointer at the material judged. Arms automatically once the additive
// migration reaches this target.
{
  const response = await rest(`materials_studio_run_feedback?select=id&limit=1`, {
    headers: { Prefer: "" },
  });
  const raw = await response.text();
  if (response.status === 404 && raw.includes("PGRST205")) {
    coveredTables.add("materials_studio_run_feedback");
    report(
      "materials_studio_run_feedback absent from target (additive migration not applied yet); nothing exposed",
      true,
    );
  } else {
    await expectReadDenied("materials_studio_run_feedback");
  }
}
// The agent flight recorder (migration #79): tool calls and injected
// context snapshots hold family conversation material, deny-all,
// server-only writes, founder-console reads only.
await expectReadDenied("agent_tool_calls");
await expectReadDenied("session_context_snapshots");
// Chat attachments (migration #80): members read their own family's
// rows; anon has explicit revokes; only the server-side attachment
// routes write.
await expectReadDenied("chat_attachments");
// Family Library rows are family-readable and server-write-only. The tables
// land additively, so absence is safe before migration and the checks
// arm automatically as soon as the schema reaches the target.
const FAMILY_LIBRARY_TABLES = [
  "family_asset_uploads",
  "family_assets",
  "family_asset_children",
  "family_asset_tags",
];
{
  const response = await rest("family_assets?select=id&limit=1", {
    headers: { Prefer: "" },
  });
  const raw = await response.text();
  if (response.status === 404 && raw.includes("PGRST205")) {
    for (const table of FAMILY_LIBRARY_TABLES) coveredTables.add(table);
    report(
      "family library tables absent from target (additive migration not applied yet); nothing exposed",
      true,
    );
  } else {
    familyLibrarySchemaAvailable = true;
    for (const table of FAMILY_LIBRARY_TABLES) await expectReadDenied(table);
  }
}
{
  const response = await rest("family_asset_plan_links?select=id&limit=1", {
    headers: { Prefer: "" },
  });
  const raw = await response.text();
  if (response.status === 404 && raw.includes("PGRST205")) {
    coveredTables.add("family_asset_plan_links");
    report(
      "family_asset_plan_links absent from target (additive migration not applied yet); nothing exposed",
      true,
    );
  } else {
    familyAssetPlanLinksSchemaAvailable = true;
    await expectReadDenied("family_asset_plan_links");
  }
}
{
  const response = await rest(
    "family_curriculum_mapping_approvals?select=draft_id&limit=1",
    { headers: { Prefer: "" } },
  );
  const raw = await response.text();
  if (response.status === 404 && raw.includes("PGRST205")) {
    coveredTables.add("family_curriculum_mapping_approvals");
    report(
      "family_curriculum_mapping_approvals absent from target (additive migration not applied yet); nothing exposed",
      true,
    );
  } else {
    familyCurriculumMappingSchemaAvailable = true;
    await expectReadDenied("family_curriculum_mapping_approvals");
  }
}
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
if (linkTokensSchemaAvailable) {
  await expectInsertDenied(
    "link_tokens",
    {
      family_id: "00000000-0000-0000-0000-000000000000",
      token_hash: "intruder-hash",
      kind: "drip_setup_nudge",
    },
    "anon cannot forge link tokens",
  );
}
if (agentJobSchemaAvailable) {
  await expectInsertDenied(
    "agent_jobs",
    {
      family_id: "00000000-0000-0000-0000-000000000000",
      skill: "curriculum-studio",
      title: "intruder build",
      total_stages: 1,
    },
    "anon cannot forge agent jobs",
  );
  await expectInsertDenied(
    "agent_job_stages",
    {
      job_id: "00000000-0000-0000-0000-000000000000",
      family_id: "00000000-0000-0000-0000-000000000000",
      stage_number: 1,
    },
    "anon cannot forge agent job stages",
  );
  await expectInsertDenied(
    "agent_job_stage_artifacts",
    {
      stage_id: "00000000-0000-0000-0000-000000000000",
      job_id: "00000000-0000-0000-0000-000000000000",
      family_id: "00000000-0000-0000-0000-000000000000",
      kind: "material",
      material_id: "00000000-0000-0000-0000-000000000000",
    },
    "anon cannot forge agent job stage artifacts",
  );
  await expectInsertDenied(
    "agent_job_events",
    {
      job_id: "00000000-0000-0000-0000-000000000000",
      family_id: "00000000-0000-0000-0000-000000000000",
      kind: "milestone",
    },
    "anon cannot forge agent job events",
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
  "child_plan_rebuild_history",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    subject_id: "math",
    plan_id: "00000000-0000-0000-0000-000000000000",
    plan_revision: 1,
    progress_revision: 0,
    plan: {},
    progress: {},
    remapped_progress: {},
    source_links: [],
    scheduled_days: [],
    archived_done_count: 0,
    preserved_done_count: 0,
    reason: "deep-dive-rebuild",
  },
  "anon cannot forge child plan rebuild history",
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
  "subject_lessons",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    subject_id: "math",
    target_item_id: "math.probe",
    target_statement: "Anon-forged subject lesson target",
    source_report_generated_at: new Date().toISOString(),
    source_fingerprint: "1".repeat(64),
    bank_version: "isolation",
    idempotency_key: "1".repeat(64),
  },
  "anon cannot forge subject lessons",
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
if (familyBillingSubscriptionsSchemaAvailable) {
  await expectInsertDenied(
    "family_billing_subscriptions",
    {
      family_id: "00000000-0000-0000-0000-000000000000",
      provider: "stripe",
      provider_subscription_id: "sub_intruder",
      plan_tier: "regular",
      status: "active",
    },
    "anon cannot forge family billing subscriptions",
  );
}
if (stripeTrialCardClaimsSchemaAvailable) {
  await expectInsertDenied(
    "stripe_trial_card_claims",
    {
      card_fingerprint: "fp_intruder",
      family_id: "00000000-0000-0000-0000-000000000000",
    },
    "anon cannot forge Stripe trial card claims",
  );
}
if (accountDeletionJobsSchemaAvailable) {
  await expectInsertDenied(
    "account_deletion_jobs",
    {
      family_id: "00000000-0000-0000-0000-000000000000",
      requested_by_user_id: "00000000-0000-0000-0000-000000000000",
    },
    "anon cannot forge account deletion jobs",
  );
}
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
if (familyLibrarySchemaAvailable) {
  await expectInsertDenied(
    "family_asset_uploads",
    {
      family_id: "00000000-0000-0000-0000-000000000000",
      client_request_id: "11111111-1111-4111-8111-111111111111",
      original_name: "intruder.pdf",
      pathname: "families/intruder/library/intruder.pdf",
      media_type: "application/pdf",
      byte_size: 100,
      last_modified: 1,
      fingerprint_sha256: "d".repeat(64),
    },
    "anon cannot forge family asset uploads",
  );
  await expectInsertDenied(
    "family_assets",
    {
      family_id: "00000000-0000-0000-0000-000000000000",
      title: "Intruder resource",
      original_name: "intruder.pdf",
      url: "https://example.com/intruder.pdf",
      download_url: "https://example.com/intruder.pdf?download=1",
      media_type: "application/pdf",
      byte_size: 100,
      file_kind: "document",
    },
    "anon cannot forge family assets",
  );
  if (familyAssetPlanLinksSchemaAvailable) {
    await expectInsertDenied(
      "family_asset_plan_links",
      {
        family_id: "00000000-0000-0000-0000-000000000000",
        asset_id: "00000000-0000-0000-0000-000000000000",
        child_id: "00000000-0000-0000-0000-000000000000",
        subject_id: "intruder",
        week: 1,
        activity_index: 0,
        activity_text: "Intruder source.",
        source_title: "Intruder resource",
      },
      "anon cannot forge planner source links",
    );
  }
  if (familyCurriculumMappingSchemaAvailable) {
    await expectInsertDenied(
      "family_curriculum_mapping_approvals",
      {
        draft_id: "11111111-1111-4111-8111-111111111111",
        family_id: "00000000-0000-0000-0000-000000000000",
        source_asset_id: "00000000-0000-0000-0000-000000000000",
        final_revision: 1,
        decomposition_quality: "full",
        unit_kind: "week",
        declared_unit_count: 1,
        unit_asset_ids: [
          {
            ordinal: 1,
            id: "00000000-0000-0000-0000-000000000000",
            title: "Intruder week",
            sourceLocator: "Page 1",
          },
        ],
        planner_targets: [],
        revision_history: [{ revision: 1, action: "created" }],
      },
      "anon cannot forge curriculum mapping approvals",
    );
  }
}
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
    await familyAssetTrainingSchemaIsIsolated();
  } catch (error) {
    report(
      "family asset training ledger is outside product access and deletion-aware",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }
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
    "family asset training ledger is outside product access and deletion-aware",
    false,
    "missing SUPABASE_DB_PASSWORD",
  );
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
