"use client";

import Link from "next/link";

import type { FamilyEventRow } from "../../../lib/family-events";
import { formatMinutesAsHours } from "../../../lib/hours-view";
import type { PlanActivityScheduleRow } from "../../../lib/plan-schedule";
import type { DashboardPlan } from "../../../lib/plan-week";
import { buildCalendarBoard, type CalendarActivityItem, type CalendarEventItem } from "../../../lib/calendar-view";
import { planChecksStorageKey, usePlanChecks } from "../../../lib/use-plan-checks";
import { avatarTone, KidAvatar } from "../../../components/dashboard/kid-avatar";

/**
 * /app/calendar (issue #176, CG-03: "calendar and homeschool planner in
 * one"). Per-kid lanes plus one family lane, color coded per kid, for
 * the current Monday-to-Sunday week: exactly the structure a co-founder
 * asked for in her own words ("have an option for each kid and then a
 * family calendar... check off each kid's lessons, added homa lessons,
 * family subjects, related activities, appts etc.").
 *
 * Three independent sources merge here (lib/calendar-view.ts owns the
 * pure merge): scheduled plan activities (checkable, the same check-off
 * store /app/planner already uses), family_events (appointments and
 * trips, this family's own calendar, never an external sync), and a
 * lightweight hours_log indicator (editing hours stays on /app/hours).
 *
 * Explicitly NOT built here (see the PR body): an optimizer that
 * reshuffles the week around a new appointment. The data this page
 * reads is exactly what a future skill would need for that; this page
 * only displays it.
 */

export interface CalendarKid {
  id: string;
  name: string;
  avatar_url: string | null;
}

function EventChip({ event }: { event: CalendarEventItem }) {
  const timeLabel =
    event.startTime && !event.multiDay
      ? event.endTime
        ? `${event.startTime} to ${event.endTime}`
        : event.startTime
      : null;
  return (
    <div className="rounded-md border border-border-subtle bg-card px-2 py-1.5 shadow-sm">
      <p className="text-[0.72rem] font-semibold leading-snug text-strong">{event.title}</p>
      {timeLabel ? <p className="text-[0.62rem] text-subtle">{timeLabel}</p> : null}
    </div>
  );
}

function ActivityCard({
  item,
  tone,
}: {
  item: CalendarActivityItem;
  tone: readonly [string, string];
}) {
  // Wired to the token only when one exists; the rare token-less edge
  // case (see lib/calendar-view.ts's CalendarActivityItem.token comment)
  // still shows the activity, just without a working checkbox.
  const checks = usePlanChecks({
    storageKey: planChecksStorageKey(item.token ?? "no-token", item.subjectId),
    childId: item.childId,
    subjectId: item.subjectId,
    initialChecks: { [item.checkId]: item.done },
  });
  const checked = item.token ? Boolean(checks.done[item.checkId]) : item.done;
  const [bg, ink] = tone;

  return (
    <div className="rounded-md p-2" style={{ background: bg }}>
      <span
        className="text-[0.56rem] font-bold uppercase tracking-[0.05em]"
        style={{ color: ink }}
      >
        {item.subjectLabel}
      </span>
      <label className="mt-1 flex cursor-pointer items-start gap-1.5">
        <input
          type="checkbox"
          checked={checked}
          disabled={!item.token}
          onChange={() => item.token && checks.toggle(item.checkId)}
          className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 accent-[var(--sage-500)]"
        />
        <span
          className={
            checked ? "text-[0.72rem] leading-snug text-subtle" : "text-[0.72rem] leading-snug text-body"
          }
        >
          {item.text}
        </span>
      </label>
    </div>
  );
}

