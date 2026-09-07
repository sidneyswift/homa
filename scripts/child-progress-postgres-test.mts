import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

import { assertDeeperProgressPostgres } from "./deeper-progress-postgres-contract";
import { assertReportNarrativePostgres } from "../apps/web/lib/map/report-narrative-postgres-contract";

import type { ProgressCheckInRecord } from "../apps/web/lib/child-progress/types";

import type { MapAnswer } from "../packages/core/src/index";

import {
  resolveActiveSmsProgressContextWithDatabase,
} from "../apps/web/lib/child-progress/active-sms-progress-context";
import { ProgressCheckInService } from "../apps/web/lib/child-progress/check-in-service";
import { CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY } from "../apps/web/lib/child-progress/postgres-repository-helpers";
import {
  createDefaultLegacyProgressAdapters,
  saveWalkCoverageAnswerWithDatabase,
} from "../apps/web/lib/child-progress/legacy-adapters";
import { buildChildProgressView } from "../apps/web/lib/child-progress/projection";
import { PostgresChildProgressRepository } from "../apps/web/lib/child-progress/postgres-repository";
import { ChildProgressService } from "../apps/web/lib/child-progress/progress-service";
import { hashContinuityKey } from "../apps/web/lib/conversation-continuity/continuity-service";
import { openReplyLoopWithDatabase } from "../apps/web/lib/conversation-continuity/delivery-ledger";
import { replyContractForProgressCheckIn } from "../apps/web/lib/conversation-continuity/delivery-policy";
import {
  foldFamilyDataIntoTx,
  foldStubFamilyIntoTx,
} from "../apps/web/lib/family-fold";
import {
  attachAuthUser,
  removeChild,
} from "../apps/web/lib/map/store";
import {
  MapWalkPromptService,
} from "../apps/web/lib/map/walk-prompt-store";

const execFileAsync = promisify(execFile);
const repoRoot = path.dirname(
  path.dirname(fileURLToPath(import.meta.url)),
);
const migrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260711213330_agent_led_live_progress.sql",
);
// The observation ledger's additive migration
// (plan 2026-07-13-observation-ledger.md) rides the same harness.
const observationsMigrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260713134500_child_observations.sql",
);
const progressLoopCleanupMigrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260716041217_conversation_progress_loop_cleanup.sql",
);
const evidenceDerivationMigrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260802200000_child_progress_evidence_derivation.sql",
);
const evidenceDerivationContractMigrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260802210000_child_progress_evidence_derivation_not_null.sql",
);
const eventsFamilyDeleteMigrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260802225000_events_family_delete_cascade.sql",
);
const familyDeleteProgressTriggerMigrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260806035000_family_delete_progress_trigger.sql",
);
const familyId = "00000000-0000-0000-0000-000000000001";
const childId = "00000000-0000-0000-0000-000000000002";
const adultA = "00000000-0000-0000-0000-000000000003";
const adultB = "00000000-0000-0000-0000-000000000004";
const adultC = "00000000-0000-0000-0000-000000000005";
const outsider = "00000000-0000-0000-0000-000000000099";
const checkInId = "00000000-0000-0000-0000-000000000006";
const task5EpisodeId =
  "00000000-0000-0000-0000-000000000007";
const task5DeliveryId =
  "00000000-0000-0000-0000-000000000008";
const task5WrongDeliveryId =
  "00000000-0000-0000-0000-000000000009";
const adultD = "00000000-0000-0000-0000-000000000010";
const adultE = "00000000-0000-0000-0000-000000000011";
const task6MessageId =
  "00000000-0000-0000-0000-000000000012";
const progressEvidenceMessageId =
  "33333333-3333-4333-8333-333333333333";
const snapshotChildId =
  "00000000-0000-0000-0000-000000000013";
const snapshotAdultA =
  "00000000-0000-0000-0000-000000000014";
const snapshotAdultB =
  "00000000-0000-0000-0000-000000000015";
const database = "homa_child_progress_test";
const PROCESS_TIMEOUT_MS = 60_000;
const POSTGRES_LOCK_TIMEOUT_MS = 5_000;
const POSTGRES_STATEMENT_TIMEOUT_MS = 30_000;

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
      const { stdout } = await execFileAsync("brew", [
        "--prefix",
        formula,
      ]);
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
      await executableExists(path.join(candidate, "postgres")) &&
      await executableExists(path.join(candidate, "initdb")) &&
      await executableExists(path.join(candidate, "pg_ctl")) &&
      await executableExists(path.join(candidate, "psql")) &&
      await executableExists(path.join(candidate, "createdb"))
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

async function runForExitCode(
  executable: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<number> {
  try {
    await run(executable, args, env);
    return 0;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "number"
    ) {
      return error.code;
    }
    throw error;
  }
}

async function allSettledValuesOrThrow<
  const Values extends readonly unknown[],
>(
  promises: { [Index in keyof Values]: Promise<Values[Index]> },
): Promise<Values> {
  const settled = await Promise.allSettled(promises);
  for (const result of settled) {
    if (result.status === "rejected") throw result.reason;
  }
  return settled.map(
    (result) => (result as PromiseFulfilledResult<unknown>).value,
  ) as unknown as Values;
}

function requireRunningPromise<T>(
  promise: Promise<T> | null,
  label: string,
): Promise<T> {
  if (promise === null) {
    throw new Error(`${label} was not running`);
  }
  return promise;
}

const prerequisiteSql = `
  create extension if not exists pgcrypto;
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
  create table public.families (
    id uuid primary key,
    email text,
    first_name text,
    last_name text,
    us_state text,
    status text not null default 'anonymous',
    source text not null default 'test',
    utm jsonb not null default '{}'::jsonb,
    resume_token_hash text,
    phone_e164 text,
    parent_display_name text,
    context jsonb not null default '{}'::jsonb,
    time_zone text,
    -- Mirrors migration #85: attachAuthUser writes it.
    sandbox boolean not null default false,
    updated_at timestamptz not null default now()
  );
  create table public.children (
    id uuid primary key,
    family_id uuid not null,
    name text not null,
    birth_month date not null,
    context jsonb not null default '{}'::jsonb,
    profile jsonb not null default '{}'::jsonb,
    -- Mirrors the real schema's composite target, so lesson_recordings
    -- below can carry the same (child_id, family_id) cascade it has in
    -- production rather than a weaker stand-in.
    unique (id, family_id)
  );
  -- removeChild reads this table BEFORE deleting the child, to collect
  -- the blob prefixes the cascade is about to make unreachable. The
  -- harness carries it so that dependency is exercised rather than
  -- mocked away: without it the delete throws 42P01 here and nowhere
  -- else, which is exactly how CI caught it.
  create table public.lesson_recordings (
    id uuid primary key default gen_random_uuid(),
    family_id uuid not null,
    child_id uuid not null,
    foreign key (child_id, family_id)
      references public.children (id, family_id) on delete cascade
  );
  create table public.family_members (
    family_id uuid not null references public.families(id)
      on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null,
    display_name text,
    primary key (family_id, user_id)
  );
  create table public.conversation_inbound_receipts (
    id uuid primary key default gen_random_uuid(),
    family_id uuid
  );
  create table public.family_memories (
    id uuid primary key default gen_random_uuid(),
    family_id uuid not null,
    child_id uuid,
    kind text,
    content text,
    source text
  );
  -- The fold preserves distinct record ids, even when block values match.
  create table public.hours_log (
    id uuid primary key default gen_random_uuid(),
    family_id uuid,
    child_id uuid,
    subject text not null default 'other',
    minutes integer not null default 1,
    happened_on date not null default current_date,
    source text not null default 'chat',
    note text,
    created_at timestamptz not null default now()
  );
  -- Empty graph relations used by the real fold; the dedicated Hours contract
  -- applies every real migration and checks linked rows and operation receipts.
  create table public.hours_categories (
    id uuid primary key default gen_random_uuid(),
    family_id uuid not null references public.families(id) on delete cascade,
    subject text not null,
    name text not null,
    unique (family_id, subject, name)
  );
  create table public.learning_write_operations (id uuid primary key default gen_random_uuid(), family_id uuid);
  create table public.planner_learning_activities (id uuid primary key default gen_random_uuid(), family_id uuid);
  create table public.planner_learning_activity_children (family_id uuid);
  create table public.planner_learning_activity_hours (family_id uuid);
  create table public.call_transcripts (
    id uuid primary key default gen_random_uuid(),
    family_id uuid
  );
  create table public.learning_reviews (
    id uuid primary key default gen_random_uuid(),
    family_id uuid
  );
  create table public.materials (
    id uuid primary key default gen_random_uuid(),
    family_id uuid
  );
  create table public.model_usage (
    id uuid primary key default gen_random_uuid(),
    family_id uuid
  );
  create table public.homa_task_runs (
    id uuid primary key default gen_random_uuid(),
    family_id uuid
  );
  create table public.child_curriculum_calls (
    id uuid primary key default gen_random_uuid(),
    family_id uuid
  );
  create table public.conversation_thread_bindings (
    id uuid primary key default gen_random_uuid(),
    family_id uuid not null,
    channel text not null,
    thread_key_hash text not null
  );
  create table public.events (
    id bigint generated always as identity primary key,
    name text not null,
    props jsonb not null default '{}'::jsonb,
    family_id uuid,
    created_at timestamptz not null default now()
  );
  create table public.family_skills (
    id uuid primary key default gen_random_uuid(),
    family_id uuid not null,
    name text not null,
    updated_at timestamptz not null default now()
  );
  create table public.agent_schedules (
    id uuid primary key default gen_random_uuid(),
    family_id uuid not null,
    kind text not null
  );
  -- Family folds and account deletion share these service-only ownership
  -- records. The focused harness mirrors the production constraints instead
  -- of applying unrelated billing and library migrations.
  create table public.account_deletion_jobs (
    id uuid primary key default gen_random_uuid(),
    family_id uuid,
    status text not null,
    requested_at timestamptz not null default now()
  );
  create table public.account_deletion_artifact_tombstones (
    family_id uuid primary key,
    deletion_job_id uuid not null
      references public.account_deletion_jobs(id) on delete cascade,
    created_at timestamptz not null default now()
  );
  create table public.family_artifact_prefixes (
    artifact_family_id uuid primary key,
    owner_family_id uuid not null
      references public.families(id) on delete cascade,
    inherited_at timestamptz not null default now(),
    check (artifact_family_id <> owner_family_id)
  );
  create table public.family_artifact_prefix_candidates (
    owner_family_id uuid not null references public.families(id),
    artifact_family_id uuid not null,
    evidence_kind text not null,
    evidence_count integer not null,
    observed_at timestamptz not null default now(),
    primary key (owner_family_id, artifact_family_id, evidence_kind),
    check (artifact_family_id <> owner_family_id)
  );
  -- Mirrors the hard-delete branches of migration 20260808170000 used by this
  -- harness. The focused schema owns the artifact ledgers above, so it must
  -- also carry the exact active guard identity that makes that state ready.
  create function public.guard_family_hard_delete_protocol()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $guard$
  declare
    delete_mode text := current_setting('homa.family_delete_mode', true);
    destination_family_id uuid;
    active_deletion_job_id uuid;
  begin
    if delete_mode = 'family-fold-v2' then
      select prefix.owner_family_id
      into destination_family_id
      from public.family_artifact_prefixes prefix
      where prefix.artifact_family_id = old.id;

      if destination_family_id is null
        or not exists (
          select 1
          from public.families destination
          where destination.id = destination_family_id
        )
        or exists (
          select 1
          from public.family_artifact_prefixes prefix
          where prefix.owner_family_id = old.id
        )
        or exists (
          select 1
          from public.family_artifact_prefix_candidates candidate
          where candidate.owner_family_id = old.id
        )
        or exists (
          select 1
          from public.account_deletion_artifact_tombstones tombstone
          where tombstone.family_id in (old.id, destination_family_id)
        )
        or exists (
          select 1
          from public.family_artifact_prefixes prefix
          where prefix.artifact_family_id = destination_family_id
             or (
               prefix.artifact_family_id = old.id
               and prefix.owner_family_id <> destination_family_id
             )
        )
        or exists (
          select 1
          from public.family_artifact_prefix_candidates candidate
          where candidate.artifact_family_id in (
            old.id,
            destination_family_id
          )
        )
        or exists (
          select 1
          from public.family_artifact_prefix_candidates candidate
          join public.family_artifact_prefixes prefix
            on prefix.artifact_family_id = candidate.artifact_family_id
          where prefix.owner_family_id = destination_family_id
            and candidate.owner_family_id <> destination_family_id
        )
      then
        raise exception using
          errcode = '55000',
          message = 'family fold did not prove its artifact disposition';
      end if;
      return old;
    end if;

    if delete_mode = 'account-deletion-v2' then
      select job.id
      into active_deletion_job_id
      from public.account_deletion_jobs job
      where job.family_id = old.id
        and job.status = 'running';

      if active_deletion_job_id is null
        or old.status <> 'deleted'
        or not exists (
          select 1
          from public.account_deletion_artifact_tombstones tombstone
          where tombstone.family_id = old.id
            and tombstone.deletion_job_id = active_deletion_job_id
        )
        or exists (
          select 1
          from public.family_artifact_prefixes prefix
          left join public.account_deletion_artifact_tombstones tombstone
            on tombstone.family_id = prefix.artifact_family_id
           and tombstone.deletion_job_id = active_deletion_job_id
          where prefix.owner_family_id = old.id
            and tombstone.family_id is null
        )
        or exists (
          select 1
          from public.family_artifact_prefixes prefix
          join public.families live_artifact_family
            on live_artifact_family.id = prefix.artifact_family_id
          where prefix.owner_family_id = old.id
        )
        or exists (
          select 1
          from public.family_artifact_prefix_candidates candidate
          where candidate.owner_family_id = old.id
        )
        or exists (
          select 1
          from public.family_artifact_prefix_candidates candidate
          where candidate.owner_family_id <> old.id
            and (
              candidate.artifact_family_id = old.id
              or exists (
                select 1
                from public.family_artifact_prefixes prefix
                where prefix.owner_family_id = old.id
                  and prefix.artifact_family_id = candidate.artifact_family_id
              )
            )
        )
      then
        raise exception using
          errcode = '55000',
          message = 'account deletion did not prove its artifact disposition';
      end if;
      return old;
    end if;

    raise exception using
      errcode = '55000',
      message = 'family hard delete requires a recognized transaction protocol';
  end;
  $guard$;
  create trigger families_hard_delete_protocol_guard
  before delete on public.families
  for each row execute function public.guard_family_hard_delete_protocol();
  create function public.guard_family_deletion_status_transition()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $status_guard$
  begin
    if new.status = 'deleted'
      and old.status is distinct from 'deleted'
      and current_setting('homa.family_delete_mode', true)
        is distinct from 'account-deletion-v2'
    then
      raise exception using
        errcode = '55000',
        message = 'family deletion acceptance requires the account deletion protocol';
    end if;
    return new;
  end;
  $status_guard$;
  create trigger families_deletion_status_protocol_guard
  before update of status on public.families
  for each row execute function public.guard_family_deletion_status_transition();
  create table public.conversation_episodes (
    id uuid primary key default gen_random_uuid(),
    family_id uuid not null
  );
  create table public.conversation_deliveries (
    id uuid primary key default gen_random_uuid(),
    family_id uuid not null,
    episode_id uuid,
    recipient_member_user_id uuid,
    channel text not null default 'sms',
    destination_hash text not null default '',
    status text not null default 'sent',
    replied_at timestamptz
  );
  create table public.conversation_messages (
    id uuid primary key default gen_random_uuid(),
    family_id uuid not null
  );
  create table public.conversation_open_loops (
    id uuid primary key default gen_random_uuid(),
    family_id uuid not null,
    episode_id uuid not null,
    message_id uuid not null,
    delivery_id uuid not null unique,
    kind text not null,
    state text not null default 'open',
    prompt_key text,
    expires_at timestamptz not null,
    resolved_at timestamptz,
    resolved_by_message_id uuid
  );
  create table public.conversation_offer_fulfillments (
    id uuid primary key default gen_random_uuid(),
    family_id uuid not null
  );
  create table public.child_answers (
    child_id uuid not null,
    question_id text not null,
    answer text not null,
    source text,
    answered_at timestamptz not null default now(),
    primary key (child_id, question_id)
  );
  create table public.child_plans (
    child_id uuid not null,
    subject_id text not null,
    plan jsonb not null,
    progress jsonb not null default '{}'::jsonb
  );
  create table public.child_reports (
    child_id uuid primary key,
    scores jsonb not null,
    bank_version text not null,
    scorer_version text,
    scored_birth_date date,
    scored_age_months integer,
    token text,
    history jsonb not null default '[]'::jsonb,
    narrative jsonb,
    narrative_meta jsonb,
    generated_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create function public.is_child_family_member(target_child_id uuid)
  returns boolean language sql stable as $$ select false $$;
  grant usage on schema public to anon, authenticated;
  grant execute on function public.is_child_family_member(uuid)
    to authenticated;
`;

interface FamilyFoldProgressFixture {
  childId: string;
  checkInId: string;
  adultAId: string;
}

const FAMILY_FOLD_PROGRESS_TABLES = [
  ["child_progress_evidence", 2],
  ["child_progress_operations", 1],
  ["child_progress_revisions", 1],
  ["child_progress_live", 1],
  ["progress_check_ins", 1],
  ["progress_check_in_responses", 1],
  ["child_progress_conflicts", 1],
  ["child_progress_snapshots", 1],
  ["map_walk_prompts", 1],
] as const;

async function seedFamilyFoldProgress(
  tx: postgres.TransactionSql,
  input: {
    sourceFamilyId: string;
    destinationFamilyId: string;
    sourceHasMembers: boolean;
    label: string;
  },
): Promise<FamilyFoldProgressFixture> {
  const childId = randomUUID();
  const adultAId = randomUUID();
  const adultBId = randomUUID();
  const episodeId = randomUUID();
  const deliveryId = randomUUID();
  const inboundMessageId = randomUUID();
  const checkInId = randomUUID();
  await tx`
    insert into auth.users (id)
    values (${adultAId}), (${adultBId})
  `;
  await tx`
    insert into public.family_members (
      family_id, user_id, role, display_name
    )
    values
      (${input.destinationFamilyId}, ${adultAId}, 'parent', 'Adult A'),
      (${input.destinationFamilyId}, ${adultBId}, 'partner', 'Adult B')
  `;
  if (input.sourceHasMembers) {
    await tx`
      insert into public.family_members (
        family_id, user_id, role, display_name
      )
      values
        (${input.sourceFamilyId}, ${adultAId}, 'parent', 'Adult A'),
        (${input.sourceFamilyId}, ${adultBId}, 'partner', 'Adult B')
    `;
  }
  await tx`
    insert into public.children (
      id, family_id, name, birth_month, context
    )
    values (
      ${childId}, ${input.sourceFamilyId}, 'Fold child',
      '2019-07-01', '{}'::jsonb
    )
  `;
  await tx`
    insert into public.conversation_episodes (id, family_id)
    values (${episodeId}, ${input.sourceFamilyId})
  `;
  await tx`
    insert into public.conversation_deliveries (
      id, family_id, episode_id, recipient_member_user_id, status
    )
    values (
      ${deliveryId}, ${input.sourceFamilyId}, ${episodeId},
      ${adultAId}, 'sent'
    )
  `;
  await tx`
    insert into public.conversation_messages (id, family_id)
    values (${inboundMessageId}, ${input.sourceFamilyId})
  `;
  await tx`
    insert into public.progress_check_ins (
      id, child_id, family_id, idempotency_key, purpose, scope,
      state, active_member_user_id, prompt_recipient_member_user_id,
      revision, current_item_id, current_delivery_id, episode_id,
      pending_runtime_session_id, pending_turn_id
    )
    values (
      ${checkInId}, ${childId}, ${input.sourceFamilyId},
      ${`${input.label}:check-in`}, 'whole_map_refresh', '{}'::jsonb,
      'active', null, null, 1, 'math.counts-to-5',
      ${deliveryId}, ${episodeId}, 'fold-runtime', 'fold-turn'
    )
  `;
  const evidenceRows = await tx<{ id: string }[]>`
    insert into public.child_progress_evidence (
      child_id, family_id, item_id, answer, source,
      member_user_id, channel, message_id, check_in_id,
      observed_at, idempotency_key
    )
    values
      (
        ${childId}, ${input.sourceFamilyId}, 'math.counts-to-5',
        'easily', 'check_in', ${adultAId}, 'sms',
        ${inboundMessageId}, ${checkInId},
        '2026-07-12T08:00:00.000000Z',
        ${`${input.label}:evidence-a`}
      ),
      (
        ${childId}, ${input.sourceFamilyId}, 'math.counts-to-5',
        'not_yet', 'check_in', ${adultBId}, 'sms',
        ${inboundMessageId}, ${checkInId},
        '2026-07-12T08:01:00.000000Z',
        ${`${input.label}:evidence-b`}
      )
    returning id
  `;
  await tx`
    insert into public.progress_check_in_responses (
      child_id, family_id, check_in_id, revision, item_id, answer,
      member_user_id, delivery_id, channel, provider_message_id,
      inbound_message_id, is_evidence, evidence_id,
      idempotency_key, result
    )
    values (
      ${childId}, ${input.sourceFamilyId}, ${checkInId}, 1,
      'math.counts-to-5', 'skip', ${adultAId}, ${deliveryId},
      'sms', ${`${input.label}:provider`}, ${inboundMessageId},
      false, null, ${`${input.label}:response`},
      '{"status":"pending"}'::jsonb
    )
  `;
  await tx`
    insert into public.child_progress_conflicts (
      child_id, family_id, item_id, evidence_id_a, evidence_id_b
    )
    values (
      ${childId}, ${input.sourceFamilyId}, 'math.counts-to-5',
      ${evidenceRows[0].id}, ${evidenceRows[1].id}
    )
  `;
  await tx`
    insert into public.child_progress_operations (
      child_id, family_id, idempotency_key, payload_hash, status,
      evidence_ids, affected_item_ids, conflict_ids, result
    )
    values (
      ${childId}, ${input.sourceFamilyId}, ${`${input.label}:operation`},
      ${"0".repeat(64)}, 'recorded',
      ${tx.array([evidenceRows[0].id])}::uuid[],
      array['math.counts-to-5']::text[], '{}'::uuid[],
      '{"status":"recorded"}'::jsonb
    )
  `;
  await tx`
    insert into public.child_progress_snapshots (
      child_id, family_id, snapshot_kind, check_in_id, evidence_ids,
      age_months, bank_version, scorer_version, projection, scores
    )
    values (
      ${childId}, ${input.sourceFamilyId}, 'check_in_group',
      ${checkInId}, ${tx.array(evidenceRows.map((row) => row.id))}::uuid[],
      84, 'fold-bank', 'fold-scorer', '{}'::jsonb, '{}'::jsonb
    )
  `;
  await tx`
    update public.child_progress_revisions
    set revision = 17
    where child_id = ${childId}
      and family_id = ${input.sourceFamilyId}
  `;
  await tx`
    insert into public.child_progress_live (
      child_id, family_id, projection, scores, bank_version,
      projection_version, projection_date, source_revision,
      evidence_count, open_conflict_count
    )
    values (
      ${childId}, ${input.sourceFamilyId}, '{}'::jsonb, '{}'::jsonb,
      'fold-bank', 'fold-projection', '2026-07-12', 17, 2, 1
    )
  `;
  await tx`
    insert into public.map_walk_prompts (
      child_id, family_id, subject_id, topic_id, sitting,
      source_revision, item_observed_at, expires_at
    )
    values (
      ${childId}, ${input.sourceFamilyId}, 'math',
      'math.comparing-groups-more-or-fewer', 1, 17, null,
      clock_timestamp() + interval '1 hour'
    )
  `;
  return { childId, checkInId, adultAId };
}

