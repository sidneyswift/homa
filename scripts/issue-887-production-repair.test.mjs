import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(
  resolve(repositoryRoot, ".github/workflows/issue-887-production-repair.yml"),
  "utf8",
);
const repair = readFileSync(
  resolve(repositoryRoot, "scripts/issue-887-production-repair.sql"),
  "utf8",
);
const harness = readFileSync(
  resolve(repositoryRoot, "scripts/issue-887-production-repair-postgres.mjs"),
  "utf8",
);
const originalMigration = readFileSync(
  resolve(
    repositoryRoot,
    "supabase/migrations/20260801110000_family_billing_subscriptions.sql",
  ),
);
const correctionMigration = readFileSync(
  resolve(
    repositoryRoot,
    "supabase/migrations/20260806093000_correct_billing_provider_product_identity.sql",
  ),
);
const workflowDocument = parse(workflow);

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

test("workflow is bound to production, Homa, and immutable reviewed inputs", () => {
  assert.equal(
    workflowDocument.jobs.apply.if,
    "github.repository == 'sidneyswift/homa' && github.repository_owner == 'sidneyswift' && github.ref == 'refs/heads/main' && github.ref_name == 'main' && github.event.repository.default_branch == 'main' && github.actor == 'sidneyswift' && github.triggering_actor == 'sidneyswift'",
  );
  assert.equal(workflowDocument.jobs.apply.environment, "production");
  assert.equal(
    workflowDocument.jobs.apply.steps[0].uses,
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  );
  assert.equal(
    workflowDocument.jobs.apply.steps[0].with.ref,
    "${{ github.sha }}",
  );
  assert.match(workflow, /confirmation[\s\S]*APPLY ISSUE 887/u);
  assert.match(workflow, /GITHUB_REPOSITORY.*sidneyswift\/homa/u);
  assert.match(workflow, /GITHUB_REPOSITORY_OWNER.*sidneyswift/u);
  assert.match(workflow, /GITHUB_REF.*refs\/heads\/main/u);
  assert.match(workflow, /GITHUB_REF_NAME.*main/u);
  assert.match(workflow, /repository\.default_branch.*main/u);
  assert.match(workflow, /git rev-parse HEAD/u);
  assert.match(workflow, /checked_out_sha.*GITHUB_SHA/u);
  assert.match(workflow, /git ls-remote --exit-code origin refs\/heads\/main/u);
  assert.match(workflow, /remote_main_sha.*GITHUB_SHA/u);
  assert.match(workflow, /kzplntcdtsvdowntvlza/u);
  assert.match(workflow, /cancel-in-progress: false/u);
  assert.doesNotMatch(workflow, /actions\/checkout@v\d/u);
  assert.match(workflow, new RegExp(sha256(originalMigration), "u"));
  assert.match(workflow, new RegExp(sha256(correctionMigration), "u"));
  assert.match(workflow, new RegExp(sha256(repair), "u"));
  assert.equal(
    workflow.match(/-f scripts\/issue-887-production-repair\.sql/g)?.length,
    2,
  );
  const firstApply = workflowDocument.jobs.apply.steps.find(
    (step) => step.name === "Apply and verify the exact repair in one fresh connection",
  )?.run;
  assert.match(firstApply, /ISSUE_887_REPAIR=repaired/u);
  assert.doesNotMatch(firstApply, /ISSUE_887_REPAIR=verified_noop/u);
  assert.match(firstApply, /repair_markers/u);
  const freshNoop = workflowDocument.jobs.apply.steps.find(
    (step) => step.name === "Prove a fresh connection is a verified no-op",
  )?.run;
  assert.match(freshNoop, /ISSUE_887_REPAIR=verified_noop/u);
  assert.match(freshNoop, /repair_markers/u);
  assert.doesNotMatch(workflow, /supabase\s+db\s+push/u);
});

test("executable migration pins the server ACL and correction changes only proven Stripe mirrors", () => {
  assert.equal(
    sha256(originalMigration),
    "5ed8f1bf0df5d940cd61de1427a7aa1adaa09582f2528ba7240b180fedaa7909",
  );
  const original = originalMigration.toString("utf8");
  assert.match(original, /from public, anon, authenticated/u);
  assert.match(original, /grant all privileges[\s\S]*service_role/u);
  assert.equal(
    sha256(correctionMigration),
    "07e432ffbf449427ac43a7f4433dae3f5b083cbb9b185edff75a774b310464c7",
  );
  const correction = correctionMigration.toString("utf8");
  assert.equal(correction.match(/^update /gmu)?.length, 1);
  assert.match(
    correction,
    /set provider_product_id = null[\s\S]*subscription\.provider = 'stripe'[\s\S]*subscription\.provider_product_id = family\.stripe_price_id/u,
  );
  assert.doesNotMatch(correction, /update public\.families/u);
  assert.doesNotMatch(correction, /subscription\.provider = 'apple'/u);
});

