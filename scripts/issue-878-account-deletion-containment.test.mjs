import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(
  resolve(
    repositoryRoot,
    ".github/workflows/issue-878-account-deletion-containment.yml"
  ),
  "utf8"
);
const repair = readFileSync(
  resolve(repositoryRoot, "scripts/issue-878-account-deletion-containment.sql"),
  "utf8"
);
const migration = readFileSync(
  resolve(
    repositoryRoot,
    "supabase/migrations/20260809030000_pause_legacy_account_deletion.sql"
  ),
  "utf8"
);
const route = readFileSync(
  resolve(repositoryRoot, "apps/web/app/api/account-deletion/route.ts"),
  "utf8"
);
const webSurface = readFileSync(
  resolve(
    repositoryRoot,
    "apps/web/app/app/settings/delete-family-data-card.tsx"
  ),
  "utf8"
);
const mobileSurface = readFileSync(
  resolve(repositoryRoot, "apps/mobile/src/app/settings/delete-account.tsx"),
  "utf8"
);
const schedule = readFileSync(
  resolve(repositoryRoot, "apps/web/agent/schedules/account-deletions.ts"),
  "utf8"
);
const workflowDocument = parse(workflow);

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

test("workflow is production-bound, immutable, and cancellation-recoverable", () => {
  assert.equal(
    workflowDocument.jobs.apply.if,
    "github.repository == 'sidneyswift/homa' && github.repository_owner == 'sidneyswift' && github.ref == 'refs/heads/main' && github.ref_name == 'main' && github.event.repository.default_branch == 'main' && github.actor == 'sidneyswift' && github.triggering_actor == 'sidneyswift'"
  );
  assert.equal(workflowDocument.jobs.apply.environment, "production");
  assert.equal(
    workflowDocument.concurrency.group,
    "production-issue-878-account-deletion-containment"
  );
  assert.equal(workflowDocument.concurrency["cancel-in-progress"], false);
  assert.equal(
    workflowDocument.jobs.apply.steps[0].uses,
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262"
  );
  assert.equal(workflowDocument.jobs.apply.steps[0].with["fetch-depth"], 0);
  assert.match(workflow, /production_deployed_sha[\s\S]*required: true/u);
  assert.match(workflow, /reviewed_repair_sha[\s\S]*required: true/u);
  assert.match(workflow, /git rev-list --parents -n 1/u);
  assert.match(workflow, /merge_line\[2\].*REVIEWED_REPAIR_SHA/u);
  assert.match(workflow, /git diff --quiet.*REVIEWED_REPAIR_SHA.*GITHUB_SHA/u);
  const reviewedPaths = workflow.match(
    /reviewed_paths=\(\n(?<paths>[\s\S]*?)\n\s*\)/u
  );
  assert.ok(reviewedPaths?.groups?.paths);
  assert.match(
    reviewedPaths.groups.paths,
    /apps\/mobile\/scripts\/android-release-guard\.mjs/u
  );
  assert.match(
    reviewedPaths.groups.paths,
    /apps\/mobile\/scripts\/android-release-guard\.test\.mjs/u
  );
  assert.match(
    reviewedPaths.groups.paths,
    /docs\/homa-design\/evidence\/authoring-rails\.json/u
  );
  assert.match(
    reviewedPaths.groups.paths,
    /docs\/homa-design\/evidence\/legacy-removal\.json/u
  );
  assert.match(
    reviewedPaths.groups.paths,
    /docs\/homa-design\/evidence\/marketing-production\.json/u
  );
  assert.match(reviewedPaths.groups.paths, /scripts\/migration-version-check\.mjs/u);
  assert.match(workflow, /GITHUB_RUN_ATTEMPT/u);
  assert.match(workflow, /previous_conclusion/u);
  assert.match(workflow, /cancelled\|failure\|timed_out/u);
  assert.equal(
    workflow.match(/git ls-remote --exit-code origin refs\/heads\/main/g)
      ?.length,
    2
  );
  assert.equal(
    workflow.match(/-f scripts\/issue-878-account-deletion-containment\.sql/g)
      ?.length,
    2
  );
  assert.doesNotMatch(workflow, /supabase\s+db\s+push/u);
  assert.match(workflow, new RegExp(sha256(migration), "u"));
  assert.match(workflow, new RegExp(sha256(repair), "u"));

  for (const step of workflowDocument.jobs.apply.steps) {
    if (!step.run) continue;
    const syntax = spawnSync("bash", ["-n"], {
      input: step.run,
      encoding: "utf8",
    });
    assert.equal(
      syntax.status,
      0,
      `${step.name ?? "unnamed workflow step"}: ${syntax.stderr}`
    );
  }
});

