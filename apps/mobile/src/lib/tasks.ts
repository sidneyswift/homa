import { supabase } from "./supabase";

/**
 * Reads for the Homa's tasks screen, ported from
 * apps/web/app/app/tasks/page.tsx and task-run-view.ts (keep shapes in
 * sync with those files until a shared package exists). Every query
 * rides the caller's RLS context: migration #49 gave family members
 * SELECT on agent_schedules and homa_task_runs, and the morning brief
 * v2 migration did the same for research_brief_feedback. No write
 * policies exist on any of these tables, so this module is read-only
 * on purpose; every change goes through Homa in chat (the same server
 * path the web page's server actions use).
 */

/** How many runs the screen loads and History shows. Mirrors the web's
 * HISTORY_RUN_LIMIT (task-copy.ts) so both feeds cap the same way. */
export const HISTORY_RUN_LIMIT = 30;

export type TaskKind = "journal_prompt" | "morning_brief" | "custom";

export interface TaskRow {
  id: string;
  kind: TaskKind;
  label: string | null;
  prompt: string | null;
  localHour: number;
  weekdays: number[];
  deliveryPref: "text" | "email" | "none";
  paused: boolean;
  /** System eligibility hygiene, separate from the parent's pause switch
   * (migration #49). Unused by the cards today; kept for web parity. */
  enabled: boolean;
  nextRunAt: string | null;
}

export type TaskRunKind = TaskKind | "fleet_research";

export type TaskRunStatus =
  | "running"
  | "done"
  | "partial"
  | "partial_uncertain"
  | "uncertain"
  | "failed"
  | "skipped";

export interface TaskRun {
  id: string;
  kind: TaskRunKind;
  status: TaskRunStatus;
  title: string;
  summary: string | null;
  deliveredChannel: "sms" | "email" | "none" | null;
  startedAt: string;
  /** The signed-in adult's own saved brief feedback, if any. Mobile shows
   * it read-only; recording feedback goes through the server (web action
   * recordResearchBriefFeedbackAction), so here it routes to chat. */
  feedbackSignal: "helpful" | "not_for_us" | null;
}

/** The slice of the family row this screen needs: gate onboarding and
 * render times in the family's own zone, same as the web page. */
export interface TasksFamilyContext {
  id: string;
  profile_completed_at: string | null;
  time_zone: string | null;
}

export async function getTasksFamilyContext(): Promise<TasksFamilyContext | null> {
  const { data, error } = await supabase
    .from("families")
    .select("id, profile_completed_at, time_zone")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`families read failed: ${error.message}`);
  return data;
}

export async function getMyScheduledTasks(): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from("agent_schedules")
    .select(
      "id, kind, label, prompt, local_hour, weekdays, delivery_pref, paused_at, enabled, next_run_at",
    )
    .order("created_at", { ascending: true });
  if (error) throw new Error(`agent schedules read failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    kind: row.kind as TaskRow["kind"],
    label: (row.label as string | null) ?? null,
    prompt: (row.prompt as string | null) ?? null,
    localHour: row.local_hour as number,
    weekdays: (row.weekdays as number[]) ?? [],
    deliveryPref: row.delivery_pref as TaskRow["deliveryPref"],
    paused: row.paused_at !== null,
    enabled: Boolean(row.enabled),
    nextRunAt: (row.next_run_at as string | null) ?? null,
  }));
}

/** Same embedded select the web page uses (TASK_RUN_HISTORY_SELECT):
 * the feedback join rides the runs query so one round trip carries the
 * whole feed. Fleet rows (family_id null) never appear; RLS hides them. */
const TASK_RUN_HISTORY_SELECT =
  "id, kind, status, title, summary, delivered_channel, started_at, research_brief_feedback(signal, member_user_id)";

interface TaskRunRow {
  id: string;
  kind: TaskRunKind;
  status: TaskRunStatus;
  title: string;
  summary: string | null;
  delivered_channel: TaskRun["deliveredChannel"];
  started_at: string;
  research_brief_feedback:
    | { member_user_id: string; signal: "helpful" | "not_for_us" }[]
    | null;
}

export async function getMyTaskRuns(): Promise<TaskRun[]> {
  const [{ data, error }, userResult] = await Promise.all([
    supabase
      .from("homa_task_runs")
      .select(TASK_RUN_HISTORY_SELECT)
      .order("started_at", { ascending: false })
      .limit(HISTORY_RUN_LIMIT),
    supabase.auth.getUser(),
  ]);
  if (error) throw new Error(`task runs read failed: ${error.message}`);

  // Feedback belongs to one adult, so only the caller's own row shows
  // (mirrors mapTaskRunViews on the web).
  const callerUserId = userResult.data.user?.id ?? null;
  return ((data ?? []) as unknown as TaskRunRow[]).map((row) => {
    const callerFeedback = (row.research_brief_feedback ?? []).find(
      (feedback) => feedback.member_user_id === callerUserId,
    );
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      title: row.title,
      summary: row.summary,
      deliveredChannel: row.delivered_channel,
      startedAt: row.started_at,
      feedbackSignal: callerFeedback?.signal ?? null,
    };
  });
}
