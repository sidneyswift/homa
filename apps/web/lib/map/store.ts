import { randomUUID } from "node:crypto";

import {
  ageInMonths,
  buildFourWeekPlan,
  buildMonthPlan,
  getMapItem,
  MONTH_PLAN_SUBJECT,
  isInScoredRange,
  MAP_BANK_VERSION,
  MAP_SCORER_VERSION,
  SCORED_MAX_MONTHS,
  SCORED_MIN_MONTHS,
  scoreMap,
  type FourWeekPlan,
  type MapAnswer,
  type MapScores,
  type NarrativeMeta,
  type PlanNarrative,
  type ReportNarrative,
} from "@homa/core";

import {
  correctLegacyProgressAnswers,
  deleteLegacyProgressAnswer,
  saveLegacyProgressAnswer,
  type LegacyProgressAdapterResult,
  type LegacyProgressAnswerSource,
} from "../child-progress/legacy-adapters";
import {
  CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY,
} from "../child-progress/postgres-repository-helpers";
import { foldFamilyDataIntoTx } from "../family-fold";
import { dashboardPlanFromRow, type DashboardPlan } from "../plan-week";
import { mapDb, type DbJson } from "./db";
import { applyPlanEdits, describePlanEdits, type PlanEdit } from "./plan-edits";
import {
  cleanProfileFocus,
  cleanProfileInterests,
  firstFamilyStyle,
  profileFocusList,
  profileHelpList,
  profileInterestList,
  uniqueStrings,
} from "./profile-context";
import { hashToken, newToken } from "./tokens";
import {
  buildTrajectoryEras,
  type TrajectoryEra,
  type TrajectoryEvidenceRow,
} from "./trajectory-eras";

/**
 * All database access for the onboarding flow, ONE WORLD (founder ruling
 * 2026-07-07: architect the database as simple as possible before launch).
 * A family row is the account container from the very first tap: it starts
 * memberless (invisible to every client; RLS is members-only), reachable
 * exclusively through this server module via the resume cookie's token
 * hash. Signup attaches an auth user with a single family_members insert;
 * nothing migrates, mirrors, or bridges, because the data was always in
 * its final home.
 *
 * The tenancy law is unchanged: the family id NEVER comes from the client;
 * routes resolve it from the resume cookie (or Supabase session), and
 * every child-scoped operation re-checks that the child belongs to that
 * family.
 */

export interface FamilyRow {
  id: string;
  /** Null until signup captures it. */
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  us_state: string | null;
  status: string;
  source: string;
  /** True once any auth user holds a membership row for this family. */
  has_account: boolean;
  /** Stamped when the create-your-family step is submitted; null routes
   * the flow through that step once (founder call 2026-07-08). */
  profile_completed_at: string | null;
}

export interface FamilyChildRow {
  id: string;
  name: string;
  /** "YYYY-MM-DD", the real birthday. */
  birth_month: string;
  interests: string[];
  help_with: string | null;
  pending_band: boolean;
  age_months: number;
  in_range: boolean;
  answered: number;
  report_token: string | null;
}

export interface FamilyState {
  family: FamilyRow;
  children: FamilyChildRow[];
  answers: Record<string, { itemId: string; answer: MapAnswer }[]>;
}

const FAMILY_COLUMNS = `id, email, first_name, last_name, us_state, status, source,
  profile_completed_at::text as profile_completed_at,
  exists (select 1 from public.family_members m where m.family_id = families.id) as has_account`;

interface StartAnonymousInput {
  source: string;
  utm: Record<string, string>;
}

/**
 * S1: opens a brand-new anonymous family, no email required, right before
 * the visible entry screen asks for name, email, and password. Kids and
 * the checklist auto-save under this cookie-only row from the very first
 * tap; see attachAuthUser for the moment it becomes a real account.
 */
export async function startAnonymousFamily(
  input: StartAnonymousInput,
): Promise<{ familyId: string; resumeToken: string }> {
  const sql = mapDb();
  const resumeToken = newToken();
  const tokenHash = hashToken(resumeToken);
  const inserted = await sql<{ id: string }[]>`
    insert into public.families (email, source, utm, resume_token_hash)
    values (null, ${input.source}, ${sql.json(input.utm)}, ${tokenHash})
    returning id
  `;
  return { familyId: inserted[0].id, resumeToken };
}

/** Moves every child of `fromId` into `intoId`, then deletes the empty
 * husk. Children carry their answers, reports, and plans with them (all
 * child-keyed), so a fold never touches those tables. */
type MapDatabase = ReturnType<typeof mapDb>;

async function foldFamilyInto(
  sql: MapDatabase,
  fromId: string,
  intoId: string,
): Promise<void> {
  const folded = await sql.begin((tx) =>
    foldFamilyDataIntoTx(tx, fromId, intoId)
  );
  if (!folded) {
    throw new Error("Family fold source or destination is missing");
  }
}

interface AttachAuthUserInput {
  /** The caller's own (already anonymous, or email-only) family. */
  familyId: string;
  authUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneE164?: string;
  usState?: string;
}

/**
 * Reserved founder rehearsal alias (founder ask 2026-07-14): a signup
 * whose email carries "+homatest" before the @ (sidney+homatest3@...)
 * marks its family sandbox at the account moment. Sandbox families are
 * labeled in the console, fenced out of funnels and physical mail, and
 * deletable from the family file; product emails still send (they land
 * in the founder's own inbox via the alias, which is the point).
 */
export function isSandboxSignupEmail(email: string): boolean {
  return /\+homatest[^@]*@/i.test(email);
}

/**
 * The account moment: attaches a real Supabase Auth user to a family with
 * ONE membership insert (this is the entire former "bridge"). Mirrors
 * claimFamily's fold-together behavior: if the auth user or email already
 * owns another family, this sitting's kids fold into it. Also stamps
 * status 'claimed' and seeds the agent's first what_works memories from
 * any whats-working notes the parent left before signing up.
 */
