import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = resolve(ROOT, "docs/homa-design/evidence/marketing-production.json");
const DESIGN_ERA = "quiet-authority-v1" as const;
const SCHEMA_VERSION = 1 as const;
const MARKETING_ROOT = "marketing/";
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".md", ".mdx", ".mjs", ".mts", ".py", ".svg", ".ts", ".tsx", ".txt", ".xml", ".yml", ".yaml"]);
const LEGACY_PATTERNS: readonly [string, RegExp][] = [
  ["legacy-font", /\b(?:Schibsted|Hanken|Caveat)\b/gi],
  ["legacy-warm-playful-doctrine", /warm[\s-]+and[\s-]+playful/gi],
  ["legacy-palette-value", /#(?:FBF7F0|F3ECE1|C44C22|9C3B1B|F1793F|E7DDCE|D6C8B4|B3A492|23304F)\b/gi],
  ["legacy-token-namespace", /--(?:clay|sage|gold|sky|stone|pill)(?:[-_][a-z0-9-]+)?\b/gi],
];
const BANNED_SOURCE_PATHS = ["homa-macmini/", "homa-research/", "homa-template/"] as const;

export type MarketingRole =
  | "voice"
  | "authoring-rule"
  | "asset"
  | "campaign"
  | "social-template"
  | "draft-bundle"
  | "published-bundle"
  | "queue"
  | "evaluator"
  | "golden-fixture"
  | "source"
  | "persona"
  | "seo-template"
  | "evidence";

export type MarketingRowState = "active" | "historical-quarantined" | "disabled" | "retired-quarantined";

export type MarketingProductionRow = {
  id: string;
  path: string;
  roles: MarketingRole[];
  state: MarketingRowState;
  sourceHash: string;
  bytes: number;
  legacySignatures: string[];
};

export type BundleFormat = {
  file: string;
  channel: string;
  status: "draft" | "approved" | "killed" | "unknown";
  exists: boolean;
  sourceHash: string | null;
};

export type BundleRecord = {
  id: string;
  path: string;
  lifecycle: string | null;
  source: string | null;
  sourceResolves: boolean;
  sourceRef: string | null;
  sourceRefResolves: boolean;
  lanes: string[];
  formats: BundleFormat[];
  scorecard: { path: string | null; exists: boolean; passed: boolean | null };
  distribution: { path: string | null; exists: boolean; urls: string[]; publishedFormats: number; refusedFormats: number };
  approval: { approved: number; draft: number; killed: number; blockedByProvider: number };
};

export type GeneratorRecord = {
  id: string;
  path: string;
  ownerIssue: string;
  purpose: string;
  state: "active" | "retired-quarantined";
  failClosed: boolean;
  sourceHash: string;
  outputPaths: string[];
};

export type IntegrationRecord = {
  id: string;
  provider: string;
  ownerIssue: string;
  channels: string[];
  state: "repository-publishing" | "blocked-founder-action" | "blocked-founder-decision" | "capability-unverified";
  evidencePath: string | null;
  externalStateClaim: boolean;
  updatePath: string;
  rollback: string;
};

export type MarketingProductionManifest = {
  schemaVersion: typeof SCHEMA_VERSION;
  designEra: typeof DESIGN_ERA;
  contractVersion: string;
  contractSourceChecksum: string;
  surfaceManifestFingerprint: string;
  authoringManifestFingerprint: string;
  ownedInputFingerprint: string;
  sourceOfTruth: string[];
  channelReductionLadder: Array<{ channel: string; state: string; hardGates: string[] }>;
  rows: MarketingProductionRow[];
  bundles: BundleRecord[];
  generators: GeneratorRecord[];
  integrations: IntegrationRecord[];
};

export type MarketingFinding = { code: string; path: string; detail: string };

export type MarketingProductionReport = {
  status: "pass" | "fail";
  manifestFingerprint: string;
  rowCount: number;
  bundleCount: number;
  generatorCount: number;
  integrationCount: number;
  roleCounts: Record<string, number>;
  quarantinedRows: number;
  findings: MarketingFinding[];
};

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const stableCompare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const rel = (path: string) => relative(ROOT, path).replaceAll("\\", "/");
const readText = (path: string) => readFileSync(resolve(ROOT, path), "utf8");
const trackedFiles = (): string[] => execFileSync("git", ["ls-files", "-z", "--", MARKETING_ROOT], { cwd: ROOT }).toString("utf8").split("\0").filter(Boolean).sort(stableCompare);
const isTextPath = (path: string) => TEXT_EXTENSIONS.has(path.slice(path.lastIndexOf(".")));
const fileHash = (path: string) => sha256(readFileSync(resolve(ROOT, path)));

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1);
  return trimmed;
}

