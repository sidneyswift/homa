/**
 * The order production applied supabase/migrations in, for every tool that
 * replays them onto an empty database: the eval sandbox
 * (scripts/eval-sandbox.mts) and the local stack (scripts/local-stack.mts).
 *
 * Filename order lies exactly once: 20260707120000_one_world_families.sql
 * alters child_reports, which 20260707190000_child_reports.sql creates.
 * Production applied them in dependency order; a replay does the same.
 */

import { readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MIGRATIONS_DIR = join(
  resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  "supabase",
  "migrations",
);

export const APPLY_BEFORE: ReadonlyArray<
  readonly [dependency: string, dependent: string]
> = [
  ["20260707190000_child_reports.sql", "20260707120000_one_world_families.sql"],
];

/** Sorts migration filenames into replay order. Pure, so it is testable. */
export function orderMigrationFiles(fileNames: readonly string[]): string[] {
  const files = fileNames.filter((f) => f.endsWith(".sql")).sort();
  for (const [dependency, dependent] of APPLY_BEFORE) {
    const from = files.indexOf(dependency);
    const to = files.indexOf(dependent);
    if (from === -1 || to === -1) {
      throw new Error(
        `migration ordering override references a missing file: ${dependency} / ${dependent}`,
      );
    }
    if (from > to) {
      files.splice(from, 1);
      files.splice(to, 0, dependency);
    }
  }
  return files;
}

export async function orderedMigrations(): Promise<string[]> {
  return orderMigrationFiles(await readdir(MIGRATIONS_DIR));
}
