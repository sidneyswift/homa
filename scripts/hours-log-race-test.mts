import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

/**
 * hours_log double-write guard, end to end against the real migrations
 * (issue #215). Boots a disposable local PostgreSQL cluster, applies the
 * real hours_log migrations, and proves the three layers of the fix:
 *
 * 1. The one-time cleanup in migration 20260725193000 removes only rows
 *    matching the race-artifact shape (identical block AND identical
 *    note, within one second), keeps the earliest, and leaves per-child
 *    siblings alone. The per-child case is load-bearing: issue #215's
 *    "duplicate pairs" turned out to be one row per child, and this
 *    fixture fails if the cleanup ever starts eating those.
 * 2. hours_log_block_unique_idx makes a raced identical insert lose
 *    deterministically (on conflict do nothing returns no row).
 * 3. recordHoursPinned converges under concurrency: N identical calls
 *    produce one row, one telemetry event, and N successful results;
 *    concurrent calls for DIFFERENT children still produce one row each.
 *
 * Needs no remote credentials; the cluster is created and removed here.
 */

const execFileAsync = promisify(execFile);
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PROCESS_TIMEOUT_MS = 120_000;
const database = "hours_log_race_test";
const username = "hours_log_race_user";

const familyId = "10000000-0000-4000-8000-000000000001";
const childA = "10000000-0000-4000-8000-0000000000aa";
const childB = "10000000-0000-4000-8000-0000000000bb";

async function executableExists(candidate: string): Promise<boolean> {
  try {
    await execFileAsync(candidate, ["--version"], {
      timeout: PROCESS_TIMEOUT_MS,
    });
    return true;
  } catch {
    return false;
  }
}

async function discoverPostgresBin(): Promise<string> {
  const candidates: string[] = [];
  if (process.env.HOMA_POSTGRES_BIN) {
    candidates.push(process.env.HOMA_POSTGRES_BIN);
  }
  for (const formula of [
    "postgresql@17",
    "postgresql@16",
    "postgresql@15",
    "postgresql@14",
  ]) {
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
      (await executableExists(path.join(candidate, "initdb"))) &&
      (await executableExists(path.join(candidate, "pg_ctl"))) &&
      (await executableExists(path.join(candidate, "psql"))) &&
      (await executableExists(path.join(candidate, "createdb")))
    ) {
      return candidate;
    }
  }
  throw new Error(
    "No usable local PostgreSQL installation found. Set HOMA_POSTGRES_BIN to its bin directory.",
  );
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

async function run(
  executable: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  await execFileAsync(executable, args, {
    cwd: repoRoot,
    env,
    maxBuffer: 10 * 1024 * 1024,
    timeout: PROCESS_TIMEOUT_MS,
  });
}

// The minimum surrounding schema the real hours_log migrations and the
// pinned writer need: the FK targets, the RLS helper the policies name,
// and the events table the writer's telemetry lands in.
const prerequisiteSql = `
  create extension if not exists pgcrypto;
  create role anon nologin;
  create role authenticated nologin;
  create function public.is_family_member(uuid)
    returns boolean language sql stable as 'select true';
  create table public.families (
    id uuid primary key,
    time_zone text
  );
  create table public.children (
    id uuid primary key,
    family_id uuid not null,
    name text not null
  );
  create table public.events (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    props jsonb not null default '{}'::jsonb,
    family_id uuid,
    created_at timestamptz not null default now()
  );
`;

async function applyMigration(
  postgresBin: string,
  connection: { socketDir: string; port: number },
  migrationFile: string,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  await run(
    path.join(postgresBin, "psql"),
    [
      "--single-transaction",
      "-v",
      "ON_ERROR_STOP=1",
      "-h",
      connection.socketDir,
      "-p",
      String(connection.port),
      "-U",
      username,
      "-d",
      database,
      "-f",
      path.join(repoRoot, "supabase/migrations", migrationFile),
    ],
    env,
  );
}

