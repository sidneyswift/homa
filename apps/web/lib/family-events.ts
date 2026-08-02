import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { mapDb, type DbJson } from "./map/db";

/**
 * family_events (issue #176, CG-03): Homa's own calendar for appointments,
 * trips, and other non-school scheduling, alongside the school-plan
 * scheduling in lib/plan-schedule.ts. Same caller/pinned split as
 * hours_log (lib/hours.ts + lib/agent-pinned.ts's recordHoursPinned):
 * the parent-facing Planner reads under the caller's own RLS
 * session (lib/family-events-read.ts's getFamilyEventsForFamily), while
 * the add/remove agent tools support both a web session (the caller's
 * own Supabase client) and a pinned channel like SMS (mapDb with an
 * explicit family_id predicate, the same interim posture documented in
 * lib/agent-db.ts). familyId always comes from session auth; a
 * model-supplied childId is always re-verified inside that family
 * before anything is written.
 *
 * The caller-page read deliberately lives in a SEPARATE file
 * (family-events-read.ts): createSupabaseServerClient pulls in
 * next/headers, which eve's standalone tool build cannot resolve
 * (VERCEL=1 eve build fails outside Next's own bundler). Every agent
 * tool imports only from THIS file, which never touches next/headers,
 * so the tool graph stays buildable. Same reasoning and split as
 * lib/hours.ts staying unimported by log_hours.ts.
 */

export const MAX_FAMILY_EVENT_TITLE = 200;
export const MAX_FAMILY_EVENT_NOTE = 500;
export const MAX_FAMILY_EVENT_CHILDREN = 100;

export const WRONG_CHILD_NOTE_FOR_EVENTS =
  "That child id is not in this family. Use a child id from the family context block, or leave it off for a whole-family event.";

export interface FamilyEventRecurrence {
  frequency: "weekly";
  interval: number;
  /** Sunday is 0, matching JavaScript and EventKit conversion. */
  weekdays: number[];
  until: string | null;
}

export interface FamilyEventRow {
  id: string;
  familyId: string;
  /** Compatibility marker for older one-child clients. New surfaces use
   * childIds, which can contain several children. */
  childId: string | null;
  /** Empty means the whole family. */
  childIds?: string[];
  title: string;
  /** YYYY-MM-DD. */
  startsOn: string;
  /** YYYY-MM-DD; equals startsOn for a single-day event. */
  endsOn: string;
  /** HH:MM (24h), or null for an all-day entry. */
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  recurrence?: FamilyEventRecurrence | null;
  /** Present on an expanded recurring occurrence so editing can retain the
   * canonical series start instead of moving the series to this occurrence. */
  seriesStartsOn?: string;
  seriesEndsOn?: string;
  occurrenceKey?: string;
  createdAt: string;
}

export interface FamilyEventInput {
  /** Server-chosen id for an armed Voice receipt. Never model input. */
  id?: string;
  title: string;
  /** YYYY-MM-DD. */
  startsOn: string;
  /** YYYY-MM-DD; omit for a single-day event (defaults to startsOn). */
  endsOn?: string | null;
  /** HH:MM (24h); omit for no specific time. */
  startTime?: string | null;
  endTime?: string | null;
  /** Omit for a whole-family event. */
  childId?: string | null;
  /** Several children explicitly included in this event. Empty means the
   * whole family. Wins over childId when supplied. */
  childIds?: string[];
  note?: string | null;
  recurrence?: FamilyEventRecurrence | null;
}

export interface ParsedFamilyEvent {
  title: string;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  recurrence: FamilyEventRecurrence | null;
}

export type ParseFamilyEventResult =
  | { ok: true; value: ParsedFamilyEvent }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizedFamilyEventInputChildIds(input: Pick<FamilyEventInput, "childId" | "childIds">): string[] {
  const requested = input.childIds ?? (input.childId ? [input.childId] : []);
  return [...new Set(requested)].sort();
}

/** Authoritative audience with an expand-contract fallback for rows created
 * before family_event_children existed. child_id stays a compatibility marker
 * and must be present in a consistent multi-child link set. */
