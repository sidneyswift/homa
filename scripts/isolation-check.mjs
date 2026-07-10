#!/usr/bin/env node
/**
 * Isolation smoke check (seed of the M1-07 adversarial suite).
 * Verifies, using only the PUBLIC key, that the database enforces:
 *   1. waitlist and events are write-only (reads return nothing)
 *   2. tenancy tables are invisible and unwritable to anonymous traffic
 *   3. the events namespace and waitlist status cannot be abused on insert
 *
 * Usage: node scripts/isolation-check.mjs
 * Env: reads apps/web/.env.local (NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY).
 * Exit code 0 = all checks passed.
 */

import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Fine in CI, where the vars arrive via the environment.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(2);
}

const failures = [];

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

async function expectEmptyRead(table) {
  const response = await rest(`${table}?select=*&limit=5`, { headers: { Prefer: "" } });
  const body = response.ok ? await response.json() : [];
  const ok = !response.ok || (Array.isArray(body) && body.length === 0);
  report(`anon read of ${table} exposes nothing`, ok, `HTTP ${response.status}, ${JSON.stringify(body).slice(0, 100)}`);
}

async function expectInsertDenied(table, row, label) {
  const response = await rest(table, { method: "POST", body: JSON.stringify(row) });
  const ok = response.status === 401 || response.status === 403;
  report(label, ok, `HTTP ${response.status}`);
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
await expectEmptyRead("family_phones");
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
await expectEmptyRead("conversation_messages");
// Post-turn review bookkeeping (migration #35): deny-all, server-only.
await expectEmptyRead("learning_reviews");
// Capture-time hours record (migration #37): family-scoped, members only.
await expectEmptyRead("hours_log");
// Dispatcher schedule rows (migration #39): deny-all, server-only.
await expectEmptyRead("agent_schedules");
// Phone-first leads (migration #41): deny-all, server-only.
await expectEmptyRead("phone_leads");
// Phone-link confirmations (migration #46): deny-all, server-only.
await expectEmptyRead("phone_link_requests");
// Verified phone claim codes (migration #47): deny-all, server-only.
await expectEmptyRead("phone_claim_codes");
// Materials studio artifacts (migrations #42 + #44): family-scoped,
// members only.
await expectEmptyRead("materials");
// Per-family AI consumption ledger (migration #43): deny-all, server-only.
await expectEmptyRead("model_usage");

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
    domain_id: "math",
    plan: {},
    bank_version: "x",
    retest_at: "2026-01-01T00:00:00Z",
  },
  "anon cannot forge child_plans",
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
  { child_id: "00000000-0000-0000-0000-000000000000", domain_id: "math", plan: {}, bank_version: "x" },
  "anon cannot forge product child plans",
);

if (failures.length > 0) {
  console.error(`\n${failures.length} isolation check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll isolation checks passed.");
