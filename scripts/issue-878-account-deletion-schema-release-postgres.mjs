import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
assert.ok(
  databaseUrl,
  "HOMA_EVAL_DATABASE_URL must point at a disposable database",
);

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releasePath = join(
  repositoryRoot,
  "scripts",
  "issue-878-account-deletion-schema-release.sql",
);
const containmentPath = join(
  repositoryRoot,
  "scripts",
  "issue-878-account-deletion-containment.sql",
);
const psql = process.env.HOMA_POSTGRES_BIN
  ? join(process.env.HOMA_POSTGRES_BIN, "psql")
  : "psql";

const migrations = [
  {
    version: "20260808170000",
    name: "family_hard_delete_protocol",
    filename: "20260808170000_family_hard_delete_protocol.sql",
    hash: "20fc44aac37a6af7230e766b943bd99f6cda949c9ef63f50c1b74f6f76087631",
  },
  {
    version: "20260808171500",
    name: "account_deletion_avatar_cleanup",
    filename: "20260808171500_account_deletion_avatar_cleanup.sql",
    hash: "ab826bbf3d8d4ec33bc1cf72ebdc46707dce381a4b3dfae4e6002b0a212c4914",
  },
  {
    version: "20260808183000",
    name: "folded_family_artifact_prefixes",
    filename: "20260808183000_folded_family_artifact_prefixes.sql",
    hash: "6eb9de43748106f4e6af46e9b188ece91ce5adab5b57ccc1c52e8da0821c35aa",
  },
  {
    version: "20260808184500",
    name: "apple_purchase_interlock",
    filename: "20260808184500_apple_purchase_interlock.sql",
    hash: "11725c2e3ca872947d5a83a597caff752a4ed265bdea2f865034cc770a9c5e51",
  },
];

function runPsql(actions, { expectedStatus = 0, releaseRole = true } = {}) {
  const args = ["--dbname", databaseUrl, "-qX", "-v", "ON_ERROR_STOP=1"];
  if (releaseRole) args.push("-c", "set role postgres;");
  args.push(...actions);
  const result = spawnSync(psql, args, {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 12 * 1024 * 1024,
    timeout: 240_000,
  });

  if (result.error) throw result.error;
  if (expectedStatus === 0) {
    assert.equal(
      result.status,
      0,
      result.stderr || "account-deletion schema release failed",
    );
  } else {
    assert.notEqual(
      result.status,
      0,
      "account-deletion schema release unexpectedly succeeded",
    );
  }

  return {
    stdout: result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean),
    stderr: result.stderr,
  };
}

function runRelease(expectedStatus = 0) {
  return runPsql(["-f", releasePath], { expectedStatus });
}

