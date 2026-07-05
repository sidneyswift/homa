import {
  ageInMonths,
  getMapItem,
  isInScoredRange,
  MAP_BANK_VERSION,
  scoreMap,
  type MapAnswer,
  type MapScores,
} from "@homa/core";

import { mapDb, type DbJson } from "./db";
import { hashToken, newToken } from "./tokens";

/**
 * All database access for the map flow. The lead id NEVER comes from the
 * client: routes resolve it from the resume cookie's token hash, and every
 * child-scoped operation re-checks that the child belongs to that lead
 * (the tenancy law, applied to leads).
 */

export interface LeadRow {
  id: string;
  email: string;
  first_name: string | null;
  us_state: string | null;
  status: string;
}

export interface LeadChildRow {
  id: string;
  name: string;
  birth_month: string;
  interests: string[];
  help_with: string | null;
  pending_band: boolean;
  age_months: number;
  in_range: boolean;
  answered: number;
  report_token: string | null;
}

export interface LeadState {
  lead: LeadRow;
  children: LeadChildRow[];
  answers: Record<string, { itemId: string; answer: MapAnswer }[]>;
}

interface UpsertLeadInput {
  email: string;
  firstName?: string;
  usState?: string;
  source: string;
  utm: Record<string, string>;
}

/**
 * Creates or refreshes a lead and rotates its resume token. Returns the raw
 * token (cookie + emailed links); only the hash is stored.
 */
export async function upsertLead(
  input: UpsertLeadInput,
): Promise<{ leadId: string; returning: boolean; resumeToken: string }> {
  const sql = mapDb();
  const resumeToken = newToken();
  const tokenHash = hashToken(resumeToken);

  const existing = await sql<{ id: string }[]>`
    select id from public.lead_families where email = ${input.email}
  `;

  if (existing.length > 0) {
    await sql`
      update public.lead_families set
        first_name = coalesce(${input.firstName ?? null}, first_name),
        us_state = coalesce(${input.usState ?? null}, us_state),
        resume_token_hash = ${tokenHash},
        updated_at = now()
      where id = ${existing[0].id}
    `;
    return { leadId: existing[0].id, returning: true, resumeToken };
  }

  const inserted = await sql<{ id: string }[]>`
    insert into public.lead_families (email, first_name, us_state, source, utm, resume_token_hash)
    values (${input.email}, ${input.firstName ?? null}, ${input.usState ?? null},
            ${input.source}, ${sql.json(input.utm)}, ${tokenHash})
    returning id
  `;
  return { leadId: inserted[0].id, returning: false, resumeToken };
}

/** Resolves a lead from a raw resume token. Null when unknown or deleted. */
export async function getLeadByResumeToken(rawToken: string): Promise<LeadRow | null> {
  const sql = mapDb();
  const rows = await sql<LeadRow[]>`
    select id, email, first_name, us_state, status
    from public.lead_families
    where resume_token_hash = ${hashToken(rawToken)} and status <> 'deleted'
  `;
  return rows[0] ?? null;
}

export async function getLeadByEmail(email: string): Promise<{ id: string } | null> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    select id from public.lead_families where email = ${email} and status <> 'deleted'
  `;
  return rows[0] ?? null;
}

/** Rotates and returns a fresh resume token for an existing lead. */
export async function rotateResumeToken(leadId: string): Promise<string> {
  const sql = mapDb();
  const resumeToken = newToken();
  await sql`
    update public.lead_families
    set resume_token_hash = ${hashToken(resumeToken)}, updated_at = now()
    where id = ${leadId}
  `;
  return resumeToken;
}

export async function countChildren(leadId: string): Promise<number> {
  const sql = mapDb();
  const rows = await sql<{ count: string }[]>`
    select count(*)::text as count from public.lead_children where lead_family_id = ${leadId}
  `;
  return Number(rows[0]?.count ?? 0);
}

interface AddChildInput {
  name: string;
  birthMonth: string; // YYYY-MM
  interests: string[];
  helpWith?: string;
}

export async function addChild(
  leadId: string,
  input: AddChildInput,
): Promise<{ childId: string; ageMonths: number; inRange: boolean }> {
  const sql = mapDb();
  const months = ageInMonths(input.birthMonth);
  const inRange = isInScoredRange(months);
  const rows = await sql<{ id: string }[]>`
    insert into public.lead_children (lead_family_id, name, birth_month, interests, help_with, pending_band)
    values (${leadId}, ${input.name}, ${`${input.birthMonth}-01`}, ${input.interests},
            ${input.helpWith ?? null}, ${!inRange})
    returning id
  `;
  await touchLead(leadId);
  return { childId: rows[0].id, ageMonths: months, inRange };
}

/** True when the child exists and belongs to this lead. */
async function childBelongsToLead(childId: string, leadId: string): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    select id from public.lead_children where id = ${childId} and lead_family_id = ${leadId}
  `;
  return rows.length > 0;
}

