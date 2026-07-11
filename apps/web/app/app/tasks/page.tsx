import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getMyFamily } from "../../../lib/family";
import { effectiveTimeZone } from "../../../lib/time-zone";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { PageColumn } from "../../../components/dashboard/page-column";
import { TasksView, type TaskRowView, type TaskRunView } from "./tasks-view";

/**
 * /app/tasks: Homa's tasks (HT-5/HT-6, tab name D-ht-4). What Homa does
 * on her own schedule and what those runs produced; clearly not the
 * kids' Week planner. Reads ride the caller's own RLS (the new SELECT
 * policies from migration #49); every write goes through the server
 * actions beside this file.
 */

export const metadata: Metadata = {
  title: "Homa's tasks",
  robots: { index: false },
};

export default async function TasksPage() {
  const family = await getMyFamily();
  if (!family?.profile_completed_at) redirect("/onboarding");

  const supabase = await createSupabaseServerClient();
  const [scheduleResult, runsResult] = await Promise.all([
    supabase
      .from("agent_schedules")
      .select(
        "id, kind, label, prompt, local_hour, weekdays, delivery_pref, paused_at, enabled, next_run_at, created_by",
      )
      .order("created_at", { ascending: true }),
    supabase
      .from("homa_task_runs")
      .select("id, kind, status, title, summary, delivered_channel, started_at")
      .order("started_at", { ascending: false })
      .limit(30),
  ]);

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

  const runs: TaskRunView[] = (runsResult.data ?? []).map((row) => ({
    id: row.id as string,
    kind: row.kind as TaskRunView["kind"],
    status: row.status as TaskRunView["status"],
    title: row.title as string,
    summary: (row.summary as string | null) ?? null,
    deliveredChannel: (row.delivered_channel as TaskRunView["deliveredChannel"]) ?? null,
    startedAt: row.started_at as string,
  }));

  return (
    <PageColumn>
      <TasksView
        tasks={tasks}
        runs={runs}
        timeZone={effectiveTimeZone(family.time_zone)}
        briefFlagOn={process.env.MORNING_BRIEF_ENABLED === "true"}
        journalFlagOn={process.env.JOURNAL_PROMPT_ENABLED === "true"}
      />
    </PageColumn>
  );
}
