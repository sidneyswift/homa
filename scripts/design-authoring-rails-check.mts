import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DESIGN_CONTRACT_VERSION } from "../packages/design/src/contract/version.ts";
import type { BrandSurfaceManifest } from "../packages/design/src/surfaces.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = resolve(ROOT, "docs/homa-design/evidence/surfaces.json");
const REPORT_PATH = resolve(ROOT, "docs/homa-design/evidence/authoring-rails.json");
const CONTRACT_PATH = resolve(ROOT, "packages/design/generated/contract.json");
const DESIGN_PATH = resolve(ROOT, "DESIGN.md");
const CHECK = process.argv.includes("--check");

const AUTHORING_TYPES = ["authoring-rule", "agent-skill", "prompt", "evaluator", "golden-fixture"] as const;
type AuthoringType = (typeof AUTHORING_TYPES)[number];

const TEXT_EXTENSIONS = new Set([".md", ".mdx", ".mts", ".mjs", ".ts", ".tsx", ".py", ".json", ".yml", ".yaml"]);
const SKILL_TEXT_EXTENSIONS = new Set([".md", ".mdx", ".mts", ".mjs", ".ts", ".tsx"]);
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const stableCompare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();

export type AuthoringExpectation = {
  path: string;
  type: AuthoringType;
  ownerIssue: `gh#${number}`;
  consumer: string;
};

export type AuthoringFinding = {
  path: string;
  line: number;
  rule: string;
  excerpt: string;
};

export type DesignAuthoringRailsReport = {
  schemaVersion: 1;
  designEra: "quiet-authority-v1";
  contractVersion: typeof DESIGN_CONTRACT_VERSION;
  contractSourceChecksum: string;
  manifestFingerprint: string;
  manifestBaselineSourceCommit: string;
  authoringRoots: string[];
  counts: Record<AuthoringType, number>;
  expectedPaths: number;
  coveredPaths: number;
  sourceFingerprint: string;
  assetGenerator: {
    paths: string[];
    sourceHashes: Record<string, string>;
    findings: AuthoringFinding[];
    generatedAssets: number;
  };
  residue: {
    findings: AuthoringFinding[];
    approvedProfileRules: Array<{ path: string; rule: string; reason: string; sourceHash: string }>;
  };
  status: "pass";
};

const authoringRoots = [
  ".agents/skills/",
  "apps/web/agent/",
  "marketing/voice/",
  "marketing/evals/",
  "docs/homa-design/",
  "packages/design/src/contract/",
] as const;

const approvedProfileRules = [
  {
    path: "packages/design/src/contract/contract.test.ts",
    rule: "negative-identity-sentinel",
    reason: "The contract test proves retired fonts and shape words cannot enter the active typed contract. It is a negative assertion, not an authoring instruction.",
  },
] as const;

function trackedFiles(): string[] {
  return git("ls-files", "-z").split("\0").filter(Boolean).sort(stableCompare);
}

