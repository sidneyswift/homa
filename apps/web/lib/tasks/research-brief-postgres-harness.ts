import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import postgres, { type Sql } from "postgres";

import type { ResearchBriefPreparationRecord } from "./research-brief-preparation";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const migrationPaths = [
  "20260716115722_morning_research_brief_v2.sql",
  "20260718010000_morning_offer_funnel.sql",
  "20260718023000_morning_offer_provenance_hardening.sql",
  "20260718030000_offer_provenance_fold_safety.sql",
  "20260718034500_offer_fulfillment_outbox.sql",
].map((file) => path.join(repoRoot, "supabase/migrations", file));
const processTimeoutMs = 30_000;

export const familyAId = "00000000-0000-4000-8000-000000000001";
export const familyBId = "00000000-0000-4000-8000-000000000002";
export const childAId = "00000000-0000-4000-8000-000000000011";
export const childBId = "00000000-0000-4000-8000-000000000012";
export const knowledgeId = "00000000-0000-4000-8000-000000000021";
export const recentlyUsedKnowledgeId =
  "00000000-0000-4000-8000-000000000022";
export const reservedKnowledgeId =
  "00000000-0000-4000-8000-000000000023";
export const deliveredKnowledgeId =
  "00000000-0000-4000-8000-000000000024";
export const idempotentKnowledgeId =
  "00000000-0000-4000-8000-000000000025";
export const concurrentKnowledgeId =
  "00000000-0000-4000-8000-000000000026";
export const terminalRunKnowledgeId =
  "00000000-0000-4000-8000-000000000027";
export const finalizationKnowledgeId =
  "00000000-0000-4000-8000-000000000028";
export const recoveryKnowledgeId =
  "00000000-0000-4000-8000-000000000029";
export const journeyKnowledgeId =
  "00000000-0000-4000-8000-000000000041";
export const wrongStageKnowledgeId =
  "00000000-0000-4000-8000-000000000042";
export const supersessionKnowledgeId =
  "00000000-0000-4000-8000-000000000043";
export const atomicFinalizationKnowledgeId =
  "00000000-0000-4000-8000-000000000044";
export const adultAId = "00000000-0000-4000-8000-000000000031";
export const adultBId = "00000000-0000-4000-8000-000000000032";
export const adultASecondId =
  "00000000-0000-4000-8000-000000000033";
export const fleetRunId = "00000000-0000-4000-8000-000000000099";

