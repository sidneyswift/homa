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
import { DESIGN_CONTRACT_VERSION } from "../packages/design/src/contract/version.ts";
import {
  LEGACY_FONT_PATH_SIGNATURE,
  collectLegacySignatures,
  isLegacyFontPath,
  isLegacyTextPath,
} from "../packages/design/src/legacy-signatures.ts";
import {
  collectHistoricalQuarantineIndexViolations,
  historicalBrandQuarantinePaths,
  historicalBrandQuarantineRecords,
  isActiveAuthoringIndexOrRegistryPath,
} from "../packages/design/src/historical-quarantine.ts";
import {
  assertNoUnresolvedInterceptingRoutes,
  assertNoUnresolvedRouteHandlers,
  classifyGeneratedWebRouteBoundary,
  classifyGeneratedWebRouteHandlerBoundary,
  generatedWebRouteHandlerRuntimePolicy,
} from "./brand-route-boundary.mts";
import { collectLatestCommittedSources } from "./brand-source-provenance.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "docs/homa-design/evidence/surfaces.json");
const LEGACY_OUTPUT = resolve(ROOT, "docs/homa-design/evidence/legacy-baseline.json");
const CHECK = process.argv.includes("--check");
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const stableCompare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const git = (...args: string[]) => execFileSync("git", args, {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
}).trim();
// Include untracked, non-ignored files so a newly created surface cannot evade
// local inventory checks until it happens to be staged. CI sees the same set
// after commit, while local authoring fails closed one step earlier.
const trackedFiles = git("ls-files", "--cached", "--others", "--exclude-standard")
  .split("\n")
  .filter(Boolean)
  .sort();
assertNoUnresolvedInterceptingRoutes(trackedFiles);
assertNoUnresolvedRouteHandlers(trackedFiles);
const workingTreePaths = new Set([
  ...git("diff", "--name-only", "HEAD").split("\n").filter(Boolean),
  ...git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean),
]);
// The content lineage follows first parents except when any encountered merge
// has a tree exactly equal to parent two. That merge contributes no new bytes,
// so provenance follows the authored content parent across later main commits.
// Any merge-tree difference remains on the release lineage and fails stale.
const latestCommittedSource = collectLatestCommittedSources(git);
const existing = existsSync(OUTPUT)
  ? JSON.parse(readFileSync(OUTPUT, "utf8")) as Partial<BrandSurfaceManifest>
  : null;

function sourceProvenance(path: string): Pick<BrandSurfaceRecord["evidenceMetadata"], "observedAt" | "sourceCommitSha" | "sourceCommitTimestamp" | "environment"> {
  const source = latestCommittedSource.get(path) ?? null;
  if (workingTreePaths.has(path) || source === null) {
    return {
      observedAt: null,
      sourceCommitSha: null,
      sourceCommitTimestamp: null,
      environment: "working-tree-uncommitted",
    };
  }
  return {
    observedAt: null,
    sourceCommitSha: source.sha,
    sourceCommitTimestamp: source.committedAt,
    environment: "git-source-commit",
  };
}

interface Classification {
  type: BrandManifestType;
  audiences: BrandAudience[];
  disposition: BrandDisposition;
  targetProfile: string;
  reachability?: BrandSurfaceRecord["reachability"];
  ownerIssue?: `gh#${number}`;
  deliveryState?: BrandDeliveryState;
  productionProbe?: string;
  rollbackBoundary?: string;
}

