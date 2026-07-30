"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMyFamily } from "../../../lib/family";
import { agentJobsEnabled } from "../../../lib/jobs/flag";
import { cancelJob, respondToJob } from "../../../lib/jobs/store";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import {
  createCustomTask,
  deleteCustomTask,
  setTaskPaused,
  updateCustomTask,
  updateTaskSchedule,
  type CustomTaskInput,
  type TaskScheduleInput,
} from "../../../lib/tasks/custom";
import {
  isResearchBriefFeedbackSignal,
} from "../../../lib/tasks/research-brief-feedback";
import { recordResearchBriefFeedback } from "../../../lib/tasks/research-brief-feedback-server";
import { runTaskNow } from "../../../lib/tasks/run-now";

/**
 * /app/tasks server actions (HT-5/HT-6). Same posture as the settings
 * actions: agent_schedules has no Data API write policies, so writes go
 * through lib/tasks/custom on the server connection, with familyId
 * derived from the caller's OWN membership (getMyFamily under RLS),
 * never from the form.
 */

export interface TaskActionState {
  error: string | null;
}

const TASK_RUN_ID_SCHEMA = z.uuid();
const JOB_ID_SCHEMA = z.uuid();
const STAGE_NUMBER_SCHEMA = z.number().int().min(1);

/** Shown when the agent-jobs flag is off. Matches the tool's own wording so
 * the parent hears one voice whether she steers by button or by chat. */
const JOBS_OFF_ERROR = "Long-running builds are not turned on yet.";

async function requireFamilyId(): Promise<string | null> {
  const family = await getMyFamily();
  return family?.id ?? null;
}

/** The signed-in adult creating the task, who becomes its one delivery
 * recipient (founder ruling 2026-07-12). */
async function callerUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function parseScheduleFields(
  formData: FormData,
): { weekdays: number[]; localHour: number } | { error: string } {
  const weekdays = [
    ...new Set(
      formData
        .getAll("weekdays")
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
    ),
  ].sort((left, right) => left - right);
  const localHour = Number(formData.get("localHour"));

  if (weekdays.length === 0) return { error: "Pick at least one day." };
  if (!Number.isInteger(localHour) || localHour < 0 || localHour > 23) {
    return { error: "Pick a time." };
  }
  return { weekdays, localHour };
}

function parseTaskForm(formData: FormData): CustomTaskInput | { error: string } {
  const label = String(formData.get("label") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const deliveryRaw = String(formData.get("deliveryPref") ?? "text");
  const deliveryPref =
    deliveryRaw === "email" || deliveryRaw === "none" ? deliveryRaw : ("text" as const);

  if (label.length < 3) return { error: "Give the task a short name (at least 3 characters)." };
  if (prompt.length < 10) return { error: "Tell Homa what to do in a sentence or two." };
  const schedule = parseScheduleFields(formData);
  if ("error" in schedule) return schedule;
  return { label, prompt, ...schedule, deliveryPref };
}

function parseTaskScheduleForm(formData: FormData): TaskScheduleInput | { error: string } {
  const schedule = parseScheduleFields(formData);
  if ("error" in schedule) return schedule;
  const deliveryRaw = String(formData.get("deliveryPref") ?? "text");
  const deliveryPref =
    deliveryRaw === "email" || deliveryRaw === "none" ? deliveryRaw : ("text" as const);
  return { ...schedule, deliveryPref };
}

export async function createTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const familyId = await requireFamilyId();
  if (!familyId) return { error: "Set up your family first." };

  const parsed = parseTaskForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const result = await createCustomTask(familyId, parsed, "parent", await callerUserId());
  if (!result.ok) return { error: result.note };
  revalidatePath("/app/tasks");
  return { error: null };
}

export async function updateTaskAction(
  taskId: string,
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const familyId = await requireFamilyId();
  if (!familyId) return { error: "Set up your family first." };

  const parsed = parseTaskForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const result = await updateCustomTask(familyId, taskId, parsed);
  if (!result.ok) return { error: result.note };
  revalidatePath("/app/tasks");
  return { error: null };
}

/** Built-in tasks (morning brief, evening check-in): the words are
 * Homa's, the schedule is the parent's. Only days, hour, and delivery
 * (text, email, or saved to the page) move here; label and prompt stay
 * untouched. */
export async function updateTaskScheduleAction(
  taskId: string,
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const familyId = await requireFamilyId();
  if (!familyId) return { error: "Set up your family first." };

  const parsed = parseTaskScheduleForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const result = await updateTaskSchedule(familyId, taskId, parsed);
  if (!result.ok) return { error: result.note };
  revalidatePath("/app/tasks");
  return { error: null };
}

export async function setTaskPausedAction(
  taskId: string,
  paused: boolean,
): Promise<TaskActionState> {
  const familyId = await requireFamilyId();
  if (!familyId) return { error: "Set up your family first." };

  const result = await setTaskPaused(familyId, taskId, paused);
  if (!result.ok) return { error: result.note };
  revalidatePath("/app/tasks");
  return { error: null };
}

