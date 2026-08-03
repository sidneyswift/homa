"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../../components/design/Icon";
import { QuietAction } from "../../../components/design/QuietAction";
import { QuietFrame } from "../../../components/design/QuietFrame";
import { QuietStatus } from "../../../components/design/QuietStatus";
import { KidAvatar } from "../../../components/dashboard/kid-avatar";
import {
  buildCalendarBoard,
  formatTimeRange,
  type CalendarActivityItem,
  type CalendarBoard,
} from "../../../lib/calendar-view";
import type {
  FamilyEventInput,
  FamilyEventRow,
  FamilyEventTimingInput,
} from "../../../lib/family-events";
import {
  expandRecurringFamilyEvents,
  familyEventChildIds,
} from "../../../lib/family-events-model";
import {
  formatMinutesAsHours,
  hoursSubjectTone,
  SUBJECT_LABELS,
  type HoursEntry,
} from "../../../lib/hours-view";
import { plannerActivityHelpHref } from "../../../lib/planner-activity-help";
import type { PlanActivityScheduleRow } from "../../../lib/plan-schedule";
import type { DashboardPlan } from "../../../lib/plan-week";
import {
  addDaysDateOnly,
  addMonthsDateOnly,
  monthCellsForDate,
  monthGridRangeForDate,
  type PlannerViewMode,
  weekOffsetDaysForDate,
  weekRangeForDate,
} from "../../../lib/unified-planner";
import { useAuthenticatedPlanChecks } from "../../../lib/use-authenticated-plan-checks";
import {
  createFamilyEventAction,
  deleteFamilyEventOccurrenceAction,
  deleteFamilyEventAction,
  moveFamilyEventOccurrenceAction,
  updateFamilyEventAction,
} from "../calendar/actions";
import { HoursView } from "../hours/hours-view";

