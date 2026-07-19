import { ageInMonths, MAP_BANK_VERSION, planQuestions, type MapAnswer } from "@homa/core";

import { buildQueue } from "../app/onboarding/question-queue";
import { addFamilyPhone } from "./family-phone";
import { mapDb } from "./map/db";
import { emitMapEvent } from "./map/events";
import { narrativeEnabled } from "./map/narrative-flag";
import { runReportNarrative } from "./map/narrative-runner";
import { sendReportEmailOnce } from "./map/report-email";
import {
  addChild,
  createReport,
  mirrorToWaitlist,
  saveFamilySetup,
  startAnonymousFamily,
  type ScoredReport,
} from "./map/store";
import { sendPhoneLinkEmail } from "./phone-link";

/**
 * Text-native onboarding (sms-onboarding-plan.md, founder ruling
 * 2026-07-10: "Homa should just perform the onboarding there"). This is
 * the ONE server path the signup tools call; it reuses the exact store
 * functions the web flow calls, so a family built by text is
 * indistinguishable from one built on the web: same tables, same
 * scoring, same report.
 *
 * Identity: the SESSION's phone number is the anchor. ensureSignupFamily
 * links it on first touch (which also flips the phone_leads row to
 * converted), and from then on every function re-validates the family
 * through that same number, never through model input.
 */

export interface SignupProgress {
  familyId: string;
  needs: string[];
  parentFirstName: string | null;
  usState: string | null;
  email: string | null;
  children: {
    childId: string;
    name: string;
    ageMonths: number;
    inRange: boolean;
    answered: number;
    checklistDone: boolean;
    hasReport: boolean;
  }[];
}

export interface NextItem {
  itemId: string;
  statement: string;
  answered: number;
  remainingAtLeast: number;
}

export function nextChecklistItemFromAnswers(
  ageMonths: number,
  answers: Readonly<Record<string, MapAnswer>>,
): NextItem | null {
  const queue = buildQueue(planQuestions(ageMonths), answers);
  if (queue.length === 0) return null;
  return {
    itemId: queue[0].item.id,
    statement: queue[0].item.statement,
    answered: Object.keys(answers).length,
    remainingAtLeast: queue.length,
  };
}

/** The signup family for this phone: the linked one when the number is
 * already linked, else a fresh anonymous family (source 'sms') with the
 * phone attached. */
export async function ensureSignupFamily(
  phoneE164: string,
): Promise<{ familyId: string; created: boolean }> {
  const sql = mapDb();
  const linked = await sql<{ family_id: string }[]>`
    select family_id from public.family_phones where phone_e164 = ${phoneE164}
  `;
  if (linked[0]) return { familyId: linked[0].family_id, created: false };

  const { familyId } = await startAnonymousFamily({ source: "sms", utm: {} });
  const link = await addFamilyPhone({
    familyId,
    phoneE164,
    addedBy: null,
    source: "signup",
  });
  if (!link.ok) {
    // Raced by another link between the check and the write; fall back
    // to whatever family owns the number now.
    const raced = await sql<{ family_id: string }[]>`
      select family_id from public.family_phones where phone_e164 = ${phoneE164}
    `;
    if (raced[0]) return { familyId: raced[0].family_id, created: false };
    throw new Error("phone link failed during signup start");
  }
  await emitMapEvent("map.started", {
    family_id: familyId,
    source: "sms",
    has_state: false,
    returning: false,
  });
  return { familyId, created: true };
}

