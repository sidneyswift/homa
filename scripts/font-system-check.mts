import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FONT_SYSTEM_CONTRACT,
  approvedFontFamilies,
  channelTypography,
  checkedInFontAssets,
} from "../packages/design/src/contract/fonts.ts";
import { DESIGN_CONTRACT_VERSION } from "../packages/design/src/contract/version.ts";
import { PROFILES_CONTRACT } from "../packages/design/src/contract/profiles.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = resolve(ROOT, "docs/homa-design/evidence/font-system.json");
const GENERATED_CONTRACT_PATH = resolve(ROOT, "packages/design/generated/contract.json");
const CHECK = process.argv.includes("--check");
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

const TEXT_EXTENSIONS = new Set([
  ".css", ".html", ".js", ".json", ".md", ".mjs", ".mts", ".svg", ".ts", ".tsx", ".txt", ".xml", ".yml", ".yaml",
]);
const ACTIVE_PREFIXES = [
  "apps/web/",
  "apps/mobile/",
  "packages/design/src/",
  "packages/design/generated/",
  "marketing/voice/",
  "marketing/evals/",
  "marketing/assets/brand/",
  "scripts/",
  "supabase/templates/",
];
const ROOT_ACTIVE_FILES = new Set(["DESIGN.md", "package.json", "pnpm-lock.yaml"]);
const CHECKER_FILES = new Set([
  "scripts/font-system-check.mts",
  "scripts/font-system-check.test.mts",
  "scripts/brand-residue-check.mts",
  "scripts/brand-surfaces.mts",
  "scripts/design-authoring-rails-check.mts",
  "scripts/marketing-production-check.mts",
]);
const RETIRED_FONTS = [
  { name: "legacy-font-schibsted", pattern: /\bSchibsted(?:\s+Grotesk)?\b/giu },
  { name: "legacy-font-hanken", pattern: /\bHanken(?:\s+Grotesk)?\b/giu },
  { name: "legacy-font-caveat", pattern: /\bCaveat\b/gu },
] as const;

export type FontResidueFinding = {
  path: string;
  line: number;
  signature: string;
  excerpt: string;
};

function gitTrackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean).sort();
}

function isTextPath(path: string): boolean {
  const dot = path.lastIndexOf(".");
  return dot >= 0 && TEXT_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

function isActivePath(path: string): boolean {
  return ROOT_ACTIVE_FILES.has(path) || ACTIVE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isExcludedPath(path: string): boolean {
  return CHECKER_FILES.has(path)
    || path.startsWith("docs/homa-design/evidence/")
    || path.startsWith("docs/homa-planning/history/")
    || path.startsWith("docs/notes/")
    || /\.(?:test|spec)\.(?:js|mjs|mts|ts|tsx)$/.test(path);
}

function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index += 1) if (text[index] === "\n") line += 1;
  return line;
}

function excerptAt(text: string, offset: number): string {
  const start = text.lastIndexOf("\n", offset - 1) + 1;
  const end = text.indexOf("\n", offset);
  return text.slice(start, end === -1 ? text.length : end).trim().slice(0, 180);
}

function hasFontContext(text: string, offset: number): boolean {
  const context = text.slice(Math.max(0, offset - 120), Math.min(text.length, offset + 160)).toLowerCase();
  return /font|typeface|font-family|fontfamily|google fonts|expo-google-fonts|@import|headline|display face|body face|wordmark/.test(context);
}

/**
 * Finds retired font identity only when it is acting as font guidance or a
 * dependency. Ordinary curriculum prose may use the word "caveat" and is not
 * a font residue finding.
 */
export function findLegacyFontResidue(path: string, text: string): FontResidueFinding[] {
  if (!isActivePath(path) || isExcludedPath(path)) return [];
  const findings: FontResidueFinding[] = [];
  for (const rule of RETIRED_FONTS) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(text)) !== null) {
      if (hasFontContext(text, match.index)) {
        findings.push({ path, line: lineAt(text, match.index), signature: rule.name, excerpt: excerptAt(text, match.index) });
      }
      if (rule.pattern.lastIndex === match.index) rule.pattern.lastIndex += 1;
    }
  }
  return findings;
}

function assertContractShape(): void {
  if (FONT_SYSTEM_CONTRACT.version !== DESIGN_CONTRACT_VERSION) throw new Error("Font contract version drift");
  if (FONT_SYSTEM_CONTRACT.schemaVersion !== 1) throw new Error("Unsupported font contract schema");
  const roles = Object.keys(approvedFontFamilies).sort();
  if (roles.join(",") !== "display,interface,wordmark") throw new Error(`Unexpected font roles: ${roles.join(",")}`);
  const profileNames = Object.keys(PROFILES_CONTRACT.targetProfiles).sort();
  const channelNames = Object.keys(channelTypography).sort();
  if (profileNames.join(",") !== channelNames.join(",")) throw new Error("Font channels do not cover every design profile");
  const serialized = JSON.stringify(FONT_SYSTEM_CONTRACT);
  if (/Schibsted|Hanken|Caveat/gu.test(serialized)) throw new Error("Retired font appears in the active font contract");
  if (FONT_SYSTEM_CONTRACT.verification.status !== "contract-ready-adoption-evidence-pending") throw new Error("Font verification status must remain honest");
}

