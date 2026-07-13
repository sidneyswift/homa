import { loadEnvFile } from "node:process";

import { fetchPageAsMarkdown, firecrawlConfigured } from "../lib/search/firecrawl";

/**
 * Firecrawl smoke check for the agent's web page reading
 * (lib/search/firecrawl.ts, agent/tools/web_fetch.ts). Runs the exact
 * production code path against real pages of the kinds the tool exists
 * for: a curriculum page and a Teachers Pay Teachers listing. Spends
 * one Firecrawl credit per page per run.
 *
 *   pnpm --filter web exec tsx scripts/firecrawl-smoke.mts
 *   pnpm --filter web exec tsx scripts/firecrawl-smoke.mts --url "https://example.org/page"
 *
 * Env: FIRECRAWL_API_KEY, read from apps/web/.env.local.
 */

try {
  loadEnvFile(".env.local");
} catch {
  // CI or preconfigured shells provide the env directly.
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (!firecrawlConfigured()) {
  console.error("FIRECRAWL_API_KEY is not set (.env.local)");
  process.exit(2);
}

const explicit = argValue("--url");
const urls = explicit
  ? [explicit]
  : [
      "https://www.khanacademy.org/math/cc-third-grade-math",
      "https://www.teacherspayteachers.com/browse?search=fractions%20worksheets%20grade%203",
    ];

let failures = 0;
for (const url of urls) {
  const startedAt = Date.now();
  const outcome = await fetchPageAsMarkdown(url);
  if (!outcome.ok) {
    failures += 1;
    console.error(`FAIL ${url}\n  ${outcome.note}`);
    continue;
  }
  const { page } = outcome;
  console.log(
    `ok in ${Date.now() - startedAt}ms · ${page.markdown.length} chars${page.truncated ? " (truncated)" : ""} · ${page.title || "(no title)"}`,
  );
  console.log(`  final url: ${page.url}`);
  console.log(`  first line: ${page.markdown.split("\n").find((line) => line.trim()) ?? ""}`);
}

if (failures > 0) {
  console.error(`smoke failed: ${failures} of ${urls.length} pages`);
  process.exit(1);
}
console.log("smoke passed");
