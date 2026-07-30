import { isPlanTier, type PlanTier } from "../billing/wall-types";
import { mapDb } from "../map/db";
import { prefillBirthdate } from "./pack";

/**
 * Durable side of the filing service (gh#421).
 *
 * Same posture as pack-store: these run on the server connection where
 * RLS does not apply, so the explicit family_id predicates ARE the wall,
 * and familyId only ever arrives from session auth.
 */

export interface FilingFamilyRow {
  familyName: string;
  parentName: string | null;
  addressLine: string | null;
  addressCity: string | null;
  addressZip: string | null;
  usState: string | null;
  timeZone: string | null;
  schoolYearStartOn: string | null;
  planTier: PlanTier;
  children: { name: string; birthdate: string | null; grade: string | null }[];
}

export async function getFilingFamily(
  familyId: string,
): Promise<FilingFamilyRow | null> {
  const sql = mapDb();
  const families = await sql<
    {
      name: string;
      first_name: string | null;
      last_name: string | null;
      address_line: string | null;
      address_city: string | null;
      address_zip: string | null;
      us_state: string | null;
      time_zone: string | null;
      school_year_start_on: string | null;
      plan_tier: string | null;
    }[]
  >`
    select name, first_name, last_name, address_line, address_city,
           address_zip, us_state, time_zone,
           school_year_start_on::text as school_year_start_on, plan_tier
    from public.families
    where id = ${familyId}
  `;
  const family = families[0];
  if (!family) return null;
  const children = await sql<
    { name: string; birth_month: string | null; created_at: string }[]
  >`
    select name, birth_month::text as birth_month,
           created_at::text as created_at
    from public.children
    where family_id = ${familyId}
    order by birth_month asc nulls last, created_at asc
  `;
  // Only ever a real city. Joining us_state in unconditionally made a
  // family with no city print "OH" as their address line, and a
  // non-empty string reads as present, so the missing city and zip were
  // never named as a gap (production, 2026-07-29).
  const city = family.address_city?.trim()
    ? `${family.address_city.trim()}${family.us_state ? `, ${family.us_state}` : ""}`
    : null;
  return {
    familyName: family.name,
    parentName:
      family.first_name && family.last_name
        ? `${family.first_name} ${family.last_name}`
        : (family.first_name ?? null),
    addressLine: family.address_line,
    addressCity: city,
    addressZip: family.address_zip,
    usState: family.us_state,
    timeZone: family.time_zone,
    schoolYearStartOn: family.school_year_start_on,
    planTier: isPlanTier(family.plan_tier) ? family.plan_tier : "regular",
    children: children.map((child) => ({
      name: child.name,
      birthdate: prefillBirthdate(child.birth_month, child.created_at),
      // There is no grade column anywhere in the schema, so this is
      // always a gap today. Kept in the shape rather than dropped
      // because several states name grade in their notice, and the
      // letter must ask for it rather than quietly omit it (gh#424
      // collects it).
      grade: null,
    })),
  };
}

export const STATE_FILING_SUBJECT = "state-filing";

/** The double-press short circuit, same reasoning as the state pack. */
export async function getRecentFiling(
  familyId: string,
  windowSeconds: number,
): Promise<{ id: string } | null> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    select id
    from public.materials
    where family_id = ${familyId}
      and subject = ${STATE_FILING_SUBJECT}
      and status = 'final'
      and created_at > now() - make_interval(secs => ${windowSeconds})
    order by created_at desc
    limit 1
  `;
  return rows[0] ? { id: rows[0].id } : null;
}

export interface FilingRowInput {
  id: string;
  familyId: string;
  title: string;
  pdfUrl: string;
  previewUrl: string;
  html: string;
  generation: unknown;
}

/**
 * Inserts the filing as final and supersedes the prior one, atomically.
 * A superseded filing keeps its bytes: a family who mailed last year's
 * notice needs to be able to produce the copy they sent.
 */
export async function insertFilingRow(
  input: FilingRowInput,
): Promise<{ id: string; replacedId: string | null }> {
  const sql = mapDb();
  return await sql.begin(async (transaction) => {
    await transaction`
      select pg_advisory_xact_lock(
        hashtextextended(${"state-filing:" + input.familyId}, 0)
      )
    `;
    const priors = await transaction<{ id: string }[]>`
      select id from public.materials
      where family_id = ${input.familyId}
        and subject = ${STATE_FILING_SUBJECT}
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
         ${"packet"}, ${STATE_FILING_SUBJECT}, ${[]}, ${input.pdfUrl},
         ${input.previewUrl}, ${input.html}, ${"html"}, ${replacedId},
         ${"web"}, ${"final"}, now(),
         ${input.generation ? transaction.json(input.generation as never) : null})
    `;
    await transaction`
      update public.materials
      set status = 'superseded'
      where family_id = ${input.familyId}
        and subject = ${STATE_FILING_SUBJECT}
        and status = 'final'
        and id <> ${input.id}
    `;
    return { id: input.id, replacedId };
  });
}