function assertAllTargetArtifactsAbsent({
  expectedContainmentLedger = true,
} = {}) {
  const state = runPsql([
    "-Atc",
    `
      select concat_ws(
        '|',
        (
          select count(*)
          from supabase_migrations.schema_migrations
          where version in (${migrations.map(({ version }) => `'${version}'`).join(", ")})
        ),
        to_regclass('public.account_deletion_artifact_tombstones') is null,
        to_regclass('public.family_artifact_prefixes') is null,
        to_regclass('public.family_artifact_prefix_candidates') is null,
        to_regclass('public.apple_purchase_interlocks') is null,
        to_regprocedure('public.guard_family_hard_delete_protocol()') is null,
        to_regprocedure('public.guard_family_deletion_status_transition()') is null,
        to_regprocedure('public.capture_legacy_deletion_storage_users()') is null,
        to_regprocedure('public.ensure_account_deletion_job_tombstones()') is null,
        to_regprocedure('public.current_auth_user_exists()') is null,
        to_regprocedure('public.reject_deleting_user_membership()') is null,
        to_regprocedure('public.guard_family_apple_purchase_interlock()') is null,
        not exists (
          select 1
          from pg_catalog.pg_attribute attribute
          where attribute.attrelid in (
              'public.account_deletion_jobs'::regclass,
              'public.families'::regclass
            )
            and attribute.attname in (
              'storage_user_ids',
              'final_cleanup_after',
              'artifact_quiet_since',
              'apple_provider_observed_at'
            )
            and not attribute.attisdropped
        ),
        not exists (
          select 1
          from pg_catalog.pg_trigger trigger_record
          where trigger_record.tgname in (
            'families_hard_delete_protocol_guard',
            'families_deletion_status_protocol_guard',
            'account_deletion_jobs_capture_legacy_users',
            'account_deletion_jobs_ensure_tombstones',
            'family_members_reject_deleting_user',
            'families_apple_purchase_interlock_guard'
          )
            and not trigger_record.tgisinternal
        ),
        not exists (
          select 1
          from pg_catalog.pg_policy policy
          where policy.polrelid = 'storage.objects'::regclass
            and pg_catalog.strpos(
              coalesce(
                pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
                ''
              ) || coalesce(
                pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid),
                ''
              ),
              'current_auth_user_exists()'
            ) > 0
        ),
        exists (
          select 1
          from supabase_migrations.schema_migrations
          where version = '20260809030000'
            and name = 'pause_legacy_account_deletion'
        ),
        pg_catalog.strpos(
          pg_catalog.pg_get_functiondef(
            'public.delete_own_account()'::regprocedure
          ),
          'account deletion is temporarily unavailable'
        ) > 0,
        not pg_catalog.has_function_privilege(
          'authenticated',
          'public.delete_own_account()',
          'execute'
        )
      );
    `,
  ]);
  assert.deepEqual(
    state.stdout,
    [
      [
        "0",
        ...Array(14).fill("t"),
        expectedContainmentLedger ? "t" : "f",
        "t",
        "t",
      ].join("|"),
    ],
  );
}

function restoreLedger(migration) {
  const source = readFileSync(
    join(repositoryRoot, "supabase", "migrations", migration.filename),
    "utf8",
  ).trimEnd();
  const delimiter = `$restore_issue_878_${migration.version}$`;
  const statement =
    `/* Homa issue 878 schema release. source_sha256=${migration.hash} */\n` +
    `${source}\n`;
  assert.ok(!statement.includes(delimiter));
  runPsql([
    "-c",
    `
      update supabase_migrations.schema_migrations
      set statements = array[${delimiter}${statement}${delimiter}]::text[],
          name = '${migration.name}'
      where version = '${migration.version}';
    `,
  ]);
}

runPsql(
  [
    "-c",
    `
      create role postgres nologin superuser;
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key,
        statements text[] not null,
        name text not null
      );
      alter function public.delete_own_account() owner to postgres;
      alter default privileges for role postgres in schema public
        grant all privileges on tables to service_role;
      alter default privileges for role postgres in schema public
        grant execute on functions to service_role;
    `,
  ],
  { releaseRole: false },
);

const containment = runPsql(["-f", containmentPath]);
assert.ok(
  containment.stdout.includes(
    "ISSUE_878_ACCOUNT_DELETION_CONTAINMENT=applied",
  ),
);

runPsql([
  "-c",
  `
    delete from supabase_migrations.schema_migrations
    where version = '20260809030000';
  `,
]);
const missingContainment = runRelease(1);
assert.match(
  missingContainment.stderr,
  /containment ledger prerequisite is absent or altered/u,
);
assertAllTargetArtifactsAbsent({ expectedContainmentLedger: false });
const restoredContainment = runPsql(["-f", containmentPath]);
assert.ok(
  restoredContainment.stdout.includes(
    "ISSUE_878_ACCOUNT_DELETION_CONTAINMENT=applied",
  ),
);

runPsql([
  "-c",
  `
    update supabase_migrations.schema_migrations
    set statements[2] = 'tampered containment statement'
    where version = '20260809030000';
  `,
]);
const alteredContainment = runRelease(1);
assert.match(
  alteredContainment.stderr,
  /containment ledger prerequisite is absent or altered/u,
);
assertAllTargetArtifactsAbsent();
runPsql([
  "-c",
  `
    delete from supabase_migrations.schema_migrations
    where version = '20260809030000';
  `,
]);
const exactContainment = runPsql(["-f", containmentPath]);
assert.ok(
  exactContainment.stdout.includes(
    "ISSUE_878_ACCOUNT_DELETION_CONTAINMENT=applied",
  ),
);

