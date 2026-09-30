import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  BrandManifestType,
  BrandRouteHandlerRuntimeBoundary,
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
  // #1158: /app2 is server-gated to local development.
  if (first === "dev" || first === "app2") return "developer";
  return "public";
}

export type ValidatedWebRouteHandlerBoundary =
  | "public"
  | "family"
  | "family-device"
  | "operator"
  | "provider"
  | "developer"
  | "developer-family"
  | "internal-service"
  | "mixed-family-provider"
  | "unresolved";

// Deliberately independent from the generator registry. A change must satisfy
// both the producer and the completeness validator before evidence can move.
export const validatedWebRouteHandlerBoundaries = {
  "apps/web/app/admin/studio/anchor/[id]/route.ts": "operator",
  "apps/web/app/admin/studio/reference/[file]/route.ts": "operator",
  "apps/web/app/api/account-deletion/export/route.ts": "family",
  "apps/web/app/api/account-deletion/route.ts": "family",
  "apps/web/app/api/billing/apple/confirm/route.ts": "family",
  "apps/web/app/api/billing/apple/purchase-interlock/route.ts": "family",
  "apps/web/app/api/billing/apple/webhook/route.ts": "provider",
  "apps/web/app/api/billing/beacon/route.ts": "family",
  "apps/web/app/api/billing/checkout/route.ts": "family",
  "apps/web/app/api/billing/confirm/route.ts": "family",
  "apps/web/app/api/billing/gate/route.ts": "family",
  "apps/web/app/api/billing/portal/route.ts": "family",
  "apps/web/app/api/billing/webhook/route.ts": "provider",
  "apps/web/app/api/chat/attachments/route.ts": "family",
  "apps/web/app/api/chat/dictation/route.ts": "family",
  "apps/web/app/api/chat/history/route.ts": "family",
  "apps/web/app/api/chat/session-binding/route.ts": "family",
  "apps/web/app/api/chat/suggestions/route.ts": "family",
  "apps/web/app/api/chat/upload/route.ts": "family",
  "apps/web/app/api/compliance/filing/route.ts": "family",
  "apps/web/app/api/compliance/pack/route.ts": "family",
  "apps/web/app/api/compliance/summary/route.ts": "family",
  "apps/web/app/api/dev/oidc-status/route.ts": "developer",
  "apps/web/app/api/dev/reset-onboarding/route.ts": "developer-family",
  "apps/web/app/api/dev/test-session/route.ts": "developer",
  "apps/web/app/api/email/unsubscribe/route.ts": "public",
  "apps/web/app/api/email/webhook/route.ts": "provider",
  "apps/web/app/api/family-files/route.ts": "family",
  "apps/web/app/api/hours/export/route.ts": "family",
  "apps/web/app/api/learning-programs/route.ts": "family",
  "apps/web/app/api/learning/review/route.ts": "family",
  "apps/web/app/api/lessons/[lessonId]/audio/route.ts": "family",
  "apps/web/app/api/lessons/[lessonId]/finish/route.ts": "family",
  "apps/web/app/api/lessons/[lessonId]/media/route.ts": "family",
  "apps/web/app/api/lessons/[lessonId]/retry/route.ts": "family",
  "apps/web/app/api/lessons/[lessonId]/route.ts": "family",
  "apps/web/app/api/lessons/[lessonId]/segments/route.ts": "family",
  "apps/web/app/api/lessons/[lessonId]/status/route.ts": "family",
  "apps/web/app/api/lessons/consent/route.ts": "family",
  "apps/web/app/api/lessons/route.ts": "family",
  "apps/web/app/api/lessons/upload/route.ts": "family",
  "apps/web/app/api/library/assets/[id]/download/route.ts": "family",
  "apps/web/app/api/library/assets/[id]/process/route.ts": "family",
  "apps/web/app/api/library/assets/route.ts": "family",
  "apps/web/app/api/library/events/route.ts": "family",
  "apps/web/app/api/library/upload/route.ts": "mixed-family-provider",
  "apps/web/app/api/library/uploads/route.ts": "family",
  "apps/web/app/api/link-phone/route.ts": "public",
  "apps/web/app/api/map/answer/route.ts": "family",
  "apps/web/app/api/map/children/route.ts": "family",
  "apps/web/app/api/map/claim/route.ts": "family",
  "apps/web/app/api/map/cron/route.ts": "internal-service",
  "apps/web/app/api/map/deep-dive-start/route.ts": "family",
  "apps/web/app/api/map/extras/route.ts": "family",
  "apps/web/app/api/map/family/route.ts": "family",
  "apps/web/app/api/map/narrative-status/route.ts": "family",
  "apps/web/app/api/map/plan/board/route.ts": "family",
  "apps/web/app/api/map/plan/check/route.ts": "family",
  "apps/web/app/api/map/plan/consent/route.ts": "family",
  "apps/web/app/api/map/plan/progress/route.ts": "family",
  "apps/web/app/api/map/report-rendered/route.ts": "family",
  "apps/web/app/api/map/report-viewed/route.ts": "family",
  "apps/web/app/api/map/report/correct/route.ts": "family",
  "apps/web/app/api/map/resume-link/route.ts": "public",
  "apps/web/app/api/map/resume/route.ts": "public",
  "apps/web/app/api/map/score/route.ts": "family",
  "apps/web/app/api/map/start/route.ts": "public",
  "apps/web/app/api/map/state/route.ts": "family",
  "apps/web/app/api/map/step/route.ts": "family",
  "apps/web/app/api/map/subject-lesson/build/route.ts": "family",
  "apps/web/app/api/map/subject-lesson/keep/route.ts": "family",
  "apps/web/app/api/map/subject-lesson/retry/route.ts": "family",
  "apps/web/app/api/map/subject-lesson/status/route.ts": "family",
  "apps/web/app/api/map/walk-fork/route.ts": "family",
  "apps/web/app/api/map/walk/route.ts": "family",
  "apps/web/app/api/materials/[id]/pdf/route.ts": "family",
  "apps/web/app/api/materials/[id]/print/route.ts": "family",
  "apps/web/app/api/materials/[id]/print/pdf/route.ts": "family",
  "apps/web/app/api/materials/[id]/share/route.ts": "family",
  "apps/web/app/api/mobile/bootstrap-event/route.ts": "public",
  "apps/web/app/api/mobile/event/route.ts": "family",
  "apps/web/app/api/mobile/onboarding/making/route.ts": "family",
  "apps/web/app/api/mobile/onboarding/react/route.ts": "family",
  "apps/web/app/api/mobile/onboarding/route.ts": "family",
  "apps/web/app/api/onboarding/basics/route.ts": "family",
  "apps/web/app/api/onboarding/homeschool-profile/route.ts": "family",
  "apps/web/app/api/onboarding/making-status/route.ts": "family",
  "apps/web/app/api/phone-claim/confirm/route.ts": "family",
  "apps/web/app/api/phone-claim/start/route.ts": "family",
  "apps/web/app/api/progress/[childId]/next-move/route.ts": "family",
  "apps/web/app/api/progress/[childId]/route.ts": "family",
  "apps/web/app/api/progress/abilities-explorer/route.ts": "family",
  "apps/web/app/api/progress/conflict/route.ts": "family",
  "apps/web/app/api/sync/cron/route.ts": "internal-service",
  "apps/web/app/api/sync/ingest/route.ts": "family-device",
  "apps/web/app/api/sync/pull/route.ts": "family-device",
  "apps/web/app/api/tasks/[taskId]/pause/route.ts": "family",
  "apps/web/app/api/tasks/[taskId]/route.ts": "family",
  "apps/web/app/api/tasks/[taskId]/run-now/route.ts": "family",
  "apps/web/app/api/tasks/[taskId]/schedule/route.ts": "family",
  "apps/web/app/api/tasks/feedback/route.ts": "family",
  "apps/web/app/api/tasks/route.ts": "family",
  "apps/web/app/api/video/describe/route.ts": "family",
  "apps/web/app/api/video/upload/route.ts": "family",
  "apps/web/app/api/voice/call-me/route.ts": "family",
  "apps/web/app/api/voice/context/route.ts": "provider",
  "apps/web/app/api/voice/curriculum/insights/route.ts": "provider",
  "apps/web/app/api/voice/curriculum/start/route.ts": "family",
  "apps/web/app/api/voice/insights/route.ts": "provider",
  "apps/web/app/api/voice/realtime/token/route.ts": "family",
  "apps/web/app/api/voice/live/session/route.ts": "family",
  "apps/web/app/api/voice/realtime/tool/route.ts": "family",
  "apps/web/app/api/voice/realtime/turn/route.ts": "family",
  "apps/web/app/api/voice/tools/log-hours/route.ts": "provider",
  "apps/web/app/api/voice/tools/remember/route.ts": "provider",
  "apps/web/app/api/voice/tools/send-email/route.ts": "provider",
  "apps/web/app/api/voice/tools/send-signup-link/route.ts": "provider",
  "apps/web/app/api/waitlist/route.ts": "public",
  "apps/web/app/auth/callback/route.ts": "public",
  "apps/web/app/auth/confirm/route.ts": "public",
  "apps/web/app/blog/rss.xml/route.ts": "public",
  "apps/web/app/homa.vcf/route.ts": "public",
} as const satisfies Readonly<Record<string, Exclude<ValidatedWebRouteHandlerBoundary, "unresolved">>>;

