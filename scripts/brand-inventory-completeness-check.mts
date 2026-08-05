import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  BrandManifestType,
  BrandSurfaceManifest,
  BrandSurfaceRecord,
} from "../packages/design/src/surfaces.ts";
import { BRAND_MANIFEST_SCHEMA_VERSION } from "../packages/design/src/surfaces.ts";

export const BRAND_INVENTORY_HARNESS_VERSION = "brand-inventory-v1" as const;

export interface BrandInventoryIssue {
  code: string;
  surfacePath?: string;
  message: string;
}

export interface BrandInventoryCoverageRule {
  id: string;
  description: string;
  minimumRows: number;
  select: (surface: BrandSurfaceRecord) => boolean;
  requiredTypes?: readonly BrandManifestType[];
  requiredOwners?: readonly `gh#${number}`[];
}

export interface BrandInventoryCoverageReport {
  harnessVersion: typeof BRAND_INVENTORY_HARNESS_VERSION;
  status: "pass" | "fail";
  surfaceCount: number;
  rowsByRule: Record<string, number>;
  issues: BrandInventoryIssue[];
}

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MANIFEST_PATH = resolve(ROOT, "docs/homa-design/evidence/surfaces.json");

const pathOf = (surface: BrandSurfaceRecord): string => surface.paths[0] ?? "";

const authoringPath = (path: string): boolean =>
  path.startsWith(".agents/skills/")
  || path.startsWith("apps/web/agent/")
  || path.startsWith("marketing/voice/")
  || path.startsWith("marketing/evals/")
  || path.startsWith("docs/homa-design/")
  || path.startsWith("packages/design/src/");

const artifactPath = (path: string): boolean =>
  path.startsWith("durable:")
  || /(?:report|material|print|pdf|compliance|filing)/i.test(path)
  || path.includes("artifact-print");

const nativePath = (path: string): boolean => path.startsWith("apps/mobile/");

const webRouteFileNames = new Set([
  "apple-icon.tsx",
  "error.tsx",
  "global-error.tsx",
  "layout.tsx",
  "loading.tsx",
  "not-found.tsx",
  "opengraph-image.tsx",
  "page.tsx",
  "twitter-image.tsx",
]);

export function classifyValidatedWebRouteBoundary(path: string): "public" | "family" | "operator" | "developer" | "intercept-unresolved" | null {
  const prefix = "apps/web/app/";
  if (!path.startsWith(prefix)) return null;
  const parts = path.slice(prefix.length).split("/");
  const file = parts.pop();
  if (!file || !webRouteFileNames.has(file)) return null;
  if (parts.some((segment) =>
    segment.startsWith("(.)")
    || segment.startsWith("(..)")
    || segment.startsWith("(...)")
  )) return "intercept-unresolved";
  const runtimeSegments = parts.filter((segment) =>
    !(segment.startsWith("(") && segment.endsWith(")"))
    && !segment.startsWith("@"));
  const first = runtimeSegments[0] ?? "";
  if (first === "app") return "family";
  if (first === "admin") return "operator";
  if (first === "dev") return "developer";
  return "public";
}

const communicationPath = (path: string): boolean =>
  /(?:email|sms|mms|telnyx|resend|push)/i.test(path)
  || path === "provider:handwrytten";

const publicContentPath = (path: string): boolean =>
  path.startsWith("apps/web/app/blog/")
  || path.startsWith("apps/web/content/blog/")
  || path === "apps/web/lib/blog.ts"
  || path === "apps/web/lib/blog-clusters.ts";

const marketingPath = (path: string): boolean =>
  path.startsWith("marketing/") || path.startsWith("apps/web/components/marketing/")
  || publicContentPath(path)
  || path.startsWith("durable:vercel-blob-world-media")
  || path.startsWith("provider:social-");

const adminPath = (path: string): boolean => path.startsWith("apps/web/app/admin/") || path.startsWith("apps/web/components/admin/");

const prohibitedSemanticCatchalls = new Set([
  "provider:social-accounts",
  "historical:delivered-email-sms-print-mail",
  "profile:required-third-party-marks",
]);