async function runCleanupMigrationAssertions(
  sql: postgres.Sql,
  postgresBin: string,
  connection: { socketDir: string; port: number },
  env: NodeJS.ProcessEnv,
): Promise<void> {
  // hours_log carries FKs to both of these.
  await sql`
    insert into public.families (id, time_zone)
    values (${familyId}, 'America/New_York')
  `;
  await sql`
    insert into public.children (id, family_id, name)
    values (${childA}, ${familyId}, 'Ara'), (${childB}, ${familyId}, 'Alma')
  `;

  // The exact shapes from the issue-#215 investigation. The race pair is
  // synthetic (prod had none); the per-child pair reproduces the rows
  // that were misread as duplicates (one block logged for each child,
  // milliseconds apart).
  await sql`
    insert into public.hours_log
      (family_id, child_id, subject, minutes, happened_on, source, note, created_at)
    values
      (${familyId}, ${childA}, 'math', 10, '2026-07-10', 'sms',
        'Rocket Math practice', '2026-07-10T02:58:13.364Z'),
      (${familyId}, ${childA}, 'math', 10, '2026-07-10', 'sms',
        'Rocket Math practice', '2026-07-10T02:58:13.366Z'),
      (${familyId}, ${childA}, 'reading', 60, '2026-07-10', 'sms',
        '1 hour independent reading', '2026-07-10T02:58:14.100Z'),
      (${familyId}, ${childB}, 'reading', 60, '2026-07-10', 'sms',
        '1 hour independent reading', '2026-07-10T02:58:14.101Z'),
      (${familyId}, null, 'math', 10, '2026-07-10', 'sms',
        'family-wide math game', '2026-07-10T02:58:15.000Z')
  `;

  await applyMigration(
    postgresBin,
    connection,
    "20260725193000_hours_log_block_unique.sql",
    env,
  );

  const survivors = await sql<
    { child_id: string | null; subject: string; created_at: Date }[]
  >`
    select child_id, subject, created_at from public.hours_log
    where family_id = ${familyId}
    order by created_at
  `;
  assert.equal(survivors.length, 4);
  // The race pair collapsed to its earliest row; both per-child reading
  // rows and the family-wide row survived untouched.
  assert.equal(
    survivors[0].created_at.toISOString(),
    "2026-07-10T02:58:13.364Z",
  );
  assert.deepEqual(
    survivors.map((row) => [row.subject, row.child_id]),
    [
      ["math", childA],
      ["reading", childA],
      ["reading", childB],
      ["math", null],
    ],
  );

  const [index] = await sql<{ indexdef: string }[]>`
    select indexdef from pg_indexes
    where schemaname = 'public' and indexname = 'hours_log_block_unique_idx'
  `;
  assert.ok(index, "hours_log_block_unique_idx exists after the migration");
  assert.match(index.indexdef, /^CREATE UNIQUE INDEX/);

  // The index is the arbiter: a raced identical insert loses without
  // error, including in the family-wide (null child) bucket.
  const racedChild = await sql<{ id: string }[]>`
    insert into public.hours_log
      (family_id, child_id, subject, minutes, happened_on, source, note)
    values (${familyId}, ${childA}, 'math', 10, '2026-07-10', 'sms', 'raced copy')
    on conflict do nothing
    returning id
  `;
  assert.equal(racedChild.length, 0);
  const racedFamilyWide = await sql<{ id: string }[]>`
    insert into public.hours_log
      (family_id, child_id, subject, minutes, happened_on, source, note)
    values (${familyId}, null, 'math', 10, '2026-07-10', 'sms', 'raced copy')
    on conflict do nothing
    returning id
  `;
  assert.equal(racedFamilyWide.length, 0);
  console.log("PASS  hours-log cleanup migration + unique index");

  await sql`delete from public.hours_log where family_id = ${familyId}`;
}

async function runConcurrentWriterAssertions(sql: postgres.Sql): Promise<void> {
  const { recordHoursPinned } = await import("../apps/web/lib/agent-pinned");

  // No happenedOn: the writer resolves "today" itself (the seeded
  // family time zone), so the week-total assertions never age out of
  // the 7-day window.
  const identicalCall = {
    familyId,
    minutes: 45,
    subject: "science",
    source: "sms" as const,
    childId: childA,
    note: "volcano experiment",
  };
  const results = await Promise.all(
    Array.from({ length: 8 }, () => recordHoursPinned(identicalCall)),
  );
  for (const result of results) {
    assert.equal(result.logged, true);
    assert.match(result.note, /On the record|already on the record/);
  }
  const winners = results.filter(
    (result) => result.weekMinutesForSubject !== undefined,
  );
  assert.equal(winners.length, 1);
  assert.equal(winners[0].weekMinutesForSubject, 45);
  const [rows] = await sql<{ count: number }[]>`
    select count(*)::integer as count from public.hours_log
    where family_id = ${familyId} and subject = 'science'
  `;
  assert.equal(rows.count, 1);
  // Only the winner told telemetry a row landed.
  const [events] = await sql<{ count: number }[]>`
    select count(*)::integer as count from public.events
    where name = 'chat.hours_logged' and family_id = ${familyId}
  `;
  assert.equal(events.count, 1);
  console.log("PASS  hours-log concurrent identical calls converge to one row");

  // The per-child shape from issue #215 stays two rows: same block,
  // different children, fired concurrently.
  const perChild = await Promise.all(
    [childA, childB].map((childId) =>
      recordHoursPinned({
        familyId,
        minutes: 60,
        subject: "reading",
        source: "sms" as const,
        childId,
        note: "1 hour independent reading",
      }),
    ),
  );
  for (const result of perChild) {
    assert.equal(result.logged, true);
    // Both are winners (the week total is per family+subject, so its
    // exact value depends on commit interleaving; presence marks a
    // real write).
    assert.notEqual(result.weekMinutesForSubject, undefined);
  }
  const [readingRows] = await sql<{ count: number }[]>`
    select count(*)::integer as count from public.hours_log
    where family_id = ${familyId} and subject = 'reading'
  `;
  assert.equal(readingRows.count, 2);
  console.log("PASS  hours-log per-child concurrent calls both land");

  // The bug this migration fixes (Carolyng, 2026-09-02): two genuinely
  // different blocks that happen to share subject/minutes/day/child used
  // to collide and silently drop the second one. A distinct customLabel
  // now tells them apart; an identical (or absent) label still dedups.
  const literatureJournal = await recordHoursPinned({
    familyId,
    minutes: 20,
    subject: "reading",
    source: "sms" as const,
    childId: childA,
    customLabel: "Literature journal",
  });
  const littleWomen = await recordHoursPinned({
    familyId,
    minutes: 20,
    subject: "reading",
    source: "sms" as const,
    childId: childA,
    customLabel: "Little Women",
  });
  const littleWomenAgain = await recordHoursPinned({
    familyId,
    minutes: 20,
    subject: "reading",
    source: "sms" as const,
    childId: childA,
    customLabel: "Little Women",
  });
  assert.equal(literatureJournal.inserted, true);
  assert.equal(littleWomen.inserted, true);
  assert.equal(littleWomenAgain.inserted, false);
  const [subDomainRows] = await sql<{ count: number }[]>`
    select count(*)::integer as count from public.hours_log
    where family_id = ${familyId} and subject = 'reading' and minutes = 20
      and child_id = ${childA} and custom_label is not null
  `;
  assert.equal(subDomainRows.count, 2);
  console.log("PASS  hours-log distinct custom labels stop a false collision");
}

