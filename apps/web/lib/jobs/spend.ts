import { adminDb } from "../admin/db";
import {
  summarizeUsageCost,
  type ModelRates,
  type UsageCostSummary,
} from "../model-pricing";
import { getModelPriceBook } from "../model-pricing-live";

/**
 * Per-family agent-jobs spend, read from the authoritative source
 * (agent-jobs cost attribution,
 * docs/homa-planning/plans/2026-07-19-agent-jobs-cost-attribution.md).
 *
 * The cost of a job is the model spend of its build sessions, and that lives
 * in public.model_usage, the server-side consumption ledger, NOT the
 * model-supplied metering columns on agent_job_stages (those are retired as
 * non-authoritative; see the 20260719120000 migration). Every model call a
 * stage causes lands in model_usage keyed by the build session's id: the
 * session's own turns (surface 'agent_job'), and the images and reviews it
 * caused (surfaces 'materials_image' / 'materials_review', now that those
 * carry the session id). agent_job_stages.build_session_id records the session
 * that successfully built each stage, so this reunites a stage's whole cost by
 * a plain join, priced at read time through the live price book.
 *
 * Founder posture (2026-07-19): plan-included and monitored, like scoring and
 * research. This module is the "costed in telemetry" half; nothing here
 * charges a family or gates a job. familyId is always the authenticated
 * caller's, never model input, and every query is family-scoped.
 */

/** One model's aggregated usage within a family's (or the fleet's) jobs. */
export interface AgentJobsUsageRow {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface AgentJobsSpend {
  /** Priced estimate plus any models that had usage but no price on file. */
  cost: UsageCostSummary;
  /** Model calls attributed to agent-jobs build sessions. */
  calls: number;
  /** input + output tokens (cache tokens are a subset of input, not added). */
  tokens: number;
  /** Distinct models seen. */
  models: number;
}

export interface AgentJobsSpendWindow {
  since?: Date | null;
  until?: Date | null;
}

const EMPTY_SPEND: AgentJobsSpend = {
  cost: { estimatedUsd: 0, unpricedModels: [] },
  calls: 0,
  tokens: 0,
  models: 0,
};

/**
 * Pure: fold aggregated usage rows into a priced spend summary. Separated from
 * the query so it can be unit tested without a database, and so the caller can
 * supply an already-loaded price book instead of refetching it.
 */
export function priceAgentJobsUsage(
  rows: AgentJobsUsageRow[],
  rates: ModelRates,
): AgentJobsSpend {
  if (rows.length === 0) return EMPTY_SPEND;
  const cost = summarizeUsageCost(
    rows.map((row) => ({
      model: row.model,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      cacheReadTokens: row.cacheReadTokens,
      cacheWriteTokens: row.cacheWriteTokens,
    })),
    { rates },
  );
  return {
    cost,
    calls: rows.reduce((sum, row) => sum + row.calls, 0),
    tokens: rows.reduce((sum, row) => sum + row.inputTokens + row.outputTokens, 0),
    models: new Set(rows.map((row) => row.model)).size,
  };
}

interface UsageRow {
  model: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}

function toUsageRows(rows: UsageRow[]): AgentJobsUsageRow[] {
  return rows.map((row) => ({
    model: row.model,
    calls: row.calls,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens,
    cacheWriteTokens: row.cache_write_tokens,
  }));
}

// ISO strings, not Date objects: adminDb runs with fetch_types off, so a bound
// Date can mis-serialize; a text param cast to timestamptz is safe (the same
// posture sessions-data.ts takes). A null bound skips its clause.
function windowBounds(window: AgentJobsSpendWindow): {
  sinceIso: string | null;
  untilIso: string | null;
} {
  return {
    sinceIso: window.since ? window.since.toISOString() : null,
    untilIso: window.until ? window.until.toISOString() : null,
  };
}

/**
 * familyAgentJobsSpend(familyId): the family's agent-jobs model spend in the
 * window (default all time). Joins model_usage to this family's stage build
 * sessions; both tables are filtered to familyId, so no other family's spend
 * can leak in. Pass `rates` to reuse an already-loaded price book.
 */
export async function familyAgentJobsSpend(
  familyId: string,
  window: AgentJobsSpendWindow = {},
  rates?: ModelRates,
): Promise<AgentJobsSpend> {
  const sql = adminDb();
  const { sinceIso, untilIso } = windowBounds(window);
  const rows = await sql<UsageRow[]>`
    select m.model,
           count(*)::int as calls,
           coalesce(sum(m.input_tokens), 0)::int as input_tokens,
           coalesce(sum(m.output_tokens), 0)::int as output_tokens,
           coalesce(sum(m.cache_read_tokens), 0)::int as cache_read_tokens,
           coalesce(sum(m.cache_write_tokens), 0)::int as cache_write_tokens
    from public.model_usage m
    where m.family_id = ${familyId}
      and m.session_id in (
        select s.build_session_id
        from public.agent_job_stages s
        where s.family_id = ${familyId}
          and s.build_session_id is not null
      )
      and (${sinceIso === null} or m.created_at >= ${sinceIso}::timestamptz)
      and (${untilIso === null} or m.created_at <= ${untilIso}::timestamptz)
    group by m.model
  `;
  const priceRates = rates ?? (await getModelPriceBook()).rates;
  return priceAgentJobsUsage(toUsageRows(rows), priceRates);
}

/**
 * fleetAgentJobsSpend(): agent-jobs model spend across all families, for the
 * founder console's margin monitoring. Build session ids are globally unique,
 * so matching model_usage.session_id against the set of stage build sessions
 * selects exactly the agent-jobs rows fleet-wide.
 */
export async function fleetAgentJobsSpend(
  window: AgentJobsSpendWindow = {},
  rates?: ModelRates,
): Promise<AgentJobsSpend> {
  const sql = adminDb();
  const { sinceIso, untilIso } = windowBounds(window);
  const rows = await sql<UsageRow[]>`
    select m.model,
           count(*)::int as calls,
           coalesce(sum(m.input_tokens), 0)::int as input_tokens,
           coalesce(sum(m.output_tokens), 0)::int as output_tokens,
           coalesce(sum(m.cache_read_tokens), 0)::int as cache_read_tokens,
           coalesce(sum(m.cache_write_tokens), 0)::int as cache_write_tokens
    from public.model_usage m
    where m.session_id in (
        select s.build_session_id
        from public.agent_job_stages s
        where s.build_session_id is not null
      )
      and (${sinceIso === null} or m.created_at >= ${sinceIso}::timestamptz)
      and (${untilIso === null} or m.created_at <= ${untilIso}::timestamptz)
    group by m.model
  `;
  const priceRates = rates ?? (await getModelPriceBook()).rates;
  return priceAgentJobsUsage(toUsageRows(rows), priceRates);
}