async function assertFoldedProgress(
  tx: postgres.Sql | postgres.TransactionSql,
  input: {
    sourceFamilyId: string;
    destinationFamilyId: string;
    fixture: FamilyFoldProgressFixture;
  },
): Promise<void> {
  for (const [table, expectedCount] of FAMILY_FOLD_PROGRESS_TABLES) {
    const rows = await tx<{ family_id: string; count: number }[]>`
      select family_id, count(*)::integer as count
      from ${tx(table)}
      where child_id = ${input.fixture.childId}
      group by family_id
    `;
    assert.deepEqual(
      [...rows],
      [{
        family_id: input.destinationFamilyId,
        count: expectedCount,
      }],
      `${table} family fold`,
    );
  }
  const [checkIn] = await tx<
    { state: string; revision: number }[]
  >`
    select state, revision
    from public.progress_check_ins
    where id = ${input.fixture.checkInId}
  `;
  assert.deepEqual(checkIn, { state: "active", revision: 1 });
  const [revision] = await tx<
    { revision: string; live_revision: string }[]
  >`
    select revision.revision::text as revision,
           live.source_revision::text as live_revision
    from public.child_progress_revisions revision
    join public.child_progress_live live
      on live.child_id = revision.child_id
     and live.family_id = revision.family_id
    where revision.child_id = ${input.fixture.childId}
      and revision.family_id = ${input.destinationFamilyId}
  `;
  assert.ok(BigInt(revision.revision) >= BigInt(17));
  assert.ok(
    BigInt(revision.revision) >
      BigInt(revision.live_revision),
  );
  const [crossFamily] = await tx<{ count: number }[]>`
    select (
      (
        select count(*)
        from public.child_progress_evidence evidence
        join public.conversation_messages message
          on message.id = evidence.message_id
        where evidence.child_id = ${input.fixture.childId}
          and evidence.family_id <> message.family_id
      )
      +
      (
        select count(*)
        from public.progress_check_ins check_in
        join public.conversation_deliveries delivery
          on delivery.id = check_in.current_delivery_id
        join public.conversation_episodes episode
          on episode.id = check_in.episode_id
        where check_in.child_id = ${input.fixture.childId}
          and (
            check_in.family_id <> delivery.family_id
            or check_in.family_id <> episode.family_id
          )
      )
      +
      (
        select count(*)
        from public.progress_check_in_responses response
        join public.progress_check_ins check_in
          on check_in.id = response.check_in_id
        join public.conversation_messages message
          on message.id = response.inbound_message_id
        where response.child_id = ${input.fixture.childId}
          and (
            response.family_id <> check_in.family_id
            or response.family_id <> message.family_id
          )
      )
      +
      (
        select count(*)
        from public.child_progress_conflicts conflict
        join public.child_progress_evidence evidence_a
          on evidence_a.id = conflict.evidence_id_a
        join public.child_progress_evidence evidence_b
          on evidence_b.id = conflict.evidence_id_b
        where conflict.child_id = ${input.fixture.childId}
          and (
            conflict.family_id <> evidence_a.family_id
            or conflict.family_id <> evidence_b.family_id
          )
      )
      +
      (
        select count(*)
        from public.child_progress_snapshots snapshot
        join public.progress_check_ins check_in
          on check_in.id = snapshot.check_in_id
        where snapshot.child_id = ${input.fixture.childId}
          and snapshot.family_id <> check_in.family_id
      )
    )::integer as count
  `;
  assert.equal(crossFamily.count, 0);
  const [oldFamily] = await tx<{ count: number }[]>`
    select count(*)::integer as count
    from public.families
    where id = ${input.sourceFamilyId}
  `;
  assert.equal(oldFamily.count, 0);
}

async function runFamilyFoldCompatibilityAssertions(
  sql: postgres.Sql,
): Promise<void> {
  const stubSourceFamilyId = randomUUID();
  const stubDestinationFamilyId = randomUUID();
  const finalDestinationFamilyId = randomUUID();
  const inheritedArtifactFamilyId = randomUUID();
  const candidateArtifactFamilyId = randomUUID();
  await sql`
    insert into public.families (id, email, context)
    values
      (${stubSourceFamilyId}, null, '{"from":"stub"}'::jsonb),
      (
        ${stubDestinationFamilyId}, 'stub-destination@example.com',
        '{"into":"destination"}'::jsonb
      )
  `;
  const stubFixture = await sql.begin((tx) =>
    seedFamilyFoldProgress(tx, {
      sourceFamilyId: stubSourceFamilyId,
      destinationFamilyId: stubDestinationFamilyId,
      sourceHasMembers: true,
      label: "stub-family-fold",
    })
  );
  await sql`
    insert into public.family_artifact_prefixes (
      owner_family_id,
      artifact_family_id
    )
    values (${stubSourceFamilyId}, ${inheritedArtifactFamilyId})
  `;
  await sql`
    insert into public.family_artifact_prefix_candidates (
      owner_family_id,
      artifact_family_id,
      evidence_kind,
      evidence_count
    )
    values (
      ${stubSourceFamilyId},
      ${candidateArtifactFamilyId},
      'lesson_audio',
      2
    )
  `;
  await sql.begin(async (tx) => {
    await tx`
      delete from public.family_members
      where family_id = ${stubSourceFamilyId}
    `;
    await tx`
      update public.child_progress_live live
      set source_revision = revision.revision
      from public.child_progress_revisions revision
      where live.child_id = ${stubFixture.childId}
        and live.family_id = ${stubSourceFamilyId}
        and revision.child_id = live.child_id
        and revision.family_id = live.family_id
    `;
    // Equal-shaped records remain distinct during the family fold.
    await tx`
      insert into public.hours_log (family_id, subject, minutes, happened_on, note)
      values
        (${stubDestinationFamilyId}, 'math', 30, '2026-07-20', 'destination original'),
        (${stubSourceFamilyId}, 'math', 30, '2026-07-20', 'distinct source activity'),
        (${stubSourceFamilyId}, 'reading', 45, '2026-07-21', 'moves with the fold')
    `;
    await tx`
      insert into public.hours_categories (family_id, subject, name)
      values
        (${stubDestinationFamilyId}, 'reading', 'Read-aloud'),
        (${stubSourceFamilyId}, 'reading', 'Read-aloud'),
        (${stubSourceFamilyId}, 'math', 'Unused practice')
    `;
    assert.equal(
      await foldStubFamilyIntoTx(
        tx,
        stubSourceFamilyId,
        stubDestinationFamilyId,
      ),
      true,
    );
    await assertFoldedProgress(tx, {
      sourceFamilyId: stubSourceFamilyId,
      destinationFamilyId: stubDestinationFamilyId,
      fixture: stubFixture,
    });
    const foldedHours = await tx<
      { subject: string; minutes: number; note: string | null }[]
    >`
      select subject, minutes, note from public.hours_log
      where family_id = ${stubDestinationFamilyId}
      order by subject, note
    `;
    assert.deepEqual(
      foldedHours.map((row) => ({ ...row })),
      [
        { subject: "math", minutes: 30, note: "destination original" },
        { subject: "math", minutes: 30, note: "distinct source activity" },
        { subject: "reading", minutes: 45, note: "moves with the fold" },
      ],
    );
    const [sourceHours] = await tx<{ count: number }[]>`
      select count(*)::integer as count from public.hours_log
      where family_id = ${stubSourceFamilyId}
    `;
    assert.equal(sourceHours.count, 0);
    const foldedCategories = await tx<{ subject: string; name: string }[]>`
      select subject, name from public.hours_categories
      where family_id = ${stubDestinationFamilyId} order by subject, name
    `;
    assert.deepEqual(foldedCategories.map((row) => ({ ...row })), [
      { subject: "math", name: "Unused practice" },
      { subject: "reading", name: "Read-aloud" },
    ]);
    const [sourceCategories] = await tx<{ count: number }[]>`
      select count(*)::integer as count from public.hours_categories
      where family_id = ${stubSourceFamilyId}
    `;
    assert.equal(sourceCategories.count, 0);
    const inheritedPrefixes = await tx<Array<{ artifact_family_id: string }>>`
      select artifact_family_id
      from public.family_artifact_prefixes
      where owner_family_id = ${stubDestinationFamilyId}
      order by artifact_family_id
    `;
    assert.deepEqual(
      new Set(inheritedPrefixes.map((row) => row.artifact_family_id)),
      new Set([stubSourceFamilyId, inheritedArtifactFamilyId]),
    );
  });
  await sql`
    insert into public.families (id, email, context)
    values (
      ${finalDestinationFamilyId},
      'final-destination@example.com',
      '{"into":"final"}'::jsonb
    )
  `;
  await sql.begin(async (tx) => {
    assert.equal(
      await foldFamilyDataIntoTx(
        tx,
        stubDestinationFamilyId,
        finalDestinationFamilyId,
      ),
      true,
    );
    await assertFoldedProgress(tx, {
      sourceFamilyId: stubDestinationFamilyId,
      destinationFamilyId: finalDestinationFamilyId,
      fixture: stubFixture,
    });
    const transitivePrefixes = await tx<Array<{ artifact_family_id: string }>>`
      select artifact_family_id
      from public.family_artifact_prefixes
      where owner_family_id = ${finalDestinationFamilyId}
      order by artifact_family_id
    `;
    assert.deepEqual(
      new Set(transitivePrefixes.map((row) => row.artifact_family_id)),
      new Set([
        stubSourceFamilyId,
        stubDestinationFamilyId,
        inheritedArtifactFamilyId,
      ]),
    );
    const transitiveCandidates = await tx<Array<{
      artifact_family_id: string;
      evidence_count: number;
    }>>`
      select artifact_family_id, evidence_count
      from public.family_artifact_prefix_candidates
      where owner_family_id = ${finalDestinationFamilyId}
    `;
    assert.deepEqual([...transitiveCandidates], [{
      artifact_family_id: candidateArtifactFamilyId,
      evidence_count: 2,
    }]);
  });

  const deletingSourceFamilyId = randomUUID();
  const deletingDestinationFamilyId = randomUUID();
  const deletionJobId = randomUUID();
  await sql`
    insert into public.families (id, email)
    values
      (${deletingSourceFamilyId}, null),
      (${deletingDestinationFamilyId}, 'deleting-destination@example.com')
  `;
  await sql`
    insert into public.account_deletion_jobs (
      id,
      family_id,
      status
    )
    values (${deletionJobId}, ${deletingDestinationFamilyId}, 'preparing')
  `;
  await sql`
    insert into public.account_deletion_artifact_tombstones (
      family_id,
      deletion_job_id
    )
    values (${deletingDestinationFamilyId}, ${deletionJobId})
  `;
  assert.equal(
    await sql.begin((tx) => foldStubFamilyIntoTx(
      tx,
      deletingSourceFamilyId,
      deletingDestinationFamilyId,
    )),
    false,
  );
  const [deletionFirstFamilies] = await sql<{ count: number }[]>`
    select count(*)::integer as count
    from public.families
    where id in (${deletingSourceFamilyId}, ${deletingDestinationFamilyId})
  `;
  assert.equal(deletionFirstFamilies.count, 2);
  await sql`delete from public.account_deletion_jobs where id = ${deletionJobId}`;

  const corruptSourceFamilyId = randomUUID();
  const corruptDestinationFamilyId = randomUUID();
  await sql`
    insert into public.families (id, email)
    values
      (${corruptSourceFamilyId}, null),
      (${corruptDestinationFamilyId}, 'corrupt-destination@example.com')
  `;
  await sql`
    insert into public.family_artifact_prefixes (
      owner_family_id,
      artifact_family_id
    )
    values (${corruptDestinationFamilyId}, ${corruptSourceFamilyId})
  `;
  assert.equal(
    await sql.begin((tx) => foldStubFamilyIntoTx(
      tx,
      corruptSourceFamilyId,
      corruptDestinationFamilyId,
    )),
    false,
  );
  const [corruptFamilies] = await sql<{ count: number }[]>`
    select count(*)::integer as count
    from public.families
    where id in (${corruptSourceFamilyId}, ${corruptDestinationFamilyId})
  `;
  assert.equal(corruptFamilies.count, 2);

  const candidateConflictSourceFamilyId = randomUUID();
  const candidateConflictDestinationFamilyId = randomUUID();
  const candidateConflictOwnerFamilyId = randomUUID();
  const candidateConflictArtifactFamilyId = randomUUID();
  await sql`
    insert into public.families (id, email)
    values
      (${candidateConflictSourceFamilyId}, null),
      (
        ${candidateConflictDestinationFamilyId},
        'candidate-conflict-destination@example.com'
      ),
      (
        ${candidateConflictOwnerFamilyId},
        'candidate-conflict-owner@example.com'
      )
  `;
  await sql`
    insert into public.family_artifact_prefixes (
      owner_family_id,
      artifact_family_id
    )
    values (
      ${candidateConflictSourceFamilyId},
      ${candidateConflictArtifactFamilyId}
    )
  `;
  await sql`
    insert into public.family_artifact_prefix_candidates (
      owner_family_id,
      artifact_family_id,
      evidence_kind,
      evidence_count
    )
    values (
      ${candidateConflictOwnerFamilyId},
      ${candidateConflictArtifactFamilyId},
      'material_output',
      1
    )
  `;
  assert.equal(
    await sql.begin((tx) => foldStubFamilyIntoTx(
      tx,
      candidateConflictSourceFamilyId,
      candidateConflictDestinationFamilyId,
    )),
    false,
  );
  const [candidateConflictState] = await sql<Array<{
    families: number;
    source_aliases: number;
    destination_aliases: number;
    candidates: number;
  }>>`
    select
      (select count(*)::integer from public.families
        where id in (
          ${candidateConflictSourceFamilyId},
          ${candidateConflictDestinationFamilyId},
          ${candidateConflictOwnerFamilyId}
        )) as families,
      (select count(*)::integer from public.family_artifact_prefixes
        where owner_family_id = ${candidateConflictSourceFamilyId}
          and artifact_family_id = ${candidateConflictArtifactFamilyId}) as source_aliases,
      (select count(*)::integer from public.family_artifact_prefixes
        where owner_family_id = ${candidateConflictDestinationFamilyId}) as destination_aliases,
      (select count(*)::integer from public.family_artifact_prefix_candidates
        where owner_family_id = ${candidateConflictOwnerFamilyId}
          and artifact_family_id = ${candidateConflictArtifactFamilyId}) as candidates
  `;
  assert.deepEqual(candidateConflictState, {
    families: 3,
    source_aliases: 1,
    destination_aliases: 0,
    candidates: 1,
  });

  const attachSourceFamilyId = randomUUID();
  const attachDestinationFamilyId = randomUUID();
  await sql`
    insert into public.families (id, email, context)
    values
      (${attachSourceFamilyId}, null, '{"from":"attach"}'::jsonb),
      (
        ${attachDestinationFamilyId}, 'returning@example.com',
        '{"into":"account"}'::jsonb
      )
  `;
  const attachFixture = await sql.begin((tx) =>
    seedFamilyFoldProgress(tx, {
      sourceFamilyId: attachSourceFamilyId,
      destinationFamilyId: attachDestinationFamilyId,
      sourceHasMembers: true,
      label: "attach-family-fold",
    })
  );
  const attached = await attachAuthUser(
    {
      familyId: attachSourceFamilyId,
      authUserId: attachFixture.adultAId,
      email: "returning@example.com",
      firstName: "Returning",
      allowExistingFamilyFold: true,
    },
    sql,
  );
  assert.equal(attached.familyId, attachDestinationFamilyId);
  assert.equal(attached.returning, true);
  await assertFoldedProgress(sql, {
    sourceFamilyId: attachSourceFamilyId,
    destinationFamilyId: attachDestinationFamilyId,
    fixture: attachFixture,
  });
}

async function runWalkPromptAssertions(
  sql: postgres.Sql,
  repository: PostgresChildProgressRepository,
  service: ChildProgressService,
): Promise<void> {
  const walkFamilyId = randomUUID();
  const walkChildId = randomUUID();
  const topicId = "math.comparing-groups-more-or-fewer";
  await sql`
    insert into public.families (id, time_zone)
    values (${walkFamilyId}, 'America/Chicago')
  `;
  await sql`
    insert into public.children (
      id, family_id, name, birth_month
    )
    values (
      ${walkChildId}, ${walkFamilyId}, 'Walk child', '2019-07-01'
    )
  `;
  let writerCalls = 0;
  let acceptedCount = 0;
  const promptService = new MapWalkPromptService(
    repository,
    service,
    {
      afterProgressWrite: async () => {
        writerCalls += 1;
      },
    },
  );

  for (const [index, answer] of [
    "easily",
    "getting_there",
    "not_yet",
    "not_sure",
    "skip",
  ].entries()) {
    const promptId = await promptService.createPrompt({
      familyId: walkFamilyId,
      childId: walkChildId,
      memberUserId: null,
      subjectId: "math",
      topicId,
      sitting: 1,
      now: new Date(
        `2026-07-12T08:0${index}:00.000Z`,
      ),
    });
    assert.ok(promptId);
    assert.equal(
      await promptService.createPrompt({
        familyId: walkFamilyId,
        childId: walkChildId,
        memberUserId: null,
        subjectId: "math",
        topicId,
        sitting: 1,
        now: new Date(
          `2026-07-12T08:0${index}:05.000Z`,
        ),
      }),
      promptId,
    );
    const idempotencyKey = randomUUID();
    const input = {
      promptId,
      familyId: walkFamilyId,
      childId: walkChildId,
      subjectId: "math",
      topicId,
      answer: answer as MapAnswer,
      sitting: 1,
      memberUserId: null,
      channel: "web" as const,
      idempotencyKey,
      now: new Date(
        `2026-07-12T08:0${index}:30.000Z`,
      ),
    };
    if (index === 0) {
      assert.deepEqual(
        await promptService.consumePrompt({
          ...input,
          sitting: 2,
        }),
        { status: "rejected", reason: "stale_sitting" },
      );
    }
    const accepted = await promptService.consumePrompt(input);
    assert.equal(accepted.status, "accepted");
    acceptedCount += 1;
    const callsAfterAccept = writerCalls;
    const [receiptBeforeReplay] = await sql<
      { consumed_at: string; result: unknown }[]
    >`
      select consumed_at::text as consumed_at, result
      from public.map_walk_prompts
      where id = ${promptId}
    `;
    const replay = await promptService.consumePrompt(
      {
        ...input,
        now: new Date(
          `2026-07-12T08:0${index}:45.000Z`,
        ),
      },
    );
    assert.equal(replay.status, "replay");
    assert.equal(writerCalls, callsAfterAccept);
    const [receiptAfterReplay] = await sql<
      { consumed_at: string; result: unknown }[]
    >`
      select consumed_at::text as consumed_at, result
      from public.map_walk_prompts
      where id = ${promptId}
    `;
    assert.deepEqual(receiptAfterReplay, receiptBeforeReplay);
    assert.deepEqual(
      await promptService.consumePrompt(
        {
          ...input,
          answer: answer === "skip" ? "not_sure" : "skip",
        },
      ),
      {
        status: "rejected",
        reason: "prompt_already_consumed",
      },
    );
    assert.deepEqual(
      await promptService.consumePrompt(
        {
          ...input,
          idempotencyKey: randomUUID(),
        },
      ),
      {
        status: "rejected",
        reason: "prompt_already_consumed",
      },
    );
    await sql`
      delete from public.map_walk_prompts
      where child_id = ${walkChildId}
        and family_id = ${walkFamilyId}
        and consumed_at is null
    `;
  }
  assert.equal(acceptedCount, 5);
  assert.equal(writerCalls, 5);
  const [coverageState] = await sql<
    {
      answer: string;
      active_evidence: number;
      accepted_prompts: number;
    }[]
  >`
    select answer.answer,
           (
             select count(*)::integer
             from public.child_progress_evidence evidence
             where evidence.child_id = ${walkChildId}
               and evidence.family_id = ${walkFamilyId}
               and evidence.item_id = ${topicId}
               and evidence.superseded_at is null
           ) as active_evidence,
           (
             select count(*)::integer
             from public.map_walk_prompts prompt
             where prompt.child_id = ${walkChildId}
               and prompt.family_id = ${walkFamilyId}
               and prompt.consumed_at is not null
           ) as accepted_prompts
    from public.child_answers answer
    where answer.child_id = ${walkChildId}
      and answer.question_id = ${topicId}
  `;
  assert.deepEqual(coverageState, {
    answer: "skip",
    active_evidence: 0,
    accepted_prompts: 5,
  });
  const walkView = await service.getChildProgressView(
    walkFamilyId,
    walkChildId,
  );
  assert.equal(walkView?.scores.observationCount, 0);

  const conflictFamilyId = randomUUID();
  const conflictChildId = randomUUID();
  const conflictAdultA = randomUUID();
  const conflictAdultB = randomUUID();
  await sql`
    insert into public.families (id)
    values (${conflictFamilyId})
  `;
  await sql`
    insert into auth.users (id)
    values (${conflictAdultA}), (${conflictAdultB})
  `;
  await sql`
    insert into public.family_members (
      family_id, user_id, role, display_name
    )
    values
      (${conflictFamilyId}, ${conflictAdultA}, 'parent', 'Conflict A'),
      (${conflictFamilyId}, ${conflictAdultB}, 'partner', 'Conflict B')
  `;
  await sql`
    insert into public.children (
      id, family_id, name, birth_month
    )
    values (
      ${conflictChildId}, ${conflictFamilyId},
      'Conflict child', '2019-07-01'
    )
  `;
  for (const [memberUserId, answer, key] of [
    [conflictAdultA, "easily", "walk-conflict-a"],
    [conflictAdultB, "not_yet", "walk-conflict-b"],
  ] as const) {
    await service.recordProgressEvidence({
      familyId: conflictFamilyId,
      childId: conflictChildId,
      memberUserId,
      source: "onboarding_walk",
      itemId: topicId,
      answer,
      quote: null,
      channel: "web",
      observedAt:
        memberUserId === conflictAdultA
          ? "2026-07-12T08:05:00.000000Z"
          : "2026-07-12T08:05:01.000000Z",
      idempotencyKey: key,
    });
  }
  const conflictPromptId = await promptService.createPrompt({
    familyId: conflictFamilyId,
    childId: conflictChildId,
    memberUserId: conflictAdultA,
    subjectId: "math",
    topicId,
    sitting: 1,
    now: new Date("2026-07-12T08:05:02.000Z"),
  });
  assert.ok(conflictPromptId);
  const conflictInput = {
    promptId: conflictPromptId,
    familyId: conflictFamilyId,
    childId: conflictChildId,
    memberUserId: conflictAdultA,
    subjectId: "math",
    topicId,
    answer: "getting_there" as const,
    sitting: 1,
    channel: "web" as const,
    idempotencyKey: randomUUID(),
    now: new Date("2026-07-12T08:05:03.000Z"),
  };
  assert.deepEqual(
    await promptService.consumePrompt(conflictInput),
    { status: "rejected", reason: "progress_rejected" },
  );
  assert.deepEqual(
    await promptService.consumePrompt(conflictInput),
    { status: "rejected", reason: "progress_rejected" },
  );
  const [conflictPromptState] = await sql<
    { consumed: boolean; prompt_count: number }[]
  >`
    select prompt.consumed_at is not null as consumed,
           (
             select count(*)::integer
             from public.map_walk_prompts all_prompts
             where all_prompts.child_id = ${conflictChildId}
           ) as prompt_count
    from public.map_walk_prompts prompt
    where prompt.id = ${conflictPromptId}
  `;
  assert.deepEqual(conflictPromptState, {
    consumed: false,
    prompt_count: 1,
  });

  const staleChildId = randomUUID();
  await sql`
    insert into public.children (
      id, family_id, name, birth_month
    )
    values (
      ${staleChildId}, ${walkFamilyId}, 'Stale child', '2019-07-01'
    )
  `;
  const concurrentPrompts = await Promise.all([
    promptService.createPrompt({
      familyId: walkFamilyId,
      childId: staleChildId,
      memberUserId: null,
      subjectId: "math",
      topicId,
      sitting: 1,
      now: new Date("2026-07-12T08:06:00.000Z"),
    }),
    promptService.createPrompt({
      familyId: walkFamilyId,
      childId: staleChildId,
      memberUserId: null,
      subjectId: "math",
      topicId,
      sitting: 1,
      now: new Date("2026-07-12T08:06:01.000Z"),
    }),
  ]);
  assert.ok(concurrentPrompts[0]);
  assert.equal(concurrentPrompts[1], concurrentPrompts[0]);
  assert.equal(
    (
      await service.recordProgressEvidence({
        familyId: walkFamilyId,
        childId: staleChildId,
        memberUserId: null,
        source: "onboarding_walk",
        itemId: topicId,
        answer: "easily",
        quote: null,
        observedAt: "2026-07-12T08:06:30.000000Z",
        idempotencyKey: "stale-after-prompt",
      })
    ).status,
    "recorded",
  );
  const staleKey = randomUUID();
  const staleInput = {
      promptId: concurrentPrompts[0],
      familyId: walkFamilyId,
      childId: staleChildId,
      memberUserId: null,
      subjectId: "math",
      topicId,
      answer: "not_sure",
      sitting: 1,
      channel: "web",
      idempotencyKey: staleKey,
      now: new Date("2026-07-12T08:07:00.000Z"),
    } as const;
  assert.deepEqual(
    await promptService.consumePrompt(staleInput),
    { status: "rejected", reason: "stale_prompt" },
  );
  assert.deepEqual(
    await promptService.consumePrompt(staleInput),
    {
      status: "replay",
      response: { ok: false, reason: "stale_prompt" },
    },
  );
  const staleReplacement = await promptService.createPrompt({
    familyId: walkFamilyId,
    childId: staleChildId,
    memberUserId: null,
    subjectId: "math",
    topicId,
    sitting: 1,
    now: new Date("2026-07-12T08:07:01.000Z"),
  });
  assert.ok(staleReplacement);
  assert.notEqual(staleReplacement, concurrentPrompts[0]);

  const expiredPromptId = await promptService.createPrompt({
    familyId: walkFamilyId,
    childId: walkChildId,
    memberUserId: null,
    subjectId: "math",
    topicId,
    sitting: 1,
    now: new Date("2026-07-12T06:00:00.000Z"),
  });
  assert.ok(expiredPromptId);
  const expiredKey = randomUUID();
  const expiredInput = {
    promptId: expiredPromptId,
    familyId: walkFamilyId,
    childId: walkChildId,
    memberUserId: null,
    subjectId: "math",
    topicId,
    answer: "easily" as const,
    sitting: 1,
    channel: "web" as const,
    idempotencyKey: expiredKey,
    now: new Date("2026-07-12T08:00:00.000Z"),
  };
  assert.deepEqual(
    await promptService.consumePrompt(expiredInput),
    { status: "rejected", reason: "expired_prompt" },
  );
  assert.deepEqual(
    await promptService.consumePrompt(expiredInput),
    {
      status: "replay",
      response: { ok: false, reason: "expired_prompt" },
    },
  );
  const expiredReplacement = await promptService.createPrompt({
    familyId: walkFamilyId,
    childId: walkChildId,
    memberUserId: null,
    subjectId: "math",
    topicId,
    sitting: 1,
    now: new Date("2026-07-12T08:00:01.000Z"),
  });
  assert.ok(expiredReplacement);
  assert.notEqual(expiredReplacement, expiredPromptId);

  const stopChildId = randomUUID();
  await sql`
    insert into public.children (
      id, family_id, name, birth_month
    )
    values (
      ${stopChildId}, ${walkFamilyId}, 'Stop child', '2019-07-01'
    )
  `;
  const stopPromptId = await promptService.createPrompt({
    familyId: walkFamilyId,
    childId: stopChildId,
    memberUserId: null,
    subjectId: "math",
    topicId,
    sitting: 1,
    now: new Date("2026-07-12T08:08:00.000Z"),
  });
  assert.ok(stopPromptId);
  const stopInput = {
    promptId: stopPromptId,
    familyId: walkFamilyId,
    childId: stopChildId,
    memberUserId: null,
    subjectId: "math",
    answeredCount: 0,
    idempotencyKey: randomUUID(),
    now: new Date("2026-07-12T08:08:30.000Z"),
  };
  assert.deepEqual(
    await promptService.retirePrompt({
      ...stopInput,
      answeredCount: 1,
      idempotencyKey: randomUUID(),
    }),
    { status: "rejected", reason: "prompt_mismatch" },
  );
  assert.deepEqual(
    await promptService.retirePrompt(stopInput),
    {
      status: "accepted",
      response: {
        ok: true,
        done: true,
        outcome: "stopped_early",
      },
    },
  );
  assert.deepEqual(
    await promptService.retirePrompt(stopInput),
    {
      status: "replay",
      response: {
        ok: true,
        done: true,
        outcome: "stopped_early",
      },
    },
  );
  const restarted = await Promise.all([
    promptService.createPrompt({
      familyId: walkFamilyId,
      childId: stopChildId,
      memberUserId: null,
      subjectId: "math",
      topicId,
      sitting: 1,
      now: new Date("2026-07-12T08:09:00.000Z"),
    }),
    promptService.createPrompt({
      familyId: walkFamilyId,
      childId: stopChildId,
      memberUserId: null,
      subjectId: "math",
      topicId,
      sitting: 1,
      now: new Date("2026-07-12T08:09:01.000Z"),
    }),
  ]);
  assert.ok(restarted[0]);
  assert.equal(restarted[1], restarted[0]);
  assert.notEqual(restarted[0], stopPromptId);

  const stopAfterNChildId = randomUUID();
  await sql`
    insert into public.children (
      id, family_id, name, birth_month
    )
    values (
      ${stopAfterNChildId}, ${walkFamilyId},
      'Stop after N child', '2019-07-01'
    )
  `;
  const stopAfterNPromptId = await promptService.createPrompt({
    familyId: walkFamilyId,
    childId: stopAfterNChildId,
    memberUserId: null,
    subjectId: "math",
    topicId,
    sitting: 4,
    now: new Date("2026-07-12T08:09:10.000Z"),
  });
  assert.ok(stopAfterNPromptId);
  const stopAfterNInput = {
    promptId: stopAfterNPromptId,
    familyId: walkFamilyId,
    childId: stopAfterNChildId,
    memberUserId: null,
    subjectId: "math",
    answeredCount: 3,
    idempotencyKey: randomUUID(),
    now: new Date("2026-07-12T08:09:20.000Z"),
  };
  assert.deepEqual(
    await promptService.retirePrompt({
      ...stopAfterNInput,
      answeredCount: 4,
      idempotencyKey: randomUUID(),
    }),
    { status: "rejected", reason: "prompt_mismatch" },
  );
  assert.equal(
    (await promptService.retirePrompt(stopAfterNInput)).status,
    "accepted",
  );
  assert.equal(
    (await promptService.retirePrompt(stopAfterNInput)).status,
    "replay",
  );
  const stopAfterNRestart = await promptService.createPrompt({
    familyId: walkFamilyId,
    childId: stopAfterNChildId,
    memberUserId: null,
    subjectId: "math",
    topicId,
    sitting: 4,
    now: new Date("2026-07-12T08:09:30.000Z"),
  });
  assert.ok(stopAfterNRestart);
  assert.notEqual(stopAfterNRestart, stopAfterNPromptId);

  for (const hook of [
    "afterProgressWrite",
    "beforeNextPromptInsert",
  ] as const) {
    const rollbackChildId = randomUUID();
    await sql`
      insert into public.children (
        id, family_id, name, birth_month
      )
      values (
        ${rollbackChildId}, ${walkFamilyId},
        'Rollback child', '2019-07-01'
      )
    `;
    const failingService = new MapWalkPromptService(
      repository,
      service,
      {
        [hook]: async () => {
          throw new Error(`synthetic ${hook} failure`);
        },
        ...(hook === "beforeNextPromptInsert"
          ? {
              nextPromptOverride: {
                topicId,
                domainId: "math.number-sense",
                domainName: "Number sense",
                statement: "Compares groups",
              },
            }
          : {}),
      },
    );
    const promptId = await failingService.createPrompt({
      familyId: walkFamilyId,
      childId: rollbackChildId,
      memberUserId: null,
      subjectId: "math",
      topicId,
      sitting: 1,
      now: new Date("2026-07-12T08:10:00.000Z"),
    });
    assert.ok(promptId);
    await assert.rejects(
      failingService.consumePrompt({
        promptId,
        familyId: walkFamilyId,
        childId: rollbackChildId,
        memberUserId: null,
        subjectId: "math",
        topicId,
        answer: "easily",
        sitting: 1,
        channel: "web",
        idempotencyKey: randomUUID(),
        now: new Date("2026-07-12T08:10:30.000Z"),
      }),
      new RegExp(`synthetic ${hook} failure`, "u"),
    );
    const [rollbackState] = await sql<
      {
        evidence_count: number;
        answer_count: number;
        consumed_count: number;
        prompt_count: number;
      }[]
    >`
      select
        (
          select count(*)::integer
          from public.child_progress_evidence
          where child_id = ${rollbackChildId}
        ) as evidence_count,
        (
          select count(*)::integer
          from public.child_answers
          where child_id = ${rollbackChildId}
        ) as answer_count,
        (
          select count(*)::integer
          from public.map_walk_prompts
          where child_id = ${rollbackChildId}
            and consumed_at is not null
        ) as consumed_count,
        (
          select count(*)::integer
          from public.map_walk_prompts
          where child_id = ${rollbackChildId}
        ) as prompt_count
    `;
    assert.deepEqual(rollbackState, {
      evidence_count: 0,
      answer_count: 0,
      consumed_count: 0,
      prompt_count: 1,
    });
  }
}

