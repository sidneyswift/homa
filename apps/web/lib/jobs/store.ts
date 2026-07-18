import { mapDb, type DbJson } from "../map/db";
import { emitMapEvent } from "../map/events";
import {
  GENERIC_RESPOND_SCHEMA,
  getJobContract,
  parseJobPlan,
} from "./contracts";

/**
 * The agent-jobs state machine (agent-jobs plan §A1/§A4). Deterministic,
 * server-side, the ONLY writer of agent_jobs and its sibling tables. Every
 * function re-derives nothing about tenancy from the model: familyId
 * arrives already resolved from authenticated context (resolveAgentAccess
 * in the tool), and every query is scoped `where family_id = ${familyId}`,
 * so a model-supplied jobId can only ever address this family's rows.
 *
 * Writes run on the server connection (mapDb) because agent_jobs has no
 * Data API write policies on purpose; parents read their own rows through
 * the members-read SELECT policy.
 *
 * This module owns the durable transitions and the parent-visible timeline
 * (agent_job_events). The claim-lease runner that actually executes stages
 * by drafting and rendering each one is a separate piece; it consumes these
 * same rows and emits job.stage_completed / job.completed / job.failed.
 */

type JobEventKind =
  | "stage_started"
  | "stage_completed"
  | "milestone"
  | "steering_applied"
  | "error"
  | "eta_updated";

interface JobRow {
  id: string;
  family_id: string;
  child_id: string | null;
  skill: string;
  title: string;
  status: string;
  current_stage: number;
  total_stages: number;
  plan_revision: number;
  progress_note: string | null;
  created_at: string;
  updated_at: string;
}

type SqlClient = ReturnType<typeof mapDb>;

/** One row on the parent-visible timeline. Best-effort: a timeline write
 * must never fail a durable transition, so callers await it inside the
 * same path but a throw is swallowed here. */
async function insertJobEvent(
  sql: SqlClient,
  event: {
    jobId: string;
    familyId: string;
    stageNumber: number | null;
    kind: JobEventKind;
    actorUserId: string | null;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await sql`
      insert into public.agent_job_events
        (job_id, family_id, stage_number, kind, actor_user_id, payload)
      values
        (${event.jobId}, ${event.familyId}, ${event.stageNumber},
         ${event.kind}, ${event.actorUserId},
         ${sql.json(event.payload as unknown as DbJson)})
    `;
  } catch (error) {
    console.error(`insertJobEvent(${event.kind}) failed:`, error);
  }
}

async function loadJob(
  sql: SqlClient,
  familyId: string,
  jobId: string,
): Promise<JobRow | null> {
  const rows = await sql<JobRow[]>`
    select id, family_id, child_id, skill, title, status,
           current_stage, total_stages, plan_revision,
           progress_note, created_at::text as created_at,
           updated_at::text as updated_at
    from public.agent_jobs
    where id = ${jobId} and family_id = ${familyId}
  `;
  return rows[0] ?? null;
}

