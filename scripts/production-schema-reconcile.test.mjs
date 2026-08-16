import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReadOnlyProbe,
  validateProductionMigrationLedger,
  validateProductionSchema,
} from "./production-schema-reconcile.mjs";
import { productionSchemaContract } from "./production-schema-contract.mjs";

const contract = {
  functions: [{ identity: "public.is_family_member(uuid)" }],
  migrations: [
    { name: "family_billing_subscriptions", version: "20260801110000" },
    { name: "month_plan_approvals", version: "20260801201500" },
  ],
  relations: [
    {
      columns: ["id", "family_id"],
      constraints: [{ name: "billing_pkey", type: "p" }],
      indexes: ["billing_family_idx"],
      relation: "public.family_billing_subscriptions",
    },
  ],
};

function healthySnapshot() {
  return {
    columns: [
      { column: "id", relation: "public.family_billing_subscriptions" },
      { column: "family_id", relation: "public.family_billing_subscriptions" },
    ],
    constraints: [{ name: "billing_pkey", relation: "public.family_billing_subscriptions", type: "p" }],
    functions: [{ identity: "public.is_family_member(uuid)" }],
    indexes: [{ name: "billing_family_idx", relation: "public.family_billing_subscriptions" }],
    migrations: [
      { name: "family_billing_subscriptions", statementCount: 1, version: "20260801110000" },
      { name: "month_plan_approvals", statementCount: 1, version: "20260801201500" },
    ],
    relations: [{ relation: "public.family_billing_subscriptions", rls: true }],
    triggers: [],
  };
}

test("read-only probe reads catalog and ledger state without application rows", () => {
  const probe = buildReadOnlyProbe(contract);
  assert.match(probe, /^\s*begin read only;/u);
  assert.match(probe, /pg_catalog\.pg_class/u);
  assert.match(probe, /pg_catalog\.pg_constraint/u);
  assert.match(probe, /supabase_migrations\.schema_migrations/u);
  assert.doesNotMatch(probe, /\b(insert|update|delete|alter|drop|create)\b/iu);
});

test("release-critical contract names canonical migration sources", () => {
  const productionContract = productionSchemaContract();
  assert.ok(productionContract.migrations.length > 100);
  assert.deepEqual(
    productionContract.relations.map(({ relation }) => relation),
    ["public.family_billing_subscriptions", "public.month_plan_approvals"],
  );
  assert.deepEqual(
    productionContract.functions.map(({ identity }) => identity),
    ["public.is_family_member(uuid)"],
  );
});

test("healthy release-critical schema passes", () => {
  assert.deepEqual(validateProductionSchema(contract, healthySnapshot()), []);
});

test("reports a missing release-critical relation independently of ledger history", () => {
  const snapshot = healthySnapshot();
  snapshot.relations = [];
  snapshot.migrations = [{ name: "family_billing_subscriptions", statementCount: 0, version: "20260801110000" }];
  assert.deepEqual(validateProductionSchema(contract, snapshot), ["missing relation public.family_billing_subscriptions"]);
  assert.deepEqual(validateProductionMigrationLedger(contract, snapshot), [
    "missing production migration 20260801201500",
    "partial production migration 20260801110000",
  ]);
});

test("reports a colliding migration version and altered production ledger name", () => {
  const snapshot = healthySnapshot();
  snapshot.migrations = [
    { name: "wrong_name", statementCount: 1, version: "20260801110000" },
    { name: "family_billing_subscriptions", statementCount: 1, version: "20260801110000" },
    { name: "month_plan_approvals", statementCount: 1, version: "20260801201500" },
  ];
  assert.deepEqual(validateProductionSchema(contract, snapshot), []);
  assert.deepEqual(validateProductionMigrationLedger(contract, snapshot), [
    "altered production migration 20260801110000",
    "duplicate production migration version 20260801110000",
  ]);
});

test("reports an altered production migration statement list", () => {
  const strictContract = {
    ...contract,
    migrations: [{ ...contract.migrations[0], statementMd5: "canonical" }],
  };
  const snapshot = healthySnapshot();
  snapshot.migrations = [{
    name: "family_billing_subscriptions",
    statementCount: 1,
    statementMd5: "tampered",
    version: "20260801110000",
  }];
  assert.deepEqual(validateProductionSchema(strictContract, snapshot), []);
  assert.deepEqual(validateProductionMigrationLedger(strictContract, snapshot), [
    "altered production migration 20260801110000",
  ]);
});
