import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = resolve(
  repositoryRoot,
  ".github/workflows/issue-888-production-repair.yml"
);
const repairPath = resolve(
  repositoryRoot,
  "scripts/issue-888-production-repair.sql"
);
const harnessPath = resolve(
  repositoryRoot,
  "scripts/issue-888-production-repair-postgres.mjs"
);
const originalPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260801201500_month_plan_approvals.sql"
);
const boundaryPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260806040000_month_plan_approvals_write_boundary.sql"
);
const monthPlanDraftPath = resolve(
  repositoryRoot,
  "apps/web/lib/month-plan-draft.ts"
);
const captureLoopPath = resolve(
  repositoryRoot,
  "apps/web/lib/capture-loop-events.ts"
);

const workflow = readFileSync(workflowPath, "utf8");
const repair = readFileSync(repairPath, "utf8");
const harness = readFileSync(harnessPath, "utf8");
const original = readFileSync(originalPath);
const boundary = readFileSync(boundaryPath);
const monthPlanDraft = readFileSync(monthPlanDraftPath, "utf8");
const captureLoop = readFileSync(captureLoopPath, "utf8");
const workflowDocument = parse(workflow);

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

test("reviewed migrations stay byte-exact and executable", () => {
  assert.equal(original.byteLength, 1363);
  assert.equal(
    sha256(original),
    "82e13e2cb85667f8ec9e5d8f561fcc63332e34c90b19b168f2aad462065e8d66"
  );
  assert.equal(boundary.byteLength, 421);
  assert.equal(
    sha256(boundary),
    "9fabf67838a95a6cf6df569d275d0314c8304523ca9a494334da2a80bcab5a12"
  );
  assert.match(
    boundary.toString("utf8"),
    /revoke all privileges[\s\S]*authenticated;[\s\S]*grant select[\s\S]*grant all privileges[\s\S]*service_role;/u
  );
});

test("workflow is owner-only, production-pinned, and hashes inputs before connecting", () => {
  const apply = workflowDocument.jobs.apply;
  assert.equal(
    apply.if,
    "github.repository == 'sidneyswift/homa' && github.repository_owner == 'sidneyswift' && github.ref == 'refs/heads/main' && github.ref_name == 'main' && github.event.repository.default_branch == 'main' && github.actor == 'sidneyswift' && github.triggering_actor == 'sidneyswift'"
  );
  assert.equal(apply.environment, "production");
  assert.equal(apply["timeout-minutes"], 10);
  assert.equal(
    workflowDocument.concurrency.group,
    "production-issue-888-repair-v2"
  );
  assert.equal(
    workflowDocument.on.workflow_dispatch.inputs.reviewed_repair_sha.required,
    true
  );
  assert.equal(
    workflowDocument.on.workflow_dispatch.inputs.production_deployed_sha
      .required,
    true
  );
  assert.equal(
    apply.steps[0].uses,
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262"
  );
  assert.equal(apply.steps[0].with.ref, "${{ github.sha }}");
  assert.equal(apply.steps[0].with["fetch-depth"], 0);
  assert.match(workflow, /confirmation[\s\S]*APPLY ISSUE 888/u);
  assert.match(workflow, /GITHUB_RUN_ATTEMPT.*1/u);
  assert.match(workflow, /refuses workflow reruns/u);
  assert.match(workflow, /REVIEWED_REPAIR_SHA.*reviewed_repair_sha/u);
  assert.match(workflow, /PRODUCTION_DEPLOYED_SHA.*production_deployed_sha/u);
  assert.match(workflow, /PRODUCTION_DEPLOYED_SHA.*GITHUB_SHA/u);
  assert.match(workflow, /merge_parents\[1\].*REVIEWED_REPAIR_SHA/u);
  assert.match(workflow, /git merge-base --is-ancestor/u);
  assert.match(workflow, /GITHUB_REPOSITORY.*sidneyswift\/homa/u);
  assert.match(workflow, /GITHUB_REPOSITORY_OWNER.*sidneyswift/u);
  assert.match(workflow, /GITHUB_REF_NAME.*main/u);
  assert.match(workflow, /git rev-parse HEAD/u);
  assert.match(workflow, /git ls-remote --exit-code origin refs\/heads\/main/u);
  assert.match(workflow, /fetched_main_sha.*GITHUB_SHA/u);
  assert.match(workflow, /remote_main_sha.*GITHUB_SHA/u);
  assert.match(workflow, /kzplntcdtsvdowntvlza/u);
  assert.match(workflow, /cancel-in-progress: false/u);
  assert.doesNotMatch(workflow, /actions\/checkout@v\d/u);
  assert.match(workflow, new RegExp(sha256(original), "u"));
  assert.match(workflow, new RegExp(sha256(boundary), "u"));
  assert.match(workflow, new RegExp(sha256(repair), "u"));
  assert.ok(
    workflow.indexOf("expected_repair=") <
      workflow.indexOf("Build a masked production database URL")
  );
  assert.equal(
    workflow.match(/-f scripts\/issue-888-production-repair\.sql/g)?.length,
    2
  );
  assert.match(
    workflow,
    /repair_markers\[0\].*ISSUE_888_REPAIR=repaired[\s\S]*fresh connection[\s\S]*repair_markers\[0\].*ISSUE_888_REPAIR=verified_noop/u
  );
  assert.match(workflow, /fresh connection is a verified no-op/u);
  assert.match(workflow, /ISSUE_888_SANITIZED_LOG_SHA256=/u);
  assert.match(workflow, /ISSUE_888_RECEIPT_SHA256=/u);
  assert.match(workflow, /contract=homa-issue-888-production-repair-v1/u);
  assert.match(workflow, /workflow_sha256=/u);
  assert.match(workflow, /run_attempt=%s/u);
  assert.match(workflow, /reviewed_repair_sha=%s/u);
  assert.match(workflow, /production_deployed_sha=%s/u);
  assert.match(workflow, /remote_main_sha=%s/u);
  assert.match(workflow, /sanitized_log_sha256=%s/u);
  assert.doesNotMatch(workflow, /echo "\$result"/u);
  assert.doesNotMatch(workflow, /supabase\s+db\s+push/u);
});

