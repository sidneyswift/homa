/**
 * Per-family AI consumption report (MS-6), read from public.model_usage
 * (our ledger) with an optional reconcile pass against the Vercel AI
 * Gateway's Custom Reporting API (the provider-side view of the same
 * spend, grouped by the user/tags we attach per request).
 *
 * Usage:
 *   pnpm usage:report                     last 7 days, all families
 *   pnpm usage:report -- --days 30        last 30 days
 *   pnpm usage:report -- --family <uuid>  one family only
 *   pnpm usage:report -- --reconcile      also query the Gateway report
 *
 * Env: apps/web/.env.local (SUPABASE_DB_PASSWORD for the ledger;
 * AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN for --reconcile).
 */

import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  estimateUsageCostUsd,
  formatUsd,
} from "../apps/web/lib/model-pricing";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Fine in CI or when env arrives from the shell.
}

const { mapDb } = await import("../apps/web/lib/map/db");

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

const days = Number(argValue("--days") ?? 7);
const family = argValue("--family");
const reconcile = process.argv.includes("--reconcile");

interface SurfaceRow {
  family_id: string | null;
  surface: string;
  model: string;
  calls: string;
  input_tokens: string | null;
  output_tokens: string | null;
  cache_read: string | null;
  cache_write: string | null;
  images: string | null;
}

const sql = mapDb();
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const rows = await sql<SurfaceRow[]>`
  select family_id, surface, model,
         count(*)::text as calls,
         sum(input_tokens)::text as input_tokens,
         sum(output_tokens)::text as output_tokens,
         sum(cache_read_tokens)::text as cache_read,
         sum(cache_write_tokens)::text as cache_write,
         sum(images_count)::text as images
  from public.model_usage
  where created_at >= ${since}
    and (${!family} or family_id = ${family})
  group by family_id, surface, model
  order by family_id nulls last, surface
`;

console.log(`model_usage · last ${days} day(s)${family ? ` · family ${family}` : ""}`);
if (rows.length === 0) {
  console.log("  (no usage recorded in the window)");
} else {
  let currentFamily: string | null | undefined;
  let totalUsd = 0;
  const unpriced = new Set<string>();
  for (const row of rows) {
    if (row.family_id !== currentFamily) {
      currentFamily = row.family_id;
      console.log(`\nfamily: ${row.family_id ?? "(fleet, unattributed)"}`);
    }
    const tokens =
      row.input_tokens || row.output_tokens
        ? ` in=${row.input_tokens ?? 0} out=${row.output_tokens ?? 0}`
        : "";
    const images = row.images && row.images !== "0" ? ` images=${row.images}` : "";
    const usd = estimateUsageCostUsd(row.model, {
      inputTokens: Number(row.input_tokens ?? 0),
      outputTokens: Number(row.output_tokens ?? 0),
      cacheReadTokens: Number(row.cache_read ?? 0),
      cacheWriteTokens: Number(row.cache_write ?? 0),
    });
    if (usd === null) unpriced.add(row.model);
    else totalUsd += usd;
    const cost = usd === null ? " est=(no price on file)" : ` est=${formatUsd(usd)}`;
    console.log(
      `  ${row.surface.padEnd(18)} ${row.model.padEnd(34)} calls=${row.calls}${tokens}${images}${cost}`,
    );
  }
  console.log(`\nestimated total: ${formatUsd(totalUsd)} (price book: apps/web/lib/model-pricing.ts)`);
  if (unpriced.size > 0) {
    console.log(`not counted, no price on file: ${[...unpriced].sort().join(", ")}`);
  }
}

if (reconcile) {
  const token = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
  if (!token) {
    console.log(
      "\nreconcile: set AI_GATEWAY_API_KEY (or have a fresh VERCEL_OIDC_TOKEN) to query the Gateway report.",
    );
  } else {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const url = `https://ai-gateway.vercel.sh/v1/report?start_date=${start}&end_date=${end}&group_by=user`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      console.log(`\nreconcile: Gateway report HTTP ${response.status} (Pro plan + valid key required).`);
    } else {
      console.log("\nGateway /v1/report grouped by user (provider-side view):");
      console.log(JSON.stringify(await response.json(), null, 2).slice(0, 4000));
    }
  }
}

await sql.end();