function parseMeta(path: string): { id: string | null; lifecycle: string | null; source: string | null; lanes: string[]; formats: BundleFormat[]; scorecard: string | null } {
  const text = readText(path);
  const scalar = (key: string) => {
    const match = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(text);
    return match ? unquote(match[1]!) : null;
  };
  const lanesMatch = /^lanes:\s*\[(.*?)\]/m.exec(text);
  const formats: BundleFormat[] = [];
  for (const match of text.matchAll(/\{file:\s*([^,}]+),\s*channel:\s*([^,}]+),\s*status:\s*([^,}]+)\}/g)) {
    const file = unquote(match[1]!.trim());
    const channel = unquote(match[2]!.trim());
    const rawStatus = unquote(match[3]!.trim());
    const status = rawStatus === "draft" || rawStatus === "approved" || rawStatus === "killed" ? rawStatus : "unknown";
    const bundleRoot = dirname(path);
    const absoluteFile = resolve(ROOT, bundleRoot, file);
    formats.push({ file, channel, status, exists: existsSync(absoluteFile), sourceHash: existsSync(absoluteFile) ? sha256(readFileSync(absoluteFile)) : null });
  }
  return {
    id: scalar("id"),
    lifecycle: scalar("lifecycle"),
    source: scalar("source"),
    lanes: lanesMatch ? lanesMatch[1]!.split(",").map((entry) => unquote(entry.trim())).filter(Boolean) : [],
    formats,
    scorecard: scalar("scorecard"),
  };
}

function bundleMetaPaths(paths: readonly string[]): string[] {
  return paths.filter((path) => /^(?:marketing\/content\/(?:drafts|published))\/[^/]+\/meta\.yml$/.test(path)).sort(stableCompare);
}

function sourceRef(source: string | null): { resolves: boolean; ref: string | null; refResolves: boolean } {
  if (!source) return { resolves: false, ref: null, refResolves: false };
  const sourcePath = resolve(ROOT, source);
  if (!existsSync(sourcePath)) return { resolves: false, ref: null, refResolves: false };
  const match = /^\s*ref:\s*(\S+)/m.exec(readFileSync(sourcePath, "utf8"));
  const ref = match ? unquote(match[1]!) : null;
  return { resolves: true, ref, refResolves: Boolean(ref && existsSync(resolve(ROOT, ref))) };
}

