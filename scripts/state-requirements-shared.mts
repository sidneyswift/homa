/**
 * Shared pieces of the state-requirements pipeline (pull + seed).
 * Pipeline overview and posture: see the headers of
 * scripts/state-requirements-pull.mts and state-requirements-seed.mts,
 * and docs/homa-planning/runbooks/state-requirements-refresh.md.
 */

/** 50 states + DC. A pull or seed that sees any other number fails loudly. */
export const EXPECTED_JURISDICTIONS = 51;

/** Per-state summary row from the upstream /api/states index listing. */
export interface IndexStateEntry {
  state_code: string;
  state_name: string;
  regulation_level: string;
  notification_required: boolean;
  assessment_required: boolean;
  default_pathway: string;
  api_url: string;
  [key: string]: unknown;
}

/** Full upstream per-state document from /api/states/{code}. */
export interface StateDetail {
  state_code: string;
  state_name: string;
  regulation_level: string;
  compulsory_education?: { start_age?: number | null; end_age?: number | null };
  page_url?: string;
  verification_status: string;
  last_verified: string;
  pathways: unknown[];
  [key: string]: unknown;
}

/**
 * Deterministic pretty JSON: object keys sorted recursively, arrays kept
 * in order. Snapshots use it so upstream key-order churn never shows up
 * as a git diff; the seed uses it so jsonb round-trips (Postgres
 * normalizes key order) compare by content, not by accident of ordering.
 */
export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, entry]) => [key, sortKeysDeep(entry)]),
    );
  }
  return value;
}
