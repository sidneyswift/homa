import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BRAND_MANIFEST_SCHEMA_VERSION,
  type BrandAudience,
  type BrandCriticality,
  type BrandDeliveryState,
  type BrandDisposition,
  type BrandManifestType,
  type BrandSurfaceManifest,
  type BrandSurfaceRecord,
} from "../packages/design/src/surfaces.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "docs/homa-design/evidence/surfaces.json");
const LEGACY_OUTPUT = resolve(ROOT, "docs/homa-design/evidence/legacy-baseline.json");
const CHECK = process.argv.includes("--check");
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const stableCompare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const trackedFiles = git("ls-files").split("\n").filter(Boolean).sort();
const existing = existsSync(OUTPUT)
  ? JSON.parse(readFileSync(OUTPUT, "utf8")) as Partial<BrandSurfaceManifest>
  : null;
const initialObservedAt = existing?.surfaces?.[0]?.evidenceMetadata?.observedAt
  ?? git("show", "-s", "--format=%cI", "HEAD");

const legacyPatterns: ReadonlyArray<[string, RegExp]> = [
  ["legacy-font-schibsted", /Schibsted|schibsted/i],
  ["legacy-font-hanken", /Hanken|hanken/i],
  ["legacy-font-caveat", /Caveat|caveat/i],
  ["legacy-warm-playful-doctrine", /warm and playful/i],
  ["legacy-coral-action", /(?:primary|button|action|cta)[^\n]{0,80}(?:#F05A31|coral)|(?:#F05A31|coral)[^\n]{0,80}(?:primary|button|action|cta)/i],
  ["legacy-shape-language", /\b(?:blob|squiggle|wavy band|doodle)\b/i],
  ["legacy-token-namespace", /(?:--|\b)(?:clay|sage|gold|sky|stone|pill)(?:-|\b)/i],
];

interface Classification {
  type: BrandManifestType;
  audiences: BrandAudience[];
  disposition: BrandDisposition;
  targetProfile: string;
}

const rules: ReadonlyArray<{ match: (path: string) => boolean; value: Classification }> = [
  { match: (path) => path === "apps/web/lib/materials/page-shell.ts", value: { type: "renderer", audiences: ["family", "child"], disposition: "regenerate-derived", targetProfile: "artifact-print" } },
  { match: (path) => /^apps\/web\/app\/api\/(?:link-phone|email\/unsubscribe)\/route\.ts$/.test(path), value: { type: "template", audiences: ["family"], disposition: "replace-active", targetProfile: "web-constrained" } },
  { match: (path) => /^apps\/web\/app\/.+\/route\.ts$/.test(path), value: { type: "renderer", audiences: ["family", "provider"], disposition: "replace-active", targetProfile: "web-constrained" } },
  { match: (path) => /^apps\/web\/app\/(?:manifest|robots|sitemap)\.ts$/.test(path) || /^apps\/web\/public\/(?:ai|llms|llms-full)\.txt$/.test(path), value: { type: "generator", audiences: ["public", "provider"], disposition: "regenerate-derived", targetProfile: "metadata-constrained" } },
  { match: (path) => /^apps\/web\/app\/.+\/(?:page|layout|loading|error|not-found|opengraph-image|twitter-image|apple-icon)\.tsx$/.test(path) || /^apps\/web\/app\/(?:page|layout|error|not-found|opengraph-image|apple-icon)\.tsx$/.test(path), value: { type: "route", audiences: ["family"], disposition: "replace-active", targetProfile: "web-product" } },
  { match: (path) => /^apps\/mobile\/src\/app\/.+\.tsx$/.test(path), value: { type: "screen", audiences: ["family"], disposition: "replace-active", targetProfile: "native-product" } },
  { match: (path) => /(?:^|\/)(?:email|emails)(?:\/|[-.])/.test(path) && /\.(?:ts|tsx|html)$/.test(path), value: { type: "template", audiences: ["family"], disposition: "replace-active", targetProfile: "email-constrained" } },
  { match: (path) => /(?:^|\/)sms(?:\/|[-.])/.test(path) && /\.(?:ts|tsx|md)$/.test(path), value: { type: "template", audiences: ["family"], disposition: "replace-active", targetProfile: "sms-plain-text" } },
  { match: (path) => /^apps\/web\/(?:lib|app|components)\/.+(?:report|material|print|pdf|compliance|filing).+\.(?:ts|tsx)$/.test(path) && !/\.(?:test|spec)\./.test(path), value: { type: "renderer", audiences: ["family", "child"], disposition: "regenerate-derived", targetProfile: "artifact-print" } },
  { match: (path) => /^apps\/web\/(?:app|components)\/.+\.tsx$/.test(path) && !/\.(?:test|spec)\.tsx$/.test(path), value: { type: "component-family", audiences: ["family"], disposition: "replace-active", targetProfile: "web-product" } },
  { match: (path) => /^apps\/mobile\/src\/(?:components|features|theme|lib)\/.+\.(?:ts|tsx)$/.test(path) && !/\.(?:test|spec)\.(?:ts|tsx)$/.test(path), value: { type: "component-family", audiences: ["family"], disposition: "replace-active", targetProfile: "native-product" } },
  { match: (path) => /^apps\/mobile\/(?:modules|app\.json|assets\/)/.test(path), value: { type: "asset", audiences: ["family", "provider"], disposition: "regenerate-derived", targetProfile: "native-distribution" } },
  { match: (path) => path === "apps/web/app/globals.css", value: { type: "component-family", audiences: ["family"], disposition: "replace-active", targetProfile: "web-product" } },
  { match: (path) => /^apps\/web\/(?:public|app)\/.+\.(?:svg|png|jpg|jpeg|webp|avif|gif|ico|vcf)$/i.test(path), value: { type: "asset", audiences: ["family", "public", "provider"], disposition: "regenerate-derived", targetProfile: "asset-derived" } },
  { match: (path) => /^packages\/design\/src\/.+\.ts$/.test(path), value: { type: "authoring-rule", audiences: ["developer"], disposition: "approved-carry-forward", targetProfile: "design-contract" } },
  { match: (path) => /^packages\/design\/generated\/.+\.(?:json|css)$/.test(path), value: { type: "generator", audiences: ["developer"], disposition: "regenerate-derived", targetProfile: "design-projection" } },
  { match: (path) => /^marketing\//.test(path), value: { type: "template", audiences: ["public"], disposition: "replace-active", targetProfile: "marketing-rich" } },
  { match: (path) => path === "DESIGN.md" || /^(?:AGENTS|BUILD|README)\.md$/.test(path) || /^docs\/homa-design\/(?!evidence\/)/.test(path), value: { type: "authoring-rule", audiences: ["developer", "operator"], disposition: "replace-active", targetProfile: "authoring" } },
  { match: (path) => /^\.agents\/skills\/.+\.(?:md|ts)$/.test(path), value: { type: "authoring-rule", audiences: ["developer"], disposition: "replace-active", targetProfile: "authoring" } },
  { match: (path) => /^apps\/web\/agent\/skills\/.+\.(?:md|ts)$/.test(path), value: { type: "agent-skill", audiences: ["family", "developer"], disposition: "replace-active", targetProfile: "generated-content" } },
  { match: (path) => /^(?:packages\/core\/src\/map\/copy-laws|apps\/web\/lib\/copy-laws-runtime)\.ts$/.test(path), value: { type: "authoring-rule", audiences: ["family", "developer"], disposition: "replace-active", targetProfile: "generated-content" } },
  { match: (path) => /^apps\/web\/agent\/.+\.(?:md|ts)$/.test(path), value: { type: "prompt", audiences: ["family", "developer"], disposition: "replace-active", targetProfile: "generated-content" } },
  { match: (path) => /^scripts\/.+(?:brand|design|social|font|asset|template|prompt|persona|anchor).+\.(?:mjs|mts|ts)$/.test(path), value: { type: "generator", audiences: ["developer"], disposition: "regenerate-derived", targetProfile: "authoring" } },
  { match: (path) => /(?:^|\/)(?:evals?|evaluators?)\/.+\.(?:ts|tsx|md|json)$/.test(path), value: { type: "evaluator", audiences: ["developer"], disposition: "replace-active", targetProfile: "verification" } },
  { match: (path) => /(?:fixture|golden|anchor)/i.test(path) && /\.(?:json|html|svg|png|jpg|jpeg|pdf|md)$/.test(path), value: { type: "golden-fixture", audiences: ["developer"], disposition: "regenerate-derived", targetProfile: "verification" } },
  { match: (path) => /^supabase\/templates\/.+\.html$/.test(path), value: { type: "template", audiences: ["family", "provider"], disposition: "update-external", targetProfile: "provider-constrained" } },
];

const candidateSelectors: Array<(path: string) => boolean> = [
  (path) => path === "apps/web/lib/materials/page-shell.ts",
  (path) => /^apps\/web\/(?:app|components)\/.+\.tsx$/.test(path) && !/\.(?:test|spec)\.tsx$/.test(path),
  (path) => /^apps\/web\/app\/.+\/route\.ts$/.test(path),
  (path) => /^apps\/web\/app\/(?:manifest|robots|sitemap)\.ts$/.test(path),
  (path) => /^apps\/web\/public\/(?:ai|llms|llms-full)\.txt$/.test(path),
  (path) => /^(?:AGENTS|BUILD|README)\.md$/.test(path) || /^apps\/web\/app\/globals\.css$/.test(path),
  (path) => /^apps\/mobile\/(?:src\/(?:app|components|features|theme|lib)|modules|assets\/|app\.json)/.test(path) && !/\.(?:test|spec)\.(?:ts|tsx)$/.test(path),
  (path) => /(?:^|\/)(?:email|emails|sms)(?:\/|[-.])/.test(path) && /\.(?:ts|tsx|md|html)$/.test(path),
  (path) => /^apps\/web\/(?:lib|app|components)\/.+(?:report|material|print|pdf|compliance|filing).+\.(?:ts|tsx)$/.test(path) && !/\.(?:test|spec)\./.test(path),
  (path) => /^apps\/web\/(?:public|app)\/.+\.(?:svg|png|jpg|jpeg|webp|avif|gif|ico|vcf)$/i.test(path),
  (path) => /^packages\/design\/src\/.+\.ts$/.test(path),
  (path) => /^packages\/design\/generated\/.+\.(?:json|css)$/.test(path),
  (path) => /^marketing\//.test(path),
  (path) => path === "DESIGN.md" || /^(?:AGENTS|BUILD|README)\.md$/.test(path) || /^docs\/homa-design\/(?!evidence\/)/.test(path),
  (path) => /^\.agents\/skills\/.+\.(?:md|ts)$/.test(path),
  (path) => /^apps\/web\/agent\/.+\.(?:md|ts)$/.test(path),
  (path) => /^(?:packages\/core\/src\/map\/copy-laws|apps\/web\/lib\/copy-laws-runtime)\.ts$/.test(path),
  (path) => /^scripts\/.+(?:brand|design|social|font|asset|template|prompt|persona|anchor).+\.(?:mjs|mts|ts)$/.test(path),
  (path) => /(?:^|\/)(?:evals?|evaluators?)\/.+\.(?:ts|tsx|md|json)$/.test(path),
  (path) => /(?:fixture|golden|anchor)/i.test(path) && /\.(?:json|html|svg|png|jpg|jpeg|pdf|md)$/.test(path),
  (path) => /^supabase\/templates\/.+\.html$/.test(path),
];

const candidates = trackedFiles.filter((path) => candidateSelectors.some((selector) => selector(path)));
const classify = (path: string) => {
  const rule = rules.find((candidate) => candidate.match(path));
  if (!rule) throw new Error(`Unclassified brand surface: ${path}`);
  return rule.value;
};
for (const path of candidates) classify(path);

function ownerIssue(path: string): `gh#${number}` {
  if (/^apps\/mobile\//.test(path)) return "gh#686";
  if (/^apps\/web\/(?:app|components)\/admin\//.test(path)) return "gh#733";
  if (/report|material|print|pdf|compliance|filing/.test(path)) return "gh#687";
  if (/(?:email|sms|telnyx|handwrytten)/.test(path)) return "gh#688";
  if (/^marketing\//.test(path)) return "gh#741";
  if (/^(?:apps\/web\/app\/(?:blog|world|page)|apps\/web\/components\/marketing)/.test(path)) return "gh#683";
  if (/signin|password|onboarding|paywall|billing|unsubscribe|join/.test(path)) return "gh#684";
  if (/manifest|opengraph|twitter-image|apple-icon|favicon|homa\.vcf|robots|sitemap|rss\.xml|apps\/web\/public/.test(path)) return "gh#689";
  if (/^(?:\.agents|apps\/web\/agent|packages\/core\/src\/map\/copy-laws|apps\/web\/lib\/copy-laws-runtime)/.test(path)) return "gh#739";
  if (/^apps\/web\/components\/design\//.test(path)) return "gh#724";
  if (/^(?:DESIGN\.md|docs\/homa-design|scripts\/)/.test(path)) return "gh#717";
  if (/^apps\/web\/app\/app\//.test(path)) return "gh#685";
  return "gh#683";
}

function requiredStates(path: string, text: string, targetProfile: string): string[] {
  const states = new Set(["default"]);
  const patterns: Array<[string, RegExp]> = [
    ["loading", /loading|pending|skeleton|busy/i], ["empty", /empty|no results|nothing here/i],
    ["error", /error|failed|failure/i], ["disabled", /disabled|aria-disabled/i],
    ["success", /success|complete|ready/i], ["offline", /offline|network unavailable/i],
    ["interrupted", /interrupt|aborted|cancelled/i], ["permission", /permission|consent/i],
  ];
  for (const [state, pattern] of patterns) if (pattern.test(path) || pattern.test(text)) states.add(state);
  if (/(?:onClick|Pressable|Button|href=|<input|<select|TextInput)/.test(text)) {
    states.add("keyboard-focus");
    states.add("pressed");
  }
  if (targetProfile.startsWith("web")) states.add("forced-colors");
  return [...states].sort();
}

function criticality(path: string, audiences: BrandAudience[]): BrandCriticality {
  if (/signin|password|onboarding|billing|paywall|report|material|email|sms|print|privacy|terms|delete-account|error|not-found/.test(path)) return "journey-critical";
  if (audiences.includes("family") || audiences.includes("public") || audiences.includes("child")) return "supporting";
  return "utility";
}

function deliveryState(path: string, targetProfile: string): BrandDeliveryState {
  if (targetProfile.startsWith("native")) return "installed-client";
  if (/^(?:apps\/web\/public|marketing\/assets|apps\/web\/app\/(?:blog|world))/.test(path)) return "revocable-public";
  return "controlled-current";
}

function recordFor(path: string): BrandSurfaceRecord {
  const classification = classify(path);
  const bytes = readFileSync(resolve(ROOT, path));
  const sourceHash = sha256(bytes);
  const text = /\.(?:ts|tsx|js|mjs|mts|css|md|html|json|txt|xml|svg|vcf)$/.test(path) ? bytes.toString("utf8") : "";
  const legacySignatures = legacyPatterns.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  const isAdmin = /^apps\/web\/(?:app|components)\/admin\//.test(path);
  const isDev = /^apps\/web\/app\/dev\//.test(path);
  const audiences: BrandAudience[] = isAdmin ? ["operator"] : isDev ? ["developer"] : classification.audiences;
  const reachability: BrandSurfaceRecord["reachability"] = isAdmin ? "authenticated" : isDev ? "internal" : path.includes("public/") || audiences.includes("public") ? "public" : "authenticated";
  const isNative = classification.targetProfile.startsWith("native");
  const isRendered = ["route", "screen", "component-family", "template", "renderer", "asset"].includes(classification.type);
  return {
    id: `surface:${sha256(path).slice(0, 16)}`,
    paths: [path], type: classification.type, reachability, audiences,
    criticality: criticality(path, audiences), ownerIssue: ownerIssue(path),
    upstreamDomainOwners: [classification.targetProfile],
    dependencies: ["@homa/design"],
    requiredStates: requiredStates(path, text, classification.targetProfile),
    viewports: isRendered ? isNative ? ["compact-native", "large-text-native"] : ["320px", "390px", "768px", "1440px", "200%-zoom", "400%-reflow"] : [],
    devices: isNative ? ["oldest-supported-iPhone", "current-iPhone", "Android-compile-only"] : [],
    clients: classification.targetProfile === "email-constrained" ? ["Apple-Mail", "Gmail", "Outlook", "plain-text"] : classification.targetProfile.startsWith("web") ? ["Safari", "Chromium", "Firefox"] : [],
    assistiveModes: isRendered ? isNative ? ["VoiceOver", "Dynamic-Type", "Reduced-Motion"] : ["keyboard", "VoiceOver-Safari", "NVDA-Chromium", "Reduced-Motion", "increased-contrast"] : [],
    appearanceModes: isRendered ? ["light", "approved-adaptive", "grayscale-when-applicable"] : [],
    baseline: { fixtureChecksum: sourceHash, renderPath: null, interactionRecordingPath: null },
    targetProfiles: [classification.targetProfile],
    approvedTarget: "quiet-authority-v1",
    requirements: {
      atoms: ["semantic-color", "type-role", "spacing", "focus"],
      patterns: isRendered ? ["truthful-state", "one-useful-next-move"] : [],
      assets: classification.targetProfile.includes("rich") || classification.targetProfile.includes("product") ? ["master-Homa-identity", "roof-thread-when-earned"] : [],
      fonts: classification.targetProfile === "email-constrained" ? ["email-safe-fallback-stack"] : isRendered ? ["EB-Garamond-display", "DM-Sans-interface", "Fredoka-Logo-only"] : [],
      copyRoles: ["true-clear-memorable", "non-judgmental-child-framing"],
    },
    legacySignatures, currentAssetHashes: [sourceHash], disposition: classification.disposition, featureFlags: [],
    migrationFlag: null, rollbackBoundary: isNative ? "ota-or-store-binary" : classification.targetProfile.includes("provider") ? "provider-version-restore" : "web-deployment",
    evidencePath: null,
    requiredEvidence: isRendered ? ["baseline-pixels-pending", "baseline-interactions-pending", "performance-pending", "accessibility-pending", "residue"] : ["source-fingerprint", "legacy-signature-review"],
    productionProbe: classification.targetProfile === "authoring" ? "not-production-reachable" : "pending:brand-production-probe",
    evidenceMetadata: { contractVersion: "@homa/design:not-yet-cutover", harnessVersion: "brand-surfaces-v1", observedAt: initialObservedAt, environment: "clean-checkout-forensics", clientRuntimeFingerprint: null, pixels: null, interactions: null, performance: null, accessibility: null, artifactGeneration: null, providerState: null, publicCacheBehavior: null },
    productionReadback: null, deletionCommit: null,
    deliveryState: deliveryState(path, classification.targetProfile), rolloutState: "inventory",
  };
}

const externalSurfaces = [
  ["provider:stripe-checkout-and-portal", "provider", "gh#732", "journey-critical", "revocable-public", "update-external"],
  ["provider:supabase-auth-email", "provider", "gh#732", "journey-critical", "revocable-public", "update-external"],
  ["provider:resend-email", "provider", "gh#688", "journey-critical", "revocable-public", "update-external"],
  ["provider:telnyx-sms-and-voice", "provider", "gh#688", "journey-critical", "revocable-public", "update-external"],
  ["provider:handwrytten", "provider", "gh#740", "supporting", "revocable-public", "update-external"],
  ["provider:apple-app-store", "provider", "gh#689", "journey-critical", "revocable-public", "update-external"],
  ["provider:google-play-reserved", "provider", "gh#689", "utility", "controlled-current", "approved-carry-forward"],
  ["template:future-mobile-push", "template", "gh#688", "utility", "controlled-current", "approved-carry-forward"],
  ["provider:social-accounts", "provider", "gh#741", "supporting", "revocable-public", "update-external"],
  ["durable:vercel-blob-world-media", "durable-artifact", "gh#741", "supporting", "revocable-public", "migrate-durable"],
  ["durable:vercel-blob-family-artifacts", "durable-artifact", "gh#731", "journey-critical", "private-provenance", "migrate-durable"],
  ["durable:generated-family-reports", "durable-artifact", "gh#731", "journey-critical", "private-provenance", "migrate-durable"],
  ["durable:generated-printables", "durable-artifact", "gh#731", "journey-critical", "private-provenance", "migrate-durable"],
  ["historical:delivered-email-sms-print-mail", "durable-artifact", "gh#731", "supporting", "delivered-historical", "historical-git-only"],
  ["profile:parent-authored-filing-letter", "renderer", "gh#687", "journey-critical", "controlled-current", "approved-profile-rule"],
  ["profile:required-third-party-marks", "asset", "gh#689", "supporting", "controlled-current", "immutable-external-content"],
] as const;

const providerRecords: BrandSurfaceRecord[] = externalSurfaces.map(([key, type, issue, criticalityValue, delivery, disposition]) => ({
  id: `surface:${sha256(key).slice(0, 16)}`,
  paths: [key], type: type as BrandManifestType,
  reachability: key.includes("google-play") || key.includes("future-mobile-push") ? "internal" : "external",
  audiences: ["family", "provider"], criticality: criticalityValue as BrandCriticality, ownerIssue: issue as `gh#${number}`,
  upstreamDomainOwners: ["constrained-projection"], dependencies: ["@homa/design/constrained-projection"], requiredStates: ["default", "failure", "fallback"], viewports: [], devices: [], clients: ["provider-client"], assistiveModes: [], appearanceModes: ["provider-supported"],
  baseline: { fixtureChecksum: null, renderPath: null, interactionRecordingPath: null }, approvedTarget: "quiet-authority-v1",
  targetProfiles: ["constrained-projection"],
  requirements: { atoms: ["semantic-color", "Logo"], patterns: ["one-useful-next-move"], assets: ["approved-provider-asset"], fonts: ["provider-safe-fallback"], copyRoles: ["true-clear-memorable"] },
  legacySignatures: [], currentAssetHashes: [], disposition: disposition as BrandDisposition, featureFlags: [], migrationFlag: null, rollbackBoundary: "provider-or-artifact-version-restore", evidencePath: null,
  requiredEvidence: ["provider-readback-pending", "production-probe-pending", "residue"], productionProbe: "pending:provider-probe",
  evidenceMetadata: { contractVersion: "@homa/design:not-yet-cutover", harnessVersion: "brand-surfaces-v1", observedAt: initialObservedAt, environment: "clean-checkout-forensics", clientRuntimeFingerprint: null, pixels: null, interactions: null, performance: null, accessibility: null, artifactGeneration: null, providerState: null, publicCacheBehavior: null },
  productionReadback: null, deletionCommit: null,
  deliveryState: delivery as BrandDeliveryState, rolloutState: "inventory",
}));

const surfaces = [...candidates.map(recordFor), ...providerRecords].sort((a, b) => stableCompare(a.paths[0]!, b.paths[0]!));
const ownedInputFingerprint = sha256(surfaces.map((surface) => `${surface.paths.join("|")}:${surface.currentAssetHashes.join("|")}`).join("\n"));
const baselineSourceCommit = existing?.baselineSourceCommit ?? git("rev-parse", "HEAD");
const baselineSourceCommitTimestamp = existing?.baselineSourceCommitTimestamp ?? git("show", "-s", "--format=%cI", baselineSourceCommit);

const manifest: BrandSurfaceManifest = {
  schemaVersion: BRAND_MANIFEST_SCHEMA_VERSION,
  designEra: "quiet-authority-v1",
  baselineSourceCommit, baselineSourceCommitTimestamp, ownedInputFingerprint,
  androidDisposition: {
    status: "intentionally-unreleased",
    rulingSource: "docs/homa-planning/journeys/10-reconciliation.md#unified-cross-platform-billing and docs/homa-planning/plans/2026-08-01-unified-cross-platform-billing.md",
    requiredGuards: ["shared-asset-parity", "android-compile", "no-production-Google-Play-distribution"],
  },
  criticalityPolicy: {
    "journey-critical": "Identity, access, billing, child evidence, delivery, legal, recovery, or high failure cost. Requires the deepest scorecard and rollout evidence.",
    supporting: "Direct family or public support surface. Requires every applicable hard gate with representative channel evidence.",
    utility: "Operator, development, authoring, reserved, or low-frequency surface. Criticality may reduce breadth, never brand, behavior, accessibility, residue, or production gates.",
  },
  deliveryStatePolicy: {
    "controlled-current": "Homa can update it directly and must remove the old identity.",
    "revocable-public": "Homa must migrate or revoke the public reference and verify its destination and caches.",
    "installed-client": "Homa records minimum version, update path, adoption, and retirement behavior.",
    "delivered-historical": "Already delivered copies cannot be recalled; record stop-generation and honest residual status.",
    "private-provenance": "Original bytes remain access-controlled for lineage, evidence, or legal truth.",
  },
  surfaces,
};

const previousLegacy = existsSync(LEGACY_OUTPUT)
  ? JSON.parse(readFileSync(LEGACY_OUTPUT, "utf8")) as { ownedInputFingerprint?: string; records?: Array<{ path: string; sourceHash: string; legacySignatures: string[]; disposition: BrandDisposition }> }
  : null;
const legacyRecords = previousLegacy?.records ?? surfaces
  .filter((surface) => surface.legacySignatures.length > 0)
  .map((surface) => ({
    path: surface.paths[0]!,
    sourceHash: surface.currentAssetHashes[0] ?? "",
    legacySignatures: surface.legacySignatures,
    disposition: surface.disposition,
  }));
const legacyByHash = new Map<string, (typeof legacyRecords)[number]>();
for (const record of legacyRecords) {
  legacyByHash.set(`${record.path}:${record.sourceHash}`, record);
}
const legacyBaselineRecords = previousLegacy
  ? previousLegacy.records
  : [...legacyByHash.values()].sort((a, b) => stableCompare(`${a.path}:${a.sourceHash}`, `${b.path}:${b.sourceHash}`));
const legacyBaseline = {
  schemaVersion: BRAND_MANIFEST_SCHEMA_VERSION,
  designEra: "warm-playful-baseline",
  sourceCommit: baselineSourceCommit,
  ownedInputFingerprint: previousLegacy?.ownedInputFingerprint ?? ownedInputFingerprint,
  records: legacyBaselineRecords,
};

const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
const serializedLegacy = `${JSON.stringify(legacyBaseline, null, 2)}\n`;
if (CHECK) {
  const current = readFileSync(OUTPUT, "utf8");
  const currentLegacy = readFileSync(LEGACY_OUTPUT, "utf8");
  if (current !== serialized) throw new Error(`Brand surface manifest is stale. Run: pnpm build:brand-surfaces\nExpected fingerprint ${ownedInputFingerprint}`);
  if (currentLegacy !== serializedLegacy) throw new Error("Legacy baseline is stale. Run: pnpm build:brand-surfaces");
  console.log(`Brand surface manifest current: ${surfaces.length} surfaces, ${ownedInputFingerprint}`);
} else {
  writeFileSync(OUTPUT, serialized);
  writeFileSync(LEGACY_OUTPUT, serializedLegacy);
  console.log(`Wrote ${relative(ROOT, OUTPUT)} with ${surfaces.length} surfaces.`);
}
