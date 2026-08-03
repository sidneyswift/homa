export const BRAND_MANIFEST_SCHEMA_VERSION = 1 as const;

export const brandManifestTypes = [
  "route",
  "screen",
  "component-family",
  "template",
  "renderer",
  "generator",
  "asset",
  "provider",
  "durable-artifact",
  "authoring-rule",
  "agent-skill",
  "prompt",
  "evaluator",
  "golden-fixture",
] as const;
export type BrandManifestType = (typeof brandManifestTypes)[number];

export const brandCriticalities = ["journey-critical", "supporting", "utility"] as const;
export type BrandCriticality = (typeof brandCriticalities)[number];

export const brandDispositions = [
  "approved-carry-forward",
  "replace-active",
  "retire-reachable",
  "regenerate-derived",
  "migrate-durable",
  "update-external",
  "historical-git-only",
  "approved-profile-rule",
  "immutable-external-content",
  "temporary-migration-exemption",
] as const;
export type BrandDisposition = (typeof brandDispositions)[number];

export const brandDeliveryStates = [
  "controlled-current",
  "revocable-public",
  "installed-client",
  "delivered-historical",
  "private-provenance",
] as const;
export type BrandDeliveryState = (typeof brandDeliveryStates)[number];

export const brandRolloutStates = [
  "inventory",
  "candidate",
  "preview-accepted",
  "production-accepted",
  "eradicated",
] as const;
export type BrandRolloutState = (typeof brandRolloutStates)[number];

export type BrandAudience =
  | "family"
  | "child"
  | "founder"
  | "operator"
  | "developer"
  | "public"
  | "provider";

export interface BrandSurfaceRecord {
  id: string;
  paths: string[];
  type: BrandManifestType;
  reachability: "public" | "authenticated" | "internal" | "generated" | "external";
  audiences: BrandAudience[];
  criticality: BrandCriticality;
  ownerIssue: `gh#${number}`;
  upstreamDomainOwners: string[];
  dependencies: string[];
  /** Named loaders, generators, evaluators, or projections that consume this row. */
  consumers: string[];
  requiredStates: string[];
  viewports: string[];
  devices: string[];
  clients: string[];
  assistiveModes: string[];
  appearanceModes: string[];
  baseline: {
    fixtureChecksum: string | null;
    renderPath: string | null;
    interactionRecordingPath: string | null;
  };
  targetProfiles: string[];
  approvedTarget: "quiet-authority-v1";
  requirements: {
    atoms: string[];
    patterns: string[];
    assets: string[];
    fonts: string[];
    copyRoles: string[];
  };
  legacySignatures: string[];
  currentAssetHashes: string[];
  disposition: BrandDisposition;
  featureFlags: string[];
  migrationFlag: string | null;
  rollbackBoundary: string;
  evidencePath: string | null;
  requiredEvidence: string[];
  productionProbe: string;
  evidenceMetadata: {
    contractVersion: string;
    harnessVersion: string;
    observedAt: string;
    environment: string;
    clientRuntimeFingerprint: string | null;
    pixels: string | null;
    interactions: string | null;
    performance: string | null;
    accessibility: string | null;
    artifactGeneration: string | null;
    providerState: string | null;
    publicCacheBehavior: string | null;
  };
  productionReadback: string | null;
  deletionCommit: string | null;
  deliveryState: BrandDeliveryState;
  rolloutState: BrandRolloutState;
}

export interface BrandSurfaceManifest {
  schemaVersion: typeof BRAND_MANIFEST_SCHEMA_VERSION;
  designEra: "quiet-authority-v1";
  baselineSourceCommit: string;
  baselineSourceCommitTimestamp: string;
  ownedInputFingerprint: string;
  androidDisposition: {
    status: "intentionally-unreleased";
    rulingSource: string;
    requiredGuards: string[];
  };
  criticalityPolicy: Record<BrandCriticality, string>;
  deliveryStatePolicy: Record<BrandDeliveryState, string>;
  surfaces: BrandSurfaceRecord[];
}
