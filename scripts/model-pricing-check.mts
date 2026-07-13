/**
 * Price book freshness guard (pnpm check:model-pricing). Two checks:
 *
 *   1. Coverage, the one that fails the run: every model that ever
 *      wrote a public.model_usage row must be priced by the live
 *      gateway catalog or the pinned fallback in
 *      apps/web/lib/model-pricing.ts. An unpriced ledger model means
 *      console estimates are silently incomplete.
 *   2. Drift, a warning: when the pinned fallback disagrees with the
 *      gateway's current price, print a paste-ready row so the
 *      fallback stays honest for gateway outages. Drift never fails
 *      the run; live prices already override pinned at read time.
 *
 * Env: apps/web/.env.local (SUPABASE_DB_PASSWORD for the ledger;
 * VERCEL_OIDC_TOKEN or AI_GATEWAY_API_KEY for the live catalog). With
 * no gateway credentials the drift pass is skipped and coverage runs
 * against the pinned table alone.
 */

import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Fine in CI or when env arrives from the shell.
}

// After env load on purpose: credentials are read at call/connect time.
const { mapDb } = await import("../apps/web/lib/map/db");
const { MODEL_RATES, currentModelRate } = await import("../apps/web/lib/model-pricing");
const { fetchGatewayRates } = await import("../apps/web/lib/model-pricing-live");

const sql = mapDb();
const rows = await sql<{ model: string }[]>`
  select distinct model from public.model_usage order by model
`;
const ledgerModels = rows.map((row) => row.model);

let live: Awaited<ReturnType<typeof fetchGatewayRates>> | null = null;
try {
  live = await fetchGatewayRates();
  console.log(`gateway catalog: ${Object.keys(live).length} priced models`);
} catch (error) {
  console.log(
    `gateway catalog unavailable (${error instanceof Error ? error.message : "unknown"}); checking against the pinned table only`,
  );
}

let failed = false;

console.log(`\nledger coverage (${ledgerModels.length} models with recorded usage):`);
for (const model of ledgerModels) {
  const liveRate = live?.[model]?.[0] ?? null;
  const pinnedRate = currentModelRate(model);
  if (!liveRate && !pinnedRate) {
    failed = true;
    console.log(`  FAIL  ${model} · unpriced everywhere; add a row to apps/web/lib/model-pricing.ts`);
  } else {
    const sources = [liveRate ? "gateway" : null, pinnedRate ? "pinned" : null]
      .filter(Boolean)
      .join(" + ");
    console.log(`  ok    ${model} · ${sources}`);
  }
}

if (live) {
  const drifts: string[] = [];
  for (const model of Object.keys(MODEL_RATES)) {
    const pinned = currentModelRate(model);
    const liveRate = live[model]?.[0];
    if (!pinned || !liveRate) continue;
    const fields = [
      ["inputUsdPerMTok", pinned.inputUsdPerMTok, liveRate.inputUsdPerMTok],
      ["outputUsdPerMTok", pinned.outputUsdPerMTok, liveRate.outputUsdPerMTok],
      ["cacheReadUsdPerMTok", pinned.cacheReadUsdPerMTok, liveRate.cacheReadUsdPerMTok],
      ["cacheWriteUsdPerMTok", pinned.cacheWriteUsdPerMTok, liveRate.cacheWriteUsdPerMTok],
    ] as const;
    const moved = fields.filter(
      ([, pinnedValue, liveValue]) =>
        pinnedValue !== undefined &&
        liveValue !== undefined &&
        Math.abs(pinnedValue - liveValue) > 1e-9,
    );
    if (moved.length > 0) {
      drifts.push(
        `  ${model}: ${moved
          .map(([name, pinnedValue, liveValue]) => `${name} ${pinnedValue} -> ${liveValue}`)
          .join(", ")}\n    suggested row: ${JSON.stringify(liveRate)}`,
      );
    }
  }
  if (drifts.length > 0) {
    console.log(
      `\ndrift warnings (pinned fallback vs gateway today; live prices already override at read time):`,
    );
    for (const drift of drifts) console.log(drift);
  } else {
    console.log(`\npinned fallback matches the gateway for every pinned model.`);
  }
}

await sql.end();
if (failed) {
  console.log("\nFAIL: at least one ledger model is unpriced everywhere.");
  process.exit(1);
}
console.log("\nAll model pricing checks passed.");
