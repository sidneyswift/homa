/**
 * E2E tests for the self-improving system (Layers 1-5).
 * Uses real database with synthetic test data and cascade cleanup.
 *
 * Usage: pnpm tsx scripts/self-improving-e2e.mts -- --base http://localhost:3222 [--keep]
 * Env: apps/web/.env.local (SUPABASE_DB_PASSWORD).
 */

import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Fine when env arrives from the shell.
}

const { mapDb } = await import("../apps/web/lib/map/db");

const KEEP = process.argv.includes("--keep");

const sql = mapDb();
const failures: string[] = [];
function report(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failures.push(label);
}

// Create a synthetic test family for isolation
const TEST_FAMILY_ID = "00000000-0000-0000-0000-e2e000000001";
const TEST_SESSION_ID = "e2e-self-improving-test-session";

async function setup(): Promise<void> {
  // Ensure a test family exists (upsert pattern)
  await sql`
    insert into public.families (id, name, time_zone, sandbox)
    values (${TEST_FAMILY_ID}::uuid, 'E2E Self-Improving Test', 'America/New_York', true)
    on conflict (id) do update
    set sandbox = true, updated_at = now()
  `;
}

async function cleanup(): Promise<void> {
  if (KEEP) {
    console.log("--keep: skipping cleanup");
    return;
  }

  // Cascade cleanup in reverse dependency order
  await sql`delete from public.fix_effectiveness where fix_id in (
    select id from public.eval_results where signal_id in (
      select id from public.conversation_signals where family_id = ${TEST_FAMILY_ID}::uuid
    )
  )`;
  await sql`delete from public.eval_results where signal_id in (
    select id from public.conversation_signals where family_id = ${TEST_FAMILY_ID}::uuid
  )`;
  await sql`delete from public.skill_evolution_log where pattern_id in (
    select id from public.signal_patterns where signal_type like 'e2e_%'
  )`;
  await sql`delete from public.signal_patterns where signal_type like 'e2e_%'`;
  await sql`delete from public.response_engagement where family_id = ${TEST_FAMILY_ID}::uuid`;
  await sql`delete from public.conversation_signals where family_id = ${TEST_FAMILY_ID}::uuid`;
  await sql`delete from public.knowledge_gaps where family_id = ${TEST_FAMILY_ID}::uuid`;
  await sql`delete from public.knowledge_gaps where topic like 'e2e_%'`;
  await sql`delete from public.policy_proposals where policy_key like 'e2e_%'`;
  await sql`delete from public.system_policies where key like 'e2e_%'`;
  await sql`delete from public.families where id = ${TEST_FAMILY_ID}::uuid`;
}

// --- Test 1: Signal Classification ---
async function testSignalClassification(): Promise<void> {
  console.log("\n--- Test 1: Signal Classification ---");

  // Insert signals directly (testing store, not the LLM classifier)
  await sql`
    insert into public.conversation_signals
      (family_id, session_id, signal_type, confidence, evidence)
    values
      (${TEST_FAMILY_ID}::uuid, ${TEST_SESSION_ID}, 'bug', 0.9, 'User said: the page won''t load'),
      (${TEST_FAMILY_ID}::uuid, ${TEST_SESSION_ID}, 'delight', 0.8, 'User said: this is amazing!'),
      (${TEST_FAMILY_ID}::uuid, ${TEST_SESSION_ID}, 'confusion', 0.7, 'User said: I don''t understand this')
  `;

  // Verify signals were written
  const signals = await sql<{ cnt: number }[]>`
    select count(*)::int as cnt
    from public.conversation_signals
    where family_id = ${TEST_FAMILY_ID}::uuid
      and session_id = ${TEST_SESSION_ID}
  `;

  report("Signals written to DB", signals[0]!.cnt === 3, `got ${signals[0]!.cnt}`);

  // Verify query by type
  const bugs = await sql<{ cnt: number }[]>`
    select count(*)::int as cnt
    from public.conversation_signals
    where family_id = ${TEST_FAMILY_ID}::uuid
      and signal_type = 'bug'
  `;

  report("Query signals by type", bugs[0]!.cnt >= 1, `got ${bugs[0]!.cnt}`);
}