export const validatedWebRouteHandlerRuntimePolicies = {
  public: { exposure: "public", credential: "none-or-possession-token", invoker: "public-or-identity-provider" },
  family: { exposure: "authenticated", credential: "family-context", invoker: "family-client" },
  "family-device": { exposure: "authenticated", credential: "family-device-bearer", invoker: "family-device" },
  operator: { exposure: "authenticated", credential: "operator-session", invoker: "operator-client" },
  provider: { exposure: "authenticated", credential: "provider-signature-or-shared-secret", invoker: "external-provider" },
  developer: { exposure: "internal", credential: "development-gate", invoker: "developer" },
  "developer-family": { exposure: "internal", credential: "development-gate-and-family-session", invoker: "authenticated-developer-family" },
  "internal-service": { exposure: "internal", credential: "scheduler-secret", invoker: "provider:vercel" },
  "mixed-family-provider": { exposure: "authenticated", credential: "family-session-or-provider-signature", invoker: "family-or-provider:vercel-blob" },
} as const satisfies Readonly<Record<Exclude<ValidatedWebRouteHandlerBoundary, "unresolved">, BrandRouteHandlerRuntimeBoundary>>;

export function classifyValidatedWebRouteHandlerBoundary(path: string): ValidatedWebRouteHandlerBoundary | null {
  if (!path.startsWith("apps/web/app/") || !path.endsWith("/route.ts")) return null;
  return validatedWebRouteHandlerBoundaries[path as keyof typeof validatedWebRouteHandlerBoundaries] ?? "unresolved";
}