test("repair pins state, snapshot, ledger, and the complete database contract", () => {
  const includes = repair.match(/^\\ir .*$/gmu) ?? [];
  assert.deepEqual(includes, [
    "\\ir ../supabase/migrations/20260801110000_family_billing_subscriptions.sql",
    "\\ir ../supabase/migrations/20260806093000_correct_billing_provider_product_identity.sql",
  ]);
  assert.ok(repair.indexOf("begin;") < repair.indexOf(includes[0]));
  assert.ok(repair.indexOf(includes[1]) < repair.lastIndexOf("commit;"));
  assert.match(repair, /pg_advisory_xact_lock/u);
  assert.match(repair, /set local lock_timeout = '5s'/u);
  assert.match(repair, /set local statement_timeout = '120s'/u);
  assert.match(repair, /expected fresh, original-only, or complete state/u);
  assert.match(repair, /snapshot\.stripe_records <> 3/u);
  assert.match(repair, /snapshot\.distinct_stripe_subscription_ids <> 3/u);
  assert.match(repair, /snapshot\.apple_records <> 0/u);
  assert.match(repair, /snapshot\.invalid_plan_tiers <> 0/u);
  assert.match(repair, /snapshot\.null_statuses <> 0/u);
  assert.match(repair, /table_contract\.relowner <> expected_owner_oid/u);
  assert.match(repair, /table_contract\.relrowsecurity/u);
  assert.match(repair, /table_contract\.relforcerowsecurity/u);
  assert.match(repair, /table_contract\.relispartition/u);
  assert.match(repair, /actual_columns is distinct from array\[/u);
  assert.match(repair, /attribute\.attisdropped/u);
  assert.match(repair, /attribute\.attidentity <> ''/u);
  assert.match(repair, /attribute\.attgenerated <> ''/u);
  assert.match(repair, /\) <> 6/u);
  assert.match(repair, /\) <> 4/u);
  for (const constraintName of [
    "family_billing_subscriptions_pkey",
    "family_billing_subscriptions_family_id_fkey",
    "family_billing_subscriptions_provider_provider_subscription_key",
    "family_billing_subscriptions_provider_check",
    "family_billing_subscriptions_plan_tier_check",
    "family_billing_subscriptions_billing_period_check",
  ]) {
    assert.match(repair, new RegExp(constraintName, "u"));
  }
  assert.match(repair, /constraint_record\.conindid = primary_index_oid/u);
  assert.match(repair, /constraint_record\.conindid = unique_index_oid/u);
  for (const keyContract of ["'1'", "'3 4'", "'2 11'", "'3 5'"]) {
    assert.match(repair, new RegExp(`indkey::text <> ${keyContract}`, "u"));
  }
  assert.match(repair, /access_method_name <> 'btree'/u);
  assert.match(repair, /indcollation::oid\[\]/u);
  assert.match(repair, /operator_classes/u);
  assert.match(repair, /indnullsnotdistinct/u);
  assert.match(repair, /must have zero RLS policies/u);
  assert.match(repair, /pg_catalog\.acldefault\('r'/u);
  assert.match(repair, /service_role_oid/u);
  assert.match(repair, /privilege\.grantor <> expected_owner_oid/u);
  assert.match(repair, /privilege\.is_grantable/u);
  assert.match(repair, /attribute\.attacl is not null/u);
  assert.match(repair, /ACL differs from contract/u);
  assert.match(repair, /migration ledger evidence is absent or altered/u);
  assert.match(repair, /provider_product_id is not null/u);
  assert.match(repair, /billing_period is not null/u);
  assert.match(repair, /changed a legacy family compatibility column/u);
  assert.match(repair, /repair_transaction_timestamp/u);
  assert.match(repair, /changed more than proven Stripe product mirrors/u);
  assert.match(repair, /verified no-op changed an existing billing row/u);
  assert.match(repair, /fresh issue 887 backfill has an unexpected observation timestamp/u);
  assert.match(repair, /existing issue 887 backfill has an unexpected observation timestamp/u);
  assert.match(repair, /ISSUE_887_REPAIR=[\s\S]*verified_noop/u);
  assert.match(
    repair,
    /original_sha256=0215e6ea62dde4f9a64f2d62e08ab89121e8b06a838812d39fc2f660f0fe8198/u,
  );
  assert.match(repair, new RegExp(sha256(originalMigration), "u"));
  assert.match(repair, new RegExp(sha256(correctionMigration), "u"));
});

test("disposable harness covers exact metadata, isolation, collision, and rollback paths", () => {
  assert.match(harness, /applyRepair\(\);[\s\S]*verified_noop/u);
  assert.match(harness, /string_agg\([\s\S]*array_to_string\(statements/u);
  assert.match(harness, /runPsql\(\["-c", reconstructed\.rawStdout\]\)/u);
  assert.match(harness, /forwardCorrection/u);
  assert.match(harness, /duplicateSubscription/u);
  assert.match(harness, /nullStatus/u);
  assert.match(harness, /issue_887_family_index_collision/u);
  assert.match(harness, /issue_887_customer_index_collision/u);
  assert.match(harness, /issue_887_primary_index_collision/u);
  assert.match(harness, /issue_887_unique_index_collision/u);
  assert.match(harness, /issue_887_partition_parent/u);
  assert.match(harness, /family_billing_subscriptions_provider_customer_idx/u);
  assert.match(harness, /columns differ from the reviewed contract/u);
  assert.match(harness, /must have zero RLS policies/u);
  assert.match(harness, /table ACL grant option/u);
  assert.match(harness, /table ACL grantor/u);
  assert.match(harness, /column ACL/u);
  assert.match(harness, /dropped column/u);
  assert.match(harness, /generated column/u);
  assert.match(harness, /identity column/u);
  assert.match(harness, /service_maintain_count/u);
  assert.match(harness, /migration ledger evidence is absent or altered/u);
  assert.match(harness, /injected mid-migration failure/u);
  assert.match(harness, /mid-migration failure left billing relation or ledger residue/u);
  assert.equal(harness.match(/migration state is mixed/g)?.length, 8);
});