function isTextPath(path: string): boolean {
  const dot = path.lastIndexOf(".");
  return dot >= 0 && TEXT_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

function expectedAuthoringType(path: string): AuthoringType | null {
  if (path === "marketing/AGENTS.md" || path === "docs/homa-design/SKILL.md" || path === "docs/homa-design/readme.md") return "authoring-rule";
  if (path.startsWith("packages/design/src/contract/") && path.endsWith(".ts")) return "authoring-rule";
  if (path.startsWith("marketing/voice/") && isTextPath(path)) return "authoring-rule";
  if (path.startsWith("marketing/evals/fixtures/") && isTextPath(path)) return "golden-fixture";
  if (path.startsWith("marketing/evals/") && isTextPath(path)) return "evaluator";
  if (path.startsWith(".agents/skills/") && SKILL_TEXT_EXTENSIONS.has(path.slice(path.lastIndexOf(".")))) return path.endsWith("/SKILL.md") ? "agent-skill" : "authoring-rule";
  if (path.startsWith("apps/web/agent/skills/") && SKILL_TEXT_EXTENSIONS.has(path.slice(path.lastIndexOf(".")))) return path.endsWith("/SKILL.md") ? "agent-skill" : "authoring-rule";
  if (path.startsWith("apps/web/agent/") && !path.startsWith("apps/web/agent/channels/") && !path.startsWith("apps/web/agent/instructions/") && SKILL_TEXT_EXTENSIONS.has(path.slice(path.lastIndexOf(".")))) return "prompt";
  return null;
}

function consumerFor(type: AuthoringType): string {
  switch (type) {
    case "agent-skill": return "design-authoring";
    case "prompt": return "design-authoring";
    case "evaluator": return "authoring-rails-check";
    case "golden-fixture": return "authoring-rails-check";
    case "authoring-rule": return "@homa/design";
  }
}

export function classifyAuthoringExpectation(path: string): AuthoringExpectation | null {
  const type = expectedAuthoringType(path);
  return type ? { path, type, ownerIssue: "gh#739", consumer: consumerFor(type) } : null;
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

type ResidueRule = { name: string; pattern: RegExp; applies: (path: string, text: string, offset: number) => boolean };

const activeDesignPath = (path: string) => path.startsWith(".agents/skills/")
  || path.startsWith("apps/web/agent/")
  || path.startsWith("marketing/voice/")
  || path.startsWith("marketing/evals/")
  || path.startsWith("docs/homa-design/")
  || path.startsWith("packages/design/src/contract/");

const residueRules: readonly ResidueRule[] = [
  { name: "legacy-font", pattern: /\b(?:Schibsted|Hanken|Caveat)\b/g, applies: () => true },
  { name: "legacy-warm-playful-doctrine", pattern: /warm[\s-]+and[\s-]+playful/gi, applies: () => true },
  { name: "legacy-design-doc-path", pattern: /docs\/homa-design\/(?:components|guidelines|templates|tokens|ui_kits|styles\.css)/gi, applies: () => true },
  { name: "legacy-palette-value", pattern: /#(?:FBF7F0|F3ECE1|C44C22|9C3B1B|F1793F|E7DDCE|D6C8B4|B3A492|3D9A50|7CC689|FFD43B|4FB4D6|23304F|F05A31)\b/gi, applies: () => true },
  { name: "legacy-token-namespace", pattern: /--(?:clay|sage|gold|sky|stone|pill)(?:[-_][a-z0-9-]+)?\b/gi, applies: () => true },
  {
    name: "legacy-shape-language",
    pattern: /\b(?:squiggle|wavy band|doodle)\b/gi,
    applies: (path, text, offset) => {
      if (!activeDesignPath(path)) return false;
      const context = text.slice(Math.max(0, offset - 80), offset + 120).toLowerCase();
      // Material craft names are content instructions, not a UI shape rule.
      return !/(?:clay|painting|collage|paper|craft|activity|art-project|recipe|\bart\b)/.test(context);
    },
  },
];

function isApprovedProfileRule(path: string, rule: string): boolean {
  return approvedProfileRules.some((entry) => entry.path === path && (entry.rule === rule || entry.rule === "negative-identity-sentinel"));
}

export function scanAuthoringText(path: string, text: string): AuthoringFinding[] {
  if (!activeDesignPath(path)) return [];
  const findings: AuthoringFinding[] = [];
  for (const rule of residueRules) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(text)) !== null) {
      if (rule.applies(path, text, match.index) && !isApprovedProfileRule(path, rule.name)) {
        findings.push({ path, line: lineAt(text, match.index), rule: rule.name, excerpt: excerptAt(text, match.index) });
      }
      if (rule.pattern.lastIndex === match.index) rule.pattern.lastIndex += 1;
    }
  }
  return findings;
}

const assetGeneratorPaths = ["scripts/brand-assets.mts"] as const;
const generatedAssetPrefixes = [
  "apps/web/public/brand/",
  "marketing/assets/brand/",
  "apps/mobile/assets/brand/",
  "apps/mobile/assets/images/",
] as const;

