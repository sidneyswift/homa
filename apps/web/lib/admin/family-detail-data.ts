import {
  ageInMonths,
  buildMapQuestionQueue,
  isInScoredRange,
  isMapChecklistComplete,
  planQuestions,
  type MapAnswer,
} from "@homa/core";

import { adminDb } from "./db";
import { deriveFamilyStage, type FamilyStage } from "./stage";
import { summarizeUsageCost } from "../model-pricing";
import { getModelPriceBook } from "../model-pricing-live";

/**
 * One family's whole story for /admin/families/[familyId] (MJ-14,
 * direction 2's drawer as a page). Counts and receipts, not transcripts:
 * message content stays out of the console on purpose; the founder can
 * read totals and delivery truth without paging through conversations.
 */

/**
 * One kid's onboarding truth for the family page: how far the checklist
 * got, whether the report exists, and whether one could build right now.
 * Answers the founder's stuck-family question ("did she answer all the
 * questions, or did scoring fail?") from data instead of guesswork.
 */
export interface FamilyDetailKid {
  id: string;
  name: string;
  birthDate: string;
  /** False for kids outside the scored 2 to 16 band (pending_band). */
  inScoredBand: boolean;
  /** Checklist answers saved so far. */
  answered: number;
  /** Questions the adaptive queue would still ask today (0 = done). */
  questionsLeft: number;
  /** True when the checklist started and nothing remains to ask, which
   * means a report can be scored right now; it builds automatically the
   * moment she returns to the flow. */
  readyToScore: boolean;
  lastAnswerAt: string | null;
  hasReport: boolean;
  reportAt: string | null;
  reportViewedAt: string | null;
  reportEmailedAt: string | null;
}

export interface FamilyDetail {
  id: string;
  name: string;
  parentName: string | null;
  email: string | null;
  phone: string | null;
  usState: string | null;
  timeZone: string | null;
  createdAt: string;
  profileCompletedAt: string | null;
  trialStartedAt: string | null;
  billingExempt: boolean;
  subscriptionStatus: string | null;
  subscriptionPeriodEnd: string | null;
  journalOptOutAt: string | null;
  /** Founder test family (reserved +homatest alias or console action). */
  sandbox: boolean;
  /** families.status: open | claimed | complete | deleted. */
  status: string;
  /** Numbers routing to this family (family_phones, the texting truth;
   * families.phone_e164 above is just the signup form's copy). */
  linkedPhones: string[];
  stage: FamilyStage;
  members: { email: string | null; role: string; displayName: string | null; lastSignInAt: string | null }[];
  kids: FamilyDetailKid[];
  lastUserActivityAt: string | null;
  messages28d: number;
  messagesByDay14: { day: string; n: number }[];
  runs: { kind: string; status: string; title: string; error: string | null; startedAt: string; deliveredChannel: string | null }[];
  deliveries: { channel: string; status: string; error: string | null; createdAt: string; repliedAt: string | null }[];
  emailSends: {
    kind: string;
    status: string;
    error: string | null;
    createdAt: string;
    /** Why the drip picked this family, recorded at send time. Null for
     * every email that is not a drip nudge. */
    reason: string | null;
  }[];
  materials: { title: string; kind: string; status: string; createdAt: string }[];
  hoursMinutes28d: number;
  memoriesCount: number;
  tokens28d: number;
  /** Price-book estimate of the family's 28 day AI spend. */
  cost28dUsd: number;
  recentEvents: { name: string; createdAt: string }[];
}

