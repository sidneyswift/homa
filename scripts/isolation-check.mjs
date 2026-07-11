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
const fixtureUserIds = [];

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

async function expectInsertDenied(table, row, label) {
  coveredTables.add(table);
  const response = await rest(table, { method: "POST", body: JSON.stringify(row) });
  const ok = response.status === 401 || response.status === 403;
  report(label, ok, `HTTP ${response.status}`);
}

async function insertChildProgressFixtures(childId, memberUserId) {
  const [evidenceA] = await sql`
    insert into public.child_progress_evidence (
      child_id,
      item_id,
      answer,
      source,
      member_user_id,
      quote,
      idempotency_key
    )
    values (
      ${childId},
      'isolation.progress.item',
      'easily',
      'checklist',
      ${memberUserId},
      'Isolation evidence A.',
      'isolation:evidence:a'
    )
    returning id
  `;
  const [evidenceB] = await sql`
    insert into public.child_progress_evidence (
      child_id,
      item_id,
      answer,
      source,
      member_user_id,
      quote,
      idempotency_key
    )
    values (
      ${childId},
      'isolation.progress.item',
      'not_yet',
      'checklist',
      ${memberUserId},
      'Isolation evidence B.',
      'isolation:evidence:b'
    )
    returning id
  `;
  const [live] = await sql`
    insert into public.child_progress_live (
      child_id,
      projection,
      scores,
      bank_version,
      evidence_count,
      open_conflict_count
    )
    values (${childId}, '{}'::jsonb, '{}'::jsonb, 'isolation-bank', 2, 1)
    returning child_id
  `;
  const [checkIn] = await sql`
    insert into public.progress_check_ins (
      child_id,
      purpose,
      scope,
      state,
      active_member_user_id,
      prompt_recipient_member_user_id,
      revision,
      current_item_id
    )
    values (
      ${childId},
      'whole_map_refresh',
      '{}'::jsonb,
      'active',
      ${memberUserId},
      ${memberUserId},
      1,
      'isolation.progress.item'
    )
    returning id
  `;
  const [response] = await sql`
    insert into public.progress_check_in_responses (
      check_in_id,
      revision,
      item_id,
      answer,
      member_user_id,
      is_evidence,
      evidence_id,
      idempotency_key
    )
    values (
      ${checkIn.id},
      1,
      'isolation.progress.item',
      'easily',
      ${memberUserId},
      true,
      ${evidenceA.id},
      'isolation:response:1'
    )
    returning id
  `;
  const [conflict] = await sql`
    insert into public.child_progress_conflicts (
      child_id,
      item_id,
      evidence_id_a,
      evidence_id_b,
      member_user_id_a,
      member_user_id_b
    )
    values (
      ${childId},
      'isolation.progress.item',
      ${evidenceA.id},
      ${evidenceB.id},
      ${memberUserId},
      ${memberUserId}
    )
    returning id
  `;
  const [snapshot] = await sql`
    insert into public.child_progress_snapshots (
      child_id,
      trigger,
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

  return {
    childId: live.child_id,
    checkInId: checkIn.id,
    conflictId: conflict.id,
    evidenceId: evidenceA.id,
    evidenceIdB: evidenceB.id,
    responseId: response.id,
    snapshotId: snapshot.id,
  };
}

async function cleanupIsolationFixtures() {
  if (!sql) return;
  try {
    if (fixtureFamilyIds.length > 0) {
      await sql`delete from public.families where id in ${sql(fixtureFamilyIds)}`;
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
    const familyAId = await createFixtureFamily(familyAUser, "A");
    const familyBId = await createFixtureFamily(familyBUser, "B");

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

    const childBId = await insertFixtureRow(
      familyBUser,
      "children",
      { family_id: familyBId, name: "Isolation B child", birth_month: "2020-01-01" },
      "create Family B child fixture",
    );
    const childProgressFixtures = await insertChildProgressFixtures(
      childBId,
      familyBUser.userId,
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

    const childProgressRows = [
      {
        table: "child_progress_evidence",
        keyColumn: "id",
        keyValue: childProgressFixtures.evidenceId,
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

    await expectAuthenticatedWritesDenied(
      familyBUser.accessToken,
      "child_progress_evidence",
      {
        keyColumn: "id",
        keyValue: childProgressFixtures.evidenceId,
        insertRow: {
          child_id: childBId,
          item_id: "isolation.progress.client-forge",
          answer: "easily",
          source: "checklist",
          idempotency_key: "isolation:evidence:client-forge",
        },
        updateRow: { quote: "Authenticated clients cannot alter evidence." },
      },
      "auth member cannot mutate own child progress evidence",
    );
    await expectAuthenticatedWritesDenied(
      familyBUser.accessToken,
      "child_progress_live",
      {
        keyColumn: "child_id",
        keyValue: childProgressFixtures.childId,
        insertRow: {
          child_id: childBId,
          projection: {},
          scores: {},
          bank_version: "client-forge",
        },
        updateRow: { evidence_count: 99 },
      },
      "auth member cannot mutate own live child progress",
    );
    await expectAuthenticatedWritesDenied(
      familyBUser.accessToken,
      "progress_check_ins",
      {
        keyColumn: "id",
        keyValue: childProgressFixtures.checkInId,
        insertRow: {
          child_id: childBId,
          purpose: "age_refresh",
          scope: {},
          state: "completed",
        },
        updateRow: { state: "stopped" },
      },
      "auth member cannot mutate own progress check-in",
    );
    await expectAuthenticatedWritesDenied(
      familyBUser.accessToken,
      "progress_check_in_responses",
      {
        keyColumn: "id",
        keyValue: childProgressFixtures.responseId,
        insertRow: {
          check_in_id: childProgressFixtures.checkInId,
          revision: 2,
          item_id: "isolation.progress.item",
          answer: "skip",
          is_evidence: false,
          idempotency_key: "isolation:response:client-forge",
        },
        updateRow: { answer: "getting_there" },
      },
      "auth member cannot mutate own check-in response",
    );
    await expectAuthenticatedWritesDenied(
      familyBUser.accessToken,
      "child_progress_conflicts",
      {
        keyColumn: "id",
        keyValue: childProgressFixtures.conflictId,
        insertRow: {
          child_id: childBId,
          item_id: "isolation.progress.client-forge",
          evidence_id_a: childProgressFixtures.evidenceId,
          evidence_id_b: childProgressFixtures.evidenceIdB,
        },
        updateRow: { state: "resolved" },
      },
      "auth member cannot mutate own child progress conflict",
    );
    await expectAuthenticatedWritesDenied(
      familyBUser.accessToken,
      "child_progress_snapshots",
      {
        keyColumn: "id",
        keyValue: childProgressFixtures.snapshotId,
        insertRow: {
          child_id: childBId,
          trigger: "legacy",
          age_months: 72,
          bank_version: "client-forge",
          scorer_version: "client-forge",
          projection: {},
          scores: {},
        },
        updateRow: { scorer_version: "client-forge" },
      },
      "auth member cannot mutate own child progress snapshot",
    );

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
// Anon sees empty sets, while server-side SQL owns every mutation.
for (const table of [
  "child_progress_evidence",
  "child_progress_live",
  "progress_check_ins",
  "progress_check_in_responses",
  "child_progress_conflicts",
  "child_progress_snapshots",
]) {
  await expectEmptyRead(table);
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
// The fleet research corpus (migration #50): deny-all; only the gate
// (lib/knowledge/gate.ts) writes, only server code reads.
await expectReadDenied("knowledge_bank");
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
    item_id: "math.probe",
    answer: "easily",
    source: "checklist",
    idempotency_key: "isolation:anon:evidence",
  },
  "anon cannot forge child progress evidence",
);
await expectInsertDenied(
  "child_progress_live",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    projection: {},
    scores: {},
    bank_version: "isolation",
  },
  "anon cannot forge live child progress",
);
await expectInsertDenied(
  "progress_check_ins",
  {
    child_id: "00000000-0000-0000-0000-000000000000",
    purpose: "whole_map_refresh",
    scope: {},
  },
  "anon cannot forge progress check-ins",
);
await expectInsertDenied(
  "progress_check_in_responses",
  {
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
    trigger: "legacy",
    age_months: 0,
    bank_version: "isolation",
    scorer_version: "isolation",
    projection: {},
    scores: {},
  },
  "anon cannot forge child progress snapshots",
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

await expectAuthenticatedIsolation();
expectEveryPublicTableCovered();
if (sql) await sql.end({ timeout: 5 });

if (failures.length > 0) {
  console.error(`\n${failures.length} isolation check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll isolation checks passed.");