function scanAssetGenerator(path: string, text: string): AuthoringFinding[] {
  const findings: AuthoringFinding[] = [];
  const rules: Array<[string, RegExp]> = [
    ["raw-brand-color", /#(?:FBF7F0|F3ECE1|F1793F|3D9A50|7CC689|FFD43B|4FB4D6|23304F|FBE8DF)\b/gi],
    ["retired-token-alias", /\b(?:CLAY_|STONE_|NIGHT_NAVY|BG_PAGE|CLAY_50)\b/g],
    ["retired-design-path", /guidelines\/brand-logo-lockup|components\/brand\/Logo\.tsx/g],
  ];
  for (const [rule, pattern] of rules) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      findings.push({ path, line: lineAt(text, match.index), rule, excerpt: excerptAt(text, match.index) });
      if (pattern.lastIndex === match.index) pattern.lastIndex += 1;
    }
  }
  return findings;
}

function sourceHash(path: string): string {
  return sha256(readFileSync(resolve(ROOT, path)));
}

function assertManifestShape(manifest: BrandSurfaceManifest): void {
  if (manifest.schemaVersion !== 1 || manifest.designEra !== "quiet-authority-v1") throw new Error("Brand manifest is not the Quiet authority schema");
  if (!/^[0-9a-f]{64}$/.test(manifest.ownedInputFingerprint)) throw new Error("Brand manifest has no valid owned-input fingerprint");
  const paths = new Set<string>();
  for (const surface of manifest.surfaces) {
    if (surface.paths.length !== 1) throw new Error(`Manifest row must have one exact path: ${surface.id}`);
    const path = surface.paths[0]!;
    if (paths.has(path)) throw new Error(`Duplicate manifest path: ${path}`);
    paths.add(path);
    if (surface.approvedTarget !== "quiet-authority-v1") throw new Error(`Manifest row has an unapproved target: ${path}`);
    if (!surface.dependencies.some((dependency) => dependency.startsWith("@homa/design")) && surface.type !== "provider") throw new Error(`Manifest row is missing @homa/design dependency: ${path}`);
    if (surface.currentAssetHashes.length > 0 && surface.baseline.fixtureChecksum !== surface.currentAssetHashes[0]) throw new Error(`Manifest fixture checksum drift: ${path}`);
    if (surface.currentAssetHashes.length > 0 && existsSync(resolve(ROOT, path)) && sourceHash(path) !== surface.currentAssetHashes[0]) throw new Error(`Manifest source fingerprint drift: ${path}`);
  }
  const expected = sha256(manifest.surfaces.map((surface) => `${surface.paths.join("|")}:${surface.currentAssetHashes.join("|")}`).join("\n"));
  if (expected !== manifest.ownedInputFingerprint) throw new Error(`Manifest owned-input fingerprint drift: expected ${expected}`);
}