export function familyEventChildIds(
  event: Pick<FamilyEventRow, "childId" | "childIds">,
): string[] {
  if (event.childId === null) return [];
  const linked = event.childIds ?? [];
  return linked.includes(event.childId) ? [...new Set(linked)] : [event.childId];
}

export function parseFamilyEventRecurrence(
  value: FamilyEventRecurrence | null | undefined,
  startsOn: string,
): { ok: true; value: FamilyEventRecurrence | null } | { ok: false; error: string } {
  if (value == null) return { ok: true, value: null };
  if (value.frequency !== "weekly") {
    return { ok: false, error: "Only weekly calendar recurrence is supported." };
  }
  if (!Number.isInteger(value.interval) || value.interval < 1 || value.interval > 52) {
    return { ok: false, error: "A weekly recurrence interval must be 1 through 52." };
  }
  if (
    value.weekdays.length < 1
    || value.weekdays.length > 7
    || new Set(value.weekdays).size !== value.weekdays.length
    || value.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  ) {
    return { ok: false, error: "Recurring weekdays must be unique values from Sunday 0 through Saturday 6." };
  }
  if (value.until !== null && (!DATE_RE.test(value.until) || value.until < startsOn)) {
    return { ok: false, error: "A recurring event cannot end before it starts." };
  }
  return {
    ok: true,
    value: { ...value, weekdays: [...value.weekdays].sort((left, right) => left - right) },
  };
}

/** Date-only day arithmetic in UTC, so a YYYY-MM-DD can never shift a
 * day through a local-timezone parse. */
export function addDaysToDateOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function weekdayForDateOnly(dateOnly: string): number {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function daysBetweenDateOnly(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / (24 * 60 * 60 * 1000),
  );
}

/** Expands stored weekly series only inside the requested Planner window.
 * The original row remains canonical; occurrence dates are view data. */
export function expandRecurringFamilyEvents(
  events: readonly FamilyEventRow[],
  rangeStart: string,
  rangeEnd: string,
): FamilyEventRow[] {
  const expanded: FamilyEventRow[] = [];
  for (const event of events) {
    const rule = event.recurrence;
    if (!rule) {
      if (event.startsOn <= rangeEnd && event.endsOn >= rangeStart) {
        expanded.push({ ...event, occurrenceKey: `${event.id}:${event.startsOn}` });
      }
      continue;
    }

    const durationDays = Math.max(0, daysBetweenDateOnly(event.startsOn, event.endsOn));
    let candidate = addDaysToDateOnly(rangeStart, -durationDays);
    if (candidate < event.startsOn) candidate = event.startsOn;
    while (candidate <= rangeEnd && (rule.until === null || candidate <= rule.until)) {
      const elapsedDays = daysBetweenDateOnly(event.startsOn, candidate);
      const elapsedWeeks = Math.floor(elapsedDays / 7);
      if (
        elapsedDays >= 0
        && elapsedWeeks % rule.interval === 0
        && rule.weekdays.includes(weekdayForDateOnly(candidate))
      ) {
        const occurrenceEnd = addDaysToDateOnly(candidate, durationDays);
        if (occurrenceEnd >= rangeStart) {
          expanded.push({
            ...event,
            startsOn: candidate,
            endsOn: occurrenceEnd,
            seriesStartsOn: event.startsOn,
            seriesEndsOn: event.endsOn,
            occurrenceKey: `${event.id}:${candidate}`,
          });
        }
      }
      candidate = addDaysToDateOnly(candidate, 1);
    }
  }
  return expanded.sort(
    (left, right) =>
      left.startsOn.localeCompare(right.startsOn)
      || (left.startTime ?? "").localeCompare(right.startTime ?? "")
      || left.title.localeCompare(right.title),
  );
}

/** The widest window one list_family_events call may cover. */
export const MAX_EVENT_WINDOW_DAYS = 120;

export type EventWindowResult =
  | { ok: true; fromDate: string; toDate: string; clamped: boolean }
  | { ok: false; error: string };