/** Saves one adult's explicit response to a brief confirmed as delivered. */
export async function recordResearchBriefFeedbackAction(
  taskRunId: unknown,
  signal: unknown,
): Promise<TaskActionState> {
  const parsedTaskRunId = TASK_RUN_ID_SCHEMA.safeParse(taskRunId);
  if (!parsedTaskRunId.success) {
    return { error: "That brief isn't available for feedback." };
  }
  if (!isResearchBriefFeedbackSignal(signal)) {
    return { error: "That feedback choice isn't available." };
  }

  const familyId = await requireFamilyId();
  const memberUserId = await callerUserId();
  if (!familyId || !memberUserId) return { error: "Set up your family first." };

  const result = await recordResearchBriefFeedback({
    familyId,
    taskRunId: parsedTaskRunId.data,
    memberUserId,
    signal,
  });
  if (!result.accepted) return { error: "That brief isn't available for feedback." };

  revalidatePath("/app/tasks");
  return { error: null };
}

export async function deleteTaskAction(taskId: string): Promise<TaskActionState> {
  const familyId = await requireFamilyId();
  if (!familyId) return { error: "Set up your family first." };

  const result = await deleteCustomTask(familyId, taskId);
  if (!result.ok) return { error: result.note };
  revalidatePath("/app/tasks");
  return { error: null };
}

/**
 * Run now (the task editor's button): one immediate run of one task.
 * familyId comes from the caller's OWN membership (tenancy law), never
 * from the browser; runTaskNow's route re-scopes taskId by it.
 */
export async function runTaskNowAction(taskId: string): Promise<TaskActionState> {
  const familyId = await requireFamilyId();
  if (!familyId) return { error: "Set up your family first." };

  const result = await runTaskNow(taskId, familyId);
  if (result.ok) {
    revalidatePath("/app/tasks");
    return { error: null };
  }
  return { error: result.note };
}

/**
 * The parent-facing steering channel for a running agent job (the "Another
 * Task" card overlay). These mirror the four-verb contract the eve tools
 * expose (respond_to_agent_job, cancel_agent_job), but for the web button
 * path: any signed-in adult may steer (council decision), and the acting
 * adult is recorded. familyId and actorUserId come from the caller's OWN
 * session, never from the client, and the deterministic store re-scopes the
 * model-free jobId inside that family, so a forged id can only ever address
 * this family's rows. The flag gate matches the tools' posture.
 */
async function jobActorContext(): Promise<
  { familyId: string; actorUserId: string | null } | { error: string }
> {
  const familyId = await requireFamilyId();
  if (!familyId) return { error: "Set up your family first." };
  return { familyId, actorUserId: await callerUserId() };
}

/** Approve the volume waiting for review so the build keeps going. The
 * store approves the row that is actually ready_for_review inside this
 * family, so the client-supplied stageNumber only has to be a plausible
 * positive integer; it never selects which stage is approved. */
export async function approveAgentJobStageAction(
  jobId: unknown,
  stageNumber: unknown,
): Promise<TaskActionState> {
  if (!agentJobsEnabled()) return { error: JOBS_OFF_ERROR };
  const parsedJobId = JOB_ID_SCHEMA.safeParse(jobId);
  if (!parsedJobId.success) return { error: "That build isn't available." };
  const parsedStage = STAGE_NUMBER_SCHEMA.safeParse(stageNumber);
  if (!parsedStage.success) return { error: "That build isn't ready for approval." };

  const ctx = await jobActorContext();
  if ("error" in ctx) return { error: ctx.error };

  const result = await respondToJob({
    familyId: ctx.familyId,
    actorUserId: ctx.actorUserId,
    jobId: parsedJobId.data,
    response: { action: "approve_stage", stageNumber: parsedStage.data },
  });
  if (!result.ok) return { error: result.note };
  revalidatePath("/app/tasks");
  return { error: null };
}

export async function pauseAgentJobAction(jobId: unknown): Promise<TaskActionState> {
  if (!agentJobsEnabled()) return { error: JOBS_OFF_ERROR };
  const parsedJobId = JOB_ID_SCHEMA.safeParse(jobId);
  if (!parsedJobId.success) return { error: "That build isn't available." };

  const ctx = await jobActorContext();
  if ("error" in ctx) return { error: ctx.error };

  const result = await respondToJob({
    familyId: ctx.familyId,
    actorUserId: ctx.actorUserId,
    jobId: parsedJobId.data,
    response: { action: "pause" },
  });
  if (!result.ok) return { error: result.note };
  revalidatePath("/app/tasks");
  return { error: null };
}

export async function resumeAgentJobAction(jobId: unknown): Promise<TaskActionState> {
  if (!agentJobsEnabled()) return { error: JOBS_OFF_ERROR };
  const parsedJobId = JOB_ID_SCHEMA.safeParse(jobId);
  if (!parsedJobId.success) return { error: "That build isn't available." };

  const ctx = await jobActorContext();
  if ("error" in ctx) return { error: ctx.error };

  const result = await respondToJob({
    familyId: ctx.familyId,
    actorUserId: ctx.actorUserId,
    jobId: parsedJobId.data,
    response: { action: "resume" },
  });
  if (!result.ok) return { error: result.note };
  revalidatePath("/app/tasks");
  return { error: null };
}

export async function cancelAgentJobAction(jobId: unknown): Promise<TaskActionState> {
  if (!agentJobsEnabled()) return { error: JOBS_OFF_ERROR };
  const parsedJobId = JOB_ID_SCHEMA.safeParse(jobId);
  if (!parsedJobId.success) return { error: "That build isn't available." };

  const ctx = await jobActorContext();
  if ("error" in ctx) return { error: ctx.error };

  const result = await cancelJob({
    familyId: ctx.familyId,
    actorUserId: ctx.actorUserId,
    jobId: parsedJobId.data,
  });
  if (!result.ok) return { error: result.note };
  revalidatePath("/app/tasks");
  return { error: null };
}