/** Everything the flow still needs, in the order Homa should ask. */
export async function signupProgress(familyId: string): Promise<SignupProgress> {
  const sql = mapDb();
  const [family] = await sql<
    {
      first_name: string | null;
      us_state: string | null;
      email: string | null;
      profile_completed_at: string | null;
    }[]
  >`
    select first_name, us_state, email, profile_completed_at::text as profile_completed_at
    from public.families where id = ${familyId}
  `;
  const childRows = await sql<
    { id: string; name: string; birth_month: string; pending_band: boolean; has_report: boolean }[]
  >`
    select c.id, c.name, to_char(c.birth_month, 'YYYY-MM-DD') as birth_month,
           c.pending_band, exists (select 1 from public.child_reports r where r.child_id = c.id) as has_report
    from public.children c where c.family_id = ${familyId}
    order by c.created_at
  `;
  const answersByChildId = await childAnswersByChildId(
    familyId,
    childRows.filter((child) => !child.pending_band).map((child) => child.id),
  );

  const children: SignupProgress["children"] = [];
  for (const child of childRows) {
    const ageMonths = ageInMonths(child.birth_month);
    const inRange = !child.pending_band;
    let answered = 0;
    let checklistDone = false;
    if (inRange) {
      const answers = answersByChildId.get(child.id) ?? {};
      answered = Object.keys(answers).length;
      checklistDone =
        answered > 0 && buildQueue(planQuestions(ageMonths), answers).length === 0;
    }
    children.push({
      childId: child.id,
      name: child.name,
      ageMonths,
      inRange,
      answered,
      checklistDone,
      hasReport: child.has_report,
    });
  }

  // Email comes SECOND on purpose (unknowns pass 2026-07-10, U1): it is
  // the reconciliation key with the web world. A mom who stalls
  // mid-checklist must already be findable by email, or her later
  // Google sign-in mints a second family.
  const needs: string[] = [];
  if (!family?.profile_completed_at) needs.push("family basics (parent name, state)");
  if (!family?.email) needs.push("her email (so the report has a home and her account is one account)");
  if (children.length === 0) needs.push("at least one child (name and birthday)");
  for (const child of children) {
    if (child.inRange && !child.checklistDone) {
      needs.push(`checklist for ${child.name} (${child.answered} answered so far)`);
    }
  }
  for (const child of children) {
    if (child.inRange && child.checklistDone && !child.hasReport) {
      needs.push(`finish (score) for ${child.name}`);
    }
  }

  return {
    familyId,
    needs,
    parentFirstName: family?.first_name ?? null,
    usState: family?.us_state ?? null,
    email: family?.email ?? null,
    children,
  };
}

/** Coarse state -> IANA zone (most-populated zone per state), so
 * text-born families get evening prompts at a sane local hour without
 * ever being asked a time-zone question (unknowns pass U5). A web visit
 * or the settings card refines it later. */
const STATE_TIME_ZONES: Record<string, string> = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix",
  AR: "America/Chicago", CA: "America/Los_Angeles", CO: "America/Denver",
  CT: "America/New_York", DE: "America/New_York", DC: "America/New_York",
  FL: "America/New_York", GA: "America/New_York", HI: "Pacific/Honolulu",
  ID: "America/Boise", IL: "America/Chicago", IN: "America/Indiana/Indianapolis",
  IA: "America/Chicago", KS: "America/Chicago", KY: "America/New_York",
  LA: "America/Chicago", ME: "America/New_York", MD: "America/New_York",
  MA: "America/New_York", MI: "America/Detroit", MN: "America/Chicago",
  MS: "America/Chicago", MO: "America/Chicago", MT: "America/Denver",
  NE: "America/Chicago", NV: "America/Los_Angeles", NH: "America/New_York",
  NJ: "America/New_York", NM: "America/Denver", NY: "America/New_York",
  NC: "America/New_York", ND: "America/Chicago", OH: "America/New_York",
  OK: "America/Chicago", OR: "America/Los_Angeles", PA: "America/New_York",
  RI: "America/New_York", SC: "America/New_York", SD: "America/Chicago",
  TN: "America/Chicago", TX: "America/Chicago", UT: "America/Denver",
  VT: "America/New_York", VA: "America/New_York", WA: "America/Los_Angeles",
  WV: "America/New_York", WI: "America/Chicago", WY: "America/Denver",
};

export type SaveFamilyBasicsResult =
  | { saved: true }
  | { saved: false; reason: "family-has-accounts" };

