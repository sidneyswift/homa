/**
 * Benchmark source freshness check.
 *   1. Every MAP_SOURCES key has a verified-date entry here (and vice
 *      versa), so a new source cannot ship unverified.
 *   2. Every source URL still resolves (HEAD, falling back to GET).
 *   3. Sources verified more than STALE_DAYS ago get a warning, and the
 *      known-revision watchlist below prints its reminders.
 *
 * Network-dependent by design, so it is NOT part of CI. Run it manually or
 * on a schedule: pnpm check:sources
 * Procedure and cadence: docs/homa-planning/runbooks/benchmark-freshness.md
 *
 * Exit codes: 0 = healthy (warnings allowed), 1 = dead link or manifest
 * mismatch.
 */

import { MAP_SUBJECTS, MAP_SOURCES } from "../packages/core/src/index";

/**
 * When each source key was last verified against its live document, and
 * anything a future re-verification should know. Update a date ONLY after
 * re-reading the source (see the runbook). `botBlocked` marks hosts that
 * reject automated probes (paywalled journals, gov sites behind WAFs):
 * those report BLOCKED (a warning to verify by hand), never DEAD.
 */
const VERIFIED: Record<string, { verified: string; watch?: string; botBlocked?: boolean }> = {
  cdc: { verified: "2026-07-06", watch: "site moved from cdc.gov/ncbddd/actearly to cdc.gov/act-early in the 2025 redesign" },
  elof: { verified: "2026-07-06", botBlocked: true, watch: "moved from eclkc.ohs.acf.hhs.gov to headstart.gov; host rejects automated probes" },
  "ccss-ela": { verified: "2026-07-06", botBlocked: true, watch: "official site moved to thecorestandards.org; automated probes may hit a Cloudflare challenge" },
  "ccss-math": { verified: "2026-07-06", botBlocked: true, watch: "official site moved to thecorestandards.org; automated probes may hit a Cloudflare challenge" },
  ngss: { verified: "2026-07-06" },
  c3: { verified: "2026-07-06", botBlocked: true, watch: "official page may hit a Cloudflare challenge during automated probes" },
  nca: { verified: "2026-07-06", watch: "NCAS standards review process underway per nationalartsstandards.org; check for a new edition" },
  shape: { verified: "2026-07-06", watch: "2024 revision moved PE outcomes to grade spans" },
  casel: { verified: "2026-07-06" },
  actfl: { verified: "2026-07-06", watch: "2024 guidelines are current; can-do statements revised 2026" },
  "harvard-ef": { verified: "2026-07-06" },
  "clements-sarama": { verified: "2026-07-06" },
  hwt: { verified: "2026-07-06" },
  "dawson-guare": { verified: "2026-07-06" },
  "aap-lifeskills": { verified: "2026-07-11" },
  asha: { verified: "2026-07-06" },
  hustad: { verified: "2026-07-06", botBlocked: true },
  "crowe-mcleod": { verified: "2026-07-06", botBlocked: true },
  wellman: { verified: "2026-07-06", botBlocked: true },
  lowenfeld: { verified: "2026-07-06" },
  ufli: { verified: "2026-07-06" },
  cee: { verified: "2026-07-06", watch: "CEE published a restructured 3rd edition (2025); bank anchors cite the 2010 grade 4/8/12 benchmarks" },
  "hoff-core": { verified: "2026-07-06" },
  csta: { verified: "2026-07-06", watch: "CSTA 2026 revision launches July 2026 and renames the five concepts; re-verify computer_science items against it" },
  applebee: { verified: "2026-07-11", watch: "University of Chicago Press book URL 404s; Internet Archive record is the stable bibliographic link" },
};

const STALE_DAYS = 180;
const FETCH_TIMEOUT_MS = 12_000;

const failures: string[] = [];
const warnings: string[] = [];

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

async function probe(url: string): Promise<{ ok: boolean; status: number | string }> {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          // Some standards sites reject unknown agents; a browser UA is honest
          // enough for a liveness probe.
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
        },
      });
      // 403/405 on HEAD often just means "method not allowed here", try GET.
      if (method === "HEAD" && (response.status === 403 || response.status === 405)) continue;
      return { ok: response.ok, status: response.status };
    } catch (error) {
      if (method === "GET") {
        return { ok: false, status: error instanceof Error ? error.name : "fetch failed" };
      }
    }
  }
  return { ok: false, status: "unreachable" };
}

// ---------- 1. Manifest completeness, both directions ----------

for (const key of Object.keys(MAP_SOURCES)) {
  if (!VERIFIED[key]) failures.push(`source "${key}" has no verified-date entry in this script`);
}
for (const key of Object.keys(VERIFIED)) {
  if (!MAP_SOURCES[key]) failures.push(`manifest key "${key}" no longer exists in MAP_SOURCES`);
}

// ---------- 2. Staleness and watchlist ----------

for (const [key, entry] of Object.entries(VERIFIED)) {
  const age = daysSince(entry.verified);
  if (age > STALE_DAYS) {
    warnings.push(`${key}: verified ${entry.verified} (${age} days ago), re-verify per the runbook`);
  }
  if (entry.watch) warnings.push(`${key} (watch): ${entry.watch}`);
}

// ---------- 3. Liveness ----------

const results = await Promise.all(
  Object.entries(MAP_SOURCES).map(async ([key, source]) => {
    const result = await probe(source.url);
    return { key, url: source.url, ...result };
  }),
);

for (const result of results) {
  const label = `${result.key} ${result.url}`;
  if (result.ok) {
    console.log(`OK    ${label}`);
  } else if (VERIFIED[result.key]?.botBlocked) {
    console.log(`BLOCK ${label} (${result.status}, host rejects probes: verify by hand)`);
    warnings.push(`${result.key}: bot-blocked host (${result.status}), verify manually on the next pass`);
  } else {
    console.log(`DEAD  ${label} (${result.status})`);
    failures.push(`${result.key}: url unreachable (${result.status}): ${result.url}`);
  }
}

// ---------- 4. Coverage stats ----------

let itemCount = 0;
let codedCount = 0;
for (const domain of MAP_SUBJECTS) {
  for (const item of domain.items) {
    itemCount += 1;
    if ((item.standards ?? []).length > 0) codedCount += 1;
  }
}
console.log(`\n${Object.keys(MAP_SOURCES).length} sources, ${itemCount} items, ${codedCount} carrying formal standard codes.`);

if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const warning of warnings) console.log(`  ! ${warning}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} freshness check(s) FAILED`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("\nAll benchmark sources resolve; manifest complete.");