export async function attachAuthUser(
  input: AttachAuthUserInput,
  sql: MapDatabase = mapDb(),
): Promise<{ familyId: string; returning: boolean; resumeToken: string }> {
  const resumeToken = newToken();
  const tokenHash = hashToken(resumeToken);
  // Some IdPs preserve email case; the column's lowercase constraint
  // and the fold-together's equality both demand normalization here
  // (unknowns pass 2026-07-10, U4).
  const email = input.email.trim().toLowerCase();

  // A deleted family is never a fold target: without the status filter,
  // an email whose old family was deleted (a burned test family, a
  // delete-my-data household re-signing up) would fold this sitting's
  // kids into the invisible husk and the parent would see nothing.
  const existing = await sql<{ id: string }[]>`
    select f.id from public.families f
    where f.id <> ${input.familyId}
      and f.status <> 'deleted'
      and (f.email = ${email}
           or exists (select 1 from public.family_members m
                      where m.family_id = f.id and m.user_id = ${input.authUserId}))
    limit 1
  `;

  const familyId = existing[0]?.id ?? input.familyId;
  if (existing.length > 0) {
    await foldFamilyInto(sql, input.familyId, familyId);
  }

  await sql`
    update public.families set
      email = ${email},
      first_name = coalesce(${input.firstName ?? null}, first_name),
      last_name = coalesce(${input.lastName ?? null}, last_name),
      phone_e164 = coalesce(${input.phoneE164 ?? null}, phone_e164),
      us_state = coalesce(${input.usState ?? null}, us_state),
      parent_display_name = coalesce(parent_display_name, ${input.firstName ?? null}),
      status = 'claimed',
      sandbox = sandbox or ${isSandboxSignupEmail(email)},
      resume_token_hash = ${tokenHash},
      updated_at = now()
    where id = ${familyId}
  `;
  await sql`
    insert into public.family_members (family_id, user_id, role, display_name)
    values (${familyId}, ${input.authUserId}, 'parent', ${input.firstName ?? null})
    on conflict (family_id, user_id) do nothing
  `;
  if (input.phoneE164) {
    // Bare "do nothing": the number may already belong to another family
    // (phone_e164 unique), and signup never blocks on a phone nicety.
    await sql`
      insert into public.family_phones (family_id, phone_e164, added_by, member_user_id, source)
      values (${familyId}, ${input.phoneE164}, ${input.authUserId}, ${input.authUserId}, 'signup')
      on conflict do nothing
    `;
  }
  await seedWhatWorksMemories(familyId, sql);

  return { familyId, returning: existing.length > 0, resumeToken };
}

/**
 * The agent's cold start: one what_works memory per child, from the
 * parent's own whats-working notes, seeded only while the child has none
 * (agent consolidation is never fought; re-runs never duplicate).
 */
async function seedWhatWorksMemories(
  familyId: string,
  sql: MapDatabase = mapDb(),
): Promise<void> {
  const kids = await sql<{ id: string; context: Record<string, unknown> }[]>`
    select id, context from public.children where family_id = ${familyId}
  `;
  for (const kid of kids) {
    const bag = kid.context?.whatsWorking;
    if (!bag || typeof bag !== "object") continue;
    const parts = Object.entries(bag as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0)
      .map(([subjectId, text]) => `${subjectId}: ${text.trim()}`);
    if (parts.length === 0) continue;
    const content = `What the parent says works, in her own words. ${parts.join(" \u00b7 ")}`.slice(0, 500);
    await sql`
      insert into public.family_memories (family_id, child_id, kind, content, source)
      select ${familyId}, ${kid.id}, 'what_works', ${content}, 'onboarding'
      where not exists (
        select 1 from public.family_memories
        where family_id = ${familyId} and child_id = ${kid.id} and kind = 'what_works'
      )
    `;
  }
}

/**
 * Resolves a family from a raw token: either the device cookie's resume
 * token or an emailed link token. Both are honored so an emailed link
 * never invalidates the cookie already living on her original device.
 */
export async function getFamilyByResumeToken(rawToken: string): Promise<FamilyRow | null> {
  const sql = mapDb();
  const hash = hashToken(rawToken);
  const rows = await sql<FamilyRow[]>`
    select ${sql.unsafe(FAMILY_COLUMNS)}
    from public.families
    where (resume_token_hash = ${hash} or link_token_hash = ${hash})
      and status <> 'deleted'
  `;
  return rows[0] ?? null;
}

/** The signed-in fallback: a caller with a Supabase session but no resume
 * cookie (fresh browser, emailed link opened elsewhere) still reaches
 * their own family through their membership row. */
export async function getFamilyByAuthUser(authUserId: string): Promise<FamilyRow | null> {
  const sql = mapDb();
  const rows = await sql<FamilyRow[]>`
    select ${sql.unsafe(FAMILY_COLUMNS)}
    from public.families
    where status <> 'deleted'
      and exists (select 1 from public.family_members m
                  where m.family_id = families.id and m.user_id = ${authUserId})
    limit 1
  `;
  return rows[0] ?? null;
}

export async function getFamilyByEmail(email: string): Promise<{ id: string } | null> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    select id from public.families where email = ${email} and status <> 'deleted'
  `;
  return rows[0] ?? null;
}

/**
 * Mints a fresh emailed-link token for a family. Deliberately separate
 * from the device cookie's resume token: sending an email must never log
 * out the device she's already using.
 */
export async function mintLinkToken(familyId: string): Promise<string> {
  const sql = mapDb();
  const linkToken = newToken();
  await sql`
    update public.families
    set link_token_hash = ${hashToken(linkToken)}
    where id = ${familyId}
  `;
  return linkToken;
}

export async function countChildren(familyId: string): Promise<number> {
  const sql = mapDb();
  const rows = await sql<{ count: string }[]>`
    select count(*)::text as count from public.children where family_id = ${familyId}
  `;
  return Number(rows[0]?.count ?? 0);
}

interface AddChildInput {
  name: string;
  birthDate: string; // YYYY-MM-DD, the real birthday
  interests: string[];
  helpWith?: string;
}

/** Interests and help-with live in the child's profile jsonb (the same
 * fields the chat agent's update_child_profile tool maintains), so the
 * report flow and the agent share one representation from day one.
 * Non-answers ("idk", "not sure") are dropped at this door: profile
 * values re-enter every system prompt, and "working on idk" once did
 * (2026-07-10). */
export async function addChild(
  familyId: string,
  input: AddChildInput,
): Promise<{ childId: string; ageMonths: number; inRange: boolean }> {
  const sql = mapDb();
  const months = ageInMonths(input.birthDate);
  const inRange = isInScoredRange(months);
  const profile: Record<string, unknown> = {
    interests: cleanProfileInterests(input.interests),
  };
  const focus = cleanProfileFocus(input.helpWith);
  if (focus) {
    profile.focus = focus;
  }
  const rows = await sql<{ id: string }[]>`
    insert into public.children (family_id, name, birth_month, profile, pending_band)
    values (${familyId}, ${input.name}, ${input.birthDate},
            ${sql.json(profile as DbJson)}, ${!inRange})
    returning id
  `;
  await touchFamily(familyId);
  return { childId: rows[0].id, ageMonths: months, inRange };
}

/**
 * Hard-deletes a child and, via the schema's on-delete cascades, their
 * answers, report, and plans (the "delete anytime" promise, kept). The
 * where clause carries the tenancy re-scope: a childId belonging to a
 * different family deletes nothing.
 */
export async function removeChild(
  familyId: string,
  childId: string,
  sql: MapDatabase = mapDb(),
): Promise<boolean> {
  return sql.begin(async (tx) => {
    await tx`
      select pg_advisory_xact_lock_shared(
        ${CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY}::bigint
      )
    `;
    const rows = await tx<{ id: string }[]>`
      delete from public.children
      where id = ${childId} and family_id = ${familyId}
      returning id
    `;
    if (rows.length === 0) return false;
    await tx`
      update public.families
      set updated_at = now()
      where id = ${familyId}
    `;
    return true;
  });
}

/** True when the child exists and belongs to this family. */
export async function childBelongsToFamily(childId: string, familyId: string): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    select id from public.children where id = ${childId} and family_id = ${familyId}
  `;
  return rows.length > 0;
}

