/**
 * The local stack: a private Supabase on this Mac, the web app and Metro
 * pointed at it, and three resettable test parents. Nothing here can
 * reach production. Runbook: tooling/local-stack/README.md.
 *
 * Usage, from the repo root:
 *   pnpm dev:stack                  start Supabase, apply new migrations, seed on first run
 *   pnpm dev:stack web              run the web app against it (http://localhost:3000)
 *   pnpm dev:stack mobile           run Metro against it (simulator dev build)
 *   pnpm dev:stack persona <id>     rebuild new | onboarding | established | all
 *   pnpm dev:stack open <id>        rebuild, then sign the booted simulator in as it
 *   pnpm dev:stack status           print URLs and personas
 *   pnpm dev:stack reset            wipe the database, replay migrations, reseed
 *   pnpm dev:stack down             stop the containers (data is kept)
 *
 * `up` and `reset` take --no-studio to skip Studio, the largest optional
 * download, on a slow connection.
 *
 * Needs Docker (OrbStack or Docker Desktop) and the Supabase CLI.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

import {
  isLocalPersonaId,
  LOCAL_PERSONA_IDS,
  LOCAL_PERSONA_PASSWORD,
  LOCAL_PERSONAS,
  type LocalPersonaId,
} from "../apps/mobile/src/features/dev/local-personas";
import { isLocalBackendUrl } from "../apps/mobile/src/lib/local-backend";

import {
  dotenvKeys,
  localMobileEnvironment,
  localWebEnvironment,
  type LocalStackEndpoints,
} from "./local-stack-env.mts";
import { seedPersona, type AuthAdmin } from "./local-stack-personas.mts";
import { migrate } from "./local-stack-migrate.mts";
import { startBlobServer } from "./loopback-blob-server.mts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKDIR = join(REPO_ROOT, "tooling", "local-stack");
const BLOB_DIR = join(WORKDIR, ".data", "blob");
/** Pinned so artifact URLs stored in the database survive a restart. */
const BLOB_PORT = 54330;
const WEB_ORIGIN = "http://localhost:3000";
const METRO_PORT = 8081;

interface StackStatus extends LocalStackEndpoints {
  serviceRoleKey: string;
  studioUrl: string | null;
  mailUrl: string | null;
}

function log(message: string): void {
  console.error(`[local-stack] ${message}`);
}

function run(
  command: string,
  args: string[],
  options: { capture?: boolean; env?: Record<string, string>; cwd?: string } = {},
): Promise<{ code: number; stdout: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? REPO_ROOT,
      env: { ...process.env, ...options.env },
      stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    });
    let stdout = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => resolvePromise({ code: code ?? 1, stdout }));
  });
}

async function supabase(args: string[], capture = false): Promise<string> {
  const result = await run("supabase", [...args, "--workdir", WORKDIR], { capture });
  if (result.code !== 0) {
    throw new Error(`supabase ${args.join(" ")} exited ${result.code}`);
  }
  return result.stdout;
}

async function preflight(): Promise<void> {
  const cli = await run("supabase", ["--version"], { capture: true }).catch(() => null);
  if (!cli || cli.code !== 0) {
    throw new Error("The Supabase CLI is missing: brew install supabase/tap/supabase");
  }
  const docker = await run("docker", ["info", "--format", "{{.ServerVersion}}"], {
    capture: true,
  }).catch(() => null);
  if (!docker || docker.code !== 0) {
    throw new Error(
      "Docker is not running. Install and open OrbStack (brew install --cask orbstack) " +
        "or Docker Desktop, then run this again.",
    );
  }
}

/** Reads `supabase status -o env`, which names keys differently across CLI versions. */
async function readStatus(): Promise<StackStatus> {
  const text = await supabase(["status", "-o", "env"], true);
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/u)) {
    const match = /^([A-Z_]+)="?(.*?)"?$/u.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  const apiUrl = values.API_URL;
  const publishableKey = values.PUBLISHABLE_KEY ?? values.ANON_KEY;
  const serviceRoleKey = values.SERVICE_ROLE_KEY ?? values.SECRET_KEY;
  const dbUrl = values.DB_URL;
  if (!apiUrl || !publishableKey || !serviceRoleKey || !dbUrl) {
    throw new Error("supabase status did not report the API URL, keys and database URL");
  }
  for (const url of [apiUrl, dbUrl]) {
    if (!isLocalBackendUrl(url)) {
      throw new Error(`supabase status reported a non-local URL (${url}); refusing`);
    }
  }
  return {
    apiUrl,
    publishableKey,
    serviceRoleKey,
    dbUrl,
    blobDir: BLOB_DIR,
    blobUrl: `http://127.0.0.1:${BLOB_PORT}`,
    studioUrl: values.STUDIO_URL ?? null,
    mailUrl: values.MAILPIT_URL ?? values.INBUCKET_URL ?? null,
  };
}

function database(status: StackStatus): ReturnType<typeof postgres> {
  return postgres(status.dbUrl, { prepare: false, max: 1, onnotice: () => {} });
}

async function seedPersonas(
  sql: ReturnType<typeof postgres>,
  status: StackStatus,
  ids: readonly LocalPersonaId[],
): Promise<void> {
  const admin: AuthAdmin = { apiUrl: status.apiUrl, serviceRoleKey: status.serviceRoleKey };
  for (const id of ids) {
    const seeded = await seedPersona(sql, admin, id);
    log(
      id === "new"
        ? "persona new: cleared; the picker makes a fresh account each tap"
        : `persona ${id}: ${seeded.email} (family ${seeded.familyId})`,
    );
  }
}

