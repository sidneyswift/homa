import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const liveFixtureScripts = [
  {
    path: "scripts/isolation-check.mjs",
    signupAnchor: "const familyAUser = await signUpFixtureUser",
  },
  {
    path: "scripts/conversation-continuity-e2e.mts",
    signupAnchor: 'const sidney = await signUp("sidney", suffix)',
  },
  {
    path: "scripts/conversation-continuity-agent-e2e.mts",
    signupAnchor: 'const auth = await authRequest("signup"',
  },
  {
    path: "scripts/parented-session-continuity-e2e.mts",
    signupAnchor: 'const auth = await authRequest("signup"',
  },
];

const directFamilyFixtureScripts = [
  "scripts/conversation-continuity-e2e.mts",
  "scripts/recall-eval.mts",
  "scripts/tasks-e2e.mts",
  "scripts/self-improving-e2e.mts",
  "scripts/device-sync-e2e.mts",
];

for (const fixture of liveFixtureScripts) {
  test(`${fixture.path} verifies cleanup access before signup`, () => {
    const source = readFileSync(path.join(repoRoot, fixture.path), "utf8");
    const preflightIndex = source.indexOf("select 1 as live_fixture_database_ready");
    const signupIndex = source.indexOf(fixture.signupAnchor);

    assert.notEqual(preflightIndex, -1, "missing database preflight");
    assert.notEqual(signupIndex, -1, "missing signup anchor");
    assert.ok(
      preflightIndex < signupIndex,
      "database preflight must happen before creating the Auth user",
    );
  });

  test(`${fixture.path} marks its family as sandbox`, () => {
    const source = readFileSync(path.join(repoRoot, fixture.path), "utf8");
    assert.match(source, /set\s+sandbox\s*=\s*true/s);
  });
}

for (const fixturePath of directFamilyFixtureScripts) {
  test(`${fixturePath} creates only sandbox families`, () => {
    const source = readFileSync(path.join(repoRoot, fixturePath), "utf8");
    const familyInserts = source.match(/insert\s+into\s+public\.families[\s\S]*?returning\s+id/giu) ?? [];

    assert.ok(familyInserts.length > 0, "missing family fixture insert");
    for (const insert of familyInserts) {
      assert.match(insert, /sandbox/iu);
      assert.match(insert, /true/iu);
    }
  });
}

test("device sync cannot fall back to the live project", () => {
  const source = readFileSync(
    path.join(repoRoot, "scripts/device-sync-e2e.mts"),
    "utf8",
  );
  const guardIndex = source.indexOf("if (!process.env.HOMA_EVAL_DATABASE_URL)");
  const databaseIndex = source.indexOf("const { mapDb }");

  assert.notEqual(guardIndex, -1, "missing disposable database guard");
  assert.ok(guardIndex < databaseIndex, "guard must run before mapDb loads");
});

test("reused fixed fixtures refresh their retirement clock", () => {
  const source = readFileSync(
    path.join(repoRoot, "scripts/self-improving-e2e.mts"),
    "utf8",
  );
  assert.match(
    source,
    /on conflict \(id\) do update[\s\S]*updated_at = now\(\)/u,
  );
});

test("production family-history seeding verifies an existing test family", () => {
  const source = readFileSync(
    path.join(repoRoot, "scripts/seed-family-history.mts"),
    "utf8",
  );
  assert.match(source, /if \(!sandboxUrl && args\.familyId\)/u);
  assert.match(source, /!family\?\.sandbox/u);
  assert.match(source, /\\\+homatest/u);
});

test("authenticated fixture families are sandboxed atomically", () => {
  const source = readFileSync(
    path.join(
      repoRoot,
      "supabase/migrations/20260806034000_sandbox_live_auth_fixtures.sql",
    ),
    "utf8",
  );

  for (const marker of [
    "+homatest",
    "isolation-%@example.com",
    "continuity-%@example.com",
    "parented-session-%@example.com",
  ]) {
    assert.ok(source.includes(marker), `missing reserved marker ${marker}`);
  }
  assert.match(source, /insert into public\.families[\s\S]*sandbox/iu);
});