export async function saveAnswer(
  familyId: string,
  childId: string,
  itemId: string,
  answer: MapAnswer,
  options: {
    source?: Extract<
      LegacyProgressAnswerSource,
      "checklist" | "deep_dive"
    >;
    memberUserId?: string | null;
    channel?: "web" | "sms" | "email";
    messageId?: string;
    providerMessageId?: string;
    observedAt?: string;
    idempotencyKey?: string;
  } = {},
): Promise<{ ok: boolean; subject?: string }> {
  const saved = await saveAnswerWithProgressStatus(
    familyId,
    childId,
    itemId,
    answer,
    options,
  );
  return saved.result.status === "saved"
    ? { ok: true, subject: saved.subject }
    : { ok: false };
}

export async function saveAnswerWithProgressStatus(
  familyId: string,
  childId: string,
  itemId: string,
  answer: MapAnswer,
  options: {
    source?: Extract<
      LegacyProgressAnswerSource,
      "checklist" | "deep_dive"
    >;
    memberUserId?: string | null;
    channel?: "web" | "sms" | "email";
    messageId?: string;
    providerMessageId?: string;
    observedAt?: string;
    idempotencyKey?: string;
  } = {},
): Promise<{
  result: LegacyProgressAdapterResult;
  subject?: string;
}> {
  const item = getMapItem(itemId);
  if (!item) {
    return { result: { status: "unknown_child_or_item" } };
  }
  if (!(await childBelongsToFamily(childId, familyId))) {
    return { result: { status: "unknown_child_or_item" } };
  }
  return {
    result: await saveLegacyProgressAnswer({
      familyId,
      childId,
      itemId,
      answer,
      source: options.source ?? "checklist",
      memberUserId: options.memberUserId ?? null,
      channel: options.channel,
      messageId: options.messageId,
      providerMessageId: options.providerMessageId,
      observedAt: options.observedAt ?? new Date().toISOString(),
      idempotencyKey:
        options.idempotencyKey ?? `legacy-answer:${randomUUID()}`,
    }),
    subject: item.subject.id,
  };
}

/**
 * Removes one stored answer, the server side of the checklist and deep
 * dive "undo last answer" affordance. Without this the undo cleared only
 * client state while the row lived on (saveAnswer is upsert-only), so
 * walking back past a ladder base left orphan rungs the scorer still read
 * (2026-07-11 review, CR-01). The where clause carries the tenancy
 * re-scope: an itemId under a child of a different family deletes nothing.
 */
export async function deleteAnswer(
  familyId: string,
  childId: string,
  itemId: string,
  options: {
    memberUserId?: string | null;
    observedAt?: string;
    idempotencyKey?: string;
  } = {},
): Promise<{ ok: boolean; subject?: string }> {
  const deleted = await deleteAnswerWithProgressStatus(
    familyId,
    childId,
    itemId,
    options,
  );
  return deleted.result.status === "saved"
    ? { ok: true, subject: deleted.subject }
    : { ok: false };
}

export async function deleteAnswerWithProgressStatus(
  familyId: string,
  childId: string,
  itemId: string,
  options: {
    memberUserId?: string | null;
    observedAt?: string;
    idempotencyKey?: string;
  } = {},
): Promise<{
  result: LegacyProgressAdapterResult;
  subject?: string;
}> {
  const item = getMapItem(itemId);
  if (!item) {
    return { result: { status: "unknown_child_or_item" } };
  }
  if (!(await childBelongsToFamily(childId, familyId))) {
    return { result: { status: "unknown_child_or_item" } };
  }
  return {
    result: await deleteLegacyProgressAnswer({
      familyId,
      childId,
      itemId,
      memberUserId: options.memberUserId ?? null,
      observedAt: options.observedAt ?? new Date().toISOString(),
      idempotencyKey:
        options.idempotencyKey ?? `legacy-delete:${randomUUID()}`,
    }),
    subject: item.subject.id,
  };
}

/**
 * The living-record write: answer changes arriving from the report page
 * itself (a tapped correction, the inline sharpening question, a
 * staleness re-check), batched so one save means one rescore and one
 * rewrite. Corrections stamp their provenance so the re-norm loop can
 * tell a second look from a first.
 */
export async function correctAnswers(
  familyId: string,
  childId: string,
  changes: Array<{ itemId: string; answer: MapAnswer }>,
  source: "report_correction" | "report_probe" | "recheck" | "conversation",
  options: {
    memberUserId?: string | null;
    observedAt?: string;
    idempotencyKey?: string;
  } = {},
): Promise<boolean> {
  return (
    await correctAnswersWithProgressStatus(
      familyId,
      childId,
      changes,
      source,
      options,
    )
  ).status === "saved";
}

export async function correctAnswersWithProgressStatus(
  familyId: string,
  childId: string,
  changes: Array<{ itemId: string; answer: MapAnswer | null }>,
  source:
    | "report_correction"
    | "report_probe"
    | "recheck"
    | "conversation",
  options: {
    memberUserId?: string | null;
    observedAt?: string;
    idempotencyKey?: string;
  } = {},
): Promise<LegacyProgressAdapterResult> {
  if (!(await childBelongsToFamily(childId, familyId))) {
    return { status: "unknown_child_or_item" };
  }
  return correctLegacyProgressAnswers({
    familyId,
    childId,
    changes,
    source,
    memberUserId: options.memberUserId ?? null,
    observedAt: options.observedAt ?? new Date().toISOString(),
    idempotencyKey:
      options.idempotencyKey ?? `legacy-correction:${randomUUID()}`,
  });
}

/**
 * Syncs the four-week plan's check-offs server-side (idempotent full-map
 * write). Null when no plan exists for this child + subject; the client
 * keeps its localStorage copy either way, so a shared-link viewer loses
 * nothing and forges nothing.
 */