async function main(): Promise<void> {
  const postgresBin = await discoverPostgresBin();
  const root = await mkdtemp(path.join(tmpdir(), "homa-hours-log-race-"));
  const dataDir = path.join(root, "data");
  const socketDir = path.join(root, "socket");
  const logPath = path.join(root, "postgres.log");
  const env = { ...process.env, LC_ALL: "C" };
  let started = false;
  let sql: postgres.Sql | undefined;
  try {
    const port = await availablePort();
    await mkdir(socketDir);
    await run(
      path.join(postgresBin, "initdb"),
      ["-A", "trust", "-U", username, "-D", dataDir, "--no-locale", "-E", "UTF8"],
      env,
    );
    await run(
      path.join(postgresBin, "pg_ctl"),
      [
        "-D",
        dataDir,
        "-l",
        logPath,
        "-o",
        [
          `-k ${socketDir}`,
          `-p ${port}`,
          "-c listen_addresses=127.0.0.1",
          "-c lock_timeout=15000",
          "-c statement_timeout=30000",
        ].join(" "),
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
    await run(
      path.join(postgresBin, "psql"),
      [
        "-v",
        "ON_ERROR_STOP=1",
        "-h",
        socketDir,
        "-p",
        String(port),
        "-U",
        username,
        "-d",
        database,
        "-c",
        prerequisiteSql,
      ],
      env,
    );
    await applyMigration(
      postgresBin,
      { socketDir, port },
      "20260709211000_hours_log.sql",
      env,
    );

    sql = postgres({
      host: socketDir,
      port,
      database,
      username,
      prepare: false,
      max: 4,
    });
    await runCleanupMigrationAssertions(sql, postgresBin, { socketDir, port }, env);
    // recordHoursPinned reads/writes custom_label (20260827130000, then
    // widened to every subject and folded into the dedup key by
    // 20260902120000): apply both before the concurrency assertions
    // touch that column.
    await applyMigration(
      postgresBin,
      { socketDir, port },
      "20260827130000_hours_log_custom_label.sql",
      env,
    );
    await applyMigration(
      postgresBin,
      { socketDir, port },
      "20260902120000_hours_log_custom_label_any_subject.sql",
      env,
    );

    // Route the pinned writer's mapDb() at this cluster; the import in
    // runConcurrentWriterAssertions happens after this is set.
    process.env.HOMA_EVAL_DATABASE_URL = `postgres://${username}@127.0.0.1:${port}/${database}`;
    await runConcurrentWriterAssertions(sql);
  } finally {
    // Each teardown step runs even when an earlier one fails: the
    // cluster must stop and the directory must go regardless.
    try {
      // The pinned writer's cached mapDb() client would otherwise hold
      // the event loop open past the cluster teardown. Only reachable
      // when the test pointed it here; never construct it otherwise.
      if (process.env.HOMA_EVAL_DATABASE_URL) {
        const { mapDb } = await import("../apps/web/lib/map/db");
        await mapDb().end({ timeout: 5 });
      }
    } catch (error) {
      console.error("mapDb teardown failed:", error);
    }
    try {
      await sql?.end({ timeout: 5 });
    } catch (error) {
      console.error("sql teardown failed:", error);
    }
    try {
      if (started) {
        await run(
          path.join(postgresBin, "pg_ctl"),
          ["-D", dataDir, "-m", "fast", "-w", "stop"],
          env,
        );
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
  console.log("PASS  hours-log race harness cleanup");
}

await main();