async function runChildDeleteLockAssertions(
  sql: postgres.Sql,
  blockerSql: postgres.Sql,
): Promise<void> {
  const familyAId = randomUUID();
  const familyBId = randomUUID();
  const childAId = randomUUID();
  const childBId = randomUUID();
  await sql`
    insert into public.families (id)
    values (${familyAId}), (${familyBId})
  `;
  await sql`
    insert into public.children (id, family_id, name, birth_month)
    values
      (${childAId}, ${familyAId}, 'Delete child', '2019-07-01'),
      (${childBId}, ${familyBId}, 'Keep child', '2019-07-01')
  `;
  let releaseExclusive = () => {};
  let signalExclusive = () => {};
  const exclusiveReady = new Promise<void>((resolve) => {
    signalExclusive = resolve;
  });
  const holdExclusive = new Promise<void>((resolve) => {
    releaseExclusive = resolve;
  });
  const exclusiveRun = blockerSql.begin(async (tx) => {
    await tx`
      select pg_advisory_xact_lock(
        ${CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY}::bigint
      )
    `;
    signalExclusive();
    await holdExclusive;
  });
  await exclusiveReady;
  let settled = false;
  const deletion = removeChild(familyAId, childAId, sql)
    .then((result) => {
      settled = true;
      return result;
    });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(settled, false);
  releaseExclusive();
  assert.equal(await deletion, true);
  await exclusiveRun;
  const [scope] = await sql<
    { deleted: number; preserved: number }[]
  >`
    select
      (
        select count(*)::integer
        from public.children
        where id = ${childAId}
      ) as deleted,
      (
        select count(*)::integer
        from public.children
        where id = ${childBId}
          and family_id = ${familyBId}
      ) as preserved
  `;
  assert.deepEqual(scope, { deleted: 0, preserved: 1 });
}