function bundleRecords(paths: readonly string[]): BundleRecord[] {
  return bundleMetaPaths(paths).map((metaPath) => {
    const meta = parseMeta(metaPath);
    const root = dirname(metaPath);
    const source = sourceRef(meta.source);
    const scorecardPath = meta.scorecard;
    const scorecardAbsolute = scorecardPath ? resolve(ROOT, scorecardPath) : null;
    let scorecardPassed: boolean | null = null;
    if (scorecardAbsolute && existsSync(scorecardAbsolute)) {
      try {
        const parsed = JSON.parse(readFileSync(scorecardAbsolute, "utf8")) as { passed?: unknown; bundle?: unknown };
        scorecardPassed = typeof parsed.passed === "boolean" ? parsed.passed : null;
      } catch {
        scorecardPassed = null;
      }
    }
    const distributionPath = `${root}/distribution.md`;
    const hasDistribution = existsSync(resolve(ROOT, distributionPath));
    const distributionText = hasDistribution ? readText(distributionPath) : "";
    const urls = [...distributionText.matchAll(/https:\/\/[^\s)]+/g)].map((match) => match[0]!).sort(stableCompare);
    const publishedFormats = (distributionText.match(/\|\s*published\s/g) ?? []).length;
    const refusedFormats = (distributionText.match(/\|\s*refused\s/g) ?? []).length;
    const approval = {
      approved: meta.formats.filter((format) => format.status === "approved").length,
      draft: meta.formats.filter((format) => format.status === "draft").length,
      killed: meta.formats.filter((format) => format.status === "killed").length,
      blockedByProvider: meta.formats.filter((format) => format.status === "approved" && !["blog", "article"].includes(format.channel.split("+")[0]!)).length,
    };
    return {
      id: meta.id ?? root.split("/").pop()!,
      path: root,
      lifecycle: meta.lifecycle,
      source: meta.source,
      sourceResolves: source.resolves,
      sourceRef: source.ref,
      sourceRefResolves: source.refResolves,
      lanes: meta.lanes,
      formats: meta.formats.sort((left, right) => stableCompare(`${left.file}:${left.channel}`, `${right.file}:${right.channel}`)),
      scorecard: { path: scorecardPath, exists: Boolean(scorecardAbsolute && existsSync(scorecardAbsolute)), passed: scorecardPassed },
      distribution: { path: hasDistribution ? distributionPath : null, exists: hasDistribution, urls, publishedFormats, refusedFormats },
      approval,
    };
  }).sort((left, right) => stableCompare(left.path, right.path));
}

function rolesFor(path: string): MarketingRole[] {
  const roles = new Set<MarketingRole>();
  if (path === "marketing/AGENTS.md" || path.startsWith("marketing/voice/")) {
    roles.add("voice");
    roles.add("authoring-rule");
  }
  if (path.startsWith("marketing/assets/")) roles.add("asset");
  if (path.startsWith("marketing/campaigns/")) roles.add("campaign");
  if (path.startsWith("marketing/campaigns/") && /queue/i.test(path)) roles.add("queue");
  if (path.startsWith("marketing/content/drafts/")) roles.add("draft-bundle");
  if (path.startsWith("marketing/content/published/")) roles.add("published-bundle");
  if (/^marketing\/content\/(?:drafts|published)\/.*\.(?:png|jpg|jpeg|webp|gif|mp4|mov)$/i.test(path)) roles.add("asset");
  if (path.startsWith("marketing/workflows/") || path.startsWith("marketing/routines/")) roles.add("queue");
  if (path.startsWith("marketing/evals/")) roles.add("evaluator");
  if (path.startsWith("marketing/evals/fixtures/")) roles.add("golden-fixture");
  if (path.startsWith("marketing/raw/") || path.startsWith("marketing/signals/")) roles.add("source");
  if (path.startsWith("marketing/personas/")) roles.add("persona");
  if (path.startsWith("marketing/swipe/")) roles.add("social-template");
  if (path.startsWith("marketing/seo/")) roles.add("seo-template");
  if (path.startsWith("marketing/reports/")) roles.add("evidence");
  if (/captions|\/pin\/|\/x\.md$/.test(path)) roles.add("social-template");
  if (roles.size === 0) roles.add("authoring-rule");
  return [...roles].sort(stableCompare) as MarketingRole[];
}

function legacySignatures(path: string): string[] {
  if (!isTextPath(path)) return [];
  const text = readText(path);
  return LEGACY_PATTERNS.flatMap(([name, pattern]) => {
    pattern.lastIndex = 0;
    return pattern.test(text) ? [name] : [];
  });
}

function rowState(path: string, roles: readonly MarketingRole[], text: string): MarketingRowState {
  if (path.startsWith("marketing/assets/socials-starter-pack/")) return "retired-quarantined";
  const bundleMatch = /^(marketing\/content\/(?:drafts|published)\/[^/]+)\//.exec(path);
  if (bundleMatch) {
    const metaPath = `${bundleMatch[1]}/meta.yml`;
    if (existsSync(resolve(ROOT, metaPath)) && /^(?:lifecycle:\s*)(?:historical|retired)/m.test(readText(metaPath))) return "historical-quarantined";
  }
  if (roles.includes("draft-bundle") || roles.includes("campaign")) {
    if (/historical|not approved|superseded|rebuild before use/i.test(text)) return "historical-quarantined";
  }
  if (roles.includes("queue") && /enabled:\s*false|disabled/i.test(text)) return "disabled";
  return "active";
}

