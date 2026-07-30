import { resolveApiFamily } from "../../../lib/api-auth";
import { getFamilyPhones } from "../../../lib/family-phone";
import { effectiveTimeZone } from "../../../lib/time-zone";
import { HISTORY_RUN_LIMIT } from "../../app/tasks/task-copy";
import { TASK_RUN_HISTORY_SELECT, mapTaskRunViews } from "../../app/tasks/task-run-view";
import { createCustomTask, customTaskInputSchema } from "../../../lib/tasks/custom";
import type { TaskRowView, TaskRunView } from "../../app/tasks/tasks-view";

/**
 * GET/POST /api/tasks: the mobile twin of /app/tasks/page.tsx. Reads ride
 * the caller's own RLS (resolveApiFamily's bearer-or-cookie client), the
 * same "members read their agent schedules" / "members read their task
 * runs" policies the web page already uses, so this route re-derives the
 * page's view models rather than inventing a second read path. Writes
 * still go through lib/tasks/custom on the privileged connection, same as
 * the web server actions, because agent_schedules has no Data API write
 * policies on purpose. familyId always comes from resolveApiFamily, never
 * the client.
 *
 * Scoped out of this v1, a tracked gap, not a silent one: agent job
 * builds (the "In progress" curriculum-build cards) never appear here.
 * Their own approve/pause/resume/cancel UI is not live on web yet
 * either (gh#40 tracker), so there is nothing stable to port.
 */

interface TaskListResponse {
  ok: true;
  tasks: TaskRowView[];
  runs: TaskRunView[];
  textingLinked: boolean;
  timeZone: string;
  briefFlagOn: boolean;
}

export async function GET(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  const familyResult = await auth.supabase
    .from("families")
    .select("time_zone, profile_completed_at")
    .eq("id", auth.familyId)
    .maybeSingle();
  if (!familyResult.data?.profile_completed_at) {
    return Response.json({ ok: false, reason: "onboarding-incomplete" }, { status: 409 });
  }

  const [scheduleResult, runsResult, phones] = await Promise.all([
    auth.supabase
      .from("agent_schedules")
      .select(
        "id, kind, label, prompt, local_hour, weekdays, delivery_pref, paused_at, enabled, next_run_at",
      )
      .order("created_at", { ascending: true }),
    auth.supabase
      .from("homa_task_runs")
      .select(TASK_RUN_HISTORY_SELECT)
      .order("started_at", { ascending: false })
      .limit(HISTORY_RUN_LIMIT),
    getFamilyPhones(auth.familyId),
  ]);
  if (scheduleResult.error) {
    return Response.json({ ok: false, reason: "read-failed" }, { status: 500 });
  }
  if (runsResult.error) {
    return Response.json({ ok: false, reason: "read-failed" }, { status: 500 });
  }

  const tasks: TaskRowView[] = (scheduleResult.data ?? []).map((row) => ({
    id: row.id as string,
    kind: row.kind as TaskRowView["kind"],
    label: (row.label as string | null) ?? null,
    prompt: (row.prompt as string | null) ?? null,
    localHour: row.local_hour as number,
    weekdays: (row.weekdays as number[]) ?? [],
    deliveryPref: row.delivery_pref as TaskRowView["deliveryPref"],
    paused: row.paused_at !== null,
    enabled: Boolean(row.enabled),
    nextRunAt: (row.next_run_at as string | null) ?? null,
  }));

  const runs: TaskRunView[] = mapTaskRunViews(
    (runsResult.data ?? []).map((row) => ({
      id: row.id as string,
      kind: row.kind as TaskRunView["kind"],
      status: row.status as TaskRunView["status"],
      title: row.title as string,
      summary: (row.summary as string | null) ?? null,
      delivered_channel: (row.delivered_channel as TaskRunView["deliveredChannel"]) ?? null,
      started_at: row.started_at as string,
      research_brief_feedback: Array.isArray(row.research_brief_feedback)
        ? row.research_brief_feedback.map((feedback) => ({
            member_user_id: feedback.member_user_id as string,
            signal: feedback.signal as "helpful" | "not_for_us",
          }))
        : [],
    })),
    auth.userId,
  );

  const textingLinked = phones.some(
    (phone) => phone.member_user_id === null || phone.member_user_id === auth.userId,
  );

  const body: TaskListResponse = {
    ok: true,
    tasks,
    runs,
    textingLinked,
    timeZone: effectiveTimeZone(familyResult.data.time_zone as string | null),
    briefFlagOn: process.env.MORNING_BRIEF_ENABLED === "true",
  };
  return Response.json(body);
}

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = customTaskInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, reason: parsed.error.issues[0]?.message ?? "invalid-task" },
      { status: 400 },
    );
  }

  const result = await createCustomTask(auth.familyId, parsed.data, "parent", auth.userId);
  if (!result.ok) {
    return Response.json({ ok: false, reason: result.note }, { status: 400 });
  }
  return Response.json({ ok: true, id: result.id });
}