const baseRules: ReadonlyArray<{ match: (path: string) => boolean; value: Classification }> = [
  { match: (path) => path === ".github/workflows/ci.yml" || path === "package.json" || [
    "scripts/channel-evidence-check.mts",
    "scripts/channel-evidence-contract.mts",
    "scripts/ci-change-scope.mjs",
    "scripts/evidence-receipt-loader.mts",
    "scripts/brand-route-boundary.mts",
    "scripts/marketing-production-check.mts",
    "scripts/marketing-production-check.test.mts",
    "scripts/native-interface-gauntlet.mts",
    "scripts/provider-handoff-check.mts",
    "scripts/provider-handoff-contract.mts",
    "scripts/seo-contract-check.mts",
  ].includes(path), value: { type: "evaluator", audiences: ["developer", "operator"], disposition: "replace-active", targetProfile: "verification", reachability: "internal", ownerIssue: "gh#721", deliveryState: "controlled-current" } },
  { match: (path) => path === ".cosmo/homa-taste.md", value: { type: "authoring-rule", audiences: ["developer"], disposition: "replace-active", targetProfile: "generated-content" } },
  { match: (path) => [
    "apps/web/lib/billing/portal.ts",
    "apps/web/lib/billing/wall.ts",
    "apps/web/lib/billing/apple-verify.ts",
    "apps/web/lib/supabase/server.ts",
    "apps/web/lib/supabase/client.ts",
  ].includes(path), value: { type: "generator", audiences: ["family", "developer", "provider"], disposition: "replace-active", targetProfile: "provider-constrained", reachability: "internal", ownerIssue: "gh#732", deliveryState: "controlled-current" } },
  { match: (path) => path === "apps/web/.env.example", value: { type: "authoring-rule", audiences: ["developer", "provider"], disposition: "replace-active", targetProfile: "provider-constrained", reachability: "internal", ownerIssue: "gh#732", deliveryState: "controlled-current" } },
  { match: (path) => path === "apps/web/lib/materials/page-shell.ts", value: { type: "renderer", audiences: ["family", "child"], disposition: "regenerate-derived", targetProfile: "artifact-print" } },
  { match: (path) => /^apps\/web\/app\/blog(?:\/.+)?\/(?:page|layout|loading|error|not-found|opengraph-image|twitter-image|apple-icon)\.tsx$/.test(path), value: { type: "route", audiences: ["public"], disposition: "replace-active", targetProfile: "web-product", reachability: "public", deliveryState: "revocable-public" } },
  { match: (path) => path === "apps/web/app/blog/rss.xml/route.ts", value: { type: "renderer", audiences: ["public", "provider"], disposition: "replace-active", targetProfile: "web-constrained", reachability: "public", deliveryState: "revocable-public" } },
  { match: (path) => path === "apps/web/app/homa.vcf/route.ts", value: { type: "renderer", audiences: ["public", "provider"], disposition: "regenerate-derived", targetProfile: "metadata-constrained", reachability: "public", deliveryState: "revocable-public" } },
  { match: (path) => /^apps\/web\/app\/auth\/(?:callback|confirm)\/route\.ts$/.test(path), value: { type: "renderer", audiences: ["public", "provider"], disposition: "replace-active", targetProfile: "web-constrained", reachability: "public", deliveryState: "revocable-public" } },
  { match: (path) => /^apps\/web\/content\/blog\/.+\.mdx$/.test(path), value: { type: "template", audiences: ["public"], disposition: "replace-active", targetProfile: "marketing-rich", reachability: "public", deliveryState: "revocable-public" } },
  { match: (path) => path === "apps/web/lib/blog.ts" || path === "apps/web/lib/blog-clusters.ts", value: { type: "generator", audiences: ["public", "developer"], disposition: "replace-active", targetProfile: "marketing-rich", reachability: "public", deliveryState: "revocable-public" } },
  { match: (path) => classifyGeneratedWebRouteBoundary(path) === "family", value: { type: "route", audiences: ["family"], disposition: "replace-active", targetProfile: "web-product", reachability: "authenticated", deliveryState: "controlled-current" } },
  { match: (path) => classifyGeneratedWebRouteBoundary(path) === "operator", value: { type: "route", audiences: ["operator"], disposition: "replace-active", targetProfile: "web-product", reachability: "authenticated", deliveryState: "controlled-current" } },
  { match: (path) => classifyGeneratedWebRouteBoundary(path) === "developer", value: { type: "route", audiences: ["developer"], disposition: "replace-active", targetProfile: "web-product", reachability: "internal", deliveryState: "controlled-current" } },
  { match: (path) => classifyGeneratedWebRouteBoundary(path) === "public", value: { type: "route", audiences: ["public"], disposition: "replace-active", targetProfile: "web-product", reachability: "public", deliveryState: "revocable-public" } },
  { match: (path) => classifyGeneratedWebRouteHandlerBoundary(path) === "public", value: { type: "renderer", audiences: ["public"], disposition: "replace-active", targetProfile: "web-constrained", reachability: "public", deliveryState: "revocable-public" } },
  { match: (path) => classifyGeneratedWebRouteHandlerBoundary(path) === "family", value: { type: "renderer", audiences: ["family"], disposition: "replace-active", targetProfile: "web-constrained", reachability: "authenticated", deliveryState: "controlled-current" } },
  { match: (path) => classifyGeneratedWebRouteHandlerBoundary(path) === "family-device", value: { type: "renderer", audiences: ["family", "developer"], disposition: "replace-active", targetProfile: "web-constrained", reachability: "authenticated", deliveryState: "controlled-current" } },
  { match: (path) => classifyGeneratedWebRouteHandlerBoundary(path) === "operator", value: { type: "renderer", audiences: ["operator"], disposition: "replace-active", targetProfile: "web-constrained", reachability: "authenticated", deliveryState: "controlled-current" } },
  { match: (path) => classifyGeneratedWebRouteHandlerBoundary(path) === "provider", value: { type: "renderer", audiences: ["provider"], disposition: "replace-active", targetProfile: "web-constrained", reachability: "authenticated", deliveryState: "controlled-current" } },
  { match: (path) => classifyGeneratedWebRouteHandlerBoundary(path) === "developer", value: { type: "renderer", audiences: ["developer"], disposition: "replace-active", targetProfile: "verification", reachability: "internal", deliveryState: "controlled-current" } },
  { match: (path) => classifyGeneratedWebRouteHandlerBoundary(path) === "developer-family", value: { type: "renderer", audiences: ["developer", "family"], disposition: "replace-active", targetProfile: "verification", reachability: "internal", deliveryState: "controlled-current" } },
  { match: (path) => classifyGeneratedWebRouteHandlerBoundary(path) === "internal-service", value: { type: "renderer", audiences: ["developer", "operator"], disposition: "replace-active", targetProfile: "verification", reachability: "internal", deliveryState: "controlled-current" } },
  { match: (path) => classifyGeneratedWebRouteHandlerBoundary(path) === "mixed-family-provider", value: { type: "renderer", audiences: ["family", "provider"], disposition: "replace-active", targetProfile: "web-constrained", reachability: "authenticated", deliveryState: "controlled-current" } },
  { match: (path) => /^apps\/web\/app\/(?:manifest|robots|sitemap)\.ts$/.test(path) || /^apps\/web\/public\/(?:ai|llms|llms-full)\.txt$/.test(path), value: { type: "generator", audiences: ["public", "provider"], disposition: "regenerate-derived", targetProfile: "metadata-constrained", reachability: "public", deliveryState: "revocable-public" } },
  { match: (path) => /^apps\/mobile\/src\/app\/.+\.tsx$/.test(path), value: { type: "screen", audiences: ["family"], disposition: "replace-active", targetProfile: "native-product" } },
  { match: (path) => /(?:^|\/)(?:email|emails)(?:\/|[-.])/.test(path) && /\.(?:ts|tsx|html)$/.test(path), value: { type: "template", audiences: ["family"], disposition: "replace-active", targetProfile: "email-constrained" } },
  { match: (path) => /(?:^|\/)sms(?:\/|[-.])/.test(path) && /\.(?:ts|tsx|md)$/.test(path), value: { type: "template", audiences: ["family"], disposition: "replace-active", targetProfile: "sms-plain-text" } },
  { match: (path) => /^apps\/web\/(?:lib|app|components)\/.*(?:report|material|print|pdf|compliance|filing).*\.(?:ts|tsx)$/.test(path) && !/\.(?:test|spec)\./.test(path), value: { type: "renderer", audiences: ["family", "child"], disposition: "regenerate-derived", targetProfile: "artifact-print" } },
  { match: (path) => path === "apps/web/lib/child-progress/map-model.ts", value: { type: "renderer", audiences: ["family", "developer"], disposition: "replace-active", targetProfile: "web-product" } },
  { match: (path) => /^apps\/web\/(?:app\/.*\.css|components\/design\/.*\.(?:css|ts|tsx))$/.test(path) && !/\.(?:test|spec)\./.test(path), value: { type: "component-family", audiences: ["family", "developer"], disposition: "replace-active", targetProfile: "web-product" } },
  { match: (path) => /^apps\/web\/components\/marketing\/.+\.(?:ts|tsx)$/.test(path) && !/\.(?:test|spec)\.(?:ts|tsx)$/.test(path), value: { type: "component-family", audiences: ["family", "public"], disposition: "replace-active", targetProfile: "web-product" } },
  { match: (path) => /^apps\/web\/(?:app|components)\/.*(?:copy|content|config|items)\.ts$/.test(path) && !/\.(?:test|spec)\.ts$/.test(path), value: { type: "component-family", audiences: ["family", "public"], disposition: "replace-active", targetProfile: "web-product" } },
  { match: (path) => [
    "apps/web/app/app/assistant-text.ts",
    "apps/web/app/app/onboarding-chat.ts",
    "apps/web/app/app/outbound-child-framing-display.ts",
    "apps/web/app/app/progress-message-parts.ts",
    "apps/web/app/app/tasks/agent-job-view.ts",
    "apps/web/app/app/transcript-days.ts",
  ].includes(path), value: { type: "component-family", audiences: ["family"], disposition: "replace-active", targetProfile: "web-product" } },
  { match: (path) => path === "apps/web/app/privacy/subprocessors.ts", value: { type: "template", audiences: ["family", "public", "provider"], disposition: "replace-active", targetProfile: "web-product" } },
  { match: (path) => path === "apps/web/app/world/scroll-world-engine.ts", value: { type: "renderer", audiences: ["public"], disposition: "replace-active", targetProfile: "web-product" } },
  { match: (path) => [
    "apps/web/app/onboarding/sample/narrative.fixture.ts",
    "apps/web/app/onboarding/sample/sample-answers.ts",
  ].includes(path), value: { type: "golden-fixture", audiences: ["developer", "public"], disposition: "approved-profile-rule", targetProfile: "web-product" } },
  { match: (path) => /^apps\/web\/(?:app|components)\/.+\.tsx$/.test(path) && !/\.(?:test|spec)\.tsx$/.test(path), value: { type: "component-family", audiences: ["family"], disposition: "replace-active", targetProfile: "web-product" } },
  { match: (path) => /^apps\/mobile\/src\/(?:components|features|theme|lib)\/.+\.(?:ts|tsx)$/.test(path) && !/\.(?:test|spec)\.(?:ts|tsx)$/.test(path), value: { type: "component-family", audiences: ["family"], disposition: "replace-active", targetProfile: "native-product" } },
  { match: (path) => /^apps\/mobile\/(?:modules|app\.json|eas\.json|assets\/)/.test(path), value: { type: "asset", audiences: ["family", "provider"], disposition: "regenerate-derived", targetProfile: "native-distribution" } },
  { match: (path) => /^apps\/(?:web|mobile)\/assets\/fonts\/quiet-authority\/.+\.(?:ttf|otf|woff2?)$/i.test(path), value: { type: "asset", audiences: ["family", "developer"], disposition: "approved-carry-forward", targetProfile: "font-system" } },
  { match: (path) => path === "apps/web/app/globals.css", value: { type: "component-family", audiences: ["family"], disposition: "replace-active", targetProfile: "web-product" } },
  { match: (path) => /^apps\/web\/(?:public|app)\/.+\.(?:svg|png|jpg|jpeg|webp|avif|gif|ico|vcf)$/i.test(path), value: { type: "asset", audiences: ["family", "public", "provider"], disposition: "regenerate-derived", targetProfile: "asset-derived" } },
  { match: (path) => /^packages\/design\/src\/contract\/contract\.test\.ts$/.test(path), value: { type: "authoring-rule", audiences: ["developer"], disposition: "approved-profile-rule", targetProfile: "design-contract" } },
  { match: (path) => /^packages\/design\/src\/.+\.ts$/.test(path), value: { type: "authoring-rule", audiences: ["developer"], disposition: "approved-carry-forward", targetProfile: "design-contract" } },
  { match: (path) => /^packages\/design\/generated\/.+\.(?:json|css)$/.test(path), value: { type: "generator", audiences: ["developer"], disposition: "regenerate-derived", targetProfile: "design-projection" } },
  { match: (path) => path === "packages/design/README.md" || path === "apps/web/components/design/README.md" || /^apps\/mobile\/(?:AGENTS|CLAUDE|README)\.md$/.test(path), value: { type: "authoring-rule", audiences: ["developer"], disposition: "replace-active", targetProfile: "authoring" } },
  { match: (path) => /^marketing\/evals\/fixtures\/.+\.(?:md|mdx|json|yml|yaml)$/.test(path), value: { type: "golden-fixture", audiences: ["developer"], disposition: "regenerate-derived", targetProfile: "verification" } },
  { match: (path) => /^marketing\/evals\/.+\.(?:py|md|mdx|json|yml|yaml)$/.test(path), value: { type: "evaluator", audiences: ["developer"], disposition: "replace-active", targetProfile: "verification" } },
  { match: (path) => /^marketing\/voice\/.+\.(?:md|mdx)$/.test(path) || path === "marketing/AGENTS.md", value: { type: "authoring-rule", audiences: ["developer", "public"], disposition: "replace-active", targetProfile: "authoring" } },
  { match: (path) => /^marketing\//.test(path), value: { type: "template", audiences: ["public"], disposition: "replace-active", targetProfile: "marketing-rich" } },
  { match: (path) => path === "DESIGN.md" || /^(?:AGENTS|BUILD|README)\.md$/.test(path) || /^docs\/homa-design\/(?!evidence\/)/.test(path), value: { type: "authoring-rule", audiences: ["developer", "operator"], disposition: "replace-active", targetProfile: "authoring" } },
  { match: (path) => path === "docs/homa-curriculum-atlas/materials-patterns.md", value: { type: "authoring-rule", audiences: ["developer", "family", "child"], disposition: "replace-active", targetProfile: "generated-content", ownerIssue: "gh#729" } },
  { match: (path) => path === "docs/homa-planning/journeys/evidence/raw/2026-07-07-tester-voice-memos.md", value: { type: "golden-fixture", audiences: ["developer", "public"], disposition: "replace-active", targetProfile: "marketing-rich", ownerIssue: "gh#729" } },
  { match: (path) => [
    "docs/homa-planning/build-log.md",
    "docs/homa-planning/journeys/04-feature-journeys.md",
    "docs/homa-planning/journeys/10-reconciliation.md",
  ].includes(path) || (path.startsWith("docs/homa-planning/plans/") && path !== "docs/homa-planning/plans/2026-08-02-homa-brand-system-approval.html"), value: { type: "authoring-rule", audiences: ["developer", "operator"], disposition: "replace-active", targetProfile: "authoring", ownerIssue: "gh#729" } },
  { match: (path) => /^\.agents\/skills\/.+\/SKILL\.md$/.test(path), value: { type: "agent-skill", audiences: ["developer"], disposition: "replace-active", targetProfile: "authoring" } },
  { match: (path) => /^\.agents\/skills\/.+/.test(path), value: { type: "authoring-rule", audiences: ["developer"], disposition: "replace-active", targetProfile: "authoring" } },
  { match: (path) => /^apps\/web\/agent\/skills\/.+\/SKILL\.md$/.test(path), value: { type: "agent-skill", audiences: ["family", "developer"], disposition: "replace-active", targetProfile: "generated-content" } },
  { match: (path) => /^apps\/web\/agent\/skills\/.+\.(?:md|ts)$/.test(path), value: { type: "authoring-rule", audiences: ["family", "developer"], disposition: "replace-active", targetProfile: "generated-content" } },
  { match: (path) => /^(?:packages\/core\/src\/map\/copy-laws|apps\/web\/lib\/copy-laws-runtime)\.ts$/.test(path), value: { type: "authoring-rule", audiences: ["family", "developer"], disposition: "replace-active", targetProfile: "generated-content" } },
  { match: (path) => /^apps\/web\/agent\/.+\.(?:md|ts)$/.test(path), value: { type: "prompt", audiences: ["family", "developer"], disposition: "replace-active", targetProfile: "generated-content" } },
  { match: (path) => /^scripts\/.*(?:brand|design|social|font|asset|template|prompt|persona|anchor).*\.(?:mjs|mts|ts)$/.test(path), value: { type: "generator", audiences: ["developer"], disposition: "regenerate-derived", targetProfile: "authoring" } },
  { match: (path) => /^scripts\/(?:materials-calibration|packet-render-smoke)\.mts$/.test(path), value: { type: "generator", audiences: ["developer", "family", "child"], disposition: "regenerate-derived", targetProfile: "artifact-print" } },
  { match: (path) => /(?:^|\/)(?:evals?|evaluators?)\/.+\.(?:ts|tsx|md|json)$/.test(path), value: { type: "evaluator", audiences: ["developer"], disposition: "replace-active", targetProfile: "verification" } },
  { match: (path) => /(?:fixture|golden|anchor)/i.test(path) && /\.(?:json|html|svg|png|jpg|jpeg|pdf|md)$/.test(path), value: { type: "golden-fixture", audiences: ["developer"], disposition: "regenerate-derived", targetProfile: "verification" } },
  { match: (path) => /^supabase\/templates\/.+\.html$/.test(path), value: { type: "template", audiences: ["family", "provider"], disposition: "update-external", targetProfile: "provider-constrained" } },
];

function textForLegacyScan(path: string): string {
  return isLegacyTextPath(path) ? readFileSync(resolve(ROOT, path), "utf8") : "";
}

const residuePaths = new Set(trackedFiles.filter((path) => {
  const text = textForLegacyScan(path);
  return isLegacyFontPath(path) || collectLegacySignatures(path, text).length > 0;
}));
const quarantinePaths = new Set(historicalBrandQuarantinePaths);
if (quarantinePaths.size !== historicalBrandQuarantineRecords.length) {
  throw new Error("Historical brand quarantine contains a duplicate exact path.");
}
const activeAuthorityPaths = new Set([
  "docs/homa-curriculum-atlas/materials-patterns.md",
  "docs/homa-planning/build-log.md",
  "docs/homa-planning/journeys/04-feature-journeys.md",
  "docs/homa-planning/journeys/10-reconciliation.md",
]);
const invalidQuarantinePaths = [...quarantinePaths].filter((path) =>
  !trackedFiles.includes(path)
  || !residuePaths.has(path)
  || activeAuthorityPaths.has(path)
  || (path.startsWith("docs/homa-planning/plans/")
    && path !== "docs/homa-planning/plans/2026-08-02-homa-brand-system-approval.html")
  || /^(?:apps|marketing|packages|supabase)\//.test(path));
if (invalidQuarantinePaths.length > 0) {
  throw new Error(`Invalid historical brand quarantine path(s):\n${invalidQuarantinePaths.sort().map((path) => `- ${path}`).join("\n")}`);
}
const productionDiscoveryFiles = trackedFiles.filter((path) =>
  (/(?:^|\/)(?:package|app)\.json$/.test(path)
    || /^(?:apps|marketing|supabase|\.github\/workflows)\//.test(path)
    || path === "turbo.json"
    || path === "vercel.json")
  && isLegacyTextPath(path));
const activeAuthoringIndexSources = new Map(
  trackedFiles
    .filter((path) => isActiveAuthoringIndexOrRegistryPath(path))
    .map((path) => [path, readFileSync(resolve(ROOT, path), "utf8")]),
);
const quarantineAuthoringIndexViolations = collectHistoricalQuarantineIndexViolations(
  activeAuthoringIndexSources,
  quarantinePaths,
);
const quarantineRuntimeReferences: string[] = [];
for (const sourcePath of productionDiscoveryFiles) {
  const source = readFileSync(resolve(ROOT, sourcePath), "utf8");
  for (const quarantinePath of quarantinePaths) {
    if (source.includes(quarantinePath)) quarantineRuntimeReferences.push(`${sourcePath} -> ${quarantinePath}`);
  }
}
const nextConfig = readFileSync(resolve(ROOT, "apps/web/next.config.ts"), "utf8");
if (nextConfig.includes("../../docs/")
  || quarantineRuntimeReferences.length > 0
  || quarantineAuthoringIndexViolations.length > 0) {
  throw new Error([
    ...(nextConfig.includes("../../docs/") ? ["apps/web/next.config.ts includes the docs tree in a production bundle"] : []),
    ...quarantineRuntimeReferences.map((reference) => `Historical quarantine is runtime-discoverable: ${reference}`),
    ...quarantineAuthoringIndexViolations,
  ].join("\n"));
}
const unclassifiedResiduePaths = [...residuePaths].filter((path) =>
  !baseRules.some((rule) => rule.match(path)) && !quarantinePaths.has(path));
if (unclassifiedResiduePaths.length > 0) {
  throw new Error(`Unclassified legacy residue surface(s):\n${unclassifiedResiduePaths.sort().map((path) => `- ${path}`).join("\n")}`);
}

const historicalLegacyClassification: Classification = {
  type: "durable-artifact",
  audiences: ["developer", "operator"],
  disposition: "historical-git-only",
  targetProfile: "historical-private-provenance",
  reachability: "internal",
  ownerIssue: "gh#729",
  deliveryState: "private-provenance",
  productionProbe: "static:production-bundle-index-and-active-discovery-excluded",
  rollbackBoundary: "git-quarantine",
};
const rules: ReadonlyArray<{ match: (path: string) => boolean; value: Classification }> = [
  ...baseRules,
  { match: (path) => quarantinePaths.has(path), value: historicalLegacyClassification },
];

const classify = (path: string) => {
  const rule = rules.find((candidate) => candidate.match(path));
  if (!rule) throw new Error(`Unclassified brand surface: ${path}`);
  return rule.value;
};
// One table prevents discovery and classification from drifting apart. The
// independent structural domain checks and Git-derived tests still prevent
// this table from silently omitting a whole route or publishing family.
const candidates = trackedFiles.filter((path) => rules.some((rule) => rule.match(path)));

function ownerIssue(path: string): `gh#${number}` {
  if (path === ".cosmo/homa-taste.md") return "gh#739";
  if (/^apps\/(?:web|mobile)\/assets\/fonts\/quiet-authority\//.test(path)) return "gh#715";
  if (/^apps\/web\/components\/design\/(?:icon-registry|Icon)\.(?:ts|tsx)$/.test(path) || /icons\.ts$/.test(path)) return "gh#718";
  if (path === "apps/mobile/eas.json") return "gh#730";
  if (/^apps\/mobile\//.test(path)) return "gh#686";
  if (/^apps\/web\/(?:app|components)\/admin\//.test(path)) return "gh#733";
  if (/^(?:apps\/web\/app\/blog|apps\/web\/content\/blog|apps\/web\/lib\/blog(?:-clusters)?\.ts$)/.test(path)) return "gh#683";
  if (/report|material|print|pdf|compliance|filing/.test(path)) return "gh#687";
  if (/^marketing\//.test(path)) return "gh#741";
  if (/(?:email|sms|telnyx|handwrytten)/.test(path)) return "gh#688";
  if (/^(?:apps\/web\/app\/(?:blog|world|page)|apps\/web\/components\/marketing)/.test(path)) return "gh#683";
  if (/signin|password|onboarding|paywall|billing|unsubscribe|join/.test(path)) return "gh#684";
  if (/manifest|opengraph|twitter-image|apple-icon|favicon|homa\.vcf|robots|sitemap|rss\.xml|apps\/web\/public/.test(path)) return "gh#689";
  if ([
    "packages/design/src/contract/brand.ts",
    "packages/design/src/contract/identity.ts",
    "scripts/brand-assets.mts",
    "scripts/identity-assets.mts",
    "scripts/identity-assets.test.mts",
  ].includes(path)) return "gh#719";
  if (/^(?:\.agents|apps\/web\/agent|packages\/core\/src\/map\/copy-laws|apps\/web\/lib\/copy-laws-runtime)/.test(path)) return "gh#739";
  if (/^apps\/web\/components\/design\//.test(path)) return "gh#724";
  if (/^scripts\/(?:brand-surfaces|brand-inventory-completeness-check|brand-residue-check)\.mts$/.test(path)) return "gh#721";
  if (/^(?:DESIGN\.md|docs\/homa-design|packages\/design|scripts\/)/.test(path)) return "gh#717";
  if (/^apps\/web\/app\/thinking-acts\.css$/.test(path)) return "gh#670";
  if (/^apps\/web\/app\/app\/tasks\//.test(path)) return "gh#671";
  if (/^apps\/web\/app\/app\/library\//.test(path)) return "gh#672";
  if (/^apps\/web\/app\/app\/binder\//.test(path)) return "gh#673";
  if (/^apps\/web\/app\/app\/(?:planner|calendar|hours|lessons)(?:\/|$)/.test(path)) return "gh#674";
  if (/^apps\/web\/(?:app\/app\/(?:progress|\[childId\]\/progress)|components\/progress|lib\/child-progress)(?:\/|\.|$)/.test(path)) return "gh#675";
  if (/^apps\/web\/app\/app\/(?:chat|voice)(?:\/|\.|$)/.test(path)) return "gh#676";
  if (/^apps\/web\/(?:components\/dashboard|app\/app\/(?:layout|page)\.tsx)/.test(path)) return "gh#669";
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
  if (/^(?:apps\/web\/public|apps\/web\/content\/blog|marketing\/assets|apps\/web\/app\/(?:blog|world))/.test(path)) return "revocable-public";
  return "controlled-current";
}

function consumersFor(path: string, type: BrandManifestType): string[] {
  switch (type) {
    case "authoring-rule":
      return ["design-authoring", "@homa/design"];
    case "agent-skill":
      return [path.startsWith(".agents/") ? "fleet-skill-loader" : "eve-skill-loader", "design-authoring"];
    case "prompt":
      return ["eve-prompt-loader", "design-authoring"];
    case "evaluator":
      return ["authoring-rails-check", "interface-gauntlet"];
    case "golden-fixture":
      return ["authoring-rails-check", "interface-gauntlet"];
    case "generator":
      return ["brand-generation", "@homa/design"];
    default:
      return ["brand-surface-manifest"];
  }
}

function recordFor(path: string): BrandSurfaceRecord {
  const classification = classify(path);
  const runtimeBoundary = generatedWebRouteHandlerRuntimePolicy(path);
  const bytes = readFileSync(resolve(ROOT, path));
  const sourceHash = sha256(bytes);
  const text = isLegacyTextPath(path) ? bytes.toString("utf8") : "";
  const legacySignatures = [...new Set([
    ...collectLegacySignatures(path, text),
    ...(isLegacyFontPath(path) ? [LEGACY_FONT_PATH_SIGNATURE] : []),
  ])].sort(stableCompare);
  const isAdmin = /^apps\/web\/(?:app|components)\/admin\//.test(path);
  const isDev = /^apps\/web\/app\/dev\//.test(path);
  const audiences: BrandAudience[] = isAdmin ? ["operator"] : isDev ? ["developer"] : classification.audiences;
  const reachability: BrandSurfaceRecord["reachability"] = classification.reachability
    ?? (isAdmin ? "authenticated" : isDev ? "internal" : path.includes("public/") || audiences.includes("public") ? "public" : "authenticated");
  const isNative = classification.targetProfile.startsWith("native");
  const isRendered = ["route", "screen", "component-family", "template", "renderer", "asset"].includes(classification.type);
  const provenance = sourceProvenance(path);
  const isHistoricalQuarantine = classification.targetProfile === "historical-private-provenance";
  return {
    id: `surface:${sha256(path).slice(0, 16)}`,
    paths: [path], type: classification.type, reachability, audiences, runtimeBoundary,
    criticality: criticality(path, audiences), ownerIssue: classification.ownerIssue ?? ownerIssue(path),
    upstreamDomainOwners: [classification.targetProfile],
    dependencies: ["@homa/design"],
    consumers: consumersFor(path, classification.type),
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
    migrationFlag: null, rollbackBoundary: classification.rollbackBoundary
      ?? (isNative ? "ota-or-store-binary" : classification.targetProfile.includes("provider") ? "provider-version-restore" : "web-deployment"),
    evidencePath: null,
    requiredEvidence: isHistoricalQuarantine
      ? ["source-fingerprint", "legacy-signature-review", "production-bundle-exclusion", "index-exclusion", "active-discovery-exclusion"]
      : isRendered ? ["baseline-pixels-pending", "baseline-interactions-pending", "performance-pending", "accessibility-pending", "residue"] : ["source-fingerprint", "legacy-signature-review"],
    productionProbe: classification.productionProbe
      ?? (classification.targetProfile === "authoring" ? "not-production-reachable" : "pending:brand-production-probe"),
    evidenceMetadata: { contractVersion: `@homa/design:${DESIGN_CONTRACT_VERSION}`, harnessVersion: "brand-surfaces-v1", ...provenance, clientRuntimeFingerprint: null, pixels: null, interactions: null, performance: null, accessibility: null, artifactGeneration: null, providerState: null, publicCacheBehavior: null },
    productionReadback: null, deletionCommit: null,
    deliveryState: classification.deliveryState ?? deliveryState(path, classification.targetProfile), rolloutState: "inventory",
  };
}

const externalSurfaces = [
  ["provider:stripe-checkout-and-portal", "provider", "gh#732", "journey-critical", "revocable-public", "update-external"],
  ["provider:supabase-auth-email", "provider", "gh#732", "journey-critical", "revocable-public", "update-external"],
  ["provider:google-identity", "provider", "gh#732", "journey-critical", "revocable-public", "update-external"],
  ["provider:apple-identity", "provider", "gh#732", "journey-critical", "revocable-public", "update-external"],
  ["provider:apple-subscription-management", "provider", "gh#732", "journey-critical", "revocable-public", "update-external"],
  ["provider:resend-email", "provider", "gh#688", "journey-critical", "revocable-public", "update-external"],
  ["provider:telnyx-sms-and-voice", "provider", "gh#688", "journey-critical", "revocable-public", "update-external"],
  ["provider:handwrytten", "provider", "gh#740", "supporting", "revocable-public", "update-external"],
  ["provider:apple-app-store", "provider", "gh#689", "journey-critical", "revocable-public", "update-external"],
  ["provider:google-play-reserved", "provider", "gh#689", "utility", "controlled-current", "approved-carry-forward"],
  ["template:future-mobile-push", "template", "gh#688", "utility", "controlled-current", "approved-carry-forward"],
  ["provider:social-instagram-thankshoma", "provider", "gh#741", "supporting", "revocable-public", "update-external"],
  ["provider:social-tiktok-thankshoma", "provider", "gh#741", "supporting", "revocable-public", "update-external"],
  ["provider:social-pinterest-thankshoma", "provider", "gh#741", "supporting", "revocable-public", "update-external"],
  ["provider:social-facebook-thankshoma", "provider", "gh#741", "supporting", "revocable-public", "update-external"],
  ["provider:social-youtube-thankshoma", "provider", "gh#741", "supporting", "revocable-public", "update-external"],
  ["provider:social-x-thankshoma", "provider", "gh#741", "supporting", "revocable-public", "update-external"],
  ["durable:vercel-blob-world-media", "durable-artifact", "gh#741", "supporting", "revocable-public", "migrate-durable"],
  ["durable:vercel-blob-family-artifacts", "durable-artifact", "gh#731", "journey-critical", "private-provenance", "migrate-durable"],
  ["durable:generated-family-reports", "durable-artifact", "gh#731", "journey-critical", "private-provenance", "migrate-durable"],
  ["durable:generated-printables", "durable-artifact", "gh#731", "journey-critical", "private-provenance", "migrate-durable"],
  ["historical:resend-delivered-message-archive", "durable-artifact", "gh#731", "supporting", "delivered-historical", "historical-git-only"],
  ["historical:telnyx-delivered-message-archive", "durable-artifact", "gh#731", "supporting", "delivered-historical", "historical-git-only"],
  ["historical:family-generated-artifact-revisions", "durable-artifact", "gh#731", "supporting", "delivered-historical", "historical-git-only"],
  ["historical:handwrytten-template-349914-mailed-copies", "durable-artifact", "gh#740", "supporting", "delivered-historical", "historical-git-only"],
  ["profile:parent-authored-filing-letter", "renderer", "gh#687", "journey-critical", "controlled-current", "approved-profile-rule"],
  ["profile:apple-sign-in-provider-mark", "asset", "gh#689", "supporting", "controlled-current", "immutable-external-content"],
  ["profile:google-sign-in-provider-mark", "asset", "gh#689", "supporting", "controlled-current", "immutable-external-content"],
  ["profile:apple-app-store-download-badge", "asset", "gh#689", "supporting", "controlled-current", "immutable-external-content"],
] as const;

const providerRecords: BrandSurfaceRecord[] = externalSurfaces.map(([key, type, issue, criticalityValue, delivery, disposition]) => ({
  id: `surface:${sha256(key).slice(0, 16)}`,
  paths: [key], type: type as BrandManifestType,
  reachability: key.includes("google-play") || key.includes("future-mobile-push") ? "internal" : "external",
  audiences: ["family", "provider"], runtimeBoundary: null, criticality: criticalityValue as BrandCriticality, ownerIssue: issue as `gh#${number}`,
  upstreamDomainOwners: ["constrained-projection"], dependencies: ["@homa/design/constrained-projection"], requiredStates: ["default", "failure", "fallback"], viewports: [], devices: [], clients: ["provider-client"], assistiveModes: [], appearanceModes: ["provider-supported"],
  consumers: ["provider-projection", "brand-surface-manifest"],
  baseline: { fixtureChecksum: null, renderPath: null, interactionRecordingPath: null }, approvedTarget: "quiet-authority-v1",
  targetProfiles: ["constrained-projection"],
  requirements: { atoms: ["semantic-color", "Logo"], patterns: ["one-useful-next-move"], assets: ["approved-provider-asset"], fonts: ["provider-safe-fallback"], copyRoles: ["true-clear-memorable"] },
  legacySignatures: [], currentAssetHashes: [], disposition: disposition as BrandDisposition, featureFlags: [], migrationFlag: null, rollbackBoundary: "provider-or-artifact-version-restore", evidencePath: null,
  requiredEvidence: ["provider-readback-pending", "production-probe-pending", "residue"], productionProbe: "pending:provider-probe",
  evidenceMetadata: { contractVersion: `@homa/design:${DESIGN_CONTRACT_VERSION}`, harnessVersion: "brand-surfaces-v1", observedAt: null, sourceCommitSha: null, sourceCommitTimestamp: null, environment: "inventory-only-no-external-observation", clientRuntimeFingerprint: null, pixels: null, interactions: null, performance: null, accessibility: null, artifactGeneration: null, providerState: null, publicCacheBehavior: null },
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
