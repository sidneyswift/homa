import { isPlanTier } from "../billing/wall-types";
import { mapDb } from "../map/db";
import { siteUrl, submitFilingReminder } from "../map/email";
import { getStateRequirementsDetail } from "../map/state-requirements";
import { composeFilingLetter } from "./filing-letter";
import { FILING_METHODS_BY_STATE } from "./filing-methods.data";
import { filingRemindersEnabled } from "./filing-reminder-flag";
import {
  planFilingReminders,
  type PlannedReminder,
  type ReminderCandidate,
  type ReminderSkipReason,
} from "./filing-reminder";

/**
 * The hourly filing-reminder pass (gh#422), called from /api/map/cron.
 *
 * The plan is computed every tick whether or not sending is on, because
 * the number that matters most right now is not how many emails went
 * out. It is how many families are near a legal deadline and cannot be
 * told, which is what the founder needs to see while gh#423 (counsel
 * review) is open.
 *
 * Sending is DARK until HOMA_FILING_REMINDERS_ENABLED is exactly "true"
 * (founder ruling 6, 2026-07-29).
 */

export interface FilingReminderSweepResult {
  /** Emails actually submitted. Always 0 while the flag is off. */
  sent: number;
  /** Families the plan would have mailed. Meaningful while dark. */
  eligible: number;
  /** Already mailed about this exact deadline, so passed over. */
  alreadySent: number;
  skipped: Record<ReminderSkipReason, number>;
  /** False while counsel review is open; the honest reason for zeroes. */
  sendingEnabled: boolean;
}

async function loadCandidates(): Promise<ReminderCandidate[]> {
  const sql = mapDb();
  // Sandbox families are excluded here rather than in the planner: a
  // test signup is not a skip reason, it is not a candidate.
  const rows = await sql<
    {
      id: string;
      email: string | null;
      first_name: string | null;
      us_state: string | null;
      plan_tier: string | null;
      school_year_start_on: string | null;
    }[]
  >`
    select id, email, first_name, us_state, plan_tier,
           school_year_start_on::text as school_year_start_on
    from public.families
    where coalesce(sandbox, false) = false
      and status <> 'deleted'
  `;
  return rows.map((row) => ({
    familyId: row.id,
    email: row.email,
    firstName: row.first_name,
    stateCode: row.us_state,
    planTier: isPlanTier(row.plan_tier) ? row.plan_tier : "regular",
    schoolYearStartIso: row.school_year_start_on,
  }));
}

/** True when this family was already told about THIS deadline. */
async function alreadyRemindedFor(
  familyId: string,
  ledgerKind: string,
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ one: number }[]>`
    select 1 as one from public.email_sends
    where family_id = ${familyId} and kind = ${ledgerKind}
      and status in ('submitted', 'delivered')
    limit 1
  `;
  return rows.length > 0;
}

/**
 * The gaps this family's filing would have, so the email can name them.
 *
 * Composed rather than remembered: a family who added their address
 * yesterday should not be told it is missing today. Cheap, because
 * composition is pure and this only runs for families actually being
 * mailed.
 */
async function gapsFor(reminder: PlannedReminder): Promise<string[]> {
  const sql = mapDb();
  const detail = await getStateRequirementsDetail(reminder.stateCode);
  if (!detail) return [];
  const families = await sql<
    {
      first_name: string | null;
      last_name: string | null;
      address_line: string | null;
      address_city: string | null;
      address_zip: string | null;
      us_state: string | null;
    }[]
  >`
    select first_name, last_name, address_line, address_city, address_zip,
           us_state
    from public.families
    where id = ${reminder.familyId}
  `;
  const family = families[0];
  if (!family) return [];
  const children = await sql<{ name: string; birth_month: string | null }[]>`
    select name, birth_month::text as birth_month
    from public.children
    where family_id = ${reminder.familyId}
    order by birth_month asc nulls last, created_at asc
  `;
  const cityState = [family.address_city, family.us_state]
    .filter((part) => part && part.trim().length > 0)
    .join(", ");
  return composeFilingLetter({
    detail,
    method: FILING_METHODS_BY_STATE[reminder.stateCode],
    family: {
      parentName:
        family.first_name && family.last_name
          ? `${family.first_name} ${family.last_name}`
          : (family.first_name ?? null),
      addressLine: family.address_line,
      addressCity: cityState.length > 0 ? cityState : null,
      addressZip: family.address_zip,
      children: children.map((child) => ({
        name: child.name,
        birthdate: child.birth_month,
        grade: null,
      })),
    },
    todayLong: "",
    todayIso: reminder.deadline.dueOn,
  }).gaps;
}

export async function runFilingReminderSweep(
  todayIso: string,
): Promise<FilingReminderSweepResult> {
  const candidates = await loadCandidates();
  const plan = planFilingReminders(candidates, todayIso);
  const sendingEnabled = filingRemindersEnabled();

  let sent = 0;
  let alreadySent = 0;
  for (const reminder of plan.sends) {
    if (await alreadyRemindedFor(reminder.familyId, reminder.ledgerKind)) {
      alreadySent += 1;
      continue;
    }
    if (!sendingEnabled) continue;

    const dueLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(`${reminder.deadline.dueOn}T12:00:00Z`));
    const gaps = await gapsFor(reminder).catch(() => []);
    const detail = await getStateRequirementsDetail(reminder.stateCode).catch(
      () => null,
    );
    const submission = await submitFilingReminder(reminder.email, {
      firstName: reminder.firstName,
      stateName: detail?.stateName ?? reminder.stateCode,
      dueLabel,
      daysAway: reminder.deadline.daysAway,
      gaps,
      filingUrl: `${siteUrl()}/app/binder`,
      ledgerKind: reminder.ledgerKind,
      familyId: reminder.familyId,
    });
    if (submission.status === "submitted") sent += 1;
  }

  return {
    sent,
    eligible: plan.sends.length,
    alreadySent,
    skipped: plan.skipped,
    sendingEnabled,
  };
}