export function runId(sequence: number): string {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

export function observationId(sequence: number): string {
  return `00000000-0000-4000-9000-${String(sequence).padStart(12, "0")}`;
}

export function preparationRecord(
  runSequence: number,
  selectedKnowledgeId: string,
  draft = "Prepared draft",
): ResearchBriefPreparationRecord {
  return {
    familyId: familyAId,
    taskRunId: runId(runSequence),
    knowledgeId: selectedKnowledgeId,
    childId: childAId,
    draft,
    draftHash: "a".repeat(64),
    sourceSnapshot: {
      kind: "knowledge_cited",
      id: selectedKnowledgeId,
      title: "Test research",
      sourceNames: ["Test Source"],
      citationUrls: ["https://example.test/research"],
      topic: "test-topic",
      claims: ["Test claim"],
      topicType: "subject",
      lens: "current_study",
      stage: "early_elem",
      confidence: "high",
      sourceTier: 1,
    },
  };
}

export async function postgresErrorCode(
  operation: Promise<unknown>,
): Promise<string | null> {
  try {
    await operation;
    return null;
  } catch (error) {
    return typeof error === "object" &&
      error !== null &&
      "code" in error
      ? String(error.code)
      : null;
  }
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
    // PATH has no PostgreSQL installation.
  }
  for (const candidate of candidates) {
    const required = ["postgres", "initdb", "pg_ctl", "psql", "createdb"];
    if (
      (
        await Promise.all(
          required.map((executable) =>
            executableExists(path.join(candidate, executable)),
          ),
        )
      ).every(Boolean)
    ) {
      return candidate;
    }
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

const prerequisiteSql = `
  create extension if not exists pgcrypto;
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create schema private;
  create table auth.users (id uuid primary key);
  create table public.families (
    id uuid primary key,
    status text not null default 'active'
  );
  create table public.family_members (
    family_id uuid not null references public.families (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    primary key (family_id, user_id)
  );
  create function public.is_family_member(fid uuid)
  returns boolean language sql stable as $$
    select exists (
      select 1 from public.family_members where family_id = fid
    )
  $$;
  create table public.children (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade,
    name text not null,
    unique (id, family_id)
  );
  create table public.materials (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade
  );
  create table public.agent_schedules (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade,
    kind text not null,
    next_run_at timestamptz not null,
    lease_until timestamptz,
    last_run_at timestamptz,
    local_hour smallint not null,
    weekdays smallint[] not null
  );
  create table public.homa_task_runs (
    id uuid primary key default gen_random_uuid(),
    family_id uuid references public.families (id) on delete cascade,
    schedule_id uuid references public.agent_schedules (id) on delete set null,
    kind text not null,
    status text not null default 'running',
    scheduled_for date,
    title text not null default 'Fixture run',
    summary text,
    delivered_channel text,
    error text,
    session_id text,
    artifacts jsonb not null default '[]',
    started_at timestamptz not null default now(),
    finished_at timestamptz
  );
  create unique index homa_task_runs_outbox_idx
    on public.homa_task_runs (schedule_id, scheduled_for)
    where schedule_id is not null
      and scheduled_for is not null
      and status in ('running', 'done', 'skipped');
  create table public.knowledge_bank (
    id uuid primary key,
    title text not null,
    topic_type text not null default 'other',
    topic_key text not null default 'test',
    lens text,
    stage text,
    summary text not null default 'Fixture summary for database lifecycle coverage.',
    confidence text not null default 'medium',
    source_tier integer,
    citations jsonb not null default '[]'::jsonb,
    status text not null default 'active',
    superseded_by uuid,
    last_verified_at timestamptz not null default now(),
    freshness_ttl_days integer not null default 180,
    recent_delivered_use_count integer not null default 0
  );
  create table public.child_observations (
    id uuid primary key,
    child_id uuid not null,
    family_id uuid not null,
    status text not null default 'new',
    used_task_run_id uuid,
    used_at timestamptz,
    unique (id, family_id),
    foreign key (child_id, family_id)
      references public.children (id, family_id)
  );
  create table public.conversation_thread_bindings (
    family_id uuid not null references public.families (id) on delete cascade,
    member_user_id uuid,
    channel text not null,
    thread_key_hash text not null,
    runtime_session_id text,
    episode_id uuid,
    last_seen_at timestamptz not null default now(),
    unique (channel, thread_key_hash)
  );
  create table public.conversation_open_loops (
    id uuid primary key default gen_random_uuid(),
    family_id uuid,
    episode_id uuid,
    message_id uuid,
    delivery_id uuid,
    kind text not null default 'yes_no',
    state text not null default 'open',
    expires_at timestamptz not null default now() + interval '24 hours',
    resolved_at timestamptz,
    resolved_by_message_id uuid
  );
  create table public.conversation_messages (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade,
    task_run_id uuid references public.homa_task_runs (id) on delete cascade,
    role text not null,
    content text,
    visibility text not null default 'internal',
    episode_id uuid,
    member_user_id uuid,
    replied_delivery_id uuid,
    created_at timestamptz not null default now()
  );
  create table public.conversation_deliveries (
    id uuid primary key default gen_random_uuid(),
    family_id uuid not null references public.families (id) on delete cascade,
    episode_id uuid,
    message_id uuid not null
      references public.conversation_messages (id) on delete cascade,
    task_run_id uuid references public.homa_task_runs (id) on delete cascade,
    recipient_member_user_id uuid,
    destination_hash text,
    provider_thread_key_hash text,
    channel text not null,
    status text not null,
    attempt_count integer not null default 1,
    provider_message_id text,
    sent_at timestamptz,
    failed_at timestamptz,
    replied_at timestamptz,
    error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (message_id, channel, destination_hash)
  );
  create unique index conversation_deliveries_progress_identity_idx
    on public.conversation_deliveries (id, family_id);
  create table public.model_usage (
    id bigint generated always as identity primary key,
    surface text not null,
    channel text,
    input_tokens integer,
    duration_ms integer,
    session_id text,
    created_at timestamptz not null default now()
  );
  create table public.email_sends (
    id uuid primary key default gen_random_uuid(),
    provider_message_id text,
    status text not null,
    error text,
    updated_at timestamptz not null default now()
  );
`;

export interface DisposableResearchBriefPostgresHarness {
  start(): Promise<void>;
  stop(): Promise<void>;
  database(): Sql;
}

export function createDisposableResearchBriefPostgresHarness(
  label: string,
): DisposableResearchBriefPostgresHarness {
  let root = "";
  let dataDir = "";
  let postgresBin = "";
  let environment: NodeJS.ProcessEnv = process.env;
  let sql: Sql | null = null;

  return {
    async start() {
      postgresBin = await discoverPostgresBin();
      root = await mkdtemp(
        path.join("/tmp", `homa-research-brief-${label}-`),
      );
      dataDir = path.join(root, "data");
      const socketDir = path.join(root, "socket");
      const logPath = path.join(root, "postgres.log");
      const port = await availablePort();
      const username = process.env.USER ?? "postgres";
      environment = { ...process.env, LC_ALL: "C" };
      await mkdir(socketDir);
      await run(
        path.join(postgresBin, "initdb"),
        [
          "-A",
          "trust",
          "-U",
          username,
          "-D",
          dataDir,
          "--no-locale",
          "-E",
          "UTF8",
        ],
        environment,
      );
      await run(
        path.join(postgresBin, "pg_ctl"),
        [
          "-D",
          dataDir,
          "-l",
          logPath,
          "-o",
          `-k ${socketDir} -p ${port}`,
          "-w",
          "start",
        ],
        environment,
      );
      const databaseName = `homa_research_brief_${label.replace(/\W+/gu, "_")}`;
      await run(
        path.join(postgresBin, "createdb"),
        [
          "-h",
          socketDir,
          "-p",
          String(port),
          "-U",
          username,
          databaseName,
        ],
        environment,
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
          databaseName,
          "-c",
          prerequisiteSql,
        ],
        environment,
      );
      for (const migrationPath of migrationPaths) {
        await run(
          path.join(postgresBin, "psql"),
          [
            "--single-transaction",
            "-v",
            "ON_ERROR_STOP=1",
            "-h",
            socketDir,
            "-p",
            String(port),
            "-U",
            username,
            "-d",
            databaseName,
            "-f",
            migrationPath,
          ],
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
      await sql`
        insert into auth.users (id)
        values (${adultAId}), (${adultBId}), (${adultASecondId})
      `;
      await sql`
        insert into public.families (id)
        values (${familyAId}), (${familyBId})
      `;
      await sql`
        insert into public.family_members (family_id, user_id)
        values
          (${familyAId}, ${adultAId}),
          (${familyAId}, ${adultASecondId}),
          (${familyBId}, ${adultBId})
      `;
      await sql`
        insert into public.children (id, family_id, name)
        values
          (${childAId}, ${familyAId}, 'Child A'),
          (${childBId}, ${familyBId}, 'Child B')
      `;
      await sql`
        insert into public.knowledge_bank (id, title)
        values
          (${knowledgeId}, 'Test research'),
          (${recentlyUsedKnowledgeId}, 'Recently used research'),
          (${reservedKnowledgeId}, 'Reserved research'),
          (${deliveredKnowledgeId}, 'Delivered research'),
          (${idempotentKnowledgeId}, 'Idempotent research'),
          (${concurrentKnowledgeId}, 'Concurrent research'),
          (${terminalRunKnowledgeId}, 'Terminal run research'),
          (${finalizationKnowledgeId}, 'Finalized research'),
          (${recoveryKnowledgeId}, 'Recovered research'),
          (${journeyKnowledgeId}, 'Keeping sounds together'),
          (${wrongStageKnowledgeId}, 'High school phonics research'),
          (${supersessionKnowledgeId}, 'Supersession research'),
          (${atomicFinalizationKnowledgeId}, 'Atomic finalization research')
      `;
      await sql`
        update public.knowledge_bank
        set title = 'Test research',
            topic_type = 'subject',
            topic_key = 'test-topic',
            lens = 'current_study',
            stage = 'early_elem',
            confidence = 'high',
            source_tier = 1,
            citations = ${sql.json([{
              url: "https://example.test/research",
              claim: "Test claim",
              sourceName: "Test Source",
            }])},
            last_verified_at = now(),
            freshness_ttl_days = 180
        where id not in (${journeyKnowledgeId}, ${wrongStageKnowledgeId})
      `;
      await sql`
        insert into public.homa_task_runs (id, family_id, kind)
        values (${fleetRunId}, null, 'fleet_research')
      `;
      await sql`
        insert into public.homa_task_runs ${sql(
          Array.from({ length: 40 }, (_, index) => ({
            id: runId(index + 1),
            family_id:
              index === 1 || index === 2 || index === 3
                ? familyBId
                : familyAId,
            kind: index === 27 ? "journal_prompt" : "morning_brief",
            delivery_version:
              index === 21 || index === 27
                ? "legacy"
                : "research_brief_v2",
          })),
          "id",
          "family_id",
          "kind",
          "delivery_version",
        )}
      `;
      await sql`
        insert into public.child_observations (
          id, child_id, family_id, status
        )
        values
          (${observationId(1)}, ${childAId}, ${familyAId}, 'new'),
          (${observationId(2)}, ${childAId}, ${familyAId}, 'new'),
          (${observationId(3)}, ${childAId}, ${familyAId}, 'new'),
          (${observationId(4)}, ${childAId}, ${familyAId}, 'new'),
          (${observationId(5)}, ${childAId}, ${familyAId}, 'new')
      `;
    },
    async stop() {
      if (sql) await sql.end({ timeout: 1 });
      if (dataDir) {
        try {
          await run(
            path.join(postgresBin, "pg_ctl"),
            ["-D", dataDir, "-m", "fast", "-w", "stop"],
            environment,
          );
        } catch {
          // A failed setup may leave no server to stop.
        }
      }
      if (root) await rm(root, { recursive: true, force: true });
    },
    database() {
      assert.ok(sql, "PostgreSQL fixture is initialized");
      return sql;
    },
  };
}