/**
 * Resolves the list_family_events read window (issue #257, arc PR B0:
 * the tool used to be today-forward only, so a Tuesday reshuffle could
 * never see Monday). from/to win over daysAhead when given; from may sit
 * in the past. The span is clamped to MAX_EVENT_WINDOW_DAYS so a wild
 * date can never turn one read into a whole-table scan of years.
 */
export function resolveEventWindow(args: {
  /** The family's own today, YYYY-MM-DD (zonedDateString). */
  today: string;
  daysAhead?: number;
  from?: string;
  to?: string;
}): EventWindowResult {
  const daysAhead = args.daysAhead ?? 30;
  if (args.from !== undefined && !DATE_RE.test(args.from)) {
    return { ok: false, error: "from must be a real calendar date, YYYY-MM-DD." };
  }
  if (args.to !== undefined && !DATE_RE.test(args.to)) {
    return { ok: false, error: "to must be a real calendar date, YYYY-MM-DD." };
  }
  const fromDate = args.from ?? args.today;
  const toDate = args.to ?? addDaysToDateOnly(fromDate, daysAhead);
  if (toDate < fromDate) {
    return { ok: false, error: "The window's end (to) is before its start (from)." };
  }
  if (daysBetweenDateOnly(fromDate, toDate) > MAX_EVENT_WINDOW_DAYS) {
    return {
      ok: true,
      fromDate,
      toDate: addDaysToDateOnly(fromDate, MAX_EVENT_WINDOW_DAYS),
      clamped: true,
    };
  }
  return { ok: true, fromDate, toDate, clamped: false };
}

/**
 * parseFamilyEventInput(input): validates and normalizes one event
 * before it ever reaches a query, shared by the caller and pinned write
 * paths so the rules can never drift between them.
 */
export function parseFamilyEventInput(input: FamilyEventInput): ParseFamilyEventResult {
  const title = input.title.trim().slice(0, MAX_FAMILY_EVENT_TITLE);
  if (title.length === 0) {
    return { ok: false, error: "An event needs a short title." };
  }
  if (!DATE_RE.test(input.startsOn)) {
    return { ok: false, error: "The start date must be a real calendar date, YYYY-MM-DD." };
  }
  const endsOnRaw = input.endsOn?.trim();
  const endsOn = endsOnRaw && endsOnRaw.length > 0 ? endsOnRaw : input.startsOn;
  if (!DATE_RE.test(endsOn)) {
    return { ok: false, error: "The end date must be a real calendar date, YYYY-MM-DD." };
  }
  if (endsOn < input.startsOn) {
    return { ok: false, error: "The event's end date is before its start date." };
  }
  const startTimeRaw = input.startTime?.trim();
  const startTime = startTimeRaw && startTimeRaw.length > 0 ? startTimeRaw : null;
  if (startTime && !TIME_RE.test(startTime)) {
    return { ok: false, error: "The start time must be 24h HH:MM, e.g. 14:00." };
  }
  const endTimeRaw = input.endTime?.trim();
  const endTime = endTimeRaw && endTimeRaw.length > 0 ? endTimeRaw : null;
  if (endTime && !TIME_RE.test(endTime)) {
    return { ok: false, error: "The end time must be 24h HH:MM, e.g. 15:00." };
  }
  if (startTime && endTime && endTime <= startTime && endsOn === input.startsOn) {
    return { ok: false, error: "The end time must be after the start time on a single-day event." };
  }
  const noteRaw = input.note?.trim();
  const note = noteRaw && noteRaw.length > 0 ? noteRaw.slice(0, MAX_FAMILY_EVENT_NOTE) : null;
  const recurrence = parseFamilyEventRecurrence(input.recurrence, input.startsOn);
  if (!recurrence.ok) return recurrence;
  return {
    ok: true,
    value: { title, startsOn: input.startsOn, endsOn, startTime, endTime, note, recurrence: recurrence.value },
  };
}

/** Postgres `time` columns arrive as "HH:MM:SS"; both the Data API and
 * raw SQL paths render through this so the shape is one thing everywhere. */