export function CalendarView({
  kids,
  plans,
  reports,
  familyEvents,
  scheduledActivities,
  hoursEntries,
  timeZone,
  now,
  focusChildId,
}: {
  /** The FULL family roster, always (tone/avatar keys off list position). */
  kids: CalendarKid[];
  plans: DashboardPlan[];
  reports: Map<string, { token: string | null }>;
  familyEvents: FamilyEventRow[];
  scheduledActivities: PlanActivityScheduleRow[];
  hoursEntries: { childId: string | null; happenedOn: string; minutes: number }[];
  timeZone: string;
  now: Date;
  focusChildId: string | null;
}) {
  const board = buildCalendarBoard({
    kids: kids.map((kid) => ({ id: kid.id, name: kid.name, avatarUrl: kid.avatar_url })),
    plans,
    scheduledActivities,
    familyEvents,
    hoursEntries,
    reportTokens: new Map(kids.map((kid) => [kid.id, reports.get(kid.id)?.token ?? null])),
    now,
    timeZone,
    focusChildId,
  });

  const first = board.days[0];
  const last = board.days[board.days.length - 1];
  const spanLabel =
    first.month === last.month
      ? `${monthName(first.month)} ${first.dayOfMonth} to ${last.dayOfMonth}`
      : `${monthName(first.month)} ${first.dayOfMonth} to ${monthName(last.month)} ${last.dayOfMonth}`;

  const focusKid = focusChildId ? kids.find((kid) => kid.id === focusChildId) : undefined;
  const hasAnyFamilyEvent = board.familyDays.some((day) => day.events.length > 0);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-subtle">
            This week {"·"} {spanLabel}
          </p>
          <h1 className="mt-1.5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.015em] text-strong">
            {focusKid ? `${focusKid.name}'s calendar` : "Your calendar"}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted">
            School plans and family life in one place. Ask Homa to add an
            appointment or trip, or schedule a plan activity onto a real day.
          </p>
        </div>
        <Link
          href="/app/planner"
          className="rounded-pill border border-border bg-card px-5 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-brand"
        >
          Open the week planner
        </Link>
      </header>

      {/* The family lane: whole-family events only (co-op, a family
          trip). Kid-specific events live on that kid's own lane below. */}
      <section className="mt-6">
        <div className="flex items-center gap-2 px-0.5">
          <span className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-subtle">
            Family
          </span>
        </div>
        <div className="mt-1.5 grid gap-2 md:grid-cols-7">
          {board.familyDays.map((day, index) => (
            <div
              key={day.date}
              className={
                board.days[index].isToday
                  ? "flex flex-col gap-1.5 rounded-lg border border-brand bg-card p-2 shadow-sm"
                  : "flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-card p-2 shadow-sm"
              }
            >
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-subtle">
                {board.days[index].label} {board.days[index].dayOfMonth}
              </span>
              {day.events.length > 0 ? (
                day.events.map((event) => <EventChip key={event.id} event={event} />)
              ) : (
                <span className="text-[0.68rem] text-subtle">{"—"}</span>
              )}
            </div>
          ))}
        </div>
        {!hasAnyFamilyEvent ? (
          <p className="mt-1.5 px-0.5 text-xs text-muted">
            No family-wide events this week. Ask Homa to add an appointment or trip.
          </p>
        ) : null}
      </section>

      {board.kidLanes.length === 0 ? (
        <div className="mt-6 rounded-lg border border-border-subtle bg-card p-8 text-center shadow-sm">
          <p className="font-display text-xl font-semibold text-strong">
            Add a child first to see their calendar.
          </p>
        </div>
      ) : (
        board.kidLanes.map((lane) => {
          const tone = avatarTone(lane.kidIndex);
          return (
            <section key={lane.childId} className="mt-6">
              <div className="flex items-center gap-2.5 px-0.5">
                <KidAvatar
                  name={lane.childName}
                  index={lane.kidIndex}
                  avatarUrl={lane.avatarUrl}
                  size={24}
                  label={lane.childName}
                />
                <span className="font-display text-base font-semibold text-strong">
                  {lane.childName}
                </span>
              </div>
              <div className="mt-1.5 grid gap-2 md:grid-cols-7">
                {lane.days.map((day, index) => (
                  <div
                    key={day.date}
                    className={
                      board.days[index].isToday
                        ? "flex flex-col gap-1.5 rounded-lg border border-brand bg-card p-2 shadow-sm"
                        : "flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-card p-2 shadow-sm"
                    }
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-subtle">
                        {board.days[index].label} {board.days[index].dayOfMonth}
                      </span>
                      {day.hoursMinutes > 0 ? (
                        <span className="text-[0.58rem] font-semibold text-subtle">
                          {formatMinutesAsHours(day.hoursMinutes)}
                        </span>
                      ) : null}
                    </div>
                    {day.events.map((event) => (
                      <EventChip key={event.id} event={event} />
                    ))}
                    {day.activities.map((item) => (
                      <ActivityCard key={item.key} item={item} tone={tone} />
                    ))}
                    {day.activities.length === 0 && day.events.length === 0 ? (
                      <span className="text-[0.68rem] text-subtle">{"—"}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}

      <p className="mt-6 text-xs text-muted">
        Ask Homa to schedule a plan activity onto a real day, or to add an
        appointment or trip; both show up here right away. Hours shown here
        are a quick indicator; edit them on the Hours page.
      </p>
    </>
  );
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}