export const brandInventoryCoverageRules: readonly BrandInventoryCoverageRule[] = [
  {
    id: "authoring",
    description: "Authoring rules, skills, prompts, evaluators, fixtures, and typed design sources",
    minimumRows: 20,
    select: (surface) => authoringPath(pathOf(surface)),
    requiredTypes: ["authoring-rule", "agent-skill", "prompt", "evaluator", "golden-fixture"],
    requiredOwners: ["gh#717", "gh#739", "gh#741"],
  },
  {
    id: "artifacts",
    description: "Reports, materials, print, filing, and durable artifact projections",
    minimumRows: 10,
    select: (surface) => artifactPath(pathOf(surface)) || surface.targetProfiles.includes("artifact-print"),
    requiredTypes: ["renderer", "durable-artifact"],
    requiredOwners: ["gh#687", "gh#731"],
  },
  {
    id: "providers",
    description: "Named provider-owned and constrained profile surfaces",
    minimumRows: 6,
    select: (surface) => surface.type === "provider" || surface.reachability === "external",
    requiredTypes: ["provider"],
    requiredOwners: ["gh#688", "gh#689", "gh#732", "gh#740", "gh#741"],
  },
  {
    id: "admin",
    description: "Founder and operator admin routes and components",
    minimumRows: 10,
    select: (surface) => adminPath(pathOf(surface)),
    requiredTypes: ["route", "component-family"],
    requiredOwners: ["gh#733"],
  },
  {
    id: "marketing",
    description: "Public marketing, campaign, social, and world-media surfaces",
    minimumRows: 10,
    select: (surface) => marketingPath(pathOf(surface)),
    requiredTypes: ["component-family", "template", "provider"],
    requiredOwners: ["gh#683", "gh#741"],
  },
  {
    id: "published-content",
    description: "Public blog routes, articles, feed, taxonomy, and publishing source",
    minimumRows: 8,
    select: (surface) => publicContentPath(pathOf(surface)),
    requiredTypes: ["route", "renderer", "template", "generator"],
    requiredOwners: ["gh#683"],
  },
  {
    id: "public-web",
    description: "Public landing, acquisition, trust, recovery, onboarding, and metadata routes",
    minimumRows: 15,
    select: (surface) => classifyValidatedWebRouteBoundary(pathOf(surface)) === "public",
    requiredTypes: ["route"],
    requiredOwners: ["gh#683", "gh#684", "gh#689"],
  },
  {
    id: "native",
    description: "Native routes, components, assets, and distribution projections",
    minimumRows: 10,
    select: (surface) => nativePath(pathOf(surface)),
    requiredTypes: ["screen", "component-family", "asset"],
    requiredOwners: ["gh#686"],
  },
  {
    id: "external-channels",
    description: "Email, SMS/MMS, store, social, handoff, and delivered channel records",
    minimumRows: 8,
    select: (surface) => communicationPath(pathOf(surface)) || surface.reachability === "external",
    requiredTypes: ["template", "provider", "durable-artifact"],
    requiredOwners: ["gh#688", "gh#689", "gh#731", "gh#732", "gh#740", "gh#741"],
  },
] as const;

const journeyCriticalPath = [
  /(?:^|\/)(?:signin|password|onboarding|billing|paywall|unsubscribe)(?:\/|[-_.]|$)/i,
  /^apps\/web\/app\/api\/email\//i,
  /^provider:(?:stripe-checkout-and-portal|supabase-auth-email|resend-email|telnyx-sms-and-voice|apple-app-store)$/i,
  /^durable:(?:generated-family-reports|generated-printables|vercel-blob-family-artifacts)$/i,
];

function addIssue(issues: BrandInventoryIssue[], code: string, message: string, surfacePath?: string): void {
  issues.push(surfacePath ? { code, surfacePath, message } : { code, message });
}