async function countFinishedStages(
  sql: SqlClient,
  familyId: string,
  jobId: string,
): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    select count(*)::text as count from public.agent_job_stages
    where job_id = ${jobId} and family_id = ${familyId}
      and status in ('approved', 'skipped')
  `;
  return Number(rows[0]?.count ?? 0);
}

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

export interface StartJobInput {
  familyId: string;
  requestedByUserId: string | null;
  sessionId: string | null;
  skill: string;
  title: string;
  plan: unknown;
  totalStages: number;
  childId?: string | null;
  startIdempotencyKey?: string | null;
}

export type StartJobResult =
  | { ok: true; jobId: string; status: string; alreadyExisted: boolean; note: string }
  | { ok: false; note: string };

/**
 * Start a finite job for a skill. Dedupe is a server-side constraint, not
 * the model's idempotency key: at most one active job per family + skill +
 * child. On a match, this returns the EXISTING job success-shaped ("already
 * running, on stage 3 of 9"), so the caller steers it instead of spawning a
 * second. The idempotency key only collapses a verbatim retry.
 */
export async function startJob(input: StartJobInput): Promise<StartJobResult> {
  const planCheck = parseJobPlan(input.skill, input.plan);
  if (!planCheck.ok) return { ok: false, note: planCheck.note };
  if (!Number.isInteger(input.totalStages) || input.totalStages < 1 || input.totalStages > 200) {
    return { ok: false, note: "total stages must be between 1 and 200." };
  }
  const title = input.title.trim();
  if (title.length < 1 || title.length > 160) {
    return { ok: false, note: "The job title is required and must be under 160 characters." };
  }

  const sql = mapDb();
  const childId = input.childId ?? null;
  const idemKey = input.startIdempotencyKey ?? null;

  // Verbatim-retry guard first.
  if (idemKey) {
    const existing = await sql<{ id: string; status: string }[]>`
      select id, status from public.agent_jobs
      where family_id = ${input.familyId} and start_idempotency_key = ${idemKey}
      limit 1
    `;
    if (existing[0]) {
      return {
        ok: true,
        jobId: existing[0].id,
        status: existing[0].status,
        alreadyExisted: true,
        note: "This exact build was already started; returning the existing job.",
      };
    }
  }

  // One active job per family + skill + child.
  const active = await sql<{ id: string; status: string; current_stage: number; total_stages: number }[]>`
    select id, status, current_stage, total_stages from public.agent_jobs
    where family_id = ${input.familyId}
      and skill = ${input.skill}
      and coalesce(child_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(${childId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
      and status in ('queued', 'running', 'paused', 'awaiting_input')
    limit 1
  `;
  if (active[0]) {
    return {
      ok: true,
      jobId: active[0].id,
      status: active[0].status,
      alreadyExisted: true,
      note: `A ${input.skill} build is already running (stage ${active[0].current_stage} of ${active[0].total_stages}). Steer or cancel it instead of starting another.`,
    };
  }

  try {
    const rows = await sql<{ id: string }[]>`
      insert into public.agent_jobs
        (family_id, child_id, requested_by_user_id, session_id, skill, title,
         plan, total_stages, start_idempotency_key, status)
      values
        (${input.familyId}, ${childId}, ${input.requestedByUserId},
         ${input.sessionId}, ${input.skill}, ${title},
         ${sql.json(input.plan as DbJson)}, ${input.totalStages},
         ${idemKey}, 'queued')
      returning id
    `;
    const jobId = rows[0].id;
    await insertJobEvent(sql, {
      jobId,
      familyId: input.familyId,
      stageNumber: null,
      kind: "milestone",
      actorUserId: input.requestedByUserId,
      payload: { event: "started", total_stages: input.totalStages },
    });
    await emitMapEvent(
      "job.started",
      { family_id: input.familyId, skill: input.skill, total_stages: input.totalStages },
      { familyId: input.familyId },
    );
    return {
      ok: true,
      jobId,
      status: "queued",
      alreadyExisted: false,
      note: "Job started; it will build stage by stage. Tell the parent it is underway.",
    };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      // Lost a race for the one-active-job or idempotency index; re-read.
      const raced = await sql<{ id: string; status: string }[]>`
        select id, status from public.agent_jobs
        where family_id = ${input.familyId} and skill = ${input.skill}
          and coalesce(child_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(${childId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
          and status in ('queued', 'running', 'paused', 'awaiting_input')
        limit 1
      `;
      if (raced[0]) {
        return {
          ok: true,
          jobId: raced[0].id,
          status: raced[0].status,
          alreadyExisted: true,
          note: "A build for this was just started; returning it.",
        };
      }
    }
    if (code === "23503") {
      return { ok: false, note: "That child is not in this family." };
    }
    console.error("startJob insert failed:", error);
    return { ok: false, note: "The job could not be started. Nothing was saved." };
  }
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

export interface JobStatusView {
  id: string;
  skill: string;
  title: string;
  status: string;
  currentStage: number;
  totalStages: number;
  progressNote: string | null;
  childId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toStatusView(row: JobRow): JobStatusView {
  return {
    id: row.id,
    skill: row.skill,
    title: row.title,
    status: row.status,
    currentStage: row.current_stage,
    totalStages: row.total_stages,
    progressNote: row.progress_note,
    childId: row.child_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** One job by id, or every active job for the family when no id is given.
 * Always family-scoped, so a model-supplied id cannot read another family. */
export async function getJobStatus(
  familyId: string,
  jobId?: string | null,
): Promise<{ ok: true; jobs: JobStatusView[] } | { ok: false; note: string }> {
  const sql = mapDb();
  if (jobId) {
    const job = await loadJob(sql, familyId, jobId);
    if (!job) return { ok: false, note: "That job is not in this family." };
    return { ok: true, jobs: [toStatusView(job)] };
  }
  const rows = await sql<JobRow[]>`
    select id, family_id, child_id, skill, title, status,
           current_stage, total_stages, plan_revision,
           progress_note, created_at::text as created_at,
           updated_at::text as updated_at
    from public.agent_jobs
    where family_id = ${familyId}
      and status in ('queued', 'running', 'paused', 'awaiting_input')
    order by updated_at desc
  `;
  return { ok: true, jobs: rows.map(toStatusView) };
}

// ---------------------------------------------------------------------------
// respond (steering)
// ---------------------------------------------------------------------------

export interface RespondToJobInput {
  familyId: string;
  actorUserId: string | null;
  jobId: string;
  response: unknown;
}

export async function respondToJob(
  input: RespondToJobInput,
): Promise<{ ok: true; status: string; note: string } | { ok: false; note: string }> {
  const sql = mapDb();
  const job = await loadJob(sql, input.familyId, input.jobId);
  if (!job) return { ok: false, note: "That job is not in this family." };
  if (["completed", "cancelled", "failed"].includes(job.status)) {
    return { ok: false, note: `This job is already ${job.status}; there is nothing to steer.` };
  }

  // Generic arms first (pause/resume), then the skill's own arms.
  const generic = GENERIC_RESPOND_SCHEMA.safeParse(input.response);
  if (generic.success) {
    const action = generic.data.action;
    if (action === "pause") {
      await sql`
        update public.agent_jobs
        set status = 'paused', updated_at = now()
        where id = ${input.jobId} and family_id = ${input.familyId}
          and status in ('queued', 'running', 'awaiting_input')
      `;
      await insertJobEvent(sql, {
        jobId: input.jobId,
        familyId: input.familyId,
        stageNumber: null,
        kind: "steering_applied",
        actorUserId: input.actorUserId,
        payload: { action: "pause" },
      });
      return { ok: true, status: "paused", note: "Paused. Nothing already built is lost." };
    }
    // resume
    await sql`
      update public.agent_jobs
      set status = 'queued', updated_at = now()
      where id = ${input.jobId} and family_id = ${input.familyId} and status = 'paused'
    `;
    await insertJobEvent(sql, {
      jobId: input.jobId,
      familyId: input.familyId,
      stageNumber: null,
      kind: "steering_applied",
      actorUserId: input.actorUserId,
      payload: { action: "resume" },
    });
    return { ok: true, status: "queued", note: "Resumed; the build will continue." };
  }

  const contract = getJobContract(job.skill);
  if (!contract) {
    return { ok: false, note: "This job's skill has no steering contract." };
  }
  const skillResponse = contract.respondSchema.safeParse(input.response);
  if (!skillResponse.success) {
    return {
      ok: false,
      note: "That steering action is not one this job accepts.",
    };
  }
  const data = skillResponse.data as { action: string; stageNumber?: number; instruction?: string };

  if (data.action === "approve_stage") {
    // Approve the stage waiting for review and let the runner continue.
    const approved = await sql<{ stage_number: number }[]>`
      update public.agent_job_stages
      set status = 'approved', reviewed_at = now(), completed_at = now(), updated_at = now()
      where job_id = ${input.jobId} and family_id = ${input.familyId}
        and status = 'ready_for_review'
      returning stage_number
    `;
    if (approved.length === 0) {
      return { ok: false, note: "There is no stage waiting for your approval right now." };
    }
    await sql`
      update public.agent_jobs
      set status = 'queued', updated_at = now()
      where id = ${input.jobId} and family_id = ${input.familyId}
        and status in ('awaiting_input', 'paused')
    `;
    await insertJobEvent(sql, {
      jobId: input.jobId,
      familyId: input.familyId,
      stageNumber: approved[0].stage_number,
      kind: "steering_applied",
      actorUserId: input.actorUserId,
      payload: { action: "approve_stage" },
    });
    return { ok: true, status: "queued", note: "Approved; the build will keep going." };
  }

  // revise_plan: record the parent's instruction, bump the revision, and
  // mark not-yet-built stages superseded so the runner re-expands from the
  // revised plan. Approved stages are never touched.
  await sql`
    update public.agent_job_stages
    set status = 'superseded', updated_at = now()
    where job_id = ${input.jobId} and family_id = ${input.familyId}
      and status in ('pending', 'ready_for_review')
  `;
  await sql`
    update public.agent_jobs
    set plan_revision = plan_revision + 1,
        status = case when status = 'awaiting_input' then 'queued' else status end,
        updated_at = now()
    where id = ${input.jobId} and family_id = ${input.familyId}
  `;
  await insertJobEvent(sql, {
    jobId: input.jobId,
    familyId: input.familyId,
    stageNumber: null,
    kind: "steering_applied",
    actorUserId: input.actorUserId,
    payload: { action: "revise_plan", instruction: data.instruction ?? "" },
  });
  return {
    ok: true,
    status: "queued",
    note: "Change noted; the parts not yet built will follow it.",
  };
}

// ---------------------------------------------------------------------------
// cancel (cooperative)
// ---------------------------------------------------------------------------

export interface CancelJobInput {
  familyId: string;
  actorUserId: string | null;
  jobId: string;
  reason?: string | null;
}

export async function cancelJob(
  input: CancelJobInput,
): Promise<{ ok: true; status: string; note: string } | { ok: false; note: string }> {
  const sql = mapDb();
  const job = await loadJob(sql, input.familyId, input.jobId);
  if (!job) return { ok: false, note: "That job is not in this family." };
  if (["completed", "cancelled", "failed"].includes(job.status)) {
    return { ok: false, note: `This job is already ${job.status}.` };
  }
  const reason = input.reason?.trim() ? input.reason.trim().slice(0, 240) : null;

  // Not actively mid-stage: cancel immediately.
  if (["queued", "paused", "awaiting_input"].includes(job.status)) {
    await sql`
      update public.agent_jobs
      set status = 'cancelled',
          cancel_requested_at = now(),
          cancelled_at = now(),
          cancel_reason = ${reason},
          updated_at = now()
      where id = ${input.jobId} and family_id = ${input.familyId}
    `;
    const completed = await countFinishedStages(sql, input.familyId, input.jobId);
    await insertJobEvent(sql, {
      jobId: input.jobId,
      familyId: input.familyId,
      stageNumber: null,
      kind: "milestone",
      actorUserId: input.actorUserId,
      payload: { event: "cancelled", completed_stages: completed },
    });
    await emitMapEvent(
      "job.cancelled",
      { family_id: input.familyId, skill: job.skill, completed_stages: completed },
      { familyId: input.familyId },
    );
    return {
      ok: true,
      status: "cancelled",
      note: "Stopped. Everything already built stays in the Binder.",
    };
  }

  // Running a stage right now: request cancel; the runner stops after the
  // current stage. Setting cancel_requested_at is the honest result.
  await sql`
    update public.agent_jobs
    set cancel_requested_at = now(), cancel_reason = ${reason}, updated_at = now()
    where id = ${input.jobId} and family_id = ${input.familyId} and cancel_requested_at is null
  `;
  return {
    ok: true,
    status: "running",
    note: "It will stop after the part it is building right now finishes. Nothing already built is lost.",
  };
}
