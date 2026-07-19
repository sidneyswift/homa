"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import {
  ageInMonths,
  isMapChecklistComplete,
  MAP_BANK_VERSION,
  type MapAnswer,
} from "@homa/core";

import {
  buildAgentPrompt,
  parseAgentPromptSource,
} from "../../lib/admin/agent-prompt";
import {
  acknowledgeAlert,
  parseAlertSource,
  unacknowledgeAlert,
  type AlertSource,
} from "../../lib/admin/alert-acks";
import { getFounderSession } from "../../lib/admin/gate";
import {
  founderPhoneHome,
  getFamilyPhones,
  isFamilyMemberUser,
  moveFamilyPhone,
  removeFamilyPhone,
} from "../../lib/family-phone";
import { mapDb } from "../../lib/map/db";
import { emitMapEvent } from "../../lib/map/events";
import { narrativeEnabled } from "../../lib/map/narrative-flag";
import { runReportNarrative } from "../../lib/map/narrative-runner";
import { sendReportEmailOnce } from "../../lib/map/report-email";
import { createReport } from "../../lib/map/store";

/**
 * /admin server actions. Same founder gate as the pages, but through
 * getFounderSession(): a server action must fail with a plain result,
 * not a thrown 404 render. The ack is stamped with the founder's email
 * so a two-founder future still knows who checked what.
 */

