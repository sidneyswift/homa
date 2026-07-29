import { applyRequirementOverride } from "../compliance/requirement-overrides";
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

/** Upstream text may carry em dashes; the house voice law bans them
 * everywhere, so every reference string is scrubbed at read time. */
export function sanitizeReferenceText(value: string): string {
  return value.replace(emDashPattern, " - ");
}

interface StateRequirementsDbRow {
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
}

function toSummary(row: StateRequirementsDbRow): StateRequirementsSummary {
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

export async function getStateRequirements(
  stateCode: string,
): Promise<StateRequirementsSummary | null> {
  const sql = mapDb();
  const rows = await sql<StateRequirementsDbRow[]>`
    select state_code, state_name, regulation_level, compulsory_start_age,
           compulsory_end_age, notification_required, assessment_required,
           default_pathway, source_page_url,
           source_last_verified::text as source_last_verified
    from public.state_requirements
    where state_code = ${stateCode}
  `;
  const row = rows[0];
  if (!row) return null;
  return toSummary(row);
}

/**
 * The payload read for the state pack (plans/2026-07-28-state-pack.md
 * D7): the per-pathway detail the summary columns deliberately omit.
 * Parsing is permissive and defensive: upstream fields may be null,
 * absent, or free text, so every string is scrubbed of em dashes here at
 * the parse boundary and no field is trusted to exist. Two fields are
 * NEVER surfaced by design (council D3): `pathway_varies_detail` and
 * `required_conditions` carry literal "undefined" and embedded JSON in
 * real state files; when `pathway_varies` is true the renderer says so
 * and points at the official source instead.
 */

export interface StatePathwayDetail {
  name: string;
  isDefault: boolean;
  statute: string | null;
  notification: {
    required: boolean;
    varies: boolean;
    type: "simple_notice" | "detailed_plan" | "approval_required" | null;
    deadline: string | null;
    recipient: string | null;
    frequency: string | null;
  };
  assessment: {
    required: boolean;
    varies: boolean;
    frequency: string | null;
    types: string[];
  };
  instructionalTime: {
    varies: boolean;
    daysPerYear: number | null;
    hoursPerYear: number | null;
  };
  recordkeeping: {
    varies: boolean;
    attendanceTracking: boolean;
    portfolioRequired: boolean;
  };
  subjects: {
    varies: boolean;
    required: string[];
  };
}

export interface StateCitation {
  label: string;
  url: string;
  /** Upstream source_type when the citation is object-shaped (for one,
   * "case_law", which the parent pack filters out per council D18). */
  sourceType: string | null;
}

export interface StateRequirementsDetail extends StateRequirementsSummary {
  pathways: StatePathwayDetail[];
  /** The pathway flagged is_default upstream, else the first, else null. */
  defaultPathwayDetail: StatePathwayDetail | null;
  citations: StateCitation[];
  primaryStatute: string | null;
  statuteUrl: string | null;
  doeUrl: string | null;
  compulsoryNotes: string | null;
  wizardUrl: string | null;
  verificationStatus: string;
  staleClaimIds: string[];
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = sanitizeReferenceText(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const cleaned = cleanString(entry);
    return cleaned ? [cleaned] : [];
  });
}

function cleanBoolean(value: unknown): boolean {
  return value === true;
}

function cleanInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const NOTIFICATION_TYPES = [
  "simple_notice",
  "detailed_plan",
  "approval_required",
] as const;

function cleanNotificationType(
  value: unknown,
): StatePathwayDetail["notification"]["type"] {
  return typeof value === "string" &&
    (NOTIFICATION_TYPES as readonly string[]).includes(value)
    ? (value as (typeof NOTIFICATION_TYPES)[number])
    : null;
}