function normalizeTimeOfDay(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

/** Exported so family-events-read.ts (the caller-page read) can shape
 * its own Data API rows without duplicating this mapping. */
export interface RawFamilyEventRow {
  id: string;
  family_id: string;
  child_id: string | null;
  title: string;
  starts_on: string;
  ends_on: string;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  recurrence_rule: unknown;
  child_ids?: string[] | null;
  created_at: string;
}

export function toFamilyEventRow(row: RawFamilyEventRow): FamilyEventRow {
  const linkedChildIds = row.child_ids
    ?? [];
  return {
    id: row.id,
    familyId: row.family_id,
    childId: row.child_id,
    childIds: [...new Set(linkedChildIds)].sort(),
    title: row.title,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    startTime: normalizeTimeOfDay(row.start_time),
    endTime: normalizeTimeOfDay(row.end_time),
    note: row.note,
    recurrence: row.recurrence_rule as FamilyEventRecurrence | null,
    createdAt: row.created_at,
  };
}

/** The Data API column list family-events-read.ts's page query selects;
 * kept here so the read file and this file's own listFamilyEventsPinned
 * can never drift on what a "full row" means. */
export const EVENT_COLUMNS =
  "id, family_id, child_id, title, starts_on, ends_on, start_time, end_time, note, recurrence_rule, created_at";

/** Reads child links explicitly instead of relying on a PostgREST embedded
 * relationship. This keeps the RLS boundary obvious and avoids schema-cache
 * lag immediately after the additive relationship migration lands. */
export async function getFamilyEventChildIdsCaller(
  db: SupabaseClient,
  familyId: string,
  eventIds: readonly string[],
): Promise<Map<string, string[]>> {
  const childIdsByEvent = new Map<string, string[]>(
    eventIds.map((eventId) => [eventId, []]),
  );
  if (eventIds.length === 0) return childIdsByEvent;
  const { data, error } = await db
    .from("family_event_children")
    .select("event_id, child_id")
    .eq("family_id", familyId)
    .in("event_id", [...eventIds]);
  if (error) throw new Error(`family event child audience read failed: ${error.message}`);
  for (const row of data ?? []) {
    const eventId = row.event_id as string;
    const childId = row.child_id as string;
    childIdsByEvent.get(eventId)?.push(childId);
  }
  for (const childIds of childIdsByEvent.values()) childIds.sort();
  return childIdsByEvent;
}

export async function getFamilyEventCaller(
  db: SupabaseClient,
  familyId: string,
  eventId: string,
): Promise<FamilyEventRow | null> {
  const { data, error } = await db
    .from("family_events")
    .select(EVENT_COLUMNS)
    .eq("id", eventId)
    .eq("family_id", familyId)
    .maybeSingle();
  if (error || !data) return null;
  const childIdsByEvent = await getFamilyEventChildIdsCaller(db, familyId, [eventId]);
  return toFamilyEventRow({
    ...(data as unknown as RawFamilyEventRow),
    child_ids: childIdsByEvent.get(eventId) ?? [],
  });
}

export async function getFamilyEventPinned(
  familyId: string,
  eventId: string,
): Promise<FamilyEventRow | null> {
  const sql = mapDb();
  const rows = await sql<RawFamilyEventRow[]>`
    select event.id, event.family_id, event.child_id, event.title,
           to_char(starts_on, 'YYYY-MM-DD') as starts_on,
           to_char(ends_on, 'YYYY-MM-DD') as ends_on,
           to_char(start_time, 'HH24:MI') as start_time,
           to_char(end_time, 'HH24:MI') as end_time,
           note, recurrence_rule, created_at::text as created_at,
           array(
             select link.child_id::text
             from public.family_event_children link
             where link.event_id = event.id and link.family_id = event.family_id
             order by link.child_id
           ) as child_ids
    from public.family_events event
    where event.id = ${eventId} and event.family_id = ${familyId}
  `;
  return rows[0] ? toFamilyEventRow(rows[0]) : null;
}

/**
 * listFamilyEventsPinned(familyId, fromDate, toDate): the list_family_events
 * tool's read, on the server connection with an explicit family_id
 * predicate (the same posture as open_planner's getPlanBoard), so it
 * works identically whether the calling session is a caller-JWT web
 * session or a pinned channel like SMS.
 */
export async function listFamilyEventsPinned(
  familyId: string,
  fromDate: string,
  toDate: string,
): Promise<FamilyEventRow[]> {
  const sql = mapDb();
  const rows = await sql<RawFamilyEventRow[]>`
    select event.id, event.family_id, event.child_id, event.title,
           to_char(starts_on, 'YYYY-MM-DD') as starts_on,
           to_char(ends_on, 'YYYY-MM-DD') as ends_on,
           to_char(start_time, 'HH24:MI') as start_time,
           to_char(end_time, 'HH24:MI') as end_time,
           note, recurrence_rule, created_at::text as created_at,
           array(
             select link.child_id::text
             from public.family_event_children link
             where link.event_id = event.id and link.family_id = event.family_id
             order by link.child_id
           ) as child_ids
    from public.family_events event
    where event.family_id = ${familyId}
      and event.starts_on <= ${toDate}
      and (event.ends_on >= ${fromDate} or event.recurrence_rule is not null)
    order by event.starts_on asc
  `;
  return rows.map(toFamilyEventRow);
}

/**
 * What update_family_event may change in one call: retitle, retime,
 * move. Undefined means "keep what is there"; a null time means "make
 * it all-day". childId and note stay out on purpose, the tool is a
 * narrow retitle/retime/move leaf, not a full editor.
 */
export interface FamilyEventPatch {
  title?: string;
  /** YYYY-MM-DD. Moving startsOn without an explicit endsOn shifts
   * endsOn by the same number of days, so a trip keeps its length. */
  startsOn?: string;
  endsOn?: string;
  startTime?: string | null;
  endTime?: string | null;
  recurrence?: FamilyEventRecurrence | null;
}

export function familyEventPatchIsEmpty(patch: FamilyEventPatch): boolean {
  return (
    patch.title === undefined &&
    patch.startsOn === undefined &&
    patch.endsOn === undefined &&
    patch.startTime === undefined &&
    patch.endTime === undefined &&
    patch.recurrence === undefined
  );
}

/**
 * Merges a patch onto the stored event and re-validates the merged
 * whole through parseFamilyEventInput, the exact same gate add uses, so
 * an update can never produce a shape an add would have refused.
 */
export function applyFamilyEventPatch(
  existing: Pick<
    FamilyEventRow,
    "title" | "startsOn" | "endsOn" | "startTime" | "endTime" | "note" | "recurrence"
  >,
  patch: FamilyEventPatch,
): ParseFamilyEventResult {
  if (patch.startsOn !== undefined && !DATE_RE.test(patch.startsOn)) {
    return { ok: false, error: "The start date must be a real calendar date, YYYY-MM-DD." };
  }
  const startsOn = patch.startsOn ?? existing.startsOn;
  let endsOn: string;
  if (patch.endsOn !== undefined) {
    endsOn = patch.endsOn;
  } else if (patch.startsOn !== undefined) {
    // A move keeps the event's length: shift endsOn by the same delta
    // (a single-day event stays single-day, a Wed-to-Sun trip stays
    // five days).
    endsOn = addDaysToDateOnly(
      existing.endsOn,
      daysBetweenDateOnly(existing.startsOn, patch.startsOn),
    );
  } else {
    endsOn = existing.endsOn;
  }
  return parseFamilyEventInput({
    title: patch.title ?? existing.title,
    startsOn,
    endsOn,
    startTime: patch.startTime === undefined ? existing.startTime : patch.startTime,
    endTime: patch.endTime === undefined ? existing.endTime : patch.endTime,
    note: existing.note,
    recurrence: patch.recurrence === undefined ? (existing.recurrence ?? null) : patch.recurrence,
  });
}

export type AddFamilyEventResult =
  | {
      added: true;
      eventId: string;
      /** The parsed values actually written, so callers (and the
       * transcript's receipt chip) can name the effect truthfully. */
      title: string;
      startsOn: string;
      endsOn: string;
      event: FamilyEventRow;
    }
  | { added: false; note: string };

export async function addFamilyEventCaller(
  db: SupabaseClient,
  familyId: string,
  input: FamilyEventInput,
): Promise<AddFamilyEventResult> {
  const parsed = parseFamilyEventInput(input);
  if (!parsed.ok) return { added: false, note: parsed.error };

  if (input.childId) {
    const { data: child } = await db
      .from("children")
      .select("id")
      .eq("id", input.childId)
      .eq("family_id", familyId)
      .maybeSingle();
    if (!child) return { added: false, note: WRONG_CHILD_NOTE_FOR_EVENTS };
  }

  const { data, error } = await db
    .from("family_events")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      family_id: familyId,
      child_id: input.childId ?? null,
      title: parsed.value.title,
      starts_on: parsed.value.startsOn,
      ends_on: parsed.value.endsOn,
      start_time: parsed.value.startTime,
      end_time: parsed.value.endTime,
      note: parsed.value.note,
      recurrence_rule: parsed.value.recurrence,
    })
    .select(EVENT_COLUMNS)
    .single();
  if (error || !data) {
    return { added: false, note: `Could not add it: ${error?.message ?? "unknown error"}` };
  }
  const event = toFamilyEventRow(data as unknown as RawFamilyEventRow);
  return {
    added: true,
    eventId: event.id,
    title: parsed.value.title,
    startsOn: parsed.value.startsOn,
    endsOn: parsed.value.endsOn,
    event,
  };
}