export function validatedWebRouteHandlerRuntimePolicy(path: string): BrandRouteHandlerRuntimeBoundary | null {
  const boundary = classifyValidatedWebRouteHandlerBoundary(path);
  if (boundary === null || boundary === "unresolved") return null;
  return { ...validatedWebRouteHandlerRuntimePolicies[boundary] };
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
    const handlerBoundary = classifyValidatedWebRouteHandlerBoundary(path);
    if (handlerBoundary === "unresolved") {
      addIssue(issues, "route-handler-unresolved", "Route handlers require an explicit reviewed public, family, operator, provider, developer, or mixed boundary.", path);
    } else if (handlerBoundary) {
      const expected = handlerBoundary === "public"
        ? { reachability: "public", deliveryState: "revocable-public" }
        : handlerBoundary === "developer" || handlerBoundary === "developer-family" || handlerBoundary === "internal-service"
          ? { reachability: "internal", deliveryState: "controlled-current" }
          : { reachability: "authenticated", deliveryState: "controlled-current" };
      const audienceSet = new Set(surface.audiences);
      const audienceMatches = handlerBoundary === "mixed-family-provider"
        ? audienceSet.size === 2 && audienceSet.has("family") && audienceSet.has("provider")
        : handlerBoundary === "family-device"
          ? audienceSet.size === 2 && audienceSet.has("family") && audienceSet.has("developer")
          : handlerBoundary === "developer-family"
            ? audienceSet.size === 2 && audienceSet.has("developer") && audienceSet.has("family")
          : handlerBoundary === "internal-service"
            ? audienceSet.size === 2 && audienceSet.has("developer") && audienceSet.has("operator")
        : handlerBoundary === "public"
          ? audienceSet.has("public") && !audienceSet.has("family") && !audienceSet.has("operator") && !audienceSet.has("developer")
          : audienceSet.size === 1 && audienceSet.has(handlerBoundary);
      const runtimeBoundary = validatedWebRouteHandlerRuntimePolicy(path);
      if (surface.type !== "renderer"
        || surface.reachability !== expected.reachability
        || surface.deliveryState !== expected.deliveryState
        || !audienceMatches
        || JSON.stringify(surface.runtimeBoundary) !== JSON.stringify(runtimeBoundary)) {
        addIssue(
          issues,
          "route-handler-boundary",
          "Route handler must remain " + handlerBoundary + ": renderer/" + expected.reachability + "/" + expected.deliveryState + " with its reviewed audience, credential, and invoker.",
          path,
        );
      }
    } else if (surface.runtimeBoundary !== null) {
      addIssue(issues, "unexpected-runtime-boundary", "Only reviewed route handlers may declare handler runtime-boundary evidence.", path);
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