test("repair applies only the reviewed pair inside one bounded transaction", () => {
  const includes = repair.match(/^\\ir .*$/gmu) ?? [];
  assert.deepEqual(includes, [
    "\\ir ../supabase/migrations/20260801201500_month_plan_approvals.sql",
    "\\ir ../supabase/migrations/20260806040000_month_plan_approvals_write_boundary.sql",
  ]);
  assert.ok(repair.indexOf("begin;") < repair.indexOf(includes[0]));
  assert.ok(repair.indexOf(includes[1]) < repair.lastIndexOf("commit;"));
  const advisoryLock = repair.indexOf("pg_advisory_xact_lock");
  const migrationLedgerLock = repair.indexOf(
    "lock table supabase_migrations.schema_migrations"
  );
  const familiesLock = repair.indexOf(
    "lock table public.families in share row exclusive mode"
  );
  const existingReceiptLock = repair.indexOf(
    "lock table public.month_plan_approvals in share row exclusive mode"
  );
  const firstStateRead = repair.indexOf("insert into issue_888_repair_state");
  assert.ok(advisoryLock > repair.indexOf("begin;"));
  assert.ok(advisoryLock < migrationLedgerLock);
  assert.ok(migrationLedgerLock < familiesLock);
  assert.ok(familiesLock < existingReceiptLock);
  assert.ok(existingReceiptLock < firstStateRead);
  assert.match(repair, /set local lock_timeout = '5s'/u);
  assert.match(repair, /set local statement_timeout = '120s'/u);
  assert.match(
    repair,
    /set local idle_in_transaction_session_timeout = '150s'/u
  );
  assert.match(repair, /both reviewed versions must be absent or present/u);
  assert.match(
    repair,
    /absent ledger rows require all reviewed relation names to be absent/u
  );
  assert.match(repair, /ISSUE_888_REPAIR=[\s\S]*verified_noop/u);
});

