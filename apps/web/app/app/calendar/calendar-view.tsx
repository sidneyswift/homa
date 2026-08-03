"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { FamilyEventRow } from "../../../lib/family-events";
import {
  expandRecurringFamilyEvents,
  familyEventChildIds,
} from "../../../lib/family-events-model";
import { formatMinutesAsHours } from "../../../lib/hours-view";
import type { PlanActivityScheduleRow } from "../../../lib/plan-schedule";
import type { DashboardPlan } from "../../../lib/plan-week";
import {
  bannerWhenLabel,
  buildCalendarBoard,
  formatTimeRange,
  layoutTimedItems,
  minutesToTimeInput,
  movedTimes,
  snapToHalfHour,
  timeToMinutes,
  timedWindow,
  type CalendarActivityItem,
} from "../../../lib/calendar-view";
import {
  createFamilyEventAction,
  deleteFamilyEventAction,
  updateFamilyEventAction,
} from "./actions";
import { setViewContextAction } from "../view-context-actions";
import { VIEW_CONTEXT_FAMILY } from "../../../lib/view-context";
import { useAuthenticatedPlanChecks } from "../../../lib/use-authenticated-plan-checks";
import { avatarTone, KidAvatar } from "../../../components/dashboard/kid-avatar";
import { Icon } from "../../../components/design/Icon";
import { QuietAction } from "../../../components/design/QuietAction";
import { QuietStatus } from "../../../components/design/QuietStatus";

/**
 * /app/calendar (issue #176, CG-03: "calendar and homeschool planner in
 * one"), in the unified shape the co-founders pointed at with the
 * Skylight reference: ONE week grid for the whole family, color coded
 * per kid ("Color coded per kid with general family can include lessons
 * from homa plus events she adds in, appts"), instead of a separate
 * stacked lane per person.
 *
 * Anatomy, top to bottom: prev/today/next week controls; per-kid filter
 * chips (Everyone shows the merged family view); day headers with a
 * filled badge on today; an all-day strip where trips and undated-time
 * events span their real days; a plans strip carrying the checkable
 * scheduled plan activities (the same check-off store /app/planner
 * uses) and each kid's logged-hours chip; then a real time grid where
 * timed events sit at their actual hour, sized by duration, side by
 * side when they overlap, with a clock line across today.
 *
 * Color law: kid tones come from avatarTone (the same position-keyed
 * tones every other surface uses), whole-family items wear a soft
 * stripe of the kids' tones together. No new colors are invented here.
 *
 * Explicitly NOT built here (see the PR body): an optimizer that
 * reshuffles the week around a new appointment. This page only displays.
 */

export interface CalendarKid {
  id: string;
  name: string;
  avatar_url: string | null;
}

/** Pixels per hour on the time grid. */
const HOUR_PX = 48;
const GRID_COLUMNS = "3.5rem repeat(7, minmax(0, 1fr))";

/** Whole-family items wear the kids' own tones woven together, the same
 * trick the reference uses for shared events, built strictly from the
 * existing avatarTone palette. */
function familyStripeBackground(kidCount: number): string {
  const toneCount = Math.max(2, Math.min(kidCount, 4));
  const stops = Array.from({ length: toneCount }, (_, index) => {
    const [bg] = avatarTone(index);
    return `${bg} ${index * 14}px ${(index + 1) * 14}px`;
  }).join(", ");
  return `repeating-linear-gradient(135deg, ${stops})`;
}

interface AllDayBanner {
  id: string;
  title: string;
  startIdx: number;
  endIdx: number;
  kidIndex: number | null;
  note: string | null;
  dateLabel: string;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
}

/** What the tapped-event detail card shows, plus everything the Edit
 * button needs to prefill the composer. */
interface EventDetails {
  id: string;
  title: string;
  /** "Thu 30, 2 to 3 PM" or "Sat 1 to Sun 2, all day". */
  whenLabel: string;
  /** The kid's roster index, or null for a whole-family event. */
  kidIndex: number | null;
  note: string | null;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
}

/**
 * A timed block mid-drag. `moved` stays false until the pointer clears
 * the threshold, which is what keeps a plain tap (open the details) from
 * being read as a zero-pixel drag.
 */
interface DragState {
  id: string;
  /** Where the block started, so a cancelled drag restores exactly. */
  originDate: string;
  originStartMin: number;
  originEndMin: number;
  pointerStartY: number;
  moved: boolean;
  /** Live target while dragging. */
  date: string;
  startMin: number;
  endMin: number;
}

/** The add/edit form's working copy. eventId null means creating. */
interface ComposerState {
  eventId: string | null;
  title: string;
  /** "" means the whole family. */
  childId: string;
  startsOn: string;
  endsOn: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  note: string;
}

/** Greedy row assignment so overlapping all-day banners stack instead of
 * colliding (camping trip under a same-weekend birthday). */
function assignBannerTracks(banners: readonly AllDayBanner[]): AllDayBanner[][] {
  const sorted = [...banners].sort((a, b) => a.startIdx - b.startIdx || b.endIdx - a.endIdx);
  const tracks: { end: number; members: AllDayBanner[] }[] = [];
  for (const banner of sorted) {
    const track = tracks.find((candidate) => candidate.end < banner.startIdx);
    if (track) {
      track.members.push(banner);
      track.end = banner.endIdx;
    } else {
      tracks.push({ end: banner.endIdx, members: [banner] });
    }
  }
  return tracks.map((track) => track.members);
}

function hourLabel(hour: number): string {
  const hour12 = ((hour + 11) % 12) + 1;
  return `${hour12} ${hour < 12 ? "AM" : "PM"}`;
}

/** Minutes since midnight right now, on the family's own clock. */
function clockMinutesIn(timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return (read("hour") % 24) * 60 + read("minute");
}

