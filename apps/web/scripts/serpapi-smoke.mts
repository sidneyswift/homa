import { loadEnvFile } from "node:process";

import {
  fetchWebPhotoBytes,
  searchWebPhotos,
  serpConfigured,
  verifyPhotoToken,
} from "../lib/search/serp-images";

/**
 * SerpAPI smoke check for the studio's photo desk (lib/search/
 * serp-images.ts). Runs the exact production code path: one real
 * Google Images search, then verifies the top result's token and
 * downloads its bytes. Spends ONE unit of the shared monthly search
 * quota per run (identical re-runs within an hour hit SerpAPI's free
 * cache instead).
 *
 *   pnpm --filter web exec tsx scripts/serpapi-smoke.mts
 *   pnpm --filter web exec tsx scripts/serpapi-smoke.mts --query "real US coins on white background"
 *
 * Env: SERPAPI_API_KEY, read from apps/web/.env.local.
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

if (!serpConfigured()) {
  console.error("SERPAPI_API_KEY is not set (.env.local)");
  process.exit(2);
}

const familyId = "00000000-0000-4000-8000-000000000000";
const query = argValue("--query") ?? "monarch butterfly on milkweed photo";

const startedAt = Date.now();
const outcome = await searchWebPhotos({ familyId, query, count: 5 });
if (!outcome.ok) {
  console.error(`search failed: ${outcome.note}`);
  process.exit(1);
}

console.log(`search ok in ${Date.now() - startedAt}ms, ${outcome.photos.length} results:`);
for (const photo of outcome.photos) {
  console.log(
    `  #${photo.photoNumber} ${photo.width}x${photo.height} · ${photo.source} · ${photo.title}`,
  );
}

const first = outcome.photos[0];
if (!first) {
  console.error("no results to verify");
  process.exit(1);
}

const verified = verifyPhotoToken(first.photoToken, familyId);
if (!verified) {
  console.error("token round-trip failed");
  process.exit(1);
}
const crossFamily = verifyPhotoToken(
  first.photoToken,
  "11111111-1111-4111-8111-111111111111",
);
console.log(`token ok (cross-family rejected: ${crossFamily === null})`);

const fetchStartedAt = Date.now();
const fetched = await fetchWebPhotoBytes(verified.url);
if (!fetched.ok) {
  console.error(`fetch failed: ${fetched.reason} (${verified.url})`);
  process.exit(1);
}
console.log(
  `fetch ok in ${Date.now() - fetchStartedAt}ms: ${fetched.bytes.byteLength} bytes of ${fetched.mediaType}`,
);
console.log("smoke passed");
