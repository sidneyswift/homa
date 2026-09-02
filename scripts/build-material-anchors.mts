/**
 * Publishes the fleet material anchors to Vercel Blob and regenerates
 * apps/web/lib/materials/anchor-manifest.generated.ts from the compressed
 * source images in apps/web/lib/materials/anchor-sources.
 *
 * Fleet material anchors are shared, read-only reference images (no family
 * data) that the materials studio hands to the image model to set the
 * visual bar. They live OUTSIDE the skill package on purpose: the package
 * has a hard size cap (check:fleet-skills) and a growing image library
 * would blow it.
 *
 * Until 2026-09 the bytes travelled as a base64 literal in a generated
 * module (2.45 MB for 20 anchors), eagerly imported on every eve isolate. With roughly 46 more anchors coming that would
 * have been about 8.5 MB duplicated into the eve bundle and two Next
 * server chunks, parsed on every turn, and re-added to git history on
 * every regeneration. So the bytes live in Blob and only a small manifest
 * (about 150 bytes per anchor) ships in code.
 *
 * Blob layout: fleet/material-anchors/<id>-<first 12 hex of sha256>.jpg,
 * public access, no random suffix. Content-addressed keys make the upload
 * idempotent (an unchanged source is already there and is skipped, so a
 * re-run with unchanged sources performs no writes) and make a replaced
 * anchor a NEW key, so a deployed build keeps resolving the manifest it
 * shipped with. Superseded keys are reported as orphans and never deleted
 * here. The fleet/ prefix sits outside families/, so family deletion
 * (deleteFamilyBlobs, the account-deletion prefix audit) never touches it.
 *
 * The runtime (apps/web/lib/materials/anchors.ts) fetches a manifest URL
 * only after isFleetAnchorUrl accepts it, then verifies the sha256 recorded
 * here before handing the bytes to the image model.
 *
 * Source of truth: the lowercase .jpg files in anchor-sources. The id is
 * the basename and must match /^[a-z0-9-]+$/; any other file name fails
 * the build (dotfiles such as .DS_Store are ignored). This script is the
 * only writer of the generated module. Re-run after adding or replacing
 * an anchor image:
 *
 *   pnpm build:material-anchors
 *
 * Needs BLOB_READ_WRITE_TOKEN, read from apps/web/.env.local when the
 * environment does not already carry it. The token is never printed.
 *
 * The registry metadata (id -> title, useWhen, register) lives in
 * apps/web/lib/materials/anchors.ts and must list exactly the ids present
 * here; anchors.test.ts enforces that parity and checks every source
 * file's sha256 against its manifest entry, so a stale manifest fails CI.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { list, put } from "@vercel/blob";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ANCHOR_DIR = join(repoRoot, "apps/web/lib/materials/anchor-sources");
const OUT = join(repoRoot, "apps/web/lib/materials/anchor-manifest.generated.ts");
const BLOB_KEY_PREFIX = "fleet/material-anchors/";
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";
const SOURCE_NAME = /^([a-z0-9-]+)\.jpg$/;
const READ_BACK_ATTEMPTS = 3;

interface AnchorSource {
  id: string;
  bytes: Buffer;
  sha256: string;
  key: string;
}

interface ManifestEntry {
  id: string;
  url: string;
  sha256: string;
  bytes: number;
}

function sha256Hex(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function loadToken(): string {
  try {
    loadEnvFile(join(repoRoot, "apps/web/.env.local"));
  } catch {
    // CI and one-off shells pass the token in the environment directly.
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is required (apps/web/.env.local carries it locally).",
    );
  }
  return token;
}

function readSources(): AnchorSource[] {
  const names = readdirSync(ANCHOR_DIR)
    .filter((name) => !name.startsWith("."))
    .sort();
  const sources = names.map((name): AnchorSource => {
    const match = SOURCE_NAME.exec(name);
    if (!match) {
      throw new Error(
        `anchor-sources/${name}: anchor files must be lowercase <id>.jpg with ` +
          "an id matching /^[a-z0-9-]+$/ (rename or remove it).",
      );
    }
    const bytes = readFileSync(join(ANCHOR_DIR, name));
    if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      throw new Error(`anchor-sources/${name}: not a JPEG (missing FF D8 marker).`);
    }
    const sha256 = sha256Hex(bytes);
    return {
      id: match[1],
      bytes,
      sha256,
      key: `${BLOB_KEY_PREFIX}${match[1]}-${sha256.slice(0, 12)}.jpg`,
    };
  });
  if (sources.length === 0) {
    throw new Error(`No .jpg anchors found in ${ANCHOR_DIR}`);
  }
  return sources;
}

/** Every blob already under the anchor prefix, by pathname. */
async function listExisting(
  token: string,
): Promise<Map<string, { url: string; size: number }>> {
  const existing = new Map<string, { url: string; size: number }>();
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: BLOB_KEY_PREFIX, limit: 1000, cursor, token });
    for (const blob of page.blobs) {
      existing.set(blob.pathname, { url: blob.url, size: blob.size });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return existing;
}