function ActivityCard({
  item,
  tone,
  kid,
  checked,
  pending,
  writable,
  onToggle,
}: {
  item: CalendarActivityItem;
  tone: readonly [string, string];
  kid: { name: string; index: number; avatarUrl: string | null } | null;
  checked: boolean;
  pending: boolean;
  writable: boolean;
  onToggle: () => void;
}) {
  const [bg, ink] = tone;

  return (
    <div className="rounded-[var(--homa-radius-control)] border border-[color-mix(in_srgb,var(--homa-control-boundary)_60%,transparent)] p-1.5" style={{ background: bg }}>
      <div className="flex items-center justify-between gap-1">
        <span
          className="text-[0.55rem] font-bold uppercase tracking-[0.05em]"
          style={{ color: ink }}
        >
          {item.subjectLabel}
        </span>
        {kid ? (
          <KidAvatar name={kid.name} index={kid.index} avatarUrl={kid.avatarUrl} size={14} />
        ) : null}
      </div>
      <label className="mt-0.5 flex cursor-pointer items-start gap-1.5">
        <input
          type="checkbox"
          checked={checked}
          disabled={!writable}
          aria-busy={pending}
          onChange={onToggle}
          className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 accent-[var(--homa-constructive-ink)]"
        />
        <span
          className={
            checked
              ? "text-[0.7rem] leading-snug text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))] line-through"
              : "text-[0.7rem] leading-snug text-[color:var(--homa-ink)]"
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
  familyEvents,
  scheduledActivities,
  hoursEntries,
  timeZone,
  now,
  focusChildId,
  weekOffset,
  familyName,
}: {
  /** The FULL family roster, always (tone/avatar keys off list position). */
  kids: CalendarKid[];
  plans: DashboardPlan[];
  familyEvents: FamilyEventRow[];
  scheduledActivities: PlanActivityScheduleRow[];
  hoursEntries: { childId: string | null; happenedOn: string; minutes: number }[];
  timeZone: string;
  now: Date;
  focusChildId: string | null;
  /** Which week is showing, in whole weeks from this one (0 = this
   * week). Drives the Prev/Next/Today controls; page.tsx reads the
   * matching `?week=` search param and threads the same number into
   * buildCalendarBoard. */
  weekOffset: number;
  familyName: string | null;
}) {
  // The chips filter is instant and local; the view-context switcher's
  // choice arrives as the initial selection.
  const [selectedKidId, setSelectedKidId] = useState<string | null>(focusChildId);

  /**
   * One "who am I viewing" answer, not two (issue #176): the chips write
   * the same view-context the floating switcher reads, so the two can
   * never disagree about whether this is the whole family or one kid.
   * Local state moves first so filtering stays instant; the cookie write
   * follows and re-renders the rest of /app behind it.
   */
  function selectKid(kidId: string | null) {
    setSelectedKidId(kidId);
    void setViewContextAction(kidId ?? VIEW_CONTEXT_FAMILY);
  }
  // The event a parent tapped, shown in a small detail card ("the
  // calendar is look-but-do-not-touch" was the veteran-mom review's top
  // fix). Null when nothing is open.
  const [details, setDetails] = useState<EventDetails | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const detailsCloseRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!details) return;
    // Keyboard focus follows the dialog in (a designer-mom review catch:
    // focus was staying on the tapped block behind the scrim).
    detailsCloseRef.current?.focus();
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") setDetails(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [details]);

  // The add/edit composer (touch-and-do round: tap an empty slot, or
  // Edit from the detail card). Saving goes through the server actions,
  // then router.refresh() re-reads the week from the source of truth.
  const router = useRouter();
  const refreshPlanChecks = useCallback(() => router.refresh(), [router]);
  const planChecks = useAuthenticatedPlanChecks({
    plans,
    refresh: refreshPlanChecks,
  });
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const composerTitleRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!composer) return;
    composerTitleRef.current?.focus();
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") setComposer(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [composer]);

  function openComposerForSlot(date: string, minutes: number) {
    const start = snapToHalfHour(minutes);
    setComposerError(null);
    setComposer({
      eventId: null,
      title: "",
      childId: selectedKidId ?? "",
      startsOn: date,
      endsOn: date,
      allDay: false,
      startTime: minutesToTimeInput(start),
      endTime: minutesToTimeInput(Math.min(start + 60, 23 * 60 + 59)),
      note: "",
    });
  }

  function openComposerForEvent(event: EventDetails) {
    setComposerError(null);
    setDetails(null);
    setComposer({
      eventId: event.id,
      title: event.title,
      childId: event.kidIndex === null ? "" : (kids[event.kidIndex]?.id ?? ""),
      startsOn: event.startsOn,
      endsOn: event.endsOn,
      allDay: event.startTime === null,
      startTime: event.startTime ?? "09:00",
      endTime: event.endTime ?? "10:00",
      note: event.note ?? "",
    });
  }

  async function saveComposer() {
    if (!composer || saving) return;
    setSaving(true);
    setComposerError(null);
    const payload = {
      title: composer.title,
      childId: composer.childId || null,
      startsOn: composer.startsOn,
      endsOn: composer.allDay ? composer.endsOn : composer.startsOn,
      startTime: composer.allDay ? null : composer.startTime,
      endTime: composer.allDay ? null : composer.endTime,
      note: composer.note || null,
    };
    const result = composer.eventId
      ? await updateFamilyEventAction(composer.eventId, payload)
      : await createFamilyEventAction(payload);
    setSaving(false);
    if (result.error) {
      setComposerError(result.error);
      return;
    }
    setComposer(null);
    router.refresh();
  }

  /**
   * Drag to reschedule (the judges' second "next wow", now that the
   * update action from the touch-and-do round exists). Pointer events,
   * not HTML5 drag-and-drop: they work the same under a finger on the
   * kitchen tablet as under a mouse, and they give us the live preview.
   * The window listeners read geometry through a ref so they subscribe
   * once per drag instead of on every pointer move.
   */
  const [drag, setDrag] = useState<DragState | null>(null);
  // A failed drag write's error. Its own state, never composerError:
  // both dialogs that render composerError are closed by the time a
  // drag ends, so an error parked there was invisible and the block
  // just snapped back unexplained (issue #256). This one renders as a
  // notice right above the grid.
  const [dragError, setDragError] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  // A finished drag must not also open the details card on the click
  // that follows pointerup.
  const suppressClickRef = useRef(false);
  const geometryRef = useRef({ startHour: 8, endHour: 17 });

  // Attached synchronously by the block's own pointerdown, never from an
  // effect keyed on drag state: an effect subscribes only after React
  // commits, which drops the first pointermove of every drag.
  const detachDragRef = useRef<(() => void) | null>(null);

  function beginDrag(state: DragState) {
    dragRef.current = state;
    setDrag(state);
    setDragError(null);

    function onPointerMove(moveEvent: PointerEvent) {
      const state = dragRef.current;
      if (!state) return;
      const deltaY = moveEvent.clientY - state.pointerStartY;
      // Whichever day column the pointer is over now, so a drag can move
      // an appointment to Thursday, not just to a different hour.
      const overDate =
        (
          document
            .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
            ?.closest("[data-day-date]") as HTMLElement | null
        )?.dataset.dayDate ?? state.date;
      const moved = state.moved || Math.abs(deltaY) > 4 || overDate !== state.originDate;
      if (!moved) return;
      const times = movedTimes({
        startMin: state.originStartMin,
        endMin: state.originEndMin,
        deltaMinutes: (deltaY / HOUR_PX) * 60,
        windowStartHour: geometryRef.current.startHour,
        windowEndHour: geometryRef.current.endHour,
      });
      const next: DragState = { ...state, moved: true, date: overDate, ...times };
      dragRef.current = next;
      setDrag(next);
    }

    async function onPointerUp() {
      detach();
      const state = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!state?.moved) return;
      suppressClickRef.current = true;
      // Nothing actually changed (dragged and returned): skip the write.
      if (
        state.date === state.originDate &&
        state.startMin === state.originStartMin &&
        state.endMin === state.originEndMin
      ) {
        return;
      }
      const source = familyEvents.find((candidate) => candidate.id === state.id);
      if (!source) return;
      const result = await updateFamilyEventAction(state.id, {
        title: source.title,
        childId: source.childId,
        startsOn: state.date,
        endsOn: state.date,
        startTime: minutesToTimeInput(state.startMin),
        endTime: minutesToTimeInput(state.endMin),
        note: source.note,
      });
      if (result.error) setDragError(result.error);
      router.refresh();
    }

    function detach() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      detachDragRef.current = null;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    detachDragRef.current = detach;
  }

  // Unmounting mid-drag (she navigates away holding the pointer) must not
  // leave window listeners behind.
  useEffect(() => () => detachDragRef.current?.(), []);

  async function deleteDetailsEvent() {
    if (!details || saving) return;
    setSaving(true);
    const result = await deleteFamilyEventAction(details.id);
    setSaving(false);
    if (result.error) {
      setComposerError(result.error);
      setConfirmDelete(false);
      return;
    }
    setDetails(null);
    router.refresh();
  }
  // The clock line's minute is read on the client only (the server
  // render never disagrees with the browser about what time it is),
  // painted on the next frame, then kept honest all day by a one-minute
  // tick, the way a wall calendar's line creeps down the morning.
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNowMinutes(clockMinutesIn(timeZone));
    const frame = requestAnimationFrame(update);
    const tick = setInterval(update, 60_000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(tick);
    };
  }, [timeZone]);

  const board = buildCalendarBoard({
    kids: kids.map((kid) => ({ id: kid.id, name: kid.name, avatarUrl: kid.avatar_url })),
    plans,
    scheduledActivities,
    familyEvents,
    hoursEntries,
    now,
    timeZone,
    focusChildId: selectedKidId,
    weekOffsetDays: weekOffset * 7,
  });

  const days = board.days;
  const weekDates = days.map((day) => day.date);
  const firstDate = weekDates[0];
  const lastDate = weekDates[weekDates.length - 1];
  const kidIndexById = new Map(kids.map((kid, index) => [kid.id, index]));

  const first = days[0];
  const last = days[days.length - 1];
  const spanLabel =
    first.month === last.month
      ? `${monthName(first.month)} ${first.dayOfMonth} to ${last.dayOfMonth}`
      : `${monthName(first.month)} ${first.dayOfMonth} to ${monthName(last.month)} ${last.dayOfMonth}`;

  const selectedKid = selectedKidId ? kids.find((kid) => kid.id === selectedKidId) : undefined;

  // Events straight from the rows: the week clip and the kid filter are
  // the only judgments here, everything else is placement.
  const visibleEvents = expandRecurringFamilyEvents(familyEvents, firstDate, lastDate).filter(
    (event) => {
      const childIds = familyEventChildIds(event);
      return selectedKidId === null || childIds.length === 0 || childIds.includes(selectedKidId);
    },
  );
  const eventKidIndex = (event: FamilyEventRow): number | null => {
    const childIds = familyEventChildIds(event);
    return childIds.length === 1 ? (kidIndexById.get(childIds[0]) ?? null) : null;
  };
  const allDayBanners: AllDayBanner[] = visibleEvents
    .filter((event) => event.startTime === null || event.startsOn !== event.endsOn)
    .map((event) => ({
      id: event.id,
      title: event.title,
      note: event.note,
      startIdx: event.startsOn <= firstDate ? 0 : weekDates.indexOf(event.startsOn),
      endIdx: event.endsOn >= lastDate ? 6 : weekDates.indexOf(event.endsOn),
      kidIndex: eventKidIndex(event),
      dateLabel: "",
      startsOn: event.startsOn,
      endsOn: event.endsOn,
      startTime: event.startTime,
      endTime: event.endTime,
    }))
    .filter((banner) => banner.startIdx !== -1 && banner.endIdx !== -1)
    .map((banner) => ({
      ...banner,
      // A timed multi-day event's window sits on its FIRST day only
      // (migration 20260726130000), so the label carries that time range
      // instead of an "all day" it never was (issue #256).
      dateLabel: bannerWhenLabel({
        startDayLabel: `${days[banner.startIdx].label} ${days[banner.startIdx].dayOfMonth}`,
        endDayLabel: `${days[banner.endIdx].label} ${days[banner.endIdx].dayOfMonth}`,
        spansMultipleCells: banner.startIdx !== banner.endIdx,
        firstDayInView: banner.startsOn >= firstDate,
        startTime: banner.startTime,
        endTime: banner.endTime,
      }),
    }));
  const bannerTracks = assignBannerTracks(allDayBanners);

  const timedEvents = visibleEvents.filter(
    (event) => event.startTime !== null && event.startsOn === event.endsOn,
  );
  const timedSpans = timedEvents.map((event) => {
    const startMin = timeToMinutes(event.startTime) ?? 0;
    const endMin = timeToMinutes(event.endTime) ?? startMin + 45;
    return {
      id: event.id,
      date: event.startsOn,
      title: event.title,
      note: event.note,
      timeLabel: formatTimeRange(event.startTime ?? "", event.endTime),
      startLabel: formatTimeRange(event.startTime ?? "", null),
      kidIndex: eventKidIndex(event),
      startMin,
      endMin: Math.max(endMin, startMin + 20),
      rawStartTime: event.startTime,
      rawEndTime: event.endTime,
    };
  });
  const hourWindow = timedWindow(timedSpans);
  const gridHeight = (hourWindow.endHour - hourWindow.startHour) * HOUR_PX;
  // The drag listeners read the live window through a ref, so they never
  // need to re-subscribe when the grid grows to fit a late event.
  const windowStartHour = hourWindow.startHour;
  const windowEndHour = hourWindow.endHour;
  useEffect(() => {
    geometryRef.current = { startHour: windowStartHour, endHour: windowEndHour };
  }, [windowStartHour, windowEndHour]);
  const timedByDate = new Map(
    weekDates.map((date) => [
      date,
      layoutTimedItems(timedSpans.filter((span) => span.date === date)),
    ]),
  );

  // Date-only school work (scheduled activities, logged hours) rides in
  // the plans strip: it has a day but no clock time on purpose.
  const plansStripByDay = weekDates.map((date, dayIndex) => {
    const cards: { item: CalendarActivityItem; kidIndex: number }[] = [];
    const hours: { kidIndex: number; minutes: number }[] = [];
    for (const lane of board.kidLanes) {
      const day = lane.days[dayIndex];
      for (const item of day.activities) cards.push({ item, kidIndex: lane.kidIndex });
      if (day.hoursMinutes > 0) hours.push({ kidIndex: lane.kidIndex, minutes: day.hoursMinutes });
    }
    return { date, cards, hours };
  });
  const hasPlansStrip = plansStripByDay.some((day) => day.cards.length > 0 || day.hours.length > 0);
  const weekIsEmpty = visibleEvents.length === 0 && !hasPlansStrip;

  const stripeBackground = familyStripeBackground(kids.length);

  return (
    <div data-brand-surface="calendar" data-brand-fixture="quiet-authority-v1">
      {planChecks.getMessage() ? (
        <QuietStatus tone="attention" className="mb-3">
          <div className="flex items-start justify-between gap-3 text-sm">
          <span>{planChecks.getMessage()}</span>
          <button
            type="button"
            onClick={() => planChecks.clearMessage()}
            className="font-semibold text-[color:var(--homa-highlight-ink)] hover:underline"
          >
            Dismiss
          </button>
          </div>
        </QuietStatus>
      ) : null}
      {/* One compact header row (a veteran mom's request: the afternoon
          belongs above the fold, not a tall title stack) */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[1.45rem] font-semibold leading-tight tracking-[-0.015em] text-[color:var(--homa-ink)]">
            {selectedKid ? `${selectedKid.name}'s calendar` : (familyName ?? "Your calendar")}
          </h1>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
            {weekLabel(weekOffset)} {"·"} {spanLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={calendarWeekHref(weekOffset - 1)}
            aria-label="Previous week"
            className="flex min-h-10 min-w-10 items-center justify-center rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] text-[color:var(--homa-ink)] transition-colors hover:border-[var(--homa-midnight-action)]"
          >
            <Icon name="back" size={20} />
          </Link>
          <Link
            href={calendarWeekHref(weekOffset + 1)}
            aria-label="Next week"
            className="flex min-h-10 min-w-10 items-center justify-center rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] text-[color:var(--homa-ink)] transition-colors hover:border-[var(--homa-midnight-action)]"
          >
            <Icon name="next" size={20} />
          </Link>
          {weekOffset !== 0 ? (
            <Link
              href={calendarWeekHref(0)}
              className="rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))] transition-colors hover:border-[var(--homa-midnight-action)]"
            >
              Today
            </Link>
          ) : null}
          <QuietAction
            kind="primary"
            size="default"
            aria-haspopup="dialog"
            onClick={() =>
              openComposerForSlot(
                (days.find((day) => day.isToday) ?? days[0]).date,
                9 * 60,
              )
            }
            icon={<Icon name="add" size={20} />}
            className="px-4 text-sm"
          >
            Add event
          </QuietAction>
          <QuietAction
            href="/app/planner"
            kind="secondary"
            size="default"
            className="px-4 text-sm"
          >
            Open the week planner
          </QuietAction>
        </div>
      </header>

      {kids.length > 1 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => selectKid(null)}
            aria-pressed={selectedKidId === null}
            className={
              selectedKidId === null
                ? "quiet-filter quiet-filter--active"
                : "quiet-filter"
            }
          >
            Everyone
          </button>
          {kids.map((kid, index) => {
            const [bg, ink] = avatarTone(index);
            const active = selectedKidId === kid.id;
            return (
              <button
                key={kid.id}
                type="button"
                onClick={() => selectKid(active ? null : kid.id)}
                aria-pressed={active}
                className={
                  active
                    ? "quiet-filter quiet-filter--active flex items-center gap-2"
                    : "quiet-filter flex items-center gap-2"
                }
                style={active ? { background: bg, color: ink, borderColor: ink } : undefined}
              >
                <KidAvatar name={kid.name} index={index} avatarUrl={kid.avatar_url} size={20} />
                {kid.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {kids.length === 0 ? (
        <div className="quiet-frame quiet-frame--paper mt-6 p-8 text-center">
          <p className="font-display text-xl font-semibold text-[color:var(--homa-ink)]">
            Add a child first to see their calendar.
          </p>
        </div>
      ) : (
        <>
        {weekIsEmpty ? (
          // Two real doors, not just prose (issue #176's adoption gap:
          // almost no family has put their week on real dates yet, and
          // nothing on real dates means nothing for Homa to reshuffle).
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
              Nothing on the calendar this week yet.
            </p>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() =>
                openComposerForSlot((days.find((day) => day.isToday) ?? days[0]).date, 9 * 60)
              }
              className="rounded-[var(--homa-radius-control)] border border-[var(--homa-midnight-action)] px-4 py-1.5 text-sm font-semibold text-[color:var(--homa-ink)] transition-colors hover:bg-[var(--homa-info-tint)]"
            >
              Add an appointment
            </button>
            <Link
              href="/app?draft=schedule-week"
              className="rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-4 py-1.5 text-sm font-semibold text-[color:var(--homa-ink)] transition-colors hover:border-[var(--homa-midnight-action)]"
            >
              Put school on real days
            </Link>
          </div>
        ) : null}
        {dragError ? (
          // The block already snapped back to where it was; this says
          // why, in the grid's own line of sight (issue #256). Existing
          // danger tokens only, no new colors.
          <div
            role="status"
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--homa-radius-control)] border px-4 py-2.5 text-sm"
            style={{
              borderColor: "var(--homa-error-ink)",
              background: "var(--homa-error-tint)",
              color: "var(--homa-error-ink)",
            }}
          >
            <span className="font-semibold">{dragError}</span>
            <button
              type="button"
              onClick={() => setDragError(null)}
              className="rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 py-1 text-xs font-semibold text-[color:var(--homa-ink)] transition-colors hover:border-[var(--homa-midnight-action)]"
            >
              Dismiss
            </button>
          </div>
        ) : null}
        <section className="quiet-frame quiet-frame--paper mt-4 overflow-x-auto p-0">
          <div className="min-w-[860px]">
            {/* Day headers */}
            <div className="grid" style={{ gridTemplateColumns: GRID_COLUMNS }}>
              <div />
              {days.map((day) => (
                <div
                  key={day.date}
                  className="flex items-baseline gap-1.5 border-l border-[var(--homa-control-boundary)] px-2 pb-1.5 pt-2.5"
                >
                  <span className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
                    {day.label}
                  </span>
                  {day.isToday ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--homa-midnight-action)] text-[0.78rem] font-bold text-[var(--homa-paper)]">
                      {day.dayOfMonth}
                    </span>
                  ) : (
                    <span className="font-display text-[1.05rem] font-semibold text-[color:var(--homa-ink)]">
                      {day.dayOfMonth}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* All-day banners: trips and family days span their real days */}
            {bannerTracks.map((track, trackIndex) => (
              <div
                key={trackIndex}
                className="grid pb-1"
                style={{ gridTemplateColumns: GRID_COLUMNS }}
              >
                <div className="flex items-center justify-end pr-1.5">
                  {trackIndex === 0 ? (
                    <span className="text-[0.55rem] font-bold uppercase tracking-[0.06em] text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
                      All day
                    </span>
                  ) : null}
                </div>
                {track.map((banner) => {
                  const kid = banner.kidIndex === null ? null : kids[banner.kidIndex];
                  const tone = banner.kidIndex === null ? null : avatarTone(banner.kidIndex);
                  return (
                    <button
                      key={banner.id}
                      type="button"
                      aria-haspopup="dialog"
                      aria-label={`${banner.title}, ${banner.dateLabel}`}
                      onClick={() => {
                        setConfirmDelete(false);
                        setDetails({
                          id: banner.id,
                          title: banner.title,
                          whenLabel: banner.dateLabel,
                          kidIndex: banner.kidIndex,
                          note: banner.note,
                          startsOn: banner.startsOn,
                          endsOn: banner.endsOn,
                          startTime: banner.startTime,
                          endTime: banner.endTime,
                        });
                      }}
                      className="mx-1 flex cursor-pointer items-center justify-between gap-1.5 rounded-[var(--homa-radius-control)] px-2 py-1 text-left transition-shadow hover:shadow-sm"
                      style={{
                        gridColumn: `${banner.startIdx + 2} / ${banner.endIdx + 3}`,
                        gridRow: 1,
                        background: tone ? tone[0] : stripeBackground,
                      }}
                    >
                      <span
                        className="truncate text-[0.7rem] font-bold"
                        style={{ color: tone ? tone[1] : "var(--homa-ink)" }}
                      >
                        {banner.title}
                      </span>
                      {kid ? (
                        <KidAvatar
                          name={kid.name}
                          index={banner.kidIndex!}
                          avatarUrl={kid.avatar_url}
                          size={14}
                        />
                      ) : (
                        <span className="flex shrink-0">
                          {kids.slice(0, 3).map((familyKid, kidIndex) => (
                            <span key={familyKid.id} className={kidIndex > 0 ? "-ml-1" : ""}>
                              <KidAvatar
                                name={familyKid.name}
                                index={kidIndex}
                                avatarUrl={familyKid.avatar_url}
                                size={14}
                              />
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* The plans strip: scheduled activities (checkable) and each
                kid's logged hours, date-true but clock-free on purpose */}
            {hasPlansStrip ? (
              <div
                className="grid border-t border-[var(--homa-control-boundary)]"
                style={{ gridTemplateColumns: GRID_COLUMNS }}
              >
                <div className="flex justify-end pr-1.5 pt-1.5">
                  <span className="text-[0.55rem] font-bold uppercase tracking-[0.06em] text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
                    School
                  </span>
                </div>
                {plansStripByDay.map((day) => (
                  <div
                    key={day.date}
                    className="flex flex-col gap-1 border-l border-[var(--homa-control-boundary)] p-1"
                  >
                    {day.cards.map(({ item, kidIndex }) => {
                      const kid = kids[kidIndex];
                      const writable = planChecks.isWritable(
                        item.childId,
                        item.subjectId,
                      );
                      return (
                        <ActivityCard
                          key={item.key}
                          item={item}
                          tone={avatarTone(kidIndex)}
                          kid={
                            kid && selectedKidId === null
                              ? { name: kid.name, index: kidIndex, avatarUrl: kid.avatar_url }
                              : null
                          }
                          writable={writable}
                          checked={
                            writable
                              ? planChecks.isChecked(
                                  item.childId,
                                  item.subjectId,
                                  item.checkId,
                                )
                              : item.done
                          }
                          pending={planChecks.isPending(
                            item.childId,
                            item.subjectId,
                            item.checkId,
                          )}
                          onToggle={() =>
                            planChecks.toggle({
                              childId: item.childId,
                              subjectId: item.subjectId,
                              checkKey: item.checkId,
                              expectedText: item.text,
                            })
                          }
                        />
                      );
                    })}
                    {day.hours.map(({ kidIndex, minutes }) => {
                      const [bg, ink] = avatarTone(kidIndex);
                      return (
                        <span
                          key={kidIndex}
                          className="inline-flex w-fit items-center gap-1 rounded-[var(--homa-radius-control)] px-2 py-0.5 text-[0.6rem] font-bold"
                          style={{ background: bg, color: ink }}
                        >
                          {formatMinutesAsHours(minutes)} logged
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : null}

            {/* The time grid: events at their real hour, sized by length */}
            <div
              className="grid border-t border-[var(--homa-control-boundary)]"
              style={{ gridTemplateColumns: GRID_COLUMNS }}
            >
              <div className="relative" style={{ height: gridHeight }}>
                {Array.from(
                  { length: hourWindow.endHour - hourWindow.startHour },
                  (_, index) => hourWindow.startHour + index,
                ).map((hour) => (
                  <span
                    key={hour}
                    className="absolute right-1.5 text-[0.6rem] font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]"
                    style={{ top: (hour - hourWindow.startHour) * HOUR_PX + 2 }}
                  >
                    {hourLabel(hour)}
                  </span>
                ))}
              </div>
              {days.map((day) => {
                const blocks = timedByDate.get(day.date) ?? [];
                // One clock line across the WHOLE week whenever today is
                // in view: a faint hairline on the other days, the solid
                // coral segment with its dot only on today, so the line
                // never dead-ends mid-grid at a column border.
                const nowLineTop =
                  days.some((cell) => cell.isToday) &&
                  nowMinutes !== null &&
                  nowMinutes >= hourWindow.startHour * 60 &&
                  nowMinutes <= hourWindow.endHour * 60
                    ? ((nowMinutes - hourWindow.startHour * 60) / 60) * HOUR_PX
                    : null;
                return (
                  // Not a button on purpose: real buttons (the event
                  // blocks) live inside, and nested buttons are invalid.
                  // Keyboard users get the header's Add event button for
                  // the same action; this click is the mouse/touch
                  // shortcut a wall calendar invites ("tap an empty slot
                  // to add something", the veteran mom's next wow).
                  <div
                    key={day.date}
                    data-day-date={day.date}
                    className="relative cursor-pointer border-l border-[var(--homa-control-boundary)]"
                    style={{ height: gridHeight }}
                    onClick={(clickEvent) => {
                      const target = clickEvent.target as HTMLElement;
                      if (target.closest("button")) return;
                      // A drag that ended over empty grid must not also
                      // open the new-event composer.
                      if (suppressClickRef.current) {
                        suppressClickRef.current = false;
                        return;
                      }
                      const rect = clickEvent.currentTarget.getBoundingClientRect();
                      const minutes =
                        hourWindow.startHour * 60 +
                        ((clickEvent.clientY - rect.top) / HOUR_PX) * 60;
                      openComposerForSlot(day.date, minutes);
                    }}
                  >
                    {Array.from(
                      { length: hourWindow.endHour - hourWindow.startHour },
                      (_, index) => index,
                    ).map((row) => (
                      <div
                        key={row}
                        className="absolute inset-x-0 border-t border-[color-mix(in_srgb,var(--homa-control-boundary)_60%,transparent)]"
                        style={{ top: row * HOUR_PX }}
                        aria-hidden="true"
                      />
                    ))}
                    {/* The block being dragged leaves its old slot and
                        rides the pointer as a preview below. */}
                    {blocks
                      .filter((block) => !(drag?.moved && drag.id === block.id))
                      .map((block) => {
                      const kid = block.kidIndex === null ? null : kids[block.kidIndex];
                      const tone = block.kidIndex === null ? null : avatarTone(block.kidIndex);
                      const top = ((block.startMin - hourWindow.startHour * 60) / 60) * HOUR_PX;
                      const height = Math.max(
                        24,
                        ((block.endMin - block.startMin) / 60) * HOUR_PX - 2,
                      );
                      const dayCell = days.find((cell) => cell.date === block.date);
                      return (
                        <button
                          key={block.id}
                          type="button"
                          aria-haspopup="dialog"
                          aria-label={`${block.title}, ${block.timeLabel}`}
                          onPointerDown={(pointerEvent) => {
                            if (pointerEvent.button !== 0) return;
                            beginDrag({
                              id: block.id,
                              originDate: block.date,
                              originStartMin: block.startMin,
                              originEndMin: block.endMin,
                              pointerStartY: pointerEvent.clientY,
                              moved: false,
                              date: block.date,
                              startMin: block.startMin,
                              endMin: block.endMin,
                            });
                          }}
                          onClick={() => {
                            // A drag just ended on this block: that
                            // gesture was a move, not a tap.
                            if (suppressClickRef.current) {
                              suppressClickRef.current = false;
                              return;
                            }
                            setConfirmDelete(false);
                            setDetails({
                              id: block.id,
                              title: block.title,
                              whenLabel: dayCell
                                ? `${dayCell.label} ${dayCell.dayOfMonth}, ${block.timeLabel}`
                                : block.timeLabel,
                              kidIndex: block.kidIndex,
                              note: block.note,
                              startsOn: block.date,
                              endsOn: block.date,
                              startTime: block.rawStartTime,
                              endTime: block.rawEndTime,
                            });
                          }}
                          className="absolute cursor-pointer overflow-hidden rounded-[var(--homa-radius-control)] border border-[color-mix(in_srgb,var(--homa-control-boundary)_60%,transparent)] px-2 py-0.5 text-left shadow-sm transition-shadow hover:shadow-md"
                          style={{
                            top,
                            height,
                            left: `calc(${(block.slot / block.slotCount) * 100}% + 3px)`,
                            width: `calc(${(1 / block.slotCount) * 100}% - 6px)`,
                            background: tone ? tone[0] : stripeBackground,
                          }}
                        >
                          {/* The kid's disc rides every block (three kids
                              make two pastels a memory quiz). In squeezed
                              half-width overlap columns it drops to the
                              bottom corner so the title keeps the whole
                              first line. */}
                          {kid ? (
                            <span
                              className={
                                block.slotCount > 1
                                  ? "absolute bottom-1 right-1"
                                  : "absolute right-1 top-1"
                              }
                            >
                              <KidAvatar
                                name={kid.name}
                                index={block.kidIndex!}
                                avatarUrl={kid.avatar_url}
                                size={14}
                              />
                            </span>
                          ) : (
                            <span
                              className={
                                block.slotCount > 1
                                  ? "absolute bottom-1 right-1 flex"
                                  : "absolute right-1 top-1 flex"
                              }
                            >
                              {kids.slice(0, 3).map((familyKid, kidIndex) => (
                                <span key={familyKid.id} className={kidIndex > 0 ? "-ml-1" : ""}>
                                  <KidAvatar
                                    name={familyKid.name}
                                    index={kidIndex}
                                    avatarUrl={familyKid.avatar_url}
                                    size={14}
                                  />
                                </span>
                              ))}
                            </span>
                          )}
                          {/* Text fitting, learned from the mom reviews:
                              tall-enough blocks wrap the title to two
                              lines instead of ellipsizing; squeezed
                              half-width overlap columns give the whole
                              block to the title (the tap-for-details
                              card carries the time); short single-slot
                              blocks keep the start time pinned right so
                              truncation can never eat it. */}
                          {block.slotCount === 1 && height < 34 ? (
                            <p
                              className="flex items-baseline justify-between gap-1 pr-4 pt-0.5 text-[0.7rem] leading-tight"
                              style={{ color: tone ? tone[1] : "var(--homa-ink)" }}
                            >
                              <span className="truncate font-bold">{block.title}</span>
                              <span className="shrink-0 text-[0.62rem] font-medium">
                                {block.startLabel}
                              </span>
                            </p>
                          ) : (
                            <>
                              <p
                                className={
                                  block.slotCount > 1
                                    ? // Narrow shared columns: the disc moved to
                                      // the bottom corner, so the title gets the
                                      // full width at smaller type; hyphens are
                                      // the backstop so a long word wraps with a
                                      // hyphen instead of clipping mid-letter.
                                      "line-clamp-2 hyphens-auto break-words pt-0.5 text-[0.62rem] font-bold leading-tight"
                                    : height >= 44
                                      ? "line-clamp-2 pr-4 pt-0.5 text-[0.7rem] font-bold leading-tight"
                                      : "truncate pr-4 pt-0.5 text-[0.7rem] font-bold leading-tight"
                                }
                                lang="en"
                                style={{ color: tone ? tone[1] : "var(--homa-ink)" }}
                              >
                                {block.title}
                              </p>
                              {height >= 34 && block.slotCount === 1 ? (
                                <p
                                  className="mt-0.5 text-[0.68rem] font-medium leading-tight"
                                  style={{ color: tone ? tone[1] : "var(--homa-ink)" }}
                                >
                                  {block.timeLabel}
                                </p>
                              ) : null}
                            </>
                          )}
                        </button>
                      );
                    })}
                    {/* The live drag preview: the block under the
                        pointer, in whatever column it is currently over,
                        showing the time it would land on. */}
                    {drag?.moved && drag.date === day.date
                      ? (() => {
                          const source = timedSpans.find((span) => span.id === drag.id);
                          if (!source) return null;
                          const tone =
                            source.kidIndex === null ? null : avatarTone(source.kidIndex);
                          const top =
                            ((drag.startMin - hourWindow.startHour * 60) / 60) * HOUR_PX;
                          const height = Math.max(
                            24,
                            ((drag.endMin - drag.startMin) / 60) * HOUR_PX - 2,
                          );
                          return (
                            <div
                              className="pointer-events-none absolute z-20 overflow-hidden rounded-[var(--homa-radius-control)] border border-[var(--homa-midnight-action)] px-2 py-0.5 opacity-95 shadow-lg ring-2"
                              style={{
                                top,
                                height,
                                left: 3,
                                right: 3,
                                background: tone ? tone[0] : stripeBackground,
                                ...({ "--tw-ring-color": "var(--homa-midnight-action)" } as React.CSSProperties),
                              }}
                            >
                              <p
                                className="truncate pt-0.5 text-[0.7rem] font-bold leading-tight"
                                style={{ color: tone ? tone[1] : "var(--homa-ink)" }}
                              >
                                {source.title}
                              </p>
                              <p
                                className="mt-0.5 text-[0.68rem] font-medium leading-tight"
                                style={{ color: tone ? tone[1] : "var(--homa-ink)" }}
                              >
                                {formatTimeRange(
                                  minutesToTimeInput(drag.startMin),
                                  minutesToTimeInput(drag.endMin),
                                )}
                              </p>
                            </div>
                          );
                        })()
                      : null}
                    {nowLineTop !== null ? (
                      day.isToday ? (
                        <div
                          className="pointer-events-none absolute inset-x-0 z-10"
                          style={{ top: nowLineTop }}
                        >
                          <div
                            className="relative border-t-2"
                            style={{ borderColor: "var(--homa-visual-coral)" }}
                          >
                            <span
                              className="absolute -top-[5px] left-0 h-2 w-2 rounded-full"
                              style={{ background: "var(--homa-visual-coral)" }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div
                          className="pointer-events-none absolute inset-x-0 z-10 border-t"
                          style={{ top: nowLineTop, borderColor: "var(--homa-error-tint)" }}
                          aria-hidden="true"
                        />
                      )
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        </>
      )}

      {/* One voice, once: the empty-week nudge above the grid already
          says how to add things, so this caption yields to it. */}
      {!weekIsEmpty ? (
        <p className="mt-6 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
          Ask Homa to schedule a plan activity onto a real day, or to add an
          appointment or trip; both show up here right away. Hours shown here
          are a quick indicator; edit them on the Hours page.
        </p>
      ) : null}

      {details ? (
        <div className="quiet-artifact-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setDetails(null)}
            className="absolute inset-0 bg-black/20"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={details.title}
            className="quiet-artifact-dialog quiet-frame quiet-frame--paper"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold leading-snug text-[color:var(--homa-ink)]">
                  {details.title}
                </p>
                <p className="mt-1 text-sm text-[color:var(--homa-ink)]">{details.whenLabel}</p>
              </div>
              {details.kidIndex !== null && kids[details.kidIndex] ? (
                <KidAvatar
                  name={kids[details.kidIndex].name}
                  index={details.kidIndex}
                  avatarUrl={kids[details.kidIndex].avatar_url}
                  size={28}
                />
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
              {details.kidIndex !== null && kids[details.kidIndex]
                ? `For ${kids[details.kidIndex].name}`
                : "For the whole family"}
            </p>
            {details.note ? <p className="mt-2 text-sm text-[color:var(--homa-ink)]">{details.note}</p> : null}
            {composerError ? (
              <p className="mt-2 text-sm text-[color:var(--homa-error-ink)]">
                {composerError}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <QuietAction
                kind="secondary"
                size="default"
                disabled={saving}
                onClick={() => (confirmDelete ? void deleteDetailsEvent() : setConfirmDelete(true))}
                className="px-4 text-sm text-[color:var(--homa-error-ink)]"
              >
                {confirmDelete ? "Really delete it" : "Delete"}
              </QuietAction>
              <div className="flex items-center gap-2">
                <button
                  ref={detailsCloseRef}
                  type="button"
                  onClick={() => setDetails(null)}
                  className="quiet-action quiet-action--secondary quiet-action--default px-4 text-sm"
                >
                  Close
                </button>
                <QuietAction
                  kind="secondary"
                  size="default"
                  onClick={() => openComposerForEvent(details)}
                  className="px-4 text-sm"
                >
                  Edit
                </QuietAction>
                <QuietAction
                  href="/app"
                  kind="quiet"
                  size="default"
                  className="px-4 text-sm"
                >
                  Ask Homa
                </QuietAction>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {composer ? (
        <div className="quiet-artifact-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setComposer(null)}
            className="absolute inset-0 bg-black/20"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={composer.eventId ? "Edit event" : "New event"}
            className="quiet-artifact-dialog quiet-frame quiet-frame--paper"
          >
            <p className="font-display text-lg font-semibold text-[color:var(--homa-ink)]">
              {composer.eventId ? "Edit event" : "New event"}
            </p>
            <label className="mt-3 block text-sm font-semibold text-[color:var(--homa-ink)]">
              What is it?
              <input
                ref={composerTitleRef}
                type="text"
                value={composer.title}
                maxLength={200}
                onChange={(changeEvent) =>
                  setComposer({ ...composer, title: changeEvent.target.value })
                }
                placeholder="Dentist, co-op, museum day…"
                className="mt-1 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 py-2 text-sm font-normal text-[color:var(--homa-ink)] outline-none focus:border-[var(--homa-midnight-action)]"
              />
            </label>
            <label className="mt-3 block text-sm font-semibold text-[color:var(--homa-ink)]">
              Who is it for?
              <select
                value={composer.childId}
                onChange={(changeEvent) =>
                  setComposer({ ...composer, childId: changeEvent.target.value })
                }
                className="mt-1 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 py-2 text-sm font-normal text-[color:var(--homa-ink)] outline-none focus:border-[var(--homa-midnight-action)]"
              >
                <option value="">The whole family</option>
                {kids.map((kid) => (
                  <option key={kid.id} value={kid.id}>
                    {kid.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 flex items-end gap-3">
              <label className="block flex-1 text-sm font-semibold text-[color:var(--homa-ink)]">
                {composer.allDay ? "Starts" : "Day"}
                <input
                  type="date"
                  value={composer.startsOn}
                  onChange={(changeEvent) =>
                    setComposer({
                      ...composer,
                      startsOn: changeEvent.target.value,
                      endsOn:
                        composer.endsOn < changeEvent.target.value
                          ? changeEvent.target.value
                          : composer.endsOn,
                    })
                  }
                  className="mt-1 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 py-2 text-sm font-normal text-[color:var(--homa-ink)] outline-none focus:border-[var(--homa-midnight-action)]"
                />
              </label>
              <label className="flex items-center gap-1.5 pb-2.5 text-sm font-semibold text-[color:var(--homa-ink)]">
                <input
                  type="checkbox"
                  checked={composer.allDay}
                  onChange={(changeEvent) =>
                    setComposer({ ...composer, allDay: changeEvent.target.checked })
                  }
                  className="h-4 w-4 accent-[var(--homa-constructive-ink)]"
                />
                All day
              </label>
            </div>
            {composer.allDay ? (
              <label className="mt-3 block text-sm font-semibold text-[color:var(--homa-ink)]">
                Ends
                <input
                  type="date"
                  value={composer.endsOn}
                  min={composer.startsOn}
                  onChange={(changeEvent) =>
                    setComposer({ ...composer, endsOn: changeEvent.target.value })
                  }
                  className="mt-1 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 py-2 text-sm font-normal text-[color:var(--homa-ink)] outline-none focus:border-[var(--homa-midnight-action)]"
                />
              </label>
            ) : (
              <div className="mt-3 flex gap-3">
                <label className="block flex-1 text-sm font-semibold text-[color:var(--homa-ink)]">
                  From
                  <input
                    type="time"
                    value={composer.startTime}
                    onChange={(changeEvent) =>
                      setComposer({ ...composer, startTime: changeEvent.target.value })
                    }
                    className="mt-1 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 py-2 text-sm font-normal text-[color:var(--homa-ink)] outline-none focus:border-[var(--homa-midnight-action)]"
                  />
                </label>
                <label className="block flex-1 text-sm font-semibold text-[color:var(--homa-ink)]">
                  To
                  <input
                    type="time"
                    value={composer.endTime}
                    onChange={(changeEvent) =>
                      setComposer({ ...composer, endTime: changeEvent.target.value })
                    }
                    className="mt-1 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 py-2 text-sm font-normal text-[color:var(--homa-ink)] outline-none focus:border-[var(--homa-midnight-action)]"
                  />
                </label>
              </div>
            )}
            <label className="mt-3 block text-sm font-semibold text-[color:var(--homa-ink)]">
              Note (optional)
              <input
                type="text"
                value={composer.note}
                maxLength={500}
                onChange={(changeEvent) =>
                  setComposer({ ...composer, note: changeEvent.target.value })
                }
                placeholder="Bring the insurance card"
                className="mt-1 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 py-2 text-sm font-normal text-[color:var(--homa-ink)] outline-none focus:border-[var(--homa-midnight-action)]"
              />
            </label>
            {composerError ? (
              <p className="mt-2 text-sm text-[color:var(--homa-error-ink)]">
                {composerError}
              </p>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <QuietAction
                kind="secondary"
                size="default"
                onClick={() => setComposer(null)}
                className="px-4 text-sm"
              >
                Cancel
              </QuietAction>
              <QuietAction
                kind="primary"
                size="default"
                disabled={saving}
                onClick={() => void saveComposer()}
                className="px-5 text-sm"
              >
                {saving ? "Saving…" : "Save"}
              </QuietAction>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}

/** The Prev/Today/Next controls' href: page.tsx's parseWeekOffset reads
 * this same `week` param, so "Today" is simply the param omitted. */
function calendarWeekHref(weekOffset: number): string {
  return weekOffset === 0 ? "/app/calendar" : `/app/calendar?week=${weekOffset}`;
}

function weekLabel(weekOffset: number): string {
  if (weekOffset === 0) return "This week";
  if (weekOffset === 1) return "Next week";
  if (weekOffset === -1) return "Last week";
  return weekOffset > 0 ? `In ${weekOffset} weeks` : `${Math.abs(weekOffset)} weeks ago`;
}