function assertAssets(): void {
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const asset of checkedInFontAssets) {
    if (ids.has(asset.id)) throw new Error(`Duplicate font asset id: ${asset.id}`);
    if (paths.has(asset.path)) throw new Error(`Duplicate font asset path: ${asset.path}`);
    ids.add(asset.id);
    paths.add(asset.path);
    const absolutePath = resolve(ROOT, asset.path);
    if (!existsSync(absolutePath)) throw new Error(`Missing checked-in font asset: ${asset.path}`);
    const actualHash = sha256(readFileSync(absolutePath));
    if (actualHash !== asset.sha256) throw new Error(`Font asset hash drift: ${asset.path}; expected ${asset.sha256}, got ${actualHash}`);
    if (!asset.subsets.includes("latin")) throw new Error(`Font asset has no latin subset declaration: ${asset.path}`);
    const family = approvedFontFamilies[asset.role];
    if (asset.family !== family.family) throw new Error(`Font asset family does not match role: ${asset.path}`);
    if (!family.allowedWeights.includes(asset.weight as never)) throw new Error(`Font asset weight is outside its role: ${asset.path}`);
    if (!family.allowedStyles.includes(asset.style as never)) throw new Error(`Font asset style is outside its role: ${asset.path}`);
    if (asset.binaryInspection.weightClass !== asset.weight) throw new Error(`Font inspection weight drift: ${asset.path}`);
    if (!asset.binaryInspection.glyphCoverage) throw new Error(`Font asset has no glyph coverage record: ${asset.path}`);
  }
}

function scanLegacyResidue(): FontResidueFinding[] {
  const findings: FontResidueFinding[] = [];
  for (const path of gitTrackedFiles()) {
    if (!isActivePath(path) || isExcludedPath(path) || !isTextPath(path)) continue;
    findings.push(...findLegacyFontResidue(path, readFileSync(resolve(ROOT, path), "utf8")));
  }
  for (const path of gitTrackedFiles()) {
    if (!isActivePath(path) || isExcludedPath(path)) continue;
    if (/(?:schibsted|hanken|caveat)/iu.test(path)) findings.push({ path, line: 1, signature: "legacy-font-path", excerpt: path });
  }
  return findings;
}

function buildReport(contractSourceChecksum: string, findings: FontResidueFinding[]) {
  return {
    schemaVersion: 1,
    designEra: DESIGN_CONTRACT_VERSION,
    contractSourceChecksum,
    checkedInAssets: checkedInFontAssets.map(({ id, role, path, format, weight, style, subsets, sha256: hash }) => ({ id, role, path, format, weight, style, subsets, sha256: hash })),
    runtimeSources: FONT_SYSTEM_CONTRACT.runtimeSources,
    channels: channelTypography,
    activeRoots: [...ACTIVE_PREFIXES, ...ROOT_ACTIVE_FILES],
    legacyResidue: findings,
    verification: FONT_SYSTEM_CONTRACT.verification,
    status: findings.length === 0 ? "pass-contract-only" : "fail",
  } as const;
}

export function runFontSystemCheck(): void {
  assertContractShape();
  assertAssets();
  if (!existsSync(GENERATED_CONTRACT_PATH)) throw new Error(`Missing generated design contract: ${relative(ROOT, GENERATED_CONTRACT_PATH)}`);
  const generated = JSON.parse(readFileSync(GENERATED_CONTRACT_PATH, "utf8")) as { version?: string; sourceChecksum?: string; source?: { fonts?: unknown } };
  if (generated.version !== DESIGN_CONTRACT_VERSION || !generated.sourceChecksum) throw new Error("Generated design contract is missing version or checksum");
  if (!generated.source?.fonts) throw new Error("Generated design contract does not project the font system");
  const findings = scanLegacyResidue();
  if (findings.length > 0) {
    throw new Error(findings.map((finding) => `${finding.path}:${finding.line}: ${finding.signature}: ${finding.excerpt}`).join("\n"));
  }
  const report = `${JSON.stringify(buildReport(generated.sourceChecksum, findings), null, 2)}\n`;
  if (CHECK) {
    if (!existsSync(REPORT_PATH) || readFileSync(REPORT_PATH, "utf8") !== report) throw new Error(`Font-system evidence is stale: ${relative(ROOT, REPORT_PATH)}`);
  } else {
    writeFileSync(REPORT_PATH, report);
  }
  console.log(`${CHECK ? "Checked" : "Wrote"} font-system contract, ${checkedInFontAssets.length} checked-in assets, and ${Object.keys(channelTypography).length} channel profiles`);
}

if (import.meta.url === `file://${process.argv[1]}`) runFontSystemCheck();