export async function addFamilyEventPinned(
  familyId: string,
  input: FamilyEventInput,
): Promise<AddFamilyEventResult> {
  const parsed = parseFamilyEventInput(input);
  if (!parsed.ok) return { added: false, note: parsed.error };

  const sql = mapDb();
  let childId: string | null = null;
  if (input.childId) {
    const rows = await sql<{ id: string }[]>`
      select id from public.children where id = ${input.childId} and family_id = ${familyId}
    `;
    childId = rows[0]?.id ?? null;
    if (!childId) return { added: false, note: WRONG_CHILD_NOTE_FOR_EVENTS };
  }

  const eventId = input.id ?? randomUUID();
  const inserted = await sql<RawFamilyEventRow[]>`
    insert into public.family_events
      (id, family_id, child_id, title, starts_on, ends_on, start_time, end_time, note, recurrence_rule)
    values
      (${eventId}, ${familyId}, ${childId}, ${parsed.value.title}, ${parsed.value.startsOn},
       ${parsed.value.endsOn}, ${parsed.value.startTime}, ${parsed.value.endTime},
       ${parsed.value.note}, ${parsed.value.recurrence === null ? null : sql.json(parsed.value.recurrence as unknown as DbJson)})
    returning id, family_id, child_id, title,
              to_char(starts_on, 'YYYY-MM-DD') as starts_on,
              to_char(ends_on, 'YYYY-MM-DD') as ends_on,
              to_char(start_time, 'HH24:MI') as start_time,
              to_char(end_time, 'HH24:MI') as end_time,
              note, recurrence_rule, created_at::text as created_at
  `;
  const event = toFamilyEventRow(inserted[0]);
  return {
    added: true,
    eventId: event.id,
    title: parsed.value.title,
    startsOn: parsed.value.startsOn,
    endsOn: parsed.value.endsOn,
    event,
  };
}

