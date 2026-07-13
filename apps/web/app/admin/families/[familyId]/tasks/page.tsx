import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getFamilyTasks } from "../../../../../lib/admin/family-deep-data";
import { requireFounder } from "../../../../../lib/admin/gate";
import {
  adminTimeZone,
  taskHourLabel,
  taskWeekdaysLabel,
  timeAgo,
  timeLabel,
} from "../../../../../lib/admin/format";
import { EmptyNote, Pill, SectionHead, statusTone } from "../../../ui";
import { FamilyShell, isUuid } from "../family-shell";

/**
 * The family file's Tasks chapter: every schedule with its actual
 * prompt text, then the run record. What the parent's Tasks tab shows
 * as cards, this shows with the machine truth attached.
 */

export const metadata: Metadata = { title: "Family tasks" };

const KIND_LABEL: Record<string, string> = {
  journal_prompt: "Evening check-in (built-in)",
  morning_brief: "Morning brief (built-in)",
  custom: "Custom task",
};

export default async function AdminFamilyTasksPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  await requireFounder();
  const { familyId } = await params;
  if (!isUuid(familyId)) notFound();
  const { schedules, runs } = await getFamilyTasks(familyId);
  const timeZone = adminTimeZone();

  return (
    <FamilyShell familyId={familyId} title="· Tasks">
      {() => (
        <div>
          {schedules.length === 0 ? (
            <EmptyNote>No scheduled tasks yet for this family.</EmptyNote>
          ) : (
            <div className="grid gap-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-bold text-strong">
                      {schedule.label ?? KIND_LABEL[schedule.kind] ?? schedule.kind}
                    </h2>
                    <Pill tone={schedule.paused || !schedule.enabled ? "stone" : "sage"}>
                      {schedule.paused ? "off" : schedule.enabled ? "on" : "disabled"}
                    </Pill>
                    <Pill tone="sky">{schedule.kind.replace(/_/g, " ")}</Pill>
                  </div>
                  <p className="mt-1.5 text-sm text-muted">
                    {taskHourLabel(schedule.localHour)} · {taskWeekdaysLabel(schedule.weekdays)}
                    {" · delivery: "}
                    <span className="font-semibold text-body">{schedule.deliveryPref}</span>
                    {" · to: "}
                    <span className="font-semibold text-body">
                      {schedule.recipientName ?? "account owner (legacy row)"}
                    </span>
                    {schedule.nextRunAt && !schedule.paused ? (
                      <>
                        {" · next: "}
                        <span className="font-semibold text-body">
                          {timeLabel(schedule.nextRunAt, timeZone)} ·{" "}
                          {timeAgo(schedule.nextRunAt).replace(" ago", "")}
                        </span>
                      </>
                    ) : null}
                  </p>
                  <div className="mt-3 rounded-md bg-[var(--surface-sunken)] px-3.5 py-2.5">
                    <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.12em] text-subtle">
                      {schedule.prompt ? "The task's own prompt" : "Built-in task"}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-body">
                      {schedule.prompt ??
                        "The words are Homa's each run; the family controls only the schedule and delivery."}
                    </p>
                  </div>
                  <p className="mt-2 font-mono text-[0.62rem] text-subtle">
                    created by {schedule.createdBy ?? "unknown"} · last ran{" "}
                    {timeAgo(schedule.lastRunAt)} · schedule {schedule.id.slice(0, 8)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <SectionHead
            eyebrow="Machine"
            title="Every run, newest first"
            sub="Failures link straight into the session inspector."
          />
          {runs.length === 0 ? (
            <EmptyNote>No runs recorded yet.</EmptyNote>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {runs.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-card px-3.5 py-2.5 text-sm shadow-sm"
                >
                  <span className="font-mono text-xs text-subtle">{timeAgo(run.startedAt)}</span>
                  <span className="font-semibold text-body">{run.title}</span>
                  <Pill tone={statusTone(run.status)}>{run.status.replace(/_/g, " ")}</Pill>
                  {run.deliveredChannel ? (
                    <span className="text-subtle">{run.deliveredChannel}</span>
                  ) : null}
                  {run.error ? <span className="text-subtle">· {run.error}</span> : null}
                  {run.sessionId ? (
                    <Link
                      href={`/admin/sessions/${encodeURIComponent(run.sessionId)}`}
                      className="ml-auto font-semibold text-[var(--sky-600)] hover:underline"
                    >
                      open trace
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </FamilyShell>
  );
}
