import type { ReactNode } from "react";

import type { FamilyTaskSchedule } from "../../../../../lib/admin/family-deep-data";
import { taskHourLabel, taskWeekdaysLabel } from "../../../../../lib/admin/format";

/**
 * Her screen's read-only fragments: the schedule cards echo the parent
 * Tasks tab's card layout without its switches and editor (those are
 * session-bound server actions), and the x-ray card is the mirror's
 * machine-truth annotation.
 */

export function ScreenTaskCards({
  schedules,
  timeZone,
}: {
  schedules: FamilyTaskSchedule[];
  timeZone: string;
}) {
  if (schedules.length === 0) {
    return (
      <p className="mt-3 rounded-md border border-dashed border-border-default bg-card px-3.5 py-3 text-sm text-subtle">
        No scheduled tasks yet.
      </p>
    );
  }
  return (
    <div className="mt-3 grid gap-2.5">
      {schedules.map((schedule) => {
        const active = !schedule.paused && schedule.enabled;
        const nextLabel =
          active && schedule.nextRunAt
            ? new Date(schedule.nextRunAt).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone,
              })
            : null;
        return (
          <div
            key={schedule.id}
            className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-[0.98rem] font-bold text-strong">
                {schedule.label ??
                  (schedule.kind === "morning_brief"
                    ? "Morning brief"
                    : schedule.kind === "journal_prompt"
                      ? "Evening check-in"
                      : "Custom task")}
              </p>
              <span
                className={
                  active
                    ? "inline-flex items-center rounded-pill bg-[var(--sage-50)] px-2.5 py-0.5 text-[0.72rem] font-bold text-[var(--sage-700)]"
                    : "inline-flex items-center rounded-pill bg-[var(--surface-sunken)] px-2.5 py-0.5 text-[0.72rem] font-bold text-muted"
                }
              >
                {active && nextLabel ? `Next · ${nextLabel}` : "Off"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {taskHourLabel(schedule.localHour)} · {taskWeekdaysLabel(schedule.weekdays)} ·{" "}
              {schedule.deliveryPref === "none" ? "saves to the tasks page" : `by ${schedule.deliveryPref}`}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function XrayCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5 rounded-lg border border-dashed border-[var(--gold-ink)] bg-[var(--gold-100)] px-4 py-3 text-sm text-[var(--gold-ink-strong)]">
      <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em]">
        X-ray · {title}
      </p>
      <div className="mt-1.5 [&_code]:rounded [&_code]:bg-white/60 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.78em]">
        {children}
      </div>
    </div>
  );
}