function parsePathway(raw: unknown): StatePathwayDetail | null {
  const pathway = asRecord(raw);
  const name = cleanString(pathway.name);
  if (!name) return null;
  const notification = asRecord(pathway.notification);
  const assessment = asRecord(pathway.assessment);
  const instructionalTime = asRecord(pathway.instructional_time);
  const recordkeeping = asRecord(pathway.recordkeeping);
  const subjects = asRecord(pathway.subjects);
  return {
    name,
    isDefault: cleanBoolean(pathway.is_default),
    statute: cleanString(pathway.statute),
    notification: {
      required: cleanBoolean(notification.required),
      varies: cleanBoolean(notification.pathway_varies),
      type: cleanNotificationType(notification.type),
      deadline: cleanString(notification.deadline),
      recipient: cleanString(notification.recipient),
      frequency: cleanString(notification.frequency),
    },
    assessment: {
      required: cleanBoolean(assessment.required),
      varies: cleanBoolean(assessment.pathway_varies),
      frequency: cleanString(assessment.frequency),
      types: cleanStringList(assessment.types),
    },
    instructionalTime: {
      varies: cleanBoolean(instructionalTime.pathway_varies),
      daysPerYear: cleanInt(instructionalTime.days_per_year),
      hoursPerYear: cleanInt(instructionalTime.hours_per_year),
    },
    recordkeeping: {
      varies: cleanBoolean(recordkeeping.pathway_varies),
      attendanceTracking: cleanBoolean(recordkeeping.attendance_tracking),
      portfolioRequired: cleanBoolean(recordkeeping.portfolio_required),
    },
    subjects: {
      varies: cleanBoolean(subjects.pathway_varies),
      required: cleanStringList(subjects.required),
    },
  };
}

function parseCitations(raw: unknown): StateCitation[] {
  const map = asRecord(raw);
  const citations: StateCitation[] = [];
  for (const [rawLabel, rawValue] of Object.entries(map)) {
    const label = cleanString(rawLabel);
    if (!label) continue;
    if (typeof rawValue === "string") {
      const url = cleanString(rawValue);
      if (url) citations.push({ label, url, sourceType: null });
      continue;
    }
    const entry = asRecord(rawValue);
    const url = cleanString(entry.url);
    if (url) {
      citations.push({ label, url, sourceType: cleanString(entry.source_type) });
    }
  }
  return citations;
}

/** Pure payload parse, exported so the pack's derivation tests can run
 * against the repository's own reviewed snapshots without a database. */
export function parseStateRequirementsPayload(
  summary: StateRequirementsSummary,
  payload: unknown,
): StateRequirementsDetail {
  const root = asRecord(payload);
  const sources = asRecord(root.sources);
  const compulsory = asRecord(root.compulsory_education);
  const generationMetadata = asRecord(root.generation_metadata);
  const pathways = Array.isArray(root.pathways)
    ? root.pathways.flatMap((entry) => {
        const parsed = parsePathway(entry);
        return parsed ? [parsed] : [];
      })
    : [];
  return {
    ...summary,
    pathways,
    defaultPathwayDetail:
      pathways.find((pathway) => pathway.isDefault) ?? pathways[0] ?? null,
    citations: parseCitations(root.citation_urls),
    primaryStatute: cleanString(sources.primary_statute),
    statuteUrl: cleanString(sources.statute_url),
    doeUrl: cleanString(sources.doe_url),
    compulsoryNotes: cleanString(compulsory.notes),
    wizardUrl: cleanString(root.wizard_url),
    verificationStatus: cleanString(root.verification_status) ?? "unknown",
    staleClaimIds: cleanStringList(generationMetadata.stale_claim_ids),
  };
}

export async function getStateRequirementsDetail(
  stateCode: string,
): Promise<StateRequirementsDetail | null> {
  const sql = mapDb();
  const rows = await sql<(StateRequirementsDbRow & { payload: unknown })[]>`
    select state_code, state_name, regulation_level, compulsory_start_age,
           compulsory_end_age, notification_required, assessment_required,
           default_pathway, source_page_url,
           source_last_verified::text as source_last_verified, payload
    from public.state_requirements
    where state_code = ${stateCode}
  `;
  const row = rows[0];
  if (!row) return null;
  // The one seam every consumer reads through (the pack, the filing, the
  // Binder cards, compliance answers), so a state whose law changed
  // after the last upstream pull is corrected in exactly one place
  // rather than in each surface separately (gh#436). Overrides only ever
  // REMOVE a duty and carry the statute they rest on; see
  // lib/compliance/requirement-overrides.ts.
  return applyRequirementOverride(
    parseStateRequirementsPayload(toSummary(row), row.payload),
    new Date().toISOString().slice(0, 10),
  );
}
