#!/usr/bin/env node

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MOBILE_BUNDLE_CHECK_VERSION = "mobile-production-bundle-v1";
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const FORBIDDEN_SECRET_NAMES = [
  "AI_GATEWAY_API_KEY",
  "EXPO_TOKEN",
  "GH_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "VERCEL_OIDC_TOKEN",
  "VERCEL_TOKEN",
];
const FORBIDDEN_PRODUCT_SOURCE_SEGMENTS = new Set(["fixture", "fixtures", "lab", "labs", "prototype", "prototypes"]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function walkFiles(root, current = root) {
  const files = [];
  for (const name of readdirSync(current).sort()) {
    const path = resolve(current, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`Export contains a symbolic link: ${relative(root, path)}`);
    if (stat.isDirectory()) files.push(...walkFiles(root, path));
    else if (stat.isFile()) files.push(path);
  }
  return files;
}

function isIosBundle(path) {
  return /(?:^|\/)(?:ios|_expo\/static\/js\/ios)(?:\/|[-.])/u.test(path)
    && /\.(?:bundle|hbc|js)$/u.test(path);
}

function sourceMapSummary(path, bytes) {
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(`Source map is not valid JSON: ${path}`);
  }
  if (parsed?.version !== 3 || !Array.isArray(parsed.sources) || parsed.sources.length === 0) {
    throw new Error(`Source map is missing version 3 sources: ${path}`);
  }
  if (!Array.isArray(parsed.sourcesContent) || parsed.sourcesContent.length !== parsed.sources.length) {
    throw new Error(`Source map does not carry complete sourcesContent: ${path}`);
  }
  const productSources = parsed.sources.map((source, index) => {
    if (typeof source !== "string" || source.trim().length === 0) {
      throw new Error(`Source map contains an invalid source path at index ${index}: ${path}`);
    }
    const normalized = source.replaceAll("\\", "/").replace(/^webpack:\/\//u, "");
    const segments = normalized.split("/").filter((segment) => segment && segment !== "." && segment !== "..");
    const mobileSourceIndex = segments.findIndex((segment, segmentIndex) => (
      segment === "apps" && segments[segmentIndex + 1] === "mobile" && segments[segmentIndex + 2] === "src"
    ));
    const relativeSourceIndex = segments.includes("node_modules") ? -1 : segments.indexOf("src");
    const sourceIndex = mobileSourceIndex >= 0 ? mobileSourceIndex + 2 : relativeSourceIndex;
    if (
      sourceIndex >= 0
      && segments.slice(sourceIndex + 1).some((segment) => FORBIDDEN_PRODUCT_SOURCE_SEGMENTS.has(segment.toLowerCase()))
    ) {
      throw new Error(`Export includes forbidden lab, fixture, or prototype source: ${source}`);
    }
    if (/voice-shell-547-lab/iu.test(normalized)) {
      throw new Error(`Export includes the retired voice-shell lab source: ${source}`);
    }
    return normalized;
  });
  return { path, sourceCount: productSources.length };
}

function sensitiveValues(environment) {
  return FORBIDDEN_SECRET_NAMES
    .map((name) => [name, environment[name]])
    .filter(([, value]) => typeof value === "string" && value.length >= 8);
}

export function inspectProductionBundle({ exportDir, sourceSha, environment = {} }) {
  if (!SHA_PATTERN.test(sourceSha)) throw new Error("sourceSha must be a full lowercase Git SHA");
  if (!existsSync(exportDir) || !lstatSync(exportDir).isDirectory()) throw new Error("Export directory does not exist");
  const absoluteFiles = walkFiles(exportDir);
  const files = absoluteFiles.map((absolutePath) => {
    const path = relative(exportDir, absolutePath).replaceAll("\\", "/");
    const bytes = readFileSync(absolutePath);
    return { path, bytes, byteLength: bytes.length, sha256: sha256(bytes) };
  });
  if (!files.some(({ path }) => path === "metadata.json")) throw new Error("Expo export is missing metadata.json");

  const bundles = files.filter(({ path }) => isIosBundle(path));
  if (bundles.length === 0) throw new Error("Expo export contains no iOS JavaScript or Hermes bundle");
  const sourceMaps = files
    .filter(({ path }) => path.endsWith(".map"))
    .map(({ path, bytes }) => sourceMapSummary(path, bytes));
  if (sourceMaps.length < bundles.length) {
    throw new Error(`Expo export has ${bundles.length} iOS bundle(s) but only ${sourceMaps.length} source map(s)`);
  }

  for (const file of files) {
    for (const name of FORBIDDEN_SECRET_NAMES) {
      if (file.bytes.includes(Buffer.from(name))) throw new Error(`Export contains forbidden secret name ${name} in ${file.path}`);
    }
    for (const [name, value] of sensitiveValues(environment)) {
      if (file.bytes.includes(Buffer.from(value))) throw new Error(`Export contains the value of ${name} in ${file.path}`);
    }
  }

  const portableFiles = files.map(({ path, byteLength, sha256: hash }) => ({ path, byteLength, sha256: hash }));
  const bundleFingerprint = sha256(Buffer.from(JSON.stringify(portableFiles)));
  return {
    schemaVersion: 1,
    checkerVersion: MOBILE_BUNDLE_CHECK_VERSION,
    status: "pass",
    sourceSha,
    platform: "ios",
    fileCount: portableFiles.length,
    bundleCount: bundles.length,
    sourceMapCount: sourceMaps.length,
    sourceFileCount: sourceMaps.reduce((sum, map) => sum + map.sourceCount, 0),
    totalBytes: portableFiles.reduce((sum, file) => sum + file.byteLength, 0),
    bundleFingerprint,
    files: portableFiles,
  };
}

function main() {
  const exportDir = resolve(process.env.HOMA_MOBILE_EXPORT_DIR ?? "dist");
  const output = resolve(process.env.HOMA_MOBILE_BUNDLE_REPORT ?? "bundle-report.json");
  const report = inspectProductionBundle({
    exportDir,
    sourceSha: process.env.GITHUB_SHA?.toLowerCase() ?? "",
    environment: process.env,
  });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Mobile production bundle: ${report.bundleCount} bundle(s), ${report.sourceMapCount} source map(s), ${report.bundleFingerprint}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`Mobile production bundle check: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