test("ledger arrays retain all executable statements and source hashes", () => {
  assert.equal(repair.match(/\$original_[1-6]\$/gu)?.length, 12);
  assert.equal(repair.match(/\$boundary_[1-3]\$/gu)?.length, 6);
  assert.match(repair, /source_sha256=82e13e2c/u);
  assert.match(repair, /source_sha256=9fabf678/u);
  assert.match(
    repair,
    /issue_888_original_statements\(\)[\s\S]*create table if not exists[\s\S]*create policy[\s\S]*revoke insert/u
  );
  assert.match(
    repair,
    /issue_888_boundary_statements\(\)[\s\S]*revoke all privileges[\s\S]*grant select[\s\S]*grant all privileges/u
  );
  assert.match(harness, /string_agg\([\s\S]*array_to_string\(statements/u);
  assert.match(harness, /runPsql\(\["-c", fetchedMigration\]\)/u);
});

test("repair verifies the complete schema, policy, index, and dynamic ACL contract", () => {
  assert.match(repair, /columns differ from the reviewed six-column contract/u);
  assert.match(repair, /table_contract\.relispartition/u);
  assert.match(repair, /exactly five reviewed constraints/u);
  assert.match(repair, /confdeltype = 'c'/u);
  assert.match(repair, /exactly two reviewed indexes/u);
  assert.match(repair, /indkey::text <> '2 3'/u);
  assert.match(repair, /indoption::text <> '0 3'/u);
  assert.match(repair, /operator_classes/u);
  assert.equal(repair.match(/indimmediate/g)?.length, 2);
  assert.equal(repair.match(/indnullsnotdistinct/g)?.length, 2);
  assert.equal(repair.match(/indisclustered/g)?.length, 2);
  assert.equal(repair.match(/indisreplident/g)?.length, 2);
  assert.match(repair, /exactly one reviewed policy/u);
  assert.match(repair, /is_family_member\(family_id\)/u);
  assert.match(repair, /pg_catalog\.acldefault\('r'/u);
  assert.match(repair, /expected_all_privilege_count/u);
  assert.match(repair, /privilege_type <> 'SELECT'/u);
  assert.match(repair, /privilege\.grantor <> expected_owner_oid/u);
  assert.match(repair, /privilege\.is_grantable/u);
  assert.match(repair, /attribute\.attacl is not null/u);
  assert.match(repair, /attribute\.attisdropped/u);
  assert.match(repair, /service_role_oid/u);
  assert.match(repair, /authenticated truncate was not denied/u);
});

test("database contract matches the production approval and receipt readers", () => {
  assert.match(
    monthPlanDraft,
    /select draft_id from public\.month_plan_approvals[\s\S]*where draft_id = \$\{payload\.draftId\} and family_id = \$\{input\.familyId\}/u
  );
  assert.match(
    monthPlanDraft,
    /insert into public\.month_plan_approvals[\s\S]*\(draft_id, family_id, month_start, final_revision, revision_history\)[\s\S]*payload\.draftId[\s\S]*input\.familyId[\s\S]*snapshot\.plan\.monthStart[\s\S]*snapshot\.revision[\s\S]*payload\.history/u
  );
  assert.match(
    captureLoop,
    /from public\.month_plan_approvals receipt[\s\S]*receipt\.draft_id = \$\{props\.receipt_id\}[\s\S]*receipt\.family_id = \$\{familyId\}[\s\S]*receipt\.final_revision = \$\{props\.revision\}/u
  );
});

test("disposable harness covers behavior, tampering, collisions, and rollback", () => {
  assert.match(harness, /reproduce Supabase default table grants/u);
  assert.match(harness, /ISSUE_888_REPAIR=repaired/u);
  assert.match(harness, /ISSUE_888_REPAIR=verified_noop/u);
  assert.match(harness, /family RLS did not isolate receipts/u);
  assert.match(
    harness,
    /\["truncate", "truncate table public\.month_plan_approvals"\]/u
  );
  assert.match(harness, /service_role/u);
  assert.match(harness, /invalidCases/u);
  assert.match(harness, /family deletion did not cascade/u);
  assert.match(harness, /transactionalTamperCases/u);
  assert.match(harness, /tableCollision/u);
  assert.match(harness, /indexCollision/u);
  assert.match(harness, /primaryIndexCollision/u);
  assert.match(harness, /ACL grant option/u);
  assert.match(harness, /ACL grantor/u);
  assert.match(harness, /column ACL/u);
  assert.match(harness, /dropped column/u);
  assert.match(harness, /clustered index/u);
  assert.match(harness, /replica identity index/u);
  assert.match(harness, /issue_888_partition_parent/u);
  assert.match(harness, /migration ledger is mixed/u);
  assert.match(harness, /relation state is mixed/u);
  assert.match(harness, /injected mid-migration failure/u);
  assert.match(
    harness,
    /mid-migration failure left relation or ledger residue/u
  );
});
