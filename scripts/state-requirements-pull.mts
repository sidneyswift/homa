/**
 * State requirements pull (M3-05 data layer, stage 1 of 2).
 *
 * Fetches HomeschoolLeap's free public compliance API (CC BY-SA 4.0,
 * attribution required) and snapshots the raw JSON into
 * data/state-requirements/: one file per jurisdiction (51: 50 states plus
 * DC) plus the index listing and a manifest recording the pull. Nothing
 * here touches the database.
 *
 * The snapshots are the review surface. Legal claims ship to families
 * (AQ-10: compliance answers must route through the state_requirements
 * table, never free-generated), so every upstream change must be
 * human-reviewable as a git diff BEFORE it can reach a product surface,
 * and git history keeps every version we ever served for blast-radius
 * work (journey J-H). Same quarantine reasoning as M3-04's benchmark
 * pipeline. Flow: run this, read `git diff data/state-requirements`,
 * then seed (scripts/state-requirements-seed.mts).
 *
 * Usage: pnpm pull:state-requirements
 * Network-dependent by design, so NOT part of CI (same posture as
 * check:sources). Procedure and cadence:
 * docs/homa-planning/runbooks/state-requirements-refresh.md
 *
 * Exit codes: 0 = snapshots written, 1 = fetch or validation failure.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_JURISDICTIONS,
  stableStringify,
  type IndexStateEntry,
  type StateDetail,
} from "./state-requirements-shared.mts";

const BASE_URL = "https://homeschoolleap.com";
const FETCH_TIMEOUT_MS = 20_000;
/** Small pause between per-state requests; polite to a free public API. */
const REQUEST_GAP_MS = 150;

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(repoRoot, "data", "state-requirements");
const statesDir = path.join(dataDir, "states");

interface StatesIndex {
  count: number;
  attribution: string;
  states: IndexStateEntry[];
  [key: string]: unknown;
}

async function fetchJson(pathname: string): Promise<unknown> {
  const url = `${BASE_URL}${pathname}`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "User-Agent": "homa-state-requirements-pull/1.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt === 1) await sleep(1_000);
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const pulledAt = new Date().toISOString();

console.log(`Pulling HomeschoolLeap state requirements into ${path.relative(repoRoot, dataDir)}/`);

const index = (await fetchJson("/api/states")) as StatesIndex;
if (!Array.isArray(index.states) || index.states.length !== EXPECTED_JURISDICTIONS) {
  console.error(
    `Index shape unexpected: count=${index.count}, states=${index.states?.length}. ` +
      `Expected ${EXPECTED_JURISDICTIONS} jurisdictions. Aborting, nothing written.`,
  );
  process.exit(1);
}

const codes = index.states.map((entry) => entry.state_code).sort();
const details = new Map<string, StateDetail>();
const problems: string[] = [];

for (const code of codes) {
  const detail = (await fetchJson(`/api/states/${code}`)) as StateDetail;
  if (detail.state_code !== code) problems.push(`${code}: payload says state_code=${detail.state_code}`);
  if (!Array.isArray(detail.pathways) || detail.pathways.length === 0) problems.push(`${code}: no pathways`);
  if (!detail.last_verified) problems.push(`${code}: missing last_verified`);
  if (!detail.verification_status) problems.push(`${code}: missing verification_status`);
  details.set(code, detail);
  await sleep(REQUEST_GAP_MS);
}

if (problems.length > 0) {
  console.error(`Validation failed, nothing written:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

// All 51 payloads validated; only now touch the working tree.
await mkdir(statesDir, { recursive: true });
for (const [code, detail] of details) {
  await writeFile(path.join(statesDir, `${code}.json`), stableStringify(detail));
}
await writeFile(path.join(dataDir, "index.json"), stableStringify(index));
await writeFile(
  path.join(dataDir, "manifest.json"),
  stableStringify({
    source: "HomeschoolLeap public API",
    base_url: BASE_URL,
    license: "CC BY-SA 4.0",
    attribution: index.attribution,
    pulled_at: pulledAt,
    jurisdictions: codes.length,
  }),
);

const statuses = new Map<string, number>();
let oldestVerified = "9999-12-31";
for (const detail of details.values()) {
  statuses.set(detail.verification_status, (statuses.get(detail.verification_status) ?? 0) + 1);
  if (detail.last_verified < oldestVerified) oldestVerified = detail.last_verified;
}

console.log(`Wrote ${codes.length} jurisdictions + index + manifest (pulled_at ${pulledAt}).`);
console.log(
  `Verification statuses: ${[...statuses.entries()].map(([status, n]) => `${status}=${n}`).join(", ")}; ` +
    `oldest last_verified ${oldestVerified}.`,
);
console.log("Next: review `git diff data/state-requirements`, then run pnpm seed:state-requirements");
