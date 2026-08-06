import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(
  resolve(repositoryRoot, ".github/workflows/issue-878-production-repair.yml"),
  "utf8",
);
const repair = readFileSync(
  resolve(repositoryRoot, "scripts/issue-878-production-repair.sql"),
  "utf8",
);
const workflowDocument = parse(workflow);
const sandboxMigration = readFileSync(
  resolve(
    repositoryRoot,
    "supabase/migrations/20260806034000_sandbox_live_auth_fixtures.sql",
  ),
);
const deleteMigration = readFileSync(
  resolve(
    repositoryRoot,
    "supabase/migrations/20260806035000_family_delete_progress_trigger.sql",
  ),
);

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

test("workflow is bound to production, Homa, and exact reviewed inputs", () => {
  assert.equal(
    workflowDocument.jobs.apply.if,
    "github.ref == 'refs/heads/main' && github.actor == 'sidneyswift'",
  );
  assert.equal(workflowDocument.jobs.apply.environment, "production");
  assert.equal(
    workflowDocument.jobs.apply.steps[0].uses,
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  );
  assert.match(workflow, /environment: production/u);
  assert.match(
    workflow,
    /if: github\.ref == 'refs\/heads\/main' && github\.actor == 'sidneyswift'/u,
  );
  assert.match(workflow, /confirmation[\s\S]*APPLY ISSUE 878/u);
  assert.match(workflow, /GITHUB_REPOSITORY.*sidneyswift\/homa/u);
  assert.match(workflow, /ref: main/u);
  assert.match(workflow, /kzplntcdtsvdowntvlza/u);
  assert.match(workflow, /cancel-in-progress: false/u);
  assert.match(
    workflow,
    /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4\.4\.0/u,
  );
  assert.doesNotMatch(workflow, /actions\/checkout@v\d/u);
  assert.match(workflow, new RegExp(sha256(sandboxMigration), "u"));
  assert.match(workflow, new RegExp(sha256(deleteMigration), "u"));
  assert.match(workflow, new RegExp(sha256(repair), "u"));
  assert.equal(
    workflow.match(/-f scripts\/issue-878-production-repair\.sql/g)?.length,
    2,
  );
  assert.doesNotMatch(workflow, /supabase\s+db\s+push/u);
});

test("repair applies only the reviewed pair inside one bounded transaction", () => {
  const includes = repair.match(/^\\ir .*$/gmu) ?? [];
  assert.deepEqual(includes, [
    "\\ir ../supabase/migrations/20260806034000_sandbox_live_auth_fixtures.sql",
    "\\ir ../supabase/migrations/20260806035000_family_delete_progress_trigger.sql",
  ]);
  assert.ok(repair.indexOf("begin;") < repair.indexOf(includes[0]));
  assert.ok(repair.indexOf(includes[1]) < repair.lastIndexOf("commit;"));
  assert.match(repair, /pg_advisory_xact_lock/u);
  assert.match(repair, /set local lock_timeout = '5s'/u);
  assert.match(repair, /set local statement_timeout = '120s'/u);
  assert.match(repair, /both reviewed versions must be absent or present/u);
  assert.match(repair, /ISSUE_878_REPAIR=[\s\S]*verified_noop/u);
  assert.match(repair, new RegExp(sha256(sandboxMigration), "u"));
  assert.match(repair, new RegExp(sha256(deleteMigration), "u"));
  assert.match(repair, /pg_get_functiondef/u);
  assert.match(repair, /issue_878_sandbox_ledger_statements/u);
  assert.match(repair, /issue_878_delete_ledger_statements/u);
  assert.match(
    repair,
    /revoke execute on function public\.create_my_family\(text, text, text\) from service_role/u,
  );
});

test("repair verifies metadata, grants, and rollback-only behavior probes", () => {
  assert.match(
    sandboxMigration.toString("utf8"),
    /revoke execute on function public\.create_my_family\(text, text, text\) from service_role/u,
  );
  assert.match(repair, /prosecdef/u);
  assert.match(repair, /rolname = 'postgres'/u);
  assert.equal(repair.match(/proowner <> expected_owner_oid/g)?.length, 2);
  assert.match(repair, /create_my_family owner is not postgres/u);
  assert.match(
    repair,
    /pause_check_ins_for_removed_member owner is not postgres/u,
  );
  assert.match(repair, /search_path=""/u);
  assert.match(repair, /aclexplode/u);
  assert.match(repair, /family_members_pause_check_ins_before_removal/u);
  assert.match(repair, /reserved Auth email did not create a sandbox family/u);
  assert.match(repair, /ordinary Auth email was incorrectly marked/u);
  assert.match(repair, /whole-family deletion did not finish cleanly/u);
  assert.match(repair, /ordinary member removal did not pause/u);
  assert.equal(repair.match(/^savepoint issue_878_/gmu)?.length, 4);
  assert.equal(repair.match(/^rollback to savepoint issue_878_/gmu)?.length, 4);
});