export async function getFamilyDetail(familyId: string): Promise<FamilyDetail | null> {
  const sql = adminDb();
  const priceBook = await getModelPriceBook();

  const familyRows = await sql<
    {
      id: string;
      name: string;
      parent_display_name: string | null;
      email: string | null;
      phone_e164: string | null;
      us_state: string | null;
      time_zone: string | null;
      created_at: string;
      profile_completed_at: string | null;
      trial_started_at: string | null;
      billing_exempt: boolean;
      stripe_subscription_status: string | null;
      stripe_current_period_end: string | null;
      journal_opt_out_at: string | null;
      sandbox: boolean;
      status: string;
    }[]
  >`
    select id, name, parent_display_name, email, phone_e164, us_state, time_zone,
           created_at::text as created_at,
           profile_completed_at::text as profile_completed_at,
           trial_started_at::text as trial_started_at,
           billing_exempt,
           stripe_subscription_status,
           stripe_current_period_end::text as stripe_current_period_end,
           journal_opt_out_at::text as journal_opt_out_at,
           sandbox,
           coalesce(status, 'open') as status
    from public.families
    where id = ${familyId} and coalesce(status, 'open') <> 'deleted'
  `;
  const family = familyRows[0];
  if (!family) return null;

  // Sequential on purpose, never Promise.all: see lib/admin/db.ts.
  const linkedPhones = await sql<{ phone_e164: string }[]>`
    select phone_e164 from public.family_phones
    where family_id = ${familyId}
    order by created_at
  `;
  const members = await sql<{ email: string | null; role: string; display_name: string | null; last_sign_in_at: string | null }[]>`
    select u.email, m.role, m.display_name, u.last_sign_in_at::text as last_sign_in_at
    from public.family_members m
    join auth.users u on u.id = m.user_id
    where m.family_id = ${familyId}
    order by m.created_at
  `;
  const kids = await sql<
    {
      id: string;
      name: string;
      birth_month: string;
      report_at: string | null;
      report_viewed_at: string | null;
      report_emailed_at: string | null;
    }[]
  >`
    select c.id, c.name, c.birth_month::text as birth_month,
           r.generated_at::text as report_at,
           r.viewed_at::text as report_viewed_at,
           r.emailed_at::text as report_emailed_at
    from public.children c
    left join public.child_reports r on r.child_id = c.id
    where c.family_id = ${familyId}
    order by c.created_at
  `;
  // Every saved checklist answer for this family's kids, so the kid rows
  // can say "questions done" vs "12 left" with the real adaptive queue
  // instead of a bare count. A checklist is ~30 rows per kid, so this
  // stays a small read.
  const answerRows = await sql<
    { child_id: string; question_id: string; answer: MapAnswer; answered_at: string }[]
  >`
    select a.child_id, a.question_id, a.answer, a.answered_at::text as answered_at
    from public.child_answers a
    join public.children c on c.id = a.child_id
    where c.family_id = ${familyId}
  `;
  const activity = await sql<{ last_at: string | null; n28: number }[]>`
    select max(created_at) filter (where role = 'user')::text as last_at,
           count(*) filter (where role = 'user' and created_at >= now() - interval '28 days')::int as n28
    from public.conversation_messages
    where family_id = ${familyId}
  `;
  const perDay = await sql<{ day: string; n: number }[]>`
    select date_trunc('day', created_at)::date::text as day, count(*)::int as n
    from public.conversation_messages
    where family_id = ${familyId} and role = 'user'
      and created_at >= now() - interval '14 days'
    group by 1 order by 1
  `;
  const runs = await sql<{ kind: string; status: string; title: string; error: string | null; started_at: string; delivered_channel: string | null }[]>`
    select kind, status, title, error, started_at::text as started_at, delivered_channel
    from public.homa_task_runs
    where family_id = ${familyId}
    order by started_at desc limit 12
  `;
  const deliveries = await sql<{ channel: string; status: string; error: string | null; created_at: string; replied_at: string | null }[]>`
    select channel, status, error, created_at::text as created_at, replied_at::text as replied_at
    from public.conversation_deliveries
    where family_id = ${familyId}
    order by created_at desc limit 12
  `;
  const emailSends = await sql<{ kind: string; status: string; error: string | null; created_at: string; reason: string | null }[]>`
    select kind, status, error, created_at::text as created_at, meta->>'reason' as reason
    from public.email_sends
    where family_id = ${familyId}
    order by created_at desc limit 12
  `;
  const materials = await sql<{ title: string; kind: string; status: string; created_at: string }[]>`
    select title, kind, status, created_at::text as created_at
    from public.materials
    where family_id = ${familyId}
    order by created_at desc limit 8
  `;
  const hours = await sql<{ minutes: number }[]>`
    select coalesce(sum(minutes), 0)::int as minutes from public.hours_log
    where family_id = ${familyId} and created_at >= now() - interval '28 days'
  `;
  const memories = await sql<{ n: number }[]>`
    select count(*)::int as n from public.family_memories where family_id = ${familyId}
  `;
  const usage = await sql<
    {
      model: string;
      tokens_in: number;
      tokens_out: number;
      cache_read: number;
      cache_write: number;
    }[]
  >`
    select model,
           coalesce(sum(input_tokens), 0)::int as tokens_in,
           coalesce(sum(output_tokens), 0)::int as tokens_out,
           coalesce(sum(cache_read_tokens), 0)::int as cache_read,
           coalesce(sum(cache_write_tokens), 0)::int as cache_write
    from public.model_usage
    where family_id = ${familyId} and created_at >= now() - interval '28 days'
    group by model
  `;
  const events = await sql<{ name: string; created_at: string }[]>`
    select name, created_at::text as created_at
    from public.events
    where family_id = ${familyId}
    order by created_at desc limit 12
  `;

  const answersByKid = new Map<
    string,
    { record: Record<string, MapAnswer>; lastAnswerAt: string }
  >();
  for (const row of answerRows) {
    const entry = answersByKid.get(row.child_id) ?? { record: {}, lastAnswerAt: row.answered_at };
    entry.record[row.question_id] = row.answer;
    if (row.answered_at > entry.lastAnswerAt) entry.lastAnswerAt = row.answered_at;
    answersByKid.set(row.child_id, entry);
  }

  const detailKids: FamilyDetailKid[] = kids.map((kid) => {
    const months = ageInMonths(kid.birth_month);
    const inScoredBand = isInScoredRange(months);
    const answers = answersByKid.get(kid.id);
    const record = answers?.record ?? {};
    const answered = Object.keys(record).length;
    const questionsLeft = inScoredBand
      ? buildMapQuestionQueue(planQuestions(months), record).length
      : 0;
    const complete =
      inScoredBand && isMapChecklistComplete({ ageMonths: months, answers: record, answered });
    return {
      id: kid.id,
      name: kid.name,
      birthDate: kid.birth_month,
      inScoredBand,
      answered,
      questionsLeft,
      readyToScore: complete && kid.report_at === null,
      lastAnswerAt: answers?.lastAnswerAt ?? null,
      hasReport: kid.report_at !== null,
      reportAt: kid.report_at,
      reportViewedAt: kid.report_viewed_at,
      reportEmailedAt: kid.report_emailed_at,
    };
  });

  const stage = deriveFamilyStage({
    createdAt: new Date(family.created_at),
    profileCompletedAt: family.profile_completed_at ? new Date(family.profile_completed_at) : null,
    childCount: kids.length,
    hasReport: kids.some((kid) => kid.report_at !== null),
    lastUserActivityAt: activity[0]?.last_at ? new Date(activity[0].last_at) : null,
    now: new Date(),
  });

  return {
    id: family.id,
    name: family.name,
    parentName: family.parent_display_name,
    email: family.email,
    phone: family.phone_e164,
    usState: family.us_state,
    timeZone: family.time_zone,
    createdAt: family.created_at,
    profileCompletedAt: family.profile_completed_at,
    trialStartedAt: family.trial_started_at,
    billingExempt: family.billing_exempt,
    subscriptionStatus: family.stripe_subscription_status,
    subscriptionPeriodEnd: family.stripe_current_period_end,
    journalOptOutAt: family.journal_opt_out_at,
    sandbox: family.sandbox,
    status: family.status,
    linkedPhones: linkedPhones.map((row) => row.phone_e164),
    stage,
    members: members.map((m) => ({
      email: m.email,
      role: m.role,
      displayName: m.display_name,
      lastSignInAt: m.last_sign_in_at,
    })),
    kids: detailKids,
    lastUserActivityAt: activity[0]?.last_at ?? null,
    messages28d: activity[0]?.n28 ?? 0,
    messagesByDay14: perDay,
    runs: runs.map((run) => ({
      kind: run.kind,
      status: run.status,
      title: run.title,
      error: run.error,
      startedAt: run.started_at,
      deliveredChannel: run.delivered_channel,
    })),
    deliveries: deliveries.map((d) => ({
      channel: d.channel,
      status: d.status,
      error: d.error,
      createdAt: d.created_at,
      repliedAt: d.replied_at,
    })),
    emailSends: emailSends.map((send) => ({
      kind: send.kind,
      status: send.status,
      error: send.error,
      createdAt: send.created_at,
      reason: send.reason,
    })),
    materials: materials.map((material) => ({
      title: material.title,
      kind: material.kind,
      status: material.status,
      createdAt: material.created_at,
    })),
    hoursMinutes28d: hours[0].minutes,
    memoriesCount: memories[0].n,
    tokens28d: usage.reduce((sum, row) => sum + row.tokens_in + row.tokens_out, 0),
    cost28dUsd: summarizeUsageCost(
      usage.map((row) => ({
        model: row.model,
        inputTokens: row.tokens_in,
        outputTokens: row.tokens_out,
        cacheReadTokens: row.cache_read,
        cacheWriteTokens: row.cache_write,
      })),
      { rates: priceBook.rates },
    ).estimatedUsd,
    recentEvents: events.map((event) => ({ name: event.name, createdAt: event.created_at })),
  };
}