runPsql([
  "-c",
  `
    insert into public.account_deletion_jobs (status)
    values ('preparing');
  `,
]);
const unfinishedJob = runRelease(1);
assert.match(
  unfinishedJob.stderr,
  /requires zero non-complete account deletion jobs/u,
);
assertAllTargetArtifactsAbsent();
runPsql(["-c", "delete from public.account_deletion_jobs;"]);

const activeAppleFamilyId = randomUUID();
runPsql([
  "-c",
  `
    insert into public.families (
      id,
      name,
      sandbox,
      apple_original_transaction_id
    ) values (
      '${activeAppleFamilyId}',
      'Issue 878 active Apple gate probe',
      true,
      'issue-878-active-apple-gate'
    );
  `,
]);
const activeAppleRecord = runRelease(1);
assert.match(
  activeAppleRecord.stderr,
  /requires zero active App Store billing records/u,
);
assertAllTargetArtifactsAbsent();
runPsql([
  "-c",
  `delete from public.families where id = '${activeAppleFamilyId}';`,
]);

for (const migration of migrations) {
  runPsql([
    "-c",
    `
      create or replace function public.fail_issue_878_schema_ledger()
      returns trigger
      language plpgsql
      as $failure$
      begin
        if new.version = '${migration.version}' then
          raise exception 'injected schema ledger failure ${migration.version}';
        end if;
        return new;
      end
      $failure$;
      create trigger fail_issue_878_schema_ledger
      before insert on supabase_migrations.schema_migrations
      for each row execute function public.fail_issue_878_schema_ledger();
    `,
  ]);
  const failed = runRelease(1);
  assert.match(
    failed.stderr,
    new RegExp(`injected schema ledger failure ${migration.version}`, "u"),
  );
  assertAllTargetArtifactsAbsent();
  runPsql([
    "-c",
    `
      drop trigger fail_issue_878_schema_ledger
        on supabase_migrations.schema_migrations;
      drop function public.fail_issue_878_schema_ledger();
    `,
  ]);
}

runPsql([
  "-c",
  "create table public.family_artifact_prefixes (collision integer);",
]);
const collision = runRelease(1);
assert.match(collision.stderr, /absent ledgers require every reviewed schema artifact/u);
runPsql(["-c", "drop table public.family_artifact_prefixes;"]);

runPsql([
  "-c",
  `
    insert into supabase_migrations.schema_migrations
      (version, statements, name)
    values ('20260808170000', array['mixed'], 'mixed');
  `,
]);
const mixed = runRelease(1);
assert.match(mixed.stderr, /all four reviewed ledger rows must be absent or present/u);
runPsql([
  "-c",
  "delete from supabase_migrations.schema_migrations where version = '20260808170000';",
]);

const candidateOwnerFamilyId = randomUUID();
const candidateArtifactFamilyId = randomUUID();
const candidateMaterialId = randomUUID();
runPsql([
  "-c",
  `
    insert into public.families (id, name, sandbox)
    values ('${candidateOwnerFamilyId}', 'Issue 878 candidate probe', true);
    insert into public.materials (
      id,
      family_id,
      title,
      pdf_url,
      preview_url,
      html
    ) values (
      '${candidateMaterialId}',
      '${candidateOwnerFamilyId}',
      'Issue 878 candidate probe',
      'https://issue878.public.blob.vercel-storage.com/families/${candidateArtifactFamilyId}/probe.pdf',
      'https://issue878.public.blob.vercel-storage.com/families/${candidateArtifactFamilyId}/probe.png',
      '<p>Issue 878 candidate probe</p>'
    );
  `,
]);

const firstAndReplay = runPsql(["-f", releasePath, "-f", releasePath]);
assert.deepEqual(
  firstAndReplay.stdout.filter((line) =>
    line.startsWith("ISSUE_878_ACCOUNT_DELETION_SCHEMA="),
  ),
  [
    "ISSUE_878_ACCOUNT_DELETION_SCHEMA=applied",
    "ISSUE_878_ACCOUNT_DELETION_SCHEMA=verified_noop",
  ],
);