test("developer test families are sandboxed in their first insert", () => {
  const store = readFileSync(
    path.join(repoRoot, "apps/web/lib/map/store.ts"),
    "utf8",
  );
  const route = readFileSync(
    path.join(repoRoot, "apps/web/app/api/dev/test-session/route.ts"),
    "utf8",
  );
  const reset = readFileSync(
    path.join(repoRoot, "apps/web/lib/onboarding/dev-reset.ts"),
    "utf8",
  );

  assert.match(
    store,
    /insert into public\.families[\s\S]*resume_token_hash, sandbox[\s\S]*input\.sandbox === true/iu,
  );
  assert.match(
    route,
    /startAnonymousFamily\(\{[\s\S]*?sandbox: true,[\s\S]*?\}\)/u,
  );
  assert.match(
    reset,
    /startAnonymousFamily\(\{[\s\S]*?sandbox: true,[\s\S]*?\}\)/u,
  );
});

test("CI executes the authenticated family sandbox behavior test", () => {
  const workflow = readFileSync(
    path.join(repoRoot, ".github/workflows/ci.yml"),
    "utf8",
  );
  assert.match(workflow, /pnpm test:live-fixture-sandbox:postgres/u);
});

test("the live fixture sandbox contract retires its families through the guarded status transition", () => {
  const source = readFileSync(
    path.join(repoRoot, "scripts/live-fixture-sandbox-e2e.mts"),
    "utf8",
  );
  const cleanupStart = source.indexOf("} finally {");
  const modeIndex = source.indexOf("select set_config(", cleanupStart);
  const statusIndex = source.indexOf("set status = 'deleted'", cleanupStart);

  assert.notEqual(modeIndex, -1, "lacks a guarded retirement mode");
  assert.notEqual(statusIndex, -1, "lacks its soft retirement");
  assert.ok(modeIndex < statusIndex, "authorizes retirement after changing family status");
  assert.match(
    source.slice(modeIndex, statusIndex),
    /'homa\.family_delete_mode',\s*'account-deletion-v2',\s*true/u,
  );
  assert.match(source.slice(statusIndex), /and sandbox/u);
  assert.doesNotMatch(source, /delete from public\.families/u);
});