function rowsFor(paths: readonly string[]): MarketingProductionRow[] {
  return paths.map((path) => {
    const bytes = readFileSync(resolve(ROOT, path));
    const text = isTextPath(path) ? bytes.toString("utf8") : "";
    const roles = rolesFor(path);
    return {
      id: `marketing:${sha256(path).slice(0, 16)}`,
      path,
      roles,
      state: rowState(path, roles, text),
      sourceHash: sha256(bytes),
      bytes: bytes.byteLength,
      legacySignatures: legacySignatures(path),
    };
  }).sort((left, right) => stableCompare(left.path, right.path));
}

const GENERATOR_CATALOG: readonly Omit<GeneratorRecord, "sourceHash" | "id">[] = [
  { path: ".agents/skills/marketing-demand-engine/SKILL.md", ownerIssue: "gh#741", purpose: "Select one grounded signal and stage a gated bundle", state: "active", failClosed: true, outputPaths: ["marketing/content/drafts/"] },
  { path: ".agents/skills/marketing-article-writer/SKILL.md", ownerIssue: "gh#741", purpose: "Draft the article pillar from one grounded signal", state: "active", failClosed: true, outputPaths: ["marketing/content/drafts/*/article.mdx"] },
  { path: ".agents/skills/marketing-idea-generator/SKILL.md", ownerIssue: "gh#741", purpose: "Top up the signal reservoir without inventing evidence", state: "active", failClosed: true, outputPaths: ["marketing/signals/"] },
  { path: ".agents/skills/marketing-signal-extraction/SKILL.md", ownerIssue: "gh#741", purpose: "Extract atomic sourced signals from approved research", state: "active", failClosed: true, outputPaths: ["marketing/signals/"] },
  { path: ".agents/skills/marketing-distributor/SKILL.md", ownerIssue: "gh#741", purpose: "Publish only human-approved formats through named channel adapters", state: "active", failClosed: true, outputPaths: ["marketing/content/published/", "apps/web/content/blog/"] },
  { path: ".agents/skills/marketing-illustrator/SKILL.md", ownerIssue: "gh#741", purpose: "Generate artifact-first stills under the marketing-rich profile", state: "active", failClosed: true, outputPaths: ["marketing/content/drafts/*/images/", "marketing/content/drafts/*/pin/"] },
  { path: ".agents/skills/marketing-video-producer/SKILL.md", ownerIssue: "gh#741", purpose: "Gate video scripts before any generation spend", state: "active", failClosed: true, outputPaths: ["marketing/content/drafts/*/video/"] },
  { path: ".agents/skills/marketing-email-writer/SKILL.md", ownerIssue: "gh#741", purpose: "Derive staged email copy while DM7 remains unresolved", state: "active", failClosed: true, outputPaths: ["marketing/content/drafts/*/email/"] },
  { path: ".agents/skills/marketing-engagement-loop/SKILL.md", ownerIssue: "gh#741", purpose: "Turn aggregate publisher performance into new signals", state: "active", failClosed: true, outputPaths: ["marketing/reports/", "marketing/signals/"] },
  { path: ".agents/skills/marketing-janitor/SKILL.md", ownerIssue: "gh#741", purpose: "Archive stale signals and report scorecard trends without deleting content", state: "active", failClosed: true, outputPaths: ["marketing/reports/"] },
  { path: ".agents/skills/marketing-ugc-engine/SKILL.md", ownerIssue: "gh#741", purpose: "Stage privacy-safe UGC concepts without publishing them", state: "active", failClosed: true, outputPaths: ["marketing/content/drafts/*/video/"] },
  { path: ".agents/skills/marketing-copy-reviewer/SKILL.md", ownerIssue: "gh#739", purpose: "Read-only persona gate before editor review", state: "active", failClosed: true, outputPaths: ["marketing/content/drafts/*/meta.yml"] },
  { path: ".agents/skills/marketing-copy-editor/SKILL.md", ownerIssue: "gh#739", purpose: "House-style and claims gate for staged copy", state: "active", failClosed: true, outputPaths: ["marketing/content/drafts/*/meta.yml"] },
  { path: "scripts/brand-assets.mts", ownerIssue: "gh#719", purpose: "Project the master identity into web, native, and marketing assets", state: "active", failClosed: true, outputPaths: ["marketing/assets/brand/"] },
  { path: "scripts/brand-surfaces.mts", ownerIssue: "gh#721", purpose: "Generate the exhaustive cross-surface brand manifest", state: "active", failClosed: true, outputPaths: ["docs/homa-design/evidence/surfaces.json"] },
  { path: "marketing/evals/score_bundle.py", ownerIssue: "gh#741", purpose: "Deterministic grounding, voice, duplication, and completeness floor", state: "active", failClosed: true, outputPaths: ["marketing/evals/scorecards/"] },
  { path: "scripts/socials-starter-pack-assets.mts", ownerIssue: "gh#741", purpose: "Retired pre-Quiet social starter-pack generator; replacement must land before reactivation", state: "retired-quarantined", failClosed: true, outputPaths: ["marketing/assets/socials-starter-pack/"] },
];

