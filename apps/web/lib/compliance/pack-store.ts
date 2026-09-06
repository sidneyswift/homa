import { mapDb } from "../map/db";
import { prefillBirthdate, type StatePackRecordEntry } from "./pack";

/**
 * Durable side of the state pack (plans/2026-07-28-state-pack.md D8):
 * each generation is a new immutable finalized materials row (kind
 * "packet", subject "state-pack", child_id null) whose `revises` points
 * at the pack it replaces. The prior current pack flips to superseded in
 * the same transaction, so the Binder (finals only) shows exactly one
 * current pack while every prior row persists as a receipt of what the
 * family downloaded (journey J-H blast radius). Prior packs keep their
 * Blob bytes: unlike the materials draft flow, a superseded pack is a
 * receipt, never cleanup.
 *
 * Pinned posture (lib/agent-pinned): these run on the server connection
 * where RLS does not apply, so the explicit family_id predicates ARE the
 * wall, and familyId only ever arrives from session auth.
 */

export interface StatePackFamilyRow {
  familyName: string;
  firstName: string | null;
  lastName: string | null;
  usState: string | null;
  timeZone: string | null;
  schoolYearStartOn: string | null;
  children: { id: string; name: string; birthdate: string | null }[];
}

export async function getStatePackFamily(
  familyId: string,
): Promise<StatePackFamilyRow | null> {
  const sql = mapDb();
  const families = await sql<
    {
      name: string;
      first_name: string | null;
      last_name: string | null;
      us_state: string | null;
      time_zone: string | null;
      school_year_start_on: string | null;
    }[]
  >`
    select name, first_name, last_name, us_state, time_zone,
           school_year_start_on::text as school_year_start_on
    from public.families
    where id = ${familyId}
  `;
  const family = families[0];
  if (!family) return null;
  const children = await sql<
    { id: string; name: string; birth_month: string | null; created_at: string }[]
  >`
    select id::text as id, name, birth_month::text as birth_month,
           created_at::text as created_at
    from public.children
    where family_id = ${familyId}
    order by birth_month asc nulls last, created_at asc
  `;
  return {
    familyName: family.name,
    firstName: family.first_name,
    lastName: family.last_name,
    usState: family.us_state,
    timeZone: family.time_zone,
    schoolYearStartOn: family.school_year_start_on,
    children: children.map((child) => ({
      id: child.id,
      name: child.name,
      // Month-only for rows from the never-collected-day intake window
      // (prefillBirthdate; D5: only complete values reach the prep sheet).
      birthdate: prefillBirthdate(child.birth_month, child.created_at),
    })),
  };
}

const MAX_STATE_PACK_RECORD_ENTRIES = 10_000;

export async function getStatePackRecords(
  familyId: string,
  schoolYearStartOn: string | null,
  throughDate: string,
): Promise<{ entries: StatePackRecordEntry[]; truncated: boolean }> {
  const sql = mapDb();
  const rows = await sql<{
    child_id: string | null;
    child_name: string | null;
    happened_on: string;
    subject: string;
    minutes: number;
  }[]>`
    select h.child_id::text as child_id,
           c.name as child_name,
           h.happened_on::text as happened_on,
           h.subject,
           h.minutes
    from public.hours_log h
    left join public.children c
      on c.id = h.child_id and c.family_id = h.family_id
    where h.family_id = ${familyId}
      and (${schoolYearStartOn}::date is null or h.happened_on >= ${schoolYearStartOn}::date)
      and h.happened_on <= ${throughDate}::date
    order by h.happened_on asc, h.created_at asc, h.id asc
    limit ${MAX_STATE_PACK_RECORD_ENTRIES + 1}
  `;
  return {
    truncated: rows.length > MAX_STATE_PACK_RECORD_ENTRIES,
    entries: rows.slice(0, MAX_STATE_PACK_RECORD_ENTRIES).map((row) => ({
      childId: row.child_id,
      childName: row.child_name,
      happenedOn: row.happened_on,
      subject: row.subject,
      minutes: row.minutes,
    })),
  };
}

export const STATE_PACK_SUBJECT = "state-pack";

/**
 * The double-press short circuit (map-scoring-dedupe precedent): a
 * final pack made moments ago answers a repeat request instead of a
 * second Chromium render and a second permanent row. Regeneration
 * stays always-fresh (D9) at any human timescale; only a racing or
 * double-clicked request lands inside the window.
 */
export async function getRecentStatePack(
  familyId: string,
  windowSeconds: number,
): Promise<{ id: string; pageCount: number | null } | null> {
  const sql = mapDb();
  const rows = await sql<{ id: string; page_count: number | null }[]>`
    select id, (generation->>'pageCount')::int as page_count
    from public.materials
    where family_id = ${familyId}
      and subject = ${STATE_PACK_SUBJECT}
      and status = 'final'
      and created_at > now() - make_interval(secs => ${windowSeconds})
    order by created_at desc
    limit 1
  `;
  const row = rows[0];
  return row ? { id: row.id, pageCount: row.page_count } : null;
}

export interface StatePackRowInput {
  id: string;
  familyId: string;
  title: string;
  pdfUrl: string;
  previewUrl: string;
  html: string;
  generation: unknown;
}

/**
 * Inserts the new pack as final and supersedes the prior current pack,
 * atomically. Returns the prior pack's id (the `revises` link) so the
 * caller can report the chain.
 */
export async function insertStatePackRow(
  input: StatePackRowInput,
): Promise<{ id: string; replacedId: string | null }> {
  const sql = mapDb();
  return await sql.begin(async (transaction) => {
    // Two concurrent generations (double-click, two tabs) must not both
    // commit as 'final': under READ COMMITTED neither supersede UPDATE
    // can see the other's uncommitted insert, so the pair is serialized
    // on an advisory lock keyed to this family's pack (the same pattern
    // emitMapEventOnce uses for racing beacons).
    await transaction`
      select pg_advisory_xact_lock(
        hashtextextended(${"state-pack:" + input.familyId}, 0)
      )
    `;
    const priors = await transaction<{ id: string }[]>`
      select id from public.materials
      where family_id = ${input.familyId}
        and subject = ${STATE_PACK_SUBJECT}
        and status = 'final'
      order by created_at desc
      limit 1
    `;
    const replacedId = priors[0]?.id ?? null;
    await transaction`
      insert into public.materials
        (id, family_id, child_id, title, kind, subject, characters,
         pdf_url, preview_url, html, source, revises, channel, status,
         approved_at, generation)
      values
        (${input.id}, ${input.familyId}, ${null}, ${input.title},
         ${"packet"}, ${STATE_PACK_SUBJECT}, ${[]}, ${input.pdfUrl},
         ${input.previewUrl}, ${input.html}, ${"html"}, ${replacedId},
         ${"web"}, ${"final"}, now(),
         ${input.generation ? transaction.json(input.generation as never) : null})
    `;
    await transaction`
      update public.materials
      set status = 'superseded'
      where family_id = ${input.familyId}
        and subject = ${STATE_PACK_SUBJECT}
        and status = 'final'
        and id <> ${input.id}
    `;
    return { id: input.id, replacedId };
  });
}
