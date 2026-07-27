import type { SupabaseClient } from "@supabase/supabase-js";

import { mapDb } from "./map/db";

/**
 * family_events (issue #176, CG-03): Homa's own calendar for appointments,
 * trips, and other non-school scheduling, alongside the school-plan
 * scheduling in lib/plan-schedule.ts. Same caller/pinned split as
 * hours_log (lib/hours.ts + lib/agent-pinned.ts's recordHoursPinned):
 * the parent-facing /app/calendar page reads under the caller's own RLS
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

export const WRONG_CHILD_NOTE_FOR_EVENTS =
  "That child id is not in this family. Use a child id from the family context block, or leave it off for a whole-family event.";

export interface FamilyEventRow {
  id: string;
  familyId: string;
  childId: string | null;
  title: string;
  /** YYYY-MM-DD. */
  startsOn: string;
  /** YYYY-MM-DD; equals startsOn for a single-day event. */
  endsOn: string;
  /** HH:MM (24h), or null for an all-day entry. */
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  createdAt: string;
}

export interface FamilyEventInput {
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
  note?: string | null;
}

export interface ParsedFamilyEvent {
  title: string;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
}

export type ParseFamilyEventResult =
  | { ok: true; value: ParsedFamilyEvent }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

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
  return {
    ok: true,
    value: { title, startsOn: input.startsOn, endsOn, startTime, endTime, note },
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
  created_at: string;
}

export function toFamilyEventRow(row: RawFamilyEventRow): FamilyEventRow {
  return {
    id: row.id,
    familyId: row.family_id,
    childId: row.child_id,
    title: row.title,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    startTime: normalizeTimeOfDay(row.start_time),
    endTime: normalizeTimeOfDay(row.end_time),
    note: row.note,
    createdAt: row.created_at,
  };
}

/** The Data API column list family-events-read.ts's page query selects;
 * kept here so the read file and this file's own listFamilyEventsPinned
 * can never drift on what a "full row" means. */
export const EVENT_COLUMNS =
  "id, family_id, child_id, title, starts_on, ends_on, start_time, end_time, note, created_at";

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
    select id, family_id, child_id, title,
           to_char(starts_on, 'YYYY-MM-DD') as starts_on,
           to_char(ends_on, 'YYYY-MM-DD') as ends_on,
           to_char(start_time, 'HH24:MI') as start_time,
           to_char(end_time, 'HH24:MI') as end_time,
           note, created_at::text as created_at
    from public.family_events
    where family_id = ${familyId}
      and starts_on <= ${toDate} and ends_on >= ${fromDate}
    order by starts_on asc
  `;
  return rows.map(toFamilyEventRow);
}

export type AddFamilyEventResult =
  | { added: true; eventId: string }
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
      family_id: familyId,
      child_id: input.childId ?? null,
      title: parsed.value.title,
      starts_on: parsed.value.startsOn,
      ends_on: parsed.value.endsOn,
      start_time: parsed.value.startTime,
      end_time: parsed.value.endTime,
      note: parsed.value.note,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { added: false, note: `Could not add it: ${error?.message ?? "unknown error"}` };
  }
  return { added: true, eventId: data.id as string };
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

  const inserted = await sql<{ id: string }[]>`
    insert into public.family_events
      (family_id, child_id, title, starts_on, ends_on, start_time, end_time, note)
    values
      (${familyId}, ${childId}, ${parsed.value.title}, ${parsed.value.startsOn},
       ${parsed.value.endsOn}, ${parsed.value.startTime}, ${parsed.value.endTime},
       ${parsed.value.note})
    returning id
  `;
  return { added: true, eventId: inserted[0].id };
}

export type RemoveFamilyEventResult = { removed: true } | { removed: false; note: string };

const EVENT_NOT_FOUND_NOTE =
  "That event wasn't found on this family's calendar. It may already be removed.";

export async function removeFamilyEventCaller(
  db: SupabaseClient,
  familyId: string,
  eventId: string,
): Promise<RemoveFamilyEventResult> {
  const { data, error } = await db
    .from("family_events")
    .delete()
    .eq("id", eventId)
    .eq("family_id", familyId)
    .select("id");
  if (error) return { removed: false, note: `Could not remove it: ${error.message}` };
  if (!data || data.length === 0) return { removed: false, note: EVENT_NOT_FOUND_NOTE };
  return { removed: true };
}

export async function removeFamilyEventPinned(
  familyId: string,
  eventId: string,
): Promise<RemoveFamilyEventResult> {
  const sql = mapDb();
  const deleted = await sql<{ id: string }[]>`
    delete from public.family_events
    where id = ${eventId} and family_id = ${familyId}
    returning id
  `;
  if (deleted.length === 0) return { removed: false, note: EVENT_NOT_FOUND_NOTE };
  return { removed: true };
}
