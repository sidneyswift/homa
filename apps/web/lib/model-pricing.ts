/**
 * The model price book: pure pricing math plus the PINNED fallback
 * rates, joined to the consumption ledger's raw token quantities at
 * read time. The ledger stores quantities only, never dollars, because
 * prices drift (the model-usage.ts law).
 *
 * Freshness comes from model-pricing-live.ts: it overlays the
 * Gateway's current per-token prices on this table at read time, so
 * the pinned rates below only price anything when the Gateway is
 * unreachable. `pnpm check:model-pricing` fails when a ledger model is
 * unpriced everywhere and prints a paste-ready diff when this fallback
 * drifts from the live feed.
 *
 * These are ESTIMATES for monitoring, not billing-grade accounting:
 * the Vercel AI Gateway invoice is the source of truth, and the
 * action_costs registry (M1-13, 08-billing-credits-design.md) remains
 * the mechanism that prices billable actions. Aggregated ranges are
 * priced at the rate in effect when read, so a window spanning a price
 * change (Sonnet 5 on 2026-09-01) drifts slightly.
 *
 * Ledger semantics this math depends on (verified against live rows,
 * 2026-07-13): input_tokens INCLUDES cache_read_tokens and
 * cache_write_tokens, so the freshly billed input is the difference.
 */

export interface ModelRate {
  /** USD per million uncached input tokens. */
  inputUsdPerMTok: number;
  /** USD per million output tokens (image models: image output tokens). */
  outputUsdPerMTok: number;
  /** USD per million cache-read (cache hit) tokens. */
  cacheReadUsdPerMTok?: number;
  /** USD per million cache-write tokens, at Anthropic's 5 minute TTL
   * rate (the agent's default). */
  cacheWriteUsdPerMTok?: number;
  /** Inclusive UTC date bounds for when this rate applies. */
  from?: string;
  until?: string;
}

/** Model id -> dated rate windows (live overlays carry one undated window). */
export type ModelRates = Record<string, ModelRate[]>;

/**
 * Pinned fallback prices, checked 2026-07-13 against provider pricing
 * pages. When a new model ships, add its row in the same PR (the
 * 08-billing "no unpriced actions" rule, applied to monitoring). A
 * model missing here AND missing from the live feed never prices as
 * zero: estimateUsageCostUsd returns null and the console shows it as
 * unpriced.
 */
export const MODEL_RATES: ModelRates = {
  "anthropic/claude-sonnet-5": [
    {
      inputUsdPerMTok: 2,
      outputUsdPerMTok: 10,
      cacheReadUsdPerMTok: 0.2,
      cacheWriteUsdPerMTok: 2.5,
      until: "2026-08-31",
    },
    {
      inputUsdPerMTok: 3,
      outputUsdPerMTok: 15,
      cacheReadUsdPerMTok: 0.3,
      cacheWriteUsdPerMTok: 3.75,
      from: "2026-09-01",
    },
  ],
  "openai/gpt-5.4-mini": [
    { inputUsdPerMTok: 0.75, outputUsdPerMTok: 4.5, cacheReadUsdPerMTok: 0.075 },
  ],
  // Image calls: the ledger's input_tokens are the text prompt tokens.
  // Reference-image input tokens (billed at $8/MTok) are not separable
  // in our ledger, so reference-driven calls estimate slightly low.
  // output_tokens are image output tokens.
  "openai/gpt-image-2": [{ inputUsdPerMTok: 5, outputUsdPerMTok: 30 }],
  "openai/text-embedding-3-small": [{ inputUsdPerMTok: 0.02, outputUsdPerMTok: 0 }],
};

export interface UsageQuantities {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/** How estimates are priced: `rates` defaults to the pinned table (pass
 * the live book from model-pricing-live.ts for current prices), `at`
 * picks the dated window and defaults to now. */
export interface PricingOptions {
  at?: Date;
  rates?: ModelRates;
}

/** The rate window in effect for a model on a given day, or null when
 * the model has no price on file. */
export function currentModelRate(
  model: string,
  options: PricingOptions = {},
): ModelRate | null {
  const windows = (options.rates ?? MODEL_RATES)[model];
  if (!windows) return null;
  const day = (options.at ?? new Date()).toISOString().slice(0, 10);
  return (
    windows.find(
      (rate) => (!rate.from || day >= rate.from) && (!rate.until || day <= rate.until),
    ) ?? null
  );
}

/**
 * estimateUsageCostUsd(model, usage, options): USD estimate for one
 * call, or one aggregated group of calls on a single model. Returns
 * null when the model has no price on file; callers must surface that
 * as unpriced, never as $0.
 */
export function estimateUsageCostUsd(
  model: string,
  usage: UsageQuantities,
  options: PricingOptions = {},
): number | null {
  const rate = currentModelRate(model, options);
  if (!rate) return null;
  const cacheRead = Math.max(0, usage.cacheReadTokens ?? 0);
  const cacheWrite = Math.max(0, usage.cacheWriteTokens ?? 0);
  const uncachedInput = Math.max(0, usage.inputTokens - cacheRead - cacheWrite);
  const output = Math.max(0, usage.outputTokens);
  return (
    (uncachedInput * rate.inputUsdPerMTok +
      cacheRead * (rate.cacheReadUsdPerMTok ?? rate.inputUsdPerMTok) +
      cacheWrite * (rate.cacheWriteUsdPerMTok ?? rate.inputUsdPerMTok) +
      output * rate.outputUsdPerMTok) /
    1_000_000
  );
}

export interface UsageCostSummary {
  /** Sum over rows whose model has a price on file. */
  estimatedUsd: number;
  /** Distinct models that had usage but no price row. */
  unpricedModels: string[];
}

/** Sums estimates across usage rows that may span several models. */
export function summarizeUsageCost(
  rows: Array<{ model: string } & UsageQuantities>,
  options: PricingOptions = {},
): UsageCostSummary {
  let estimatedUsd = 0;
  const unpriced = new Set<string>();
  for (const row of rows) {
    const usd = estimateUsageCostUsd(row.model, row, options);
    if (usd === null) unpriced.add(row.model);
    else estimatedUsd += usd;
  }
  return { estimatedUsd, unpricedModels: [...unpriced].sort() };
}

/** Compact money for the console: "$12.34", three decimals under ten
 * cents, "<$0.001" for dust, whole dollars past a thousand. */
export function formatUsd(usd: number): string {
  if (usd <= 0) return "$0.00";
  if (usd < 0.001) return "<$0.001";
  if (usd < 0.1) return `$${usd.toFixed(3)}`;
  if (usd < 1000) return `$${usd.toFixed(2)}`;
  return `$${Math.round(usd).toLocaleString("en-US")}`;
}
