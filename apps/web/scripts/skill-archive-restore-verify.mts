/**
 * Restores a skill-archive export (skill-archive-export.mts) into a
 * disposable local PostgreSQL cluster against the real migration files, and
 * proves row counts and content hashes match the manifest before any code
 * cutover
 * (docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md
 * §5.1, §10 step 1: "stop until counts and hashes match").
 *
 * The cluster is created fresh under /tmp, migrated with the actual
 * supabase/migrations files (not a hand-rolled schema), loaded from the
 * archive's JSONL, re-serialized with the same canonical format the
 * exporter uses, and torn down. Nothing here talks to production.
 *
 * Usage (run from the repo root):
 *   pnpm --filter web exec tsx scripts/skill-archive-restore-verify.mts \
 *     [--dir <export dir>]
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import postgres from "postgres";

import {
  SKILL_ARCHIVE_TABLES,
  parseJsonlRows,
  serializeRowsAsJsonl,
  type SkillArchiveManifest,
  type SkillArchiveTable,
} from "./skill-archive-format.mts";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const database = "homa_skill_archive_restore_verify";
const PROCESS_TIMEOUT_MS = 60_000;

const MIGRATION_PATHS: Record<SkillArchiveTable, string> = {
  family_skills: path.join(repoRoot, "supabase/migrations/20260706124706_family_skills.sql"),
  skill_bank: path.join(repoRoot, "supabase/migrations/20260706131116_skill_bank.sql"),
};

// The two migrations above only need families(id) to exist for
// family_skills' foreign key; everything else in a real Supabase project
// (auth.users, RLS helper functions) is irrelevant to a row-count-and-hash
// check, so this stub stays minimal on purpose.
const prerequisiteSql = `
  create extension if not exists pgcrypto;
  create role authenticated nologin;
  create table public.families (id uuid primary key);
  create function public.is_family_member(target_family_id uuid)
  returns boolean language sql stable as $$ select true $$;
`;

function parseDir(argv: string[]): string {
  const flagIndex = argv.indexOf("--dir");
  if (flagIndex === -1) {
    return path.join(repoRoot, "supabase", ".temp", "skill-archive-export");
  }
  const value = argv[flagIndex + 1];
  if (!value) throw new Error("--dir requires a path");
  return path.resolve(value);
}

async function executableExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function discoverPostgresBin(): Promise<string> {
  const candidates: string[] = [];
  if (process.env.HOMA_POSTGRES_BIN) candidates.push(process.env.HOMA_POSTGRES_BIN);
  for (const formula of ["postgresql@17", "postgresql@16", "postgresql@15", "postgresql@14"]) {
    try {
      const { stdout } = await execFileAsync("brew", ["--prefix", formula]);
      candidates.push(path.join(stdout.trim(), "bin"));
    } catch {
      // Homebrew or this formula is unavailable.
    }
  }
  try {
    const { stdout } = await execFileAsync("which", ["postgres"]);
    candidates.push(path.dirname(stdout.trim()));
  } catch {
    // PATH has no postgres binary.
  }
  for (const candidate of candidates) {
    if (
      (await executableExists(path.join(candidate, "postgres"))) &&
      (await executableExists(path.join(candidate, "initdb"))) &&
      (await executableExists(path.join(candidate, "pg_ctl"))) &&
      (await executableExists(path.join(candidate, "psql"))) &&
      (await executableExists(path.join(candidate, "createdb")))
    ) {
      return candidate;
    }
  }
  throw new Error("No usable local PostgreSQL installation found. Set HOMA_POSTGRES_BIN to its bin directory.");
}

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  if (address === null || typeof address === "string") {
    throw new Error("Could not reserve a local PostgreSQL port");
  }
  return address.port;
}

async function run(executable: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  await execFileAsync(executable, args, {
    cwd: repoRoot,
    env,
    maxBuffer: 10 * 1024 * 1024,
    timeout: PROCESS_TIMEOUT_MS,
  });
}

async function runForExitCode(
  executable: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<number> {
  try {
    await run(executable, args, env);
    return 0;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "number") {
      return error.code;
    }
    throw error;
  }
}

interface ClusterHandle {
  psql(sqlText: string): Promise<void>;
  psqlFile(filePath: string): Promise<void>;
  query(sqlText: string): Promise<Record<string, unknown>[]>;
}

async function withDisposableCluster<T>(
  body: (cluster: ClusterHandle) => Promise<T>,
): Promise<T> {
  const postgresBin = await discoverPostgresBin();
  const username = process.env.USER ?? "postgres";
  const root = await mkdtemp(path.join("/tmp", "homa-skill-archive-verify-"));
  const dataDir = path.join(root, "data");
  const socketDir = path.join(root, "socket");
  const logPath = path.join(root, "postgres.log");
  const env = { ...process.env, LC_ALL: "C" };
  let initialized = false;
  let started = false;

  try {
    const port = await availablePort();
    await mkdir(socketDir);
    await run(
      path.join(postgresBin, "initdb"),
      ["-A", "trust", "-U", username, "-D", dataDir, "--no-locale", "-E", "UTF8"],
      env,
    );
    initialized = true;
    await run(
      path.join(postgresBin, "pg_ctl"),
      [
        "-D",
        dataDir,
        "-l",
        logPath,
        "-o",
        [`-k ${socketDir}`, `-p ${port}`].join(" "),
        "-w",
        "start",
      ],
      env,
    );
    started = true;
    await run(
      path.join(postgresBin, "createdb"),
      ["-h", socketDir, "-p", String(port), "-U", username, database],
      env,
    );

    const psql = (args: string[]) =>
      run(
        path.join(postgresBin, "psql"),
        ["-v", "ON_ERROR_STOP=1", "-h", socketDir, "-p", String(port), "-U", username, "-d", database, ...args],
        env,
      );

    const sql = postgres({
      host: socketDir,
      port,
      database,
      username,
      prepare: false,
      max: 1,
    });

    try {
      const result = await body({
        psql: (sqlText: string) => psql(["-c", sqlText]),
        psqlFile: (filePath: string) => psql(["--single-transaction", "-f", filePath]),
        query: async (sqlText: string) => [...(await sql.unsafe(sqlText))],
      });
      return result;
    } finally {
      await sql.end({ timeout: 1 });
    }
  } finally {
    if (initialized) {
      const statusBeforeCleanup = await runForExitCode(path.join(postgresBin, "pg_ctl"), ["-D", dataDir, "status"], env);
      if (statusBeforeCleanup === 0) {
        await run(path.join(postgresBin, "pg_ctl"), ["-D", dataDir, "-m", "fast", "-w", "stop"], env);
      } else if (started) {
        assert.equal(statusBeforeCleanup, 3);
      }
    }
    await rm(root, { recursive: true, force: true });
  }
}

async function loadManifest(dir: string): Promise<SkillArchiveManifest> {
  const raw = await readFile(path.join(dir, "manifest.json"), "utf8");
  return JSON.parse(raw) as SkillArchiveManifest;
}

function quoteLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return `ARRAY[${value.map((entry) => quoteLiteral(entry)).join(", ")}]::text[]`;
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function main(): Promise<void> {
  const dir = parseDir(process.argv.slice(2));
  const manifest = await loadManifest(dir);
  const failures: string[] = [];

  await withDisposableCluster(async (cluster) => {
    await cluster.psql(prerequisiteSql);
    // Migration filenames sort family_skills before skill_bank; run them in
    // that order since family_skills references public.families only, and
    // skill_bank has no foreign keys, so order does not matter functionally
    // but matches the real deploy sequence.
    await cluster.psqlFile(MIGRATION_PATHS.family_skills);
    await cluster.psqlFile(MIGRATION_PATHS.skill_bank);

    for (const table of SKILL_ARCHIVE_TABLES) {
      const entry = manifest.tables[table];
      const jsonlPath = path.join(dir, entry.fileName);
      const exportedContent = await readFile(jsonlPath, "utf8");
      const exportedRows = parseJsonlRows(exportedContent);

      if (exportedRows.length > 0) {
        const columns = entry.columns;
        const valuesSql = exportedRows
          .map((row) => `(${columns.map((column) => quoteLiteral(row[column])).join(", ")})`)
          .join(",\n  ");
        const columnList = columns.map((column) => `"${column}"`).join(", ");
        await cluster.psql(`insert into public.${table} (${columnList}) values\n  ${valuesSql};`);
      }

      const restoredRows = await cluster.query(
        `select ${entry.columns.map((column) => `"${column}"`).join(", ")} from public.${table} order by "${entry.columns.includes("id") ? "id" : entry.columns[0]}"`,
      );

      const label = `public.${table}`;
      if (restoredRows.length !== entry.rowCount) {
        failures.push(`${label}: row count ${restoredRows.length} != manifest ${entry.rowCount}`);
        continue;
      }

      const restoredContent = serializeRowsAsJsonl(entry.columns, restoredRows);
      if (restoredContent !== exportedContent) {
        failures.push(`${label}: restored content does not byte-match the exported JSONL`);
        continue;
      }

      console.log(`PASS  ${label}: ${restoredRows.length} row(s), content matches export`);
    }
  });

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) FAILED:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log("\nAll skill-archive restore/verify checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
