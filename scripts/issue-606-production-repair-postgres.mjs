import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
assert.ok(
  databaseUrl,
  "Issue 606 repair test refused outside the disposable eval sandbox."
);

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repairPath = join(
  repositoryRoot,
  "scripts",
  "issue-606-production-repair.sql"
);
const psql = process.env.HOMA_POSTGRES_BIN
  ? join(process.env.HOMA_POSTGRES_BIN, "psql")
  : "psql";

function runPsql(actions, expectedStatus = 0) {
  const result = spawnSync(
    psql,
    ["--dbname", databaseUrl, "-qX", "-v", "ON_ERROR_STOP=1", ...actions],
    {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 180_000,
    }
  );
  if (result.error) throw result.error;
  if (expectedStatus === 0) {
    assert.equal(result.status, 0, result.stderr || "Issue 606 repair failed.");
  } else {
    assert.notEqual(
      result.status,
      0,
      "Issue 606 repair unexpectedly succeeded."
    );
  }
  return {
    stderr: result.stderr,
    lines: result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

const setup = `
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[] not null,
    name text not null
  );
  delete from supabase_migrations.schema_migrations
  where version in (
    '20260802033000',
    '20260805110000',
    '20260807040000'
  );
  insert into supabase_migrations.schema_migrations
    (version, statements, name)
  values
    ('20260802033000', array['reviewed fixture'],
     'conversation_privacy_per_adult'),
    ('20260805110000', array['reviewed fixture'],
     'eve_web_session_owners');

  do $owner$
  begin
    if not exists (
      select 1 from pg_catalog.pg_roles where rolname = 'postgres'
    ) then
      create role postgres nologin superuser;
    end if;
  end
  $owner$;
  alter function public.conversation_session_owned_by_caller(uuid, text)
    owner to postgres;
  alter function public.conversation_episode_owned_by_caller(uuid, uuid)
    owner to postgres;

  insert into auth.users (id) values
    ('60610000-0000-4000-8000-000000000001'),
    ('60610000-0000-4000-8000-000000000002');
  insert into public.families (id, name) values
    ('60610000-0000-4000-8000-000000000010', 'Issue 606 repair fixture');
  insert into public.family_members
    (family_id, user_id, role, display_name)
  values
    ('60610000-0000-4000-8000-000000000010',
     '60610000-0000-4000-8000-000000000001', 'parent', 'Repair A'),
    ('60610000-0000-4000-8000-000000000010',
     '60610000-0000-4000-8000-000000000002', 'parent', 'Repair B');
  insert into public.conversation_episodes
    (id, family_id, scope, member_user_id, summary_version)
  values
    ('60610000-0000-4000-8000-000000000101',
     '60610000-0000-4000-8000-000000000010', 'household',
     '60610000-0000-4000-8000-000000000001', 'repair-safe'),
    ('60610000-0000-4000-8000-000000000102',
     '60610000-0000-4000-8000-000000000010', 'member',
     '60610000-0000-4000-8000-000000000001', 'repair-mixed');
  insert into public.conversation_messages
    (family_id, session_id, sequence, channel, role, content, visibility,
     member_user_id, episode_id)
  values
    ('60610000-0000-4000-8000-000000000010', 'issue606-repair-safe', 0,
     'web', 'user', 'repair safe user', 'family',
     '60610000-0000-4000-8000-000000000001',
     '60610000-0000-4000-8000-000000000101'),
    ('60610000-0000-4000-8000-000000000010', 'issue606-repair-safe', 1,
     'web', 'assistant', 'repair safe assistant', 'family',
     '60610000-0000-4000-8000-000000000001',
     '60610000-0000-4000-8000-000000000101'),
    ('60610000-0000-4000-8000-000000000010', 'issue606-repair-mixed', 0,
     'web', 'user', 'repair known user', 'family',
     '60610000-0000-4000-8000-000000000001',
     '60610000-0000-4000-8000-000000000102'),
    ('60610000-0000-4000-8000-000000000010', 'issue606-repair-mixed', 1,
     'web', 'user', 'repair unknown user', 'family', null,
     '60610000-0000-4000-8000-000000000102'),
    ('60610000-0000-4000-8000-000000000010', 'issue606-repair-mixed', 2,
     'web', 'assistant', 'repair unsafe assistant', 'family',
     '60610000-0000-4000-8000-000000000001',
     '60610000-0000-4000-8000-000000000102');
  insert into public.call_transcripts
    (conversation_id, family_id, member_user_id, line, transcript_text)
  values
    ('issue606-repair-call', '60610000-0000-4000-8000-000000000010',
     '60610000-0000-4000-8000-000000000001', 'general',
     'repair call content');
`;

runPsql(["-c", setup]);

const WORKFLOW_RUN_ID = "60610001";

function repair(expectedMarker) {
  const result = runPsql([
    "-v",
    `issue_606_run_id=${WORKFLOW_RUN_ID}`,
    "-f",
    repairPath,
  ]);
  const output = result.lines.filter((line) => line.startsWith("ISSUE_606_"));
  assert.deepEqual(output, [
    expectedMarker === "ISSUE_606_REPAIR=repaired"
      ? "ISSUE_606_ASSISTANTS_CLEARED=1"
      : "ISSUE_606_ASSISTANTS_CLEARED=0",
    expectedMarker === "ISSUE_606_REPAIR=repaired"
      ? "ISSUE_606_EPISODES_CLEARED=2"
      : "ISSUE_606_EPISODES_CLEARED=0",
    expectedMarker === "ISSUE_606_REPAIR=repaired"
      ? "ISSUE_606_CALLS_CLEARED=1"
      : "ISSUE_606_CALLS_CLEARED=0",
    "ISSUE_606_UNSAFE_ASSISTANTS=false",
    "ISSUE_606_UNSAFE_EPISODES=false",
    "ISSUE_606_OWNED_CALLS=false",
    expectedMarker,
  ]);
  assert.ok(
    result.lines.every(
      (line) =>
        !line.startsWith("ISSUE_606_") ||
        /^[A-Z0-9_]+=(?:\d+|false|repaired|verified_noop)$/u.test(line)
    )
  );
}

repair("ISSUE_606_REPAIR=repaired");
repair("ISSUE_606_REPAIR=verified_noop");
repair("ISSUE_606_REPAIR=verified_noop");

const foreignRun = runPsql(
  ["-v", "issue_606_run_id=60619999", "-f", repairPath],
  1
);
assert.match(foreignRun.stderr, /ledger evidence is absent or altered/u);

const state = runPsql([
  "-Atc",
  `
    select concat_ws('|',
      (select member_user_id::text
       from public.conversation_messages
       where session_id = 'issue606-repair-safe' and role = 'assistant'),
      (select scope || ':' || coalesce(member_user_id::text, 'null')
       from public.conversation_episodes
       where summary_version = 'repair-safe'),
      (select coalesce(member_user_id::text, 'null')
       from public.conversation_messages
       where session_id = 'issue606-repair-mixed' and role = 'assistant'),
      (select scope || ':' || coalesce(member_user_id::text, 'null')
       from public.conversation_episodes
       where summary_version = 'repair-mixed'),
      (select coalesce(member_user_id::text, 'null')
       from public.call_transcripts
       where conversation_id = 'issue606-repair-call')
    );
  `,
]);
assert.deepEqual(state.lines, [
  "60610000-0000-4000-8000-000000000001|" +
    "member:60610000-0000-4000-8000-000000000001|null|member:null|null",
]);

const ledger = runPsql([
  "-Atc",
  `
    select concat_ws('|', version, name, cardinality(statements),
      strpos(statements[1], 'sha256=a158765ad96a27830f7c92f80c038adfcc43b32e0971b3624f12302e579a3db9') > 0,
      statements[8] = '/* Homa issue 606 workflow_run_id=60610001 */')
    from supabase_migrations.schema_migrations
    where version = '20260807040000';
  `,
]);
assert.deepEqual(ledger.lines, [
  "20260807040000|conversation_privacy_attribution_containment|8|t|t",
]);

runPsql([
  "-c",
  `
    update supabase_migrations.schema_migrations
    set statements = array['tampered']::text[]
    where version = '20260807040000';
  `,
]);
const tampered = runPsql(
  ["-v", `issue_606_run_id=${WORKFLOW_RUN_ID}`, "-f", repairPath],
  1
);
assert.match(tampered.stderr, /ledger evidence is absent or altered/u);

console.log(
  "Issue 606 production repair passed exact cleanup counts, three fresh idempotent runs, same-run recovery evidence, and foreign-run plus tamper refusal."
);