export type UpdateFamilyEventResult =
  | { updated: true; event: FamilyEventRow; before: FamilyEventRow }
  | { updated: false; note: string };

const UPDATE_NOTHING_NOTE =
  "Nothing to change: pass at least one of title, startsOn, endsOn, startTime, or endTime.";

export async function updateFamilyEventCaller(
  db: SupabaseClient,
  familyId: string,
  eventId: string,
  patch: FamilyEventPatch,
  expected?: FamilyEventRow,
): Promise<UpdateFamilyEventResult> {
  if (familyEventPatchIsEmpty(patch)) return { updated: false, note: UPDATE_NOTHING_NOTE };

  // The model-supplied eventId is re-scoped inside the caller's own
  // family on the read AND the write; a foreign or invented id matches
  // nothing on either.
  const { data: existing, error: readError } = await db
    .from("family_events")
    .select(EVENT_COLUMNS)
    .eq("id", eventId)
    .eq("family_id", familyId)
    .maybeSingle();
  if (readError) {
    return { updated: false, note: `Could not update it: ${readError.message}` };
  }
  if (!existing) return { updated: false, note: EVENT_NOT_FOUND_NOTE };

  const current = toFamilyEventRow(existing as unknown as RawFamilyEventRow);
  const parsed = applyFamilyEventPatch(current, patch);
  if (!parsed.ok) return { updated: false, note: parsed.error };

  let update = db
    .from("family_events")
    .update({
      title: parsed.value.title,
      starts_on: parsed.value.startsOn,
      ends_on: parsed.value.endsOn,
      start_time: parsed.value.startTime,
      end_time: parsed.value.endTime,
      recurrence_rule: parsed.value.recurrence,
    })
    .eq("id", eventId)
    .eq("family_id", familyId);
  if (expected) {
    update = update
      .eq("title", expected.title)
      .eq("starts_on", expected.startsOn)
      .eq("ends_on", expected.endsOn);
    update = expected.childId === null
      ? update.is("child_id", null)
      : update.eq("child_id", expected.childId);
    update = expected.startTime === null
      ? update.is("start_time", null)
      : update.eq("start_time", expected.startTime);
    update = expected.endTime === null
      ? update.is("end_time", null)
      : update.eq("end_time", expected.endTime);
    update = expected.note === null
      ? update.is("note", null)
      : update.eq("note", expected.note);
    update = expected.recurrence == null
      ? update.is("recurrence_rule", null)
      : update.eq("recurrence_rule", expected.recurrence);
  }
  const { data, error } = await update
    .select(EVENT_COLUMNS)
    .maybeSingle();
  if (error || !data) {
    return { updated: false, note: `Could not update it: ${error?.message ?? "unknown error"}` };
  }
  return {
    updated: true,
    event: toFamilyEventRow(data as unknown as RawFamilyEventRow),
    before: current,
  };
}