/** Studio and the metadata API behind it: the largest optional download. */
const STUDIO_SERVICES = "studio,postgres-meta";

async function up(options: { reset: boolean; studio: boolean }): Promise<StackStatus> {
  await preflight();
  log("starting Supabase (the first run downloads images, a few minutes)");
  await supabase(options.studio ? ["start"] : ["start", "--exclude", STUDIO_SERVICES]);
  if (options.reset) {
    log("wiping the database");
    await supabase(["db", "reset"]);
  }
  const status = await readStatus();
  await mkdir(BLOB_DIR, { recursive: true });
  const sql = database(status);
  try {
    const fresh =
      (
        await sql<{ exists: boolean }[]>`
          select to_regclass('local_stack.applied_migrations') is not null as exists
        `
      )[0]?.exists !== true;
    const count = await migrate(sql);
    log(count === 0 ? "migrations up to date" : `applied ${count} migrations`);
    if (fresh) {
      log("first run: seeding the test parents");
      await seedPersonas(sql, status, LOCAL_PERSONA_IDS);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
  printStatus(status);
  return status;
}

function printStatus(status: StackStatus): void {
  const personas = LOCAL_PERSONAS.map(
    (persona) =>
      `    ${persona.id.padEnd(12)} ${persona.email ?? "fresh address each tap"}  ${persona.detail}`,
  ).join("\n");
  console.log(
    [
      "",
      "Local stack is up. Nothing here touches production.",
      `  Supabase API   ${status.apiUrl}`,
      `  Studio         ${status.studioUrl ?? "(off: started with --no-studio)"}`,
      `  Email codes    ${status.mailUrl ?? "(not reported)"}`,
      `  Database       ${status.dbUrl}`,
      `  Test parents   password ${LOCAL_PERSONA_PASSWORD}`,
      personas,
      "",
      "Next, in two terminals:",
      "  pnpm dev:stack web       web app on http://localhost:3000",
      "  pnpm dev:stack mobile    Metro for the simulator dev build",
      "Then on the simulator's sign-in screen tap \"Local test parents\",",
      "or: pnpm dev:stack open established",
      "",
    ].join("\n"),
  );
}

async function webEnvFileKeys(): Promise<string[]> {
  const keys = new Set<string>();
  for (const name of [".env", ".env.local", ".env.development", ".env.development.local"]) {
    const path = join(REPO_ROOT, "apps", "web", name);
    if (existsSync(path)) {
      for (const key of dotenvKeys(await readFile(path, "utf8"))) keys.add(key);
    }
  }
  return [...keys];
}

/** Runs a long-lived child until it exits, forwarding Ctrl-C. */
function runForeground(
  command: string,
  args: string[],
  env: Record<string, string>,
): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
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
}

async function web(): Promise<number> {
  const status = await readStatus();
  await mkdir(BLOB_DIR, { recursive: true });
  const blob = await startBlobServer(BLOB_DIR, BLOB_PORT);
  const env = localWebEnvironment(await webEnvFileKeys(), status);
  const blanked = Object.entries(env).filter(([, value]) => value === "").length;
  log(
    `web app against ${status.apiUrl}; ${blanked} production settings blanked, ` +
      `artifacts in ${BLOB_DIR}`,
  );
  try {
    return await runForeground("pnpm", ["--filter", "web", "dev"], env);
  } finally {
    blob.server.close();
  }
}

async function mobile(): Promise<number> {
  const status = await readStatus();
  const env = localMobileEnvironment(status, WEB_ORIGIN);
  log(`Metro against ${status.apiUrl} and ${WEB_ORIGIN}; cache cleared so the new values inline`);
  return runForeground(
    "pnpm",
    ["--filter", "mobile", "exec", "expo", "start", "--port", String(METRO_PORT), "--clear"],
    env,
  );
}

async function persona(target: string | undefined, open: boolean): Promise<void> {
  const ids: LocalPersonaId[] =
    target === "all"
      ? [...LOCAL_PERSONA_IDS]
      : isLocalPersonaId(target)
        ? [target]
        : [];
  if (ids.length === 0 || (open && ids.length !== 1)) {
    throw new Error(
      `name one persona: ${LOCAL_PERSONA_IDS.join(" | ")}${open ? "" : " | all"}`,
    );
  }
  const status = await readStatus();
  const sql = database(status);
  try {
    await seedPersonas(sql, status, ids);
  } finally {
    await sql.end({ timeout: 5 });
  }
  if (open) {
    const url = `homa://labs/personas?as=${ids[0]}`;
    const result = await run("xcrun", ["simctl", "openurl", "booted", url]);
    if (result.code !== 0) throw new Error(`could not open ${url} on the booted simulator`);
    log(`opened ${url}; the dev build signs in as ${ids[0]}`);
  }
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const studio = !argv.includes("--no-studio");
  const [command = "up", ...rest] = argv.filter((arg) => !arg.startsWith("--"));
  switch (command) {
    case "up":
      await up({ reset: false, studio });
      return 0;
    case "reset":
      await up({ reset: true, studio });
      return 0;
    case "status":
      printStatus(await readStatus());
      return 0;
    case "down":
      await supabase(["stop"]);
      return 0;
    case "web":
      return web();
    case "mobile":
      return mobile();
    case "persona":
      await persona(rest[0], false);
      return 0;
    case "open":
      await persona(rest[0], true);
      return 0;
    default:
      console.error(
        "usage: pnpm dev:stack [up | web | mobile | persona <id|all> | open <id> | status | reset | down] [--no-studio]",
      );
      return 2;
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    log(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
