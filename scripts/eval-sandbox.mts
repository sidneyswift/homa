/**
 * Disposable-Postgres sandbox for local eval runs (2026-07-25).
 *
 * Usage, from the repo root:
 *   pnpm eval:sandbox                              run every eval
 *   pnpm eval:sandbox evals/materials-studio       pass filters to eve eval
 *   pnpm eval:sandbox --exec node probe.mjs        run any command instead
 *
 * Boots a throwaway local PostgreSQL cluster (initdb + pg_ctl, the same
 * approach as scripts/child-progress-postgres-test.mts), applies the
 * Supabase-ambient shim below plus every migration in supabase/migrations,
 * seeds the Walker eval fixture family (the same rows the prompt-side
 * fixture renders; apps/web/lib/family-context-eval-fixture.ts), then runs
 * `eve eval` inside apps/web with HOMA_EVAL_DATABASE_URL pointing
 * at the sandbox. lib/map/db.ts honors that variable off Vercel, so
 * agent_tool_calls and every other direct-Postgres write lands in the
 * throwaway cluster and dies with it. The seeded family is what lets the
 * eve channel's auth walk stamp eval sessions as family-pinned
 * (evalFamilyFixtureAuth), so family-scoped tools resolve real rows here
 * instead of failing closed. It also provides a sandbox artifact
 * store (HOMA_EVAL_BLOB_DIR plus a loopback HTTP server at
 * HOMA_EVAL_BLOB_URL, lib/materials/eval-blob-store.ts), so the materials
 * pipeline runs end to end: generated images upload locally and the PDF
 * renderer can fetch them back. Without this wrapper, isolated eval runs
 * still cannot write to production (lib/eval-isolation.ts scrubs the
 * credentials); the wrapper is for full fidelity, DB and blob-backed tools
 * succeed against real schema and storage instead of failing closed.
 *
 * The cluster is removed on exit, success or failure. Nothing here needs
 * remote credentials.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createServer as createHttpServer, type Server } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evalFamilyFixtureSeedSql } from "../apps/web/lib/family-context-eval-fixture";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(REPO_ROOT, "supabase", "migrations");
const WEB_DIR = join(REPO_ROOT, "apps", "web");

const DB_NAME = "homa_eval";
const DB_USER = "homa_eval";
const STEP_TIMEOUT_MS = 120_000;

/**
 * What a Supabase project provides before its first migration runs, and
 * what this repo's migrations therefore assume without creating: the Data
 * API roles, the auth schema with auth.uid(), an extensions schema, a
 * minimal storage schema (migration #23 adds child-photo bucket policies),
 * and the project-side rls_auto_enable event-trigger helper that migration
 * #3 revokes. Validated 2026-07-25: with this shim, all migrations replay
 * cleanly on vanilla PostgreSQL 17.
 */
const SUPABASE_AMBIENT_SHIM = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
-- email_confirmed_at exists on the real Supabase auth.users and is what
-- the autoconfirm_new_user trigger (20260705202000_open_signup.sql)
-- touches on insert; the fixture-family seed below inserts a user, so
-- the shim must carry it.
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid
);
create function storage.foldername(name text) returns text[]
  language sql immutable
  as $$ select string_to_array(name, '/') $$;
create function public.rls_auto_enable() returns event_trigger
  language plpgsql
  as $$ begin end $$;