export async function updateFamilyEventPinned(
  familyId: string,
  eventId: string,
  patch: FamilyEventPatch,
  expected?: FamilyEventRow,
): Promise<UpdateFamilyEventResult> {
  if (familyEventPatchIsEmpty(patch)) return { updated: false, note: UPDATE_NOTHING_NOTE };

  const sql = mapDb();
  const rows = await sql<RawFamilyEventRow[]>`
    select id, family_id, child_id, title,
           to_char(starts_on, 'YYYY-MM-DD') as starts_on,
           to_char(ends_on, 'YYYY-MM-DD') as ends_on,
           to_char(start_time, 'HH24:MI') as start_time,
           to_char(end_time, 'HH24:MI') as end_time,
           note, recurrence_rule, created_at::text as created_at
    from public.family_events
    where id = ${eventId} and family_id = ${familyId}
      ${expected ? sql`and child_id is not distinct from ${expected.childId}
        and title = ${expected.title} and starts_on = ${expected.startsOn}
        and ends_on = ${expected.endsOn}
        and start_time is not distinct from ${expected.startTime}
        and end_time is not distinct from ${expected.endTime}
        and note is not distinct from ${expected.note}
        and recurrence_rule is not distinct from ${expected.recurrence == null ? null : sql.json(expected.recurrence as unknown as DbJson)}` : sql``}
  `;
  const existing = rows[0];
  if (!existing) return { updated: false, note: EVENT_NOT_FOUND_NOTE };

  const parsed = applyFamilyEventPatch(toFamilyEventRow(existing), patch);
  if (!parsed.ok) return { updated: false, note: parsed.error };

  const updated = await sql<RawFamilyEventRow[]>`
    update public.family_events
    set title = ${parsed.value.title},
        starts_on = ${parsed.value.startsOn},
        ends_on = ${parsed.value.endsOn},
        start_time = ${parsed.value.startTime},
        end_time = ${parsed.value.endTime},
        recurrence_rule = ${parsed.value.recurrence === null ? null : sql.json(parsed.value.recurrence as unknown as DbJson)}
    where id = ${eventId} and family_id = ${familyId}
      ${expected ? sql`and child_id is not distinct from ${expected.childId}
        and title = ${expected.title} and starts_on = ${expected.startsOn}
        and ends_on = ${expected.endsOn}
        and start_time is not distinct from ${expected.startTime}
        and end_time is not distinct from ${expected.endTime}
        and note is not distinct from ${expected.note}
        and recurrence_rule is not distinct from ${expected.recurrence == null ? null : sql.json(expected.recurrence as unknown as DbJson)}` : sql``}
    returning id, family_id, child_id, title,
              to_char(starts_on, 'YYYY-MM-DD') as starts_on,
              to_char(ends_on, 'YYYY-MM-DD') as ends_on,
              to_char(start_time, 'HH24:MI') as start_time,
              to_char(end_time, 'HH24:MI') as end_time,
              note, recurrence_rule, created_at::text as created_at
  `;
  if (!updated[0]) return { updated: false, note: EVENT_NOT_FOUND_NOTE };
  return {
    updated: true,
    event: toFamilyEventRow(updated[0]),
    before: toFamilyEventRow(existing),
  };
}

