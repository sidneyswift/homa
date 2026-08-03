import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  captureLoopTraceIssues,
  type CaptureLoopEventProps,
  type CaptureLoopStage,
} from "../packages/core/src/index";
import postgres from "postgres";

import { persistCaptureLoopEventWithSql } from "../apps/web/lib/capture-loop-events";
import { captureLoopReceiptLockKey } from "../apps/web/lib/capture-loop-locks";

const execFileAsync = promisify(execFile);
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const processTimeoutMs = 30_000;
const familyAId = "00000000-0000-4000-8000-000000000001";
const familyBId = "00000000-0000-4000-8000-000000000002";
const orphanFamilyId = "00000000-0000-4000-8000-000000000099";
const materialAId = uuid("3", 1);
const materialASecondId = uuid("3", 2);
const materialBId = uuid("3", 3);
const materialADraftId = uuid("3", 4);
const materialASupersededId = uuid("3", 5);
const materialAThirdId = uuid("3", 6);
const complianceAId = uuid("3", 7);
const materialRevisionRootId = uuid("3", 8);
const materialRevisionFinalId = uuid("3", 9);
const complianceCorrectionFirstId = uuid("3", 10);
const materialLineageRootId = uuid("3", 11);
const materialLineageFirstId = uuid("3", 12);
const materialLineageSiblingId = uuid("3", 13);
const materialLineageCorrectedId = uuid("3", 14);
const childAId = uuid("2", 1);
const mutablePlanAId = uuid("2", 2);
const childBId = uuid("2", 3);
const scheduleAId = uuid("4", 1);
const scheduleBId = uuid("4", 2);
const nativeScheduleLoopId = uuid("a", 1);
const nativeScheduleSecondLoopId = uuid("a", 3);
const progressRecordedId = uuid("6", 1);
const progressPendingId = uuid("6", 2);
const progressConflictId = uuid("6", 3);
const progressUndoneId = uuid("6", 4);
const progressObservationId = uuid("6", 5);
const progressAlreadyUndoneSourceId = uuid("6", 6);
const progressUndoBeforeOutcomeId = uuid("6", 7);
const progressAnswersCorrectedId = uuid("6", 8);
const progressEvidenceUndoSourceId = uuid("6", 9);
const progressEvidenceUndoBeforeOutcomeId = uuid("6", 10);
const progressEvidenceRecordedId = uuid("6", 11);
const progressEvidenceUndoId = uuid("6", 12);
const progressMultiEvidenceSourceId = uuid("6", 13);
const progressMultiEvidenceUndoId = uuid("6", 14);
const progressMultiEvidenceUndoSecondId = uuid("6", 15);
const progressFullyUndoneSourceId = uuid("6", 16);
const progressFullyUndoneFirstId = uuid("6", 17);
const progressFullyUndoneSecondId = uuid("6", 18);
const hoursAId = uuid("7", 1);
const hoursRaceId = uuid("7", 2);
const voiceReceiptAId = uuid("8", 1);
const scheduleReceiptAId = uuid("8", 2);
const scheduleReceiptASecondId = uuid("8", 3);
const voiceReceiptRaceId = uuid("8", 4);
const planApprovalAId = uuid("b", 1);
const planApprovalASecondId = uuid("b", 2);
const planApprovalWrongRevisionId = uuid("b", 3);
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
  objectId?: string | null;
  parentLoopId?: string | null;
  correctsEventId?: string | null;
  correctionResult?: CaptureLoopEventProps["correction_result"];
  receiptKind?: CaptureLoopEventProps["receipt_kind"];
  receiptId?: string;
  outcomeKind?: CaptureLoopEventProps["outcome_kind"];
  resultState?: CaptureLoopEventProps["result_state"];
  exitReason?: CaptureLoopEventProps["exit_reason"];
  revision?: number | null;
  revisionId?: string | null;
}): CaptureLoopEventProps {
  const profile = input.profile ?? "proposed_effect";
  const outcome = input.stage === "outcome_verified";
  const correction = input.stage === "correction_or_undo_verified";
  const rollback = input.stage === "rollback_verified";
  const objectId = input.objectId === undefined ? materialAId : input.objectId;
  const defaultRevision =
    profile !== "direct_mutation" && revisionStages.has(input.stage) ? 1 : null;
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
    object_id: objectId,
    client_context: {
      client: "web",
      app_version: "capture-contract-test",
      build_number: null,
      runtime_version: null,
      update_id: null,
    },
    outcome_kind: outcome ? (input.outcomeKind ?? "artifact_ready") : null,
    result_state: outcome ? (input.resultState ?? "complete") : "not_applicable",
    receipt_kind:
      input.receiptKind ??
      (outcome || correction ? "artifact_receipt" : rollback ? "database_receipt" : "none"),
    receipt_id:
      outcome || correction || rollback
        ? (input.receiptId ??
          (correction ? materialASecondId : objectId ?? materialAId))
        : null,
    revision: input.revision === undefined ? defaultRevision : input.revision,
    revision_id:
      input.revisionId === undefined
        ? defaultRevision === null
          ? null
          : objectId
        : input.revisionId,
    corrects_event_id: input.correctsEventId ?? null,
    correction_result: correction
      ? (input.correctionResult ?? "corrected")
      : null,
    exit_reason: input.exitReason ?? null,
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
  create role authenticated;
  create role anon;
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
    generation jsonb,
    status text not null default 'draft',
    approved_at timestamptz,
    pdf_url text not null default 'https://example.test/material.pdf',
    preview_url text not null default 'https://example.test/material.png',
    revises uuid references public.materials (id)
  );
  create table public.child_plans (
    id uuid primary key,
    child_id uuid not null references public.children (id) on delete cascade
  );
  create table public.month_plan_approvals (
    draft_id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade,
    final_revision smallint not null
  );
  create table public.plan_activity_schedule (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade
  );
  create or replace function public.schedule_plan_activity_v2(
    target_child_id uuid,
    target_subject_id text,
    target_week smallint,
    target_activity_index smallint,
    target_scheduled_date date,
    target_expected_text text,
    target_plan_revision bigint,
    target_schedule_id uuid default null
  )
  returns table (
    status text,
    reason text,
    family_id uuid,
    plan_id uuid,
    plan_revision bigint,
    scheduled_date date,
    activity_text text,
    schedule_id uuid
  )
  language plpgsql
  security definer
  as $$
  begin
    if target_child_id <> '${childAId}'::uuid then
      raise exception 'child does not belong to the caller''s family'
        using errcode = '42501';
    end if;
    insert into public.plan_activity_schedule (id, family_id)
    values ('${scheduleAId}'::uuid, '${familyAId}'::uuid)
    on conflict (id) do nothing;
    return query select
      'applied'::text,
      null::text,
      '${familyAId}'::uuid,
      null::uuid,
      1::bigint,
      target_scheduled_date,
      target_expected_text,
      '${scheduleAId}'::uuid;
  end;
  $$;
  create table public.family_events (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade
  );
  create table public.child_progress_operations (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade,
    status text not null,
    evidence_ids uuid[] not null default '{}',
    affected_item_ids text[] not null default '{}',
    result jsonb not null default '{}'
  );
  create table public.hours_log (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade
  );
  create table public.homa_task_runs (
    id uuid primary key,
    family_id uuid references public.families (id) on delete cascade
  );
  create table public.voice_action_receipts (
    id uuid primary key,
    family_id uuid not null references public.families (id) on delete cascade,
    object_kind text not null,
    object_id uuid not null,
    effect text not null,
    status text not null,
    undone_at timestamptz
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
      "20260803043000_native_capture_loop_schedule_receipts.sql",
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
      index_count: 4,
    });

    await sql`
      insert into public.children (id, family_id)
      values
        (${childAId}, ${familyAId}),
        (${childBId}, ${familyBId})
    `;
    await sql`
      insert into public.child_plans (id, child_id)
      values (${mutablePlanAId}, ${childAId})
    `;
    await sql`
      insert into public.month_plan_approvals
        (draft_id, family_id, final_revision)
      values
        (${planApprovalASecondId}, ${familyAId}, 1),
        (${planApprovalWrongRevisionId}, ${familyAId}, 2)
    `;
    await sql`
      insert into public.materials
        (id, family_id, status, approved_at, revises)
      values
        (${materialAId}, ${familyAId}, 'final', now(), null),
        (${materialASecondId}, ${familyAId}, 'final', now(), ${materialAId}),
        (${materialBId}, ${familyBId}, 'final', now(), null),
        (${materialADraftId}, ${familyAId}, 'draft', null, null),
        (${materialASupersededId}, ${familyAId}, 'superseded', now(), null),
        (${materialAThirdId}, ${familyAId}, 'final', now(), ${materialAId}),
        (${materialRevisionRootId}, ${familyAId}, 'superseded', now(), null),
        (${materialRevisionFinalId}, ${familyAId}, 'final', now(),
          ${materialRevisionRootId}),
        (${materialLineageRootId}, ${familyAId}, 'superseded', now(), null),
        (${materialLineageFirstId}, ${familyAId}, 'final', now(),
          ${materialLineageRootId}),
        (${materialLineageSiblingId}, ${familyAId}, 'final', now(),
          ${materialLineageRootId}),
        (${materialLineageCorrectedId}, ${familyAId}, 'final', now(),
          ${materialLineageFirstId})
    `;
    await sql`
      insert into public.materials
        (id, family_id, kind, subject, generation, status, approved_at, revises)
      values
        (${complianceAId}, ${familyAId}, 'packet', 'state-pack',
          '{"statePack":{}}'::jsonb, 'final', now(), ${materialAId}),
        (${complianceCorrectionFirstId}, ${familyAId}, 'packet', 'state-filing',
          '{"stateFiling":{}}'::jsonb, 'final', now(), ${materialAId})
    `;
    await sql`
      insert into public.plan_activity_schedule (id, family_id) values
        (${scheduleAId}, ${familyAId}),
        (${scheduleBId}, ${familyBId})
    `;
    const nativeScheduleRows = await sql<{
      status: string;
      family_id: string;
      schedule_id: string;
      scheduled_date: string;
    }[]>`
      select status, family_id, schedule_id, scheduled_date::text
      from public.schedule_plan_activity_native_v1(
        ${nativeScheduleLoopId}::uuid,
        ${childAId}::uuid,
        'math'::text,
        1::smallint,
        0::smallint,
        '2026-08-10'::date,
        'Native schedule fixture.'::text,
        1::bigint,
        null::uuid
      )
    `;
    assert.deepEqual(nativeScheduleRows[0], {
      status: "applied",
      family_id: familyAId,
      schedule_id: scheduleAId,
      scheduled_date: "2026-08-10",
    });
    const nativeBindings = await sql<{
      loop_id: string;
      family_id: string;
      receipt_id: string;
      child_id: string;
      scheduled_date: string;
    }[]>`
      select loop_id, family_id, receipt_id, child_id, scheduled_date::text
      from public.mobile_capture_loop_receipts
      where loop_id = ${nativeScheduleLoopId}::uuid
    `;
    assert.deepEqual(nativeBindings[0], {
      loop_id: nativeScheduleLoopId,
      family_id: familyAId,
      receipt_id: scheduleAId,
      child_id: childAId,
      scheduled_date: "2026-08-10",
    });
    const nativeRetryRows = await sql<{ status: string; schedule_id: string }[]>`
      select status, schedule_id
      from public.schedule_plan_activity_native_v1(
        ${nativeScheduleLoopId}::uuid,
        ${childAId}::uuid,
        'math'::text,
        1::smallint,
        0::smallint,
        '2026-08-10'::date,
        'Native schedule fixture.'::text,
        1::bigint,
        null::uuid
      )
    `;
    assert.deepEqual(nativeRetryRows[0], {
      status: "applied",
      schedule_id: scheduleAId,
    });
    const nativeSharedReceiptRows = await sql<{
      status: string;
      schedule_id: string;
    }[]>`
      select status, schedule_id
      from public.schedule_plan_activity_native_v1(
        ${nativeScheduleSecondLoopId}::uuid,
        ${childAId}::uuid,
        'math'::text,
        1::smallint,
        0::smallint,
        '2026-08-10'::date,
        'Native schedule fixture.'::text,
        1::bigint,
        null::uuid
      )
    `;
    assert.deepEqual(nativeSharedReceiptRows[0], {
      status: "applied",
      schedule_id: scheduleAId,
    });
    const [sharedReceiptBindings] = await sql<{ count: number }[]>`
      select count(*)::int as count
      from public.mobile_capture_loop_receipts
      where family_id = ${familyAId}
        and receipt_id = ${scheduleAId}
    `;
    assert.equal(sharedReceiptBindings?.count, 2);
    await assert.rejects(
      sql`
        select *
        from public.schedule_plan_activity_native_v1(
          ${nativeScheduleLoopId}::uuid,
          ${childAId}::uuid,
          'math'::text,
          1::smallint,
          0::smallint,
          '2026-08-11'::date,
          'Native schedule fixture.'::text,
          1::bigint,
          null::uuid
        )
      `,
      /already used for another operation/u,
    );
    await assert.rejects(
      sql`
        select *
        from public.schedule_plan_activity_native_v1(
          ${uuid("a", 2)}::uuid,
          ${childBId}::uuid,
          'math'::text,
          1::smallint,
          0::smallint,
          '2026-08-10'::date,
          'Native schedule fixture.'::text,
          1::bigint,
          null::uuid
        )
      `,
      /child does not belong to the caller/u,
    );
    await sql`
      insert into public.voice_action_receipts
        (id, family_id, object_kind, object_id, effect, status, undone_at)
      values
        (${scheduleReceiptAId}, ${familyAId}, 'plan_activity', ${scheduleAId},
          'plan_activity.scheduled', 'committed', null),
        (${scheduleReceiptASecondId}, ${familyAId}, 'plan_activity', ${scheduleAId},
          'plan_activity.scheduled', 'committed', null)
    `;
    await sql`
      insert into public.child_progress_operations
        (id, family_id, status, evidence_ids, affected_item_ids, result)
      values
        (${progressRecordedId}, ${familyAId}, 'recorded',
          array[${uuid("9", 1)}]::uuid[], array['math.counts']::text[],
          '{"status":"recorded"}'::jsonb),
        (${progressPendingId}, ${familyAId}, 'pending', '{}', '{}',
          '{"status":"pending"}'::jsonb),
        (${progressConflictId}, ${familyAId}, 'conflict_pending', '{}',
          array['math.counts']::text[], '{"status":"conflict_pending"}'::jsonb),
        (${progressObservationId}, ${familyAId}, 'activity_only', '{}', '{}',
          '{"status":"activity_only"}'::jsonb),
        (${progressAlreadyUndoneSourceId}, ${familyAId}, 'recorded',
          array[${uuid("9", 2)}]::uuid[], array['math.counts']::text[],
          '{"status":"recorded"}'::jsonb),
        (${progressUndoBeforeOutcomeId}, ${familyAId}, 'undone',
          array[${uuid("9", 3)}]::uuid[], array['math.counts']::text[],
          ${sql.json({
            status: "undone",
            operationId: progressAlreadyUndoneSourceId,
          })}),
        (${progressAnswersCorrectedId}, ${familyAId}, 'answers_corrected',
          array[${uuid("9", 4)}]::uuid[], array['math.counts']::text[],
          '{"status":"answers_corrected"}'::jsonb),
        (${progressEvidenceUndoSourceId}, ${familyAId}, 'recorded',
          array[${uuid("9", 6)}]::uuid[], array['math.counts']::text[],
          '{"status":"recorded"}'::jsonb),
        (${progressEvidenceUndoBeforeOutcomeId}, ${familyAId}, 'undone',
          array[${uuid("9", 6)}]::uuid[], array['math.counts']::text[],
          ${sql.json({ status: "undone", evidenceId: uuid("9", 6) })}),
        (${progressEvidenceRecordedId}, ${familyAId}, 'recorded',
          array[${uuid("9", 7)}]::uuid[], array['math.counts']::text[],
          '{"status":"recorded"}'::jsonb),
        (${progressMultiEvidenceSourceId}, ${familyAId}, 'recorded',
          array[${uuid("9", 8)}, ${uuid("9", 9)}]::uuid[],
          array['math.counts', 'math.adds']::text[],
          '{"status":"recorded"}'::jsonb),
        (${progressMultiEvidenceUndoId}, ${familyAId}, 'undone',
          array[${uuid("9", 8)}]::uuid[], array['math.counts']::text[],
          ${sql.json({ status: "undone", evidenceId: uuid("9", 8) })}),
        (${progressFullyUndoneSourceId}, ${familyAId}, 'recorded',
          array[${uuid("9", 10)}, ${uuid("9", 11)}]::uuid[],
          array['math.counts', 'math.adds']::text[],
          '{"status":"recorded"}'::jsonb),
        (${progressFullyUndoneFirstId}, ${familyAId}, 'undone',
          array[${uuid("9", 10)}]::uuid[], array['math.counts']::text[],
          ${sql.json({ status: "undone", evidenceId: uuid("9", 10) })}),
        (${progressFullyUndoneSecondId}, ${familyAId}, 'undone',
          array[${uuid("9", 11)}]::uuid[], array['math.adds']::text[],
          ${sql.json({ status: "undone", evidenceId: uuid("9", 11) })})
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
    await persistCaptureLoopEventWithSql(sql, familyAId, {
      ...directEntry,
      event_id: directEntry.event_id.toUpperCase(),
      loop_id: directEntry.loop_id.toUpperCase(),
      object_id: directEntry.object_id?.toUpperCase() ?? null,
    });
    const [deduplicated] = await sql<{ count: number }[]>`
      select count(*)::int as count from public.events
      where family_id = ${familyAId}
        and name = 'product.loop_stage_recorded'
        and props ->> 'event_id' = ${directEntry.event_id}
    `;
    assert.equal(deduplicated?.count, 1);

    const concurrentEntry = loopEvent({
      eventSequence: 5,
      loopId: uuid("5", 9),
      stage: "entry_intent",
      sequence: 1,
      profile: "direct_mutation",
      intent: "schedule_learning",
      objectKind: "plan_activity",
      objectId: scheduleAId,
    });
    await Promise.all(
      Array.from({ length: 12 }, () =>
        persistCaptureLoopEventWithSql(sql, familyAId, concurrentEntry),
      ),
    );
    const [concurrentCount] = await sql<{ count: number }[]>`
      select count(*)::int as count from public.events
      where family_id = ${familyAId}
        and name = 'product.loop_stage_recorded'
        and props ->> 'event_id' = ${concurrentEntry.event_id}
    `;
    assert.equal(concurrentCount?.count, 1);

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
    await persistCaptureLoopEventWithSql(
      sql,
      familyAId,
      loopEvent({
        eventSequence: 6,
        loopId: uuid("5", 10),
        parentLoopId: parentLoopAId.toUpperCase(),
        stage: "entry_intent",
        sequence: 1,
        profile: "direct_mutation",
        intent: "schedule_learning",
        objectKind: "plan_activity",
        objectId: scheduleAId,
      }),
    );

    await persistCaptureLoopEventWithSql(
      sql,
      familyAId,
      loopEvent({
        eventSequence: 100,
        loopId: uuid("a", 1),
        stage: "effect_attempted",
        sequence: 2,
        profile: "direct_mutation",
        intent: "complete_learning",
        objectKind: "progress_operation",
        objectId: progressPendingId,
      }),
    );
    const progressOutcome = loopEvent({
      eventSequence: 101,
      loopId: uuid("a", 2),
      stage: "outcome_verified",
      sequence: 3,
      profile: "direct_mutation",
      intent: "complete_learning",
      objectKind: "progress_operation",
      objectId: progressRecordedId,
      receiptKind: "database_receipt",
      receiptId: progressRecordedId,
      outcomeKind: "durable_change",
    });
    await persistCaptureLoopEventWithSql(sql, familyAId, progressOutcome);
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 110,
          loopId: uuid("a", 110),
          stage: "outcome_verified",
          sequence: 3,
          profile: "direct_mutation",
          intent: "complete_learning",
          objectKind: "progress_operation",
          objectId: progressRecordedId,
          receiptKind: "database_receipt",
          receiptId: progressRecordedId,
          outcomeKind: "durable_change",
        }),
      ),
      /outcome receipt is already claimed/u,
    );
    await sql`
      insert into public.child_progress_operations
        (id, family_id, status, evidence_ids, affected_item_ids, result)
      values
        (${progressUndoneId}, ${familyAId}, 'undone',
          array[${uuid("9", 5)}]::uuid[], array['math.counts']::text[],
          ${sql.json({ status: "undone", operationId: progressRecordedId })})
    `;
    const progressReversalLoopId = uuid("e", 160);
    const progressReversal = [
      loopEvent({
        eventSequence: 160,
        loopId: progressReversalLoopId,
        parentLoopId: progressOutcome.loop_id,
        stage: "entry_intent",
        sequence: 1,
        profile: "direct_mutation",
        intent: "correct_or_undo",
        objectKind: "progress_operation",
        objectId: progressRecordedId,
      }),
      loopEvent({
        eventSequence: 161,
        loopId: progressReversalLoopId,
        parentLoopId: progressOutcome.loop_id,
        stage: "effect_attempted",
        sequence: 2,
        profile: "direct_mutation",
        intent: "correct_or_undo",
        objectKind: "progress_operation",
        objectId: progressRecordedId,
      }),
      loopEvent({
        eventSequence: 162,
        loopId: progressReversalLoopId,
        parentLoopId: progressOutcome.loop_id,
        stage: "correction_or_undo_verified",
        sequence: 3,
        profile: "direct_mutation",
        intent: "correct_or_undo",
        objectKind: "progress_operation",
        objectId: progressRecordedId,
        receiptKind: "database_receipt",
        receiptId: progressUndoneId,
        correctsEventId: progressOutcome.event_id,
        correctionResult: "reversed",
      }),
    ];
    assert.deepEqual(captureLoopTraceIssues(progressReversal), []);
    for (const event of progressReversal) {
      await persistCaptureLoopEventWithSql(sql, familyAId, event);
    }
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 163,
          loopId: uuid("e", 163),
          stage: "outcome_verified",
          sequence: 3,
          profile: "direct_mutation",
          intent: "complete_learning",
          objectKind: "progress_operation",
          objectId: progressAlreadyUndoneSourceId,
          receiptKind: "database_receipt",
          receiptId: progressAlreadyUndoneSourceId,
          outcomeKind: "durable_change",
        }),
      ),
      /outside the authenticated family/u,
    );
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 172,
          loopId: uuid("e", 172),
          stage: "outcome_verified",
          sequence: 3,
          profile: "direct_mutation",
          intent: "complete_learning",
          objectKind: "progress_operation",
          objectId: progressEvidenceUndoSourceId,
          receiptKind: "database_receipt",
          receiptId: progressEvidenceUndoSourceId,
          outcomeKind: "durable_change",
        }),
      ),
      /outside the authenticated family/u,
    );
    const progressEvidenceOutcome = loopEvent({
      eventSequence: 173,
      loopId: uuid("e", 173),
      stage: "outcome_verified",
      sequence: 3,
      profile: "direct_mutation",
      intent: "complete_learning",
      objectKind: "progress_operation",
      objectId: progressEvidenceRecordedId,
      receiptKind: "database_receipt",
      receiptId: progressEvidenceRecordedId,
      outcomeKind: "durable_change",
    });
    await persistCaptureLoopEventWithSql(
      sql,
      familyAId,
      progressEvidenceOutcome,
    );
    await sql`
      insert into public.child_progress_operations
        (id, family_id, status, evidence_ids, affected_item_ids, result)
      values
        (${progressEvidenceUndoId}, ${familyAId}, 'undone',
          array[${uuid("9", 7)}]::uuid[], array['math.counts']::text[],
          ${sql.json({ status: "undone", evidenceId: uuid("9", 7) })})
    `;
    await persistCaptureLoopEventWithSql(
      sql,
      familyAId,
      loopEvent({
        eventSequence: 174,
        loopId: uuid("e", 174),
        parentLoopId: progressEvidenceOutcome.loop_id,
        stage: "correction_or_undo_verified",
        sequence: 3,
        profile: "direct_mutation",
        intent: "correct_or_undo",
        objectKind: "progress_operation",
        objectId: progressEvidenceRecordedId,
        receiptKind: "database_receipt",
        receiptId: progressEvidenceUndoId,
        correctsEventId: progressEvidenceOutcome.event_id,
        correctionResult: "reversed",
      }),
    );
    const progressMultiEvidenceOutcome = loopEvent({
      eventSequence: 175,
      loopId: uuid("e", 175),
      stage: "outcome_verified",
      sequence: 3,
      profile: "direct_mutation",
      intent: "complete_learning",
      objectKind: "progress_operation",
      objectId: progressMultiEvidenceSourceId,
      receiptKind: "database_receipt",
      receiptId: progressMultiEvidenceSourceId,
      outcomeKind: "durable_change",
    });
    await persistCaptureLoopEventWithSql(
      sql,
      familyAId,
      progressMultiEvidenceOutcome,
    );
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 177,
          loopId: uuid("e", 177),
          parentLoopId: progressMultiEvidenceOutcome.loop_id,
          stage: "correction_or_undo_verified",
          sequence: 3,
          profile: "direct_mutation",
          intent: "correct_or_undo",
          objectKind: "progress_operation",
          objectId: progressMultiEvidenceSourceId,
          receiptKind: "database_receipt",
          receiptId: progressMultiEvidenceUndoId,
          correctsEventId: progressMultiEvidenceOutcome.event_id,
          correctionResult: "reversed",
        }),
      ),
      /outside the authenticated family/u,
    );
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 178,
          loopId: uuid("e", 178),
          stage: "outcome_verified",
          sequence: 3,
          profile: "direct_mutation",
          intent: "complete_learning",
          objectKind: "progress_operation",
          objectId: progressFullyUndoneSourceId,
          receiptKind: "database_receipt",
          receiptId: progressFullyUndoneSourceId,
          outcomeKind: "durable_change",
        }),
      ),
      /outside the authenticated family/u,
    );
    await sql`
      insert into public.child_progress_operations
        (id, family_id, status, evidence_ids, affected_item_ids, result)
      values
        (${progressMultiEvidenceUndoSecondId}, ${familyAId}, 'undone',
          array[${uuid("9", 9)}]::uuid[], array['math.adds']::text[],
          ${sql.json({ status: "undone", evidenceId: uuid("9", 9) })})
    `;
    await persistCaptureLoopEventWithSql(
      sql,
      familyAId,
      loopEvent({
        eventSequence: 179,
        loopId: uuid("e", 179),
        parentLoopId: progressMultiEvidenceOutcome.loop_id,
        stage: "correction_or_undo_verified",
        sequence: 3,
        profile: "direct_mutation",
        intent: "correct_or_undo",
        objectKind: "progress_operation",
        objectId: progressMultiEvidenceSourceId,
        receiptKind: "database_receipt",
        receiptId: progressMultiEvidenceUndoSecondId,
        correctsEventId: progressMultiEvidenceOutcome.event_id,
        correctionResult: "reversed",
      }),
    );
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 164,
          loopId: uuid("e", 164),
          parentLoopId: progressOutcome.loop_id,
          stage: "correction_or_undo_verified",
          sequence: 3,
          profile: "direct_mutation",
          intent: "correct_or_undo",
          objectKind: "progress_operation",
          objectId: progressRecordedId,
          receiptKind: "database_receipt",
          receiptId: progressAnswersCorrectedId,
          correctsEventId: progressOutcome.event_id,
          correctionResult: "corrected",
        }),
      ),
      /deterministic product receipt linkage/u,
    );
    for (const [eventSequence, objectId] of [
      [102, progressPendingId],
      [103, progressConflictId],
      [104, progressUndoBeforeOutcomeId],
    ] as const) {
      await assert.rejects(
        persistCaptureLoopEventWithSql(
          sql,
          familyAId,
          loopEvent({
            eventSequence,
            loopId: uuid("a", eventSequence),
            stage: "outcome_verified",
            sequence: 3,
            profile: "direct_mutation",
            intent: "complete_learning",
            objectKind: "progress_operation",
            objectId,
            receiptKind: "database_receipt",
            receiptId: objectId,
            outcomeKind: "durable_change",
          }),
        ),
        /outside the authenticated family/u,
      );
    }
    await persistCaptureLoopEventWithSql(
      sql,
      familyAId,
      loopEvent({
        eventSequence: 105,
        loopId: uuid("a", 105),
        stage: "outcome_verified",
        sequence: 3,
        profile: "direct_mutation",
        intent: "record_observation",
        objectKind: "progress_operation",
        objectId: progressObservationId,
        receiptKind: "database_receipt",
        receiptId: progressObservationId,
        outcomeKind: "durable_change",
      }),
    );
    for (const [eventSequence, objectId] of [
      [106, materialADraftId],
      [107, materialASupersededId],
    ] as const) {
      await assert.rejects(
        persistCaptureLoopEventWithSql(
          sql,
          familyAId,
          loopEvent({
            eventSequence,
            loopId: uuid("a", eventSequence),
            stage: "outcome_verified",
            sequence: 7,
            objectId,
            receiptId: objectId,
          }),
        ),
        /outside the authenticated family/u,
      );
    }
    await persistCaptureLoopEventWithSql(
      sql,
      familyAId,
      loopEvent({
        eventSequence: 130,
        loopId: uuid("d", 130),
        stage: "outcome_verified",
        sequence: 7,
        profile: "proposed_effect",
        intent: "create_material",
        objectKind: "material",
        objectId: materialRevisionRootId,
        receiptKind: "artifact_receipt",
        receiptId: materialRevisionFinalId,
        outcomeKind: "artifact_ready",
        revision: 2,
        revisionId: materialRevisionFinalId,
      }),
    );
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 165,
          loopId: uuid("e", 165),
          stage: "outcome_verified",
          sequence: 7,
          profile: "proposed_effect",
          intent: "create_material",
          objectKind: "material",
          objectId: materialLineageFirstId,
          receiptKind: "artifact_receipt",
          receiptId: materialLineageCorrectedId,
          outcomeKind: "artifact_ready",
          revision: 2,
          revisionId: materialLineageCorrectedId,
        }),
      ),
      /outside the authenticated family/u,
    );
    const lineageOutcome = loopEvent({
      eventSequence: 166,
      loopId: uuid("e", 166),
      stage: "outcome_verified",
      sequence: 7,
      profile: "proposed_effect",
      intent: "create_material",
      objectKind: "material",
      objectId: materialLineageRootId,
      receiptKind: "artifact_receipt",
      receiptId: materialLineageFirstId,
      outcomeKind: "artifact_ready",
      revision: 2,
      revisionId: materialLineageFirstId,
    });
    await persistCaptureLoopEventWithSql(sql, familyAId, lineageOutcome);
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 167,
          loopId: uuid("e", 167),
          parentLoopId: lineageOutcome.loop_id,
          stage: "correction_or_undo_verified",
          sequence: 3,
          profile: "direct_mutation",
          intent: "correct_or_undo",
          objectKind: "material",
          objectId: materialLineageRootId,
          receiptKind: "artifact_receipt",
          receiptId: materialLineageSiblingId,
          correctsEventId: lineageOutcome.event_id,
          correctionResult: "corrected",
        }),
      ),
      /outside the authenticated family/u,
    );
    await persistCaptureLoopEventWithSql(
      sql,
      familyAId,
      loopEvent({
        eventSequence: 168,
        loopId: uuid("e", 168),
        parentLoopId: lineageOutcome.loop_id,
        stage: "correction_or_undo_verified",
        sequence: 3,
        profile: "direct_mutation",
        intent: "correct_or_undo",
        objectKind: "material",
        objectId: materialLineageRootId,
        receiptKind: "artifact_receipt",
        receiptId: materialLineageCorrectedId,
        correctsEventId: lineageOutcome.event_id,
        correctionResult: "corrected",
      }),
    );
    const complianceOutcome = loopEvent({
      eventSequence: 131,
      loopId: uuid("d", 131),
      stage: "outcome_verified",
      sequence: 7,
      profile: "proposed_effect",
      intent: "manage_record",
      objectKind: "compliance_record",
      objectId: complianceAId,
      receiptKind: "database_receipt",
      receiptId: complianceAId,
      outcomeKind: "durable_change",
      revisionId: complianceAId,
    });
    await persistCaptureLoopEventWithSql(sql, familyAId, complianceOutcome);
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 176,
          loopId: uuid("e", 176),
          stage: "outcome_verified",
          sequence: 7,
          profile: "proposed_effect",
          intent: "manage_record",
          objectKind: "compliance_record",
          objectId: complianceCorrectionFirstId,
          receiptKind: "database_receipt",
          receiptId: complianceCorrectionFirstId,
          outcomeKind: "durable_change",
          revision: 2,
          revisionId: complianceCorrectionFirstId,
        }),
      ),
      /one exact revision row/u,
    );
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 132,
          loopId: uuid("d", 132),
          stage: "outcome_verified",
          sequence: 7,
          profile: "proposed_effect",
          intent: "create_material",
          objectKind: "material",
          objectId: complianceAId,
          receiptKind: "artifact_receipt",
          receiptId: complianceAId,
          outcomeKind: "artifact_ready",
          revisionId: complianceAId,
        }),
      ),
      /outside the authenticated family/u,
    );
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 133,
          loopId: uuid("d", 133),
          stage: "outcome_verified",
          sequence: 3,
          profile: "direct_mutation",
          intent: "manage_record",
          objectKind: "compliance_record",
          objectId: complianceAId,
          receiptKind: "database_receipt",
          receiptId: complianceAId,
          outcomeKind: "durable_change",
        }),
      ),
      /incompatible/u,
    );
    const planLoopId = uuid("d", 150);
    const planStages = [
      "entry_intent",
      "capture_accepted",
      "proposal_ready",
      "review_presented",
      "approval_recorded",
      "effect_attempted",
      "outcome_verified",
    ] as const;
    const planTrace = planStages.map((stage, index) =>
      loopEvent({
        eventSequence: 150 + index,
        loopId: planLoopId,
        stage,
        sequence: index + 1,
        profile: "proposed_effect",
        intent: "plan_learning",
        objectKind: "plan",
        objectId: stage === "outcome_verified" ? planApprovalAId : null,
        receiptKind:
          stage === "outcome_verified" ? "database_receipt" : "none",
        receiptId:
          stage === "outcome_verified" ? planApprovalAId : undefined,
        outcomeKind:
          stage === "outcome_verified" ? "durable_change" : undefined,
        revisionId: revisionStages.has(stage) ? planApprovalAId : null,
      }),
    );
    assert.deepEqual(captureLoopTraceIssues(planTrace), []);
    for (const event of planTrace.slice(0, -1)) {
      await persistCaptureLoopEventWithSql(sql, familyAId, event);
    }
    await sql`
      insert into public.month_plan_approvals
        (draft_id, family_id, final_revision)
      values (${planApprovalAId}, ${familyAId}, 1)
    `;
    const planOutcome = planTrace.at(-1);
    assert.ok(planOutcome);
    await persistCaptureLoopEventWithSql(sql, familyAId, planOutcome);
    await persistCaptureLoopEventWithSql(
      sql,
      familyAId,
      loopEvent({
        eventSequence: 112,
        loopId: uuid("c", 112),
        stage: "outcome_verified",
        sequence: 7,
        profile: "proposed_effect",
        intent: "plan_learning",
        objectKind: "plan",
        objectId: planApprovalASecondId,
        receiptKind: "database_receipt",
        receiptId: planApprovalASecondId,
        outcomeKind: "durable_change",
        revisionId: planApprovalASecondId,
      }),
    );
    for (const [eventSequence, objectId] of [
      [113, mutablePlanAId],
      [114, planApprovalWrongRevisionId],
    ] as const) {
      await assert.rejects(
        persistCaptureLoopEventWithSql(
          sql,
          familyAId,
          loopEvent({
            eventSequence,
            loopId: uuid("c", eventSequence),
            stage: "outcome_verified",
            sequence: 7,
            profile: "proposed_effect",
            intent: "plan_learning",
            objectKind: "plan",
            objectId,
            receiptKind: "database_receipt",
            receiptId: objectId,
            outcomeKind: "durable_change",
          }),
        ),
        /outside the authenticated family/u,
      );
    }
    const scheduleOutcomes = ([
      [115, scheduleReceiptAId],
      [116, scheduleReceiptASecondId],
    ] as const).map(([eventSequence, receiptId]) =>
      loopEvent({
          eventSequence,
          loopId: uuid("c", eventSequence),
          stage: "outcome_verified",
          sequence: 3,
          profile: "direct_mutation",
          intent: "schedule_learning",
          objectKind: "plan_activity",
          objectId: scheduleAId,
          receiptKind: "database_receipt",
          receiptId,
          outcomeKind: "durable_change",
      }),
    );
    for (const outcome of scheduleOutcomes) {
      await persistCaptureLoopEventWithSql(sql, familyAId, outcome);
    }
    const scheduleOutcomeA = scheduleOutcomes[0];
    assert.ok(scheduleOutcomeA);
    await sql`
      update public.voice_action_receipts
      set undone_at = now()
      where id = ${scheduleReceiptASecondId} and family_id = ${familyAId}
    `;
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 137,
          loopId: uuid("d", 137),
          parentLoopId: scheduleOutcomeA.loop_id,
          stage: "correction_or_undo_verified",
          sequence: 3,
          profile: "direct_mutation",
          intent: "correct_or_undo",
          objectKind: "plan_activity",
          objectId: scheduleAId,
          receiptKind: "database_receipt",
          receiptId: scheduleReceiptASecondId,
          correctsEventId: scheduleOutcomeA.event_id,
          correctionResult: "reversed",
        }),
      ),
      /outside the authenticated family/u,
    );
    await persistCaptureLoopEventWithSql(
      sql,
      familyAId,
      loopEvent({
        eventSequence: 117,
        loopId: uuid("c", 117),
        stage: "outcome_verified",
        sequence: 3,
        profile: "direct_mutation",
        intent: "schedule_learning",
        objectKind: "plan_activity",
        objectId: scheduleAId,
        receiptKind: "database_receipt",
        receiptId: scheduleAId,
        outcomeKind: "durable_change",
      }),
    );
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 118,
          loopId: uuid("c", 118),
          stage: "outcome_verified",
          sequence: 3,
          profile: "direct_mutation",
          intent: "schedule_learning",
          objectKind: "plan_activity",
          objectId: scheduleAId,
          receiptKind: "database_receipt",
          receiptId: scheduleBId,
          outcomeKind: "durable_change",
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

    for (const [eventSequence, receiptId] of [
      [169, complianceAId],
      [170, complianceCorrectionFirstId],
    ] as const) {
      await assert.rejects(
        persistCaptureLoopEventWithSql(
          sql,
          familyAId,
          loopEvent({
            eventSequence,
            loopId: uuid("e", eventSequence),
            parentLoopId: originalOutcome.loop_id,
            stage: "correction_or_undo_verified",
            sequence: 3,
            profile: "direct_mutation",
            intent: "correct_or_undo",
            objectKind: "material",
            objectId: materialAId,
            receiptKind: "artifact_receipt",
            receiptId,
            correctsEventId: originalOutcome.event_id,
            correctionResult: "corrected",
          }),
        ),
        /outside the authenticated family/u,
      );
    }
    await persistCaptureLoopEventWithSql(
      sql,
      familyAId,
      loopEvent({
        eventSequence: 171,
        loopId: uuid("e", 171),
        stage: "outcome_verified",
        sequence: 7,
        profile: "proposed_effect",
        intent: "manage_record",
        objectKind: "compliance_record",
        objectId: complianceCorrectionFirstId,
        receiptKind: "database_receipt",
        receiptId: complianceCorrectionFirstId,
        outcomeKind: "durable_change",
        revisionId: complianceCorrectionFirstId,
      }),
    );

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
        correctionResult: "corrected",
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
          receiptId: materialAThirdId,
          correctsEventId: originalOutcome.event_id,
          correctionResult: "corrected",
        }),
      ),
      /outside the authenticated family/u,
    );
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 24,
          loopId: uuid("5", 8),
          parentLoopId: originalOutcome.loop_id,
          stage: "correction_or_undo_verified",
          sequence: 3,
          profile: "direct_mutation",
          intent: "correct_or_undo",
          objectId: materialAId,
          correctsEventId: originalOutcome.event_id,
          correctionResult: "corrected",
          receiptKind: "artifact_receipt",
          receiptId: materialBId,
        }),
      ),
      /outside the authenticated family/u,
    );
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 134,
          loopId: uuid("d", 134),
          stage: "outcome_verified",
          sequence: 7,
          profile: "proposed_effect",
          intent: "create_material",
          objectKind: "material",
          objectId: materialAId,
          receiptKind: "artifact_receipt",
          receiptId: materialASecondId,
          outcomeKind: "artifact_ready",
          revision: 2,
          revisionId: materialASecondId,
        }),
      ),
      /outcome receipt is already claimed/u,
    );
    await persistCaptureLoopEventWithSql(
      sql,
      familyAId,
      loopEvent({
        eventSequence: 135,
        loopId: uuid("d", 135),
        stage: "outcome_verified",
        sequence: 7,
        profile: "proposed_effect",
        intent: "create_material",
        objectKind: "material",
        objectId: materialAId,
        receiptKind: "artifact_receipt",
        receiptId: materialAThirdId,
        outcomeKind: "artifact_ready",
        revision: 2,
        revisionId: materialAThirdId,
      }),
    );
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 136,
          loopId: uuid("d", 136),
          parentLoopId: originalOutcome.loop_id,
          stage: "correction_or_undo_verified",
          sequence: 3,
          profile: "direct_mutation",
          intent: "correct_or_undo",
          objectKind: "material",
          objectId: materialAId,
          receiptKind: "artifact_receipt",
          receiptId: materialAThirdId,
          correctsEventId: originalOutcome.event_id,
          correctionResult: "corrected",
        }),
      ),
      /outcome receipt is already claimed/u,
    );

    await sql`
      insert into public.hours_log (id, family_id)
      values (${hoursAId}, ${familyAId})
    `;
    await assert.rejects(
      persistCaptureLoopEventWithSql(
        sql,
        familyAId,
        loopEvent({
          eventSequence: 118,
          loopId: uuid("c", 118),
          stage: "outcome_verified",
          sequence: 3,
          profile: "direct_mutation",
          intent: "record_hours",
          objectKind: "hours_record",
          objectId: hoursAId,
          receiptKind: "database_receipt",
          receiptId: hoursAId,
          outcomeKind: "durable_change",
        }),
      ),
      /outside the authenticated family/u,
    );
    await sql`
      insert into public.hours_log (id, family_id)
      values (${hoursRaceId}, ${familyAId})
    `;
    await sql`
      insert into public.voice_action_receipts
        (id, family_id, object_kind, object_id, effect, status, undone_at)
      values
        (${voiceReceiptRaceId}, ${familyAId}, 'hours_entry', ${hoursRaceId},
          'hours.logged', 'committed', null)
    `;
    let releaseUndoLock = (): void => {};
    let announceUndoLock = (): void => {};
    const undoLockAcquired = new Promise<void>((resolve) => {
      announceUndoLock = resolve;
    });
    const holdUndoLock = new Promise<void>((resolve) => {
      releaseUndoLock = resolve;
    });
    const undoTransaction = sql.begin(async (tx) => {
      await tx`
        select pg_advisory_xact_lock(
          hashtextextended(
            ${captureLoopReceiptLockKey(familyAId, voiceReceiptRaceId)},
            0
          )
        )
      `;
      await tx`
        update public.voice_action_receipts
        set undone_at = now()
        where id = ${voiceReceiptRaceId} and family_id = ${familyAId}
      `;
      announceUndoLock();
      await holdUndoLock;
    });
    await undoLockAcquired;
    const racedOutcome = loopEvent({
      eventSequence: 140,
      loopId: uuid("d", 140),
      stage: "outcome_verified",
      sequence: 3,
      profile: "direct_mutation",
      intent: "record_hours",
      objectKind: "hours_record",
      objectId: hoursRaceId,
      receiptKind: "database_receipt",
      receiptId: voiceReceiptRaceId,
      outcomeKind: "durable_change",
    });
    const racedOutcomeRejected = assert.rejects(
      persistCaptureLoopEventWithSql(sql, familyAId, racedOutcome),
      /outside the authenticated family/u,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    releaseUndoLock();
    await undoTransaction;
    await racedOutcomeRejected;
    const [racedOutcomeCount] = await sql<{ count: number }[]>`
      select count(*)::int as count from public.events
      where family_id = ${familyAId}
        and name = 'product.loop_stage_recorded'
        and props ->> 'event_id' = ${racedOutcome.event_id}
    `;
    assert.equal(racedOutcomeCount?.count, 0);
    await sql`
      insert into public.voice_action_receipts
        (id, family_id, object_kind, object_id, effect, status, undone_at)
      values
        (${voiceReceiptAId}, ${familyAId}, 'hours_entry', ${hoursAId},
          'hours.logged', 'committed', null)
    `;
    const hoursOutcome = loopEvent({
      eventSequence: 108,
      loopId: uuid("a", 108),
      stage: "outcome_verified",
      sequence: 3,
      profile: "direct_mutation",
      intent: "record_hours",
      objectKind: "hours_record",
      objectId: hoursAId,
      receiptKind: "database_receipt",
      receiptId: voiceReceiptAId,
      outcomeKind: "durable_change",
    });
    await persistCaptureLoopEventWithSql(sql, familyAId, hoursOutcome);
    await sql`
      update public.voice_action_receipts
      set undone_at = now()
      where id = ${voiceReceiptAId} and family_id = ${familyAId}
    `;
    await sql`
      delete from public.hours_log
      where id = ${hoursAId} and family_id = ${familyAId}
    `;
    await persistCaptureLoopEventWithSql(
      sql,
      familyAId,
      loopEvent({
        eventSequence: 109,
        loopId: uuid("a", 109),
        parentLoopId: hoursOutcome.loop_id,
        stage: "correction_or_undo_verified",
        sequence: 3,
        profile: "direct_mutation",
        intent: "correct_or_undo",
        objectKind: "hours_record",
        objectId: hoursAId,
        receiptKind: "database_receipt",
        receiptId: voiceReceiptAId,
        correctsEventId: hoursOutcome.event_id,
        correctionResult: "reversed",
      }),
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