/** Family basics over text: name and state; address never asked on SMS
 * (schema-optional by design). Family display name defaults from the
 * parent's first name; the state seeds a coarse time zone when none is
 * set yet.
 *
 * Text signup owns only the memberless family it created itself (the
 * smsSignupCandidate condition in lib/family-phone.ts). Once any adult
 * holds a membership row, the parent identity fields belong to that
 * account's own onboarding, and a model misfire here must not rename
 * the thank-you card's recipient or re-stamp profile_completed_at
 * (founder ruling card-per-family-primary-parent, 2026-07-14). The
 * channel instructions already steer the model away; this is the
 * server-side belt. Mid-signup corrections keep working because a
 * text-signup family stays memberless until it is claimed on the web. */
export async function saveFamilyBasicsFromSms(
  familyId: string,
  input: { parentName: string; familyName?: string | null; usState?: string | null },
): Promise<SaveFamilyBasicsResult> {
  const sql = mapDb();
  const members = await sql<{ n: number }[]>`
    select count(*)::int as n from public.family_members
    where family_id = ${familyId}
  `;
  if ((members[0]?.n ?? 0) > 0) {
    return { saved: false, reason: "family-has-accounts" };
  }

  const [firstName, ...rest] = input.parentName.trim().split(/\s+/u);
  const usState = input.usState?.trim().toUpperCase() || undefined;
  await saveFamilySetup(familyId, {
    familyName: input.familyName?.trim() || `${firstName}'s family`,
    firstName,
    lastName: rest.join(" ") || undefined,
    usState,
  });
  const zone = usState ? STATE_TIME_ZONES[usState] : undefined;
  if (zone) {
    await sql`
      update public.families set time_zone = ${zone}
      where id = ${familyId} and time_zone is null
    `;
  }
  return { saved: true };
}

/** Adds a child through the shared store write; returns range info so
 * Homa knows whether a checklist follows. A repeat of the same name and
 * birthday returns the existing child instead of a twin row
 * (unknowns pass U10: text has no visual dedupe). */
export async function addChildFromSms(
  familyId: string,
  input: { name: string; birthDate: string },
): Promise<{ childId: string; ageMonths: number; inRange: boolean; existed?: boolean }> {
  const sql = mapDb();
  const existing = await sql<{ id: string; birth_month: string; pending_band: boolean }[]>`
    select id, to_char(birth_month, 'YYYY-MM-DD') as birth_month, pending_band
    from public.children
    where family_id = ${familyId} and lower(name) = ${input.name.trim().toLowerCase()}
      and birth_month = ${input.birthDate}
  `;
  if (existing[0]) {
    return {
      childId: existing[0].id,
      ageMonths: ageInMonths(existing[0].birth_month),
      inRange: !existing[0].pending_band,
      existed: true,
    };
  }
  const result = await addChild(familyId, {
    name: input.name,
    birthDate: input.birthDate,
    interests: [],
  });
  await emitMapEvent("map.child_added", {
    family_id: familyId,
    child_id: result.childId,
    age_months: result.ageMonths,
    in_range: result.inRange,
  });
  return result;
}

/** The next checklist question for this child, or null when complete. */
export async function nextChecklistItem(
  familyId: string,
  childId: string,
): Promise<NextItem | null> {
  const sql = mapDb();
  const [child] = await sql<{ birth_month: string }[]>`
    select to_char(birth_month, 'YYYY-MM-DD') as birth_month
    from public.children where id = ${childId} and family_id = ${familyId}
  `;
  if (!child) return null;
  const ageMonths = ageInMonths(child.birth_month);
  const answers = await childAnswers(familyId, childId);
  return nextChecklistItemFromAnswers(ageMonths, answers);
}

/** Sets the report email, refusing addresses that already belong to a
 * DIFFERENT family (no folding without proof). On a taken email, mails
 * that account's inbox a one-time "connect this phone" link
 * (lib/phone-link.ts): inbox possession is the proof, and clicking it
 * folds this signup into her real family. Mirrors to the waitlist
 * exactly like the web claim. */
