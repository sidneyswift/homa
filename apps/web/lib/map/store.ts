import {
  ageInMonths,
  buildFourWeekPlan,
  getMapItem,
  isInScoredRange,
  MAP_BANK_VERSION,
  scoreMap,
  type FourWeekPlan,
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

/**
 * Resolves a lead from a raw token: either the device cookie's resume token
 * or an emailed link token. Both are honored so an emailed link never
 * invalidates the cookie already living on her original device.
 */
export async function getLeadByResumeToken(rawToken: string): Promise<LeadRow | null> {
  const sql = mapDb();
  const hash = hashToken(rawToken);
  const rows = await sql<LeadRow[]>`
    select id, email, first_name, us_state, status
    from public.lead_families
    where (resume_token_hash = ${hash} or link_token_hash = ${hash})
      and status <> 'deleted'
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

/**
 * Mints a fresh emailed-link token for a lead. Deliberately separate from
 * the device cookie's resume token: sending an email must never log out
 * the device she's already using.
 */
export async function mintLinkToken(leadId: string): Promise<string> {
  const sql = mapDb();
  const linkToken = newToken();
  await sql`
    update public.lead_families
    set link_token_hash = ${hashToken(linkToken)}
    where id = ${leadId}
  `;
  return linkToken;
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

/**
 * Hard-deletes a child and, via the schema's on-delete cascades, their
 * answers, report, and plans (the "delete anytime" promise, kept). The
 * where clause carries the tenancy re-scope: a childId belonging to a
 * different lead deletes nothing.
 */
export async function removeChild(leadId: string, childId: string): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    delete from public.lead_children
    where id = ${childId} and lead_family_id = ${leadId}
    returning id
  `;
  if (rows.length === 0) return false;
  await touchLead(leadId);
  return true;
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

/** One archived scoring, kept so the report can show dated movement. */
export interface ScoreSnapshot {
  scores: MapScores;
  generated_at: string;
  bank_version: string;
}

const HISTORY_CAP = 12;

/**
 * Scores a child from their stored answers and upserts the report row.
 * A rescore archives the previous scores into history (newest first,
 * capped), which powers the "+4 mo since June 6" movement chips.
 */
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

  const existing = await sql<
    { scores: MapScores; generated_at: string; bank_version: string; history: ScoreSnapshot[] }[]
  >`
    select scores, generated_at::text as generated_at, bank_version, history
    from public.lead_reports where lead_child_id = ${childId}
  `;
  const history: ScoreSnapshot[] =
    existing.length > 0
      ? [
          {
            scores: existing[0].scores,
            generated_at: existing[0].generated_at,
            bank_version: existing[0].bank_version,
          },
          ...existing[0].history,
        ].slice(0, HISTORY_CAP)
      : [];

  const token = newToken();
  const rows = await sql<{ token: string }[]>`
    insert into public.lead_reports (lead_child_id, scores, bank_version, token, history)
    values (${childId}, ${sql.json(scores as unknown as DbJson)}, ${MAP_BANK_VERSION}, ${token},
            ${sql.json(history as unknown as DbJson)})
    on conflict (lead_child_id) do update
      set scores = excluded.scores, bank_version = excluded.bank_version,
          generated_at = now(), history = excluded.history
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

/** True when this child's report has already gone out by email (rescores
 * after a deep dive must not re-send it). */
export async function reportAlreadyEmailed(childId: string): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ emailed: boolean }[]>`
    select emailed_at is not null as emailed
    from public.lead_reports where lead_child_id = ${childId}
  `;
  return rows[0]?.emailed ?? false;
}

const RETEST_DAYS = 28;

/**
 * Returns the stored four-week plan for a subject, building and arming its
 * retest on first request. Access is via the report token, so the plan page
 * needs no cookie: the token IS the family's shareable artifact, and the
 * builder is deterministic with no PII beyond what the report already shows.
 *
 * `rebuild` recomputes the plan from the latest answers and restarts the
 * four-week clock: the deep-dive flow ends here, so the month always aims
 * at the freshly found starting line.
 */
export async function getOrBuildPlan(
  reportToken: string,
  domainId: string,
  options: { rebuild?: boolean } = {},
): Promise<{ plan: FourWeekPlan; childName: string; leadId: string; childId: string; wasNew: boolean; retestAt: string } | null> {
  const sql = mapDb();
  const rows = await sql<
    {
      child_id: string;
      child_name: string;
      birth_month: string;
      child_context: Record<string, unknown>;
      lead_id: string;
      family_context: Record<string, unknown>;
    }[]
  >`
    select c.id as child_id, c.name as child_name,
           to_char(c.birth_month, 'YYYY-MM') as birth_month,
           c.context as child_context,
           f.id as lead_id, f.context as family_context
    from public.lead_reports r
    join public.lead_children c on c.id = r.lead_child_id
    join public.lead_families f on f.id = c.lead_family_id
    where r.token = ${reportToken} and r.revoked_at is null and f.status <> 'deleted'
  `;
  const row = rows[0];
  if (!row) return null;

  const existing = await sql<{ plan: FourWeekPlan; retest_at: string }[]>`
    select plan, retest_at::text as retest_at
    from public.lead_plans
    where lead_child_id = ${row.child_id} and domain_id = ${domainId}
  `;
  if (existing.length > 0 && !options.rebuild) {
    return {
      plan: existing[0].plan,
      childName: row.child_name,
      leadId: row.lead_id,
      childId: row.child_id,
      wasNew: false,
      retestAt: existing[0].retest_at,
    };
  }

  const answerRows = await sql<{ question_id: string; answer: MapAnswer }[]>`
    select question_id, answer from public.lead_answers where lead_child_id = ${row.child_id}
  `;
  const childInterests = Array.isArray(row.child_context?.interests)
    ? (row.child_context.interests as string[])
    : [];
  const familyStyle =
    typeof row.family_context?.style === "string" ? row.family_context.style : undefined;

  const plan = buildFourWeekPlan(
    domainId,
    ageInMonths(row.birth_month),
    answerRows.map((entry) => ({ itemId: entry.question_id, answer: entry.answer })),
    { interests: childInterests, style: familyStyle },
  );
  if (!plan) return null;

  // A rebuild restarts the month: fresh plan, fresh retest clock, and the
  // retest email re-armed (this is the monthly loop working as designed).
  const inserted = await sql<{ retest_at: string }[]>`
    insert into public.lead_plans (lead_child_id, domain_id, plan, bank_version, retest_at)
    values (${row.child_id}, ${domainId}, ${sql.json(plan as unknown as DbJson)},
            ${MAP_BANK_VERSION}, now() + make_interval(days => ${RETEST_DAYS}))
    on conflict (lead_child_id, domain_id) do update
      set plan = excluded.plan,
          bank_version = excluded.bank_version,
          retest_at = excluded.retest_at,
          retest_emailed_at = null
    returning retest_at::text as retest_at
  `;
  await touchLead(row.lead_id);

  return {
    plan,
    childName: row.child_name,
    leadId: row.lead_id,
    childId: row.child_id,
    wasNew: existing.length === 0,
    retestAt: inserted[0].retest_at,
  };
}

/** Plans whose four weeks are up and whose retest email hasn't gone out. */
export async function plansNeedingRetest(): Promise<
  { plan_id: string; domain_id: string; child_id: string; child_name: string; lead_id: string; email: string }[]
> {
  const sql = mapDb();
  return sql<
    { plan_id: string; domain_id: string; child_id: string; child_name: string; lead_id: string; email: string }[]
  >`
    select p.id as plan_id, p.domain_id, c.id as child_id, c.name as child_name,
           f.id as lead_id, f.email
    from public.lead_plans p
    join public.lead_children c on c.id = p.lead_child_id
    join public.lead_families f on f.id = c.lead_family_id
    where p.retest_at < now() and p.retest_emailed_at is null and f.status <> 'deleted'
    limit 100
  `;
}

export async function markRetestEmailed(planId: string): Promise<void> {
  const sql = mapDb();
  await sql`update public.lead_plans set retest_emailed_at = now() where id = ${planId}`;
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
  /** The parent's raw answers, for the expandable "what I asked" sections. */
  answers: { itemId: string; answer: MapAnswer }[];
  /** Prior scorings, newest first, for the movement chips. */
  history: ScoreSnapshot[];
  /** The lead's other kids, for the map-the-next-kid handoff. */
  otherKids: { id: string; name: string; inRange: boolean; started: boolean; hasReport: boolean }[];
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
      history: ScoreSnapshot[];
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
           r.viewed_at::text as viewed_at, r.history,
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

  const answerRows = await sql<{ question_id: string; answer: MapAnswer }[]>`
    select question_id, answer from public.lead_answers where lead_child_id = ${row.child_id}
  `;

  const siblingRows = await sql<
    { id: string; name: string; birth_month: string; answered: string; has_report: boolean }[]
  >`
    select c.id, c.name, to_char(c.birth_month, 'YYYY-MM') as birth_month,
           (select count(*)::text from public.lead_answers a where a.lead_child_id = c.id) as answered,
           exists (select 1 from public.lead_reports r2 where r2.lead_child_id = c.id) as has_report
    from public.lead_children c
    where c.lead_family_id = ${row.lead_id} and c.id <> ${row.child_id}
    order by c.created_at
  `;

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
    answers: answerRows.map((entry) => ({ itemId: entry.question_id, answer: entry.answer })),
    history: row.history ?? [],
    otherKids: siblingRows.map((kid) => ({
      id: kid.id,
      name: kid.name,
      inRange: isInScoredRange(ageInMonths(kid.birth_month)),
      started: Number(kid.answered) > 0,
      hasReport: kid.has_report,
    })),
  };
}

async function touchLead(leadId: string): Promise<void> {
  const sql = mapDb();
  await sql`update public.lead_families set updated_at = now() where id = ${leadId}`;
}

/**
 * Deep-merges an extras patch into a child's context bag (server-validated).
 * whatsWorking merges per-subject so a note about math never clobbers the
 * earlier note about reading.
 */
export async function saveChildContext(
  leadId: string,
  childId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  if (!(await childBelongsToLead(childId, leadId))) return false;
  const sql = mapDb();

  let merged = patch;
  if (patch.whatsWorking && typeof patch.whatsWorking === "object") {
    const rows = await sql<{ context: Record<string, unknown> }[]>`
      select context from public.lead_children where id = ${childId}
    `;
    const existing = (rows[0]?.context?.whatsWorking ?? {}) as Record<string, unknown>;
    merged = {
      ...patch,
      whatsWorking: { ...existing, ...(patch.whatsWorking as Record<string, unknown>) },
    };
  }

  await sql`
    update public.lead_children
    set context = context || ${sql.json(merged as unknown as DbJson)}
    where id = ${childId}
  `;
  await touchLead(leadId);
  return true;
}

/** Merges family-level extras; name and state also fill their real columns. */
export async function saveFamilyContext(
  leadId: string,
  patch: Record<string, unknown>,
  firstName?: string,
  usState?: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.lead_families
    set context = context || ${sql.json(patch as unknown as DbJson)},
        first_name = coalesce(${firstName ?? null}, first_name),
        us_state = coalesce(${usState ?? null}, us_state),
        updated_at = now()
    where id = ${leadId}
  `;
}

/** Whether family-level extras were already collected (extras step shows once). */
export async function hasFamilyContext(leadId: string): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ has: boolean }[]>`
    select context <> '{}'::jsonb as has from public.lead_families where id = ${leadId}
  `;
  return rows[0]?.has ?? false;
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
