import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATION_FILENAME = /^(?<version>\d{14})_(?<name>[a-z0-9][a-z0-9_]*)\.sql$/u;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function md5(contents) {
  return createHash("md5").update(contents).digest("hex");
}

export function canonicalMigrationStatements(path) {
  return readFileSync(path, "utf8")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export function canonicalMigrationContract(root = repositoryRoot) {
  const migrationsDirectory = join(root, "supabase", "migrations");
  return readdirSync(migrationsDirectory)
    .sort()
    .map((filename) => {
      const match = MIGRATION_FILENAME.exec(filename);
      if (!match) return null;
      const path = join(migrationsDirectory, filename);
      return {
        filename,
        name: match.groups.name,
        sourceSha256: sha256(readFileSync(path)),
        statementCount: canonicalMigrationStatements(path).length,
        statementMd5: md5(canonicalMigrationStatements(path).join("\x1e")),
        version: match.groups.version,
      };
    })
    .filter(Boolean);
}

// This is deliberately small. These relations sit directly behind payment
// access and a parent's saved month-plan receipt, so a missing table is a
// customer-facing failure even when application code compiles cleanly.
export const RELEASE_CRITICAL_RELATIONS = [
  {
    columns: [
      "id",
      "family_id",
      "provider",
      "provider_subscription_id",
      "provider_customer_id",
      "provider_product_id",
      "plan_tier",
      "billing_period",
      "status",
      "current_period_end",
      "last_observed_at",
      "created_at",
      "updated_at",
    ],
    constraints: [
      { name: "family_billing_subscriptions_pkey", type: "p" },
      { name: "family_billing_subscriptions_provider_provider_subscription_key", type: "u" },
    ],
    indexes: [
      "family_billing_subscriptions_family_observed_idx",
      "family_billing_subscriptions_provider_customer_idx",
    ],
    relation: "public.family_billing_subscriptions",
    sourceMigrations: [
      "20260801110000_family_billing_subscriptions.sql",
      "20260806092000_harden_family_billing_subscriptions_acl.sql",
      "20260806093000_correct_billing_provider_product_identity.sql",
    ],
  },
  {
    columns: [
      "draft_id",
      "family_id",
      "month_start",
      "final_revision",
      "revision_history",
      "approved_at",
    ],
    constraints: [{ name: "month_plan_approvals_pkey", type: "p" }],
    indexes: ["month_plan_approvals_family_month_idx"],
    relation: "public.month_plan_approvals",
    sourceMigrations: [
      "20260801201500_month_plan_approvals.sql",
      "20260806040000_month_plan_approvals_write_boundary.sql",
    ],
  },
];

export const RELEASE_CRITICAL_FUNCTIONS = [
  {
    identity: "public.is_family_member(uuid)",
    sourceMigrations: ["20260704033742_tenancy_v0.sql"],
  },
];

export function productionSchemaContract(root = repositoryRoot) {
  const migrations = canonicalMigrationContract(root);
  const knownMigrationFiles = new Set(migrations.map(({ filename }) => filename));

  for (const relation of RELEASE_CRITICAL_RELATIONS) {
    for (const sourceMigration of relation.sourceMigrations) {
      if (!knownMigrationFiles.has(sourceMigration)) {
        throw new Error(
          `The release-critical relation ${relation.relation} references missing migration ${sourceMigration}.`,
        );
      }
    }
  }
  for (const fn of RELEASE_CRITICAL_FUNCTIONS) {
    for (const sourceMigration of fn.sourceMigrations) {
      if (!knownMigrationFiles.has(sourceMigration)) {
        throw new Error(
          `The release-critical function ${fn.identity} references missing migration ${sourceMigration}.`,
        );
      }
    }
  }

  return {
    functions: RELEASE_CRITICAL_FUNCTIONS,
    migrations,
    relations: RELEASE_CRITICAL_RELATIONS,
    schemaVersion: 1,
  };
}
