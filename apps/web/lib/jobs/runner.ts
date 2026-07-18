import { mapDb, type DbJson } from "../map/db";
import { emitMapEvent } from "../map/events";

/**
 * The agent-jobs runner spine: the deterministic Postgres transitions that
 * drive a job forward one stage at a time (agent-jobs plan §A4,
 * 2026-07-18-agent-jobs-runner-spec.md). This is the provable half of the
 * runner. The other half, spawning a model session per stage to draft and
 * render it without delivering to the parent, is the eve wiring described
 * in the runner spec; it calls recordStageBuilt / failStage below with the
 * session's result. Keeping the transitions here, pure of any session
 * concern, is what lets them be reasoned about and tested on their own.
 *
 * Concurrency: a stage is claimed by moving it to 'in_progress' inside a
 * transaction with `for update skip locked`, so two runner ticks never
 * build the same stage. The stage's in_progress status IS the lease; a
 * crashed runner leaves a stale in_progress stage that a reaper (a
 * follow-up, mirroring reapStaleTaskRuns) recovers.
 *
 * Tenancy: every write re-scopes family_id from the claimed job row, never
 * model input, exactly like lib/jobs/store.ts.
 */

/** Gate the first stage for review (the calibration checkpoint), then let
 * the rest free-run. Generic default; a skill that wants per-volume gating
 * can widen this later. Pure so it is trivially testable. */
export function shouldGateStage(stageNumber: number): boolean {
  return stageNumber === 1;
}

export interface ClaimedJob {
  jobId: string;
  familyId: string;
  skill: string;
  childId: string | null;
  title: string;
  planRevision: number;
  stageNumber: number;
  totalStages: number;
}

export type ClaimResult =
  | { action: "build"; job: ClaimedJob }
  | { action: "cancel"; jobId: string; familyId: string; skill: string }
  | { action: "idle" };

/**
 * Claim the next runnable job atomically and lease its next stage. A
 * runnable job is queued or running, not cancel-requested, with a stage
 * left. Returns "cancel" when a cooperative cancel is pending (finalize it,
 * do not build), or "idle" when nothing is runnable.
 */
export async function claimNextRunnableJob(): Promise<ClaimResult> {
  const sql = mapDb();
  return await sql.begin(async (tx) => {
    const jobs = await tx<
      {
        id: string;
        family_id: string;
        skill: string;
        child_id: string | null;
        title: string;
        plan_revision: number;
        current_stage: number;
        total_stages: number;
        cancel_requested_at: string | null;
      }[]
    >`
      select id, family_id, skill, child_id, title, plan_revision,
             current_stage, total_stages, cancel_requested_at::text as cancel_requested_at
      from public.agent_jobs
      where status in ('queued', 'running')
        and current_stage < total_stages
      order by updated_at asc
      for update skip locked
      limit 1
    `;
    const job = jobs[0];
    if (!job) return { action: "idle" } as ClaimResult;

    if (job.cancel_requested_at !== null) {
      return {
        action: "cancel",
        jobId: job.id,
        familyId: job.family_id,
        skill: job.skill,
      } as ClaimResult;
    }

    const stageNumber = job.current_stage + 1;
    // Lease the stage: upsert to in_progress. The unique (job_id,
    // stage_number) makes a re-claim of an already-in_progress stage a
    // no-op update, and the skip-locked select above already prevented a
    // concurrent tick from reaching this job.
    await tx`
      insert into public.agent_job_stages
        (job_id, family_id, stage_number, status)
      values (${job.id}, ${job.family_id}, ${stageNumber}, 'in_progress')
      on conflict (job_id, stage_number)
      do update set status = 'in_progress', updated_at = now()
    `;
    await tx`
      update public.agent_jobs set status = 'running', updated_at = now()
      where id = ${job.id} and family_id = ${job.family_id}
    `;

    return {
      action: "build",
      job: {
        jobId: job.id,
        familyId: job.family_id,
        skill: job.skill,
        childId: job.child_id,
        title: job.title,
        planRevision: job.plan_revision,
        stageNumber,
        totalStages: job.total_stages,
      },
    } as ClaimResult;
  });
}

