import { readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";

import {
  describeVideoAtUrl,
  describeVideoBytes,
  twelveLabsConfigured,
} from "../lib/video/twelvelabs";

/**
 * Twelve Labs smoke check for the video gateway (lib/video/twelvelabs.ts).
 * Runs the exact production code path against a real clip and prints
 * what Pegasus saw. Costs a few seconds of the plan's video minutes.
 *
 *   pnpm --filter web exec tsx scripts/twelvelabs-smoke.mts --file path/to/clip.mp4
 *     Sends local bytes through the base64 lane (the SMS path).
 *
 *   pnpm --filter web exec tsx scripts/twelvelabs-smoke.mts --url https://...
 *     Sends a public direct-file URL (the describe-route path).
 *
 * Clips must be 4 seconds to 1 hour and at least 360x360.
 * Env: TWELVELABS_API_KEY, read from apps/web/.env.local.
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

if (!twelveLabsConfigured()) {
  console.error("TWELVELABS_API_KEY is not set (.env.local)");
  process.exit(2);
}

const filePath = argValue("--file");
const url = argValue("--url");
if (!filePath && !url) {
  console.error("pass --file path/to/clip.mp4 or --url https://...");
  process.exit(2);
}

const startedAt = Date.now();
let description: string | null = null;

if (filePath) {
  const bytes = readFileSync(filePath);
  console.log(`describing ${filePath} (${bytes.byteLength} bytes, base64 lane)...`);
  description = await describeVideoBytes(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
} else if (url) {
  console.log(`describing ${url} (url lane)...`);
  description = await describeVideoAtUrl(url);
}

const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
if (description === null) {
  console.error(`no description came back (${seconds}s); see the error above`);
  process.exit(1);
}
console.log(`\ndescription (${seconds}s):\n${description}`);