export async function saveAnswer(
  leadId: string,
  childId: string,
  itemId: string,
  answer: MapAnswer,
): Promise<{ ok: boolean; domain?: string }> {
  const item = getMapItem(itemId);
  if (!item) return { ok: false };
  if (!(await childBelongsToLead(childId, leadId))) return { ok: false };

  const sql = mapDb();
  await sql`
    insert into public.lead_answers (lead_child_id, question_id, answer)
    values (${childId}, ${itemId}, ${answer})
    on conflict (lead_child_id, question_id)
    do update set answer = excluded.answer, answered_at = now()
  `;
  await touchLead(leadId);
  return { ok: true, domain: item.domain.id };
}

/** Full state snapshot for resume: children, answers, report tokens. */
export async function getLeadState(lead: LeadRow): Promise<LeadState> {
  const sql = mapDb();
  const children = await sql<
    {
      id: string;
      name: string;
      birth_month: string;
      interests: string[];
      help_with: string | null;
      pending_band: boolean;
      report_token: string | null;
    }[]
  >`
    select c.id, c.name, to_char(c.birth_month, 'YYYY-MM') as birth_month,
           c.interests, c.help_with, c.pending_band, r.token as report_token
    from public.lead_children c
    left join public.lead_reports r on r.lead_child_id = c.id and r.revoked_at is null
    where c.lead_family_id = ${lead.id}
    order by c.created_at
  `;

  const answers: LeadState["answers"] = {};
  if (children.length > 0) {
    const childIds = children.map((child) => child.id);
    const rows = await sql<{ lead_child_id: string; question_id: string; answer: MapAnswer }[]>`
      select lead_child_id, question_id, answer
      from public.lead_answers
      where lead_child_id in ${sql(childIds)}
    `;
    for (const row of rows) {
      const list = answers[row.lead_child_id] ?? [];
      list.push({ itemId: row.question_id, answer: row.answer });
      answers[row.lead_child_id] = list;
    }
  }

  return {
    lead,
    children: children.map((child) => {
      const months = ageInMonths(child.birth_month);
      return {
        ...child,
        age_months: months,
        in_range: isInScoredRange(months),
        answered: (answers[child.id] ?? []).length,
      };
    }),
    answers,
  };
}

export interface ScoredReport {
  token: string;
  scores: MapScores;
  childName: string;
  ageMonths: number;
  email: string;
  childId: string;
}

/** Scores a child from their stored answers and upserts the report row. */
export async function createReport(leadId: string, childId: string): Promise<ScoredReport | null> {
  if (!(await childBelongsToLead(childId, leadId))) return null;
  const sql = mapDb();

  const childRows = await sql<{ name: string; birth_month: string }[]>`
    select name, to_char(birth_month, 'YYYY-MM') as birth_month
    from public.lead_children where id = ${childId}
  `;
  if (childRows.length === 0) return null;
  const ageMonths = ageInMonths(childRows[0].birth_month);

  const answerRows = await sql<{ question_id: string; answer: MapAnswer }[]>`
    select question_id, answer from public.lead_answers where lead_child_id = ${childId}
  `;
  const scores = scoreMap(
    ageMonths,
    answerRows.map((row) => ({ itemId: row.question_id, answer: row.answer })),
  );

  const token = newToken();
  const rows = await sql<{ token: string }[]>`
    insert into public.lead_reports (lead_child_id, scores, bank_version, token)
    values (${childId}, ${sql.json(scores as unknown as DbJson)}, ${MAP_BANK_VERSION}, ${token})
    on conflict (lead_child_id) do update
      set scores = excluded.scores, bank_version = excluded.bank_version, generated_at = now()
    returning token
  `;

  const leadRows = await sql<{ email: string }[]>`
    select email from public.lead_families where id = ${leadId}
  `;
  await touchLead(leadId);

  return {
    token: rows[0].token,
    scores,
    childName: childRows[0].name,
    ageMonths,
    email: leadRows[0].email,
    childId,
  };
}

export async function markReportEmailed(childId: string): Promise<void> {
  const sql = mapDb();
  await sql`update public.lead_reports set emailed_at = now() where lead_child_id = ${childId}`;
}