export function prunePlanChecks(
  plan: Pick<FourWeekPlan, "weeks">,
  checks: Record<string, boolean>,
): Record<string, boolean> {
  const allowed = new Set<string>();
  for (const week of plan.weeks) {
    week.activities.forEach((_, index) => allowed.add(`${week.week}.${index}`));
  }
  return Object.fromEntries(
    Object.entries(checks).filter(([key]) => allowed.has(key)),
  ) as Record<string, boolean>;
}

export async function savePlanProgress(
  familyId: string,
  childId: string,
  subjectId: string,
  checks: Record<string, boolean>,
): Promise<{ done: number } | null> {
  if (!(await childBelongsToFamily(childId, familyId))) return null;
  const sql = mapDb();
  const rows = await sql<{ id: string; plan: FourWeekPlan }[]>`
    select id, plan
    from public.child_plans
    where child_id = ${childId} and subject_id = ${subjectId}
  `;
  const plan = rows[0];
  if (!plan) return null;

  const pruned = prunePlanChecks(plan.plan, checks);
  await sql`
    update public.child_plans
    set progress = ${sql.json(pruned as unknown as DbJson)}, updated_at = now()
    where id = ${plan.id}
  `;
  await touchFamily(familyId);
  return { done: Object.values(pruned).filter(Boolean).length };
}

/** The child's report token, re-scoped to the caller's family (for the
 * consent tap, which builds a plan through the token path). */
export async function getReportTokenForChild(
  familyId: string,
  childId: string,
): Promise<string | null> {
  if (!(await childBelongsToFamily(childId, familyId))) return null;
  const sql = mapDb();
  const rows = await sql<{ token: string }[]>`
    select token from public.child_reports
    where child_id = ${childId} and revoked_at is null and token is not null
  `;
  return rows[0]?.token ?? null;
}

/**
 * The week board as agent tools see it: every child in the family (or
 * one child when narrowed), their report tokens, and their stored plans.
 * Server connection with the explicit family predicate as the wall, the
 * same trust basis as savePlanProgress above: familyId arrives from the
 * session's authenticated attributes, never from the model.
 */
export interface PlanBoardChild {
  id: string;
  name: string;
  avatarUrl: string | null;
  reportToken: string | null;
}

export async function getPlanBoard(
  familyId: string,
  childId?: string | null,
): Promise<{ children: PlanBoardChild[]; plans: DashboardPlan[] } | null> {
  const sql = mapDb();
  const children = await sql<
    { id: string; name: string; avatar_url: string | null; token: string | null }[]
  >`
    select c.id, c.name, c.avatar_url, r.token
    from public.children c
    left join public.child_reports r on r.child_id = c.id and r.revoked_at is null
    where c.family_id = ${familyId}
    order by c.created_at
  `;
  const scoped = childId
    ? children.filter((child) => child.id === childId)
    : children;
  if (childId && scoped.length === 0) return null;
  const childIds = scoped.map((child) => child.id);
  const planRows =
    childIds.length === 0
      ? []
      : await sql<
          {
            child_id: string;
            subject_id: string;
            plan: FourWeekPlan;
            progress: Record<string, boolean> | null;
            retest_at: string;
          }[]
        >`
          select p.child_id, p.subject_id, p.plan, p.progress,
                 to_char(p.retest_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as retest_at
          from public.child_plans p
          join public.children c on c.id = p.child_id
          where p.child_id in ${sql(childIds)} and c.family_id = ${familyId}
        `;
  return {
    children: scoped.map((child) => ({
      id: child.id,
      name: child.name,
      avatarUrl: child.avatar_url,
      reportToken: child.token,
    })),
    plans: planRows.flatMap((row) => {
      const shaped = dashboardPlanFromRow(row);
      return shaped ? [shaped] : [];
    }),
  };
}

export type EditPlanOutcome =
  | { status: "applied"; summary: string; plan: FourWeekPlan; added: number; replaced: number; removed: number }
  | { status: "unknown_child" }
  | { status: "no_plan" }
  | { status: "invalid_edit"; note: string };

/**
 * Applies activity edits to one stored plan (the edit_plan agent tool's
 * write). Atomic per batch: plan-edits.ts validates every edit against
 * the copy before anything is written, and the one UPDATE writes plan
 * and remapped progress together so checks can never point at moved
 * activities.
 */
export async function editPlanActivities(
  familyId: string,
  childId: string,
  subjectId: string,
  edits: readonly PlanEdit[],
): Promise<EditPlanOutcome> {
  if (!(await childBelongsToFamily(childId, familyId))) {
    return { status: "unknown_child" };
  }
  const sql = mapDb();
  const rows = await sql<
    { id: string; plan: FourWeekPlan; progress: Record<string, boolean> | null }[]
  >`
    select id, plan, progress
    from public.child_plans
    where child_id = ${childId} and subject_id = ${subjectId}
  `;
  const row = rows[0];
  if (!row) return { status: "no_plan" };

  const applied = applyPlanEdits(row.plan, row.progress ?? {}, edits);
  if (!applied.ok) {
    return { status: "invalid_edit", note: applied.failure.note };
  }
  await sql`
    update public.child_plans
    set plan = ${sql.json(applied.result.plan as unknown as DbJson)},
        progress = ${sql.json(applied.result.progress as unknown as DbJson)},
        updated_at = now()
    where id = ${row.id}
  `;
  await touchFamily(familyId);
  return {
    status: "applied",
    summary: describePlanEdits(edits),
    plan: applied.result.plan,
    added: applied.result.added,
    replaced: applied.result.replaced,
    removed: applied.result.removed,
  };
}

/** True when this child already has a stored plan for the subject. The
 * wall's existing-content exemption reads this: viewing or refreshing a
 * plan that exists stays open, only building a NEW one is gated
 * (plans/2026-07-11-the-wall.md). */
export async function planExists(childId: string, subjectId: string): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ one: number }[]>`
    select 1 as one from public.child_plans
    where child_id = ${childId} and subject_id = ${subjectId}
    limit 1
  `;
  return rows.length > 0;
}

