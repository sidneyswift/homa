import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  IDENTITY_CONTRACT,
  identityAssetCatalog,
  identityConsumers,
} from "../packages/design/src/contract/identity.ts";
import { logoGeometry } from "../packages/design/src/contract/brand.ts";
import { DESIGN_CONTRACT_VERSION } from "../packages/design/src/contract/version.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "docs/homa-design/evidence/identity-assets.json");
const CHECK = process.argv.includes("--check");
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".mts", ".svg", ".ts", ".tsx", ".txt", ".xml", ".yml", ".yaml"]);
const GENERATED_PREFIXES = [
  "apps/web/public/brand/",
  "apps/mobile/assets/brand/",
  "apps/mobile/assets/images/",
  "marketing/assets/brand/",
] as const;
const RETIRED_GEOMETRY_PREFIXES = ["marketing/assets/socials-starter-pack/"] as const;
const MASTER_GEOMETRY_SOURCE = "packages/design/src/contract/brand.ts";
const DHASH_ALGORITHM = "dhash-9x8-gray-v1" as const;

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const stableCompare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const relativePath = (path: string) => relative(ROOT, path).replaceAll("\\", "/");

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => stableCompare(left, right)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function trackedFiles(): string[] {
  return git("ls-files", "-z").split("\0").filter(Boolean).sort(stableCompare);
}