function generatorRecords(paths: readonly string[]): GeneratorRecord[] {
  const tracked = new Set([...paths, ...execFileSync("git", ["ls-files", "-z", "--", ".agents/skills", "scripts"], { cwd: ROOT }).toString("utf8").split("\0").filter(Boolean)]);
  return GENERATOR_CATALOG.map((entry) => {
    if (!tracked.has(entry.path) || !existsSync(resolve(ROOT, entry.path))) throw new Error(`Generator catalog path is missing: ${entry.path}`);
    return { ...entry, id: `generator:${sha256(entry.path).slice(0, 16)}`, sourceHash: fileHash(entry.path) };
  }).sort((left, right) => stableCompare(left.path, right.path));
}

const INTEGRATIONS: readonly IntegrationRecord[] = [
  { id: "blog-git", provider: "git-and-vercel", ownerIssue: "gh#741", channels: ["blog"], state: "repository-publishing", evidencePath: "marketing/content/published/2026-08-03-how-to-track-homeschool-hours-without-losing-the-week/distribution.md", externalStateClaim: false, updatePath: "marketing-distributor copies approved article and assets, then the web deployment and canonical probe provide release evidence", rollback: "Revert the web deployment and restore the prior published bundle path." },
  { id: "postiz-social", provider: "Postiz", ownerIssue: "gh#183", channels: ["tiktok", "instagram", "youtube", "facebook", "pinterest", "x"], state: "blocked-founder-action", evidencePath: "docs/homa-design/evidence/channel-evidence.json", externalStateClaim: false, updatePath: "Founder registers and connects named @thankshoma profiles, then auth status and integration readback are retained.", rollback: "Remove only the scheduled post or disconnect the named integration; never replay an entire queue." },
  { id: "resend-email", provider: "Resend", ownerIssue: "gh#182", channels: ["email"], state: "blocked-founder-decision", evidencePath: "docs/homa-planning/14-marketing-demand-engine.md", externalStateClaim: false, updatePath: "Founder rules DM7 consent scope before any marketing send; the waitlist promise remains binding.", rollback: "Do not send. If DM7 is ruled, revoke the campaign audience and retain aggregate delivery evidence only." },
  { id: "higgsfield-video", provider: "Higgsfield", ownerIssue: "gh#741", channels: ["video"], state: "capability-unverified", evidencePath: null, externalStateClaim: false, updatePath: "Run the generation skill only after script gates pass and retain model, prompt, and job URL in the bundle.", rollback: "Discard the staged asset and regenerate from the gated script; no external publication occurs automatically." },
  { id: "canonical-public-domain", provider: "thankshoma.com", ownerIssue: "gh#689", channels: ["blog", "public"], state: "repository-publishing", evidencePath: "marketing/content/published/2026-08-03-how-to-track-homeschool-hours-without-losing-the-week/distribution.md", externalStateClaim: false, updatePath: "A merged web deployment plus a fresh canonical URL probe is the only production evidence.", rollback: "Roll back the web deployment and re-probe the canonical route before restoring traffic." },
];