// --- Test 2: Pattern Detection ---
async function testPatternDetection(): Promise<void> {
  console.log("\n--- Test 2: Pattern Detection ---");

  // Insert enough signals to form a pattern (3+ occurrences)
  for (let i = 0; i < 4; i++) {
    await sql`
      insert into public.conversation_signals
        (family_id, session_id, signal_type, confidence, evidence)
      values
        (${TEST_FAMILY_ID}::uuid, ${`e2e-session-${i}`}, 'e2e_confusion', 0.8, ${`Evidence sample ${i}`})
    `;
  }

  // Check pattern aggregation
  const patterns = await sql<
    { signal_type: string; cnt: number; fam_cnt: number }[]
  >`
    select
      signal_type,
      count(*)::int as cnt,
      count(distinct family_id)::int as fam_cnt
    from public.conversation_signals
    where signal_type = 'e2e_confusion'
      and created_at >= now() - interval '7 days'
    group by signal_type
    having count(*) >= 3
  `;

  report(
    "Pattern detected (3+ occurrences)",
    patterns.length > 0 && patterns[0]!.cnt >= 4,
    `got ${patterns[0]?.cnt ?? 0}`,
  );

  // Insert a pattern row
  await sql`
    insert into public.signal_patterns
      (signal_type, pattern_description, family_count, occurrence_count, sample_evidence, status)
    values
      ('e2e_confusion', 'Test pattern', 1, 4, '["evidence1","evidence2"]'::jsonb, 'detected')
  `;

  const active = await sql<{ cnt: number }[]>`
    select count(*)::int as cnt
    from public.signal_patterns
    where signal_type = 'e2e_confusion'
      and status = 'detected'
  `;

  report("Active pattern stored", active[0]!.cnt >= 1);
}

// --- Test 3: Knowledge Gap ---
async function testKnowledgeGap(): Promise<void> {
  console.log("\n--- Test 3: Knowledge Gap ---");

  // Log a gap
  await sql`
    insert into public.knowledge_gaps
      (topic, query_text, family_id, source, status)
    values
      ('e2e_phonics_blends', 'phonics blends for 5 year old', ${TEST_FAMILY_ID}::uuid, 'recall_miss', 'open')
  `;

  // Verify gap exists
  const gaps = await sql<{ cnt: number }[]>`
    select count(*)::int as cnt
    from public.knowledge_gaps
    where topic = 'e2e_phonics_blends'
      and status = 'open'
  `;

  report("Knowledge gap logged", gaps[0]!.cnt >= 1);

  // Simulate filling the gap
  const [gap] = await sql<{ id: string }[]>`
    select id::text from public.knowledge_gaps
    where topic = 'e2e_phonics_blends' limit 1
  `;

  // Use a dummy knowledge_id (we just need a uuid)
  const fakeKnowledgeId = "00000000-0000-0000-0000-e2e000000099";
  await sql`
    update public.knowledge_gaps
    set status = 'filled',
        filled_by_knowledge_id = ${fakeKnowledgeId}::uuid,
        filled_at = now()
    where id = ${gap!.id}::uuid
  `;

  const filled = await sql<{ status: string }[]>`
    select status from public.knowledge_gaps where id = ${gap!.id}::uuid
  `;

  report("Knowledge gap marked filled", filled[0]?.status === "filled");
}

// --- Test 4: Policy Proposal ---
async function testPolicyProposal(): Promise<void> {
  console.log("\n--- Test 4: Policy Proposal ---");

  // Create a proposal
  await sql`
    insert into public.policy_proposals
      (policy_key, proposed_by, rationale, proposed_value, evidence, status)
    values
      ('e2e_test_policy', 'night_manager', 'Test rationale', 'new value', '{"test": true}'::jsonb, 'pending')
  `;

  // Verify pending
  const pending = await sql<{ cnt: number }[]>`
    select count(*)::int as cnt
    from public.policy_proposals
    where policy_key = 'e2e_test_policy'
      and status = 'pending'
  `;

  report("Policy proposal created", pending[0]!.cnt >= 1);

  // Approve it
  const [proposal] = await sql<{ id: string }[]>`
    select id::text from public.policy_proposals
    where policy_key = 'e2e_test_policy' limit 1
  `;

  await sql`
    update public.policy_proposals
    set status = 'approved', reviewed_at = now()
    where id = ${proposal!.id}::uuid
  `;

  // Apply: upsert the policy
  await sql`
    insert into public.system_policies (key, title, body_md, autonomy_level, updated_at)
    values ('e2e_test_policy', 'E2E Test', 'new value', 'observe', now())
    on conflict (key) do update set body_md = 'new value', updated_at = now()
  `;

  await sql`
    update public.policy_proposals
    set status = 'applied'
    where id = ${proposal!.id}::uuid
  `;

  const policy = await sql<{ body_md: string }[]>`
    select body_md from public.system_policies where key = 'e2e_test_policy'
  `;

  report("Policy applied after approval", policy[0]?.body_md === "new value");
}

