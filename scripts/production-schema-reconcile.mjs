#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { productionSchemaContract } from "./production-schema-contract.mjs";

const DEFAULT_DATABASE_URL_ENV = "HOMA_SCHEMA_DATABASE_URL";

function sqlTextArray(values) {
  return `array[${values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ")}]::text[]`;
}

export function buildReadOnlyProbe(contract) {
  const relations = contract.relations.map(({ relation }) => relation);
  const functions = contract.functions.map(({ identity }) => identity);
  return `
    begin read only;
    set local statement_timeout = '15s';
    select json_build_object(
      'relations', coalesce((
        select json_agg(json_build_object(
          'relation', format('%I.%I', namespace.nspname, class.relname),
          'rls', class.relrowsecurity
        ) order by namespace.nspname, class.relname)
        from pg_catalog.pg_class class
        join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
        where format('%I.%I', namespace.nspname, class.relname) = any(${sqlTextArray(relations)})
          and class.relkind in ('r', 'p')
      ), '[]'::json),
      'columns', coalesce((
        select json_agg(json_build_object(
          'column', attribute.attname,
          'relation', format('%I.%I', namespace.nspname, class.relname)
        ) order by namespace.nspname, class.relname, attribute.attnum)
        from pg_catalog.pg_attribute attribute
        join pg_catalog.pg_class class on class.oid = attribute.attrelid
        join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
        where format('%I.%I', namespace.nspname, class.relname) = any(${sqlTextArray(relations)})
          and attribute.attnum > 0
          and not attribute.attisdropped
      ), '[]'::json),
      'constraints', coalesce((
        select json_agg(json_build_object(
          'name', constraint_record.conname,
          'relation', format('%I.%I', namespace.nspname, class.relname),
          'type', constraint_record.contype
        ) order by namespace.nspname, class.relname, constraint_record.conname)
        from pg_catalog.pg_constraint constraint_record
        join pg_catalog.pg_class class on class.oid = constraint_record.conrelid
        join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
        where format('%I.%I', namespace.nspname, class.relname) = any(${sqlTextArray(relations)})
      ), '[]'::json),
      'indexes', coalesce((
        select json_agg(json_build_object(
          'name', index_class.relname,
          'relation', format('%I.%I', namespace.nspname, class.relname)
        ) order by namespace.nspname, class.relname, index_class.relname)
        from pg_catalog.pg_index index_record
        join pg_catalog.pg_class class on class.oid = index_record.indrelid
        join pg_catalog.pg_class index_class on index_class.oid = index_record.indexrelid
        join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
        where format('%I.%I', namespace.nspname, class.relname) = any(${sqlTextArray(relations)})
      ), '[]'::json),
      'functions', coalesce((
        select json_agg(json_build_object(
          'identity', expected.identity
        ) order by expected.identity)
        from unnest(${sqlTextArray(functions)}) as expected(identity)
        where pg_catalog.to_regprocedure(expected.identity) is not null
      ), '[]'::json),
      'triggers', coalesce((
        select json_agg(json_build_object(
          'name', trigger_record.tgname,
          'relation', format('%I.%I', namespace.nspname, class.relname)
        ) order by namespace.nspname, class.relname, trigger_record.tgname)
        from pg_catalog.pg_trigger trigger_record
        join pg_catalog.pg_class class on class.oid = trigger_record.tgrelid
        join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
        where format('%I.%I', namespace.nspname, class.relname) = any(${sqlTextArray(relations)})
          and not trigger_record.tgisinternal
      ), '[]'::json),
      'migrations', coalesce((
        select json_agg(json_build_object(
          'name', migration.name,
          'statementMd5', md5(array_to_string(migration.statements, chr(30))),
          'statementCount', cardinality(migration.statements),
          'version', migration.version
        ) order by migration.version)
        from supabase_migrations.schema_migrations migration
      ), '[]'::json)
    )::text;
    rollback;
  `;
}

function entriesBy(values, key) {
  return new Map(values.map((value) => [value[key], value]));
}

