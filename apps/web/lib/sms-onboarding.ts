import { ageInMonths, planQuestions, type MapAnswer } from "@homa/core";

import { buildQueue } from "../app/onboarding/question-queue";
import { setFamilyPhone } from "./family-phone";
import { mapDb } from "./map/db";
import { emitMapEvent } from "./map/events";
import {
  addChild,
  createReport,
  mirrorToWaitlist,
  saveFamilySetup,
  startAnonymousFamily,
  type ScoredReport,
} from "./map/store";

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
  const link = await setFamilyPhone({
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

  const children: SignupProgress["children"] = [];
  for (const child of childRows) {
    const ageMonths = ageInMonths(child.birth_month);
    const inRange = !child.pending_band;
    let answered = 0;
    let checklistDone = false;
    if (inRange) {
      const answers = await childAnswers(child.id);
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

  const needs: string[] = [];
  if (!family?.profile_completed_at) needs.push("family basics (parent name, state)");
  if (children.length === 0) needs.push("at least one child (name and birth month)");
  for (const child of children) {
    if (child.inRange && !child.checklistDone) {
      needs.push(`checklist for ${child.name} (${child.answered} answered so far)`);
    }
  }
  if (!family?.email) needs.push("an email for the report");
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

/** Family basics over text: name and state; address never asked on SMS
 * (schema-optional by design). Family display name defaults from the
 * parent's first name. */
export async function saveFamilyBasicsFromSms(
  familyId: string,
  input: { parentName: string; familyName?: string | null; usState?: string | null },
): Promise<void> {
  const [firstName, ...rest] = input.parentName.trim().split(/\s+/u);
  await saveFamilySetup(familyId, {
    familyName: input.familyName?.trim() || `${firstName}'s family`,
    firstName,
    lastName: rest.join(" ") || undefined,
    usState: input.usState?.trim().toUpperCase() || undefined,
  });
}

/** Adds a child through the shared store write; returns range info so
 * Homa knows whether a checklist follows. */
export async function addChildFromSms(
  familyId: string,
  input: { name: string; birthMonth: string },
): Promise<{ childId: string; ageMonths: number; inRange: boolean }> {
  const result = await addChild(familyId, {
    name: input.name,
    birthDate: input.birthMonth.length === 7 ? `${input.birthMonth}-01` : input.birthMonth,
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
  const answers = await childAnswers(childId);
  const queue = buildQueue(planQuestions(ageMonths), answers);
  if (queue.length === 0) return null;
  return {
    itemId: queue[0].item.id,
    statement: queue[0].item.statement,
    answered: Object.keys(answers).length,
    remainingAtLeast: queue.length,
  };
}

/** Sets the report email, refusing addresses that already belong to a
 * DIFFERENT family (no folding without an authenticated user). Mirrors
 * to the waitlist exactly like the web claim. */
export async function setFamilyEmailSafe(
  familyId: string,
  email: string,
): Promise<{ ok: boolean; reason?: "taken" | "invalid" }> {
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
  if (taken[0]) return { ok: false, reason: "taken" };
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

/** Scores the child and returns the permanent report. */
export async function finishChildReport(
  familyId: string,
  childId: string,
): Promise<ScoredReport | null> {
  const report = await createReport(familyId, childId);
  if (report) {
    const answers = await childAnswers(childId);
    await emitMapEvent("signup.sms_completed", {
      family_id: familyId,
      questions_answered: Object.keys(answers).length,
    });
  }
  return report;
}

async function childAnswers(childId: string): Promise<Record<string, MapAnswer>> {
  const sql = mapDb();
  const rows = await sql<{ question_id: string; answer: MapAnswer }[]>`
    select question_id, answer from public.child_answers where child_id = ${childId}
  `;
  return Object.fromEntries(rows.map((row) => [row.question_id, row.answer]));
}
