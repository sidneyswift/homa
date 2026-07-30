import { isPlanTier } from "../billing/wall-types";
import { mapDb } from "../map/db";
import { siteUrl, submitFilingDetailsNudge } from "../map/email";
import { getStateRequirementsDetail } from "../map/state-requirements";
import { filingDeadlines } from "./deadlines";
import { FILING_DETAIL_COPY } from "./filing-details";
import {
  planDetailNudges,
  type NudgeCandidate,
  type NudgeIndex,
  type NudgeSkipReason,
} from "./filing-details-drip";
import { filingRemindersEnabled } from "./filing-reminder-flag";

/**
 * The daily filing-details pass (gh#424), called from /api/map/cron.
 *
 * Shares the filing reminder's flag on purpose: both are Homa emailing a
 * family about a legal filing, and counsel reviews that wording as one
 * thing (gh#423). Turning on the deadline reminder while leaving the
 * gentle version dark would send the urgent message and never the calm
 * one, which is the wrong half.
 *
 * The FLAG GUARDS THE SEND, not the sweep, so the eligible count stays
 * visible while review is open.
 */

export interface FilingDetailsSweepResult {
  sent: number;
  eligible: number;
  skipped: Record<NudgeSkipReason, number>;
  sendingEnabled: boolean;
}

async function loadCandidates(todayIso: string): Promise<NudgeCandidate[]> {
  const sql = mapDb();
  const rows = await sql<
    {
      id: string;
      email: string | null;
      first_name: string | null;
      us_state: string | null;
      plan_tier: string | null;
      filing_parent_name: string | null;
      address_line: string | null;
      address_city: string | null;
      address_zip: string | null;
      school_year_start_on: string | null;
      created_at: string;
      nudges: string[] | null;
      children: { name: string; birthdate: string | null }[] | null;
    }[]
  >`
    select f.id, f.email, f.first_name, f.us_state, f.plan_tier,
           f.filing_parent_name, f.address_line, f.address_city,
           f.address_zip,
           f.school_year_start_on::text as school_year_start_on,
           f.created_at::text as created_at,
           (
             select array_agg(distinct e.kind)
             from public.email_sends e
             where e.family_id = f.id
               and e.kind like 'filing_details_%'
               and e.status in ('submitted', 'delivered')
           ) as nudges,
           (
             select json_agg(json_build_object(
               'name', c.name, 'birthdate', c.birth_month::text
             ) order by c.created_at)
             from public.children c where c.family_id = f.id
           ) as children
    from public.families f
    where coalesce(f.sandbox, false) = false
      and f.status <> 'deleted'
  `;
  return rows.map((row) => ({
    familyId: row.id,
    email: row.email,
    firstName: row.first_name,
    planTier: isPlanTier(row.plan_tier) ? row.plan_tier : "regular",
    stateCode: row.us_state,
    filingParentName: row.filing_parent_name,
    addressLine: row.address_line,
    addressCity: row.address_city,
    addressZip: row.address_zip,
    schoolYearStartIso: row.school_year_start_on,
    children: row.children ?? [],
    todayIso,
    eligibleSinceIso: row.created_at.slice(0, 10),
    nudgesSent: (row.nudges ?? [])
      .map((kind) => Number(kind.replace("filing_details_", "")))
      .filter((n): n is NudgeIndex => n === 1 || n === 2 || n === 3),
  }));
}

export async function runFilingDetailsSweep(
  todayIso: string,
): Promise<FilingDetailsSweepResult> {
  const candidates = await loadCandidates(todayIso);
  const plan = planDetailNudges(candidates, todayIso);
  const sendingEnabled = filingRemindersEnabled();

  let sent = 0;
  if (sendingEnabled) {
    for (const nudge of plan.sends) {
      const detail = await getStateRequirementsDetail(nudge.stateCode).catch(
        () => null,
      );
      // Only a date Homa can compute honestly. Without one the email
      // simply says nothing is urgent, rather than inventing a deadline.
      const outcome = filingDeadlines({
        stateCode: nudge.stateCode,
        schoolYearStartIso: null,
        todayIso,
      });
      const due = outcome.ok ? outcome.deadlines[0] : null;
      const submission = await submitFilingDetailsNudge(nudge.email, {
        firstName: nudge.firstName,
        stateName: detail?.stateName ?? nudge.stateCode,
        asks: nudge.missing.map((detailKey) => FILING_DETAIL_COPY[detailKey].ask),
        settingsUrl: `${siteUrl()}/app/settings`,
        dueLabel: due
          ? new Intl.DateTimeFormat("en-US", {
              timeZone: "UTC",
              year: "numeric",
              month: "long",
              day: "numeric",
            }).format(new Date(`${due.dueOn}T12:00:00Z`))
          : null,
        step: nudge.index,
        ledgerKind: nudge.ledgerKind,
        familyId: nudge.familyId,
      });
      if (submission.status === "submitted") sent += 1;
    }
  }

  return {
    sent,
    eligible: plan.sends.length,
    skipped: plan.skipped,
    sendingEnabled,
  };
}