const freshNoop = runRelease();
assert.deepEqual(
  freshNoop.stdout.filter((line) =>
    line.startsWith("ISSUE_878_ACCOUNT_DELETION_SCHEMA="),
  ),
  ["ISSUE_878_ACCOUNT_DELETION_SCHEMA=verified_noop"],
);

const candidateBackfill = runPsql([
  "-Atc",
  `
    select concat_ws('|', evidence_kind, evidence_count)
    from public.family_artifact_prefix_candidates
    where owner_family_id = '${candidateOwnerFamilyId}'
      and artifact_family_id = '${candidateArtifactFamilyId}';
  `,
]);
assert.deepEqual(candidateBackfill.stdout, ["material_output|2"]);

const ledgerEvidence = runPsql([
  "-Atc",
  `
    select concat_ws(
      '|',
      version,
      name,
      pg_catalog.cardinality(statements),
      pg_catalog.strpos(statements[1], 'source_sha256=') > 0
    )
    from supabase_migrations.schema_migrations
    where version in (${migrations.map(({ version }) => `'${version}'`).join(", ")})
    order by version;
  `,
]);
assert.deepEqual(
  ledgerEvidence.stdout,
  migrations.map(
    ({ version, name }) => `${version}|${name}|1|t`,
  ),
);

runPsql([
  "-c",
  `
    update supabase_migrations.schema_migrations
    set statements = array['tampered']
    where version = '20260808170000';
  `,
]);
const ledgerTamper = runRelease(1);
assert.match(ledgerTamper.stderr, /ledger evidence is absent or altered/u);
restoreLedger(migrations[0]);

runPsql([
  "-c",
  "alter function public.guard_family_hard_delete_protocol() owner to homa_eval;",
]);
const ownerDrift = runRelease(1);
assert.match(ownerDrift.stderr, /function .* metadata differs/u);
runPsql([
  "-c",
  "alter function public.guard_family_hard_delete_protocol() owner to postgres;",
]);

runPsql([
  "-c",
  "alter function public.guard_family_hard_delete_protocol() set search_path = public;",
]);
const searchPathDrift = runRelease(1);
assert.match(searchPathDrift.stderr, /function .* metadata differs/u);
runPsql([
  "-c",
  "alter function public.guard_family_hard_delete_protocol() set search_path = '';",
]);

runPsql([
  "-c",
  "grant select on public.family_artifact_prefixes to authenticated;",
]);
const aclDrift = runRelease(1);
assert.match(aclDrift.stderr, /relation .* ACL exposes a client role/u);
runPsql([
  "-c",
  "revoke select on public.family_artifact_prefixes from authenticated;",
]);

runPsql([
  "-c",
  `
    drop policy "avatar owners delete" on storage.objects;
    create policy "avatar owners delete"
      on storage.objects for delete to authenticated
      using (true);
  `,
]);
const policyDrift = runRelease(1);
assert.match(policyDrift.stderr, /avatar storage policy .* differs/u);
runPsql([
  "-c",
  `
    drop policy "avatar owners delete" on storage.objects;
    create policy "avatar owners delete"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
        and (select public.current_auth_user_exists())
      );
  `,
]);

runPsql([
  "-c",
  `
    drop index public.family_artifact_prefixes_owner_idx;
    create index family_artifact_prefixes_owner_idx
      on public.family_artifact_prefixes (owner_family_id);
  `,
]);
const indexDrift = runRelease(1);
assert.match(indexDrift.stderr, /index .* required definition fragment/u);
runPsql([
  "-c",
  `
    drop index public.family_artifact_prefixes_owner_idx;
    create index family_artifact_prefixes_owner_idx
      on public.family_artifact_prefixes
        (owner_family_id, artifact_family_id);
  `,
]);