export function validateProductionSchema(contract, snapshot) {
  const errors = [];
  const actualRelations = entriesBy(snapshot.relations, "relation");
  const actualColumns = new Map();
  const actualConstraints = new Map();
  const actualIndexes = new Map();
  const actualTriggers = new Map();

  for (const column of snapshot.columns) {
    const columns = actualColumns.get(column.relation) ?? new Set();
    columns.add(column.column);
    actualColumns.set(column.relation, columns);
  }
  for (const constraint of snapshot.constraints) {
    const constraints = actualConstraints.get(constraint.relation) ?? new Map();
    constraints.set(constraint.name, constraint.type);
    actualConstraints.set(constraint.relation, constraints);
  }
  for (const index of snapshot.indexes) {
    const indexes = actualIndexes.get(index.relation) ?? new Set();
    indexes.add(index.name);
    actualIndexes.set(index.relation, indexes);
  }
  for (const trigger of snapshot.triggers) {
    const triggers = actualTriggers.get(trigger.relation) ?? new Set();
    triggers.add(trigger.name);
    actualTriggers.set(trigger.relation, triggers);
  }

  for (const expected of contract.relations) {
    const actual = actualRelations.get(expected.relation);
    if (!actual) {
      errors.push(`missing relation ${expected.relation}`);
      continue;
    }
    if (!actual.rls) errors.push(`row level security is disabled on ${expected.relation}`);

    const columns = actualColumns.get(expected.relation) ?? new Set();
    for (const column of expected.columns) {
      if (!columns.has(column)) errors.push(`missing column ${expected.relation}.${column}`);
    }

    const constraints = actualConstraints.get(expected.relation) ?? new Map();
    for (const expectedConstraint of expected.constraints) {
      if (constraints.get(expectedConstraint.name) !== expectedConstraint.type) {
        errors.push(`missing or altered constraint ${expected.relation}.${expectedConstraint.name}`);
      }
    }

    const indexes = actualIndexes.get(expected.relation) ?? new Set();
    for (const index of expected.indexes) {
      if (!indexes.has(index)) errors.push(`missing index ${expected.relation}.${index}`);
    }

    const triggers = actualTriggers.get(expected.relation) ?? new Set();
    if (triggers.size > 0) {
      errors.push(`unexpected trigger on ${expected.relation}: ${[...triggers].sort().join(", ")}`);
    }
  }

  const functions = new Set(snapshot.functions.map(({ identity }) => identity));
  for (const expected of contract.functions) {
    if (!functions.has(expected.identity)) errors.push(`missing function ${expected.identity}`);
  }

  const requiredMigrations = entriesBy(contract.migrations, "version");
  const seenVersions = new Set();
  for (const migration of snapshot.migrations) {
    if (seenVersions.has(migration.version)) {
      errors.push(`duplicate production migration version ${migration.version}`);
      continue;
    }
    seenVersions.add(migration.version);
    const expected = requiredMigrations.get(migration.version);
    if (!expected) {
      errors.push(`unexpected production migration ${migration.version}`);
    } else if (expected.name !== migration.name) {
      errors.push(`altered production migration ${migration.version}`);
    } else if (
      !Number.isInteger(migration.statementCount) ||
      (expected.statementCount === undefined
        ? migration.statementCount < 1
        : migration.statementCount !== expected.statementCount)
    ) {
      errors.push(`partial production migration ${migration.version}`);
    } else if (
      expected.statementMd5 &&
      expected.statementMd5 !== migration.statementMd5
    ) {
      errors.push(`altered production migration ${migration.version}`);
    }
  }
  for (const expected of contract.migrations) {
    if (!seenVersions.has(expected.version)) {
      errors.push(`missing production migration ${expected.version}`);
    }
  }

  return errors.sort();
}

export function probeProductionSchema({ databaseUrl, psql = "psql", contract = productionSchemaContract() }) {
  const result = spawnSync(
    psql,
    ["--dbname", databaseUrl, "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1"],
    { encoding: "utf8", input: buildReadOnlyProbe(contract), timeout: 30_000 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const diagnostic = result.stderr
      .replaceAll(databaseUrl, "[masked database URL]")
      .replaceAll(/postgres(?:ql)?:\/\/[^\s]+/gu, "[masked database URL]")
      .trim();
    throw new Error(
      diagnostic
        ? `The read-only production schema probe could not complete: ${diagnostic}`
        : "The read-only production schema probe could not complete.",
    );
  }
  const output = result.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const encodedSnapshot = output.find((line) => line.includes("{"));
  if (!encodedSnapshot) {
    throw new Error(
      output.length > 0
        ? `The read-only production schema probe returned no schema snapshot: ${output.join(" ")}`
        : "The read-only production schema probe returned no schema snapshot.",
    );
  }
  return JSON.parse(encodedSnapshot.slice(encodedSnapshot.indexOf("{")));
}

function databaseUrlEnvironment() {
  const argument = process.argv.find((value) => value.startsWith("--database-url-env="));
  return argument?.slice("--database-url-env=".length) || DEFAULT_DATABASE_URL_ENV;
}

function run() {
  const environmentName = databaseUrlEnvironment();
  const databaseUrl = process.env[environmentName];
  if (!databaseUrl) {
    throw new Error(`Missing required database URL environment variable ${environmentName}.`);
  }
  const contract = productionSchemaContract();
  const snapshot = probeProductionSchema({ databaseUrl, contract });
  const errors = validateProductionSchema(contract, snapshot);
  if (errors.length > 0) {
    console.error("Production schema reconciliation failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Production schema reconciliation passed for ${contract.migrations.length} migrations and ${contract.relations.length} release-critical relations.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) run();