/**
 * The same trust shape isFleetAnchorUrl enforces at runtime, restated here
 * because this strip-types entry point cannot import the extensionless
 * artifact-store module. A URL the runtime would refuse must never be
 * written into the manifest.
 */
function assertTrustedAnchorUrl(url: string, key: string): void {
  const parsed = new URL(url);
  const trusted =
    parsed.protocol === "https:" &&
    parsed.username === "" &&
    parsed.password === "" &&
    parsed.port === "" &&
    parsed.hostname.endsWith(BLOB_HOST_SUFFIX) &&
    parsed.pathname === `/${key}`;
  if (!trusted) {
    throw new Error(`Blob returned a URL the runtime would refuse for ${key}: ${url}`);
  }
}

async function readBack(url: string, expectedSha256: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= READ_BACK_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const actual = sha256Hex(bytes);
      if (actual !== expectedSha256) {
        throw new Error(`sha256 ${actual} does not match ${expectedSha256}`);
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < READ_BACK_ATTEMPTS) {
        await new Promise((resolvePause) => setTimeout(resolvePause, 1000 * attempt));
      }
    }
  }
  throw new Error(
    `read-back failed for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

function renderManifest(entries: readonly ManifestEntry[]): string {
  const lines = [
    "// GENERATED by scripts/build-material-anchors.mts. Do not edit by hand.",
    "// Where each fleet material anchor's JPEG lives in Vercel Blob",
    "// (fleet/material-anchors/<id>-<sha12>.jpg, public, content-addressed) and",
    "// the sha256 the runtime verifies after fetching it. No family data.",
    "// Source of truth: apps/web/lib/materials/anchor-sources/*.jpg",
    "// Regenerate after adding or replacing an anchor:  pnpm build:material-anchors",
    "export const ANCHOR_MANIFEST: Readonly<",
    "  Record<",
    "    string,",
    '    { url: string; sha256: string; bytes: number; mediaType: "image/jpeg" }',
    "  >",
    "> = {",
  ];
  for (const entry of entries) {
    lines.push(
      `  ${JSON.stringify(entry.id)}: { url: ${JSON.stringify(entry.url)}, ` +
        `sha256: ${JSON.stringify(entry.sha256)}, bytes: ${entry.bytes}, ` +
        'mediaType: "image/jpeg" },',
    );
  }
  lines.push("};", "");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const token = loadToken();
  const sources = readSources();
  const existing = await listExisting(token);

  const entries: ManifestEntry[] = [];
  let uploaded = 0;
  let kept = 0;
  for (const source of sources) {
    const held = existing.get(source.key);
    let url: string;
    if (held && held.size === source.bytes.length) {
      url = held.url;
      kept += 1;
      console.log(`  keep   ${source.id} (${source.key})`);
    } else {
      // A key that exists with the wrong size is a broken earlier upload;
      // the key is content-addressed, so overwriting it is still idempotent.
      const result = await put(source.key, source.bytes, {
        access: "public",
        contentType: "image/jpeg",
        addRandomSuffix: false,
        allowOverwrite: held !== undefined,
        token,
      });
      url = result.url;
      await readBack(url, source.sha256);
      uploaded += 1;
      console.log(`  upload ${source.id} -> ${source.key}`);
    }
    assertTrustedAnchorUrl(url, source.key);
    entries.push({
      id: source.id,
      url,
      sha256: source.sha256,
      bytes: source.bytes.length,
    });
  }

  writeFileSync(OUT, renderManifest(entries), "utf8");

  const wanted = new Set(sources.map((source) => source.key));
  const orphans = [...existing.keys()].filter((key) => !wanted.has(key)).sort();
  console.log(
    `Wrote ${OUT} from ${sources.length} anchor(s): ${uploaded} uploaded, ${kept} already in Blob.`,
  );
  if (orphans.length > 0) {
    console.log(
      `${orphans.length} superseded blob(s) left in place (a deployed build may still ` +
        `reference them):\n  ${orphans.join("\n  ")}`,
    );
  }
}

await main();