export interface AlertAckState {
  error: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function parseAckInput(
  source: string,
  sourceId: string,
): Promise<{ founderEmail: string; source: AlertSource } | { error: string }> {
  const founder = await getFounderSession();
  if (!founder) return { error: "Only the founder can do this." };
  const parsedSource = parseAlertSource(source);
  if (!parsedSource || !UUID_PATTERN.test(sourceId)) {
    return { error: "That alert could not be identified. Reload and try again." };
  }
  return { founderEmail: founder.email, source: parsedSource };
}

export async function acknowledgeAlertAction(
  source: string,
  sourceId: string,
): Promise<AlertAckState> {
  const parsed = await parseAckInput(source, sourceId);
  if ("error" in parsed) return { error: parsed.error };

  const ok = await acknowledgeAlert(parsed.source, sourceId, parsed.founderEmail);
  if (!ok) return { error: "That alert's record is gone. Reload the page." };
  revalidatePath("/admin");
  return { error: null };
}

export async function unacknowledgeAlertAction(
  source: string,
  sourceId: string,
): Promise<AlertAckState> {
  const parsed = await parseAckInput(source, sourceId);
  if ("error" in parsed) return { error: parsed.error };

  await unacknowledgeAlert(parsed.source, sourceId);
  revalidatePath("/admin");
  return { error: null };
}

export interface AgentPromptState {
  prompt: string | null;
  error: string | null;
}

const CRON_JOB_PATTERN = /^[a-z0-9_]{1,40}$/;

/** Builds the copy-paste diagnostic packet for one failure row (founder
 * ask 2026-07-13: "a [Prompt for agent] button that copies as much info
 * about the error as would help any agent diagnose it"). Read-only. */
export async function buildAgentPromptAction(
  source: string,
  sourceId: string,
): Promise<AgentPromptState> {
  const founder = await getFounderSession();
  if (!founder) return { prompt: null, error: "Only the founder can do this." };

  const parsedSource = parseAgentPromptSource(source);
  const idOk =
    parsedSource === "cron" ? CRON_JOB_PATTERN.test(sourceId) : UUID_PATTERN.test(sourceId);
  if (!parsedSource || !idOk) {
    return { prompt: null, error: "That record could not be identified. Reload and try again." };
  }

  const prompt = await buildAgentPrompt(parsedSource, sourceId);
  if (prompt === null) return { prompt: null, error: "That record's row is gone. Reload the page." };
  return { prompt, error: null };
}

export interface BuildReportState {
  error: string | null;
}

/**
 * The founder's build-it-for-her lever (founder ask 2026-07-14): for a
 * kid whose checklist is done but unscored, run the exact pipeline the
 * flow's scoring step runs, deterministic scoring now, then narrative
 * and the one-time report email in the background. Guarded to complete
 * checklists only: a report row on a half-answered kid would reroute
 * her flow past the remaining questions (decidePostKidsRoute treats a
 * report as done), so partial builds are refused, not warned about.
 */
export async function buildChildReportAction(
  familyId: string,
  childId: string,
): Promise<BuildReportState> {
  const founder = await getFounderSession();
  if (!founder) return { error: "Only the founder can do this." };
  if (!UUID_PATTERN.test(familyId) || !UUID_PATTERN.test(childId)) {
    return { error: "That kid could not be identified. Reload and try again." };
  }

  // Same product connection the flow's own scoring uses; the where
  // clause re-scopes the child to the family (tenancy law).
  const sql = mapDb();
  const kidRows = await sql<{ birth_month: string; has_report: boolean }[]>`
    select to_char(c.birth_month, 'YYYY-MM-DD') as birth_month,
           exists (select 1 from public.child_reports r where r.child_id = c.id) as has_report
    from public.children c
    where c.id = ${childId} and c.family_id = ${familyId}
  `;
  if (kidRows.length === 0) {
    return { error: "That kid could not be identified. Reload and try again." };
  }
  if (kidRows[0].has_report) {
    revalidatePath(`/admin/families/${familyId}`);
    return { error: null };
  }

  const answerRows = await sql<{ question_id: string; answer: MapAnswer }[]>`
    select question_id, answer from public.child_answers where child_id = ${childId}
  `;
  const ageMonths = ageInMonths(kidRows[0].birth_month);
  const answers = Object.fromEntries(
    answerRows.map((row) => [row.question_id, row.answer]),
  );
  const complete = isMapChecklistComplete({
    ageMonths,
    answers,
    answered: answerRows.length,
  });
  if (!complete) {
    return { error: "Questions are still open for this kid. The checklist has to finish first." };
  }

  const report = await createReport(familyId, childId);
  if (!report) {
    return { error: "The report didn't build. Reload and try again." };
  }

  // A duplicate build (double click, a web scoring racing this one)
  // changed nothing and emits nothing.
  if (!report.duplicate) {
    await emitMapEvent("map.report_generated", {
      family_id: familyId,
      child_id: report.childId,
      mapped_subjects: report.scores.mappedCount,
      observations: report.scores.observationCount,
      bank_version: MAP_BANK_VERSION,
    });
  }

  // Mirror of /api/map/score's background phase: words first, then the
  // durable email so the link opens a finished report. Each step fails
  // alone; the report page falls back to template sentences.
  after(async () => {
    if (narrativeEnabled()) {
      try {
        await runReportNarrative(report.childId, familyId);
      } catch (error) {
        console.error(
          "admin build report narrative failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
    try {
      // First scoring only; the claim inside is atomic, so a doubled
      // build (double click, concurrent web scoring) sends one email.
      if (report.email) {
        await sendReportEmailOnce(
          familyId,
          report.childId,
          report.email,
          report.childName,
          report.token,
        );
      }
    } catch (error) {
      console.error(
        "admin build report email failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  });

  revalidatePath(`/admin/families/${familyId}`);
  return { error: null };
}

export interface TestFamilyState {
  error: string | null;
}

/**
 * Marks or unmarks a family as a founder test family (founder ask
 * 2026-07-14). Signups on the reserved +homatest alias mark themselves;
 * this action covers hand-made test families and mistakes. The flag
 * fences the family out of funnels, the digest, and physical mail.
 */
export async function setFamilySandboxAction(
  familyId: string,
  sandbox: boolean,
): Promise<TestFamilyState> {
  const founder = await getFounderSession();
  if (!founder) return { error: "Only the founder can do this." };
  if (!UUID_PATTERN.test(familyId)) {
    return { error: "That family could not be identified. Reload and try again." };
  }
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    update public.families
    set sandbox = ${sandbox}, updated_at = now()
    where id = ${familyId} and status <> 'deleted'
    returning id
  `;
  if (rows.length === 0) return { error: "That family's row is gone. Reload the page." };
  revalidatePath(`/admin/families/${familyId}`);
  revalidatePath("/admin/families");
  return { error: null };
}

/**
 * Retires a TEST family: the same soft delete every reader already
 * filters (status = 'deleted'), refused for real families so a misclick
 * can never disappear a customer. The reserved alias stays reusable:
 * attachAuthUser skips deleted families when it picks a fold target, so
 * signing in again with the same email starts a fresh family.
 *
 * Rows that must not outlive the family (founder "what if my real
 * phone" question, 2026-07-14 evening): agent_schedules (or the
 * dispatcher keeps texting from beyond the grave) and family_phones.
 * A lent or claimed number (source 'home') goes HOME to the founder's
 * real family automatically; a number typed at test signup (source
 * 'signup') is released instead, because it might not be the
 * founder's to keep.
 */
export async function deleteSandboxFamilyAction(
  familyId: string,
): Promise<TestFamilyState> {
  const founder = await getFounderSession();
  if (!founder) return { error: "Only the founder can do this." };
  if (!UUID_PATTERN.test(familyId)) {
    return { error: "That family could not be identified. Reload and try again." };
  }
  const sql = mapDb();
  const phones = await getFamilyPhones(familyId);
  const deleted = await sql.begin(async (tx) => {
    const rows = await tx<{ id: string }[]>`
      update public.families
      set status = 'deleted', updated_at = now()
      where id = ${familyId} and sandbox and status <> 'deleted'
      returning id
    `;
    if (rows.length === 0) return false;
    await tx`delete from public.agent_schedules where family_id = ${familyId}`;
    return true;
  });
  if (!deleted) {
    return { error: "Only a family marked as a test family can be deleted here." };
  }
  const home = await founderPhoneHome(founder.userId);
  for (const phone of phones) {
    if (phone.source === "home" && home) {
      await moveFamilyPhone({
        phoneE164: phone.phone_e164,
        toFamilyId: home.familyId,
        memberUserId: founder.userId,
      });
    } else {
      await removeFamilyPhone(familyId, phone.phone_e164);
    }
  }
  revalidatePath("/admin/families");
  redirect("/admin/families");
}

const E164_PATTERN = /^\+1\d{10}$/;

export interface PhoneLendState {
  error: string | null;
}

/**
 * Lends a number to a TEST family (founder ask 2026-07-14 evening: "use
 * my number on test accounts, then turn it back on for my real
 * account"). One number routes to one family, so this MOVES it. Guards,
 * server-side: the destination must be a sandbox family, and the number
 * must be unlinked, on a sandbox family, or on a family the founder is
 * a member of. A customer's number can never be pulled into a test
 * family through this door.
 */
export async function lendFounderPhoneAction(
  familyId: string,
  phoneE164: string,
): Promise<PhoneLendState> {
  const founder = await getFounderSession();
  if (!founder) return { error: "Only the founder can do this." };
  if (!UUID_PATTERN.test(familyId) || !E164_PATTERN.test(phoneE164)) {
    return { error: "That didn't parse. Reload and try again." };
  }
  const sql = mapDb();
  const target = await sql<{ sandbox: boolean }[]>`
    select sandbox from public.families
    where id = ${familyId} and status <> 'deleted'
  `;
  if (!target[0]?.sandbox) {
    return { error: "Numbers can only be lent to a test family." };
  }
  const holder = await sql<{ family_id: string; sandbox: boolean }[]>`
    select p.family_id, f.sandbox
    from public.family_phones p
    join public.families f on f.id = p.family_id
    where p.phone_e164 = ${phoneE164}
  `;
  if (holder[0] && !holder[0].sandbox) {
    const founderOwns = await isFamilyMemberUser(holder[0].family_id, founder.userId);
    if (!founderOwns) {
      return { error: "That number belongs to a real family that isn't yours; it stays put." };
    }
  }
  await moveFamilyPhone({ phoneE164, toFamilyId: familyId, memberUserId: null });
  revalidatePath(`/admin/families/${familyId}`);
  return { error: null };
}

/** Sends a number held by this TEST family home to the founder's real
 * family, one tap, the "turn my number back on" half of the lever. */
export async function returnFounderPhoneAction(
  familyId: string,
  phoneE164: string,
): Promise<PhoneLendState> {
  const founder = await getFounderSession();
  if (!founder) return { error: "Only the founder can do this." };
  if (!UUID_PATTERN.test(familyId) || !E164_PATTERN.test(phoneE164)) {
    return { error: "That didn't parse. Reload and try again." };
  }
  const sql = mapDb();
  const holder = await sql<{ family_id: string; sandbox: boolean }[]>`
    select p.family_id, f.sandbox
    from public.family_phones p
    join public.families f on f.id = p.family_id
    where p.phone_e164 = ${phoneE164}
  `;
  if (holder[0]?.family_id !== familyId || !holder[0].sandbox) {
    return { error: "That number isn't on this test family anymore. Reload the page." };
  }
  const home = await founderPhoneHome(founder.userId);
  if (!home) {
    return { error: "No real family found on your founder account to send it to." };
  }
  await moveFamilyPhone({
    phoneE164,
    toFamilyId: home.familyId,
    memberUserId: founder.userId,
  });
  revalidatePath(`/admin/families/${familyId}`);
  return { error: null };
}