/** Full state snapshot for resume: children, answers, report tokens. */
export async function getFamilyState(family: FamilyRow): Promise<FamilyState> {
  const sql = mapDb();
  const children = await sql<
    {
      id: string;
      name: string;
      birth_month: string;
      profile: Record<string, unknown>;
      pending_band: boolean;
      report_token: string | null;
    }[]
  >`
    select c.id, c.name, to_char(c.birth_month, 'YYYY-MM-DD') as birth_month,
           c.profile, c.pending_band, r.token as report_token
    from public.children c
    left join public.child_reports r on r.child_id = c.id and r.revoked_at is null
    where c.family_id = ${family.id}
    order by c.created_at
  `;

  const answers: FamilyState["answers"] = {};
  if (children.length > 0) {
    const childIds = children.map((child) => child.id);
    const rows = await sql<{ child_id: string; question_id: string; answer: MapAnswer }[]>`
      select child_id, question_id, answer
      from public.child_answers
      where child_id in ${sql(childIds)}
    `;
    for (const row of rows) {
      const list = answers[row.child_id] ?? [];
      list.push({ itemId: row.question_id, answer: row.answer });
      answers[row.child_id] = list;
    }
  }

  return {
    family,
    children: children.map((child) => {
      const months = ageInMonths(child.birth_month);
      const profile = child.profile ?? {};
      return {
        id: child.id,
        name: child.name,
        birth_month: child.birth_month,
        interests: profileInterestList(profile.interests),
        help_with: profileFocusList(profile)[0] ?? null,
        pending_band: child.pending_band,
        age_months: months,
        in_range: isInScoredRange(months),
        answered: (answers[child.id] ?? []).length,
        report_token: child.report_token,
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
  /** Null only if scoring somehow ran before signup; callers must guard. */
  email: string | null;
  childId: string;
}

/** One archived scoring, kept so the report can show dated movement.
 * Snapshots from the narrative era also archive the words that shipped
 * with those numbers; older entries simply lack the keys. Snapshots
 * from the measurement-basis era (2026-07-13) also carry the ruler that
 * produced the numbers: the scorer rules version and the birth date +
 * age used at scoring time (the trajectory investigation found all
 * three changing under the chart with no way to tell from the archive).
 * Older entries lack the stamps, which render paths read as "basis
 * unknown". */
export interface ScoreSnapshot {
  scores: MapScores;
  generated_at: string;
  bank_version: string;
  scorer_version?: string | null;
  birth_date?: string | null;
  age_months?: number | null;
  narrative?: ReportNarrative | null;
  narrative_meta?: NarrativeMeta | null;
}

const HISTORY_CAP = 12;

/**
 * Scores a child from their stored answers and upserts the report row.
 * A rescore archives the previous scores into history (newest first,
 * capped), which powers the "+4 mo since June 6" movement chips. The
 * token survives rescores: the report URL is permanent.
 */
export async function createReport(familyId: string, childId: string): Promise<ScoredReport | null> {
  if (!(await childBelongsToFamily(childId, familyId))) return null;
  const sql = mapDb();

  const childRows = await sql<{ name: string; birth_month: string }[]>`
    select name, to_char(birth_month, 'YYYY-MM-DD') as birth_month
    from public.children where id = ${childId}
  `;
  if (childRows.length === 0) return null;
  const ageMonths = ageInMonths(childRows[0].birth_month);

  const answerRows = await sql<{ question_id: string; answer: MapAnswer }[]>`
    select question_id, answer from public.child_answers where child_id = ${childId}
  `;
  const scores = scoreMap(
    ageMonths,
    answerRows.map((row) => ({ itemId: row.question_id, answer: row.answer })),
  );

  const existing = await sql<
    {
      scores: MapScores;
      generated_at: string;
      bank_version: string;
      scorer_version: string | null;
      scored_birth_date: string | null;
      scored_age_months: number | null;
      history: ScoreSnapshot[];
      narrative: ReportNarrative | null;
      narrative_meta: NarrativeMeta | null;
      token: string | null;
    }[]
  >`
    select scores, generated_at::text as generated_at, bank_version,
           scorer_version, to_char(scored_birth_date, 'YYYY-MM-DD') as scored_birth_date,
           scored_age_months, history,
           narrative, narrative_meta, token
    from public.child_reports where child_id = ${childId}
  `;
  const history: ScoreSnapshot[] =
    existing.length > 0
      ? [
          {
            scores: existing[0].scores,
            generated_at: existing[0].generated_at,
            bank_version: existing[0].bank_version,
            scorer_version: existing[0].scorer_version,
            birth_date: existing[0].scored_birth_date,
            age_months: existing[0].scored_age_months,
            narrative: existing[0].narrative,
            narrative_meta: existing[0].narrative_meta,
          },
          ...existing[0].history,
        ].slice(0, HISTORY_CAP)
      : [];

  // A rescore always rewrites the words next to the new numbers (founder
  // ruling: regenerate on every rescore): the archived narrative rides in
  // history and the live row's narrative resets until generation lands.
  const token = existing[0]?.token ?? newToken();
  await sql`
    insert into public.child_reports (child_id, scores, bank_version,
            scorer_version, scored_birth_date, scored_age_months,
            token, history, generated_at, updated_at)
    values (${childId}, ${sql.json(scores as unknown as DbJson)}, ${MAP_BANK_VERSION},
            ${MAP_SCORER_VERSION}, ${childRows[0].birth_month}, ${ageMonths},
            ${token}, ${sql.json(history as unknown as DbJson)}, now(), now())
    on conflict (child_id) do update
      set scores = excluded.scores, bank_version = excluded.bank_version,
          scorer_version = excluded.scorer_version,
          scored_birth_date = excluded.scored_birth_date,
          scored_age_months = excluded.scored_age_months,
          generated_at = now(), updated_at = now(), history = excluded.history,
          narrative = null, narrative_meta = null
  `;

  const familyRows = await sql<{ email: string | null }[]>`
    select email from public.families where id = ${familyId}
  `;
  await touchFamily(familyId);

  return {
    token,
    scores,
    childName: childRows[0].name,
    ageMonths,
    email: familyRows[0].email,
    childId,
  };
}

export async function markReportEmailed(familyId: string, childId: string): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.child_reports
    set emailed_at = now()
    where child_id = ${childId}
      and exists (
        select 1 from public.children c
        where c.id = ${childId} and c.family_id = ${familyId}
      )
  `;
}

/** True when this child's report has already gone out by email (rescores
 * after a deep dive must not re-send it). */
export async function reportAlreadyEmailed(familyId: string, childId: string): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ emailed: boolean }[]>`
    select emailed_at is not null as emailed
    from public.child_reports r
    join public.children c on c.id = r.child_id
    where r.child_id = ${childId} and c.family_id = ${familyId}
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
  subjectId: string,
  options: { rebuild?: boolean } = {},
): Promise<{
  plan: FourWeekPlan;
  childName: string;
  familyId: string;
  childId: string;
  wasNew: boolean;
  retestAt: string;
  narrative: PlanNarrative | null;
  narrativeMeta: NarrativeMeta | null;
  /** Synced check-offs ("week.activityIndex" to done), server truth. */
  progress: Record<string, boolean>;
} | null> {
  const sql = mapDb();
  const rows = await sql<
    {
      child_id: string;
      child_name: string;
      birth_month: string;
      child_profile: Record<string, unknown>;
      child_context: Record<string, unknown>;
      family_id: string;
      family_context: Record<string, unknown>;
    }[]
  >`
    select c.id as child_id, c.name as child_name,
           to_char(c.birth_month, 'YYYY-MM-DD') as birth_month,
           c.profile as child_profile, c.context as child_context,
           f.id as family_id, f.context as family_context
    from public.child_reports r
    join public.children c on c.id = r.child_id
    join public.families f on f.id = c.family_id
    where r.token = ${reportToken} and r.revoked_at is null and f.status <> 'deleted'
  `;
  const row = rows[0];
  if (!row) return null;

  const existing = await sql<
    {
      plan: FourWeekPlan;
      retest_at: string;
      narrative: PlanNarrative | null;
      narrative_meta: NarrativeMeta | null;
      progress: Record<string, boolean>;
    }[]
  >`
    select plan, retest_at::text as retest_at, narrative, narrative_meta, progress
    from public.child_plans
    where child_id = ${row.child_id} and subject_id = ${subjectId}
  `;
  if (existing.length > 0 && !options.rebuild) {
    return {
      plan: existing[0].plan,
      childName: row.child_name,
      familyId: row.family_id,
      childId: row.child_id,
      wasNew: false,
      retestAt: existing[0].retest_at,
      narrative: existing[0].narrative,
      narrativeMeta: existing[0].narrative_meta,
      progress: existing[0].progress ?? {},
    };
  }

  const answerRows = await sql<{ question_id: string; answer: MapAnswer }[]>`
    select question_id, answer from public.child_answers where child_id = ${row.child_id}
  `;
  const profileInterests = profileInterestList(row.child_profile?.interests);
  const bagInterests = profileInterestList(row.child_context?.interests);
  const familyStyle = firstFamilyStyle(row.family_context);

  const planContext = {
    interests: uniqueStrings(profileInterests, bagInterests),
    style: familyStyle,
  };
  const planAnswers = answerRows.map((entry) => ({
    itemId: entry.question_id,
    answer: entry.answer,
  }));
  // The unified month (read-through ruling: one plan for the whole
  // child) stores under its pseudo-domain and builds with the weighted
  // month builder; per-subject plans stay as the drill-down.
  const plan =
    subjectId === MONTH_PLAN_SUBJECT
      ? buildMonthPlan(ageInMonths(row.birth_month), planAnswers, planContext)
      : buildFourWeekPlan(subjectId, ageInMonths(row.birth_month), planAnswers, planContext);
  if (!plan) return null;

  // A rebuild restarts the month: fresh plan, fresh retest clock, the
  // retest email re-armed, and the plan narrative reset so the words get
  // rewritten next to the new month. Checks are the parent's own work
  // (source data) and survive the rebuild.
  const inserted = await sql<{ retest_at: string }[]>`
    insert into public.child_plans (child_id, subject_id, plan, bank_version, retest_at)
    values (${row.child_id}, ${subjectId}, ${sql.json(plan as unknown as DbJson)},
            ${MAP_BANK_VERSION}, now() + make_interval(days => ${RETEST_DAYS}))
    on conflict (child_id, subject_id) do update
      set plan = excluded.plan,
          bank_version = excluded.bank_version,
          retest_at = excluded.retest_at,
          retest_emailed_at = null,
          narrative = null,
          narrative_meta = null,
          updated_at = now()
    returning retest_at::text as retest_at
  `;
  await touchFamily(row.family_id);

  return {
    plan,
    childName: row.child_name,
    familyId: row.family_id,
    childId: row.child_id,
    wasNew: existing.length === 0,
    retestAt: inserted[0].retest_at,
    narrative: null,
    narrativeMeta: null,
    progress: existing[0]?.progress ?? {},
  };
}

/** Plans whose four weeks are up and whose retest email hasn't gone out. */
export async function plansNeedingRetest(): Promise<
  { plan_id: string; subject_id: string; child_id: string; child_name: string; family_id: string; email: string }[]
> {
  const sql = mapDb();
  return sql<
    { plan_id: string; subject_id: string; child_id: string; child_name: string; family_id: string; email: string }[]
  >`
    select p.id as plan_id, p.subject_id, c.id as child_id, c.name as child_name,
           f.id as family_id, f.email
    from public.child_plans p
    join public.children c on c.id = p.child_id
    join public.families f on f.id = c.family_id
    where p.retest_at < now() and p.retest_emailed_at is null and f.status <> 'deleted'
      and f.email is not null
    limit 100
  `;
}

export async function markRetestEmailed(planId: string): Promise<void> {
  const sql = mapDb();
  await sql`update public.child_plans set retest_emailed_at = now() where id = ${planId}`;
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
  familyId: string;
  childId: string;
  firstView: boolean;
  /** The parent's raw answers, for the expandable "what I asked" sections. */
  answers: { itemId: string; answer: MapAnswer }[];
  /** Prior scorings, newest first, for the movement chips. */
  history: ScoreSnapshot[];
  /** The trajectory chart's scorings, oldest first, re-normalized to
   * one measuring stick where the evidence ledger reaches (fix 3 of the
   * mixed-scales investigation); stored numbers plus a basis
   * fingerprint where it does not. */
  eras: TrajectoryEra[];
  /** The family's other kids, for the map-the-next-kid handoff. */
  otherKids: { id: string; name: string; inRange: boolean; started: boolean; hasReport: boolean }[];
  /** The LLM-written layer (null until generated; see narrative-store). */
  narrative: ReportNarrative | null;
  narrativeMeta: NarrativeMeta | null;
  /** The child's built months: check-off counts for the your-month panel
   * and plan existence for the consent card. */
  plans: { subjectId: string; done: number; total: number; retestAt: string }[];
  /** The family's linked texting/calling number, if any (family_phones,
   * migration #22), so the "Call Homa" card can prefill instead of ask
   * again. Null when nothing is linked yet. */
  familyPhone: string | null;
}

/**
 * The evidence ledger slice the trajectory re-normalization reads:
 * every row (active and superseded) for one child, so answer sets can
 * be reconstructed as of any past scoring. The where clause carries the
 * tenancy re-scope; a childId under another family reads nothing.
 */
export async function getTrajectoryEvidence(
  familyId: string,
  childId: string,
): Promise<TrajectoryEvidenceRow[]> {
  const sql = mapDb();
  const rows = await sql<
    {
      item_id: string;
      answer: TrajectoryEvidenceRow["answer"];
      observed_at: string;
      superseded_at: string | null;
      created_at: string;
    }[]
  >`
    select item_id, answer,
           to_char(observed_at at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as observed_at,
           case when superseded_at is null then null else
             to_char(superseded_at at time zone 'UTC',
                     'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
           end as superseded_at,
           to_char(created_at at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at
    from public.child_progress_evidence
    where child_id = ${childId} and family_id = ${familyId}
    order by observed_at, created_at
  `;
  return rows.map((row) => ({
    itemId: row.item_id,
    answer: row.answer,
    observedAt: row.observed_at,
    supersededAt: row.superseded_at,
    createdAt: row.created_at,
  }));
}

export async function getReportEventIdsByToken(
  token: string,
): Promise<{ familyId: string; childId: string } | null> {
  const sql = mapDb();
  const rows = await sql<{ family_id: string; child_id: string }[]>`
    select f.id as family_id, c.id as child_id
    from public.child_reports r
    join public.children c on c.id = r.child_id
    join public.families f on f.id = c.family_id
    where r.token = ${token} and r.revoked_at is null and f.status <> 'deleted'
  `;
  const row = rows[0];
  return row ? { familyId: row.family_id, childId: row.child_id } : null;
}

/** Loads a report by URL token and stamps first view. Null when
 * revoked/unknown. The founder's admin mirror passes stampFirstView
 * false: "did she open it" is a receipt about HER, and a founder look
 * must never forge it. */
export async function getReportByToken(
  token: string,
  options: { stampFirstView?: boolean } = {},
): Promise<ReportView | null> {
  const sql = mapDb();
  const rows = await sql<
    {
      token: string;
      scores: MapScores;
      bank_version: string;
      generated_at: string;
      viewed_at: string | null;
      history: ScoreSnapshot[];
      narrative: ReportNarrative | null;
      narrative_meta: NarrativeMeta | null;
      child_id: string;
      child_name: string;
      birth_month: string;
      profile: Record<string, unknown>;
      family_id: string;
      first_name: string | null;
      us_state: string | null;
    }[]
  >`
    select r.token, r.scores, r.bank_version, r.generated_at::text as generated_at,
           r.viewed_at::text as viewed_at, r.history, r.narrative, r.narrative_meta,
           c.id as child_id, c.name as child_name,
           to_char(c.birth_month, 'YYYY-MM-DD') as birth_month, c.profile,
           f.id as family_id, f.first_name, f.us_state
    from public.child_reports r
    join public.children c on c.id = r.child_id
    join public.families f on f.id = c.family_id
    where r.token = ${token} and r.revoked_at is null and f.status <> 'deleted'
  `;
  const row = rows[0];
  if (!row) return null;

  const firstView = row.viewed_at === null;
  if (firstView && (options.stampFirstView ?? true)) {
    await sql`update public.child_reports set viewed_at = now() where token = ${token}`;
  }

  const answerRows = await sql<{ question_id: string; answer: MapAnswer }[]>`
    select question_id, answer from public.child_answers where child_id = ${row.child_id}
  `;

  const siblingRows = await sql<
    { id: string; name: string; birth_month: string; answered: string; has_report: boolean }[]
  >`
    select c.id, c.name, to_char(c.birth_month, 'YYYY-MM-DD') as birth_month,
           (select count(*)::text from public.child_answers a where a.child_id = c.id) as answered,
           exists (select 1 from public.child_reports r2 where r2.child_id = c.id) as has_report
    from public.children c
    where c.family_id = ${row.family_id} and c.id <> ${row.child_id}
    order by c.created_at
  `;

  const planRows = await sql<
    { subject_id: string; plan: FourWeekPlan; progress: Record<string, boolean>; retest_at: string }[]
  >`
    select subject_id, plan, progress, retest_at::text as retest_at
    from public.child_plans where child_id = ${row.child_id}
  `;

  const phoneRows = await sql<{ phone_e164: string }[]>`
    select phone_e164 from public.family_phones where family_id = ${row.family_id}
    order by created_at
    limit 1
  `;

  const history = row.history ?? [];
  const eras = buildTrajectoryEras({
    archived: [...history].reverse(),
    live: { generated_at: row.generated_at, scores: row.scores },
    evidence: await getTrajectoryEvidence(row.family_id, row.child_id),
    birthDate: row.birth_month,
  });

  const profile = row.profile ?? {};
  return {
    token: row.token,
    scores: row.scores,
    bankVersion: row.bank_version,
    generatedAt: row.generated_at,
    childName: row.child_name,
    birthMonth: row.birth_month,
    interests: profileInterestList(profile.interests),
    parentFirstName: row.first_name,
    usState: row.us_state,
    familyId: row.family_id,
    childId: row.child_id,
    firstView,
    answers: answerRows.map((entry) => ({ itemId: entry.question_id, answer: entry.answer })),
    history,
    eras,
    narrative: row.narrative,
    narrativeMeta: row.narrative_meta,
    otherKids: siblingRows.map((kid) => ({
      id: kid.id,
      name: kid.name,
      inRange: isInScoredRange(ageInMonths(kid.birth_month)),
      started: Number(kid.answered) > 0,
      hasReport: kid.has_report,
    })),
    plans: planRows.map((plan) => ({
      subjectId: plan.subject_id,
      done: Object.values(plan.progress ?? {}).filter(Boolean).length,
      total: plan.plan.weeks.reduce((sum, week) => sum + week.activities.length, 0),
      retestAt: plan.retest_at,
    })),
    familyPhone: phoneRows[0]?.phone_e164 ?? null,
  };
}

async function touchFamily(familyId: string): Promise<void> {
  const sql = mapDb();
  await sql`update public.families set updated_at = now() where id = ${familyId}`;
}

/**
 * Deep-merges an extras patch into a child's context bag (server-validated).
 * whatsWorking merges per-subject so a note about math never clobbers the
 * earlier note about reading. Interests and help-with go to the child's
 * PROFILE (the agent's representation); everything else stays in context.
 */
export async function saveChildContext(
  familyId: string,
  childId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  if (!(await childBelongsToFamily(childId, familyId))) return false;
  const sql = mapDb();

  const { interests, helpWith, ...rest } = patch;
  let merged = rest;
  if (rest.whatsWorking && typeof rest.whatsWorking === "object") {
    const rows = await sql<{ context: Record<string, unknown> }[]>`
      select context from public.children where id = ${childId}
    `;
    const existing = (rows[0]?.context?.whatsWorking ?? {}) as Record<string, unknown>;
    merged = {
      ...rest,
      whatsWorking: { ...existing, ...(rest.whatsWorking as Record<string, unknown>) },
    };
  }

  const profilePatch: Record<string, unknown> = {};
  if (Array.isArray(interests)) {
    const real = cleanProfileInterests(interests);
    if (real.length > 0) profilePatch.interests = real;
  }
  if (Array.isArray(helpWith)) {
    const real = profileHelpList(helpWith);
    if (real.length > 0) profilePatch.focus = real.join(", ");
  }

  await sql`
    update public.children
    set context = context || ${sql.json(merged as unknown as DbJson)},
        profile = profile || ${sql.json(profilePatch as DbJson)},
        updated_at = now()
    where id = ${childId}
  `;
  await touchFamily(familyId);
  return true;
}

interface FamilySetupInput {
  familyName: string;
  firstName: string;
  lastName?: string;
  addressLine?: string;
  city?: string;
  usState?: string;
  zip?: string;
  phoneE164?: string;
  avatarUrl?: string;
}

/**
 * The create-your-family step's one write (founder call 2026-07-08): the
 * family's display name, the parent's name, the address, the phone, and
 * the optional avatar land on the family row together, and
 * profile_completed_at stamps the step done so it never re-asks. The
 * phone also goes to family_phones separately (the texting routing table
 * with its own uniqueness law); the caller handles that, this only fills
 * the family row's own column. The parent named THEMSELF on this form,
 * so their own membership row gets the same display name (multi-parent
 * v0: greetings prefer the member's name over the family-level one).
 */
export async function saveFamilySetup(
  familyId: string,
  input: FamilySetupInput,
  authUserId?: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.families set
      name = ${input.familyName},
      first_name = ${input.firstName},
      last_name = coalesce(${input.lastName ?? null}, last_name),
      parent_display_name = ${input.firstName},
      address_line = ${input.addressLine ?? null},
      address_city = ${input.city ?? null},
      address_zip = ${input.zip ?? null},
      us_state = coalesce(${input.usState ?? null}, us_state),
      phone_e164 = coalesce(${input.phoneE164 ?? null}, phone_e164),
      parent_avatar_url = ${input.avatarUrl ?? null},
      profile_completed_at = now(),
      updated_at = now()
    where id = ${familyId}
  `;
  if (authUserId) {
    // The photo is the parent's own, so it lands on their membership row
    // too (migration #74); coalesce keeps a photo they already had when
    // this form is submitted without one.
    await sql`
      update public.family_members
      set display_name = ${input.firstName},
          avatar_url = coalesce(${input.avatarUrl ?? null}, avatar_url)
      where family_id = ${familyId} and user_id = ${authUserId}
    `;
  }
}

/** Merges family-level extras; name and state also fill their real columns. */
export async function saveFamilyContext(
  familyId: string,
  patch: Record<string, unknown>,
  firstName?: string,
  usState?: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.families
    set context = context || ${sql.json(patch as unknown as DbJson)},
        first_name = coalesce(${firstName ?? null}, first_name),
        us_state = coalesce(${usState ?? null}, us_state),
        updated_at = now()
    where id = ${familyId}
  `;
}

/** Whether family-level extras were already collected (extras step shows once). */
export async function hasFamilyContext(familyId: string): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ has: boolean }[]>`
    select context <> '{}'::jsonb as has from public.families where id = ${familyId}
  `;
  return rows[0]?.has ?? false;
}

/** Mirrors the family into the waitlist table so the invite list stays one list. */
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

/**
 * Families eligible for the single 24h reminder: signed up, stalled for
 * hours, and NO report generated for anyone yet (the true onboarding
 * stall; a family with any report gets the retest loop instead, never
 * this). Statuses 'open' and 'claimed' both qualify. Since signup moved
 * to the start of the flow (founder call 2026-07-08), every family with
 * an email is 'claimed' the moment it exists, and the old status = 'open'
 * gate silently matched nobody: zero reminders ever sent in production
 * (found 2026-07-14 tracing a stalled family).
 */
export async function familiesNeedingReminder(): Promise<
  { id: string; email: string; first_child: string | null }[]
> {
  const sql = mapDb();
  return sql<{ id: string; email: string; first_child: string | null }[]>`
    select f.id, f.email,
      (select c.name from public.children c
        where c.family_id = f.id
          and not exists (select 1 from public.child_reports r where r.child_id = c.id)
        order by c.created_at limit 1) as first_child
    from public.families f
    where f.status in ('open', 'claimed')
      and f.email is not null
      and f.reminder_sent_at is null
      and f.created_at < now() - interval '24 hours'
      and f.updated_at < now() - interval '4 hours'
      and not exists (
        select 1 from public.child_reports r
        join public.children c on c.id = r.child_id
        where c.family_id = f.id
      )
      and exists (
        select 1 from public.children c
        where c.family_id = f.id and not c.pending_band
      )
    limit 50
  `;
}

export async function markReminderSent(familyId: string): Promise<void> {
  const sql = mapDb();
  await sql`update public.families set reminder_sent_at = now() where id = ${familyId}`;
}

/**
 * Purges anonymous families that never became anything: no email, no
 * member, no kids, untouched for a week. Every visitor who taps "start"
 * and bounces leaves one of these rows, and nothing else ever deletes
 * them. Deliberately NARROW: an anonymous family WITH kids is never
 * purged, because the family's device cookie can still resume it. Zero
 * data loss by construction.
 */
export async function purgeEmptyAnonymousLeads(): Promise<number> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    delete from public.families f
    where f.email is null
      and f.created_at < now() - interval '7 days'
      and f.updated_at < now() - interval '7 days'
      and not exists (select 1 from public.children c where c.family_id = f.id)
      and not exists (select 1 from public.family_members m where m.family_id = f.id)
    returning id
  `;
  return rows.length;
}

/**
 * Pending-band children whose age is now inside the scored range.
 * Email-gated: a pending-band-only family is routed through signup before
 * ever reaching the hub, but a defensive filter here means an abandoned
 * signup just retries later instead of failing every cron run.
 */
export async function childrenNowInBand(): Promise<
  { child_id: string; child_name: string; family_id: string; email: string; birth_month: string }[]
> {
  const sql = mapDb();
  const rows = await sql<
    { child_id: string; child_name: string; family_id: string; email: string; birth_month: string }[]
  >`
    with bounds as (
      select
        ((now() at time zone 'utc')::date - (${SCORED_MIN_MONTHS} * interval '1 month'))::date
          as youngest_scored_birth_date,
        ((now() at time zone 'utc')::date - (${SCORED_MAX_MONTHS} * interval '1 month'))::date
          as oldest_scored_birth_date
    )
    select c.id as child_id, c.name as child_name, f.id as family_id, f.email,
           to_char(c.birth_month, 'YYYY-MM-DD') as birth_month
    from public.children c
    join public.families f on f.id = c.family_id
    cross join bounds b
    where c.pending_band and c.band_ready_emailed_at is null and f.status <> 'deleted'
      and f.email is not null
      and c.birth_month <= b.youngest_scored_birth_date
      and c.birth_month > b.oldest_scored_birth_date
    order by c.created_at asc, c.id asc
    limit 200
  `;
  return rows;
}

export async function markBandReady(familyId: string, childId: string): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.children
    set pending_band = false, band_ready_emailed_at = now(), updated_at = now()
    where id = ${childId} and family_id = ${familyId}
  `;
}
