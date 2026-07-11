import { mapDb } from "./db";

/**
 * Read-side of the state_requirements reference table (migration #21) for
 * the report's state card. Slowly-changing reference data: joined at
 * render time, never copied into a report row, so a statute change never
 * leaves a stale claim inside anyone's artifact. The table is seeded only
 * by the reviewed snapshot pipeline; this module is read-only by
 * construction (AQ-10: compliance answers route through this table,
 * never a model's memory).
 */

export interface StateRequirementsSummary {
  stateCode: string;
  stateName: string;
  regulationLevel: "none" | "low" | "moderate" | "high";
  compulsoryStartAge: number | null;
  compulsoryEndAge: number | null;
  notificationRequired: boolean;
  assessmentRequired: boolean;
  defaultPathway: string | null;
  sourcePageUrl: string | null;
  /** The upstream per-state verification date, the trust signal the card
   * must always render next to any legal claim. */
  sourceLastVerified: string;
}

const emDashPattern = /\s*\u2014\s*/g;

/** External legal-data snapshots are kept byte-for-byte for provenance.
 * Sanitize their display fields at the product boundary so upstream
 * punctuation cannot violate Homa's no-em-dash copy law. */
function sanitizeReferenceText(value: string): string {
  return value.replace(emDashPattern, ", ");
}

export async function getStateRequirements(
  stateCode: string,
): Promise<StateRequirementsSummary | null> {
  const sql = mapDb();
  const rows = await sql<
    {
      state_code: string;
      state_name: string;
      regulation_level: StateRequirementsSummary["regulationLevel"];
      compulsory_start_age: number | null;
      compulsory_end_age: number | null;
      notification_required: boolean;
      assessment_required: boolean;
      default_pathway: string | null;
      source_page_url: string | null;
      source_last_verified: string;
    }[]
  >`
    select state_code, state_name, regulation_level, compulsory_start_age,
           compulsory_end_age, notification_required, assessment_required,
           default_pathway, source_page_url,
           source_last_verified::text as source_last_verified
    from public.state_requirements
    where state_code = ${stateCode}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    stateCode: row.state_code,
    stateName: sanitizeReferenceText(row.state_name),
    regulationLevel: row.regulation_level,
    compulsoryStartAge: row.compulsory_start_age,
    compulsoryEndAge: row.compulsory_end_age,
    notificationRequired: row.notification_required,
    assessmentRequired: row.assessment_required,
    defaultPathway: row.default_pathway ? sanitizeReferenceText(row.default_pathway) : null,
    sourcePageUrl: row.source_page_url,
    sourceLastVerified: row.source_last_verified,
  };
}
