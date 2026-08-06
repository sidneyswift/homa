#!/usr/bin/env node

import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATION_FILENAME = /^(\d{14})_[a-z0-9][a-z0-9_]*\.sql$/u;

export function migrationVersionCollisions(filenames) {
  const byVersion = new Map();

  for (const filename of filenames) {
    const match = MIGRATION_FILENAME.exec(filename);
    if (!match) continue;

    const version = match[1];
    const names = byVersion.get(version) ?? [];
    names.push(filename);
    byVersion.set(version, names);
  }

  return [...byVersion.entries()]
    .filter(([, names]) => names.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));
}

export function checkMigrationVersions(migrationsDirectory) {
  const filenames = readdirSync(migrationsDirectory)
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
  const invalid = filenames.filter((filename) => !MIGRATION_FILENAME.test(filename));
  const collisions = migrationVersionCollisions(filenames);

  return { collisions, invalid, migrationCount: filenames.length };
}

function run() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const migrationsDirectory = join(dirname(scriptDirectory), "supabase", "migrations");
  const result = checkMigrationVersions(migrationsDirectory);

  if (result.invalid.length > 0) {
    console.error("Migration filenames must use <14-digit-version>_<snake_case_name>.sql:");
    for (const filename of result.invalid) console.error(`- ${filename}`);
  }

  if (result.collisions.length > 0) {
    console.error("Duplicate Supabase migration versions:");
    for (const [version, filenames] of result.collisions) {
      console.error(`- ${version}: ${filenames.join(", ")}`);
    }
  }

  if (result.invalid.length > 0 || result.collisions.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log(`${result.migrationCount} Supabase migrations have unique versions.`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) run();