const CHANNEL_LADDER = [
  { channel: "blog", state: "repository-publishing", hardGates: ["source-and-signal", "reader-then-editor", "scorecard-pass", "approved-format", "web-build", "canonical-live-probe"] },
  { channel: "social", state: "blocked-founder-action", hardGates: ["approved-format", "postiz-auth", "named-integration-readback", "media-upload-readback", "canonical-url", "rollback-record"] },
  { channel: "email", state: "blocked-founder-decision", hardGates: ["dm7-consent-ruling", "approved-format", "resend-delivery-readback", "unsubscribe-readback"] },
  { channel: "video", state: "staged-only", hardGates: ["script-gates", "timed-asset-review", "privacy-review", "platform-crop-review"] },
] as const;

function loadEvidence(path: string): Record<string, unknown> {
  if (!existsSync(resolve(ROOT, path))) return {};
  try { return JSON.parse(readText(path)) as Record<string, unknown>; } catch { return {}; }
}

export function buildManifest(): MarketingProductionManifest {
  const paths = trackedFiles();
  const rows = rowsFor(paths);
  const bundles = bundleRecords(paths);
  const generators = generatorRecords(paths);
  const integrations = INTEGRATIONS.map((entry) => ({ ...entry }));
  const contract = loadEvidence("packages/design/generated/contract.json");
  const surfaces = loadEvidence("docs/homa-design/evidence/surfaces.json");
  const authoring = loadEvidence("docs/homa-design/evidence/authoring-rails.json");
  const manifestInput = JSON.stringify({ rows, bundles, generators, integrations });
  return {
    schemaVersion: SCHEMA_VERSION,
    designEra: DESIGN_ERA,
    contractVersion: typeof contract.version === "string" ? contract.version : DESIGN_ERA,
    contractSourceChecksum: typeof contract.sourceChecksum === "string" ? contract.sourceChecksum : "",
    surfaceManifestFingerprint: typeof surfaces.ownedInputFingerprint === "string" ? surfaces.ownedInputFingerprint : "",
    authoringManifestFingerprint: typeof authoring.manifestFingerprint === "string" ? authoring.manifestFingerprint : "",
    ownedInputFingerprint: sha256(manifestInput),
    sourceOfTruth: ["marketing/AGENTS.md", "marketing/voice/house-style.md", "docs/homa-planning/14-marketing-demand-engine.md", "packages/design/generated/contract.json", "docs/homa-design/evidence/surfaces.json", "docs/homa-design/evidence/authoring-rails.json"],
    channelReductionLadder: CHANNEL_LADDER.map((entry) => ({ ...entry, hardGates: [...entry.hardGates] })),
    rows,
    bundles,
    generators,
    integrations,
  };
}

function validateBundle(bundle: BundleRecord, findings: MarketingFinding[]): void {
  if (!bundle.id || !bundle.lifecycle) findings.push({ code: "bundle-meta-incomplete", path: bundle.path, detail: "Bundle meta.yml must include id and lifecycle." });
  if (!bundle.sourceResolves) findings.push({ code: "bundle-source-missing", path: bundle.path, detail: `Source signal does not resolve: ${bundle.source ?? "none"}.` });
  if (bundle.sourceResolves && !bundle.sourceRefResolves) findings.push({ code: "signal-grounding-missing", path: bundle.path, detail: `Signal source.ref does not resolve: ${bundle.sourceRef ?? "none"}.` });
  for (const format of bundle.formats) {
    if (!format.exists) findings.push({ code: "format-missing", path: `${bundle.path}/${format.file}`, detail: "Format listed in meta.yml does not exist." });
    if (format.status === "unknown") findings.push({ code: "format-status-unknown", path: `${bundle.path}/meta.yml`, detail: `Unsupported format status for ${format.file}.` });
    if (format.status === "approved" && bundle.scorecard.passed !== true) findings.push({ code: "approved-without-scorecard", path: `${bundle.path}/meta.yml`, detail: "Approved format requires a passing deterministic scorecard." });
  }
  if (bundle.scorecard.path && (!bundle.scorecard.exists || bundle.scorecard.passed !== true)) findings.push({ code: "scorecard-not-passing", path: bundle.scorecard.path, detail: "Bundle scorecard is missing or not passed." });
  if (bundle.path.startsWith("marketing/content/published/") && !bundle.distribution.exists) findings.push({ code: "published-without-distribution", path: bundle.path, detail: "Published bundle must carry distribution.md, including refused formats." });
  if (bundle.distribution.exists && bundle.approval.approved < bundle.distribution.publishedFormats) findings.push({ code: "distribution-overclaims", path: bundle.distribution.path ?? bundle.path, detail: "Distribution records more published formats than meta.yml approved." });
  if (bundle.approval.blockedByProvider > 0 && bundle.distribution.publishedFormats > 0 && bundle.distribution.urls.some((url) => /(?:tiktok|instagram|youtube|facebook|pinterest|x\.com)/i.test(url))) findings.push({ code: "provider-publication-unverified", path: bundle.path, detail: "Social publication cannot be claimed without provider readback." });
}