// --- Test 5: Quality Loop ---
async function testQualityLoop(): Promise<void> {
  console.log("\n--- Test 5: Quality Loop ---");

  // Create a signal to fix
  const [signal] = await sql<{ id: string }[]>`
    insert into public.conversation_signals
      (family_id, session_id, signal_type, confidence, evidence)
    values
      (${TEST_FAMILY_ID}::uuid, 'e2e-qual', 'bug', 0.9, 'Quality loop test bug')
    returning id::text
  `;

  // Create an eval for the fix
  const [evalRow] = await sql<{ id: string }[]>`
    insert into public.eval_results
      (signal_id, fix_description, fix_commit, eval_type)
    values
      (${signal!.id}::uuid, 'Fixed the bug', 'abc123', 'signal_resolved')
    returning id::text
  `;

  report("Eval created for fix", !!evalRow?.id);

  // Create effectiveness tracking
  await sql`
    insert into public.fix_effectiveness
      (fix_id, signal_type, recurrence_count, days_monitored, effectiveness_score, last_checked_at)
    values
      (${evalRow!.id}::uuid, 'bug', 0, 3, 1.0, now())
  `;

  const eff = await sql<{ effectiveness_score: number }[]>`
    select effectiveness_score
    from public.fix_effectiveness
    where fix_id = ${evalRow!.id}::uuid
  `;

  report("Fix effectiveness tracked", eff[0]?.effectiveness_score === 1.0);
}

// --- Test 6: Full Loop (Signal -> Pattern -> Skill Evolution) ---
async function testFullLoop(): Promise<void> {
  console.log("\n--- Test 6: Full Loop ---");

  // Signal already exists from test 2 (e2e_confusion pattern)
  // Get the pattern
  const [pattern] = await sql<{ id: string }[]>`
    select id::text from public.signal_patterns
    where signal_type = 'e2e_confusion' limit 1
  `;

  if (!pattern) {
    report("Full loop: pattern exists", false, "no pattern found");
    return;
  }

  // Log skill evolution
  await sql`
    insert into public.skill_evolution_log
      (pattern_id, skill_name, change_type, diff_summary, status)
    values
      (${pattern.id}::uuid, 'confusion-handler', 'create', 'Created new skill from pattern', 'drafted')
  `;

  // Verify evolution logged
  const evo = await sql<{ cnt: number }[]>`
    select count(*)::int as cnt
    from public.skill_evolution_log
    where pattern_id = ${pattern.id}::uuid
  `;

  report("Skill evolution logged", evo[0]!.cnt >= 1);

  // Update pattern status
  await sql`
    update public.signal_patterns
    set status = 'skill_drafted'
    where id = ${pattern.id}::uuid
  `;

  const updated = await sql<{ status: string }[]>`
    select status from public.signal_patterns where id = ${pattern.id}::uuid
  `;

  report("Pattern status updated to skill_drafted", updated[0]?.status === "skill_drafted");
}

// --- Test 7: Engagement Tracking ---
async function testEngagement(): Promise<void> {
  console.log("\n--- Test 7: Engagement Tracking ---");

  // Record engagement signals
  await sql`
    insert into public.response_engagement
      (family_id, session_id, engagement_type, indicator)
    values
      (${TEST_FAMILY_ID}::uuid, ${TEST_SESSION_ID}, 'positive', 'parent said thanks'),
      (${TEST_FAMILY_ID}::uuid, ${TEST_SESSION_ID}, 'positive', 'parent asked follow-up'),
      (${TEST_FAMILY_ID}::uuid, ${TEST_SESSION_ID}, 'negative', 'parent said never mind')
  `;

  // Verify engagement report
  const report_ = await sql<
    { engagement_type: string; cnt: number }[]
  >`
    select engagement_type, count(*)::int as cnt
    from public.response_engagement
    where family_id = ${TEST_FAMILY_ID}::uuid
    group by engagement_type
  `;

  const positive = report_.find((r) => r.engagement_type === "positive");
  const negative = report_.find((r) => r.engagement_type === "negative");

  report("Engagement: positive signals recorded", positive?.cnt === 2, `got ${positive?.cnt}`);
  report("Engagement: negative signals recorded", negative?.cnt === 1, `got ${negative?.cnt}`);
}

// --- Main ---
async function main(): Promise<void> {
  console.log("Self-Improving System E2E Tests\n");

  try {
    await sql`select 1 as live_fixture_database_ready`;
    await setup();

    await testSignalClassification();
    await testPatternDetection();
    await testKnowledgeGap();
    await testPolicyProposal();
    await testQualityLoop();
    await testFullLoop();
    await testEngagement();
  } finally {
    await cleanup();
    await sql.end();
  }

  console.log(`\n${"=".repeat(40)}`);
  if (failures.length === 0) {
    console.log(`ALL TESTS PASSED`);
  } else {
    console.log(`${failures.length} FAILED: ${failures.join(", ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("E2E crashed:", err);
  process.exit(1);
});