async function runFamilyFoldLockAssertions(
  sql: postgres.Sql,
  writerSql: postgres.Sql,
  blockerSql: postgres.Sql,
): Promise<void> {
  const sourceFamilyId = randomUUID();
  const destinationFamilyId = randomUUID();
  const insertingUserId = randomUUID();
  await sql`
    insert into auth.users (id)
    values (${insertingUserId})
  `;
  await sql`
    insert into public.families (id, email, context)
    values
      (${sourceFamilyId}, null, '{"source":"kept"}'::jsonb),
      (
        ${destinationFamilyId}, 'fold-lock@example.com',
        '{"destination":"kept"}'::jsonb
      )
  `;
  let releaseFold = () => {};
  let signalFoldLocked = () => {};
  const foldLocked = new Promise<void>((resolve) => {
    signalFoldLocked = resolve;
  });
  const holdFold = new Promise<void>((resolve) => {
    releaseFold = resolve;
  });
  const foldRun = blockerSql.begin((tx) =>
    foldStubFamilyIntoTx(tx, sourceFamilyId, destinationFamilyId, {
      afterFamilyLocks: async () => {
        signalFoldLocked();
        await holdFold;
      },
    })
  );
  await foldLocked;
  let membershipSettled = false;
  const membershipInsert = writerSql`
    insert into public.family_members (
      family_id, user_id, role, display_name
    )
    values (
      ${sourceFamilyId}, ${insertingUserId}, 'parent', 'Late member'
    )
  `.then(
    () => {
      membershipSettled = true;
      return "inserted" as const;
    },
    () => {
      membershipSettled = true;
      return "rejected" as const;
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(membershipSettled, false);
  releaseFold();
  assert.equal(await foldRun, true);
  assert.equal(await membershipInsert, "rejected");
  const [merged] = await sql<
    { context: Record<string, string>; source_count: number }[]
  >`
    select destination.context,
           (
             select count(*)::integer
             from public.families source
             where source.id = ${sourceFamilyId}
           ) as source_count
    from public.families destination
    where destination.id = ${destinationFamilyId}
  `;
  assert.deepEqual(merged.context, {
    destination: "kept",
    source: "kept",
  });
  assert.equal(merged.source_count, 0);

  const inverseSourceId = randomUUID();
  const inverseDestinationId = randomUUID();
  const inverseUserId = randomUUID();
  await sql`
    insert into auth.users (id)
    values (${inverseUserId})
  `;
  await sql`
    insert into public.families (id, email)
    values
      (${inverseSourceId}, null),
      (${inverseDestinationId}, 'inverse-fold@example.com')
  `;
  let releaseMembership = () => {};
  let signalMembership = () => {};
  const membershipReady = new Promise<void>((resolve) => {
    signalMembership = resolve;
  });
  const holdMembership = new Promise<void>((resolve) => {
    releaseMembership = resolve;
  });
  const membershipRun = writerSql.begin(async (tx) => {
    await tx`
      insert into public.family_members (
        family_id, user_id, role, display_name
      )
      values (
        ${inverseSourceId}, ${inverseUserId},
        'parent', 'First member'
      )
    `;
    signalMembership();
    await holdMembership;
  });
  await membershipReady;
  let inverseFoldSettled = false;
  const inverseFold = blockerSql.begin((tx) =>
    foldStubFamilyIntoTx(
      tx,
      inverseSourceId,
      inverseDestinationId,
    )
  ).then((result) => {
    inverseFoldSettled = true;
    return result;
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(inverseFoldSettled, false);
  releaseMembership();
  await membershipRun;
  assert.equal(await inverseFold, false);
  const [inverseState] = await sql<
    { family_count: number; member_count: number }[]
  >`
    select
      (
        select count(*)::integer
        from public.families
        where id = ${inverseSourceId}
      ) as family_count,
      (
        select count(*)::integer
        from public.family_members
        where family_id = ${inverseSourceId}
          and user_id = ${inverseUserId}
      ) as member_count
  `;
  assert.deepEqual(inverseState, {
    family_count: 1,
    member_count: 1,
  });

  const racingSourceId = randomUUID();
  const destinationAId = randomUUID();
  const destinationBId = randomUUID();
  await sql`
    insert into public.families (id, email, context)
    values
      (${racingSourceId}, null, '{"race":"source"}'::jsonb),
      (${destinationAId}, 'fold-a@example.com', '{"winner":"a"}'::jsonb),
      (${destinationBId}, 'fold-b@example.com', '{"winner":"b"}'::jsonb)
  `;
  const results = await Promise.all([
    writerSql.begin((tx) =>
      foldStubFamilyIntoTx(tx, racingSourceId, destinationAId)
    ),
    blockerSql.begin((tx) =>
      foldStubFamilyIntoTx(tx, racingSourceId, destinationBId)
    ),
  ]);
  assert.deepEqual([...results].sort(), [false, true]);
  const destinations = await sql<
    { id: string; context: Record<string, string> }[]
  >`
    select id, context
    from public.families
    where id in (${destinationAId}, ${destinationBId})
    order by id
  `;
  assert.equal(
    destinations.filter((row) => row.context.race === "source")
      .length,
    1,
  );
}

async function runProviderEvidenceAssertions(
  sql: postgres.Sql,
  service: ChildProgressService,
): Promise<void> {
  const providerFamilyId = randomUUID();
  const providerChildId = randomUUID();
  await sql`
    insert into public.families (id)
    values (${providerFamilyId})
  `;
  await sql`
    insert into public.children (id, family_id, name, birth_month)
    values (
      ${providerChildId}, ${providerFamilyId},
      'Provider child', '2019-07-01'
    )
  `;
  const result = await service.recordProgressEvidence({
    familyId: providerFamilyId,
    childId: providerChildId,
    memberUserId: null,
    source: "checklist",
    itemId: "math.counts-to-5",
    answer: "easily",
    quote: null,
    channel: "sms",
    messageId: null,
    providerMessageId: "telnyx-inbound-provider-1",
    observedAt: "2026-07-12T08:00:00.000000Z",
    idempotencyKey: "provider-evidence",
  });
  assert.equal(result.status, "recorded");
  const [evidence] = await sql<
    {
      channel: string;
      message_id: string | null;
      provider_message_id: string;
    }[]
  >`
    select channel, message_id, provider_message_id
    from public.child_progress_evidence
    where child_id = ${providerChildId}
      and family_id = ${providerFamilyId}
      and idempotency_key = 'provider-evidence'
  `;
  assert.deepEqual(evidence, {
    channel: "sms",
    message_id: null,
    provider_message_id: "telnyx-inbound-provider-1",
  });
}

async function runAdapterAssertions(input: {
  socketDir: string;
  port: number;
  username: string;
}): Promise<void> {
  const crossFamilyId = randomUUID();
  const crossFamilyAdultId = randomUUID();
  const options = {
    host: input.socketDir,
    port: input.port,
    database,
    username: input.username,
    prepare: false,
    max: 4,
  };
  const sql = postgres(options);
  const writerSql = postgres({ ...options, max: 1 });
  const blockerSql = postgres({ ...options, max: 1 });
  const reconciliationSql = postgres({ ...options, max: 1 });
  const repository = new PostgresChildProgressRepository(() => sql);
  const service = new ChildProgressService(repository, {
    buildView: buildChildProgressView,
    now: () => new Date("2026-07-11T18:00:00.000Z"),
  });
  const checkInService = new ProgressCheckInService(
    repository,
    service,
  );
  let releaseLock = () => {};
  let blockerRun: Promise<unknown> | null = null;

  const assertLiveInvalidated = async (label: string) => {
    assert.equal(
      await repository.loadLiveView(
        familyId,
        childId,
        new Date("2026-07-11T18:00:00.000Z"),
      ),
      null,
      label,
    );
  };
  const rebuild = async (itemId: string, key: string) => {
    const result = await service.recordProgressEvidence({
      familyId,
      childId,
      memberUserId: adultA,
      source: "checklist",
      itemId,
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T18:10:00.000000Z",
      idempotencyKey: key,
    });
    assert.equal(result.status, "recorded");
  };
  const raceSourceMutation = async (input: {
    label: string;
    itemId: string;
    idempotencyKey: string;
    mutate: () => Promise<unknown>;
  }) => {
    let signalLockReady = () => {};
    const lockReady = new Promise<void>((resolve) => {
      signalLockReady = resolve;
    });
    const held = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    blockerRun = blockerSql.begin(async (transactionSql) => {
      await transactionSql`
        lock table public.child_progress_conflicts
        in access exclusive mode
      `;
      signalLockReady();
      await held;
    });
    await lockReady;
    const evidencePromise = service.recordProgressEvidence({
      familyId,
      childId,
      memberUserId: adultA,
      source: "checklist",
      itemId: input.itemId,
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T18:20:00.000000Z",
      idempotencyKey: input.idempotencyKey,
    });
    let evidenceBlocked = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [activity] = await writerSql<{ blocked: boolean }[]>`
        select exists (
          select 1
          from pg_stat_activity
          where pid <> pg_backend_pid()
            and query like '%from public.child_progress_conflicts conflict%'
            and wait_event_type = 'Lock'
        ) as blocked
      `;
      if (activity.blocked) {
        evidenceBlocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(evidenceBlocked, true, `${input.label} setup`);
    let mutationSettled = false;
    const mutationPromise = input.mutate().then((result) => {
      mutationSettled = true;
      return result;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(mutationSettled, false, `${input.label} lock`);
    releaseLock();
    const [evidenceResult] = await Promise.all([
      evidencePromise,
      mutationPromise,
      blockerRun,
    ]);
    blockerRun = null;
    assert.equal(evidenceResult.status, "recorded");
    await assertLiveInvalidated(input.label);
  };

  try {
    await sql`
      create or replace function public.ensure_test_inbound_message()
      returns trigger
      language plpgsql
      as $$
      begin
        insert into public.conversation_messages (id, family_id)
        values (new.inbound_message_id, new.family_id)
        on conflict (id) do nothing;
        return new;
      end
      $$
    `;
    await sql`
      create trigger ensure_test_inbound_message
      before insert on public.progress_check_in_responses
      for each row execute function
        public.ensure_test_inbound_message()
    `;
    const [migrationShape] = await sql<
      {
        bridge_trigger_exists: boolean;
        bridge_function_exists: boolean;
        answer_revision_trigger_exists: boolean;
        answer_revision_trigger_only: boolean;
        reconciliation_function_exists: boolean;
        reconciliation_lock_key: string;
        redundant_conflict_actor_columns: number;
        evidence_provenance_columns: number;
        evidence_derivation_not_null: boolean;
        evidence_derivation_has_default: boolean;
        evidence_derivation_check: boolean;
        reconciliation_writes_derivation: boolean;
        evidence_name_snapshot_length: number | null;
        evidence_name_snapshot_trigger_exists: boolean;
        prompt_marker_columns: number;
        prompt_marker_index_exists: boolean;
        operation_id_column_exists: boolean;
        operation_family_id_index_exists: boolean;
        fold_composite_fk_count: number;
        fold_cascade_fk_count: number;
        fold_deferred_fk_count: number;
        walk_prompt_table_exists: boolean;
        walk_prompt_rls_enabled: boolean;
        walk_prompt_family_cascade: boolean;
        walk_prompt_state_columns: number;
        walk_prompt_one_active_index: boolean;
      }[]
    >`
      select
        exists (
          select 1
          from pg_trigger trigger
          join pg_class target on target.oid = trigger.tgrelid
          join pg_namespace schema on schema.oid = target.relnamespace
          where schema.nspname = 'public'
            and target.relname = 'child_answers'
            and trigger.tgname = 'child_answers_progress_bridge'
            and not trigger.tgisinternal
        ) as bridge_trigger_exists,
        to_regprocedure(
          'private.bridge_child_answer_to_progress()'
        ) is not null as bridge_function_exists,
        exists (
          select 1
          from pg_trigger trigger
          join pg_class target on target.oid = trigger.tgrelid
          join pg_namespace schema on schema.oid = target.relnamespace
          where schema.nspname = 'public'
            and target.relname = 'child_answers'
            and trigger.tgname =
              'child_answers_progress_revision_bump'
            and not trigger.tgisinternal
        ) as answer_revision_trigger_exists,
        position(
          'child_progress_evidence' in pg_get_functiondef(
            to_regprocedure(
              'private.bump_child_answer_progress_revision()'
            )
          )
        ) = 0 as answer_revision_trigger_only,
        to_regprocedure(
          'private.reconcile_child_answers_to_progress()'
        ) is not null as reconciliation_function_exists,
        private.child_progress_reconciliation_lock_key()::text
          as reconciliation_lock_key,
        (
          select count(*)::integer
          from information_schema.columns column_info
          where column_info.table_schema = 'public'
            and column_info.table_name = 'child_progress_conflicts'
            and column_info.column_name in (
              'member_user_id_a',
              'member_user_id_b'
            )
        ) as redundant_conflict_actor_columns,
        (
          select count(*)::integer
          from information_schema.columns column_info
          where column_info.table_schema = 'public'
            and column_info.table_name = 'child_progress_evidence'
            and column_info.column_name in (
              'channel',
              'message_id',
              'provider_message_id'
            )
        ) as evidence_provenance_columns,
        exists (
          select 1
          from information_schema.columns column_info
          where column_info.table_schema = 'public'
            and column_info.table_name = 'child_progress_evidence'
            and column_info.column_name = 'derivation'
            and column_info.is_nullable = 'NO'
        ) as evidence_derivation_not_null,
        exists (
          select 1
          from information_schema.columns column_info
          where column_info.table_schema = 'public'
            and column_info.table_name = 'child_progress_evidence'
            and column_info.column_name = 'derivation'
            and column_info.column_default is not null
        ) as evidence_derivation_has_default,
        exists (
          select 1
          from pg_constraint constraint_info
          where constraint_info.conname =
            'child_progress_evidence_derivation_check'
            and constraint_info.conrelid =
              'public.child_progress_evidence'::regclass
        ) as evidence_derivation_check,
        position(
          'derivation' in pg_get_functiondef(
            to_regprocedure(
              'private.reconcile_child_answers_to_progress()'
            )
          )
        ) > 0 as reconciliation_writes_derivation,
        (
          select column_info.character_maximum_length
          from information_schema.columns column_info
          where column_info.table_schema = 'public'
            and column_info.table_name = 'child_progress_evidence'
            and column_info.column_name =
              'adult_display_name_snapshot'
        ) as evidence_name_snapshot_length,
        exists (
          select 1
          from pg_trigger trigger
          join pg_class target on target.oid = trigger.tgrelid
          join pg_namespace schema on schema.oid = target.relnamespace
          where schema.nspname = 'public'
            and target.relname = 'child_progress_evidence'
            and trigger.tgname =
              'child_progress_evidence_capture_adult_name'
            and not trigger.tgisinternal
        ) as evidence_name_snapshot_trigger_exists,
        (
          select count(*)::integer
          from information_schema.columns column_info
          where column_info.table_schema = 'public'
            and column_info.table_name = 'progress_check_ins'
            and column_info.column_name in (
              'pending_runtime_session_id',
              'pending_turn_id'
            )
        ) as prompt_marker_columns,
        to_regclass(
          'public.progress_check_ins_pending_prompt_idx'
        ) is not null as prompt_marker_index_exists,
        exists (
          select 1
          from information_schema.columns column_info
          where column_info.table_schema = 'public'
            and column_info.table_name = 'child_progress_operations'
            and column_info.column_name = 'id'
        ) as operation_id_column_exists,
        to_regclass(
          'public.child_progress_operations_family_id_idx'
        ) is not null as operation_family_id_index_exists,
        (
          select count(*)::integer
          from pg_constraint constraint_info
          join pg_class target
            on target.oid = constraint_info.conrelid
          join pg_namespace schema
            on schema.oid = target.relnamespace
          where schema.nspname = 'public'
            and target.relname in (
              'child_progress_evidence',
              'child_progress_operations',
              'child_progress_revisions',
              'child_progress_live',
              'progress_check_ins',
              'progress_check_in_responses',
              'child_progress_conflicts',
              'child_progress_snapshots',
              'map_walk_prompts'
            )
            and constraint_info.contype = 'f'
            and cardinality(constraint_info.conkey) > 1
        ) as fold_composite_fk_count,
        (
          select count(*)::integer
          from pg_constraint constraint_info
          join pg_class target
            on target.oid = constraint_info.conrelid
          join pg_namespace schema
            on schema.oid = target.relnamespace
          where schema.nspname = 'public'
            and target.relname in (
              'child_progress_evidence',
              'child_progress_operations',
              'child_progress_revisions',
              'child_progress_live',
              'progress_check_ins',
              'progress_check_in_responses',
              'child_progress_conflicts',
              'child_progress_snapshots',
              'map_walk_prompts'
            )
            and constraint_info.contype = 'f'
            and cardinality(constraint_info.conkey) > 1
            and constraint_info.confupdtype = 'c'
        ) as fold_cascade_fk_count,
        (
          select count(*)::integer
          from pg_constraint constraint_info
          join pg_class target
            on target.oid = constraint_info.conrelid
          join pg_namespace schema
            on schema.oid = target.relnamespace
          where schema.nspname = 'public'
            and target.relname in (
              'child_progress_evidence',
              'child_progress_operations',
              'child_progress_revisions',
              'child_progress_live',
              'progress_check_ins',
              'progress_check_in_responses',
              'child_progress_conflicts',
              'child_progress_snapshots',
              'map_walk_prompts'
            )
            and constraint_info.contype = 'f'
            and cardinality(constraint_info.conkey) > 1
            and constraint_info.condeferrable
            and constraint_info.condeferred
        ) as fold_deferred_fk_count,
        to_regclass('public.map_walk_prompts') is not null
          as walk_prompt_table_exists,
        coalesce(
          (
            select target.relrowsecurity
            from pg_class target
            join pg_namespace schema
              on schema.oid = target.relnamespace
            where schema.nspname = 'public'
              and target.relname = 'map_walk_prompts'
          ),
          false
        ) as walk_prompt_rls_enabled,
        exists (
          select 1
          from pg_constraint constraint_info
          where constraint_info.conname =
            'map_walk_prompts_child_fkey'
            and constraint_info.confupdtype = 'c'
            and constraint_info.condeferrable
            and constraint_info.condeferred
        ) as walk_prompt_family_cascade,
        (
          select count(*)::integer
          from information_schema.columns column_info
          where column_info.table_schema = 'public'
            and column_info.table_name = 'map_walk_prompts'
            and column_info.column_name in (
              'sitting',
              'source_revision',
              'item_observed_at',
              'terminal_reason'
            )
        ) as walk_prompt_state_columns,
        to_regclass(
          'public.map_walk_prompts_one_active_subject_idx'
        ) is not null as walk_prompt_one_active_index
    `;
    assert.deepEqual(migrationShape, {
      bridge_trigger_exists: false,
      bridge_function_exists: false,
      answer_revision_trigger_exists: true,
      answer_revision_trigger_only: true,
      reconciliation_function_exists: true,
      reconciliation_lock_key: String(
        CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY,
      ),
      redundant_conflict_actor_columns: 0,
      evidence_provenance_columns: 3,
      evidence_derivation_not_null: true,
      evidence_derivation_has_default: true,
      evidence_derivation_check: true,
      reconciliation_writes_derivation: true,
      evidence_name_snapshot_length: 120,
      evidence_name_snapshot_trigger_exists: true,
      prompt_marker_columns: 2,
      prompt_marker_index_exists: true,
      operation_id_column_exists: true,
      operation_family_id_index_exists: true,
      fold_composite_fk_count: 22,
      fold_cascade_fk_count: 22,
      fold_deferred_fk_count: 22,
      walk_prompt_table_exists: true,
      walk_prompt_rls_enabled: true,
      walk_prompt_family_cascade: true,
      walk_prompt_state_columns: 4,
      walk_prompt_one_active_index: true,
    });

    await sql`
      insert into public.families (id, time_zone)
      values
        (${familyId}, 'America/Chicago'),
        (${crossFamilyId}, 'America/Chicago')
    `;
    await sql`
      insert into public.conversation_messages (id, family_id)
      values (${progressEvidenceMessageId}, ${familyId})
    `;
    await sql`
      insert into public.children (id, family_id, name, birth_month)
      values (${childId}, ${familyId}, 'Maya', '2019-07-01')
    `;
    await sql`
      insert into auth.users (id)
      values
        (${adultA}), (${adultB}), (${adultC}), (${adultD}),
        (${adultE}), (${outsider}), (${crossFamilyAdultId})
    `;
    await sql`
      insert into public.family_members (
        family_id, user_id, role, display_name
      )
      values
        (${familyId}, ${adultA}, 'parent', 'Elena'),
        (${familyId}, ${adultB}, 'partner', 'Jordan'),
        (${familyId}, ${adultC}, 'partner', 'Avery'),
        (${familyId}, ${adultD}, 'partner', 'Morgan'),
        (${familyId}, ${adultE}, 'partner', 'Riley'),
        (
          ${crossFamilyId}, ${crossFamilyAdultId}, 'parent',
          'Cross-family adult'
        )
    `;
    const familyAEvidence = await service.recordProgressEvidence({
      familyId,
      childId,
      memberUserId: adultA,
      source: "checklist",
      itemId: "phonics.joins-rhymes",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T16:58:00.000000Z",
      idempotencyKey: "postgres-cross-family-visible",
    });
    assert.equal(familyAEvidence.status, "recorded");
    if (familyAEvidence.status === "recorded") {
      assert.equal(
        familyAEvidence.evidence[0].derivation,
        "direct",
      );
    }
    const familyAServiceView =
      await service.getChildProgressView(familyId, childId);
    assert.ok(familyAServiceView);
    assert.equal(
      familyAServiceView.subjects
        .flatMap((subject) => subject.domains)
        .flatMap((domain) => domain.topics)
        .find((topic) => topic.itemId === "phonics.joins-rhymes")
        ?.answer,
      "easily",
    );
    assert.equal(
      familyAServiceView.subjects
        .flatMap((subject) => subject.domains)
        .flatMap((domain) => domain.topics)
        .find((topic) => topic.itemId === "phonics.joins-rhymes")
        ?.source?.derivation,
      "direct",
    );
    const familyARepositoryView = await repository.loadLiveView(
      familyId,
      childId,
      new Date("2026-07-11T16:58:01.000Z"),
    );
    assert.ok(familyARepositoryView);
    assert.equal(
      familyARepositoryView.subjects
        .flatMap((subject) => subject.domains)
        .flatMap((domain) => domain.topics)
        .find((topic) => topic.itemId === "phonics.joins-rhymes")
        ?.answer,
      "easily",
    );
    assert.equal(
      familyARepositoryView.subjects
        .flatMap((subject) => subject.domains)
        .flatMap((domain) => domain.topics)
        .find((topic) => topic.itemId === "phonics.joins-rhymes")
        ?.source?.derivation,
      "direct",
    );
    const [storedDirectDerivation] = await sql<
      { derivation: string }[]
    >`
      select derivation
      from public.child_progress_evidence
      where child_id = ${childId}
        and family_id = ${familyId}
        and idempotency_key = 'postgres-cross-family-visible'
    `;
    assert.equal(storedDirectDerivation.derivation, "direct");
    assert.equal(
      await service.getChildProgressView(crossFamilyId, childId),
      null,
    );
    assert.equal(
      await repository.loadLiveView(
        crossFamilyId,
        childId,
        new Date("2026-07-11T16:58:01.000Z"),
      ),
      null,
    );
    assert.deepEqual(
      await service.recordProgressEvidence({
        familyId: crossFamilyId,
        childId,
        memberUserId: crossFamilyAdultId,
        source: "checklist",
        itemId: "math.counts-to-5",
        answer: "easily",
        quote: null,
        observedAt: "2026-07-11T16:59:00.000000Z",
        idempotencyKey: "postgres-cross-family-denial",
      }),
      { status: "unknown_child" },
    );
    const [crossFamilyWriteState] = await sql<
      { operations: number; evidence: number }[]
    >`
      select
        (
          select count(*)::integer
          from public.child_progress_operations
          where idempotency_key = 'postgres-cross-family-denial'
        ) as operations,
        (
          select count(*)::integer
          from public.child_progress_evidence
          where idempotency_key = 'postgres-cross-family-denial'
        ) as evidence
    `;
    assert.deepEqual(crossFamilyWriteState, {
      operations: 0,
      evidence: 0,
    });
    console.log("PASS  child-progress-e2e cross-family-denial");
    await sql`
      insert into auth.users (id)
      values (${snapshotAdultA}), (${snapshotAdultB})
    `;
    await sql`
      insert into public.children (
        id, family_id, name, birth_month
      )
      values (
        ${snapshotChildId}, ${familyId}, 'Snapshot child',
        '2019-07-01'
      )
    `;
    await sql`
      insert into public.family_members (
        family_id, user_id, role, display_name
      )
      values
        (${familyId}, ${snapshotAdultA}, 'parent', 'Taylor'),
        (${familyId}, ${snapshotAdultB}, 'partner', 'Casey')
    `;
    const snapshotEvidence = await sql<
      {
        id: string;
        member_user_id: string;
        adult_display_name_snapshot: string | null;
      }[]
    >`
      insert into public.child_progress_evidence (
        child_id, family_id, item_id, answer, source,
        member_user_id, adult_display_name_snapshot,
        observed_at, idempotency_key
      )
      values
        (
          ${snapshotChildId}, ${familyId}, 'math.counts-to-5',
          'easily', 'checklist', ${snapshotAdultA}, 'Forged A',
          '2026-07-11T17:00:00.000000Z', 'snapshot-adult-a'
        ),
        (
          ${snapshotChildId}, ${familyId}, 'math.counts-to-5',
          'not_yet', 'checklist', ${snapshotAdultB}, 'Forged B',
          '2026-07-11T17:05:00.000000Z', 'snapshot-adult-b'
        )
      returning id, member_user_id, adult_display_name_snapshot
    `;
    assert.deepEqual(
      new Map(
        snapshotEvidence.map((evidence) => [
          evidence.member_user_id,
          evidence.adult_display_name_snapshot,
        ]),
      ),
      new Map([
        [snapshotAdultA, "Taylor"],
        [snapshotAdultB, "Casey"],
      ]),
    );
    const snapshotEvidenceByMember = new Map(
      snapshotEvidence.map((evidence) => [
        evidence.member_user_id,
        evidence.id,
      ]),
    );
    await sql`
      insert into public.child_progress_conflicts (
        child_id, family_id, item_id,
        evidence_id_a, evidence_id_b
      )
      values (
        ${snapshotChildId}, ${familyId}, 'math.counts-to-5',
        ${snapshotEvidenceByMember.get(snapshotAdultA) ?? null},
        ${snapshotEvidenceByMember.get(snapshotAdultB) ?? null}
      )
    `;
    await sql`
      update public.family_members
      set display_name = 'Taylor Current'
      where family_id = ${familyId}
        and user_id = ${snapshotAdultA}
    `;
    const currentNameView = await service.getChildProgressView(
      familyId,
      snapshotChildId,
    );
    assert.deepEqual(
      currentNameView?.conflicts[0]?.adultAnswers.map(
        (answer) => answer.adultDisplayName,
      ),
      ["Taylor Current", "Casey"],
    );
    const conflictCorrection =
      await service.correctProgressAnswers({
        familyId,
        childId: snapshotChildId,
        memberUserId: snapshotAdultA,
        source: "report_correction",
        changes: [{
          itemId: "math.counts-to-5",
          answer: "getting_there",
        }],
        observedAt: "2026-07-11T17:06:00.000000Z",
        idempotencyKey: "postgres-conflict-correction",
      });
    assert.equal(conflictCorrection.status, "conflict_pending");
    const originalCorrection =
      await service.recordProgressEvidence({
        familyId,
        childId: snapshotChildId,
        memberUserId: snapshotAdultA,
        source: "checklist",
        itemId: "writing.writes-name",
        answer: "easily",
        quote: null,
        observedAt: "2026-07-11T17:07:00.000000Z",
        idempotencyKey: "postgres-correction-original",
      });
    assert.equal(originalCorrection.status, "recorded");
    const correctedBatch =
      await service.correctProgressAnswers({
        familyId,
        childId: snapshotChildId,
        memberUserId: snapshotAdultA,
        source: "report_correction",
        changes: [{
          itemId: "writing.writes-name",
          answer: "not_yet",
        }],
        observedAt: "2026-07-11T17:08:00.000000Z",
        idempotencyKey: "postgres-correction-batch",
      });
    assert.equal(correctedBatch.status, "answers_corrected");
    const deletedBatch =
      await service.correctProgressAnswers({
        familyId,
        childId: snapshotChildId,
        memberUserId: snapshotAdultA,
        source: "correction",
        changes: [{
          itemId: "writing.writes-name",
          answer: null,
        }],
        observedAt: "2026-07-11T17:09:00.000000Z",
        idempotencyKey: "postgres-correction-delete",
      });
    assert.equal(deletedBatch.status, "answers_corrected");
    const [correctionState] = await sql<
      {
        evidence_count: number;
        superseded_count: number;
        compatibility_count: number;
        receipt_count: number;
      }[]
    >`
      select
        (
          select count(*)::integer
          from public.child_progress_evidence evidence
          where evidence.child_id = ${snapshotChildId}
            and evidence.family_id = ${familyId}
            and evidence.item_id = 'writing.writes-name'
        ) as evidence_count,
        (
          select count(*)::integer
          from public.child_progress_evidence evidence
          where evidence.child_id = ${snapshotChildId}
            and evidence.family_id = ${familyId}
            and evidence.item_id = 'writing.writes-name'
            and evidence.superseded_at is not null
        ) as superseded_count,
        (
          select count(*)::integer
          from public.child_answers answer
          where answer.child_id = ${snapshotChildId}
            and answer.question_id = 'writing.writes-name'
        ) as compatibility_count,
        (
          select count(*)::integer
          from public.child_progress_operations operation
          where operation.child_id = ${snapshotChildId}
            and operation.family_id = ${familyId}
            and operation.idempotency_key in (
              'postgres-correction-batch',
              'postgres-correction-delete'
            )
            and operation.status = 'answers_corrected'
        ) as receipt_count
    `;
    assert.deepEqual(correctionState, {
      evidence_count: 2,
      superseded_count: 2,
      compatibility_count: 0,
      receipt_count: 2,
    });
    await sql`
      delete from public.family_members
      where family_id = ${familyId}
        and user_id = ${snapshotAdultA}
    `;
    await sql`
      delete from auth.users
      where id = ${snapshotAdultB}
    `;
    const snapshotFallbackView =
      await service.getChildProgressView(
        familyId,
        snapshotChildId,
      );
    assert.deepEqual(
      snapshotFallbackView?.conflicts[0]?.adultAnswers.map(
        (answer) => answer.adultDisplayName,
      ),
      ["Taylor", "Casey"],
    );
    await sql`
      insert into public.child_answers (
        child_id, question_id, answer, source, answered_at
      )
      values
        (
          ${snapshotChildId}, 'math.counts-to-5', 'easily',
          'checklist', '2026-07-11T17:00:00.000000Z'
        ),
        (
          ${snapshotChildId}, 'math.counts-to-10', 'not_sure',
          'checklist', '2026-07-11T17:10:00.000000Z'
        ),
        (
          ${snapshotChildId}, 'writing.writes-name', 'skip',
          'deep_dive', '2026-07-11T17:11:00.000000Z'
        )
    `;
    const selectionProjection =
      await repository.loadProjectionInput(
        familyId,
        snapshotChildId,
      );
    const selectionByItem = new Map(
      selectionProjection?.selectionAnswers.map((answer) => [
        answer.itemId,
        answer,
      ]),
    );
    assert.equal(
      selectionByItem.get("math.counts-to-5")?.evidenceId,
      snapshotEvidenceByMember.get(snapshotAdultA),
    );
    assert.equal(
      selectionByItem.get("math.counts-to-10")?.answer,
      "not_sure",
    );
    assert.equal(
      selectionByItem.get("writing.writes-name")?.answer,
      "skip",
    );
    await sql`
      delete from public.child_answers
      where child_id = ${snapshotChildId}
    `;
    await sql`
      delete from public.child_progress_conflicts
      where child_id = ${snapshotChildId}
        and family_id = ${familyId}
    `;
    await sql`
      delete from public.child_progress_evidence
      where child_id = ${snapshotChildId}
        and family_id = ${familyId}
    `;
    await sql`
      delete from public.child_progress_revisions
      where child_id = ${snapshotChildId}
        and family_id = ${familyId}
    `;
    await sql`
      delete from public.children
      where id = ${snapshotChildId}
        and family_id = ${familyId}
    `;
    await sql`
      delete from auth.users
      where id = ${snapshotAdultA}
    `;
    await sql`
      insert into public.child_reports (
        child_id, scores, bank_version, token, history
      )
      values (
        ${childId}, '{}'::jsonb, 'old', 'keep-token',
        '[{"marker":"keep"}]'::jsonb
      )
    `;
    const [revisionBeforeLegacyAnswer] = await sql<
      { revision: string }[]
    >`
      select coalesce(
        (
          select revision::text
          from public.child_progress_revisions
          where child_id = ${childId}
            and family_id = ${familyId}
        ),
        '0'
      ) as revision
    `;
    await sql`
      insert into public.child_answers (
        child_id, question_id, answer, source, answered_at
      )
      values (
        ${childId}, 'math.counts-to-5', 'easily',
        'checklist', '2026-07-11T17:00:00.000000Z'
      )
    `;
    const [revisionAfterLegacyAnswer] = await sql<
      { revision: string }[]
    >`
      select coalesce(
        (
          select revision::text
          from public.child_progress_revisions
          where child_id = ${childId}
            and family_id = ${familyId}
        ),
        '0'
      ) as revision
    `;
    assert.ok(
      BigInt(revisionAfterLegacyAnswer.revision) >
        BigInt(revisionBeforeLegacyAnswer.revision),
    );
    const [beforeReconciliation] = await sql<{ count: number }[]>`
      select count(*)::integer as count
      from public.child_progress_evidence
      where child_id = ${childId}
        and family_id = ${familyId}
        and item_id = 'math.counts-to-5'
        and idempotency_key like 'legacy-reconcile:%'
    `;
    assert.equal(beforeReconciliation.count, 0);
    await sql`select * from private.reconcile_child_answers_to_progress()`;
    await sql`select * from private.reconcile_child_answers_to_progress()`;
    const [firstReconciliation] = await sql<
      {
        total: number;
        active: number;
        answer: string;
        derivation: string;
      }[]
    >`
      select count(*)::integer as total,
             count(*) filter (
               where superseded_at is null
             )::integer as active,
             max(answer) filter (
               where superseded_at is null
             ) as answer,
             max(derivation) filter (
               where superseded_at is null
             ) as derivation
      from public.child_progress_evidence
      where child_id = ${childId}
        and family_id = ${familyId}
        and item_id = 'math.counts-to-5'
        and idempotency_key like 'legacy-reconcile:%'
    `;
    assert.deepEqual(firstReconciliation, {
      total: 1,
      active: 1,
      answer: "easily",
      derivation: "unknown",
    });
    await sql`
      update public.child_answers
      set answer = 'not_yet',
          source = 'correction',
          answered_at = '2026-07-11T17:05:00.000000Z'
      where child_id = ${childId}
        and question_id = 'math.counts-to-5'
    `;
    const [beforeFinalReconciliation] = await sql<
      { answer: string }[]
    >`
      select answer
      from public.child_progress_evidence
      where child_id = ${childId}
        and family_id = ${familyId}
        and item_id = 'math.counts-to-5'
        and idempotency_key like 'legacy-reconcile:%'
        and superseded_at is null
    `;
    assert.equal(beforeFinalReconciliation.answer, "easily");
    await sql`select * from private.reconcile_child_answers_to_progress()`;
    const [finalReconciliation] = await sql<
      { total: number; active: number; answer: string }[]
    >`
      select count(*)::integer as total,
             count(*) filter (
               where superseded_at is null
             )::integer as active,
             max(answer) filter (
               where superseded_at is null
             ) as answer
      from public.child_progress_evidence
      where child_id = ${childId}
        and family_id = ${familyId}
        and item_id = 'math.counts-to-5'
        and idempotency_key like 'legacy-reconcile:%'
    `;
    assert.deepEqual(finalReconciliation, {
      total: 2,
      active: 1,
      answer: "not_yet",
    });
    const [revisionBeforeSameAnswer] = await sql<
      { revision: string }[]
    >`
      select revision::text as revision
      from public.child_progress_revisions
      where child_id = ${childId} and family_id = ${familyId}
    `;
    await sql`
      update public.child_answers
      set answered_at = '2026-07-11T17:06:00.000000Z'
      where child_id = ${childId}
        and question_id = 'math.counts-to-5'
    `;
    await sql`select * from private.reconcile_child_answers_to_progress()`;
    const [sameAnswerNewDate] = await sql<
      {
        total: number;
        active: number;
        source: string;
        observed_at: string;
        revision: string;
      }[]
    >`
      select count(*)::integer as total,
             count(*) filter (
               where evidence.superseded_at is null
             )::integer as active,
             max(evidence.source) filter (
               where evidence.superseded_at is null
             ) as source,
             max(
               to_char(
                 evidence.observed_at at time zone 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
               )
             ) filter (
               where evidence.superseded_at is null
             ) as observed_at,
             (
               select revision.revision::text
               from public.child_progress_revisions revision
               where revision.child_id = ${childId}
                 and revision.family_id = ${familyId}
             ) as revision
      from public.child_progress_evidence evidence
      where evidence.child_id = ${childId}
        and evidence.family_id = ${familyId}
        and evidence.item_id = 'math.counts-to-5'
        and evidence.idempotency_key like 'legacy-reconcile:%'
    `;
    assert.deepEqual(
      {
        total: sameAnswerNewDate.total,
        active: sameAnswerNewDate.active,
        source: sameAnswerNewDate.source,
        observed_at: sameAnswerNewDate.observed_at,
      },
      {
        total: 3,
        active: 1,
        source: "correction",
        observed_at: "2026-07-11T17:06:00.000000Z",
      },
    );
    assert.ok(
      BigInt(sameAnswerNewDate.revision) >
        BigInt(revisionBeforeSameAnswer.revision),
    );
    await sql`
      update public.child_answers
      set source = 'report_correction'
      where child_id = ${childId}
        and question_id = 'math.counts-to-5'
    `;
    await sql`select * from private.reconcile_child_answers_to_progress()`;
    const [sameAnswerNewSource] = await sql<
      {
        total: number;
        active: number;
        source: string;
        revision: string;
      }[]
    >`
      select count(*)::integer as total,
             count(*) filter (
               where evidence.superseded_at is null
             )::integer as active,
             max(evidence.source) filter (
               where evidence.superseded_at is null
             ) as source,
             (
               select revision.revision::text
               from public.child_progress_revisions revision
               where revision.child_id = ${childId}
                 and revision.family_id = ${familyId}
             ) as revision
      from public.child_progress_evidence evidence
      where evidence.child_id = ${childId}
        and evidence.family_id = ${familyId}
        and evidence.item_id = 'math.counts-to-5'
        and evidence.idempotency_key like 'legacy-reconcile:%'
    `;
    assert.deepEqual(
      {
        total: sameAnswerNewSource.total,
        active: sameAnswerNewSource.active,
        source: sameAnswerNewSource.source,
      },
      {
        total: 4,
        active: 1,
        source: "report_correction",
      },
    );
    assert.ok(
      BigInt(sameAnswerNewSource.revision) >
        BigInt(sameAnswerNewDate.revision),
    );
    const expectInvalidCheckInState = async (input: {
      state: "active" | "paused" | "completed" | "stopped";
      revision: number;
      currentItemId: string | null;
      pauseReason: string | null;
      pausedAt: string | null;
      completedAt: string | null;
      stoppedAt: string | null;
    }) => {
      await assert.rejects(
        sql.begin((transaction) =>
          transaction`
            insert into public.progress_check_ins (
              child_id, family_id, purpose, scope, state, revision,
              current_item_id, pause_reason, paused_at, completed_at,
              stopped_at
            )
            values (
              ${childId}, ${familyId}, 'age_refresh', '{}'::jsonb,
              ${input.state}, ${input.revision},
              ${input.currentItemId}, ${input.pauseReason},
              ${input.pausedAt}, ${input.completedAt},
              ${input.stoppedAt}
            )
          `
        ),
      );
    };
    for (const invalidState of [
      {
        state: "active" as const,
        revision: 0,
        currentItemId: "math.counts-to-5",
        pauseReason: null,
        pausedAt: null,
        completedAt: null,
        stoppedAt: null,
      },
      {
        state: "active" as const,
        revision: 1,
        currentItemId: null,
        pauseReason: null,
        pausedAt: null,
        completedAt: null,
        stoppedAt: null,
      },
      {
        state: "paused" as const,
        revision: 1,
        currentItemId: null,
        pauseReason: "topic_change",
        pausedAt: "2026-07-11T17:06:00.000000Z",
        completedAt: null,
        stoppedAt: null,
      },
      {
        state: "completed" as const,
        revision: 1,
        currentItemId: "math.counts-to-5",
        pauseReason: null,
        pausedAt: null,
        completedAt: "2026-07-11T17:06:00.000000Z",
        stoppedAt: null,
      },
      {
        state: "stopped" as const,
        revision: 1,
        currentItemId: "math.counts-to-5",
        pauseReason: null,
        pausedAt: null,
        completedAt: null,
        stoppedAt: "2026-07-11T17:06:00.000000Z",
      },
    ]) {
      await expectInvalidCheckInState(invalidState);
    }
    for (const ownerMemberUserId of [adultA, null]) {
      await assert.rejects(
        sql.begin((transaction) =>
          transaction`
            insert into public.progress_check_ins (
              child_id, family_id, purpose, scope, state, revision,
              current_item_id, pause_reason, paused_at,
              active_member_user_id, prompt_recipient_member_user_id
            )
            values (
              ${childId}, ${familyId}, 'age_refresh', '{}'::jsonb,
              'paused', 1, 'math.counts-to-5', 'member_removed',
              '2026-07-11T17:06:30.000000Z',
              ${ownerMemberUserId}, ${ownerMemberUserId}
            )
          `
        ),
      );
    }
    await sql`
      insert into public.child_answers (
        child_id, question_id, answer, source, answered_at
      )
      values (
        ${childId}, 'math.counts-to-10', 'easily',
        'checklist', '2026-07-11T17:07:00.000000Z'
      )
    `;
    await sql`select * from private.reconcile_child_answers_to_progress()`;
    const [legacyConflictEvidence] = await sql<{ id: string }[]>`
      update public.child_progress_evidence
      set member_user_id = ${adultA}
      where child_id = ${childId}
        and family_id = ${familyId}
        and item_id = 'math.counts-to-10'
        and idempotency_key like 'legacy-reconcile:%'
        and superseded_at is null
      returning id
    `;
    const [otherConflictEvidence] = await sql<{ id: string }[]>`
      insert into public.child_progress_evidence (
        child_id, family_id, item_id, answer, source,
        member_user_id, observed_at, idempotency_key
      )
      values (
        ${childId}, ${familyId}, 'math.counts-to-10',
        'not_yet', 'checklist', ${adultB},
        '2026-07-11T17:08:00.000000Z',
        'postgres-open-reconcile-conflict'
      )
      returning id
    `;
    const [reconciliationConflict] = await sql<{ id: string }[]>`
      insert into public.child_progress_conflicts (
        child_id, family_id, item_id, evidence_id_a, evidence_id_b
      )
      values (
        ${childId}, ${familyId}, 'math.counts-to-10',
        ${legacyConflictEvidence.id}, ${otherConflictEvidence.id}
      )
      returning id
    `;
    await sql`
      update public.child_answers
      set answer = 'getting_there',
          source = 'correction',
          answered_at = '2026-07-11T17:09:00.000000Z'
      where child_id = ${childId}
        and question_id = 'math.counts-to-10'
    `;
    await sql`select * from private.reconcile_child_answers_to_progress()`;
    const [openConflictLegacy] = await sql<
      { superseded_at: string | null; state: string }[]
    >`
      select evidence.superseded_at::text as superseded_at,
             conflict.state
      from public.child_progress_evidence evidence
      join public.child_progress_conflicts conflict
        on conflict.id = ${reconciliationConflict.id}
       and conflict.evidence_id_a = evidence.id
      where evidence.id = ${legacyConflictEvidence.id}
    `;
    assert.deepEqual(openConflictLegacy, {
      superseded_at: null,
      state: "open",
    });

    await sql`
      insert into public.child_progress_evidence (
        child_id, family_id, item_id, answer, source,
        member_user_id, observed_at, idempotency_key
      )
      values (
        ${childId}, ${familyId}, 'science.predicts',
        'easily', 'checklist', ${adultA},
        '2026-07-11T17:10:00.000000Z',
        'task9-exact-science-predicts'
      )
    `;
    await sql`
      insert into public.child_answers (
        child_id, question_id, answer, source, answered_at
      )
      values (
        ${childId}, 'science.predicts', 'easily',
        'checklist', '2026-07-11T17:10:00.000000Z'
      )
    `;
    await sql`select * from private.reconcile_child_answers_to_progress()`;
    const [exactEvidenceReconciliation] = await sql<{ count: number }[]>`
      select count(*)::integer as count
      from public.child_progress_evidence
      where child_id = ${childId}
        and family_id = ${familyId}
        and item_id = 'science.predicts'
        and idempotency_key like 'legacy-reconcile:%'
    `;
    assert.equal(exactEvidenceReconciliation.count, 0);
    await sql`
      insert into public.child_answers (
        child_id, question_id, answer, source, answered_at
      )
      values (
        ${childId}, 'fine_motor.cuts-line', 'easily',
        'checklist', '2026-07-11T17:11:00.000000Z'
      )
    `;
    let signalReconciliationBlock = () => {};
    const reconciliationBlockReady = new Promise<void>((resolve) => {
      signalReconciliationBlock = resolve;
    });
    const holdReconciliationBlock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    blockerRun = blockerSql.begin(async (transactionSql) => {
      await transactionSql`
        lock table public.child_progress_conflicts
        in access exclusive mode
      `;
      signalReconciliationBlock();
      await holdReconciliationBlock;
    });
    await reconciliationBlockReady;
    const quiescentWriter = service.recordProgressEvidence({
      familyId,
      childId,
      memberUserId: adultA,
      source: "checklist",
      itemId: "fine_motor.cuts-line",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T17:11:00.000000Z",
      idempotencyKey: "task9-concurrent-fine-motor",
    });
    let quiescentWriterBlocked = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [activity] = await writerSql<{ blocked: boolean }[]>`
        select exists (
          select 1
          from pg_stat_activity
          where pid <> pg_backend_pid()
            and query like '%from public.child_progress_conflicts conflict%'
            and wait_event_type = 'Lock'
        ) as blocked
      `;
      if (activity.blocked) {
        quiescentWriterBlocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(quiescentWriterBlocked, true);
    const concurrentReconciliation = reconciliationSql`
      select * from private.reconcile_child_answers_to_progress()
    `.then((rows) => rows);
    let advisoryState = {
      sharedGranted: false,
      exclusiveWaiting: false,
    };
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [locks] = await writerSql<
        { shared_granted: boolean; exclusive_waiting: boolean }[]
      >`
        select
          exists (
            select 1
            from pg_locks lock
            where lock.locktype = 'advisory'
              and lock.mode = 'ShareLock'
              and lock.granted
              and (
                (lock.classid::bigint << 32) + lock.objid::bigint
              ) =
                ${CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY}
              and lock.pid <> pg_backend_pid()
          ) as shared_granted,
          exists (
            select 1
            from pg_locks lock
            where lock.locktype = 'advisory'
              and lock.mode = 'ExclusiveLock'
              and not lock.granted
              and (
                (lock.classid::bigint << 32) + lock.objid::bigint
              ) =
                ${CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY}
              and lock.pid <> pg_backend_pid()
          ) as exclusive_waiting
      `;
      advisoryState = {
        sharedGranted: locks.shared_granted,
        exclusiveWaiting: locks.exclusive_waiting,
      };
      if (
        advisoryState.sharedGranted &&
        advisoryState.exclusiveWaiting
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    releaseLock();
    const [quiescentWriterResult] = await Promise.all([
      quiescentWriter,
      concurrentReconciliation,
      blockerRun,
    ]);
    blockerRun = null;
    assert.deepEqual(advisoryState, {
      sharedGranted: true,
      exclusiveWaiting: true,
    });
    assert.equal(quiescentWriterResult.status, "recorded");
    const [quiescentFinal] = await sql<
      { exact_count: number; legacy_count: number; answer: string }[]
    >`
      select
        count(*) filter (
          where evidence.idempotency_key =
            'task9-concurrent-fine-motor'
            and evidence.superseded_at is null
        )::integer as exact_count,
        count(*) filter (
          where evidence.idempotency_key like 'legacy-reconcile:%'
        )::integer as legacy_count,
        (
          select answer.answer
          from public.child_answers answer
          where answer.child_id = ${childId}
            and answer.question_id = 'fine_motor.cuts-line'
        ) as answer
      from public.child_progress_evidence evidence
      where evidence.child_id = ${childId}
        and evidence.family_id = ${familyId}
        and evidence.item_id = 'fine_motor.cuts-line'
    `;
    assert.deepEqual(quiescentFinal, {
      exact_count: 1,
      legacy_count: 0,
      answer: "easily",
    });

    const journalInput = {
      familyId,
      childId,
      memberUserId: adultA,
      quote:
        "Maya can read a simple book but not retell the plot",
      channel: "web" as const,
      messageId: progressEvidenceMessageId,
      observedAt: "2026-07-11T17:30:00.123456Z",
      idempotencyKey: "postgres-journal",
      claims: [
        {
          childId,
          itemId: "literacy.emergent-reader",
          answer: "getting_there" as const,
          quote: "Maya can read a simple book",
          confidence: "high" as const,
          statement: "Reads an early chapter book independently",
          subjectId: "literacy",
        },
      ],
    };
    assert.equal(
      (await service.recordJournalProgressEvidence(journalInput)).status,
      "recorded",
    );
    assert.equal(
      (await service.recordJournalProgressEvidence(journalInput)).status,
      "duplicate",
    );
    const [persistedJournalEvidence] = await sql<
      {
        quote: string | null;
        channel: string | null;
        message_id: string | null;
      }[]
    >`
      select quote, channel, message_id
      from public.child_progress_evidence
      where child_id = ${childId}
        and family_id = ${familyId}
        and idempotency_key = 'postgres-journal'
    `;
    assert.deepEqual(persistedJournalEvidence, {
      quote: "Maya can read a simple book",
      channel: "web",
      message_id: progressEvidenceMessageId,
    });

    // Observation ledger (plan 2026-07-13-observation-ledger.md):
    // a journal call the matcher cannot score persists the parent's
    // words as a child_observations row in the same transaction, and
    // the reinforcement loop can later flip it to used.
    const observationResult =
      await service.recordJournalProgressEvidence({
        ...journalInput,
        quote: "Maya had a wonderful curious afternoon",
        idempotencyKey: "postgres-journal-observation",
        claims: [],
      });
    assert.equal(observationResult.status, "no_match");
    const [persistedObservation] = await sql<
      {
        id: string;
        classification: string;
        status: string;
        quote: string;
        channel: string;
        message_id: string | null;
        member_user_id: string | null;
      }[]
    >`
      select id, classification, status, quote, channel,
             message_id, member_user_id
      from public.child_observations
      where child_id = ${childId}
        and family_id = ${familyId}
    `;
    assert.ok(persistedObservation);
    assert.deepEqual(
      {
        classification: persistedObservation.classification,
        status: persistedObservation.status,
        quote: persistedObservation.quote,
        channel: persistedObservation.channel,
        message_id: persistedObservation.message_id,
        member_user_id: persistedObservation.member_user_id,
      },
      {
        classification: "no_match",
        status: "new",
        quote: "Maya had a wonderful curious afternoon",
        channel: "web",
        message_id: progressEvidenceMessageId,
        member_user_id: adultA,
      },
    );
    const observationReplay =
      await service.recordJournalProgressEvidence({
        ...journalInput,
        quote: "Maya had a wonderful curious afternoon",
        idempotencyKey: "postgres-journal-observation",
        claims: [],
      });
    assert.equal(observationReplay.status, "duplicate");
    const [observationCount] = await sql<{ count: number }[]>`
      select count(*)::integer as count
      from public.child_observations
      where child_id = ${childId}
        and family_id = ${familyId}
    `;
    assert.equal(observationCount.count, 1);
    assert.deepEqual(
      await repository.markObservationUsed({
        familyId: randomUUID(),
        observationId: persistedObservation.id,
        usedTaskRunId: null,
        usedAt: "2026-07-13T14:00:00.000000Z",
      }),
      { outcome: "unknown_observation" },
    );
    assert.deepEqual(
      await repository.markObservationUsed({
        familyId,
        observationId: persistedObservation.id,
        usedTaskRunId: null,
        usedAt: "2026-07-13T14:00:00.000000Z",
      }),
      { outcome: "used", childId },
    );
    assert.deepEqual(
      await repository.markObservationUsed({
        familyId,
        observationId: persistedObservation.id,
        usedTaskRunId: null,
        usedAt: "2026-07-13T14:01:00.000000Z",
      }),
      { outcome: "already_used", childId },
    );

    const undoSource = await service.recordProgressEvidence({
      familyId,
      childId,
      memberUserId: adultA,
      source: "checklist",
      itemId: "math.counts-to-5",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T17:30:30.000000Z",
      idempotencyKey: "postgres-undo-source",
    });
    assert.equal(undoSource.status, "recorded");
    if (undoSource.status !== "recorded") {
      throw new Error("PostgreSQL undo source was not recorded");
    }
    assert.ok(undoSource.operationId);
    const undone = await service.undoProgressOperation({
      familyId,
      memberUserId: adultA,
      operationId: undoSource.operationId,
      idempotencyKey: "postgres-undo-operation",
      observedAt: "2026-07-11T17:30:31.000000Z",
    });
    assert.equal(undone.status, "undone");
    const [persistedUndo] = await sql<
      {
        superseded: boolean;
        operation_status: string;
        source_operation_id: string;
      }[]
    >`
      select
        evidence.superseded_at is not null as superseded,
        operation.status as operation_status,
        source_operation.id::text as source_operation_id
      from public.child_progress_evidence evidence
      join public.child_progress_operations operation
        on operation.child_id = evidence.child_id
       and operation.family_id = evidence.family_id
       and operation.idempotency_key = 'postgres-undo-operation'
      join public.child_progress_operations source_operation
        on source_operation.id = ${undoSource.operationId}
      where evidence.id = ${undoSource.evidence[0].id}
    `;
    assert.deepEqual(persistedUndo, {
      superseded: true,
      operation_status: "undone",
      source_operation_id: undoSource.operationId,
    });
    assert.equal(
      (
        await service.recordJournalProgressEvidence({
          ...journalInput,
          quote: "Maya still cannot pedal without help",
        })
      ).status,
      "idempotency_mismatch",
    );
    assert.equal(
      (
        await service.recordProgressEvidence({
          familyId,
          childId,
          memberUserId: adultB,
          source: "conversation",
          channel: "web",
          messageId: progressEvidenceMessageId,
          itemId: "literacy.emergent-reader",
          answer: "not_yet",
          quote: null,
          observedAt: "2026-07-11T17:32:00.000000Z",
          idempotencyKey: "postgres-conflict",
        })
      ).status,
      "conflict_open",
    );
    assert.equal(
      (
        await service.recordProgressEvidence({
          familyId,
          childId,
          memberUserId: adultC,
          source: "conversation",
          channel: "web",
          messageId: progressEvidenceMessageId,
          itemId: "literacy.emergent-reader",
          answer: "getting_there",
          quote: null,
          observedAt: "2026-07-11T17:33:00.000000Z",
          idempotencyKey: "postgres-conflict-pending",
        })
      ).status,
      "conflict_pending",
    );
    const [initialConflict] = await sql<{ id: string }[]>`
      select id
      from public.child_progress_conflicts
      where child_id = ${childId}
        and family_id = ${familyId}
        and item_id = 'literacy.emergent-reader'
        and state = 'open'
    `;
    await assert.rejects(
      sql.begin(async (transaction) => {
        const [thirdEvidence] = await transaction<{ id: string }[]>`
          insert into public.child_progress_evidence (
            child_id, family_id, item_id, answer, source,
            member_user_id, observed_at, idempotency_key
          )
          values (
            ${childId}, ${familyId}, 'literacy.emergent-reader',
            'getting_there', 'checklist', ${adultC},
            '2026-07-11T17:34:00.000000Z',
            'postgres-third-conflict-evidence'
          )
          returning id
        `;
        await transaction`
          update public.child_progress_conflicts
          set state = 'resolved',
              resolved_answer = 'getting_there',
              resolved_evidence_id = ${thirdEvidence.id},
              resolved_by_member_user_id = ${adultC},
              resolved_at = '2026-07-11T17:34:01.000000Z'
          where id = ${initialConflict.id}
            and child_id = ${childId}
            and family_id = ${familyId}
        `;
      }),
    );

    const concurrentInput = {
      familyId,
      childId,
      memberUserId: adultA,
      source: "checklist" as const,
      itemId: "math.how-many-5",
      answer: "easily" as const,
      quote: null,
      observedAt: "2026-07-11T17:35:00.000000Z",
      idempotencyKey: "postgres-concurrent",
    };
    const concurrent = await Promise.all([
      service.recordProgressEvidence(concurrentInput),
      service.recordProgressEvidence(concurrentInput),
    ]);
    assert.deepEqual(
      concurrent.map((result) => result.status).sort(),
      ["duplicate", "recorded"],
    );

    assert.deepEqual(
      await service.recordProgressEvidence({
        ...concurrentInput,
        memberUserId: outsider,
        itemId: "writing.writes-name",
        idempotencyKey: "postgres-rollback",
      }),
      { status: "unknown_actor" },
    );
    const [rollback] = await sql<
      { operations: number; evidence: number }[]
    >`
      select
        (
          select count(*)::integer
          from public.child_progress_operations
          where child_id = ${childId}
            and family_id = ${familyId}
            and idempotency_key = 'postgres-rollback'
        ) as operations,
        (
          select count(*)::integer
          from public.child_progress_evidence
          where child_id = ${childId}
            and family_id = ${familyId}
            and idempotency_key = 'postgres-rollback'
        ) as evidence
    `;
    assert.deepEqual(rollback, { operations: 0, evidence: 0 });

    let signalInitialChildLock = () => {};
    let releaseInitialChildLock = () => {};
    const initialChildLocked = new Promise<void>((resolve) => {
      signalInitialChildLock = resolve;
    });
    const initialChildRelease = new Promise<void>((resolve) => {
      releaseInitialChildLock = resolve;
    });
    const preRevisionRepository =
      new PostgresChildProgressRepository(() => sql, {
        afterInitialChildLock: async () => {
          signalInitialChildLock();
          await initialChildRelease;
        },
      });
    const preRevisionService = new ChildProgressService(
      preRevisionRepository,
      {
        buildView: buildChildProgressView,
        now: () => new Date("2026-07-11T18:00:00.000Z"),
      },
    );
    const preRevisionWrite =
      preRevisionService.recordProgressEvidence({
        familyId,
        childId,
        memberUserId: adultA,
        source: "checklist",
        itemId: "self_care.washes-hands",
        answer: "easily",
        quote: null,
        observedAt: "2026-07-11T17:36:00.000000Z",
        idempotencyKey: "postgres-pre-revision-timezone",
      });
    await initialChildLocked;
    await writerSql`
      update public.families
      set time_zone = 'Pacific/Kiritimati'
      where id = ${familyId}
    `;
    releaseInitialChildLock();
    assert.equal((await preRevisionWrite).status, "recorded");
    const [preRevisionLive] = await sql<
      {
        projection_date: string;
        source_revision: string;
        canonical_revision: string;
      }[]
    >`
      select live.projection_date::text as projection_date,
             live.source_revision::text as source_revision,
             revision.revision::text as canonical_revision
      from public.child_progress_live live
      join public.child_progress_revisions revision
        on revision.child_id = live.child_id
       and revision.family_id = live.family_id
      where live.child_id = ${childId}
        and live.family_id = ${familyId}
    `;
    assert.equal(preRevisionLive.projection_date, "2026-07-12");
    assert.equal(
      preRevisionLive.source_revision,
      preRevisionLive.canonical_revision,
    );
    const liveBeforeWalkCoverage =
      await preRevisionRepository.loadLiveView(
        familyId,
        childId,
        new Date("2026-07-11T18:00:00.000Z"),
      );
    assert.ok(liveBeforeWalkCoverage);
    const walkCoverageItemId =
      "math.comparing-groups-more-or-fewer";
    const [walkEvidenceBefore] = await sql<{ count: number }[]>`
      select count(*)::integer as count
      from public.child_progress_evidence
      where child_id = ${childId}
        and family_id = ${familyId}
        and item_id = ${walkCoverageItemId}
    `;
    assert.equal(
      await saveWalkCoverageAnswerWithDatabase(
        {
          familyId,
          childId,
          itemId: walkCoverageItemId,
          answer: "not_sure",
          source: "onboarding_walk",
          memberUserId: null,
          observedAt: "2026-07-11T18:01:00.000000Z",
          idempotencyKey: "postgres-walk-not-sure",
        },
        sql,
      ),
      true,
    );
    await assertLiveInvalidated("walk not-sure coverage");
    const walkFallback =
      await service.getChildProgressView(familyId, childId);
    assert.deepEqual(
      walkFallback?.scores,
      liveBeforeWalkCoverage.scores,
    );
    assert.equal(
      await saveWalkCoverageAnswerWithDatabase(
        {
          familyId,
          childId,
          itemId: walkCoverageItemId,
          answer: "skip",
          source: "onboarding_walk",
          memberUserId: null,
          observedAt: "2026-07-11T18:02:00.000000Z",
          idempotencyKey: "postgres-walk-skip",
        },
        sql,
      ),
      true,
    );
    const [walkCoverageState] = await sql<
      {
        answer: string;
        source: string;
        answered_at: string;
        evidence_count: number;
      }[]
    >`
      select answer.answer, answer.source,
             to_char(
               answer.answered_at at time zone 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
             ) as answered_at,
             (
               select count(*)::integer
               from public.child_progress_evidence evidence
               where evidence.child_id = ${childId}
                 and evidence.family_id = ${familyId}
                 and evidence.item_id = ${walkCoverageItemId}
             ) as evidence_count
      from public.child_answers answer
      where answer.child_id = ${childId}
        and answer.question_id = ${walkCoverageItemId}
    `;
    assert.deepEqual(walkCoverageState, {
      answer: "skip",
      source: "onboarding_walk",
      answered_at: "2026-07-11T18:02:00.000000Z",
      evidence_count: walkEvidenceBefore.count,
    });
    await rebuild(
      "music.steady-beat",
      "rebuild-walk-coverage",
    );

    const [compatibility] = await sql<
      { token: string; history: unknown[] }[]
    >`
      select report.token, report.history
      from public.child_reports report
      where report.child_id = ${childId}
    `;
    assert.equal(compatibility.token, "keep-token");
    assert.deepEqual(compatibility.history, [{ marker: "keep" }]);

    await sql`
      insert into public.progress_check_ins (
        id, child_id, family_id, purpose, scope, state,
        active_member_user_id, prompt_recipient_member_user_id,
        revision, current_item_id,
        pending_runtime_session_id, pending_turn_id
      )
      values (
        ${checkInId}, ${childId}, ${familyId}, 'whole_map_refresh',
        '{}'::jsonb, 'active', ${adultA}, ${adultA}, 1,
        'math.counts-to-10', 'legacy-runtime', 'legacy-turn'
      )
    `;
    await assert.rejects(
      sql.begin((transaction) =>
        transaction`
          insert into public.progress_check_in_responses (
            child_id, family_id, check_in_id, revision, item_id,
            answer, member_user_id, is_evidence, evidence_id,
            idempotency_key, result
          )
          values (
            ${childId}, ${familyId}, ${checkInId}, 2,
            'math.counts-to-10', 'skip', ${adultA}, false, null,
            'postgres-invalid-response-status',
            '{"status":"paused"}'::jsonb
          )
        `
      ),
    );
    let signalLockReady = () => {};
    const lockReady = new Promise<void>((resolve) => {
      signalLockReady = resolve;
    });
    const held = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    blockerRun = blockerSql.begin(async (transactionSql) => {
      await transactionSql`
        lock table public.child_progress_conflicts
        in access exclusive mode
      `;
      signalLockReady();
      await held;
    });
    await lockReady;
    const snapshotPromise = repository.loadProjectionInput(
      familyId,
      childId,
    );
    let snapshotBlocked = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [activity] = await writerSql<{ blocked: boolean }[]>`
        select exists (
          select 1
          from pg_stat_activity
          where pid <> pg_backend_pid()
            and query like '%from public.child_progress_conflicts conflict%'
            and wait_event_type = 'Lock'
        ) as blocked
      `;
      if (activity.blocked) {
        snapshotBlocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(snapshotBlocked, true);
    await writerSql`
      insert into public.progress_check_in_responses (
        child_id, family_id, check_in_id, revision, item_id,
        answer, member_user_id, channel, inbound_message_id,
        is_evidence, evidence_id,
        idempotency_key
      )
      values (
        ${childId}, ${familyId}, ${checkInId}, 1,
        'math.counts-to-10', 'skip', ${adultA}, 'web',
        ${progressEvidenceMessageId}, false, null,
        'postgres-late-response'
      )
    `;
    releaseLock();
    await blockerRun;
    blockerRun = null;
    const snapshot = await snapshotPromise;
    assert.ok(snapshot);
    assert.equal(
      snapshot.selectionAnswers.some(
        (answer) => answer.selectionId === "postgres-late-response",
      ),
      false,
    );

    await assertLiveInvalidated("response revision");
    await rebuild("writing.writes-name", "rebuild-response");
    const evidenceToSupersede = (
      await sql<{ id: string }[]>`
        select id
        from public.child_progress_evidence
        where child_id = ${childId}
          and family_id = ${familyId}
          and item_id = 'writing.writes-name'
        limit 1
      `
    )[0];
    await sql`
      update public.child_progress_evidence
      set superseded_at = now()
      where id = ${evidenceToSupersede.id}
        and child_id = ${childId}
        and family_id = ${familyId}
    `;
    await assertLiveInvalidated("same-count supersession");
    await raceSourceMutation({
      label: "concurrent timezone",
      itemId: "gross_motor.pedals",
      idempotencyKey: "race-timezone",
      mutate: () => writerSql`
        update public.families
        set time_zone = 'America/New_York'
        where id = ${familyId}
      `,
    });
    await raceSourceMutation({
      label: "concurrent adult display name",
      itemId: "science.predicts",
      idempotencyKey: "race-adult-name",
      mutate: () => writerSql`
        update public.family_members
        set display_name = 'Elena Updated'
        where family_id = ${familyId} and user_id = ${adultA}
      `,
    });
    await writerSql`
      insert into public.child_answers (
        child_id, question_id, answer, source, answered_at
      )
      values (
        ${childId}, 'art.plans-artwork', 'not_yet',
        'checklist', '2026-07-11T18:24:00.000000Z'
      )
      on conflict (child_id, question_id) do update
      set answer = excluded.answer,
          source = excluded.source,
          answered_at = excluded.answered_at
    `;
    let signalNoBridgeBlock = () => {};
    const noBridgeBlockReady = new Promise<void>((resolve) => {
      signalNoBridgeBlock = resolve;
    });
    const holdNoBridgeBlock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    blockerRun = blockerSql.begin(async (transactionSql) => {
      await transactionSql`
        lock table public.child_progress_conflicts
        in access exclusive mode
      `;
      signalNoBridgeBlock();
      await holdNoBridgeBlock;
    });
    await noBridgeBlockReady;
    const sameItemEvidence = service.recordProgressEvidence({
      familyId,
      childId,
      memberUserId: adultA,
      source: "checklist",
      itemId: "art.plans-artwork",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T18:25:00.000000Z",
      idempotencyKey: "race-no-bridge-same-item",
    });
    let sameItemEvidenceBlocked = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [activity] = await writerSql<{ blocked: boolean }[]>`
        select exists (
          select 1
          from pg_stat_activity
          where pid <> pg_backend_pid()
            and query like '%from public.child_progress_conflicts conflict%'
            and wait_event_type = 'Lock'
        ) as blocked
      `;
      if (activity.blocked) {
        sameItemEvidenceBlocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(sameItemEvidenceBlocked, true);
    let signalDirectUpdate = () => {};
    let releaseDirectUpdate = () => {};
    const directUpdateFinished = new Promise<void>((resolve) => {
      signalDirectUpdate = resolve;
    });
    const holdDirectUpdate = new Promise<void>((resolve) => {
      releaseDirectUpdate = resolve;
    });
    const directUpdateRun = writerSql.begin(async (transactionSql) => {
      await transactionSql`
        select pg_advisory_xact_lock_shared(
          ${CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY}::bigint
        )
      `;
      await transactionSql`
        select child.id
        from public.children child
        where child.id = ${childId}
          and child.family_id = ${familyId}
        for update
      `;
      await transactionSql`
        update public.child_answers
        set answer = 'getting_there',
            source = 'correction',
            answered_at = '2026-07-11T18:25:01.000000Z'
        where child_id = ${childId}
          and question_id = 'art.plans-artwork'
      `;
      signalDirectUpdate();
      await holdDirectUpdate;
    });
    const directUpdateDidNotWaitForRevision = await Promise.race([
      directUpdateFinished.then(() => true),
      new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), 500);
      }),
    ]);
    const sameItemBlockerRun = requireRunningPromise(
      blockerRun,
      "same-item blocker",
    );
    releaseLock();
    releaseDirectUpdate();
    const [, evidenceResult] = await allSettledValuesOrThrow([
      directUpdateRun,
      sameItemEvidence,
      sameItemBlockerRun,
    ] as const);
    blockerRun = null;
    assert.equal(evidenceResult.status, "recorded");
    assert.equal(directUpdateDidNotWaitForRevision, false);
    await rebuild("music.steady-beat", "rebuild-legacy");
    await sql`
      update public.child_answers
      set answered_at = answered_at + interval '1 second'
      where child_id = ${childId}
        and question_id = 'music.steady-beat'
    `;
    await assertLiveInvalidated("same answer newer date");
    await rebuild(
      "music.steady-beat",
      "rebuild-legacy-newer-date",
    );

    await sql`
      update public.children
      set name = 'Maya Renamed'
      where id = ${childId} and family_id = ${familyId}
    `;
    await assertLiveInvalidated("child rename");
    await rebuild("fine_motor.cuts-line", "rebuild-child");

    await sql`
      update public.progress_check_ins
      set state = 'stopped',
          current_item_id = null,
          pending_runtime_session_id = null,
          pending_turn_id = null,
          pause_reason = null,
          paused_at = null,
          completed_at = null,
          stopped_at = '2026-07-11T18:30:00.000000Z',
          updated_at = '2026-07-11T18:30:00.000000Z'
      where id = ${checkInId}
        and child_id = ${childId}
        and family_id = ${familyId}
    `;
    await sql`
      insert into public.conversation_episodes (id, family_id)
      values (${task5EpisodeId}, ${familyId})
    `;
    await sql`
      insert into public.conversation_deliveries (
        id, family_id, episode_id, recipient_member_user_id,
        channel, destination_hash
      )
      values
        (
          ${task5DeliveryId}, ${familyId}, ${task5EpisodeId}, ${adultA},
          'sms', ${hashContinuityKey("sms:+15550000001")}
        ),
        (
          ${task5WrongDeliveryId}, ${familyId}, ${task5EpisodeId}, ${adultB},
          'sms', ${hashContinuityKey("sms:+15550000002")}
        )
    `;
    const task5Context = (input: {
      memberUserId: string;
      providerMessageId: string;
      repliedDeliveryId?: string | null;
      runtimeSessionId?: string;
      turnId?: string;
      now: string;
    }) => ({
      familyId,
      memberUserId: input.memberUserId,
      channel: "sms" as const,
      providerMessageId: input.providerMessageId,
      repliedDeliveryId: input.repliedDeliveryId ?? null,
      episodeId: task5EpisodeId,
      runtimeSessionId:
        input.runtimeSessionId ?? "postgres-runtime-session",
      turnId: input.turnId ?? `turn:${input.providerMessageId}`,
      canonicalInboundText: "Maya answered the progress check-in.",
      inboundMessageId: randomUUID(),
      now: input.now,
    });
    // Positive fixtures deliver and bind a real owned ledger row before answering.
    const bindFixtureQuestion = async (checkIn: ProgressCheckInRecord) => {
      const deliveryId = randomUUID();
      await sql`
        insert into public.conversation_deliveries
          (id, family_id, episode_id, recipient_member_user_id, channel, status)
        values (${deliveryId}, ${checkIn.familyId}, ${checkIn.episodeId},
          ${checkIn.recipientMemberUserId}, 'sms', 'sent')
      `;
      const result = await checkInService.bindCurrentDelivery(task5Context({
        memberUserId: checkIn.recipientMemberUserId!, providerMessageId: `bind:${deliveryId}`,
        runtimeSessionId: checkIn.pendingRuntimeSessionId!, turnId: checkIn.pendingTurnId!,
        now: checkIn.updatedAt,
      }), {checkInId: checkIn.id, expectedRevision: checkIn.revision, deliveryId});
      assert.equal(result.status, "bound");
      return deliveryId;
    };
    const firstStartInput = {
      childId,
      purpose: "age_refresh" as const,
      subjectIds: ["social_emotional", "self_care"],
      idempotencyKey: "postgres-check-in-start",
    };
    const racingStarts = await Promise.all([
      checkInService.startCheckIn(
        task5Context({
          memberUserId: adultA,
          providerMessageId: "postgres-start-a",
          now: "2026-07-11T18:31:00.000001Z",
        }),
        firstStartInput,
      ),
      checkInService.startCheckIn(
        task5Context({
          memberUserId: adultA,
          providerMessageId: "postgres-start-b",
          now: "2026-07-11T18:31:00.000002Z",
        }),
        {
          ...firstStartInput,
          idempotencyKey: "postgres-check-in-start-race",
        },
      ),
    ]);
    assert.deepEqual(
      racingStarts.map((result) => result.status).sort(),
      ["existing", "started"],
    );
    const firstStarted = racingStarts.find(
      (result) => result.status === "started",
    );
    assert.ok(firstStarted);
    if (firstStarted.status !== "started") {
      throw new Error("Task 5 start did not return its prompt");
    }
    assert.equal(firstStarted.checkIn.revision, 1);
    const [firstSnapshot] = await sql<{ count: number }[]>`
      select count(*)::integer as count
      from public.child_progress_snapshots
      where check_in_id = ${firstStarted.checkIn.id}
        and child_id = ${childId}
        and family_id = ${familyId}
        and snapshot_kind = 'check_in_group'
    `;
    assert.equal(firstSnapshot.count, 1);
    assert.deepEqual(
      (
        await checkInService.listActiveFamilyCheckIns(familyId)
      ).map((checkIn) => checkIn.id),
      [firstStarted.checkIn.id],
    );
    assert.equal(
      (
        await checkInService.getActiveChildCheckIn(
          familyId,
          childId,
        )
      )?.id,
      firstStarted.checkIn.id,
    );
    assert.equal(
      (
        await checkInService.getPromptContext(
          task5Context({
            memberUserId: adultA,
            providerMessageId: "postgres-prompt-context",
            now: "2026-07-11T18:31:15.000000Z",
          }),
        )
      )?.checkInId,
      firstStarted.checkIn.id,
    );
    await sql`
      insert into public.conversation_messages (id, family_id)
      values (${task6MessageId}, ${familyId})
    `;
    await sql`
      insert into public.conversation_open_loops (
        family_id, episode_id, message_id, delivery_id,
        kind, state, prompt_key, expires_at
      )
      values (
        ${familyId}, ${task5EpisodeId}, ${task6MessageId},
        ${task5DeliveryId}, 'free_text', 'open',
        'reactive-question', '2026-07-12T18:31:15.000000Z'
      )
    `;
    const progressContract = replyContractForProgressCheckIn(
      firstStarted.checkIn.id,
      firstStarted.checkIn.revision,
    );
    await openReplyLoopWithDatabase(
      sql,
      {
        attempt: {
          id: task5DeliveryId,
          familyId,
          episodeId: task5EpisodeId,
          messageId: task6MessageId,
          taskRunId: null,
          memberUserId: adultA,
          channel: "sms",
          destination: "+15550000001",
          providerThreadKey: "task-6-thread",
          existingStatus: "sent",
          shouldSend: false,
        },
        contract: progressContract,
        now: new Date("2026-07-11T18:31:16.000Z"),
      },
    );
    const [persistedProgressLoop] = await sql<
      {
        kind: string;
        prompt_key: string | null;
        state: string;
      }[]
    >`
      select kind, prompt_key, state
      from public.conversation_open_loops
      where delivery_id = ${task5DeliveryId}
    `;
    assert.deepEqual(persistedProgressLoop, {
      kind: "choice",
      prompt_key:
        `progress-check-in:${firstStarted.checkIn.id}:revision:${firstStarted.checkIn.revision}`,
      state: "cancelled",
    });
    await sql`
      update public.conversation_open_loops
      set state = 'resolved',
          resolved_at = '2026-07-11T18:31:17.000000Z',
          resolved_by_message_id = ${task6MessageId}
      where delivery_id = ${task5DeliveryId}
    `;
    await openReplyLoopWithDatabase(
      sql,
      {
        attempt: {
          id: task5DeliveryId,
          familyId,
          episodeId: task5EpisodeId,
          messageId: task6MessageId,
          taskRunId: null,
          memberUserId: adultA,
          channel: "sms",
          destination: "+15550000001",
          providerThreadKey: "task-6-thread",
          existingStatus: "sent",
          shouldSend: false,
        },
        contract: {
          kind: "free_text",
          promptKey: "reactive-question",
          expiresAfterMs: 24 * 60 * 60_000,
        },
        now: new Date("2026-07-11T18:31:18.000Z"),
      },
    );
    const [resolvedReplayLoop] = await sql<
      {
        kind: string;
        prompt_key: string | null;
        state: string;
      }[]
    >`
      select kind, prompt_key, state
      from public.conversation_open_loops
      where delivery_id = ${task5DeliveryId}
    `;
    assert.deepEqual(resolvedReplayLoop, {
      kind: "choice",
      prompt_key:
        `progress-check-in:${firstStarted.checkIn.id}:revision:${firstStarted.checkIn.revision}`,
      state: "resolved",
    });
    await sql`
      delete from public.conversation_open_loops
      where delivery_id = ${task5DeliveryId}
    `;

    await assert.rejects(
      repository.withTransaction((transaction) =>
        transaction.insertCheckInResponse({
          childId,
          familyId,
          checkInId: firstStarted.checkIn.id,
          revision: 1,
          itemId: firstStarted.prompt.itemId,
          answer: "skip",
          memberUserId: adultA,
          deliveryId: task5DeliveryId,
          channel: "sms",
          providerMessageId: "postgres-sql-unbound-delivery",
          idempotencyKey: "postgres-sql-unbound-delivery",
          createdAt: "2026-07-11T18:31:20.000000Z",
        })
      ),
      /lost its validated prompt/u,
    );
    const currentPromptCheckIn =
      await checkInService.getActiveChildCheckIn(familyId, childId);
    assert.ok(currentPromptCheckIn);
    const bindingMarker = {
      runtimeSessionId:
        currentPromptCheckIn.pendingRuntimeSessionId ?? "",
      turnId: currentPromptCheckIn.pendingTurnId ?? "",
    };
    assert.deepEqual(
      await checkInService.bindCurrentDelivery(
        task5Context({
          memberUserId: adultA,
          providerMessageId: "postgres-bind-wrong-recipient",
          ...bindingMarker,
          now: "2026-07-11T18:31:29.000000Z",
        }),
        {
          checkInId: firstStarted.checkIn.id,
          expectedRevision: currentPromptCheckIn.revision,
          deliveryId: task5WrongDeliveryId,
        },
      ),
      { status: "wrong_delivery" },
    );
    await sql`
      update public.conversation_deliveries
      set replied_at = '2026-07-11T18:31:29.500000Z'
      where id = ${task5DeliveryId}
    `;
    assert.deepEqual(
      await checkInService.bindCurrentDelivery(
        task5Context({
          memberUserId: adultA,
          providerMessageId: "postgres-bind-after-reply",
          ...bindingMarker,
          now: "2026-07-11T18:31:29.600000Z",
        }),
        {
          checkInId: firstStarted.checkIn.id,
          expectedRevision: currentPromptCheckIn.revision,
          deliveryId: task5DeliveryId,
        },
      ),
      { status: "wrong_delivery" },
    );
    await sql`
      update public.conversation_deliveries
      set replied_at = null, status = 'failed'
      where id = ${task5DeliveryId}
    `;
    assert.deepEqual(
      await checkInService.bindCurrentDelivery(
        task5Context({
          memberUserId: adultA,
          providerMessageId: "postgres-bind-hard-failure",
          ...bindingMarker,
          now: "2026-07-11T18:31:29.700000Z",
        }),
        {
          checkInId: firstStarted.checkIn.id,
          expectedRevision: currentPromptCheckIn.revision,
          deliveryId: task5DeliveryId,
        },
      ),
      { status: "wrong_delivery" },
    );
    await sql`
      update public.conversation_deliveries
      set status = 'uncertain'
      where id = ${task5DeliveryId}
    `;
    assert.deepEqual(
      await checkInService.bindCurrentDelivery(
        task5Context({
          memberUserId: adultA,
          providerMessageId: "postgres-bind-uncertain",
          ...bindingMarker,
          now: "2026-07-11T18:31:29.800000Z",
        }),
        {
          checkInId: firstStarted.checkIn.id,
          expectedRevision: currentPromptCheckIn.revision,
          deliveryId: task5DeliveryId,
        },
      ),
      { status: "wrong_delivery" },
    );
    const uncertainPaused =
      await checkInService.pauseCheckInForDeliveryOutcome(
        task5Context({
          memberUserId: adultA,
          providerMessageId: "postgres-pause-uncertain",
          ...bindingMarker,
          now: "2026-07-11T18:31:29.850000Z",
        }),
        {
          checkInId: firstStarted.checkIn.id,
          expectedRevision: currentPromptCheckIn.revision,
          reason: "delivery_uncertain",
        },
      );
    assert.equal(uncertainPaused.status, "paused");
    if (uncertainPaused.status !== "paused") {
      throw new Error("Uncertain delivery did not pause");
    }
    assert.equal(
      uncertainPaused.checkIn.pendingRuntimeSessionId,
      null,
    );
    const resumedAfterUncertain =
      await checkInService.resumeCheckIn(
        task5Context({
          memberUserId: adultA,
          providerMessageId: "postgres-resume-uncertain",
          runtimeSessionId: "postgres-resume-runtime",
          turnId: "postgres-resume-turn",
          now: "2026-07-11T18:31:29.900000Z",
        }),
        { checkInId: firstStarted.checkIn.id },
      );
    assert.equal(resumedAfterUncertain.status, "resumed");
    if (resumedAfterUncertain.status !== "resumed") {
      throw new Error("Uncertain delivery did not resume");
    }
    await sql`
      update public.conversation_deliveries
      set status = 'sent'
      where id = ${task5DeliveryId}
    `;
    const bound = await checkInService.bindCurrentDelivery(
      task5Context({
        memberUserId: adultA,
        providerMessageId: "postgres-bind",
        runtimeSessionId:
          resumedAfterUncertain.checkIn.pendingRuntimeSessionId ?? "",
        turnId: resumedAfterUncertain.checkIn.pendingTurnId ?? "",
        now: "2026-07-11T18:31:30.000000Z",
      }),
      {
        checkInId: firstStarted.checkIn.id,
        expectedRevision: resumedAfterUncertain.checkIn.revision,
        deliveryId: task5DeliveryId,
      },
    );
    assert.equal(bound.status, "bound");
    if (bound.status !== "bound") {
      throw new Error("Task 5 delivery binding was refused");
    }
    assert.equal(bound.checkIn.currentDeliveryId, task5DeliveryId);
    const progressLoopDecoyFamilyId = randomUUID();
    const progressLoopWrongDeliveryId = randomUUID();
    await sql`
      insert into public.families (id)
      values (${progressLoopDecoyFamilyId})
    `;
    await sql`
      insert into public.conversation_deliveries (
        id, family_id, episode_id, recipient_member_user_id,
        channel, destination_hash
      )
      values (
        ${progressLoopWrongDeliveryId}, ${familyId},
        ${task5EpisodeId}, ${adultA}, 'sms',
        ${hashContinuityKey("sms:+15550000003")}
      )
    `;
    const assertInsertedProgressLoopState = async (input: {
      label: string;
      loopFamilyId: string;
      deliveryId: string;
      promptKey: string;
      expectedState: "open" | "cancelled";
    }) => {
      await sql`
        delete from public.conversation_open_loops
        where delivery_id = ${input.deliveryId}
      `;
      await sql`
        insert into public.conversation_open_loops (
          family_id, episode_id, message_id, delivery_id,
          kind, state, prompt_key, expires_at
        )
        values (
          ${input.loopFamilyId}, ${task5EpisodeId}, ${task6MessageId},
          ${input.deliveryId}, 'choice', 'open', ${input.promptKey},
          '2026-07-12T18:31:30.000000Z'
        )
      `;
      const [loop] = await sql<{ state: string }[]>`
        select state
        from public.conversation_open_loops
        where delivery_id = ${input.deliveryId}
      `;
      assert.deepEqual(
        loop,
        { state: input.expectedState },
        input.label,
      );
    };
    const currentProgressPrompt =
      `progress-check-in:${bound.checkIn.id}:revision:${bound.checkIn.revision}`;
    await assertInsertedProgressLoopState({
      label: "generic loop remains open",
      loopFamilyId: familyId,
      deliveryId: task5WrongDeliveryId,
      promptKey: "reactive-question",
      expectedState: "open",
    });
    await assertInsertedProgressLoopState({
      label: "wrong delivery progress loop is cancelled",
      loopFamilyId: familyId,
      deliveryId: progressLoopWrongDeliveryId,
      promptKey: currentProgressPrompt,
      expectedState: "cancelled",
    });
    await assertInsertedProgressLoopState({
      label: "wrong revision progress loop is cancelled",
      loopFamilyId: familyId,
      deliveryId: task5DeliveryId,
      promptKey:
        `progress-check-in:${bound.checkIn.id}:revision:${bound.checkIn.revision + 1}`,
      expectedState: "cancelled",
    });
    await assertInsertedProgressLoopState({
      label: "wrong check-in progress loop is cancelled",
      loopFamilyId: familyId,
      deliveryId: task5DeliveryId,
      promptKey:
        `progress-check-in:${randomUUID()}:revision:${bound.checkIn.revision}`,
      expectedState: "cancelled",
    });
    await assertInsertedProgressLoopState({
      label: "wrong family progress loop is cancelled",
      loopFamilyId: progressLoopDecoyFamilyId,
      deliveryId: task5DeliveryId,
      promptKey: currentProgressPrompt,
      expectedState: "cancelled",
    });
    await assertInsertedProgressLoopState({
      label: "current progress loop remains open",
      loopFamilyId: familyId,
      deliveryId: task5DeliveryId,
      promptKey: currentProgressPrompt,
      expectedState: "open",
    });
    const activeSmsProgress =
      await resolveActiveSmsProgressContextWithDatabase(sql, {
        familyId,
        memberUserId: adultA,
        phoneNumber: "+15550000001",
      });
    assert.deepEqual(activeSmsProgress, {
      checkInId: firstStarted.checkIn.id,
      deliveryId: task5DeliveryId,
    });
    assert.equal(
      await resolveActiveSmsProgressContextWithDatabase(sql, {
        familyId,
        memberUserId: adultA,
        phoneNumber: "+15550000099",
      }),
      null,
    );
    assert.equal(
      await resolveActiveSmsProgressContextWithDatabase(sql, {
        familyId,
        memberUserId: adultB,
        phoneNumber: "+15550000001",
      }),
      null,
    );
    await sql`
      update public.conversation_deliveries
      set channel = 'email'
      where id = ${task5DeliveryId}
    `;
    assert.equal(
      await resolveActiveSmsProgressContextWithDatabase(sql, {
        familyId,
        memberUserId: adultA,
        phoneNumber: "+15550000001",
      }),
      null,
    );
    await sql`
      update public.conversation_deliveries
      set channel = 'sms', status = 'failed'
      where id = ${task5DeliveryId}
    `;
    assert.equal(
      await resolveActiveSmsProgressContextWithDatabase(sql, {
        familyId,
        memberUserId: adultA,
        phoneNumber: "+15550000001",
      }),
      null,
    );
    await sql`
      update public.conversation_deliveries
      set status = 'sent'
      where id = ${task5DeliveryId}
    `;
    await sql`
      update public.progress_check_ins
      set current_delivery_id = ${task5WrongDeliveryId}
      where id = ${firstStarted.checkIn.id}
    `;
    assert.equal(
      await resolveActiveSmsProgressContextWithDatabase(sql, {
        familyId,
        memberUserId: adultA,
        phoneNumber: "+15550000001",
      }),
      null,
    );
    await sql`
      update public.progress_check_ins
      set current_delivery_id = ${task5DeliveryId}
      where id = ${firstStarted.checkIn.id}
    `;
    await sql`
      update public.conversation_deliveries
      set replied_at = '2026-07-11T18:31:35.000000Z'
      where id = ${task5DeliveryId}
    `;
    assert.deepEqual(
      await resolveActiveSmsProgressContextWithDatabase(sql, {
        familyId,
        memberUserId: adultA,
        phoneNumber: "+15550000001",
      }),
      activeSmsProgress,
    );
    await sql`
      update public.conversation_deliveries
      set replied_at = null
      where id = ${task5DeliveryId}
    `;
    const siblingChildId = randomUUID();
    const siblingCheckInId = randomUUID();
    const siblingDeliveryId = randomUUID();
    await sql`
      insert into public.children (
        id, family_id, name, birth_month
      )
      values (
        ${siblingChildId}, ${familyId}, 'Sibling', '2020-01-01'
      )
    `;
    await sql`
      insert into public.conversation_deliveries (
        id, family_id, episode_id, recipient_member_user_id,
        channel, destination_hash
      )
      values (
        ${siblingDeliveryId}, ${familyId}, ${task5EpisodeId}, ${adultA},
        'sms', ${hashContinuityKey("sms:+15550000001")}
      )
    `;
    await sql`
      insert into public.progress_check_ins (
        id, child_id, family_id, idempotency_key, purpose, scope,
        state, active_member_user_id,
        prompt_recipient_member_user_id, revision,
        current_item_id, current_delivery_id, episode_id,
        pending_runtime_session_id, pending_turn_id
      )
      values (
        ${siblingCheckInId}, ${siblingChildId}, ${familyId},
        'active-sms-context-sibling', 'whole_map_refresh',
        '{"kind":"whole_map"}'::jsonb, 'active', ${adultA}, ${adultA},
        1, 'math.counts-to-5', ${siblingDeliveryId}, ${task5EpisodeId},
        'sibling-runtime', 'sibling-turn'
      )
    `;
    assert.equal(
      await resolveActiveSmsProgressContextWithDatabase(sql, {
        familyId,
        memberUserId: adultA,
        phoneNumber: "+15550000001",
      }),
      null,
    );
    await sql`
      delete from public.progress_check_ins
      where id = ${siblingCheckInId}
    `;
    await sql`
      delete from public.conversation_deliveries
      where id = ${siblingDeliveryId}
    `;
    await sql`
      delete from public.children
      where id = ${siblingChildId}
    `;
    await assert.rejects(
      repository.withTransaction((transaction) =>
        transaction.insertCheckInResponse({
          childId,
          familyId,
          checkInId: firstStarted.checkIn.id,
          revision: 1,
          itemId: firstStarted.prompt.itemId,
          answer: "skip",
          memberUserId: adultA,
          deliveryId: null,
          channel: "sms",
          providerMessageId: "postgres-sql-bound-null-delivery",
          idempotencyKey: "postgres-sql-bound-null-delivery",
          createdAt: "2026-07-11T18:31:40.000000Z",
        })
      ),
      /lost its validated prompt/u,
    );
    const responseCandidates = [
      {
        context: task5Context({
          memberUserId: adultA,
          providerMessageId: "postgres-cas-a",
          repliedDeliveryId: task5DeliveryId,
          now: "2026-07-11T18:32:00.000001Z",
        }),
        input: {
          checkInId: firstStarted.checkIn.id,
          expectedRevision: bound.checkIn.revision,
          answer: "easily" as const,
          idempotencyKey: "postgres-cas-a",
        },
      },
      {
        context: task5Context({
          memberUserId: adultA,
          providerMessageId: "postgres-cas-b",
          repliedDeliveryId: task5DeliveryId,
          now: "2026-07-11T18:32:00.000002Z",
        }),
        input: {
          checkInId: firstStarted.checkIn.id,
          expectedRevision: bound.checkIn.revision,
          answer: "getting_there" as const,
          idempotencyKey: "postgres-cas-b",
        },
      },
    ];
    await sql`
      delete from public.conversation_open_loops
      where delivery_id = ${task5DeliveryId}
    `;
    let signalProgressLoopInserted = () => {};
    let releaseProgressLoopInsert = () => {};
    const progressLoopInserted = new Promise<void>((resolve) => {
      signalProgressLoopInserted = resolve;
    });
    const holdProgressLoopInsert = new Promise<void>((resolve) => {
      releaseProgressLoopInsert = resolve;
    });
    const progressLoopInsertRun = blockerSql.begin(
      async (transactionSql) => {
        await transactionSql`
          insert into public.conversation_open_loops (
            family_id, episode_id, message_id, delivery_id,
            kind, state, prompt_key, expires_at
          )
          values (
            ${familyId}, ${task5EpisodeId}, ${task6MessageId},
            ${task5DeliveryId}, 'choice', 'open',
            ${currentProgressPrompt},
            '2026-07-12T18:31:40.000000Z'
          )
        `;
        signalProgressLoopInserted();
        await holdProgressLoopInsert;
      },
    );
    await progressLoopInserted;
    let racingResponsesSettled = false;
    const racingResponsesPromise = Promise.all(
      responseCandidates.map((candidate) =>
        checkInService.respondCheckIn(
          candidate.context,
          candidate.input,
        )
      ),
    ).then((responses) => {
      racingResponsesSettled = true;
      return responses;
    });
    let responseWaitedForLoopGuard = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [activity] = await writerSql<{ blocked: boolean }[]>`
        select exists (
          select 1
          from pg_stat_activity
          where pid <> pg_backend_pid()
            and wait_event_type = 'Lock'
            and query not like '%pg_stat_activity%'
        ) as blocked
      `;
      if (activity.blocked && !racingResponsesSettled) {
        responseWaitedForLoopGuard = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    releaseProgressLoopInsert();
    const [racingResponses] = await Promise.all([
      racingResponsesPromise,
      progressLoopInsertRun,
    ]);
    assert.equal(responseWaitedForLoopGuard, true);
    assert.deepEqual(
      racingResponses.map((result) => result.status).sort(),
      ["advanced", "wrong_delivery"],
    );
    const winnerIndex = racingResponses.findIndex(
      (result) => result.status === "advanced",
    );
    assert.notEqual(winnerIndex, -1);
    const advancedResponse = racingResponses[winnerIndex];
    assert.equal(advancedResponse.status, "advanced");
    if (advancedResponse.status !== "advanced") {
      throw new Error("Task 5 response did not advance");
    }
    assert.ok(advancedResponse.progressUpdate);
    const guardedLoopStates = await sql<
      { delivery_id: string; state: string }[]
    >`
      select delivery_id, state
      from public.conversation_open_loops
      where delivery_id in (
        ${task5DeliveryId},
        ${task5WrongDeliveryId}
      )
      order by delivery_id
    `;
    assert.deepEqual(
      new Map(
        guardedLoopStates.map((loop) => [
          loop.delivery_id,
          loop.state,
        ]),
      ),
      new Map([
        [task5DeliveryId, "cancelled"],
        [task5WrongDeliveryId, "open"],
      ]),
    );
    console.log(
      "PASS  child-progress-e2e guarded-progress-loop-insertion-race",
    );
    const winner = responseCandidates[winnerIndex];
    const idempotencyDuplicate =
      await checkInService.respondCheckIn(
        winner.context,
        winner.input,
      );
    assert.equal(idempotencyDuplicate.status, "duplicate");
    assert.equal(
      (
        await checkInService.respondCheckIn(
          {
            ...winner.context,
            memberUserId: adultB,
          },
          winner.input,
        )
      ).status,
      "wrong_recipient",
    );
    assert.equal(
      (
        await checkInService.respondCheckIn(
          {
            ...winner.context,
            repliedDeliveryId: null,
          },
          winner.input,
        )
      ).status,
      "wrong_delivery",
    );
    const providerDuplicate =
      await checkInService.respondCheckIn(
        winner.context,
        {
          ...winner.input,
          answer:
            winner.input.answer === "easily"
              ? "getting_there"
              : "easily",
          idempotencyKey: "postgres-provider-duplicate",
        },
      );
    assert.equal(providerDuplicate.status, "duplicate");
    const [singleResponse] = await sql<{ count: number }[]>`
      select count(*)::integer as count
      from public.progress_check_in_responses
      where check_in_id = ${firstStarted.checkIn.id}
        and child_id = ${childId}
        and family_id = ${familyId}
    `;
    assert.equal(singleResponse.count, 1);
    const loadTask5SavedResponse = async () => {
      const [savedResponse] = await sql<
        {
          item_id: string;
          answer: string;
          member_user_id: string | null;
          provider_message_id: string | null;
          idempotency_key: string;
          is_evidence: boolean;
          evidence_id: string | null;
          result: unknown;
        }[]
      >`
        select item_id, answer, member_user_id, provider_message_id,
               idempotency_key, is_evidence, evidence_id, result
        from public.progress_check_in_responses
        where check_in_id = ${firstStarted.checkIn.id}
          and child_id = ${childId}
          and family_id = ${familyId}
      `;
      assert.ok(savedResponse);
      return savedResponse;
    };

    const takeover = await checkInService.takeoverCheckIn(
      task5Context({
        memberUserId: adultB,
        providerMessageId: "postgres-takeover",
        now: "2026-07-11T18:33:00.000000Z",
      }),
      {
        checkInId: firstStarted.checkIn.id,
        expectedRevision: 2,
      },
    );
    assert.equal(takeover.status, "takeover_accepted");
    if (takeover.status !== "takeover_accepted") {
      throw new Error("Task 5 takeover was refused");
    }
    assert.equal(takeover.checkIn.ownerMemberUserId, adultB);
    assert.equal(
      takeover.checkIn.currentItemId,
      advancedResponse.prompt.itemId,
    );
    assert.equal(
      takeover.prompt.itemId,
      advancedResponse.prompt.itemId,
    );
    assert.equal(
      takeover.checkIn.revision,
      resumedAfterUncertain.checkIn.revision + 2,
    );
    const [persistedTakeover] = await sql<
      {
        state: string;
        revision: number;
        current_item_id: string;
        active_member_user_id: string;
        prompt_recipient_member_user_id: string;
        response_count: number;
      }[]
    >`
      select check_in.state, check_in.revision,
             check_in.current_item_id,
             check_in.active_member_user_id,
             check_in.prompt_recipient_member_user_id,
             (
               select count(*)::integer
               from public.progress_check_in_responses response
               where response.check_in_id = check_in.id
             ) as response_count
      from public.progress_check_ins check_in
      where check_in.id = ${firstStarted.checkIn.id}
        and check_in.family_id = ${familyId}
    `;
    assert.deepEqual(persistedTakeover, {
      state: "active",
      revision: takeover.checkIn.revision,
      current_item_id: advancedResponse.prompt.itemId,
      active_member_user_id: adultB,
      prompt_recipient_member_user_id: adultB,
      response_count: 1,
    });
    const savedResponseAfterTakeover =
      await loadTask5SavedResponse();
    assert.deepEqual(
      {
        item_id: savedResponseAfterTakeover.item_id,
        answer: savedResponseAfterTakeover.answer,
        member_user_id: savedResponseAfterTakeover.member_user_id,
        provider_message_id:
          savedResponseAfterTakeover.provider_message_id,
        idempotency_key:
          savedResponseAfterTakeover.idempotency_key,
        is_evidence: savedResponseAfterTakeover.is_evidence,
      },
      {
        item_id: firstStarted.prompt.itemId,
        answer: winner.input.answer,
        member_user_id: adultA,
        provider_message_id: winner.context.providerMessageId,
        idempotency_key: winner.input.idempotencyKey,
        is_evidence: true,
      },
    );
    const task5EvidenceId =
      savedResponseAfterTakeover.evidence_id;
    assert.ok(task5EvidenceId);
    const stop = await checkInService.stopCheckIn(
      task5Context({
        memberUserId: adultB,
        providerMessageId: "postgres-stop",
        now: "2026-07-11T18:34:00.000000Z",
      }),
      {
        checkInId: firstStarted.checkIn.id,
        expectedRevision: 3,
      },
    );
    assert.equal(stop.status, "stopped");
    const [afterStop] = await sql<
      {
        state: string;
        snapshots: number;
        report_history: unknown[];
      }[]
    >`
      select check_in.state,
             (
               select count(*)::integer
               from public.child_progress_snapshots snapshot
               where snapshot.check_in_id = check_in.id
             ) as snapshots,
             report.history as report_history
      from public.progress_check_ins check_in
      join public.child_reports report
        on report.child_id = check_in.child_id
      where check_in.id = ${firstStarted.checkIn.id}
        and check_in.family_id = ${familyId}
    `;
    assert.equal(afterStop.state, "stopped");
    assert.equal(afterStop.snapshots, 1);
    assert.deepEqual(afterStop.report_history, [{ marker: "keep" }]);
    const savedResponseAfterStop = await loadTask5SavedResponse();
    assert.deepEqual(
      savedResponseAfterStop,
      savedResponseAfterTakeover,
    );
    const [evidenceAfterStop] = await sql<
      {
        item_id: string;
        answer: string;
        superseded_at: string | null;
      }[]
    >`
      select item_id, answer, superseded_at
      from public.child_progress_evidence
      where id = ${task5EvidenceId}
        and child_id = ${childId}
        and family_id = ${familyId}
    `;
    assert.deepEqual(evidenceAfterStop, {
      item_id: firstStarted.prompt.itemId,
      answer: winner.input.answer,
      superseded_at: null,
    });
    const liveViewAfterStop = await repository.loadLiveView(
      familyId,
      childId,
      new Date("2026-07-11T18:34:01.000Z"),
    );
    assert.ok(liveViewAfterStop);
    assert.equal(
      liveViewAfterStop.subjects
        .flatMap((subject) => subject.domains)
        .flatMap((domain) => domain.topics)
        .find(
          (topic) =>
            topic.itemId === firstStarted.prompt.itemId,
        )?.answer,
      winner.input.answer,
    );

    const conflictCoverageSeed =
      await service.recordProgressEvidence({
        familyId,
        childId,
        memberUserId: adultA,
        source: "checklist",
        itemId: "art.ground-sky",
        answer: "not_yet",
        quote: null,
        observedAt: "2026-07-11T18:34:30.000000Z",
        idempotencyKey: "postgres-conflict-coverage-seed",
      });
    assert.equal(conflictCoverageSeed.status, "recorded");
    const conflictStartInput = {
      childId,
      purpose: "age_refresh" as const,
      subjectIds: ["art"],
      idempotencyKey: "postgres-conflict-check-in",
    };
    const conflictStarted = await checkInService.startCheckIn(
      task5Context({
        memberUserId: adultB,
        providerMessageId: "postgres-conflict-start",
        now: "2026-07-11T18:35:00.000000Z",
      }),
      conflictStartInput,
    );
    assert.equal(conflictStarted.status, "started");
    if (conflictStarted.status !== "started") {
      throw new Error("Task 5 conflict check-in did not start");
    }
    assert.equal(
      conflictStarted.prompt.itemId,
      "art.plans-artwork",
    );
    const conflictDeliveryId = await bindFixtureQuestion(conflictStarted.checkIn);
    const conflictOpened = await checkInService.respondCheckIn(
      task5Context({
        memberUserId: adultB,
        providerMessageId: "postgres-conflict-answer",
        repliedDeliveryId: conflictDeliveryId,
        now: "2026-07-11T18:36:00.000000Z",
      }),
      {
        checkInId: conflictStarted.checkIn.id,
        expectedRevision: 1,
        answer: "not_yet",
        idempotencyKey: "postgres-conflict-answer",
      },
    );
    assert.equal(conflictOpened.status, "conflict_open");
    if (conflictOpened.status !== "conflict_open") {
      throw new Error("Task 5 response did not open its conflict");
    }
    assert.equal(conflictOpened.checkIn.state, "paused");
    const conflictPending = await checkInService.respondCheckIn(
      task5Context({
        memberUserId: adultB,
        providerMessageId: "postgres-conflict-extra",
        now: "2026-07-11T18:36:30.000000Z",
      }),
      {
        checkInId: conflictStarted.checkIn.id,
        expectedRevision: 2,
        answer: "easily",
        idempotencyKey: "postgres-conflict-extra",
      },
    );
    assert.equal(conflictPending.status, "conflict_pending");
    const [beforeResolution] = await sql<{ count: number }[]>`
      select count(*)::integer as count
      from public.child_progress_evidence
      where child_id = ${childId}
        and family_id = ${familyId}
    `;
    const resolution = await checkInService.resolveProgressConflict(
      task5Context({
        memberUserId: adultC,
        providerMessageId: "postgres-conflict-resolution",
        now: "2026-07-11T18:37:00.000000Z",
      }),
      {
        conflictId: conflictOpened.conflict.id,
        answer: "not_yet",
        idempotencyKey: "postgres-conflict-resolution",
      },
    );
    assert.equal(resolution.status, "conflict_resolved");
    if (resolution.status !== "conflict_resolved") {
      throw new Error("Task 5 conflict resolution was refused");
    }
    assert.equal(resolution.checkIn?.state, "completed");
    const resolutionReplay =
      await checkInService.resolveProgressConflict(
        task5Context({
          memberUserId: adultC,
          providerMessageId: "postgres-conflict-resolution",
          now: "2026-07-11T18:37:00.000001Z",
        }),
        {
          conflictId: conflictOpened.conflict.id,
          answer: "not_yet",
          idempotencyKey: "postgres-conflict-resolution",
        },
      );
    assert.deepEqual(resolutionReplay, {
      status: "duplicate",
      original: resolution,
    });
    assert.deepEqual(
      await checkInService.resolveProgressConflict(
        task5Context({
          memberUserId: adultC,
          providerMessageId: "postgres-conflict-mismatch",
          now: "2026-07-11T18:37:00.000002Z",
        }),
        {
          conflictId: conflictOpened.conflict.id,
          answer: "easily",
          idempotencyKey: "postgres-conflict-resolution",
        },
      ),
      { status: "idempotency_mismatch" },
    );
    const [resolutionReceipt] = await sql<
      { status: string; result: unknown }[]
    >`
      select status, result
      from public.child_progress_operations
      where child_id = ${childId}
        and family_id = ${familyId}
        and idempotency_key = 'postgres-conflict-resolution'
    `;
    assert.equal(resolutionReceipt.status, "conflict_resolved");
    assert.deepEqual(resolutionReceipt.result, resolution);
    const [afterResolution] = await sql<
      {
        evidence_count: number;
        state: string;
        resolved_answer: string;
        resolved_evidence_id: string;
        resolved_by_member_user_id: string;
        answer: string;
      }[]
    >`
      select (
               select count(*)::integer
               from public.child_progress_evidence evidence
               where evidence.child_id = ${childId}
                 and evidence.family_id = ${familyId}
             ) as evidence_count,
             conflict.state, conflict.resolved_answer,
             conflict.resolved_evidence_id,
             conflict.resolved_by_member_user_id,
             answer.answer
      from public.child_progress_conflicts conflict
      join public.child_answers answer
        on answer.child_id = conflict.child_id
       and answer.question_id = conflict.item_id
      where conflict.id = ${conflictOpened.conflict.id}
        and conflict.child_id = ${childId}
        and conflict.family_id = ${familyId}
    `;
    assert.equal(
      afterResolution.evidence_count,
      beforeResolution.count,
    );
    assert.equal(afterResolution.state, "resolved");
    assert.equal(afterResolution.resolved_answer, "not_yet");
    assert.equal(
      afterResolution.resolved_evidence_id,
      resolution.selectedEvidenceId,
    );
    assert.equal(
      afterResolution.resolved_by_member_user_id,
      adultC,
    );
    assert.equal(afterResolution.answer, "not_yet");

    const startReplay = await checkInService.startCheckIn(
      task5Context({
        memberUserId: adultB,
        providerMessageId: "postgres-conflict-start-replay",
        now: "2026-07-11T18:38:00.000000Z",
      }),
      conflictStartInput,
    );
    assert.equal(startReplay.status, "existing");
    const [task5Cleanup] = await sql<
      {
        pending_responses: number;
        nonterminal_check_ins: number;
        snapshots: number;
      }[]
    >`
      select
        (
          select count(*)::integer
          from public.progress_check_in_responses response
          where response.family_id = ${familyId}
            and response.result ->> 'status' = 'pending'
            and response.check_in_id in (
              ${firstStarted.checkIn.id},
              ${conflictStarted.checkIn.id}
            )
        ) as pending_responses,
        (
          select count(*)::integer
          from public.progress_check_ins check_in
          where check_in.family_id = ${familyId}
            and check_in.child_id = ${childId}
            and check_in.state in ('active', 'paused')
        ) as nonterminal_check_ins,
        (
          select count(*)::integer
          from public.child_progress_snapshots snapshot
          where snapshot.family_id = ${familyId}
            and snapshot.child_id = ${childId}
            and snapshot.snapshot_kind = 'check_in_group'
            and snapshot.check_in_id in (
              ${firstStarted.checkIn.id},
              ${conflictStarted.checkIn.id}
            )
        ) as snapshots
    `;
    assert.deepEqual(task5Cleanup, {
      pending_responses: 0,
      nonterminal_check_ins: 0,
      snapshots: 2,
    });

    const memberRemovedPauseEventState = async (
      databaseClient: postgres.Sql | postgres.TransactionSql,
    ) => {
      const [state] = await databaseClient<
        { count: number; exact_props: boolean }[]
      >`
        select count(*)::integer as count,
               coalesce(
                 bool_and(
                   event.family_id = ${familyId}
                   and event.props = jsonb_build_object(
                     'family_id', ${familyId}::uuid,
                     'child_id', ${childId}::uuid,
                     'reason', 'member_removed'
                   )
                 ),
                 true
               ) as exact_props
        from public.events event
        where event.name = 'progress.checkin_paused'
      `;
      return state;
    };
    const memberRemovalEventsBefore =
      await memberRemovedPauseEventState(sql);
    const memberRemovalMessageId = randomUUID();
    const memberRemovalDeliveryId = randomUUID();
    await sql`
      insert into public.conversation_messages (id, family_id)
      values (${memberRemovalMessageId}, ${familyId})
    `;
    await sql`
      insert into public.conversation_deliveries (
        id, family_id, episode_id, recipient_member_user_id,
        channel, destination_hash, status
      )
      values (
        ${memberRemovalDeliveryId}, ${familyId}, ${task5EpisodeId},
        ${adultA}, 'sms',
        ${hashContinuityKey("sms:+15550000001")},
        'sent'
      )
    `;
    const memberRemovalStart = await checkInService.startCheckIn(
      task5Context({
        memberUserId: adultA,
        providerMessageId: "postgres-member-removal-start",
        now: "2026-07-11T18:39:00.000000Z",
      }),
      {
        childId,
        purpose: "subject_deep_dive",
        subjectIds: ["science"],
        idempotencyKey: "postgres-member-removal-start",
      },
    );
    assert.equal(memberRemovalStart.status, "started");
    if (memberRemovalStart.status !== "started") {
      throw new Error("Member-removal check-in did not start");
    }
    const memberRemovalBound =
      await checkInService.bindCurrentDelivery(
        task5Context({
          memberUserId: adultA,
          providerMessageId: "postgres-member-removal-bind",
          runtimeSessionId:
            memberRemovalStart.checkIn.pendingRuntimeSessionId ?? "",
          turnId:
            memberRemovalStart.checkIn.pendingTurnId ?? "",
          now: "2026-07-11T18:39:10.000000Z",
        }),
        {
          checkInId: memberRemovalStart.checkIn.id,
          expectedRevision: 1,
          deliveryId: memberRemovalDeliveryId,
        },
      );
    assert.equal(memberRemovalBound.status, "bound");
    await openReplyLoopWithDatabase(sql, {
      attempt: {
        id: memberRemovalDeliveryId,
        familyId,
        episodeId: task5EpisodeId,
        messageId: memberRemovalMessageId,
        taskRunId: null,
        memberUserId: adultA,
        channel: "sms",
        destination: "+15550000001",
        providerThreadKey: "member-removal-thread",
        existingStatus: "sent",
        shouldSend: false,
      },
      contract: replyContractForProgressCheckIn(
        memberRemovalStart.checkIn.id,
        memberRemovalStart.checkIn.revision,
      ),
      now: new Date("2026-07-11T18:39:10.000Z"),
    });
    const [memberRemovalLoopBefore] = await sql<
      { state: string }[]
    >`
      select state
      from public.conversation_open_loops
      where delivery_id = ${memberRemovalDeliveryId}
    `;
    assert.deepEqual(memberRemovalLoopBefore, { state: "open" });
    await sql`
      update public.family_members
      set user_id = user_id
      where family_id = ${familyId} and user_id = ${adultA}
    `;
    assert.deepEqual(
      await memberRemovedPauseEventState(sql),
      memberRemovalEventsBefore,
    );
    await sql`
      delete from public.family_members
      where family_id = ${familyId} and user_id = ${adultA}
    `;
    assert.deepEqual(await memberRemovedPauseEventState(sql), {
      count: memberRemovalEventsBefore.count + 1,
      exact_props: true,
    });
    const [memberRemovalLoopAfter] = await sql<
      { state: string }[]
    >`
      select state
      from public.conversation_open_loops
      where delivery_id = ${memberRemovalDeliveryId}
    `;
    assert.deepEqual(memberRemovalLoopAfter, {
      state: "cancelled",
    });
    await openReplyLoopWithDatabase(sql, {
      attempt: {
        id: memberRemovalDeliveryId,
        familyId,
        episodeId: task5EpisodeId,
        messageId: memberRemovalMessageId,
        taskRunId: null,
        memberUserId: adultA,
        channel: "sms",
        destination: "+15550000001",
        providerThreadKey: "member-removal-thread",
        existingStatus: "sent",
        shouldSend: false,
      },
      contract: replyContractForProgressCheckIn(
        memberRemovalStart.checkIn.id,
        memberRemovalStart.checkIn.revision,
      ),
      now: new Date("2026-07-11T18:39:11.000Z"),
    });
    const [lateMemberRemovalLoop] = await sql<
      { state: string }[]
    >`
      select state
      from public.conversation_open_loops
      where delivery_id = ${memberRemovalDeliveryId}
    `;
    assert.deepEqual(lateMemberRemovalLoop, {
      state: "cancelled",
    });
    console.log(
      "PASS  child-progress-e2e late-member-removal-loop-cancelled",
    );
    const [memberRemoved] = await sql<
      {
        state: string;
        pause_reason: string;
        active_member_user_id: string | null;
        prompt_recipient_member_user_id: string | null;
        current_delivery_id: string | null;
        revision: number;
      }[]
    >`
      select state, pause_reason, active_member_user_id,
             prompt_recipient_member_user_id, current_delivery_id,
             revision
      from public.progress_check_ins
      where id = ${memberRemovalStart.checkIn.id}
    `;
    assert.deepEqual(memberRemoved, {
      state: "paused",
      pause_reason: "member_removed",
      active_member_user_id: null,
      prompt_recipient_member_user_id: null,
      current_delivery_id: null,
      revision: 2,
    });
    assert.deepEqual(
      await checkInService.resumeCheckIn(
        task5Context({
          memberUserId: adultA,
          providerMessageId: "postgres-member-removal-resume",
          now: "2026-07-11T18:39:20.000000Z",
        }),
        {
          checkInId: memberRemovalStart.checkIn.id,
          expectedRevision: 2,
        },
      ),
      { status: "wrong_recipient" },
    );
    const memberRemovalTakeover =
      await checkInService.takeoverCheckIn(
        task5Context({
          memberUserId: adultB,
          providerMessageId: "postgres-member-removal-takeover",
          now: "2026-07-11T18:39:30.000000Z",
        }),
        {
          checkInId: memberRemovalStart.checkIn.id,
          expectedRevision: 2,
        },
      );
    assert.equal(memberRemovalTakeover.status, "takeover_accepted");
    if (memberRemovalTakeover.status !== "takeover_accepted") {
      throw new Error("Member-removal takeover was refused");
    }
    assert.equal(memberRemovalTakeover.checkIn.state, "active");
    assert.equal(memberRemovalTakeover.checkIn.pauseReason, null);
    assert.equal(
      (
        await checkInService.stopCheckIn(
          task5Context({
            memberUserId: adultB,
            providerMessageId: "postgres-member-removal-stop",
            now: "2026-07-11T18:39:40.000000Z",
          }),
          {
            checkInId: memberRemovalStart.checkIn.id,
            expectedRevision: 3,
          },
        )
      ).status,
      "stopped",
    );

    const authRemovalStart = await checkInService.startCheckIn(
      task5Context({
        memberUserId: adultC,
        providerMessageId: "postgres-auth-removal-start",
        now: "2026-07-11T18:40:00.000000Z",
      }),
      {
        childId,
        purpose: "subject_deep_dive",
        subjectIds: ["music"],
        idempotencyKey: "postgres-auth-removal-start",
      },
    );
    assert.equal(authRemovalStart.status, "started");
    if (authRemovalStart.status !== "started") {
      throw new Error("Auth-removal check-in did not start");
    }
    const authRemovalEventsBefore =
      await memberRemovedPauseEventState(sql);
    await assert.rejects(
      sql.begin(async (transaction) => {
        await transaction`
          delete from auth.users where id = ${adultC}
        `;
        assert.deepEqual(
          await memberRemovedPauseEventState(transaction),
          {
            count: authRemovalEventsBefore.count + 1,
            exact_props: true,
          },
        );
        throw new Error("synthetic member-removal rollback");
      }),
      /synthetic member-removal rollback/u,
    );
    assert.deepEqual(
      await memberRemovedPauseEventState(sql),
      authRemovalEventsBefore,
    );
    const [authRemovalRolledBack] = await sql<
      { state: string; revision: number }[]
    >`
      select state, revision
      from public.progress_check_ins
      where id = ${authRemovalStart.checkIn.id}
    `;
    assert.deepEqual(authRemovalRolledBack, {
      state: "active",
      revision: 1,
    });
    await sql`delete from auth.users where id = ${adultC}`;
    assert.deepEqual(await memberRemovedPauseEventState(sql), {
      count: authRemovalEventsBefore.count + 1,
      exact_props: true,
    });
    const [authRemoved] = await sql<
      {
        state: string;
        pause_reason: string;
        active_member_user_id: string | null;
        prompt_recipient_member_user_id: string | null;
        revision: number;
      }[]
    >`
      select state, pause_reason, active_member_user_id,
             prompt_recipient_member_user_id, revision
      from public.progress_check_ins
      where id = ${authRemovalStart.checkIn.id}
    `;
    assert.deepEqual(authRemoved, {
      state: "paused",
      pause_reason: "member_removed",
      active_member_user_id: null,
      prompt_recipient_member_user_id: null,
      revision: 2,
    });
    console.log(
      "PASS  child-progress-e2e transactional-member-removed-events",
    );
    const authRemovalTakeover =
      await checkInService.takeoverCheckIn(
        task5Context({
          memberUserId: adultB,
          providerMessageId: "postgres-auth-removal-takeover",
          now: "2026-07-11T18:40:10.000000Z",
        }),
        {
          checkInId: authRemovalStart.checkIn.id,
          expectedRevision: 2,
        },
      );
    assert.equal(authRemovalTakeover.status, "takeover_accepted");
    if (authRemovalTakeover.status !== "takeover_accepted") {
      throw new Error("Auth-removal takeover was refused");
    }
    assert.equal(authRemovalTakeover.checkIn.state, "active");
    assert.equal(
      (
        await checkInService.stopCheckIn(
          task5Context({
            memberUserId: adultB,
            providerMessageId: "postgres-auth-removal-stop",
            now: "2026-07-11T18:40:20.000000Z",
          }),
          {
            checkInId: authRemovalStart.checkIn.id,
            expectedRevision: 3,
          },
        )
      ).status,
      "stopped",
    );

    let signalStartChildLock = () => {};
    const startChildLockReady = new Promise<void>((resolve) => {
      signalStartChildLock = resolve;
    });
    const holdStartChildLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    blockerRun = blockerSql.begin(async (transactionSql) => {
      await transactionSql`
        select id
        from public.children
        where id = ${childId} and family_id = ${familyId}
        for update
      `;
      signalStartChildLock();
      await holdStartChildLock;
    });
    await startChildLockReady;
    const removalRaceStart = checkInService.startCheckIn(
      task5Context({
        memberUserId: adultD,
        providerMessageId: "postgres-removal-race-start",
        now: "2026-07-11T18:41:00.000000Z",
      }),
      {
        childId,
        purpose: "subject_deep_dive",
        subjectIds: ["social_studies"],
        idempotencyKey: "postgres-removal-race-start",
      },
    );
    let removalRaceStartBlocked = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [activity] = await writerSql<{ blocked: boolean }[]>`
        select exists (
          select 1
          from pg_stat_activity
          where pid <> pg_backend_pid()
            and query like '%select c.id, c.name%'
            and wait_event_type = 'Lock'
        ) as blocked
      `;
      if (activity.blocked) {
        removalRaceStartBlocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(removalRaceStartBlocked, true);
    let startRemovalSettled = false;
    const concurrentStartRemoval = writerSql`
      delete from public.family_members
      where family_id = ${familyId} and user_id = ${adultD}
    `.then(() => {
      startRemovalSettled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const startRemovalWaitedForMemberLock = !startRemovalSettled;
    const startRemovalBlockerRun = requireRunningPromise(
      blockerRun,
      "member-removal start blocker",
    );
    releaseLock();
    const [removalRaceStartResult] = await allSettledValuesOrThrow([
      removalRaceStart,
      concurrentStartRemoval,
      startRemovalBlockerRun,
    ] as const);
    blockerRun = null;
    assert.equal(startRemovalWaitedForMemberLock, true);
    assert.equal(removalRaceStartResult.status, "started");
    if (removalRaceStartResult.status !== "started") {
      throw new Error("Concurrent removal start was refused");
    }
    const removalRaceCheckInId =
      removalRaceStartResult.checkIn.id;
    const [removedAfterStart] = await sql<
      { state: string; pause_reason: string; revision: number }[]
    >`
      select state, pause_reason, revision
      from public.progress_check_ins
      where id = ${removalRaceCheckInId}
    `;
    assert.deepEqual(removedAfterStart, {
      state: "paused",
      pause_reason: "member_removed",
      revision: 2,
    });

    let signalTakeoverChildLock = () => {};
    const takeoverChildLockReady = new Promise<void>((resolve) => {
      signalTakeoverChildLock = resolve;
    });
    const holdTakeoverChildLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    blockerRun = blockerSql.begin(async (transactionSql) => {
      await transactionSql`
        select id
        from public.children
        where id = ${childId} and family_id = ${familyId}
        for update
      `;
      signalTakeoverChildLock();
      await holdTakeoverChildLock;
    });
    await takeoverChildLockReady;
    const removalRaceTakeover = checkInService.takeoverCheckIn(
      task5Context({
        memberUserId: adultE,
        providerMessageId: "postgres-removal-race-takeover",
        now: "2026-07-11T18:42:00.000000Z",
      }),
      {
        checkInId: removalRaceCheckInId,
        expectedRevision: 2,
      },
    );
    let removalRaceTakeoverBlocked = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [activity] = await writerSql<{ blocked: boolean }[]>`
        select exists (
          select 1
          from pg_stat_activity
          where pid <> pg_backend_pid()
            and query like '%select c.id, c.name%'
            and wait_event_type = 'Lock'
        ) as blocked
      `;
      if (activity.blocked) {
        removalRaceTakeoverBlocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(removalRaceTakeoverBlocked, true);
    let takeoverRemovalSettled = false;
    const concurrentTakeoverRemoval = writerSql`
      delete from public.family_members
      where family_id = ${familyId} and user_id = ${adultE}
    `.then(() => {
      takeoverRemovalSettled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const takeoverRemovalWaitedForMemberLock =
      !takeoverRemovalSettled;
    const takeoverRemovalBlockerRun = requireRunningPromise(
      blockerRun,
      "member-removal takeover blocker",
    );
    releaseLock();
    const [removalRaceTakeoverResult] =
      await allSettledValuesOrThrow([
        removalRaceTakeover,
        concurrentTakeoverRemoval,
        takeoverRemovalBlockerRun,
      ] as const);
    blockerRun = null;
    assert.equal(takeoverRemovalWaitedForMemberLock, true);
    assert.equal(
      removalRaceTakeoverResult.status,
      "takeover_accepted",
    );
    const [removedAfterTakeover] = await sql<
      { state: string; pause_reason: string; revision: number }[]
    >`
      select state, pause_reason, revision
      from public.progress_check_ins
      where id = ${removalRaceCheckInId}
    `;
    assert.deepEqual(removedAfterTakeover, {
      state: "paused",
      pause_reason: "member_removed",
      revision: 4,
    });
    const closeRemovalRace =
      await checkInService.takeoverCheckIn(
        task5Context({
          memberUserId: adultB,
          providerMessageId: "postgres-close-removal-race",
          now: "2026-07-11T18:42:30.000000Z",
        }),
        {
          checkInId: removalRaceCheckInId,
          expectedRevision: 4,
        },
      );
    assert.equal(closeRemovalRace.status, "takeover_accepted");
    assert.equal(
      (
        await checkInService.stopCheckIn(
          task5Context({
            memberUserId: adultB,
            providerMessageId: "postgres-stop-removal-race",
            now: "2026-07-11T18:42:40.000000Z",
          }),
          {
            checkInId: removalRaceCheckInId,
            expectedRevision: 5,
          },
        )
      ).status,
      "stopped",
    );

    const runAuthDeletionRace = async <T>(
      memberUserId: string,
      operation: () => Promise<T>,
    ): Promise<T> => {
      let signalMemberRowLock = () => {};
      const memberRowLockReady = new Promise<void>((resolve) => {
        signalMemberRowLock = resolve;
      });
      const holdMemberRowLock = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      blockerRun = blockerSql.begin(async (transactionSql) => {
        await transactionSql`
          select user_id
          from public.family_members
          where family_id = ${familyId}
            and user_id = ${memberUserId}
          for update
        `;
        signalMemberRowLock();
        await holdMemberRowLock;
      });
      await memberRowLockReady;
      const operationPromise = operation();
      let operationBlocked = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const [activity] = await writerSql<{ blocked: boolean }[]>`
          select exists (
            select 1
            from pg_stat_activity
            where pid <> pg_backend_pid()
              and query like '%from public.family_members member%'
              and wait_event_type = 'Lock'
          ) as blocked
        `;
        if (activity.blocked) {
          operationBlocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(operationBlocked, true);
      const authDeletion = writerSql`
        delete from auth.users where id = ${memberUserId}
      `.then(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const authDeletionBlockerRun = requireRunningPromise(
        blockerRun,
        "auth-deletion blocker",
      );
      releaseLock();
      const [operationResult] = await allSettledValuesOrThrow([
        operationPromise,
        authDeletion,
        authDeletionBlockerRun,
      ] as const);
      blockerRun = null;
      return operationResult;
    };

    await sql`
      insert into public.family_members (
        family_id, user_id, role, display_name
      )
      values (${familyId}, ${adultD}, 'partner', 'Morgan')
    `;
    const authStartResult = await runAuthDeletionRace(
      adultD,
      () =>
        checkInService.startCheckIn(
          task5Context({
            memberUserId: adultD,
            providerMessageId: "postgres-auth-start-race",
            now: "2026-07-11T18:43:00.000000Z",
          }),
          {
            childId,
            purpose: "subject_deep_dive",
            subjectIds: ["language"],
            idempotencyKey: "postgres-auth-start-race",
          },
        ),
    );
    assert.equal(authStartResult.status, "started");
    if (authStartResult.status !== "started") {
      throw new Error("Auth start race was refused");
    }
    const [authStartPaused] = await sql<
      { state: string; pause_reason: string; revision: number }[]
    >`
      select state, pause_reason, revision
      from public.progress_check_ins
      where id = ${authStartResult.checkIn.id}
    `;
    assert.deepEqual(authStartPaused, {
      state: "paused",
      pause_reason: "member_removed",
      revision: 2,
    });
    const closeAuthStart =
      await checkInService.takeoverCheckIn(
        task5Context({
          memberUserId: adultB,
          providerMessageId: "postgres-close-auth-start",
          now: "2026-07-11T18:43:30.000000Z",
        }),
        {
          checkInId: authStartResult.checkIn.id,
          expectedRevision: 2,
        },
      );
    assert.equal(closeAuthStart.status, "takeover_accepted");
    assert.equal(
      (
        await checkInService.stopCheckIn(
          task5Context({
            memberUserId: adultB,
            providerMessageId: "postgres-stop-auth-start",
            now: "2026-07-11T18:43:40.000000Z",
          }),
          {
            checkInId: authStartResult.checkIn.id,
            expectedRevision: 3,
          },
        )
      ).status,
      "stopped",
    );

    await sql`
      insert into public.family_members (
        family_id, user_id, role, display_name
      )
      values (${familyId}, ${adultE}, 'partner', 'Riley')
    `;
    const authResponseStart = await checkInService.startCheckIn(
      task5Context({
        memberUserId: adultE,
        providerMessageId: "postgres-auth-response-start",
        now: "2026-07-11T18:44:00.000000Z",
      }),
      {
        childId,
        purpose: "subject_deep_dive",
        subjectIds: ["executive_function", "social_emotional"],
        idempotencyKey: "postgres-auth-response-start",
      },
    );
    assert.equal(authResponseStart.status, "started");
    if (authResponseStart.status !== "started") {
      throw new Error("Auth response race check-in did not start");
    }
    const authResponseDeliveryId = await bindFixtureQuestion(authResponseStart.checkIn);
    const authResponseResult = await runAuthDeletionRace(
      adultE,
      () =>
        checkInService.respondCheckIn(
          task5Context({
            memberUserId: adultE,
            providerMessageId: "postgres-auth-response-race",
            repliedDeliveryId: authResponseDeliveryId,
            now: "2026-07-11T18:44:10.000000Z",
          }),
          {
            checkInId: authResponseStart.checkIn.id,
            expectedRevision: 1,
            answer: "easily",
            idempotencyKey: "postgres-auth-response-race",
          },
        ),
    );
    assert.ok(
      authResponseResult.status === "advanced" ||
        authResponseResult.status === "completed",
    );
    const [authResponsePaused] = await sql<
      {
        state: string;
        pause_reason: string;
        revision: number;
        response_count: number;
        evidence_count: number;
      }[]
    >`
      select check_in.state, check_in.pause_reason, check_in.revision,
             (
               select count(*)::integer
               from public.progress_check_in_responses response
               where response.check_in_id = check_in.id
             ) as response_count,
             (
               select count(*)::integer
               from public.child_progress_evidence evidence
               where evidence.check_in_id = check_in.id
             ) as evidence_count
      from public.progress_check_ins check_in
      where check_in.id = ${authResponseStart.checkIn.id}
    `;
    assert.deepEqual(authResponsePaused, {
      state: "paused",
      pause_reason: "member_removed",
      revision: 3,
      response_count: 1,
      evidence_count: 1,
    });
    await assertLiveInvalidated("adult membership delete");

    await runChildDeleteLockAssertions(sql, blockerSql);
    await runProviderEvidenceAssertions(sql, service);
    await runWalkPromptAssertions(sql, repository, service);
    await runFamilyFoldLockAssertions(sql, writerSql, blockerSql);
    await runFamilyFoldCompatibilityAssertions(sql);

    const wholeFamilyDeleteFamilyId = randomUUID();
    const wholeFamilyDeleteChildId = randomUUID();
    const wholeFamilyDeleteAdultId = randomUUID();
    await sql`
      insert into auth.users (id)
      values (${wholeFamilyDeleteAdultId})
    `;
    await sql`
      insert into public.families (id)
      values (${wholeFamilyDeleteFamilyId})
    `;
    await sql`
      insert into public.children (id, family_id, name, birth_month)
      values (
        ${wholeFamilyDeleteChildId},
        ${wholeFamilyDeleteFamilyId},
        'Whole-family delete child',
        '2019-07-01'
      )
    `;
    await sql`
      insert into public.family_members (
        family_id, user_id, role, display_name
      )
      values (
        ${wholeFamilyDeleteFamilyId},
        ${wholeFamilyDeleteAdultId},
        'parent',
        'Delete fixture adult'
      )
    `;
    await sql`
      insert into public.progress_check_ins (
        child_id,
        family_id,
        idempotency_key,
        purpose,
        scope,
        state,
        active_member_user_id,
        prompt_recipient_member_user_id,
        current_item_id,
        pending_runtime_session_id,
        pending_turn_id
      )
      values (
        ${wholeFamilyDeleteChildId},
        ${wholeFamilyDeleteFamilyId},
        'postgres-whole-family-delete-start',
        'subject_deep_dive',
        '{"subject_ids":["science"]}'::jsonb,
        'active',
        ${wholeFamilyDeleteAdultId},
        ${wholeFamilyDeleteAdultId},
        'science.life-cycles',
        'whole-family-delete-session',
        'whole-family-delete-turn'
      )
    `;
    const wholeFamilyDeleteJobId = randomUUID();
    await sql`
      insert into public.account_deletion_jobs (id, family_id, status)
      values (
        ${wholeFamilyDeleteJobId},
        ${wholeFamilyDeleteFamilyId},
        'running'
      )
    `;
    await sql`
      insert into public.account_deletion_artifact_tombstones (
        family_id,
        deletion_job_id
      )
      values (${wholeFamilyDeleteFamilyId}, ${wholeFamilyDeleteJobId})
    `;
    await sql.begin(async (tx) => {
      await tx`
        select set_config('homa.family_delete_mode', 'account-deletion-v2', true)
      `;
      await tx`
        update public.families
        set status = 'deleted'
        where id = ${wholeFamilyDeleteFamilyId}
      `;
      await tx`
        delete from public.families
        where id = ${wholeFamilyDeleteFamilyId}
      `;
    });
    const [wholeFamilyDeleted] = await sql<
      { families: number; events: number }[]
    >`
      select
        (
          select count(*)::integer
          from public.families
          where id = ${wholeFamilyDeleteFamilyId}
        )
          as families,
        (
          select count(*)::integer
          from public.events
          where family_id = ${wholeFamilyDeleteFamilyId}
        )
          as events
    `;
    assert.deepEqual(wholeFamilyDeleted, { families: 0, events: 0 });
    await sql`
      delete from public.children
      where id = ${wholeFamilyDeleteChildId}
    `;
    await sql`
      delete from auth.users
      where id = ${wholeFamilyDeleteAdultId}
    `;
    console.log(
      "PASS  child-progress-e2e whole-family-delete-skips-member-pause-event",
    );

    console.log(
      "PASS  child-progress-e2e two-adults-takeover-conflict-replay-resolution",
    );
    console.log(
      "PASS  child-progress-e2e journal-check-in-partial-stop",
    );
    console.log(
      "PASS  child-progress-e2e family-folds-child-deletion",
    );
    console.log("PASS  child-progress-e2e walk-prompts");
    console.log(
      "PASS  child-progress-e2e corrections-tombstones-reconciliation",
    );
    console.log(
      "PASS  child-progress-e2e report-token-history",
    );
    console.log("ChildProgress PostgreSQL integration passed.");
  } finally {
    releaseLock();
    if (blockerRun !== null) {
      await blockerRun.catch(() => undefined);
    }
    await Promise.all([
      sql.end({ timeout: 1 }),
      writerSql.end({ timeout: 1 }),
      blockerSql.end({ timeout: 1 }),
      reconciliationSql.end({ timeout: 1 }),
    ]);
  }
}

async function runPreMigrationLegacyAssertions(input: {
  socketDir: string;
  port: number;
  username: string;
}): Promise<void> {
  const sql = postgres({
    host: input.socketDir,
    port: input.port,
    database,
    username: input.username,
    prepare: false,
    max: 2,
  });
  const previousFlag = process.env.HOMA_LIVE_PROGRESS_ENABLED;
  process.env.HOMA_LIVE_PROGRESS_ENABLED = "false";
  try {
    const familyId = randomUUID();
    const childId = randomUUID();
    await sql`
      insert into public.families (id)
      values (${familyId})
    `;
    await sql`
      insert into public.children (id, family_id, name, birth_month)
      values (${childId}, ${familyId}, 'Legacy child', '2019-07-01')
    `;
    const adapters = createDefaultLegacyProgressAdapters(sql);
    assert.deepEqual(
      await adapters.saveAnswer({
        familyId,
        childId,
        itemId: "math.counts-to-5",
        answer: "easily",
        source: "checklist",
        memberUserId: null,
        observedAt: "2026-07-12T08:00:00.000000Z",
        idempotencyKey: "pre-migration-save",
      }),
      { status: "saved", mode: "legacy" },
    );
    assert.deepEqual(
      await adapters.correctAnswers({
        familyId,
        childId,
        changes: [{
          itemId: "math.counts-to-5",
          answer: "not_yet",
        }],
        source: "report_correction",
        memberUserId: null,
        observedAt: "2026-07-12T08:01:00.000000Z",
        idempotencyKey: "pre-migration-correct",
      }),
      { status: "saved", mode: "legacy" },
    );
    const [corrected] = await sql<
      { answer: string; source: string }[]
    >`
      select answer, source
      from public.child_answers
      where child_id = ${childId}
        and question_id = 'math.counts-to-5'
    `;
    assert.deepEqual(corrected, {
      answer: "not_yet",
      source: "report_correction",
    });
    assert.deepEqual(
      await adapters.deleteAnswer({
        familyId,
        childId,
        itemId: "math.counts-to-5",
        memberUserId: null,
        observedAt: "2026-07-12T08:02:00.000000Z",
        idempotencyKey: "pre-migration-delete",
      }),
      { status: "saved", mode: "legacy" },
    );
    const [shape] = await sql<
      { answers: number; progress_table: string | null }[]
    >`
      select
        (
          select count(*)::integer
          from public.child_answers
          where child_id = ${childId}
        ) as answers,
        to_regclass('public.child_progress_evidence')::text
          as progress_table
    `;
    assert.deepEqual(shape, {
      answers: 0,
      progress_table: null,
    });
    console.log(
      "PASS  child-progress-e2e pre-migration-flag-off-writers",
    );
  } finally {
    if (previousFlag === undefined) {
      delete process.env.HOMA_LIVE_PROGRESS_ENABLED;
    } else {
      process.env.HOMA_LIVE_PROGRESS_ENABLED = previousFlag;
    }
    await sql.end({ timeout: 1 });
  }
}

async function main(): Promise<void> {
  const postgresBin = await discoverPostgresBin();
  const username = process.env.USER ?? "postgres";
  const root = await mkdtemp(
    path.join("/tmp", "homa-child-progress-postgres-"),
  );
  const dataDir = path.join(root, "data");
  const socketDir = path.join(root, "socket");
  const logPath = path.join(root, "postgres.log");
  const env = { ...process.env, LC_ALL: "C" };
  let initialized = false;
  let started = false;
  let primaryFailure: unknown;
  try {
    const port = await availablePort();
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
        [
          `-k ${socketDir}`,
          `-p ${port}`,
          `-c lock_timeout=${POSTGRES_LOCK_TIMEOUT_MS}`,
          `-c statement_timeout=${POSTGRES_STATEMENT_TIMEOUT_MS}`,
          `-c idle_in_transaction_session_timeout=${POSTGRES_STATEMENT_TIMEOUT_MS}`,
        ].join(" "),
        "-w",
        "start",
      ],
      env,
    );
    started = true;
    await run(
      path.join(postgresBin, "createdb"),
      [
        "-h",
        socketDir,
        "-p",
        String(port),
        "-U",
        username,
        database,
      ],
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
    await runPreMigrationLegacyAssertions({
      socketDir,
      port,
      username,
    });
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
        database,
        "-f",
        migrationPath,
      ],
      env,
    );
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
        database,
        "-f",
        observationsMigrationPath,
      ],
      env,
    );
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
        database,
        "-f",
        progressLoopCleanupMigrationPath,
      ],
      env,
    );
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
        database,
        "-f",
        evidenceDerivationMigrationPath,
      ],
      env,
    );
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
        database,
        "-f",
        evidenceDerivationContractMigrationPath,
      ],
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
        "-f",
        eventsFamilyDeleteMigrationPath,
      ],
      env,
    );
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
        database,
        "-f",
        familyDeleteProgressTriggerMigrationPath,
        "-f",
        path.join(repoRoot, "supabase/migrations/20260906185000_deeper_progress_sitting_receipts.sql"),
      ],
      env,
    );
    await runAdapterAssertions({ socketDir, port, username });
    const deeperSql = postgres({host: socketDir, port, database, username, max: 4, prepare: false});
    try {
      await assertDeeperProgressPostgres(deeperSql);
      await assertReportNarrativePostgres(deeperSql);
    }
    finally { await deeperSql.end({timeout: 1}); }
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    try {
      if (initialized) {
        const statusBeforeCleanup = await runForExitCode(
          path.join(postgresBin, "pg_ctl"),
          ["-D", dataDir, "status"],
          env,
        );
        if (statusBeforeCleanup === 0) {
          await run(
            path.join(postgresBin, "pg_ctl"),
            ["-D", dataDir, "-m", "fast", "-w", "stop"],
            env,
          );
        } else if (started) {
          assert.equal(statusBeforeCleanup, 3);
        }
        assert.equal(
          await runForExitCode(
            path.join(postgresBin, "pg_ctl"),
            ["-D", dataDir, "status"],
            env,
          ),
          3,
        );
      }
      await rm(root, { recursive: true, force: true });
      await assert.rejects(
        access(root),
        (error: unknown) =>
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT",
      );
      console.log("PASS  child-progress-e2e cleanup");
    } catch (cleanupFailure) {
      console.error(
        "ChildProgress PostgreSQL cleanup failed:",
        cleanupFailure,
      );
      if (primaryFailure === undefined) throw cleanupFailure;
    }
  }
}

await main();
