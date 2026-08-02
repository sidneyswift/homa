import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { CaptureLoopEventProps, CaptureLoopStage } from "@homa/core";
import postgres from "postgres";

import { persistCaptureLoopEventWithSql } from "../apps/web/lib/capture-loop-events";

const execFileAsync = promisify(execFile);
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const processTimeoutMs = 30_000;
const familyAId = "00000000-0000-4000-8000-000000000001";
const familyBId = "00000000-0000-4000-8000-000000000002";
const orphanFamilyId = "00000000-0000-4000-8000-000000000099";
const materialAId = uuid("3", 1);
const materialASecondId = uuid("3", 2);
const materialBId = uuid("3", 3);
const scheduleAId = uuid("4", 1);
const scheduleBId = uuid("4", 2);
const parentLoopAId = uuid("5", 1);
const parentLoopBId = uuid("5", 2);
const correctionLoopId = uuid("5", 3);

function uuid(namespace: string, sequence: number): string {
  return `${namespace}0000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function eventId(sequence: number): string {
  return uuid("1", sequence);
}

const revisionStages = new Set<CaptureLoopStage>([
  "proposal_ready",
  "review_presented",
  "approval_recorded",
  "effect_attempted",
  "outcome_verified",
]);

function loopEvent(input: {
  eventSequence: number;
  loopId: string;
  stage: CaptureLoopStage;
  sequence: number;
  profile?: CaptureLoopEventProps["profile"];
  intent?: CaptureLoopEventProps["intent"];
  objectKind?: CaptureLoopEventProps["object_kind"];
  objectId?: string;
  parentLoopId?: string | null;
  correctsEventId?: string | null;
  correctionResult?: CaptureLoopEventProps["correction_result"];
}): CaptureLoopEventProps {
  const profile = input.profile ?? "proposed_effect";
  const outcome = input.stage === "outcome_verified";
  const correction = input.stage === "correction_or_undo_verified";
  return {
    contract_version: 1,
    event_id: eventId(input.eventSequence),
    loop_id: input.loopId,
    parent_loop_id: input.parentLoopId ?? null,
    branch_id: null,
    branch_scope: "family",
    profile,
    intent: input.intent ?? "create_material",
    stage: input.stage,
    sequence: input.sequence,
    surface: "chat",
    object_kind: input.objectKind ?? "material",
    object_id: input.objectId ?? materialAId,
    client_context: {
      client: "web",
      app_version: "capture-contract-test",
      build_number: null,
      runtime_version: null,
      update_id: null,
    },
    outcome_kind: outcome ? "artifact_ready" : null,
    result_state: outcome ? "complete" : "not_applicable",
    receipt_kind:
      outcome || correction ? "artifact_receipt" : "none",
    revision:
      profile !== "direct_mutation" && revisionStages.has(input.stage)
        ? 1
        : null,
    corrects_event_id: input.correctsEventId ?? null,
    correction_result: correction
      ? (input.correctionResult ?? "corrected")
      : null,
    exit_reason: null,
  };
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
  const candidates = process.env.HOMA_POSTGRES_BIN
    ? [process.env.HOMA_POSTGRES_BIN]
    : [];
  for (const formula of ["postgresql@17", "postgresql@16"]) {
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
    // PATH has no PostgreSQL installation.
  }

  for (const candidate of candidates) {
    const tools = ["postgres", "initdb", "pg_ctl", "psql", "createdb"];
    const available = await Promise.all(
      tools.map((tool) => executableExists(path.join(candidate, tool))),
    );
    if (available.every(Boolean)) return candidate;
  }
  throw new Error(
    "No usable local PostgreSQL installation found. Set HOMA_POSTGRES_BIN.",
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
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  await execFileAsync(executable, args, {
    cwd: repoRoot,
    env: environment,
    maxBuffer: 10 * 1024 * 1024,
    timeout: processTimeoutMs,
  });
}

const baseSchema = `
  create extension if not exists pgcrypto;
  create table public.families (id uuid primary key);
  create table public.events (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    props jsonb not null,
    family_id uuid,
    created_at timestamptz not null default now()
  );
  create table public.children (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade
  );
  create table public.conversation_episodes (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade
  );
  create table public.materials (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade,
    kind text not null default 'worksheet',
    subject text,
    generation jsonb
  );
  create table public.child_plans (
    id uuid primary key,
    child_id uuid not null references public.children (id) on delete cascade
  );
  create table public.plan_activity_schedule (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade
  );
  create table public.family_events (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade
  );
  create table public.child_progress_operations (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade,
    status text not null
  );
  create table public.hours_log (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade
  );
  create table public.homa_task_runs (
    id uuid primary key,
    family_id uuid references public.families (id) on delete cascade
  );
  insert into public.families (id) values
    ('${familyAId}'), ('${familyBId}');
  insert into public.events (name, props, family_id) values
    ('legacy.orphan', '{}'::jsonb, '${orphanFamilyId}'),
    ('anonymous.event', '{}'::jsonb, null);
`;

async function main(): Promise<void> {
  const postgresBin = await discoverPostgresBin();
  const root = await mkdtemp(path.join(tmpdir(), "homa-capture-loop-"));
  const dataDir = path.join(root, "data");
  const socketDir = path.join(root, "socket");
  const logPath = path.join(root, "postgres.log");
  const port = await availablePort();
  const username = process.env.USER ?? "postgres";
  const environment = { ...process.env, LC_ALL: "C" };
  const databaseName = "homa_capture_loop_contract";
  let sql: ReturnType<typeof postgres> | null = null;

  try {
    await mkdir(socketDir);
    await run(
      path.join(postgresBin, "initdb"),
      ["-A", "trust", "-U", username, "-D", dataDir, "--no-locale", "-E", "UTF8"],
      environment,
    );
    await run(
      path.join(postgresBin, "pg_ctl"),
      ["-D", dataDir, "-l", logPath, "-o", `-k ${socketDir} -p ${port}`, "-w", "start"],
      environment,
    );
    await run(
      path.join(postgresBin, "createdb"),
      ["-h", socketDir, "-p", String(port), "-U", username, databaseName],
      environment,
    );
    await run(
      path.join(postgresBin, "psql"),
      ["-v", "ON_ERROR_STOP=1", "-h", socketDir, "-p", String(port), "-U", username, "-d", databaseName, "-c", baseSchema],
      environment,
    );
    for (const migration of [
      "20260802225000_events_family_delete_cascade.sql",
      "20260802230000_capture_loop_event_idempotency.sql",
    ]) {
      await run(
        path.join(postgresBin, "psql"),
        ["-v", "ON_ERROR_STOP=1", "-h", socketDir, "-p", String(port), "-U", username, "-d", databaseName, "-f", path.join(repoRoot, "supabase/migrations", migration)],
        environment,
      );
    }

    sql = postgres({
      host: socketDir,
      port,
      database: databaseName,
      username,
      max: 2,
    });
    const [migrationState] = await sql<{
      orphan_count: number;
      anonymous_count: number;
      index_count: number;
    }[]>`
      select
        (select count(*)::int from public.events where family_id = ${orphanFamilyId}) as orphan_count,
        (select count(*)::int from public.events where family_id is null) as anonymous_count,
        (select count(*)::int from pg_indexes where indexname like 'events_capture_loop_%') as index_count
    `;
    assert.deepEqual(migrationState, {
      orphan_count: 0,
      anonymous_count: 1,
      index_count: 3,
    });

    await sql`
      insert into public.materials (id, family_id) values
        (${materialAId}, ${familyAId}),
        (${materialASecondId}, ${familyAId}),
        (${materialBId}, ${familyBId})
    `;
    await sql`
      insert into public.plan_activity_schedule (id, family_id) values
        (${scheduleAId}, ${familyAId}),
        (${scheduleBId}, ${familyBId})
    `;

    const directEntry = loopEvent({
      eventSequence: 1,
      loopId: parentLoopAId,
      stage: "entry_intent",
      sequence: 1,
      profile: "direct_mutation",
      intent: "schedule_learning",
      objectKind: "plan_activity",
      objectId: scheduleAId,
    });
    await persistCaptureLoopEventWithSql(sql, familyAId, directEntry);
    await persistCaptureLoopEventWithSql(sql, familyAId, directEntry);
    const [deduplicated] = await sql<{ count: number }[]>`
      select count(*)::int as count from public.events
      where family_id = ${familyAId}
        and name = 'product.loop_stage_recorded'
        and props ->> 'event_id' = ${directEntry.event_id}
    `;
    assert.equal(deduplicated?.count, 1);

    await assert.rejects(
      persistCaptureLoopEventWithSql(sql, familyAId, {
        ...directEntry,
        stage: "effect_attempted",
        sequence: 2,
      }),
      /idempotency payload mismatch/u,
    );
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 2,
          loopId: uuid("5", 4),
          stage: "entry_intent",
          sequence: 1,
          profile: "direct_mutation",
          intent: "schedule_learning",
          objectKind: "plan_activity",
          objectId: scheduleBId,
        }),
      ),
      /outside the authenticated family/u,
    );

    const familyBParent = loopEvent({
      eventSequence: 3,
      loopId: parentLoopBId,
      stage: "entry_intent",
      sequence: 1,
      profile: "direct_mutation",
      intent: "schedule_learning",
      objectKind: "plan_activity",
      objectId: scheduleBId,
    });
    await persistCaptureLoopEventWithSql(sql, familyBId, familyBParent);
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 4,
          loopId: uuid("5", 5),
          parentLoopId: parentLoopBId,
          stage: "entry_intent",
          sequence: 1,
          profile: "direct_mutation",
          intent: "schedule_learning",
          objectKind: "plan_activity",
          objectId: scheduleAId,
        }),
      ),
      /outside the authenticated family/u,
    );

    const successStages = [
      "entry_intent",
      "capture_accepted",
      "proposal_ready",
      "review_presented",
      "approval_recorded",
      "effect_attempted",
      "outcome_verified",
    ] as const;
    const original = successStages.map((stage, index) =>
      loopEvent({
        eventSequence: 10 + index,
        loopId: uuid("5", 6),
        stage,
        sequence: index + 1,
        objectId: materialAId,
      }),
    );
    for (const event of original) {
      await persistCaptureLoopEventWithSql(sql, familyAId, event);
    }
    const originalOutcome = original.at(-1);
    assert.ok(originalOutcome);

    const correction = [
      loopEvent({
        eventSequence: 20,
        loopId: correctionLoopId,
        parentLoopId: originalOutcome.loop_id,
        stage: "entry_intent",
        sequence: 1,
        profile: "direct_mutation",
        intent: "correct_or_undo",
        objectId: materialAId,
      }),
      loopEvent({
        eventSequence: 21,
        loopId: correctionLoopId,
        parentLoopId: originalOutcome.loop_id,
        stage: "effect_attempted",
        sequence: 2,
        profile: "direct_mutation",
        intent: "correct_or_undo",
        objectId: materialAId,
      }),
      loopEvent({
        eventSequence: 22,
        loopId: correctionLoopId,
        parentLoopId: originalOutcome.loop_id,
        stage: "correction_or_undo_verified",
        sequence: 3,
        profile: "direct_mutation",
        intent: "correct_or_undo",
        objectId: materialAId,
        correctsEventId: originalOutcome.event_id,
        correctionResult: "reversed",
      }),
    ];
    for (const event of correction) {
      await persistCaptureLoopEventWithSql(sql, familyAId, event);
    }
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 23,
          loopId: uuid("5", 7),
          parentLoopId: originalOutcome.loop_id,
          stage: "correction_or_undo_verified",
          sequence: 3,
          profile: "direct_mutation",
          intent: "correct_or_undo",
          objectId: materialASecondId,
          correctsEventId: originalOutcome.event_id,
          correctionResult: "corrected",
        }),
      ),
      /outside the authenticated family/u,
    );

    await sql`delete from public.families where id = ${familyAId}`;
    const [cascade] = await sql<{ family_a_events: number; family_b_events: number }[]>`
      select
        count(*) filter (where family_id = ${familyAId})::int as family_a_events,
        count(*) filter (where family_id = ${familyBId})::int as family_b_events
      from public.events
    `;
    assert.equal(cascade?.family_a_events, 0);
    assert.ok((cascade?.family_b_events ?? 0) > 0);
    console.log("PASS  capture-loop PostgreSQL contract");
  } finally {
    if (sql) await sql.end({ timeout: 1 });
    try {
      await run(
        path.join(postgresBin, "pg_ctl"),
        ["-D", dataDir, "-m", "fast", "-w", "stop"],
        environment,
      );
    } catch {
      // A failed setup may leave no server to stop.
    }
    await rm(root, { recursive: true, force: true });
  }
}

await main();