/** Finalize a cooperative cancel picked up by the claim (the cancel tool
 * set cancel_requested_at while a stage was mid-flight). */
export async function finalizeCooperativeCancel(
  jobId: string,
  familyId: string,
  skill: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.agent_jobs
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where id = ${jobId} and family_id = ${familyId} and status <> 'cancelled'
  `;
  const finished = await sql<{ count: string }[]>`
    select count(*)::text as count from public.agent_job_stages
    where job_id = ${jobId} and family_id = ${familyId}
      and status in ('approved', 'skipped')
  `;
  await sql`
    insert into public.agent_job_events (job_id, family_id, stage_number, kind, payload)
    values (${jobId}, ${familyId}, null, 'milestone',
            ${sql.json({ event: "cancelled" } as unknown as DbJson)})
  `;
  await emitMapEvent(
    "job.cancelled",
    { family_id: familyId, skill, completed_stages: Number(finished[0]?.count ?? 0) },
    { familyId },
  );
}

export interface StageBuiltInput {
  job: ClaimedJob;
  materialId: string | null;
  metering?: { sandboxCpuSeconds?: number; pageFetchCount?: number; modelTokens?: number };
}

/**
 * Record a finished stage: mark it (gated for review on the first stage,
 * else approved), link its material, meter it, advance the job, and either
 * gate for the parent, complete the job, or leave it runnable for the next
 * tick. Emits job.stage_completed, and job.completed when the last stage
 * lands.
 */
export async function recordStageBuilt(input: StageBuiltInput): Promise<void> {
  const sql = mapDb();
  const { job } = input;
  const gate = shouldGateStage(job.stageNumber);
  const newStatus = gate ? "ready_for_review" : "approved";
  const metering = input.metering ?? {};

  await sql`
    update public.agent_job_stages
    set status = ${newStatus},
        reviewed_at = ${gate ? sql`now()` : null},
        completed_at = ${gate ? null : sql`now()`},
        sandbox_cpu_seconds = ${metering.sandboxCpuSeconds ?? null},
        page_fetch_count = ${metering.pageFetchCount ?? null},
        model_tokens = ${metering.modelTokens ?? null},
        updated_at = now()
    where job_id = ${job.jobId} and family_id = ${job.familyId}
      and stage_number = ${job.stageNumber}
  `;

  if (input.materialId) {
    await sql`
      insert into public.agent_job_stage_artifacts
        (stage_id, job_id, family_id, kind, material_id)
      select s.id, ${job.jobId}, ${job.familyId}, 'material', ${input.materialId}
      from public.agent_job_stages s
      where s.job_id = ${job.jobId} and s.family_id = ${job.familyId}
        and s.stage_number = ${job.stageNumber}
    `;
  }

  await sql`
    update public.agent_jobs set current_stage = ${job.stageNumber}, updated_at = now()
    where id = ${job.jobId} and family_id = ${job.familyId}
  `;
  await sql`
    insert into public.agent_job_events (job_id, family_id, stage_number, kind, payload)
    values (${job.jobId}, ${job.familyId}, ${job.stageNumber}, 'stage_completed',
            ${sql.json({ gated: gate } as unknown as DbJson)})
  `;
  await emitMapEvent(
    "job.stage_completed",
    {
      family_id: job.familyId,
      skill: job.skill,
      stage_number: job.stageNumber,
      total_stages: job.totalStages,
    },
    { familyId: job.familyId },
  );

  if (gate) {
    await sql`
      update public.agent_jobs set status = 'awaiting_input', updated_at = now()
      where id = ${job.jobId} and family_id = ${job.familyId}
    `;
    return;
  }
  if (job.stageNumber >= job.totalStages) {
    await sql`
      update public.agent_jobs
      set status = 'completed', completed_at = now(), updated_at = now()
      where id = ${job.jobId} and family_id = ${job.familyId}
    `;
    await sql`
      insert into public.agent_job_events (job_id, family_id, stage_number, kind, payload)
      values (${job.jobId}, ${job.familyId}, null, 'milestone',
              ${sql.json({ event: "completed" } as unknown as DbJson)})
    `;
    await emitMapEvent(
      "job.completed",
      { family_id: job.familyId, skill: job.skill, total_stages: job.totalStages },
      { familyId: job.familyId },
    );
  }
  // Otherwise leave status 'running'; the next tick claims the next stage.
}

/** A stage failed. Park the job as needs-attention (paused) with an error
 * on the record so nothing is lost and the parent can retry, and emit
 * job.failed. Conservative on purpose: no silent auto-retry loop until an
 * attempts counter lands (runner spec). */
export async function failStage(
  job: ClaimedJob,
  error: string,
): Promise<void> {
  const sql = mapDb();
  const message = error.slice(0, 500);
  await sql`
    update public.agent_job_stages
    set status = 'failed', error = ${message}, updated_at = now()
    where job_id = ${job.jobId} and family_id = ${job.familyId}
      and stage_number = ${job.stageNumber}
  `;
  await sql`
    update public.agent_jobs set status = 'paused', updated_at = now()
    where id = ${job.jobId} and family_id = ${job.familyId}
  `;
  await sql`
    insert into public.agent_job_events (job_id, family_id, stage_number, kind, payload)
    values (${job.jobId}, ${job.familyId}, ${job.stageNumber}, 'error',
            ${sql.json({ message } as unknown as DbJson)})
  `;
  await emitMapEvent(
    "job.failed",
    { family_id: job.familyId, skill: job.skill, stage_number: job.stageNumber },
    { familyId: job.familyId },
  );
}

export interface StageMetering {
  sandboxCpuSeconds?: number;
  pageFetchCount?: number;
  modelTokens?: number;
}

export type WorkerStageResult =
  | { ok: true; status: string }
  | { ok: false; note: string };

/**
 * The completion path the build session's report_agent_job_stage tool
 * calls: it names the materials it produced, and this links them and drives
 * the transition. Keyed by the runner-stamped (familyId, jobId,
 * stageNumber), never model-chosen identity; the composite FKs then prove
 * every material belongs to this family. The stage must be the one actually
 * in flight (status in_progress), so a stray or replayed report cannot
 * advance a job.
 */
export async function completeStageFromWorker(
  familyId: string,
  jobId: string,
  stageNumber: number,
  materialIds: string[],
  metering: StageMetering = {},
): Promise<WorkerStageResult> {
  const sql = mapDb();
  const rows = await sql<
    {
      skill: string;
      child_id: string | null;
      title: string;
      plan_revision: number;
      total_stages: number;
      current_stage: number;
      status: string;
    }[]
  >`
    select j.skill, j.child_id, j.title, j.plan_revision, j.total_stages,
           j.current_stage, s.status
    from public.agent_jobs j
    join public.agent_job_stages s
      on s.job_id = j.id and s.family_id = j.family_id
    where j.id = ${jobId} and j.family_id = ${familyId}
      and s.stage_number = ${stageNumber}
  `;
  const row = rows[0];
  if (!row) return { ok: false, note: "That job stage is not in this family." };
  if (row.status !== "in_progress") {
    return { ok: false, note: `That stage is ${row.status}, not building; nothing to report.` };
  }

  // Link every material this stage produced (composite FK proves family +
  // material ownership); duplicates are ignored so a retried report is safe.
  for (const materialId of materialIds) {
    await sql`
      insert into public.agent_job_stage_artifacts
        (stage_id, job_id, family_id, kind, material_id)
      select s.id, ${jobId}, ${familyId}, 'material', ${materialId}
      from public.agent_job_stages s
      where s.job_id = ${jobId} and s.family_id = ${familyId}
        and s.stage_number = ${stageNumber}
      on conflict do nothing
    `;
  }

  const job: ClaimedJob = {
    jobId,
    familyId,
    skill: row.skill,
    childId: row.child_id,
    title: row.title,
    planRevision: row.plan_revision,
    stageNumber,
    totalStages: row.total_stages,
  };
  // Artifacts are already linked above; recordStageBuilt does the transition
  // (gate/approve, advance, complete) and the events. Pass materialId null so
  // it does not re-link.
  await recordStageBuilt({ job, materialId: null, metering });
  return { ok: true, status: shouldGateStage(stageNumber) ? "awaiting_input" : "running" };
}