export function validateManifest(manifest: MarketingProductionManifest): MarketingFinding[] {
  const findings: MarketingFinding[] = [];
  if (manifest.schemaVersion !== SCHEMA_VERSION) findings.push({ code: "schema-version", path: OUTPUT_PATH, detail: `Expected schema ${SCHEMA_VERSION}.` });
  if (manifest.designEra !== DESIGN_ERA) findings.push({ code: "design-era", path: OUTPUT_PATH, detail: `Expected ${DESIGN_ERA}.` });
  if (!/^[0-9a-f]{64}$/.test(manifest.ownedInputFingerprint)) findings.push({ code: "fingerprint-shape", path: OUTPUT_PATH, detail: "Owned input fingerprint must be SHA-256." });
  const paths = manifest.rows.map((row) => row.path);
  if (new Set(paths).size !== paths.length) findings.push({ code: "duplicate-row", path: OUTPUT_PATH, detail: "Marketing production rows must be unique." });
  if (paths.some((path, index) => path !== [...paths].sort(stableCompare)[index])) findings.push({ code: "row-order", path: OUTPUT_PATH, detail: "Marketing production rows must be sorted by path." });
  // draft-bundle is intentionally excluded: a draft is transient work in
  // progress, and zero drafts in flight is a normal, correct state (it
  // does not mean the drafting pipeline is broken the way zero rows of
  // any other role here would).
  const requiredRoles: MarketingRole[] = ["voice", "asset", "campaign", "social-template", "published-bundle", "queue", "evaluator"];
  const roleCounts: Record<string, number> = {};
  for (const row of manifest.rows) {
    for (const role of row.roles) roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    if (!existsSync(resolve(ROOT, row.path))) findings.push({ code: "row-missing", path: row.path, detail: "Manifest row path is not present in the checkout." });
    if (fileHash(row.path) !== row.sourceHash) findings.push({ code: "row-stale", path: row.path, detail: "Manifest source hash does not match the checkout." });
    if (row.state === "active" && row.legacySignatures.length > 0 && !row.roles.includes("evaluator")) findings.push({ code: "active-legacy-signature", path: row.path, detail: `Active row retains ${row.legacySignatures.join(", ")}.` });
    if (isTextPath(row.path) && row.state === "active" && !row.roles.includes("evaluator") && !row.roles.includes("golden-fixture")) {
      const text = readText(row.path);
      if (/\u2014|\u2013/.test(text)) findings.push({ code: "active-dash", path: row.path, detail: "Active marketing production text contains an em or en dash." });
      for (const banned of BANNED_SOURCE_PATHS) if (text.includes(banned) && row.path !== "marketing/AGENTS.md" && !row.roles.includes("evaluator")) findings.push({ code: "banned-source-reference", path: row.path, detail: `Banned source path appears in active text: ${banned}` });
    }
  }
  for (const role of requiredRoles) if (!roleCounts[role]) findings.push({ code: "missing-role", path: "marketing/", detail: `No manifest row carries required role ${role}.` });
  for (const bundle of manifest.bundles) validateBundle(bundle, findings);
  const generatorPaths = new Set(manifest.generators.map((generator) => generator.path));
  for (const generator of manifest.generators) {
    if (!existsSync(resolve(ROOT, generator.path))) findings.push({ code: "generator-missing", path: generator.path, detail: "Generator catalog path is not present." });
    if (fileHash(generator.path) !== generator.sourceHash) findings.push({ code: "generator-stale", path: generator.path, detail: "Generator source hash does not match the checkout." });
    if (generator.state === "retired-quarantined" && !generator.failClosed) findings.push({ code: "retired-generator-open", path: generator.path, detail: "Retired generator must fail closed." });
  }
  if (!generatorPaths.has("scripts/socials-starter-pack-assets.mts")) findings.push({ code: "social-generator-untracked", path: "scripts/socials-starter-pack-assets.mts", detail: "Retired social generator must be recorded explicitly." });
  try {
    const packageJson = JSON.parse(readText("package.json")) as { scripts?: Record<string, unknown> };
    const socialsCommand = packageJson.scripts?.["gen:socials"];
    if (typeof socialsCommand !== "string" || socialsCommand.includes("scripts/socials-starter-pack-assets.mts")) findings.push({ code: "social-generator-command-open", path: "package.json", detail: "gen:socials must fail closed instead of invoking the retired generator." });
  } catch {
    findings.push({ code: "package-manifest-invalid", path: "package.json", detail: "Could not parse package scripts for the retired social generator gate." });
  }
  for (const integration of manifest.integrations) {
    if (integration.externalStateClaim) findings.push({ code: "external-state-claim", path: integration.id, detail: "External integration records must not claim state without retained readback." });
    if (integration.state === "blocked-founder-action" && !integration.ownerIssue.startsWith("gh#")) findings.push({ code: "founder-action-owner-missing", path: integration.id, detail: "Blocked integration needs a named GitHub issue." });
    if (integration.evidencePath && !existsSync(resolve(ROOT, integration.evidencePath))) findings.push({ code: "integration-evidence-missing", path: integration.id, detail: `Evidence path does not resolve: ${integration.evidencePath}` });
  }
  return findings;
}