function isTextPath(path: string): boolean {
  const dot = path.lastIndexOf(".");
  return dot >= 0 && TEXT_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

function isGeneratedPath(path: string): boolean {
  return GENERATED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isRetiredGeometryPath(path: string): boolean {
  return RETIRED_GEOMETRY_PREFIXES.some((prefix) => path.startsWith(prefix));
}

type IcoEntry = { width: number; height: number; payload: Buffer };

function icoEntries(bytes: Buffer): IcoEntry[] {
  if (bytes.length < 6 || bytes.readUInt16LE(0) !== 0 || bytes.readUInt16LE(2) !== 1) return [];
  const count = bytes.readUInt16LE(4);
  const entries: IcoEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    if (offset + 16 > bytes.length) continue;
    const width = bytes[offset] === 0 ? 256 : bytes[offset]!;
    const height = bytes[offset + 1] === 0 ? 256 : bytes[offset + 1]!;
    const size = bytes.readUInt32LE(offset + 8);
    const start = bytes.readUInt32LE(offset + 12);
    if (start + size > bytes.length) continue;
    entries.push({ width, height, payload: bytes.subarray(start, start + size) });
  }
  return entries;
}

function rasterPayload(path: string, bytes: Buffer): Buffer {
  if (!path.endsWith(".ico")) return bytes;
  const entries = icoEntries(bytes).sort((left, right) => right.width * right.height - left.width * left.height);
  const largest = entries[0];
  if (!largest) throw new Error(`ICO has no decodable PNG entries: ${path}`);
  return largest.payload;
}

async function dimensions(path: string, bytes: Buffer): Promise<{ width: number; height: number }> {
  const metadata = await sharp(rasterPayload(path, bytes)).metadata();
  if (typeof metadata.width !== "number" || typeof metadata.height !== "number") throw new Error(`Asset has no dimensions: ${path}`);
  return { width: metadata.width, height: metadata.height };
}

async function perceptualHash(path: string, bytes: Buffer): Promise<string> {
  const raster = await sharp(rasterPayload(path, bytes))
    .resize({ width: 9, height: 8, fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bits = 0n;
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      bits <<= 1n;
      if (raster.data[row * raster.info.width + column]! > raster.data[row * raster.info.width + column + 1]!) bits |= 1n;
    }
  }
  return bits.toString(16).padStart(16, "0");
}

function sourceFingerprint(): string {
  const generator = readFileSync(resolve(ROOT, "scripts/brand-assets.mts"), "utf8");
  return sha256(canonical({ contract: IDENTITY_CONTRACT, generator: sha256(generator) }));
}

function assertConsumers(): void {
  for (const consumer of identityConsumers) {
    const path = resolve(ROOT, consumer.path);
    if (!existsSync(path)) throw new Error(`Identity consumer is missing: ${consumer.path}`);
    const text = readFileSync(path, "utf8");
    if (consumer.authority.includes("logoGeometry") && !text.includes("logoGeometry")) {
      throw new Error(`Identity consumer does not import logoGeometry: ${consumer.path}`);
    }
    if (consumer.authority.includes("roofThread") && !text.includes("roofThread")) {
      throw new Error(`Identity consumer does not import roofThread: ${consumer.path}`);
    }
    if (consumer.authority.includes("components/brand/Logo.tsx") && !text.includes("Logo")) {
      throw new Error(`Identity consumer does not delegate to Logo: ${consumer.path}`);
    }
    if (consumer.authority.includes("apps/web/public/brand/homa-mark-512.png") && !text.includes("homa-mark-512.png")) {
      throw new Error(`vCard consumer is not pinned to the generated mark: ${consumer.path}`);
    }
  }
}

type GeometryFinding = { path: string; kind: "active-duplicate" | "retired-duplicate"; reason: string };

function duplicateGeometryFindings(): GeometryFinding[] {
  const generatedPaths = new Set(identityAssetCatalog.map((asset) => asset.path));
  const findings: GeometryFinding[] = [];
  for (const path of trackedFiles()) {
    if (!isTextPath(path) || path === MASTER_GEOMETRY_SOURCE || path.startsWith("packages/design/generated/")) continue;
    if (generatedPaths.has(path)) continue;
    if (!path.startsWith("apps/") && !path.startsWith("marketing/") && !path.startsWith("packages/") && !path.startsWith("scripts/") && !path.startsWith("supabase/")) continue;
    const text = readFileSync(resolve(ROOT, path), "utf8");
    if (!text.includes(logoGeometry.housePath)) continue;
    if (isRetiredGeometryPath(path)) {
      findings.push({ path, kind: "retired-duplicate", reason: "retired social starter-pack output; replace with marketing/assets/brand projections before reactivation" });
    } else {
      findings.push({ path, kind: "active-duplicate", reason: "master house path must come from the design contract or a listed generated output" });
    }
  }
  return findings.sort((left, right) => stableCompare(`${left.kind}:${left.path}`, `${right.kind}:${right.path}`));
}

function obsoleteOutputs(): string[] {
  const listed = new Set(identityAssetCatalog.map((asset) => asset.path));
  return trackedFiles()
    .filter((path) => isGeneratedPath(path) && /\.(?:svg|png|ico)$/i.test(path) && !listed.has(path))
    .sort(stableCompare);
}

function assertContractInvariants(): void {
  if (IDENTITY_CONTRACT.version !== DESIGN_CONTRACT_VERSION) throw new Error("Identity contract version drift");
  if (IDENTITY_CONTRACT.geometry.logo.source !== `${MASTER_GEOMETRY_SOURCE}#logoGeometry`) throw new Error("Identity logo source drift");
  if (IDENTITY_CONTRACT.geometry.logo.viewBox !== "0 0 48 48") throw new Error("Identity logo viewBox drift");
  if (IDENTITY_CONTRACT.geometry.logo.minimumMarkPx < 20) throw new Error("Identity mark minimum is below the Quiet authority floor");
  if (IDENTITY_CONTRACT.geometry.roofThread.maximumTurns > 2) throw new Error("Roof thread exceeds its turn limit");
  if (IDENTITY_CONTRACT.geometry.roofThread.stroke.productPx !== 2 || IDENTITY_CONTRACT.geometry.roofThread.stroke.brandPx !== 3) throw new Error("Roof thread stroke contract drift");
  if (IDENTITY_CONTRACT.geometry.character.prohibited.includes("mouth") === false) throw new Error("Character mouth prohibition is missing");
  const ids = identityAssetCatalog.map((asset) => asset.id);
  if (new Set(ids).size !== ids.length) throw new Error("Identity asset IDs are not unique");
  const paths = identityAssetCatalog.map((asset) => asset.path);
  if (new Set(paths).size !== paths.length) throw new Error("Identity asset destinations are duplicated");
}

async function buildManifest() {
  assertContractInvariants();
  assertConsumers();
  const findings = duplicateGeometryFindings();
  const obsolete = obsoleteOutputs();
  const assets = [];
  for (const definition of identityAssetCatalog) {
    const absolute = resolve(ROOT, definition.path);
    if (!existsSync(absolute)) throw new Error(`Identity asset is missing: ${definition.path}`);
    const bytes = readFileSync(absolute);
    const actualDimensions = await dimensions(definition.path, bytes);
    if (actualDimensions.width !== definition.expectedDimensions.width || actualDimensions.height !== definition.expectedDimensions.height) {
      throw new Error(`${definition.path} dimensions ${actualDimensions.width}x${actualDimensions.height} do not match ${definition.expectedDimensions.width}x${definition.expectedDimensions.height}`);
    }
    assets.push({
      ...definition,
      dimensions: actualDimensions,
      outputHash: sha256(bytes),
      perceptualHash: await perceptualHash(definition.path, bytes),
      perceptualHashAlgorithm: DHASH_ALGORITHM,
    });
  }
  const activeDuplicates = findings.filter((finding) => finding.kind === "active-duplicate");
  if (activeDuplicates.length > 0) throw new Error(activeDuplicates.map((finding) => `${finding.path}: ${finding.reason}`).join("\n"));
  if (obsolete.length > 0) throw new Error(`Obsolete generated identity outputs: ${obsolete.join(", ")}`);

  return {
    schemaVersion: 1,
    designEra: "quiet-authority-v1",
    contractVersion: DESIGN_CONTRACT_VERSION,
    sourceOfTruth: {
      identityContract: "packages/design/src/contract/identity.ts",
      logoGeometry: `${MASTER_GEOMETRY_SOURCE}#logoGeometry`,
      roofThread: `${MASTER_GEOMETRY_SOURCE}#roofThread`,
      imagery: `${MASTER_GEOMETRY_SOURCE}#imageryDirection`,
      generator: "scripts/brand-assets.mts",
    },
    geometry: IDENTITY_CONTRACT.geometry,
    safeAreas: IDENTITY_CONTRACT.safeAreas,
    consumers: identityConsumers,
    sourceFingerprint: sourceFingerprint(),
    assets,
    geometryAudit: {
      activeDuplicates: [],
      retiredDuplicates: findings.filter((finding) => finding.kind === "retired-duplicate"),
      obsoleteOutputs: [],
    },
    cleanRegeneration: {
      generate: "pnpm gen:brand",
      check: "pnpm check:identity-assets",
      outputHash: "sha256",
      perceptualHash: DHASH_ALGORITHM,
      status: "source-pinned-and-fail-closed",
    },
  };
}

const manifest = await buildManifest();
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
if (CHECK) {
  if (!existsSync(OUTPUT)) throw new Error(`Identity asset manifest is missing: ${relativePath(OUTPUT)}`);
  const current = readFileSync(OUTPUT, "utf8");
  if (current !== serialized) throw new Error(`Identity asset manifest is stale. Run: pnpm gen:brand`);
  console.log(`Identity asset manifest current: ${manifest.assets.length} outputs, ${manifest.sourceFingerprint}`);
} else {
  writeFileSync(OUTPUT, serialized);
  console.log(`Wrote ${relativePath(OUTPUT)} with ${manifest.assets.length} outputs.`);
}