function validateRowShape(manifest: BrandSurfaceManifest, issues: BrandInventoryIssue[]): void {
  const seenPaths = new Set<string>();
  const seenIds = new Set<string>();
  for (const surface of manifest.surfaces) {
    const path = pathOf(surface);
    if (!path || surface.paths.some((entry) => entry.includes("*") || entry.includes("..."))) {
      addIssue(issues, "catch-all-row", "Every inventory row must name an exact path, URL, provider, profile, or durable key.", path || undefined);
    }
    if (prohibitedSemanticCatchalls.has(path)) {
      addIssue(issues, "semantic-catch-all-row", "Aggregate account, delivery, and third-party-mark labels must be split into exact provider, archive, or profile rows.", path);
    }
    if (seenPaths.has(path)) addIssue(issues, "duplicate-path", "A surface path or provider key appears more than once.", path);
    seenPaths.add(path);
    if (seenIds.has(surface.id)) addIssue(issues, "duplicate-id", "A stable surface ID appears more than once.", path);
    seenIds.add(surface.id);
    if (!/^gh#\d+$/.test(surface.ownerIssue)) addIssue(issues, "missing-owner", "Every surface must name its GitHub owner issue.", path);
    if (surface.dependencies.length === 0) addIssue(issues, "missing-dependency", "Every surface must name at least one design dependency.", path);
    if (surface.targetProfiles.length === 0) addIssue(issues, "missing-target", "Every surface must name a target profile.", path);
    if (!surface.requiredStates.includes("default")) addIssue(issues, "missing-default-state", "Every surface must include a default state.", path);
    if (surface.approvedTarget !== "quiet-authority-v1") addIssue(issues, "wrong-target", "Every inventory row must target Quiet authority.", path);
    if (!surface.evidenceMetadata.contractVersion || !surface.evidenceMetadata.harnessVersion || !surface.evidenceMetadata.environment) {
      addIssue(issues, "incomplete-evidence-metadata", "Inventory evidence needs contract, harness, and an honest source environment.", path);
    }
    const observation = surface.evidenceMetadata;
    const isCommittedSource = observation.environment === "git-source-commit";
    const isSourceWithoutCommit = observation.environment === "working-tree-uncommitted"
      || observation.environment === "inventory-only-no-external-observation";
    if (!isCommittedSource && !isSourceWithoutCommit) {
      addIssue(issues, "unknown-source-environment", "Inventory source provenance must use a closed repository or synthetic environment.", path);
    }
    if (observation.observedAt !== null) {
      addIssue(issues, "unreceipted-observation", "Source history cannot populate observedAt; real rendered, installed, provider, or production observations require separate evidence.", path);
    }
    if (isCommittedSource && (
      !/^[0-9a-f]{40}$/.test(observation.sourceCommitSha ?? "")
      || observation.sourceCommitTimestamp === null
      || Number.isNaN(Date.parse(observation.sourceCommitTimestamp))
    )) {
      addIssue(issues, "invalid-source-provenance", "A committed source row requires an exact Git SHA and its ISO committer timestamp.", path);
    }
    if (isSourceWithoutCommit && (
      observation.sourceCommitSha !== null
      || observation.sourceCommitTimestamp !== null
    )) {
      addIssue(issues, "unexpected-source-provenance", "Changed, untracked, and synthetic rows cannot inherit commit provenance.", path);
    }
    if (surface.reachability === "external" && ["provider", "durable-artifact"].includes(surface.type) && !["revocable-public", "delivered-historical", "private-provenance"].includes(surface.deliveryState)) {
      addIssue(issues, "external-delivery-state", "External surfaces need a revocable, historical, or private delivery state.", path);
    }
    if (journeyCriticalPath.some((pattern) => pattern.test(path)) && surface.criticality !== "journey-critical") {
      addIssue(issues, "criticality-underassigned", "A trust-critical identity, access, billing, delivery, legal, evidence, or recovery surface cannot be supporting or utility.", path);
    }
    const routeBoundary = classifyValidatedWebRouteBoundary(path);
    if (routeBoundary === "intercept-unresolved") {
      addIssue(issues, "route-intercept-unresolved", "Intercepting routes require an explicit reviewed runtime boundary and may never default to public.", path);
    } else if (routeBoundary) {
      const expected = routeBoundary === "public"
        ? { reachability: "public", deliveryState: "revocable-public" }
        : routeBoundary === "developer"
          ? { reachability: "internal", deliveryState: "controlled-current" }
          : routeBoundary === "operator"
            ? { reachability: "authenticated", deliveryState: "controlled-current" }
            : { reachability: "authenticated", deliveryState: "controlled-current" };
      if (surface.type !== "route"
        || surface.reachability !== expected.reachability
        || !surface.audiences.includes(routeBoundary)
        || surface.deliveryState !== expected.deliveryState) {
        addIssue(
          issues,
          "route-boundary",
          `Route must remain ${routeBoundary}: route/${expected.reachability}/${routeBoundary}/${expected.deliveryState}.`,
          path,
        );
      }
    }
  }
  if (manifest.surfaces.length === 0) addIssue(issues, "empty-manifest", "The inventory must contain at least one surface row.");
}

function validateManifestPolicy(manifest: BrandSurfaceManifest, issues: BrandInventoryIssue[]): void {
  if (manifest.schemaVersion !== BRAND_MANIFEST_SCHEMA_VERSION) addIssue(issues, "schema-version", `Inventory schema must be version ${BRAND_MANIFEST_SCHEMA_VERSION}.`);
  if (manifest.designEra !== "quiet-authority-v1") addIssue(issues, "design-era", "Inventory must be pinned to the approved Quiet authority design era.");
  if (!/^[0-9a-f]{40}$/.test(manifest.baselineSourceCommit)) addIssue(issues, "baseline-source", "Inventory baseline source commit must be a full Git SHA.");
  if (!/^[0-9a-f]{64}$/.test(manifest.ownedInputFingerprint)) addIssue(issues, "owned-input-fingerprint", "Inventory must carry a SHA-256 owned-input fingerprint.");
  if (manifest.androidDisposition.status !== "intentionally-unreleased") addIssue(issues, "android-disposition", "Android disposition must remain explicit until its release ruling changes.");
  for (const key of ["journey-critical", "supporting", "utility"] as const) {
    if (!manifest.criticalityPolicy[key]?.trim()) addIssue(issues, "criticality-policy", `Missing published criticality policy for ${key}.`);
  }
}

function validateCoverageRules(manifest: BrandSurfaceManifest, issues: BrandInventoryIssue[]): Record<string, number> {
  const rowsByRule: Record<string, number> = {};
  for (const rule of brandInventoryCoverageRules) {
    const rows = manifest.surfaces.filter(rule.select);
    rowsByRule[rule.id] = rows.length;
    if (rows.length < rule.minimumRows) addIssue(issues, "coverage-minimum", `${rule.id} requires at least ${rule.minimumRows} rows, found ${rows.length}.`);
    for (const type of rule.requiredTypes ?? []) {
      if (!rows.some((surface) => surface.type === type)) addIssue(issues, "coverage-type", `${rule.id} is missing a ${type} row.`);
    }
    for (const owner of rule.requiredOwners ?? []) {
      if (!rows.some((surface) => surface.ownerIssue === owner)) addIssue(issues, "coverage-owner", `${rule.id} is missing a row owned by ${owner}.`);
    }
  }
  return rowsByRule;
}

export function buildBrandInventoryCoverageReport(manifest: BrandSurfaceManifest): BrandInventoryCoverageReport {
  const issues: BrandInventoryIssue[] = [];
  validateManifestPolicy(manifest, issues);
  validateRowShape(manifest, issues);
  const rowsByRule = validateCoverageRules(manifest, issues);
  return {
    harnessVersion: BRAND_INVENTORY_HARNESS_VERSION,
    status: issues.length === 0 ? "pass" : "fail",
    surfaceCount: manifest.surfaces.length,
    rowsByRule,
    issues,
  };
}

export function assertBrandInventoryCoverage(manifest: BrandSurfaceManifest): BrandInventoryCoverageReport {
  const report = buildBrandInventoryCoverageReport(manifest);
  if (report.issues.length > 0) {
    for (const issue of report.issues) console.error(`[${issue.code}]${issue.surfacePath ? ` ${issue.surfacePath}` : ""} ${issue.message}`);
    throw new Error(`Brand inventory completeness gate failed with ${report.issues.length} finding(s).`);
  }
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as BrandSurfaceManifest;
  const report = assertBrandInventoryCoverage(manifest);
  console.log(`Brand inventory completeness current: ${report.surfaceCount} surfaces, ${BRAND_INVENTORY_HARNESS_VERSION}.`);
}