grant usage on schema extensions to anon, authenticated, service_role;
alter database ${DB_NAME} set search_path = public, extensions;
`;

/**
 * Filename order lies exactly once: 20260707120000_one_world_families.sql
 * alters child_reports, which 20260707190000_child_reports.sql creates.
 * Production applied them in dependency order; the replay does the same.
 */
const APPLY_BEFORE: ReadonlyArray<readonly [dependency: string, dependent: string]> = [
  ["20260707190000_child_reports.sql", "20260707120000_one_world_families.sql"],
];

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function run(
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<RunResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      env: { ...process.env, LC_ALL: "C", ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectPromise(new Error(`${command} ${args[0] ?? ""}: timed out`));
    }, options.timeoutMs ?? STEP_TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      rejectPromise(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function mustRun(
  label: string,
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<RunResult> {
  const result = await run(command, args, options);
  if (result.code !== 0) {
    throw new Error(`${label} failed (exit ${result.code}):\n${result.stderr || result.stdout}`);
  }
  return result;
}

/**
 * Same discovery order as the child-progress harness: an explicit
 * HOMA_POSTGRES_BIN, then Homebrew's versioned formulas newest first,
 * then whatever initdb is on PATH.
 */
async function discoverPostgresBin(): Promise<string> {
  const candidates: string[] = [];
  if (process.env.HOMA_POSTGRES_BIN) candidates.push(process.env.HOMA_POSTGRES_BIN);
  for (const version of ["17", "16", "15", "14"]) {
    const prefix = await run("brew", ["--prefix", `postgresql@${version}`], {
      timeoutMs: 15_000,
    }).catch(() => null);
    if (prefix && prefix.code === 0) candidates.push(join(prefix.stdout.trim(), "bin"));
  }
  const onPath = await run("which", ["initdb"], { timeoutMs: 15_000 }).catch(() => null);
  if (onPath && onPath.code === 0) candidates.push(dirname(onPath.stdout.trim()));

  for (const bin of candidates) {
    if (["initdb", "pg_ctl", "createdb", "psql"].every((tool) => existsSync(join(bin, tool)))) {
      return bin;
    }
  }
  throw new Error(
    "No usable PostgreSQL installation found. Install one (brew install postgresql@17 pgvector) " +
      "or point HOMA_POSTGRES_BIN at a bin directory containing initdb, pg_ctl, createdb, psql.",
  );
}

const BLOB_CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * Serves the sandbox blob directory over loopback so the PDF renderer
 * (headless Chromium inside create_printable) can fetch the images the
 * studio generated during the same run. GET only, path-prefix guarded,
 * throwaway by construction.
 */
function startBlobServer(blobDir: string): Promise<{ server: Server; url: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createHttpServer((request, response) => {
      void (async () => {
        try {
          const pathname = decodeURIComponent(
            new URL(request.url ?? "/", "http://sandbox").pathname,
          );
          const filePath = resolve(blobDir, pathname.replace(/^\/+/, ""));
          if (request.method !== "GET" || !filePath.startsWith(blobDir + "/")) {
            response.writeHead(404).end();
            return;
          }
          const body = await readFile(filePath);
          const extension = pathname.slice(pathname.lastIndexOf("."));
          response
            .writeHead(200, {
              "content-type": BLOB_CONTENT_TYPES[extension] ?? "application/octet-stream",
            })
            .end(body);
        } catch {
          response.writeHead(404).end();
        }
      })();
    });
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        rejectPromise(new Error("blob server: could not allocate a port"));
        return;
      }
      resolvePromise({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

function freePort(): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        rejectPromise(new Error("could not allocate a port"));
        return;
      }
      server.close(() => resolvePromise(address.port));
    });
  });
}

async function orderedMigrations(): Promise<string[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
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

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const execIndex = argv.indexOf("--exec");
  const childCommand =
    execIndex === -1
      ? { command: "pnpm", args: ["exec", "eve", "eval", ...argv] }
      : { command: argv[execIndex + 1], args: argv.slice(execIndex + 2) };
  if (execIndex !== -1 && !childCommand.command) {
    console.error("usage: pnpm eval:sandbox [eve-eval-args...] | pnpm eval:sandbox --exec <command...>");
    return 2;
  }

  const bin = await discoverPostgresBin();
  const root = await mkdtemp(join(tmpdir(), "homa-eval-sandbox-"));
  const dataDir = join(root, "data");
  const socketDir = join(root, "socket");
  const blobDir = join(root, "blob");
  let serverStarted = false;
  let blobServer: Server | undefined;

  const port = await freePort();
  const psqlArgs = (extra: string[]) => [
    "-h",
    "127.0.0.1",
    "-p",
    String(port),
    "-U",
    DB_USER,
    "-d",
    DB_NAME,
    "-v",
    "ON_ERROR_STOP=1",
    "--quiet",
    ...extra,
  ];

  try {
    console.error(`[eval-sandbox] booting disposable Postgres (${bin}) on 127.0.0.1:${port}`);
    await mkdir(socketDir, { recursive: true });
    await mustRun("initdb", join(bin, "initdb"), [
      "-A",
      "trust",
      "-U",
      DB_USER,
      "-D",
      dataDir,
      "--no-locale",
      "-E",
      "UTF8",
    ]);
    await mustRun("pg_ctl start", join(bin, "pg_ctl"), [
      "-D",
      dataDir,
      "-l",
      join(root, "postgres.log"),
      "-o",
      `-p ${port} -k ${socketDir} -c listen_addresses=127.0.0.1 ` +
        "-c lock_timeout=5s -c statement_timeout=30s " +
        "-c idle_in_transaction_session_timeout=30s",
      "start",
    ]);
    serverStarted = true;
    await mustRun("createdb", join(bin, "createdb"), [
      "-h",
      "127.0.0.1",
      "-p",
      String(port),
      "-U",
      DB_USER,
      DB_NAME,
    ]);

    const vector = await mustRun(
      "pgvector preflight",
      join(bin, "psql"),
      psqlArgs(["-tAc", "select count(*) from pg_available_extensions where name = 'vector'"]),
    );
    if (vector.stdout.trim() === "0") {
      throw new Error(
        "The vector extension is not available in this PostgreSQL installation. " +
          "Migration 20260709212000_semantic_recall.sql needs it: brew install pgvector.",
      );
    }

    await mustRun("supabase ambient shim", join(bin, "psql"), psqlArgs(["-c", SUPABASE_AMBIENT_SHIM]));

    const migrations = await orderedMigrations();
    console.error(`[eval-sandbox] applying ${migrations.length} migrations`);
    for (const file of migrations) {
      await mustRun(
        `migration ${file}`,
        join(bin, "psql"),
        psqlArgs(["--single-transaction", "-f", join(MIGRATIONS_DIR, file)]),
      );
    }

    // The Walker fixture family, so eval sessions stamped by
    // evalFamilyFixtureAuth resolve real family rows here. A multi-
    // statement -c string runs as one implicit transaction.
    console.error("[eval-sandbox] seeding the Walker eval fixture family");
    await mustRun(
      "eval family fixture seed",
      join(bin, "psql"),
      psqlArgs(["-c", evalFamilyFixtureSeedSql()]),
    );

    const databaseUrl = `postgres://${DB_USER}@127.0.0.1:${port}/${DB_NAME}`;
    await mkdir(blobDir, { recursive: true });
    const blob = await startBlobServer(blobDir);
    blobServer = blob.server;
    console.error(
      `[eval-sandbox] ready (blob store ${blob.url}); running ` +
        `${childCommand.command} ${childCommand.args.join(" ")} in apps/web`,
    );
    const exitCode = await new Promise<number>((resolvePromise, rejectPromise) => {
      const child = spawn(childCommand.command, childCommand.args, {
        cwd: WEB_DIR,
        env: {
          ...process.env,
          HOMA_EVAL_DATABASE_URL: databaseUrl,
          HOMA_EVAL_BLOB_DIR: blobDir,
          HOMA_EVAL_BLOB_URL: blob.url,
        },
        stdio: "inherit",
      });
      const forward = (signal: NodeJS.Signals) => () => child.kill(signal);
      const onInt = forward("SIGINT");
      const onTerm = forward("SIGTERM");
      process.on("SIGINT", onInt);
      process.on("SIGTERM", onTerm);
      child.on("error", rejectPromise);
      child.on("close", (code) => {
        process.off("SIGINT", onInt);
        process.off("SIGTERM", onTerm);
        resolvePromise(code ?? 1);
      });
    });
    return exitCode;
  } finally {
    blobServer?.close();
    if (serverStarted) {
      await run(join(bin, "pg_ctl"), ["-D", dataDir, "-m", "fast", "stop"], {
        timeoutMs: 30_000,
      }).catch(() => undefined);
    }
    await rm(root, { recursive: true, force: true }).catch(() => undefined);
    console.error("[eval-sandbox] cluster removed");
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`[eval-sandbox] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