test("repair applies one migration in one bounded locked transaction", () => {
  assert.deepEqual(repair.match(/^\\ir .*$/gmu), [
    "\\ir ../supabase/migrations/20260809030000_pause_legacy_account_deletion.sql",
  ]);
  assert.ok(repair.indexOf("begin;") < repair.indexOf("\\ir "));
  assert.ok(repair.indexOf("\\ir ") < repair.lastIndexOf("commit;"));
  assert.match(repair, /pg_advisory_xact_lock/u);
  assert.match(repair, /set local lock_timeout = '5s'/u);
  assert.match(repair, /set local statement_timeout = '120s'/u);
  assert.match(
    repair,
    /lock table supabase_migrations\.schema_migrations\s+in share row exclusive mode/u
  );
  assert.match(
    repair,
    /lock table public\.account_deletion_jobs\s+in share row exclusive mode/u
  );
  assert.match(repair, /status <> 'complete'/u);
  assert.match(repair, /zero non-complete deletion jobs/u);
  assert.match(repair, /ISSUE_878_ACCOUNT_DELETION_CONTAINMENT=applied/u);
  assert.match(repair, /ISSUE_878_ACCOUNT_DELETION_CONTAINMENT=verified_noop/u);
  assert.match(repair, new RegExp(sha256(migration), "u"));
});

test("migration and repair verify the exact fail-closed database contract", () => {
  const replaceAt = migration.indexOf(
    "create or replace function public.delete_own_account()"
  );
  const revokeAt = migration.indexOf(
    "revoke all on function public.delete_own_account()"
  );
  assert.ok(replaceAt >= 0 && revokeAt > replaceAt);
  assert.match(migration, /errcode = '55000'/u);
  assert.match(migration, /account deletion is temporarily unavailable/u);
  assert.match(migration, /from public, anon, authenticated, service_role/u);
  assert.match(repair, /pronargs <> 0/u);
  assert.match(repair, /prorettype <> 'void'::regtype/u);
  assert.match(repair, /not function_contract\.prosecdef/u);
  assert.match(repair, /search_path=""/u);
  assert.match(repair, /aclexplode/u);
  assert.match(repair, /privilege\.grantee <> function_contract\.proowner/u);
  assert.match(repair, /perform public\.delete_own_account\(\)/u);
  assert.match(repair, /when sqlstate '55000'/u);
  assert.match(
    repair,
    /statements = pg_temp\.issue_878_containment_ledger_statements/u
  );
});

test("current clients expose only the authenticated deletion protocol", () => {
  assert.doesNotMatch(route, /status: 503/u);
  assert.match(route, /createAccountDeletionPost/u);
  assert.match(route, /requireFamilyWithActorFromRequest/u);
  assert.match(route, /requestAccountDeletion/u);
  assert.match(route, /mapDb\(\)/u);
  assert.match(schedule, /retryPendingAccountDeletions/u);

  for (const [name, surface] of [
    ["web", webSurface],
    ["mobile", mobileSurface],
  ]) {
    assert.doesNotMatch(surface, /Account deletion is paused/u, name);
    assert.match(surface, /permanently deletes/u, name);
    assert.match(surface, /confirms billing/u, name);
  }
  assert.match(webSurface, /Permanently delete this family/u);
  assert.match(mobileSurface, /handleDelete/u);
});