function buildReport(): DesignAuthoringRailsReport {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as BrandSurfaceManifest;
  assertManifestShape(manifest);
  const expectations = trackedFiles().map(classifyAuthoringExpectation).filter((value): value is AuthoringExpectation => value !== null);
  const byPath = new Map(manifest.surfaces.map((surface) => [surface.paths[0]!, surface]));
  const missing: string[] = [];
  const mismatched: string[] = [];
  const counts = Object.fromEntries(AUTHORING_TYPES.map((type) => [type, 0])) as Record<AuthoringType, number>;
  for (const expectation of expectations) {
    const surface = byPath.get(expectation.path);
    if (!surface) {
      missing.push(expectation.path);
      continue;
    }
    counts[expectation.type] += 1;
    if (surface.type !== expectation.type || !/^gh#\d+$/.test(surface.ownerIssue) || !surface.consumers.includes(expectation.consumer)) {
      mismatched.push(`${expectation.path} expected ${expectation.type}/${expectation.consumer}, got ${surface.type}/${surface.ownerIssue}/${surface.consumers.join(",")}`);
    }
    if (surface.disposition === "temporary-migration-exemption" || surface.migrationFlag !== null) mismatched.push(`${expectation.path} carries a temporary migration exemption`);
    if (surface.evidenceMetadata.contractVersion !== `@homa/design:${DESIGN_CONTRACT_VERSION}`) mismatched.push(`${expectation.path} has stale contract evidence`);
    if (!surface.requiredEvidence.includes("source-fingerprint") || !surface.requiredEvidence.includes("legacy-signature-review")) mismatched.push(`${expectation.path} is missing authoring evidence requirements`);
  }
  if (missing.length > 0 || mismatched.length > 0) throw new Error([...missing.map((path) => `Missing authoring manifest row: ${path}`), ...mismatched].join("\n"));
  for (const type of AUTHORING_TYPES) if (counts[type] === 0) throw new Error(`Authoring manifest has no ${type} rows`);

  const residue: AuthoringFinding[] = [];
  for (const expectation of expectations) {
    const text = readFileSync(resolve(ROOT, expectation.path), "utf8");
    residue.push(...scanAuthoringText(expectation.path, text));
  }
  if (residue.length > 0) throw new Error(residue.map((finding) => `${finding.path}:${finding.line}: ${finding.rule}: ${finding.excerpt}`).join("\n"));

  const generatorFindings: AuthoringFinding[] = [];
  const generatorHashes: Record<string, string> = {};
  for (const path of assetGeneratorPaths) {
    generatorHashes[path] = sourceHash(path);
    generatorFindings.push(...scanAssetGenerator(path, readFileSync(resolve(ROOT, path), "utf8")));
    const row = byPath.get(path);
    if (!row || row.type !== "generator") throw new Error(`Asset generator is not registered as a generator row: ${path}`);
    if (row.currentAssetHashes[0] !== generatorHashes[path]) throw new Error(`Asset generator fingerprint drift: ${path}`);
  }
  if (generatorFindings.length > 0) throw new Error(generatorFindings.map((finding) => `${finding.path}:${finding.line}: ${finding.rule}: ${finding.excerpt}`).join("\n"));

  const generatedAssets = manifest.surfaces.filter((surface) => surface.type === "asset" && generatedAssetPrefixes.some((prefix) => surface.paths[0]!.startsWith(prefix))).length;
  if (generatedAssets === 0) throw new Error("No generated brand assets are registered in the manifest");
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8")) as { version: string; sourceChecksum: string };
  if (contract.version !== DESIGN_CONTRACT_VERSION) throw new Error("Generated design contract version drift");
  const designDocument = readFileSync(DESIGN_PATH, "utf8");
  if (!designDocument.includes(`version: ${DESIGN_CONTRACT_VERSION}`) || !designDocument.includes(`contractChecksum: ${contract.sourceChecksum}`)) throw new Error("DESIGN.md does not point at the generated contract");

  const sourceFingerprint = sha256(expectations.map((expectation) => `${expectation.path}:${sourceHash(expectation.path)}`).join("\n"));
  return {
    schemaVersion: 1,
    designEra: "quiet-authority-v1",
    contractVersion: DESIGN_CONTRACT_VERSION,
    contractSourceChecksum: contract.sourceChecksum,
    manifestFingerprint: manifest.ownedInputFingerprint,
    manifestBaselineSourceCommit: manifest.baselineSourceCommit,
    authoringRoots: [...authoringRoots],
    counts,
    expectedPaths: expectations.length,
    coveredPaths: expectations.length,
    sourceFingerprint,
    assetGenerator: {
      paths: [...assetGeneratorPaths],
      sourceHashes: generatorHashes,
      findings: [],
      generatedAssets,
    },
    residue: {
      findings: [],
      approvedProfileRules: approvedProfileRules.map((entry) => ({ ...entry, sourceHash: sourceHash(entry.path) })),
    },
    status: "pass",
  };
}

export { buildReport };

function main(): void {
  const report = `${JSON.stringify(buildReport(), null, 2)}\n`;
  if (CHECK) {
    const current = readFileSync(REPORT_PATH, "utf8");
    if (current !== report) throw new Error(`Authoring rails evidence is stale. Run: pnpm build:design-authoring`);
    console.log(`Design authoring rails current: ${report.length} bytes`);
    return;
  }
  writeFileSync(REPORT_PATH, report);
  console.log(`Wrote ${relative(ROOT, REPORT_PATH)}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === resolve(fileURLToPath(import.meta.url))) main();