export type RemoveFamilyEventResult =
  | {
      removed: true;
      /** The removed event's title, for the transcript's receipt chip. */
      title: string;
      event: FamilyEventRow;
    }
  | { removed: false; note: string };

const EVENT_NOT_FOUND_NOTE =
  "That event wasn't found on this family's calendar. It may already be removed.";

export async function removeFamilyEventCaller(
  db: SupabaseClient,
  familyId: string,
  eventId: string,
  expected?: FamilyEventRow,
): Promise<RemoveFamilyEventResult> {
  let removal = db
    .from("family_events")
    .delete()
    .eq("id", eventId)
    .eq("family_id", familyId);
  if (expected) {
    removal = removal
      .eq("title", expected.title)
      .eq("starts_on", expected.startsOn)
      .eq("ends_on", expected.endsOn);
    removal = expected.childId === null
      ? removal.is("child_id", null)
      : removal.eq("child_id", expected.childId);
    removal = expected.startTime === null
      ? removal.is("start_time", null)
      : removal.eq("start_time", expected.startTime);
    removal = expected.endTime === null
      ? removal.is("end_time", null)
      : removal.eq("end_time", expected.endTime);
    removal = expected.note === null
      ? removal.is("note", null)
      : removal.eq("note", expected.note);
    removal = expected.recurrence == null
      ? removal.is("recurrence_rule", null)
      : removal.eq("recurrence_rule", expected.recurrence);
  }
  const { data, error } = await removal
    .select(EVENT_COLUMNS);
  if (error) return { removed: false, note: `Could not remove it: ${error.message}` };
  if (!data || data.length === 0) return { removed: false, note: EVENT_NOT_FOUND_NOTE };
  const event = toFamilyEventRow(data[0] as unknown as RawFamilyEventRow);
  return { removed: true, title: event.title, event };
}

export async function removeFamilyEventPinned(
  familyId: string,
  eventId: string,
  expected?: FamilyEventRow,
): Promise<RemoveFamilyEventResult> {
  const sql = mapDb();
  const deleted = await sql<RawFamilyEventRow[]>`
    delete from public.family_events
    where id = ${eventId} and family_id = ${familyId}
      ${expected ? sql`and child_id is not distinct from ${expected.childId}
        and title = ${expected.title} and starts_on = ${expected.startsOn}
        and ends_on = ${expected.endsOn}
        and start_time is not distinct from ${expected.startTime}
        and end_time is not distinct from ${expected.endTime}
        and note is not distinct from ${expected.note}
        and recurrence_rule is not distinct from ${expected.recurrence == null ? null : sql.json(expected.recurrence as unknown as DbJson)}` : sql``}
    returning id, family_id, child_id, title,
              to_char(starts_on, 'YYYY-MM-DD') as starts_on,
              to_char(ends_on, 'YYYY-MM-DD') as ends_on,
              to_char(start_time, 'HH24:MI') as start_time,
              to_char(end_time, 'HH24:MI') as end_time,
              note, recurrence_rule, created_at::text as created_at
  `;
  if (deleted.length === 0) return { removed: false, note: EVENT_NOT_FOUND_NOTE };
  const event = toFamilyEventRow(deleted[0]);
  return { removed: true, title: event.title, event };
}
