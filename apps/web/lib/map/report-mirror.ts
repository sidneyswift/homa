import { createSupabaseServerClient } from "../supabase/server";
import { mapDb } from "./db";

/**
 * Mirrors a scored lead report into the product tables (child_reports,
 * child_answers, child_plans), keyed by the product child_id the family
 * bridge links at score time (migration #23, founder ruling 2026-07-07:
 * the report becomes a native view inside the signed-in workspace).
 *
 * Tenancy posture matches the bridge: reads come from the lead tables
 * through the server-only mapDb, but every product write runs under the
 * parent's OWN session (RLS), never a service role, so the write itself
 * proves the child belongs to the caller's family. A lead kid with no
 * child_id link (no auth session, legacy email-only lead) is skipped;
 * the lead tables stay the funnel's source of truth either way.
 *
 * Called twice per score on purpose (see the score route): once in the
 * foreground so scores and answers are in the workspace immediately, and
 * once after the background narrative phase so the model-written words
 * reach parity. Every write is an idempotent upsert, so a re-run only
 * refreshes.
 */

interface MirrorReportRow {
  scores: unknown;
  bank_version: string;
  history: unknown;
  narrative: unknown;
  narrative_meta: unknown;
  generated_at: string;
}

interface MirrorAnswerRow {
  question_id: string;
  answer: string;
  source: string | null;
  answered_at: string;
}

interface MirrorPlanRow {
  domain_id: string;
  plan: unknown;
  bank_version: string;
  progress: unknown;
  retest_at: string | null;
  retest_emailed_at: string | null;
  narrative: unknown;
  narrative_meta: unknown;
}

export async function mirrorReportToProduct(leadId: string, leadChildId: string): Promise<void> {
  const sql = mapDb();

  // The product child this lead kid maps to, re-scoped to the lead so a
  // stray childId can never point outside it. Null until the bridge links.
  const linkRows = await sql<{ child_id: string | null }[]>`
    select child_id from public.lead_children
    where id = ${leadChildId} and lead_family_id = ${leadId}
  `;
  const childId = linkRows[0]?.child_id ?? null;
  if (!childId) return;

  const reportRows = await sql<MirrorReportRow[]>`
    select scores, bank_version, history, narrative, narrative_meta,
           generated_at::text as generated_at
    from public.lead_reports
    where lead_child_id = ${leadChildId} and revoked_at is null
  `;
  const report = reportRows[0];
  if (!report) return;

  const answerRows = await sql<MirrorAnswerRow[]>`
    select question_id, answer, source, answered_at::text as answered_at
    from public.lead_answers where lead_child_id = ${leadChildId}
  `;
  const planRows = await sql<MirrorPlanRow[]>`
    select domain_id, plan, bank_version, progress,
           retest_at::text as retest_at, retest_emailed_at::text as retest_emailed_at,
           narrative, narrative_meta
    from public.lead_plans where lead_child_id = ${leadChildId}
  `;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // No session here (e.g. the background phase lost the request cookies):
  // skip silently, the next foreground score re-mirrors under RLS.
  if (!user) return;

  const now = new Date().toISOString();

  const { error: reportError } = await supabase.from("child_reports").upsert(
    {
      child_id: childId,
      scores: report.scores,
      bank_version: report.bank_version,
      history: report.history ?? [],
      narrative: report.narrative,
      narrative_meta: report.narrative_meta,
      generated_at: report.generated_at,
      updated_at: now,
    },
    { onConflict: "child_id" },
  );
  if (reportError) throw new Error(`child_reports upsert failed: ${reportError.message}`);

  if (answerRows.length > 0) {
    const { error: answerError } = await supabase.from("child_answers").upsert(
      answerRows.map((row) => ({
        child_id: childId,
        question_id: row.question_id,
        answer: row.answer,
        source: row.source,
        answered_at: row.answered_at,
      })),
      { onConflict: "child_id,question_id" },
    );
    if (answerError) throw new Error(`child_answers upsert failed: ${answerError.message}`);
  }

  if (planRows.length > 0) {
    const { error: planError } = await supabase.from("child_plans").upsert(
      planRows.map((row) => ({
        child_id: childId,
        domain_id: row.domain_id,
        plan: row.plan,
        bank_version: row.bank_version,
        progress: row.progress ?? {},
        retest_at: row.retest_at,
        retest_emailed_at: row.retest_emailed_at,
        narrative: row.narrative,
        narrative_meta: row.narrative_meta,
        updated_at: now,
      })),
      { onConflict: "child_id,domain_id" },
    );
    if (planError) throw new Error(`child_plans upsert failed: ${planError.message}`);
  }
}