export interface ReportView {
  token: string;
  scores: MapScores;
  bankVersion: string;
  generatedAt: string;
  childName: string;
  birthMonth: string;
  interests: string[];
  parentFirstName: string | null;
  usState: string | null;
  leadId: string;
  childId: string;
  firstView: boolean;
}

/** Loads a report by URL token and stamps first view. Null when revoked/unknown. */
export async function getReportByToken(token: string): Promise<ReportView | null> {
  const sql = mapDb();
  const rows = await sql<
    {
      token: string;
      scores: MapScores;
      bank_version: string;
      generated_at: string;
      viewed_at: string | null;
      child_id: string;
      child_name: string;
      birth_month: string;
      interests: string[];
      lead_id: string;
      first_name: string | null;
      us_state: string | null;
    }[]
  >`
    select r.token, r.scores, r.bank_version, r.generated_at::text as generated_at,
           r.viewed_at::text as viewed_at,
           c.id as child_id, c.name as child_name,
           to_char(c.birth_month, 'YYYY-MM') as birth_month, c.interests,
           f.id as lead_id, f.first_name, f.us_state
    from public.lead_reports r
    join public.lead_children c on c.id = r.lead_child_id
    join public.lead_families f on f.id = c.lead_family_id
    where r.token = ${token} and r.revoked_at is null and f.status <> 'deleted'
  `;
  const row = rows[0];
  if (!row) return null;

  const firstView = row.viewed_at === null;
  if (firstView) {
    await sql`update public.lead_reports set viewed_at = now() where token = ${token}`;
  }

  return {
    token: row.token,
    scores: row.scores,
    bankVersion: row.bank_version,
    generatedAt: row.generated_at,
    childName: row.child_name,
    birthMonth: row.birth_month,
    interests: row.interests,
    parentFirstName: row.first_name,
    usState: row.us_state,
    leadId: row.lead_id,
    childId: row.child_id,
    firstView,
  };
}

async function touchLead(leadId: string): Promise<void> {
  const sql = mapDb();
  await sql`update public.lead_families set updated_at = now() where id = ${leadId}`;
}

/** Mirrors the lead into the waitlist table so the invite list stays one list. */
export async function mirrorToWaitlist(input: {
  email: string;
  firstName?: string;
  usState?: string;
  source: string;
  utm: Record<string, string>;
}): Promise<void> {
  const sql = mapDb();
  await sql`
    insert into public.waitlist (email, first_name, source, utm, us_state)
    values (${input.email}, ${input.firstName ?? null}, ${input.source}, ${sql.json(input.utm)}, ${input.usState ?? null})
    on conflict (email) do nothing
  `;
}

/** Leads eligible for the single 24h reminder. */
export async function leadsNeedingReminder(): Promise<
  { id: string; email: string; first_child: string | null }[]
> {
  const sql = mapDb();
  return sql<{ id: string; email: string; first_child: string | null }[]>`
    select f.id, f.email,
      (select c.name from public.lead_children c
        where c.lead_family_id = f.id
          and not exists (select 1 from public.lead_reports r where r.lead_child_id = c.id)
        order by c.created_at limit 1) as first_child
    from public.lead_families f
    where f.status = 'open'
      and f.reminder_sent_at is null
      and f.created_at < now() - interval '24 hours'
      and f.updated_at < now() - interval '4 hours'
      and exists (
        select 1 from public.lead_children c
        where c.lead_family_id = f.id and not c.pending_band
          and not exists (select 1 from public.lead_reports r where r.lead_child_id = c.id)
      )
    limit 50
  `;
}

export async function markReminderSent(leadId: string): Promise<void> {
  const sql = mapDb();
  await sql`update public.lead_families set reminder_sent_at = now() where id = ${leadId}`;
}

/** Pending-band children whose age is now inside the scored range. */
export async function childrenNowInBand(): Promise<
  { child_id: string; child_name: string; lead_id: string; email: string; birth_month: string }[]
> {
  const sql = mapDb();
  const rows = await sql<
    { child_id: string; child_name: string; lead_id: string; email: string; birth_month: string }[]
  >`
    select c.id as child_id, c.name as child_name, f.id as lead_id, f.email,
           to_char(c.birth_month, 'YYYY-MM') as birth_month
    from public.lead_children c
    join public.lead_families f on f.id = c.lead_family_id
    where c.pending_band and c.band_ready_emailed_at is null and f.status <> 'deleted'
    limit 200
  `;
  return rows.filter((row) => isInScoredRange(ageInMonths(row.birth_month)));
}

export async function markBandReady(childId: string): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.lead_children
    set pending_band = false, band_ready_emailed_at = now()
    where id = ${childId}
  `;
}
