import { env, EVE_CHANNEL_HEADER } from "./env";
import { supabase } from "./supabase";

/**
 * The Tasks tab's read and write surface, ported from
 * apps/web/app/app/tasks/{tasks-view.tsx,actions.ts}. agent_schedules and
 * homa_task_runs have no client write policies on purpose, so every call
 * here is bearer-authed HTTP to the web app's /api/tasks routes, the same
 * pattern billing.ts uses: this app has no cookies, so the Supabase
 * access token IS the session. familyId is never sent by this client; the
 * server always derives it from the token via resolveApiFamily.
 */

export interface TaskRowView {
  id: string;
  kind: "journal_prompt" | "morning_brief" | "custom";
  label: string | null;
  prompt: string | null;
  localHour: number;
  weekdays: number[];
  deliveryPref: "text" | "email" | "none";
  paused: boolean;
  enabled: boolean;
  nextRunAt: string | null;
}

export interface TaskRunView {
  id: string;
  kind: "journal_prompt" | "morning_brief" | "custom" | "fleet_research" | "agent_job";
  status:
    | "running"
    | "done"
    | "partial"
    | "partial_uncertain"
    | "uncertain"
    | "failed"
    | "skipped";
  title: string;
  summary: string | null;
  deliveredChannel: "sms" | "email" | "none" | null;
  startedAt: string;
  feedbackSignal: "helpful" | "not_for_us" | null;
}

export interface TaskListData {
  tasks: TaskRowView[];
  runs: TaskRunView[];
  textingLinked: boolean;
  timeZone: string;
  briefFlagOn: boolean;
}

async function bearerToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function apiUrl(path: string): string {
  return `${env.apiUrl.replace(/\/+$/, "")}${path}`;
}

/** Null on any failure (offline, signed out, server error): the tab must
 *  never guess tasks or history, it stays in its loading state instead. */
export async function fetchTasks(): Promise<TaskListData | null> {
  try {
    const token = await bearerToken();
    if (!token) return null;
    const response = await fetch(apiUrl("/api/tasks"), {
      headers: { Authorization: `Bearer ${token}`, ...EVE_CHANNEL_HEADER },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      ok?: boolean;
      tasks?: TaskRowView[];
      runs?: TaskRunView[];
      textingLinked?: boolean;
      timeZone?: string;
      briefFlagOn?: boolean;
    };
    if (!body.ok) return null;
    return {
      tasks: body.tasks ?? [],
      runs: (body.runs ?? []).map((run) => ({ ...run, feedbackSignal: run.feedbackSignal ?? null })),
      textingLinked: body.textingLinked === true,
      timeZone: body.timeZone ?? "America/Chicago",
      briefFlagOn: body.briefFlagOn === true,
    };
  } catch {
    return null;
  }
}

export type TaskWriteResult = { ok: true } | { ok: false; reason: string };

async function writeRequest(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<TaskWriteResult> {
  try {
    const token = await bearerToken();
    if (!token) return { ok: false, reason: "no-session" };
    const response = await fetch(apiUrl(path), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...EVE_CHANNEL_HEADER,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const responseBody = (await response.json().catch(() => null)) as
      | { ok?: boolean; reason?: string }
      | null;
    if (!response.ok || responseBody?.ok !== true) {
      return { ok: false, reason: responseBody?.reason ?? "request-failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "network-error" };
  }
}

export interface CustomTaskInput {
  label: string;
  prompt: string;
  weekdays: number[];
  localHour: number;
  deliveryPref: "text" | "email" | "none";
}

export type CreateTaskResult = { ok: true; id: string } | { ok: false; reason: string };

export async function createTask(input: CustomTaskInput): Promise<CreateTaskResult> {
  try {
    const token = await bearerToken();
    if (!token) return { ok: false, reason: "no-session" };
    const response = await fetch(apiUrl("/api/tasks"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...EVE_CHANNEL_HEADER,
      },
      body: JSON.stringify(input),
    });
    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; reason?: string; id?: string }
      | null;
    if (!response.ok || body?.ok !== true || !body.id) {
      return { ok: false, reason: body?.reason ?? "create-failed" };
    }
    return { ok: true, id: body.id };
  } catch {
    return { ok: false, reason: "network-error" };
  }
}

/** Custom tasks only; a built-in kind's label and prompt are Homa's own
 *  and this route refuses to touch them (matches updateCustomTask). */
export async function updateTask(
  taskId: string,
  patch: Partial<CustomTaskInput>,
): Promise<TaskWriteResult> {
  return writeRequest("PATCH", `/api/tasks/${taskId}`, patch);
}

/** Custom tasks only (matches deleteCustomTask). */
export async function deleteTask(taskId: string): Promise<TaskWriteResult> {
  return writeRequest("DELETE", `/api/tasks/${taskId}`);
}

export interface TaskScheduleInput {
  weekdays: number[];
  localHour: number;
  deliveryPref: "text" | "email" | "none";
}

/** Schedule-only edit, valid for every kind including built-ins. */
export async function updateTaskSchedule(
  taskId: string,
  schedule: Partial<TaskScheduleInput>,
): Promise<TaskWriteResult> {
  return writeRequest("POST", `/api/tasks/${taskId}/schedule`, schedule);
}

export async function setTaskPaused(taskId: string, paused: boolean): Promise<TaskWriteResult> {
  return writeRequest("POST", `/api/tasks/${taskId}/pause`, { paused });
}

export async function runTaskNow(taskId: string): Promise<TaskWriteResult> {
  return writeRequest("POST", `/api/tasks/${taskId}/run-now`);
}

export type ResearchBriefFeedbackSignal = "helpful" | "not_for_us";

export async function recordTaskFeedback(
  taskRunId: string,
  signal: ResearchBriefFeedbackSignal,
): Promise<TaskWriteResult> {
  return writeRequest("POST", "/api/tasks/feedback", { taskRunId, signal });
}