export async function setFamilyEmailSafe(
  familyId: string,
  email: string,
  phoneE164?: string,
): Promise<{ ok: boolean; reason?: "taken" | "invalid"; linkEmailSent?: boolean }> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, reason: "invalid" };
  }
  const sql = mapDb();
  const taken = await sql<{ id: string }[]>`
    select id from public.families
    where email = ${normalized} and id <> ${familyId}
    limit 1
  `;
  if (taken[0]) {
    let linkEmailSent = false;
    if (phoneE164) {
      try {
        linkEmailSent = await sendPhoneLinkEmail(normalized, taken[0].id, phoneE164);
      } catch (error) {
        console.error(
          "phone-link email failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
    return { ok: false, reason: "taken", linkEmailSent };
  }
  const [family] = await sql<{ first_name: string | null; us_state: string | null; utm: unknown }[]>`
    update public.families set email = ${normalized}, updated_at = now()
    where id = ${familyId}
    returning first_name, us_state, utm
  `;
  await mirrorToWaitlist({
    email: normalized,
    firstName: family?.first_name ?? undefined,
    usState: family?.us_state ?? undefined,
    source: "sms",
    utm: (family?.utm as Record<string, string>) ?? {},
  });
  return { ok: true };
}

/** Scores the child and returns the permanent report, with full parity
 * to the web score route (unknowns pass U6): the report_generated
 * event, the report email (first scoring only), and a non-blocking
 * narrative kick so the words are ready before she opens the link. */
export async function finishChildReport(
  familyId: string,
  childId: string,
): Promise<ScoredReport | null> {
  const report = await createReport(familyId, childId);
  if (!report) return null;

  const answers = await childAnswers(familyId, childId);
  await emitMapEvent("signup.sms_completed", {
    family_id: familyId,
    questions_answered: Object.keys(answers).length,
  });
  await emitMapEvent("map.report_generated", {
    family_id: familyId,
    child_id: report.childId,
    mapped_subjects: report.scores.mappedCount,
    observations: report.scores.observationCount,
    bank_version: MAP_BANK_VERSION,
  });

  // Post-score work runs detached: the SMS turn should not wait 20s of
  // narrative generation to text the link, and both steps self-heal
  // (the report page's status poll regenerates a missing narrative).
  void (async () => {
    if (narrativeEnabled()) {
      try {
        await runReportNarrative(report.childId, familyId);
      } catch (error) {
        console.error(
          "sms signup narrative failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
    try {
      // First scoring only; the claim inside is atomic, so a doubled
      // finish (retried SMS turn, web race) sends one email.
      if (report.email) {
        await sendReportEmailOnce(familyId, report.childId, report.email, report.childName, report.token);
      }
    } catch (error) {
      console.error(
        "sms signup report email failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  })();

  return report;
}

async function childAnswers(
  familyId: string,
  childId: string,
): Promise<Record<string, MapAnswer>> {
  return (await childAnswersByChildId(familyId, [childId])).get(childId) ?? {};
}

async function childAnswersByChildId(
  familyId: string,
  childIds: string[],
): Promise<Map<string, Record<string, MapAnswer>>> {
  const answersByChildId = new Map<string, Record<string, MapAnswer>>();
  for (const childId of childIds) answersByChildId.set(childId, {});
  if (childIds.length === 0) return answersByChildId;

  const sql = mapDb();
  const rows = await sql<{ child_id: string; question_id: string; answer: MapAnswer }[]>`
    select a.child_id, a.question_id, a.answer
    from public.child_answers a
    join public.children c on c.id = a.child_id
    where c.family_id = ${familyId}
      and a.child_id in ${sql(childIds)}
  `;
  for (const row of rows) {
    const answers = answersByChildId.get(row.child_id);
    if (answers) answers[row.question_id] = row.answer;
  }
  return answersByChildId;
}