export function buildReport(manifest = buildManifest()): MarketingProductionReport {
  const findings = validateManifest(manifest);
  const roleCounts: Record<string, number> = {};
  for (const row of manifest.rows) for (const role of row.roles) roleCounts[role] = (roleCounts[role] ?? 0) + 1;
  return {
    status: findings.length === 0 ? "pass" : "fail",
    manifestFingerprint: manifest.ownedInputFingerprint,
    rowCount: manifest.rows.length,
    bundleCount: manifest.bundles.length,
    generatorCount: manifest.generators.length,
    integrationCount: manifest.integrations.length,
    roleCounts,
    quarantinedRows: manifest.rows.filter((row) => row.state !== "active").length,
    findings,
  };
}

function main(): void {
  if (process.argv.includes("--fail-closed-legacy-generator")) {
    throw new Error("The retired social starter-pack generator is quarantined. Migrate the output to the Quiet authority asset pipeline before generating social profiles.");
  }
  const manifest = buildManifest();
  const report = buildReport(manifest);
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`Wrote ${rel(OUTPUT_PATH)} (${report.rowCount} rows, ${report.bundleCount} bundles).`);
  }
  if (process.argv.includes("--check")) {
    if (!existsSync(OUTPUT_PATH)) throw new Error(`Missing ${rel(OUTPUT_PATH)}. Run pnpm build:marketing-production.`);
    const committed = JSON.parse(readFileSync(OUTPUT_PATH, "utf8")) as MarketingProductionManifest;
    if (JSON.stringify(committed) !== JSON.stringify(manifest)) throw new Error(`Marketing production manifest is stale. Run pnpm build:marketing-production (expected ${manifest.ownedInputFingerprint}).`);
  }
  if (report.findings.length > 0) {
    for (const finding of report.findings) console.error(`[${finding.code}] ${finding.path}: ${finding.detail}`);
    throw new Error(`Marketing production check failed with ${report.findings.length} finding(s).`);
  }
  console.log(`Marketing production contract current: ${report.rowCount} rows, ${report.bundleCount} bundles, ${report.generatorCount} generators, ${report.integrationCount} integrations, ${report.quarantinedRows} quarantined/disabled rows.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
