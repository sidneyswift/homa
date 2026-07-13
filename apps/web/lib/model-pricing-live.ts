import { gateway } from "ai";

import { MODEL_RATES, type ModelRate, type ModelRates } from "./model-pricing";

/**
 * The live half of the price book: current per-token prices from the
 * Vercel AI Gateway's model catalog, overlaid on the pinned fallback
 * table at read time so console estimates track provider price changes
 * without a deploy. Auth rides the credentials the app already has
 * (OIDC on Vercel, VERCEL_OIDC_TOKEN or AI_GATEWAY_API_KEY locally).
 *
 * Failure posture: pricing freshness must never break the console. The
 * catalog is fetched at most once per REFRESH_INTERVAL_MS and cached in
 * memory; a caller waits at most FETCH_TIMEOUT_MS on a cold fetch, then
 * gets the last good book, or the pinned table when nothing has ever
 * been fetched. A late fetch still lands in the cache for the next
 * reader. Every book names its source so the UI can say which prices
 * did the math.
 */

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5_000;

/** The slice of a Gateway catalog entry pricing needs (structural, so
 * we never import the transitive @ai-sdk/gateway package directly). */
export interface GatewayModelListing {
  id: string;
  pricing?: {
    /** USD per single token, as decimal strings. */
    input: string;
    output: string;
    cachedInputTokens?: string;
    cacheCreationInputTokens?: string;
  } | null;
}

export interface PriceBookStatus {
  /** Which table priced the math: the live catalog or the pinned fallback. */
  source: "gateway" | "pinned";
  /** When the live catalog was last fetched, null when pinned. */
  fetchedAt: string | null;
}

export interface PriceBook extends PriceBookStatus {
  rates: ModelRates;
}

function perMTok(value: string | undefined): number | null {
  if (value === undefined) return null;
  const perToken = Number(value);
  if (!Number.isFinite(perToken) || perToken < 0) return null;
  // Rounded to 8 decimals so binary-float artifacts from the unit
  // conversion (0.0000002 * 1e6 = 0.19999999...) never leak into
  // display or drift comparison.
  return Math.round(perToken * 1_000_000 * 1e8) / 1e8;
}

/** Maps Gateway catalog entries to rate windows (one undated window per
 * model, "the price right now"). Entries without usable pricing are
 * skipped so they fall through to the pinned table. */
export function ratesFromGatewayModels(models: GatewayModelListing[]): ModelRates {
  const rates: ModelRates = {};
  for (const model of models) {
    if (!model.pricing) continue;
    const input = perMTok(model.pricing.input);
    const output = perMTok(model.pricing.output);
    if (input === null || output === null) continue;
    const rate: ModelRate = { inputUsdPerMTok: input, outputUsdPerMTok: output };
    const cacheRead = perMTok(model.pricing.cachedInputTokens);
    const cacheWrite = perMTok(model.pricing.cacheCreationInputTokens);
    if (cacheRead !== null) rate.cacheReadUsdPerMTok = cacheRead;
    if (cacheWrite !== null) rate.cacheWriteUsdPerMTok = cacheWrite;
    rates[model.id] = [rate];
  }
  return rates;
}

/** Live rates win per model; pinned models absent from the live feed
 * keep their dated windows (e.g. a scheduled future price change). */
export function mergeModelRates(pinned: ModelRates, live: ModelRates): ModelRates {
  return { ...pinned, ...live };
}

/** Raw, uncached catalog fetch (the check script's view of the live
 * feed); throws when the gateway is unreachable. */
export async function fetchGatewayRates(): Promise<ModelRates> {
  const response = await gateway.getAvailableModels();
  return ratesFromGatewayModels(response.models);
}

let cached: PriceBook = { rates: MODEL_RATES, source: "pinned", fetchedAt: null };
let lastAttemptAt = 0;
let inflight: Promise<void> | null = null;

async function refreshPriceBook(): Promise<void> {
  try {
    const live = await fetchGatewayRates();
    if (Object.keys(live).length === 0) throw new Error("catalog had no priced models");
    cached = {
      rates: mergeModelRates(MODEL_RATES, live),
      source: "gateway",
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      "model price refresh failed (estimates keep the last good book):",
      error instanceof Error ? error.message : "unknown",
    );
  } finally {
    inflight = null;
  }
}

async function settleWithin(promise: Promise<void>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  try {
    await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** The current price book: gateway rates over the pinned fallback,
 * refreshed at most every 15 minutes, never blocking a caller more
 * than the fetch timeout. */
export async function getModelPriceBook(): Promise<PriceBook> {
  const now = Date.now();
  if (now - lastAttemptAt >= REFRESH_INTERVAL_MS) {
    lastAttemptAt = now;
    inflight = refreshPriceBook();
  }
  if (inflight) await settleWithin(inflight, FETCH_TIMEOUT_MS);
  return cached;
}