export interface UnifiedPlannerKid {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface PlannerActivity extends CalendarActivityItem {
  kidIndex: number;
  kidName: string;
  kidAvatarUrl: string | null;
  date: string;
}

interface ComposerState {
  eventId: string | null;
  editingSeries: boolean;
  title: string;
  childIds: string[];
  startsOn: string;
  endsOn: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  note: string;
  repeatWeekly: boolean;
  recurrenceInterval: number;
  recurrenceWeekdays: number[];
  repeatUntil: string;
}

interface MoveComposerState {
  event: FamilyEventRow;
  startsOn: string;
  endsOn: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
}

interface RecurringScopeState {
  action: "move" | "delete";
  event: FamilyEventRow;
}

const VIEW_LABELS: ReadonlyArray<{ mode: PlannerViewMode; label: string }> = [
  { mode: "day", label: "Day" },
  { mode: "week", label: "Week" },
  { mode: "month", label: "Month" },
  { mode: "hours", label: "Hours" },
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function plannerHref(view: PlannerViewMode, date: string): string {
  return `/app/planner?view=${view}&date=${date}`;
}

function dateObject(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatFullDate(value: string): string {
  return dateObject(value).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatShortDate(value: string): string {
  return dateObject(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatMonth(value: string): string {
  return dateObject(value).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatWeek(value: string): string {
  const { start, end } = weekRangeForDate(value);
  const startDate = dateObject(start);
  const endDate = dateObject(end);
  const startMonth = startDate.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const endMonth = endDate.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  if (startMonth === endMonth) {
    return `${startMonth} ${startDate.getUTCDate()} to ${endDate.getUTCDate()}`;
  }
  return `${startMonth} ${startDate.getUTCDate()} to ${endMonth} ${endDate.getUTCDate()}`;
}

function dayNavigationDate(view: PlannerViewMode, date: string, direction: -1 | 1): string {
  if (view === "week") return addDaysDateOnly(date, direction * 7);
  if (view === "month") return addMonthsDateOnly(date, direction);
  return addDaysDateOnly(date, direction);
}

function eventVisibleToFocus(event: FamilyEventRow, focusChildId: string | null): boolean {
  const childIds = familyEventChildIds(event);
  return focusChildId === null || childIds.length === 0 || childIds.includes(focusChildId);
}

function eventsForDate(
  events: readonly FamilyEventRow[],
  date: string,
  focusChildId: string | null,
): FamilyEventRow[] {
  return expandRecurringFamilyEvents(events, date, date)
    .filter(
      (event) =>
        event.startsOn <= date &&
        event.endsOn >= date &&
        eventVisibleToFocus(event, focusChildId),
    )
    .sort((a, b) => {
      if (a.startTime === null && b.startTime !== null) return -1;
      if (a.startTime !== null && b.startTime === null) return 1;
      return (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.title.localeCompare(b.title);
    });
}

function activitiesForDate(board: CalendarBoard, date: string): PlannerActivity[] {
  const activities: PlannerActivity[] = [];
  for (const lane of board.kidLanes) {
    const day = lane.days.find((candidate) => candidate.date === date);
    if (!day) continue;
    for (const activity of day.activities) {
      activities.push({
        ...activity,
        kidIndex: lane.kidIndex,
        kidName: lane.childName,
        kidAvatarUrl: lane.avatarUrl,
        date,
      });
    }
  }
  return activities;
}

function childLabel(event: FamilyEventRow, kids: readonly UnifiedPlannerKid[]): string {
  const childIds = familyEventChildIds(event);
  if (childIds.length === 0) return "Whole family";
  const names = childIds.map((childId) => kids.find((kid) => kid.id === childId)?.name ?? "Child");
  return names.join(" + ");
}

function eventTimeLabel(event: FamilyEventRow): string {
  if (event.startTime === null) return "All day";
  return formatTimeRange(event.startTime, null);
}

function eventWhenLabel(event: FamilyEventRow): string {
  const span =
    event.startsOn === event.endsOn
      ? formatFullDate(event.startsOn)
      : `${formatShortDate(event.startsOn)} to ${formatShortDate(event.endsOn)}`;
  if (event.startTime === null) return `${span}, all day`;
  const range = formatTimeRange(event.startTime, event.endTime);
  return event.startsOn === event.endsOn ? `${span}, ${range}` : `${span}, ${range} on the first day`;
}

function weekdayForDate(value: string): number {
  return dateObject(value).getUTCDay();
}

function daysBetween(from: string, to: string): number {
  return Math.round((dateObject(to).getTime() - dateObject(from).getTime()) / 86_400_000);
}

function recurrenceLabel(event: FamilyEventRow): string | null {
  const rule = event.recurrence;
  if (!rule) return null;
  const cadence = rule.interval === 1 ? "Every week" : `Every ${rule.interval} weeks`;
  return rule.until ? `${cadence} until ${formatShortDate(rule.until)}` : cadence;
}

function createComposer(date: string, childId: string | null): ComposerState {
  return {
    eventId: null,
    editingSeries: false,
    title: "",
    childIds: childId ? [childId] : [],
    startsOn: date,
    endsOn: date,
    allDay: false,
    startTime: "09:00",
    endTime: "10:00",
    note: "",
    repeatWeekly: false,
    recurrenceInterval: 1,
    recurrenceWeekdays: [weekdayForDate(date)],
    repeatUntil: "",
  };
}

function editComposer(event: FamilyEventRow): ComposerState {
  const startsOn = event.seriesStartsOn ?? event.startsOn;
  return {
    eventId: event.id,
    editingSeries: event.recurrence != null,
    title: event.title,
    childIds: familyEventChildIds(event),
    startsOn,
    endsOn: event.seriesEndsOn ?? event.endsOn,
    allDay: event.startTime === null,
    startTime: event.seriesStartTime ?? event.startTime ?? "09:00",
    endTime: event.seriesEndTime ?? event.endTime ?? "10:00",
    note: event.note ?? "",
    repeatWeekly: event.recurrence != null,
    recurrenceInterval: event.recurrence?.interval ?? 1,
    recurrenceWeekdays: event.recurrence?.weekdays ?? [weekdayForDate(startsOn)],
    repeatUntil: event.recurrence?.until ?? "",
  };
}

function moveComposer(event: FamilyEventRow): MoveComposerState {
  return {
    event,
    startsOn: event.startsOn,
    endsOn: event.endsOn,
    allDay: event.startTime === null,
    startTime: event.startTime ?? "09:00",
    endTime: event.endTime ?? "10:00",
  };
}

function occurrenceOn(event: FamilyEventRow): string {
  return event.originalOccurrenceOn ?? event.startsOn;
}

function ModalShell({
  titleId,
  children,
  onClose,
}: {
  titleId: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_srgb,var(--homa-midnight)_42%,transparent)] p-4 backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <QuietFrame
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        as="section"
        className="relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-[520px] overflow-y-auto p-6"
      >
        {children}
      </QuietFrame>
    </div>
  );
}

function DialogClose({
  onClose,
  disabled = false,
}: {
  onClose: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClose}
      aria-label="Close"
      className="grid h-11 w-11 flex-none place-items-center rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-transparent text-[var(--homa-ink-muted)] transition-colors hover:border-[var(--homa-ink)] hover:text-[var(--homa-ink)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon name="close" size={20} />
    </button>
  );
}

function ActivityRow({
  activity,
  checked,
  pending,
  writable,
  onToggle,
  onOpen,
}: {
  activity: PlannerActivity;
  checked: boolean;
  pending: boolean;
  writable: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="grid min-h-[72px] grid-cols-[48px_minmax(0,1fr)] items-center border-b border-border-subtle last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        disabled={!writable}
        aria-busy={pending}
        aria-pressed={checked}
        aria-label={`${checked ? "Mark not finished" : "Mark finished"}: ${activity.text}`}
        className="grid h-11 w-11 place-items-center rounded-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className={
            checked
              ? "grid h-[22px] w-[22px] place-items-center rounded-[7px] border border-[var(--sage-500)] bg-[var(--sage-500)] text-white"
              : "grid h-[22px] w-[22px] place-items-center rounded-[7px] border-[1.5px] border-[var(--stone-500)] bg-card text-transparent"
          }
        >
          <Icon name="check" size={16} />
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="grid min-h-[70px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm py-2.5 text-left hover:bg-page"
      >
        <span className="min-w-0">
          <span
            className={
              checked
                ? "block font-display text-base font-semibold leading-snug text-muted line-through"
                : "block font-display text-base font-semibold leading-snug text-strong"
            }
          >
            {activity.text}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            <KidAvatar
              name={activity.kidName}
              index={activity.kidIndex}
              avatarUrl={activity.kidAvatarUrl}
              size={18}
            />
            {activity.kidName} · {activity.subjectLabel}
          </span>
        </span>
        <Icon name="next" size={20} className="mr-1 text-subtle" />
      </button>
    </div>
  );
}

function EventRow({
  event,
  kids,
  onOpen,
}: {
  event: FamilyEventRow;
  kids: readonly UnifiedPlannerKid[];
  onOpen: () => void;
}) {
  return (
    <div className="grid min-h-[74px] grid-cols-[84px_minmax(0,1fr)] items-center border-b border-border-subtle bg-[var(--sky-50)] last:border-b-0">
      <span className="px-2 text-center text-sm font-bold text-[var(--sky-600)]">
        {eventTimeLabel(event)}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="grid min-h-[72px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm py-2.5 pr-2 text-left hover:bg-[var(--sky-100)]"
      >
        <span>
          <span className="block font-display text-base font-semibold leading-snug text-strong">
            {event.title}
          </span>
          <span className="mt-0.5 block text-sm text-muted">{childLabel(event, kids)}</span>
        </span>
        <Icon name="next" size={20} className="text-subtle" />
      </button>
    </div>
  );
}

function RecordedHours({
  entries,
  showChild,
}: {
  entries: readonly HoursEntry[];
  showChild: boolean;
}) {
  if (entries.length === 0) return null;
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  return (
    <section className="mt-5" aria-labelledby="planner-day-hours-title">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="planner-day-hours-title" className="font-display text-base font-semibold text-strong">
          Recorded time
        </h3>
        <span className="text-xs font-semibold text-muted">
          {formatMinutesAsHours(totalMinutes)}
        </span>
      </div>
      <ul className="mt-2 overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle bg-card shadow-sm">
        {entries.map((entry) => {
          const [background, color] = hoursSubjectTone(entry.subject);
          return (
            <li
              key={entry.id}
              className="flex min-h-[58px] flex-wrap items-center gap-2 border-b border-border-subtle px-3.5 py-2.5 last:border-b-0"
            >
              <span
                className="rounded-pill px-2.5 py-1 text-[0.68rem] font-bold"
                style={{ background, color }}
              >
                {SUBJECT_LABELS[entry.subject]}
              </span>
              <span className="font-display text-sm font-semibold text-strong">
                {formatMinutesAsHours(entry.minutes)}
              </span>
              {showChild ? (
                <span className="text-xs font-semibold text-subtle">
                  {entry.childName ?? "Whole family"}
                </span>
              ) : null}
              {entry.note ? (
                <span className="min-w-0 flex-1 basis-32 truncate text-xs text-muted">
                  {entry.note}
                </span>
              ) : (
                <span className="flex-1" />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ActivityDetails({
  activity,
  done,
  onClose,
}: {
  activity: PlannerActivity;
  done: boolean;
  onClose: () => void;
}) {
  return (
    <ModalShell titleId="planner-activity-title" onClose={onClose}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="planner-activity-title" className="font-display text-2xl font-semibold text-strong">
            {activity.text}
          </h2>
          <p className="mt-1 text-sm text-muted">{formatFullDate(activity.date)}</p>
        </div>
        <DialogClose onClose={onClose} />
      </div>
      <dl className="mt-5 divide-y divide-border-subtle border-y border-border-subtle text-sm">
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-3">
          <dt className="text-muted">Who</dt>
          <dd className="font-semibold text-strong">{activity.kidName}</dd>
        </div>
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-3">
          <dt className="text-muted">Subject</dt>
          <dd className="font-semibold text-strong">{activity.subjectLabel}</dd>
        </div>
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-3">
          <dt className="text-muted">Status</dt>
          <dd className="font-semibold text-strong">{done ? "Finished" : "To do"}</dd>
        </div>
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        <QuietAction
          href={plannerActivityHelpHref({
            childId: activity.childId,
            subjectId: activity.subjectId,
            checkId: activity.checkId,
          })}
          icon={<Icon name="next" size={16} />}
        >
          Ask Homa how to do it
        </QuietAction>
        <QuietAction
          kind="secondary"
          href="/app?draft=schedule-week"
        >
          Change the day
        </QuietAction>
      </div>
    </ModalShell>
  );
}

function EventDetails({
  event,
  kids,
  onEdit,
  onMove,
  onDelete,
  onClose,
}: {
  event: FamilyEventRow;
  kids: readonly UnifiedPlannerKid[];
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <ModalShell titleId="planner-event-title" onClose={onClose}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="planner-event-title" className="font-display text-2xl font-semibold text-strong">
            {event.title}
          </h2>
          <p className="mt-1 text-sm text-muted">{eventWhenLabel(event)}</p>
        </div>
        <DialogClose onClose={onClose} />
      </div>
      <dl className="mt-5 divide-y divide-border-subtle border-y border-border-subtle text-sm">
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-3">
          <dt className="text-muted">Who</dt>
          <dd className="font-semibold text-strong">{childLabel(event, kids)}</dd>
        </div>
        {recurrenceLabel(event) ? (
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-3">
            <dt className="text-muted">Repeats</dt>
            <dd className="font-semibold text-strong">{recurrenceLabel(event)}</dd>
          </div>
        ) : null}
        {event.originalOccurrenceOn && event.originalOccurrenceOn !== event.startsOn ? (
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-3">
            <dt className="text-muted">Moved from</dt>
            <dd className="font-semibold text-strong">
              {formatFullDate(event.originalOccurrenceOn)}
            </dd>
          </div>
        ) : null}
        {event.note ? (
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-3">
            <dt className="text-muted">Note</dt>
            <dd className="whitespace-pre-wrap text-body">{event.note}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {event.recurrence ? (
          <button
            type="button"
            onClick={onMove}
            className="quiet-action quiet-action--primary quiet-action--default"
          >
            Move
          </button>
        ) : null}
        <button
          type="button"
          onClick={onEdit}
          className="quiet-action quiet-action--secondary quiet-action--default"
        >
          {event.recurrence ? "Edit series" : "Edit event"}
        </button>
        {event.recurrence ? (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto inline-flex min-h-11 items-center px-2 py-2 text-sm font-bold text-[var(--homa-brand-text)] hover:underline"
          >
            Delete
          </button>
        ) : null}
      </div>
    </ModalShell>
  );
}

function RecurringScopeDialog({
  state,
  saving,
  error,
  onThisEvent,
  onEntireSeries,
  onClose,
}: {
  state: RecurringScopeState;
  saving: boolean;
  error: string | null;
  onThisEvent: () => void;
  onEntireSeries: () => void;
  onClose: () => void;
}) {
  const moving = state.action === "move";
  const originalDate = occurrenceOn(state.event);
  const repeat = recurrenceLabel(state.event)?.replace(/^Every/u, "every");
  return (
    <ModalShell
      titleId="planner-recurring-scope-title"
      onClose={saving ? () => undefined : onClose}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="planner-recurring-scope-title"
            className="font-display text-2xl font-semibold text-strong"
          >
            {moving ? "What do you want to move?" : "What do you want to delete?"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {state.event.title} repeats{repeat ? ` ${repeat}` : ""}.
          </p>
        </div>
        <DialogClose onClose={onClose} disabled={saving} />
      </div>

      <div className="mt-5 grid gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onThisEvent}
          className="min-h-[64px] rounded-md border border-border bg-card px-4 py-3 text-left hover:border-[var(--clay-300)] hover:bg-page disabled:opacity-50"
        >
          <span className="block text-sm font-bold text-strong">
            {moving ? "Move this event" : "Delete this event"}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {moving
              ? `Only ${formatFullDate(originalDate)} moves. The rest stay.`
              : `${formatFullDate(originalDate)} is removed. The rest stay.`}
          </span>
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onEntireSeries}
          className="min-h-[64px] rounded-md border border-border bg-card px-4 py-3 text-left hover:border-[var(--clay-300)] hover:bg-page disabled:opacity-50"
        >
          <span
            className={
              moving
                ? "block text-sm font-bold text-strong"
                : "block text-sm font-bold text-[var(--clay-700)]"
            }
          >
            {moving ? "Edit entire series" : "Delete entire series"}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {moving
              ? "Change the schedule for every event in this series."
              : "Remove every event in this series, including past dates."}
          </span>
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-md bg-[var(--clay-50)] px-3 py-2 text-sm font-semibold text-[var(--clay-700)]">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={saving}
        onClick={onClose}
        className="mt-4 inline-flex min-h-11 items-center rounded-pill border border-border bg-card px-4 py-2 text-sm font-bold text-body hover:bg-page disabled:opacity-50"
      >
        Cancel
      </button>
    </ModalShell>
  );
}

function MoveEventComposer({
  state,
  saving,
  error,
  onChange,
  onSave,
  onClose,
}: {
  state: MoveComposerState;
  saving: boolean;
  error: string | null;
  onChange: (next: MoveComposerState) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <ModalShell titleId="planner-move-event-title" onClose={saving ? () => undefined : onClose}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="planner-move-event-title" className="font-display text-2xl font-semibold text-strong">
            Move this event
          </h2>
          <p className="mt-1 text-sm text-muted">{state.event.title}</p>
        </div>
        <DialogClose onClose={onClose} disabled={saving} />
      </div>

      <label className="mt-5 block text-sm font-semibold text-body">
        Date
        <input
          type="date"
          disabled={saving}
          value={state.startsOn}
          onChange={(event) => {
            const durationDays = Math.max(0, daysBetween(state.startsOn, state.endsOn));
            const startsOn = event.target.value;
            onChange({
              ...state,
              startsOn,
              endsOn: addDaysDateOnly(startsOn, durationDays),
            });
          }}
          className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-strong outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>

      <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold text-body">
        <input
          type="checkbox"
          disabled={saving}
          checked={state.allDay}
          onChange={(event) => onChange({ ...state, allDay: event.target.checked })}
          className="h-[18px] w-[18px] accent-[var(--clay-500)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        All day
      </label>

      {state.allDay ? null : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold text-body">
            Start time
            <input
              type="time"
              disabled={saving}
              value={state.startTime}
              onChange={(event) => onChange({ ...state, startTime: event.target.value })}
              className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-strong outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
          <label className="text-sm font-semibold text-body">
            End time
            <input
              type="time"
              disabled={saving}
              value={state.endTime}
              onChange={(event) => onChange({ ...state, endTime: event.target.value })}
              className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-strong outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-4 rounded-md bg-[var(--clay-50)] px-3 py-2 text-sm font-semibold text-[var(--clay-700)]">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 py-2 text-sm font-bold text-white hover:bg-[var(--clay-700)] disabled:opacity-50"
        >
          {saving ? "Moving…" : "Move this event"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          className="inline-flex min-h-11 items-center rounded-pill border border-border bg-card px-4 py-2 text-sm font-bold text-body hover:bg-page disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

function EventComposer({
  composer,
  kids,
  saving,
  error,
  onChange,
  onSave,
  onDelete,
  onClose,
}: {
  composer: ComposerState;
  kids: readonly UnifiedPlannerKid[];
  saving: boolean;
  error: string | null;
  onChange: (next: ComposerState) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const titleRef = useRef<HTMLInputElement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => titleRef.current?.focus(), []);
  const spansDays = composer.startsOn !== composer.endsOn;
  const selectedNames = kids
    .filter((kid) => composer.childIds.includes(kid.id))
    .map((kid) => kid.name);
  const audienceSummary = selectedNames.length > 0
    ? selectedNames.join(" + ")
    : "Whole family";
  const repeatSummary = composer.repeatWeekly
    ? composer.recurrenceInterval > 1
      ? `Every ${composer.recurrenceInterval} weeks${composer.repeatUntil ? ` until ${formatShortDate(composer.repeatUntil)}` : ""}`
      : `Every week${composer.repeatUntil ? ` until ${formatShortDate(composer.repeatUntil)}` : ""}`
    : "Does not repeat";

  return (
    <ModalShell
      titleId="planner-composer-title"
      onClose={saving ? () => undefined : onClose}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="planner-composer-title" className="font-display text-2xl font-semibold text-strong">
            {composer.editingSeries ? "Edit series" : composer.eventId ? "Edit event" : "Add an event"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {composer.editingSeries
              ? "Changes apply to every event in this series."
              : "Appointments, co-op, trips, and other fixed plans."}
          </p>
        </div>
        <DialogClose onClose={onClose} disabled={saving} />
      </div>

      <label className="mt-5 block text-sm font-semibold text-body">
        What&apos;s happening?
        <input
          ref={titleRef}
          value={composer.title}
          onChange={(event) => onChange({ ...composer, title: event.target.value })}
          autoComplete="off"
          placeholder="Dentist"
          className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-strong outline-none focus:border-brand"
        />
      </label>

      <label className="mt-4 block text-sm font-semibold text-body">
        Date
        <input
          type="date"
          value={composer.startsOn}
          onChange={(event) => {
            const durationDays = Math.max(0, daysBetween(composer.startsOn, composer.endsOn));
            const startsOn = event.target.value;
            onChange({
              ...composer,
              startsOn,
              endsOn: spansDays ? addDaysDateOnly(startsOn, durationDays) : startsOn,
              repeatUntil:
                composer.repeatUntil && composer.repeatUntil < startsOn
                  ? startsOn
                  : composer.repeatUntil,
              recurrenceWeekdays:
                composer.repeatWeekly && composer.recurrenceWeekdays.length === 1
                  ? [weekdayForDate(startsOn)]
                  : composer.recurrenceWeekdays,
            });
          }}
          className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-strong outline-none focus:border-brand"
        />
      </label>

      <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold text-body">
        <input
          type="checkbox"
          checked={composer.allDay}
          onChange={(event) => onChange({ ...composer, allDay: event.target.checked })}
          className="h-[18px] w-[18px] accent-[var(--clay-500)]"
        />
        All day
      </label>

      {composer.allDay ? null : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold text-body">
            Start time
            <input
              type="time"
              value={composer.startTime}
              onChange={(event) => onChange({ ...composer, startTime: event.target.value })}
              className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-strong outline-none focus:border-brand"
            />
          </label>
          <label className="text-sm font-semibold text-body">
            End time
            <input
              type="time"
              value={composer.endTime}
              onChange={(event) => onChange({ ...composer, endTime: event.target.value })}
              className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-strong outline-none focus:border-brand"
            />
          </label>
        </div>
      )}

      <details className="mt-4 rounded-md border border-border-subtle bg-page px-4 py-2">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm text-body">
          <span className="flex min-w-0 flex-col py-1">
            <span className="font-bold">Who and repeat</span>
            <span className="truncate text-xs font-normal text-muted">
              {audienceSummary} · {repeatSummary}
            </span>
          </span>
        </summary>
        <fieldset className="mt-2">
          <legend className="text-sm font-semibold text-body">Who is it for?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={composer.childIds.length === 0}
              onClick={() => onChange({ ...composer, childIds: [] })}
              className={
                composer.childIds.length === 0
                  ? "min-h-9 rounded-pill border border-[var(--clay-200)] bg-brand-soft px-3.5 py-1.5 text-xs font-bold text-[var(--clay-700)]"
                  : "min-h-9 rounded-pill border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-muted hover:border-[var(--clay-200)]"
              }
            >
              Whole family
            </button>
            {kids.map((kid) => (
              <button
                key={kid.id}
                type="button"
                aria-pressed={composer.childIds.includes(kid.id)}
                onClick={() =>
                  onChange({
                    ...composer,
                    childIds: composer.childIds.includes(kid.id)
                      ? composer.childIds.filter((childId) => childId !== kid.id)
                      : [...composer.childIds, kid.id],
                  })
                }
                className={
                  composer.childIds.includes(kid.id)
                    ? "min-h-9 rounded-pill border border-[var(--clay-200)] bg-brand-soft px-3.5 py-1.5 text-xs font-bold text-[var(--clay-700)]"
                    : "min-h-9 rounded-pill border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-muted hover:border-[var(--clay-200)]"
                }
              >
                {kid.name}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="mt-4 block text-sm font-semibold text-body">
          Repeat
          <select
            value={composer.repeatWeekly ? "weekly" : "none"}
            onChange={(event) =>
              onChange({
                ...composer,
                repeatWeekly: event.target.value === "weekly",
                recurrenceWeekdays:
                  event.target.value === "weekly"
                    ? [weekdayForDate(composer.startsOn)]
                    : composer.recurrenceWeekdays,
              })
            }
            className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-strong outline-none focus:border-brand"
          >
            <option value="none">Does not repeat</option>
            <option value="weekly">
              {composer.recurrenceInterval === 1
                ? "Every week"
                : `Every ${composer.recurrenceInterval} weeks`}
            </option>
          </select>
        </label>
        {composer.repeatWeekly ? (
          <label className="mt-4 block text-sm font-semibold text-body">
            Repeats until <span className="font-normal text-muted">(optional)</span>
            <input
              type="date"
              value={composer.repeatUntil}
              min={composer.startsOn}
              onChange={(event) => onChange({ ...composer, repeatUntil: event.target.value })}
              className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-strong outline-none focus:border-brand"
            />
          </label>
        ) : null}
        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold text-body">
          <input
            type="checkbox"
            checked={spansDays}
            onChange={(event) =>
              onChange({
                ...composer,
                endsOn: event.target.checked ? addDaysDateOnly(composer.startsOn, 1) : composer.startsOn,
              })
            }
            className="h-[18px] w-[18px] accent-[var(--clay-500)]"
          />
          Lasts more than one day
        </label>
        {spansDays ? (
          <label className="mt-2 block text-sm font-semibold text-body">
            Last day
            <input
              type="date"
              value={composer.endsOn}
              min={composer.startsOn}
              onChange={(event) => onChange({ ...composer, endsOn: event.target.value })}
              className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-strong outline-none focus:border-brand"
            />
          </label>
        ) : null}
        <label className="mt-4 block pb-2 text-sm font-semibold text-body">
          Note
          <textarea
            value={composer.note}
            onChange={(event) => onChange({ ...composer, note: event.target.value })}
            rows={3}
            className="mt-1.5 w-full rounded-md border border-border bg-card px-3 py-2 text-strong outline-none focus:border-brand"
          />
        </label>
      </details>

      {error ? (
        <p role="alert" className="mt-4 rounded-md bg-[var(--clay-50)] px-3 py-2 text-sm font-semibold text-[var(--clay-700)]">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || composer.title.trim() === ""}
          className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 py-2 text-sm font-bold text-white hover:bg-[var(--clay-700)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving
            ? "Saving…"
            : composer.editingSeries
              ? "Save series"
              : composer.eventId
                ? "Save changes"
                : "Add event"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center rounded-pill border border-border bg-card px-4 py-2 text-sm font-bold text-body hover:bg-page"
        >
          Cancel
        </button>
        {composer.eventId ? (
          <div className="ml-auto flex max-w-sm flex-col items-end gap-1">
            {confirmDelete ? (
              <p className="text-right text-xs font-semibold text-[var(--clay-700)]">
                {composer.editingSeries
                  ? "This removes every event in the series, including past dates."
                  : "This event will be removed from Homa."}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
              disabled={saving}
              className="inline-flex min-h-11 items-center px-2 py-2 text-sm font-bold text-[var(--clay-700)] hover:underline disabled:opacity-50"
            >
              {confirmDelete
                ? composer.editingSeries
                  ? "Delete entire series"
                  : "Delete event"
                : composer.editingSeries
                  ? "Delete series"
                  : "Delete event"}
            </button>
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}

export function UnifiedPlannerView({
  kids,
  plans,
  familyEvents,
  scheduledActivities,
  hoursEntries,
  timeZone,
  now,
  today,
  activeDate,
  view,
  focusChildId,
}: {
  kids: UnifiedPlannerKid[];
  plans: DashboardPlan[];
  familyEvents: FamilyEventRow[];
  scheduledActivities: PlanActivityScheduleRow[];
  hoursEntries: HoursEntry[];
  timeZone: string;
  now: Date;
  today: string;
  activeDate: string;
  view: PlannerViewMode;
  focusChildId: string | null;
}) {
  const router = useRouter();
  const refreshPlanChecks = useCallback(() => router.refresh(), [router]);
  const planChecks = useAuthenticatedPlanChecks({
    plans,
    refresh: refreshPlanChecks,
  });
  const [showFinished, setShowFinished] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<PlannerActivity | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<FamilyEventRow | null>(null);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [moveState, setMoveState] = useState<MoveComposerState | null>(null);
  const [recurringScope, setRecurringScope] = useState<RecurringScopeState | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [recurringActionError, setRecurringActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dayFilter, setDayFilter] = useState({
    routeChildId: focusChildId,
    selectedChildId: focusChildId,
  });
  const dayFilterChildId = dayFilter.routeChildId === focusChildId
    ? dayFilter.selectedChildId
    : focusChildId;
  const setDayFilterChildId = (selectedChildId: string | null) => {
    setDayFilter({ routeChildId: focusChildId, selectedChildId });
  };

  const visibleFocusChildId = view === "day" ? dayFilterChildId : focusChildId;

  const buildBoard = (date: string) =>
    buildCalendarBoard({
      kids: kids.map((kid) => ({ id: kid.id, name: kid.name, avatarUrl: kid.avatar_url })),
      plans,
      scheduledActivities,
      familyEvents,
      hoursEntries: hoursEntries.map((entry) => ({
        childId: entry.childId,
        happenedOn: entry.happenedOn,
        minutes: entry.minutes,
      })),
      now,
      timeZone,
      focusChildId: visibleFocusChildId,
      weekOffsetDays: weekOffsetDaysForDate(today, date),
    });

  const activeBoard = useMemo(
    () => buildBoard(activeDate),
    // The server replaces these arrays on refresh. The active date is
    // the only local navigation key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDate, familyEvents, visibleFocusChildId, hoursEntries, kids, plans, scheduledActivities],
  );
  const activeActivities = activitiesForDate(activeBoard, activeDate);
  const activeEvents = eventsForDate(familyEvents, activeDate, visibleFocusChildId);
  const activeHours = hoursEntries.filter(
    (entry) =>
      entry.happenedOn === activeDate
      && (
        visibleFocusChildId === null
        || entry.childId === null
        || entry.childId === visibleFocusChildId
      ),
  );
  const activeHoursMinutes = activeHours.reduce((sum, entry) => sum + entry.minutes, 0);
  const activityWritable = (activity: PlannerActivity) =>
    planChecks.isWritable(activity.childId, activity.subjectId);
  const resolvedDone = (activity: PlannerActivity) =>
    activityWritable(activity)
      ? planChecks.isChecked(
          activity.childId,
          activity.subjectId,
          activity.checkId,
        )
      : activity.done;
  const unfinished = activeActivities.filter((activity) => !resolvedDone(activity));
  const finished = activeActivities.filter(resolvedDone);

  const weekDays = activeBoard.days.map((day) => {
    const activities = activitiesForDate(activeBoard, day.date);
    return {
      day,
      activities,
      unfinished: activities.filter((activity) => !resolvedDone(activity)),
      events: eventsForDate(familyEvents, day.date, visibleFocusChildId),
    };
  });

  const monthCells = monthCellsForDate(activeDate, today);
  const monthRange = monthGridRangeForDate(activeDate, today);
  const monthBoards = useMemo(() => {
    if (monthCells.length === 0) return [];
    const boards: CalendarBoard[] = [];
    let cursor = weekRangeForDate(monthRange.start).start;
    while (cursor <= monthRange.end) {
      boards.push(buildBoard(cursor));
      cursor = addDaysDateOnly(cursor, 7);
    }
    return boards;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDate, familyEvents, visibleFocusChildId, hoursEntries, kids, plans, scheduledActivities]);
  const monthActivityCounts = new Map<string, number>();
  for (const board of monthBoards) {
    for (const day of board.days) {
      if (day.date < monthRange.start || day.date > monthRange.end) continue;
      monthActivityCounts.set(day.date, activitiesForDate(board, day.date).length);
    }
  }

  function toggleActivity(activity: PlannerActivity) {
    planChecks.toggle({
      childId: activity.childId,
      subjectId: activity.subjectId,
      checkKey: activity.checkId,
      expectedText: activity.text,
    });
  }

  function openNewAppointment() {
    setAddOpen(false);
    setComposerError(null);
    setComposer(createComposer(activeDate, visibleFocusChildId));
  }

  function openEventEditor(event: FamilyEventRow) {
    setSelectedEvent(null);
    setComposerError(null);
    setComposer(editComposer(event));
  }

  function openRecurringScope(action: RecurringScopeState["action"], event: FamilyEventRow) {
    setSelectedEvent(null);
    setRecurringActionError(null);
    setRecurringScope({ action, event });
  }

  async function chooseThisRecurringEvent() {
    if (!recurringScope || saving) return;
    if (recurringScope.action === "move") {
      setMoveState(moveComposer(recurringScope.event));
      setRecurringScope(null);
      return;
    }
    setSaving(true);
    setRecurringActionError(null);
    const result = await deleteFamilyEventOccurrenceAction(
      recurringScope.event.id,
      occurrenceOn(recurringScope.event),
    );
    setSaving(false);
    if (result.error) {
      setRecurringActionError(result.error);
      return;
    }
    setRecurringScope(null);
    router.refresh();
  }

  async function chooseEntireRecurringSeries() {
    if (!recurringScope || saving) return;
    if (recurringScope.action === "move") {
      setComposerError(null);
      setComposer(editComposer(recurringScope.event));
      setRecurringScope(null);
      return;
    }
    setSaving(true);
    setRecurringActionError(null);
    const result = await deleteFamilyEventAction(recurringScope.event.id);
    setSaving(false);
    if (result.error) {
      setRecurringActionError(result.error);
      return;
    }
    setRecurringScope(null);
    router.refresh();
  }

  async function saveMovedOccurrence() {
    if (!moveState || saving) return;
    setSaving(true);
    setRecurringActionError(null);
    const timing: FamilyEventTimingInput = {
      startsOn: moveState.startsOn,
      endsOn: moveState.endsOn,
      startTime: moveState.allDay ? null : moveState.startTime,
      endTime: moveState.allDay ? null : moveState.endTime,
    };
    const result = await moveFamilyEventOccurrenceAction(
      moveState.event.id,
      occurrenceOn(moveState.event),
      timing,
    );
    setSaving(false);
    if (result.error) {
      setRecurringActionError(result.error);
      return;
    }
    setMoveState(null);
    router.refresh();
  }

  async function saveComposer() {
    if (!composer || saving) return;
    setSaving(true);
    setComposerError(null);
    const input: FamilyEventInput = {
      title: composer.title,
      childIds: composer.childIds,
      startsOn: composer.startsOn,
      endsOn: composer.endsOn,
      startTime: composer.allDay ? null : composer.startTime,
      endTime: composer.allDay ? null : composer.endTime,
      note: composer.note || null,
      recurrence: composer.repeatWeekly
        ? {
            frequency: "weekly",
            interval: composer.recurrenceInterval,
            weekdays: composer.recurrenceWeekdays,
            until: composer.repeatUntil || null,
          }
        : null,
    };
    const result = composer.eventId
      ? await updateFamilyEventAction(composer.eventId, input)
      : await createFamilyEventAction(input);
    setSaving(false);
    if (result.error) {
      setComposerError(result.error);
      return;
    }
    setComposer(null);
    router.refresh();
  }

  async function deleteComposerEvent() {
    if (!composer?.eventId || saving) return;
    setSaving(true);
    const result = await deleteFamilyEventAction(composer.eventId);
    setSaving(false);
    if (result.error) {
      setComposerError(result.error);
      return;
    }
    setComposer(null);
    router.refresh();
  }

  const totalWeekActivities = weekDays.reduce((sum, day) => sum + day.unfinished.length, 0);
  const totalWeekEvents = weekDays.reduce((sum, day) => sum + day.events.length, 0);
  const dayStatus = unfinished.length > 0
    ? `${unfinished.length} ${unfinished.length === 1 ? "activity" : "activities"} left`
    : finished.length > 0
      ? "All planned activities are finished"
      : activeEvents.length > 0
        ? `${activeEvents.length} ${activeEvents.length === 1 ? "event" : "events"}`
        : activeHoursMinutes > 0
          ? `${formatMinutesAsHours(activeHoursMinutes)} recorded`
        : "Nothing planned";

  return (
    <div className="mx-auto w-full max-w-[820px]" data-brand-surface="planner">
      {planChecks.getMessage() ? (
        <QuietStatus tone="attention" className="mb-3">
          <div className="flex items-start justify-between gap-3 text-sm">
            <span>{planChecks.getMessage()}</span>
            <button
              type="button"
              onClick={() => planChecks.clearMessage()}
              className="font-semibold text-[var(--homa-highlight-ink)] hover:underline"
            >
              Dismiss
            </button>
          </div>
        </QuietStatus>
      ) : null}
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-strong">
          Planner
        </h1>
        <div className="relative">
          {addOpen ? (
            <button
              type="button"
              aria-label="Close Add menu"
              className="fixed inset-0 z-20 cursor-default"
              onClick={() => setAddOpen(false)}
            />
          ) : null}
          <button
            type="button"
            aria-expanded={addOpen}
            onClick={() => setAddOpen((open) => !open)}
            className="quiet-action quiet-action--primary quiet-action--default relative z-30"
          >
            <Icon name="add" size={20} /> Add to planner
          </button>
          {addOpen ? (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-64 overflow-hidden rounded-lg border border-border-subtle bg-card p-1.5 shadow-lg">
              <button
                type="button"
                onClick={openNewAppointment}
                className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-page"
              >
                <Icon name="time" size={20} className="text-[var(--sky-600)]" />
                <span>
                  <span className="block text-sm font-bold text-strong">Event</span>
                  <span className="block text-xs text-muted">Appointment, co-op, trip, or outing</span>
                </span>
              </button>
              <Link
                href="/app?draft=schedule-week"
                className="flex min-h-12 items-center gap-3 rounded-md px-3 py-2 hover:bg-page"
              >
                <Icon name="learn" size={20} className="text-brand" />
                <span>
                  <span className="block text-sm font-bold text-strong">Plan activity</span>
                  <span className="block text-xs text-muted">Ask Homa to add schoolwork</span>
                </span>
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      <nav className="mt-5 flex border-b border-border-subtle" aria-label="Planner views">
        {VIEW_LABELS.map(({ mode, label }) => (
          <Link
            key={mode}
            href={plannerHref(mode, activeDate)}
            aria-current={view === mode ? "page" : undefined}
            className={
              view === mode
                ? "flex min-h-[46px] flex-1 items-center justify-center border-b-2 border-[var(--homa-midnight-action)] px-2 py-2 text-sm font-bold text-[var(--homa-midnight-action)] sm:flex-none sm:px-5"
                : "flex min-h-[46px] flex-1 items-center justify-center border-b-2 border-transparent px-2 py-2 text-sm font-semibold text-muted hover:bg-page hover:text-body sm:flex-none sm:px-5"
            }
          >
            {label}
          </Link>
        ))}
      </nav>

      {view === "hours" ? (
        <div className="pt-7">
          <div className="mb-1">
            <h2 className="font-display text-2xl font-semibold text-strong">Recorded time</h2>
            <p className="mt-1 text-sm text-muted">
              Homa records the school time you tell her about. Review or correct it here.
            </p>
          </div>
          <HoursView
            kids={kids}
            entries={hoursEntries}
            focusChildId={focusChildId}
            timeZone={timeZone}
            now={now}
            embedded
          />
        </div>
      ) : (
        <>
          <div className="mt-7 flex items-center justify-between gap-3">
            <Link
              href={plannerHref(view, dayNavigationDate(view, activeDate, -1))}
              aria-label={`Previous ${view}`}
              className="grid h-11 w-11 flex-none place-items-center rounded-full border border-border bg-card text-body hover:bg-page"
            >
              <Icon name="back" size={20} />
            </Link>
            <div className="min-w-0 text-center">
              {view === "day" && activeDate === today ? (
                <span className="block text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--clay-700)]">
                  Today
                </span>
              ) : null}
              <h2 className="mt-0.5 font-display text-[clamp(1.35rem,4vw,1.8rem)] font-semibold leading-tight tracking-[-0.02em] text-strong">
                {view === "day" ? formatFullDate(activeDate) : view === "week" ? formatWeek(activeDate) : formatMonth(activeDate)}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {view === "day"
                  ? dayStatus
                  : view === "week"
                    ? `${totalWeekActivities} ${totalWeekActivities === 1 ? "activity" : "activities"} · ${totalWeekEvents} ${totalWeekEvents === 1 ? "event" : "events"}`
                    : "Tap a date to open its day."}
              </p>
            </div>
            <Link
              href={plannerHref(view, dayNavigationDate(view, activeDate, 1))}
              aria-label={`Next ${view}`}
              className="grid h-11 w-11 flex-none place-items-center rounded-full border border-border bg-card text-body hover:bg-page"
            >
              <Icon name="next" size={20} />
            </Link>
          </div>

          {view === "day" ? (
            <>
              {kids.length > 1 ? (
                <div
                  className="mt-4 flex gap-2 overflow-x-auto pb-1"
                  role="group"
                  aria-label="Filter this day by child"
                >
                  <button
                    type="button"
                    aria-pressed={dayFilterChildId === null}
                    onClick={() => setDayFilterChildId(null)}
                    className={
                      dayFilterChildId === null
                        ? "min-h-9 flex-none rounded-pill border border-[var(--clay-200)] bg-brand-soft px-3.5 py-1.5 text-xs font-bold text-[var(--clay-700)]"
                        : "min-h-9 flex-none rounded-pill border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-muted hover:border-[var(--clay-200)]"
                    }
                  >
                    Whole family
                  </button>
                  {kids.map((kid) => (
                    <button
                      key={kid.id}
                      type="button"
                      aria-pressed={dayFilterChildId === kid.id}
                      onClick={() => setDayFilterChildId(kid.id)}
                      className={
                        dayFilterChildId === kid.id
                          ? "min-h-9 flex-none rounded-pill border border-[var(--clay-200)] bg-brand-soft px-3.5 py-1.5 text-xs font-bold text-[var(--clay-700)]"
                          : "min-h-9 flex-none rounded-pill border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-muted hover:border-[var(--clay-200)]"
                      }
                    >
                      {kid.name}
                    </button>
                  ))}
                </div>
              ) : null}
              <section className="mt-5 overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle bg-card shadow-sm" aria-label={formatFullDate(activeDate)}>
              {activeEvents.map((event) => (
                <EventRow
                  key={event.occurrenceKey ?? event.id}
                  event={event}
                  kids={kids}
                  onOpen={() => setSelectedEvent(event)}
                />
              ))}
              {unfinished.map((activity) => (
                <ActivityRow
                  key={activity.key}
                  activity={activity}
                  checked={resolvedDone(activity)}
                  pending={planChecks.isPending(
                    activity.childId,
                    activity.subjectId,
                    activity.checkId,
                  )}
                  writable={activityWritable(activity)}
                  onToggle={() => toggleActivity(activity)}
                  onOpen={() => setSelectedActivity(activity)}
                />
              ))}
              {activeEvents.length === 0 && unfinished.length === 0 && finished.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <h3 className="font-display text-lg font-semibold text-strong">Nothing planned</h3>
                  <p className="mt-1 text-sm text-muted">This day can stay open.</p>
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="mt-4 inline-flex min-h-11 items-center rounded-pill border border-border bg-card px-4 py-2 text-sm font-bold text-body hover:bg-page"
                  >
                    Add to planner
                  </button>
                </div>
              ) : null}
              {finished.length > 0 ? (
                <>
                  <button
                    type="button"
                    aria-expanded={showFinished}
                    onClick={() => setShowFinished((show) => !show)}
                    className="min-h-12 w-full border-t border-border-subtle px-4 py-3 text-left text-sm font-bold text-muted hover:bg-page"
                  >
                    {showFinished ? "Hide" : "Show"} {finished.length} finished{" "}
                    {finished.length === 1 ? "activity" : "activities"}
                  </button>
                  {showFinished
                    ? finished.map((activity) => (
                        <ActivityRow
                          key={activity.key}
                          activity={activity}
                          checked={resolvedDone(activity)}
                          pending={planChecks.isPending(
                            activity.childId,
                            activity.subjectId,
                            activity.checkId,
                          )}
                          writable={activityWritable(activity)}
                          onToggle={() => toggleActivity(activity)}
                          onOpen={() => setSelectedActivity(activity)}
                        />
                      ))
                    : null}
                </>
              ) : null}
              </section>
              <RecordedHours entries={activeHours} showChild={kids.length > 1} />
            </>
          ) : null}

          {view === "week" ? (
            <section className="mt-5 overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle bg-card shadow-sm" aria-label="Week summary">
              {weekDays.map(({ day, unfinished: dayActivities, events }) => {
                const firstEvent = events[0];
                const summaryParts: string[] = [];
                if (dayActivities.length > 0) {
                  summaryParts.push(
                    `${dayActivities.length} ${dayActivities.length === 1 ? "activity" : "activities"}`,
                  );
                }
                if (events.length > 0) {
                  summaryParts.push(
                    `${events.length} ${events.length === 1 ? "event" : "events"}`,
                  );
                }
                const summary = summaryParts.length > 0
                  ? summaryParts.join(" · ")
                  : activitiesForDate(activeBoard, day.date).some(resolvedDone)
                    ? "All activities finished"
                    : "Nothing planned";
                return (
                  <Link
                    key={day.date}
                    href={plannerHref("day", day.date)}
                    className={
                      day.date === today
                        ? "grid min-h-[78px] grid-cols-[7rem_minmax(0,1fr)_1.25rem] items-center gap-3 border-b border-border-subtle bg-[var(--clay-50)] px-4 py-3 last:border-b-0 hover:bg-[var(--clay-100)]"
                        : "grid min-h-[78px] grid-cols-[7rem_minmax(0,1fr)_1.25rem] items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0 hover:bg-page"
                    }
                  >
                    <span className="font-bold text-strong">
                      {dateObject(day.date).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}
                      <span className="block text-xs font-medium text-muted">
                        {formatShortDate(day.date)}{day.date === today ? " · Today" : ""}
                      </span>
                    </span>
                    <span className="text-sm text-body">
                      {summary}
                      {firstEvent ? (
                        <span className="mt-1 block text-xs font-bold text-[var(--sky-600)]">
                          {eventTimeLabel(firstEvent)} · {firstEvent.title}
                        </span>
                      ) : null}
                    </span>
                      <Icon name="next" size={20} className="text-subtle" />
                  </Link>
                );
              })}
            </section>
          ) : null}

          {view === "month" ? (
            <section className="mt-5 rounded-[var(--radius-lg)] border border-border-subtle bg-card p-3 shadow-sm">
              <div className="grid grid-cols-7" aria-hidden="true">
                {WEEKDAY_LABELS.map((label) => (
                  <span key={label} className="py-2 text-center text-[0.68rem] font-bold text-muted">
                    {label}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7" aria-label={`${formatMonth(activeDate)} calendar`}>
                {monthCells.map((cell) => {
                  const activityCount = monthActivityCounts.get(cell.date) ?? 0;
                  const eventCount = eventsForDate(familyEvents, cell.date, focusChildId).length;
                  const plannedCount = activityCount + eventCount;
                  const label = `${formatFullDate(cell.date)}, ${activityCount} ${activityCount === 1 ? "activity" : "activities"}, ${eventCount} ${eventCount === 1 ? "event" : "events"}`;
                  return (
                    <Link
                      key={cell.date}
                      href={plannerHref("day", cell.date)}
                      aria-label={label}
                      className={
                        cell.isToday
                          ? "min-h-[72px] rounded-md border-t border-border-subtle bg-[var(--clay-50)] p-2 text-sm font-bold text-[var(--clay-700)] hover:bg-[var(--clay-100)]"
                          : cell.inMonth
                            ? "min-h-[72px] border-t border-border-subtle p-2 text-sm text-body hover:bg-page"
                            : "min-h-[72px] border-t border-border-subtle p-2 text-sm text-subtle hover:bg-page"
                      }
                    >
                      {cell.dayOfMonth}
                      {plannedCount > 0 ? (
                        <span className="mt-3 block whitespace-nowrap text-[0.6rem] font-bold text-muted">
                          {plannedCount} planned
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      )}

      {selectedActivity ? (
        <ActivityDetails
          activity={selectedActivity}
          done={resolvedDone(selectedActivity)}
          onClose={() => setSelectedActivity(null)}
        />
      ) : null}
      {selectedEvent ? (
        <EventDetails
          event={selectedEvent}
          kids={kids}
          onEdit={() => openEventEditor(selectedEvent)}
          onMove={() => openRecurringScope("move", selectedEvent)}
          onDelete={() => openRecurringScope("delete", selectedEvent)}
          onClose={() => setSelectedEvent(null)}
        />
      ) : null}
      {recurringScope ? (
        <RecurringScopeDialog
          state={recurringScope}
          saving={saving}
          error={recurringActionError}
          onThisEvent={() => void chooseThisRecurringEvent()}
          onEntireSeries={() => void chooseEntireRecurringSeries()}
          onClose={() => setRecurringScope(null)}
        />
      ) : null}
      {moveState ? (
        <MoveEventComposer
          state={moveState}
          saving={saving}
          error={recurringActionError}
          onChange={setMoveState}
          onSave={() => void saveMovedOccurrence()}
          onClose={() => setMoveState(null)}
        />
      ) : null}
      {composer ? (
        <EventComposer
          composer={composer}
          kids={kids}
          saving={saving}
          error={composerError}
          onChange={setComposer}
          onSave={() => void saveComposer()}
          onDelete={() => void deleteComposerEvent()}
          onClose={() => setComposer(null)}
        />
      ) : null}
    </div>
  );
}