runPsql([
  "-c",
  "alter table public.families disable trigger families_hard_delete_protocol_guard;",
]);
const disabledTrigger = runRelease(1);
assert.match(disabledTrigger.stderr, /trigger .* metadata differs/u);
runPsql([
  "-c",
  "alter table public.families enable trigger families_hard_delete_protocol_guard;",
]);

runPsql([
  "-c",
  `
    drop trigger families_hard_delete_protocol_guard on public.families;
    create trigger families_hard_delete_protocol_guard
      before delete on public.families
      for each row
      when (false)
      execute function public.guard_family_hard_delete_protocol();
  `,
]);
const conditionalTrigger = runRelease(1);
assert.match(conditionalTrigger.stderr, /trigger .* metadata differs/u);
runPsql([
  "-c",
  `
    drop trigger families_hard_delete_protocol_guard on public.families;
    create trigger families_hard_delete_protocol_guard
      before delete on public.families
      for each row execute function public.guard_family_hard_delete_protocol();
  `,
]);

runPsql([
  "-c",
  `
    create function public.issue_878_wrong_delete_guard()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
    as $wrong$
    begin
      return old;
    end
    $wrong$;
    revoke all on function public.issue_878_wrong_delete_guard()
      from public, anon, authenticated, service_role;
    drop trigger families_hard_delete_protocol_guard on public.families;
    create trigger families_hard_delete_protocol_guard
      before delete on public.families
      for each row execute function public.issue_878_wrong_delete_guard();
  `,
]);
const reboundTrigger = runRelease(1);
assert.match(reboundTrigger.stderr, /trigger .* metadata differs/u);
runPsql([
  "-c",
  `
    drop trigger families_hard_delete_protocol_guard on public.families;
    create trigger families_hard_delete_protocol_guard
      before delete on public.families
      for each row execute function public.guard_family_hard_delete_protocol();
    drop function public.issue_878_wrong_delete_guard();
  `,
]);

const checkConstraint = runPsql([
  "-Atc",
  `
    select conname
    from pg_catalog.pg_constraint
    where conrelid = 'public.family_artifact_prefixes'::regclass
      and contype = 'c';
  `,
]).stdout[0];
assert.match(checkConstraint, /^[a-z0-9_]+$/u);
runPsql([
  "-c",
  `
    alter table public.family_artifact_prefixes
      drop constraint ${checkConstraint};
    alter table public.family_artifact_prefixes
      add constraint ${checkConstraint} check (true);
  `,
]);
const constraintDrift = runRelease(1);
assert.match(constraintDrift.stderr, /missing check fragment/u);
runPsql([
  "-c",
  `
    alter table public.family_artifact_prefixes
      drop constraint ${checkConstraint};
    alter table public.family_artifact_prefixes
      add constraint ${checkConstraint}
      check (artifact_family_id <> owner_family_id);
  `,
]);

const tombstoneForeignKey =
  "account_deletion_artifact_tombstones_deletion_job_id_fkey";
runPsql([
  "-c",
  `
    alter table public.account_deletion_artifact_tombstones
      drop constraint ${tombstoneForeignKey};
    alter table public.account_deletion_artifact_tombstones
      add constraint ${tombstoneForeignKey}
      foreign key (deletion_job_id)
      references public.account_deletion_jobs (id) on delete cascade;
  `,
]);
const foreignKeyDrift = runRelease(1);
assert.match(foreignKeyDrift.stderr, /foreign-key contract differs/u);
runPsql([
  "-c",
  `
    alter table public.account_deletion_artifact_tombstones
      drop constraint ${tombstoneForeignKey};
    alter table public.account_deletion_artifact_tombstones
      add constraint ${tombstoneForeignKey}
      foreign key (deletion_job_id)
      references public.account_deletion_jobs (id) on delete restrict;
  `,
]);

const finalNoop = runRelease();
assert.ok(
  finalNoop.stdout.includes(
    "ISSUE_878_ACCOUNT_DELETION_SCHEMA=verified_noop",
  ),
);

console.log(
  "Issue 878 account-deletion schema release passed absent, rollback, apply, replay, recovery, candidate, catalog drift, and behavior probes.",
);