test("isolation cleanup separates soft retirement from its cascade probe", () => {
  const source = readFileSync(
    path.join(repoRoot, "scripts/isolation-check.mjs"),
    "utf8",
  );
  const cleanupStart = source.indexOf("async function cleanupIsolationFixtures");
  const cascadeStart = source.indexOf("async function expectEventsFamilyDeleteCascade");
  const authenticatedStart = source.indexOf("async function expectAuthenticatedIsolation");
  const cleanup = source.slice(cleanupStart, cascadeStart);
  const cascade = source.slice(cascadeStart, authenticatedStart);

  assert.match(cleanup, /select set_config\(/u);
  assert.match(cleanup, /set status = 'deleted'/u);
  assert.match(cleanup, /and sandbox/u);
  assert.doesNotMatch(cleanup, /delete from public\.families/u);

  const schemaProbe = cascade.indexOf("families_hard_delete_protocol_guard");
  const jobInsert = cascade.indexOf("insert into public.account_deletion_jobs");
  const mode = cascade.indexOf("'account-deletion-v2'");
  const status = cascade.indexOf("set status = 'deleted'");
  const hardDelete = cascade.indexOf("delete from public.families");
  assert.ok(schemaProbe >= 0);
  assert.ok(schemaProbe < jobInsert);
  assert.ok(jobInsert < mode);
  assert.ok(mode < status);
  assert.ok(status < hardDelete);
  assert.match(cascade, /delete from public\.account_deletion_artifact_tombstones/u);
  assert.match(cascade, /delete from public\.account_deletion_jobs/u);
});

test("conversation privacy cleanup uses the guarded account-deletion protocol", () => {
  const source = readFileSync(
    path.join(repoRoot, "scripts/conversation-privacy-e2e.mts"),
    "utf8",
  );
  const cleanupStart = source.indexOf("} finally {");
  const cleanup = source.slice(cleanupStart);
  const jobInsert = cleanup.indexOf("insert into public.account_deletion_jobs");
  const mode = cleanup.indexOf("'account-deletion-v2'");
  const status = cleanup.indexOf("set status = 'deleted'");
  const hardDelete = cleanup.indexOf("delete from public.families");

  assert.ok(jobInsert >= 0);
  assert.ok(jobInsert < mode);
  assert.ok(mode < status);
  assert.ok(status < hardDelete);
});

test("isolation cleanup removes knowledge references before fixture knowledge", () => {
  const source = readFileSync(
    path.join(repoRoot, "scripts/isolation-check.mjs"),
    "utf8",
  );
  const cleanupStart = source.indexOf("async function cleanupIsolationFixtures");
  const cascadeStart = source.indexOf("async function expectEventsFamilyDeleteCascade");
  const cleanup = source.slice(cleanupStart, cascadeStart);
  const preparations = cleanup.indexOf("delete from public.research_brief_preparations");
  const uses = cleanup.indexOf("delete from public.family_knowledge_use");
  const knowledge = cleanup.indexOf("delete from public.knowledge_bank");

  assert.ok(preparations >= 0);
  assert.ok(preparations < uses);
  assert.ok(uses < knowledge);
});

test("required isolation checks never perform historical fixture cleanup", () => {
  const source = readFileSync(
    path.join(repoRoot, "scripts/isolation-check.mjs"),
    "utf8",
  );
  assert.doesNotMatch(source, /cleanupAbandonedLiveFixtures/u);
  assert.doesNotMatch(source, /created_at < now\(\) - interval '6 hours'/u);
});

test("raw call transcripts require an explicit anonymous read denial", () => {
  const source = readFileSync(
    path.join(repoRoot, "scripts/isolation-check.mjs"),
    "utf8",
  );
  assert.match(source, /expectReadDenied\("call_transcripts"\)/u);
  assert.doesNotMatch(source, /expectEmptyRead\("call_transcripts"\)/u);
});

test("account deletion artifact ledgers stay server-only and covered", () => {
  const isolation = readFileSync(
    path.join(repoRoot, "scripts/isolation-check.mjs"),
    "utf8",
  );
  const migrations = new Map([
    [
      "account_deletion_artifact_tombstones",
      readFileSync(
        path.join(
          repoRoot,
          "supabase/migrations/20260808171500_account_deletion_avatar_cleanup.sql",
        ),
        "utf8",
      ),
    ],
    [
      "family_artifact_prefixes",
      readFileSync(
        path.join(
          repoRoot,
          "supabase/migrations/20260808183000_folded_family_artifact_prefixes.sql",
        ),
        "utf8",
      ),
    ],
    [
      "family_artifact_prefix_candidates",
      readFileSync(
        path.join(
          repoRoot,
          "supabase/migrations/20260808183000_folded_family_artifact_prefixes.sql",
        ),
        "utf8",
      ),
    ],
  ]);

  for (const [table, migration] of migrations) {
    assert.match(
      migration,
      new RegExp(
        `alter table public\\.${table} enable row level security`,
        "u",
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all on table public\\.${table}\\s+from public, anon, authenticated`,
        "u",
      ),
    );
    assert.match(
      isolation,
      new RegExp(`expectReadDenied\\("${table}"\\)`, "u"),
    );
  }
});

test("reserved fixture retirement is manual, bounded, and soft-only", () => {
  const source = readFileSync(
    path.join(repoRoot, "scripts/retire-reserved-live-fixtures.mts"),
    "utf8",
  );
  assert.match(source, /--project-ref=<ref>/u);
  assert.match(source, /RETIRE RESERVED LIVE TEST FIXTURES/u);
  assert.match(source, /MAX_CANDIDATES = 100/u);
  assert.match(source, /MINIMUM_AGE_HOURS = 24/u);
  assert.match(source, /where f\.sandbox/u);
  assert.match(source, /f\.updated_at < now\(\)/u);
  assert.match(source, /for update/u);
  assert.match(source, /set status = 'deleted'/u);
  assert.doesNotMatch(source, /delete from auth\.users/u);
  assert.doesNotMatch(source, /delete from public\.families/u);
});

test("the continuity fold fixture remains anonymous and exactly retireable", () => {
  const continuity = readFileSync(
    path.join(repoRoot, "scripts/conversation-continuity-e2e.mts"),
    "utf8",
  );
  const retirement = readFileSync(
    path.join(repoRoot, "scripts/retire-reserved-live-fixtures.mts"),
    "utf8",
  );

  assert.match(
    continuity,
    /insert into public\.families \(name, status, sandbox\)[\s\S]*?'Continuity fold stub'[\s\S]*?true/u,
  );
  assert.doesNotMatch(continuity, /continuity-fold-stub@example\.test/u);
  assert.match(
    retirement,
    /f\.name = 'Continuity fold stub'[\s\S]*?and f\.email is null/u,
  );
});
