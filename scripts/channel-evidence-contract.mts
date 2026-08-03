import { createHash } from "node:crypto";
import type { BrandSurfaceManifest, BrandSurfaceRecord } from "../packages/design/src/surfaces.ts";
import { DESIGN_CONTRACT_VERSION } from "../packages/design/src/contract/version.ts";

export const CHANNEL_EVIDENCE_SCHEMA_VERSION = 1 as const;
export const CHANNEL_EVIDENCE_HARNESS_VERSION = "channel-evidence-v1" as const;
export const CHANNEL_EVIDENCE_DESIGN_ERA = "quiet-authority-v1" as const;
export const CHANNEL_EVIDENCE_CONTRACT_VERSION = `@homa/design:${DESIGN_CONTRACT_VERSION}` as const;

export const channelEvidenceProfiles = [
  "email",
  "parent-pdf",
  "physical-print",
  "provider",
  "distribution-asset",
] as const;
export type ChannelEvidenceProfile = (typeof channelEvidenceProfiles)[number];

export const channelEvidenceStatuses = ["pending", "pass", "blocked", "inconclusive"] as const;
export type ChannelEvidenceStatus = (typeof channelEvidenceStatuses)[number];

export const channelEvidenceChecks = {
  email: [
    "delivery-readback",
    "client-apple-mail",
    "client-gmail",
    "client-outlook",
    "state-light",
    "state-dark",
    "state-image-blocked",
    "state-forwarded",
    "state-replied",
    "state-plain-text",
    "state-unsubscribe",
    "state-zoom",
    "state-screen-reader",
  ],
  "parent-pdf": [
    "language-metadata",
    "tagged-structure",
    "headings-reading-order",
    "links-selectable-text",
    "embedded-fonts",
    "browser-parity",
    "letter",
    "a4",
    "grayscale",
    "page-breaks",
    "screen-reader",
  ],
  "physical-print": [
    "printer-model",
    "settings-paper",
    "page-count",
    "crop-margins",
    "grayscale",
    "color-readability",
    "scan-or-photo",
  ],
  provider: [
    "capability-inventory",
    "account-owner",
    "update-readback",
    "cache-behavior",
    "expiry-fallback",
    "rollback-restore",
    "restore-time",
    "no-simulated-capability",
  ],
  "distribution-asset": [
    "contact-sheet",
    "icon-sizes",
    "splash-sizes",
    "store-sizes",
    "search-social-metadata",
    "notification-metadata",
    "vcard-link-preview",
    "carrier-media-protocol",
    "public-url-readback",
  ],
} as const satisfies Record<ChannelEvidenceProfile, readonly string[]>;

export type ChannelEvidenceCheck = (typeof channelEvidenceChecks)[ChannelEvidenceProfile][number];

export interface ChannelEvidenceCheckResult {
  passed: boolean;
  evidencePath: string | null;
  note: string | null;
}

export interface ChannelEvidenceRecord {
  id: `channel:${ChannelEvidenceProfile}`;
  profile: ChannelEvidenceProfile;
  ownerIssue: "gh#728";
  surfaceCoverage: {
    selector: ChannelEvidenceProfile;
    surfaceCount: number;
    surfaceIdsFingerprint: string;
  };
  fixturePath: string;
  fixtureChecksum: string;
  designEra: typeof CHANNEL_EVIDENCE_DESIGN_ERA;
  contractVersion: typeof CHANNEL_EVIDENCE_CONTRACT_VERSION;
  harnessVersion: typeof CHANNEL_EVIDENCE_HARNESS_VERSION;
  manifestBaselineSourceCommit: string;
  ownedInputFingerprint: string;
  observedAt: string | null;
  environment: string | null;
  browserOrOperatingSystem: string | null;
  deviceModel: string | null;
  installedBuildFingerprint: string | null;
  clientOrProviderVersion: string | null;
  printerOutputSettings: string | null;
  state: string;
  baselineRender: string | null;
  candidateRender: string | null;
  interactionRecording: string | null;
  automatedOutput: string | null;
  timings: string | null;
  hardGates: Record<string, ChannelEvidenceCheckResult>;
  builderIdentity: string | null;
  criticIdentity: string | null;
  largestGap: string | null;
  remediation: string | null;
  retainedRisk: string | null;
  productionReadback: string | null;
  deletionProof: string | null;
  providerCapabilitySimulated: false;
  status: ChannelEvidenceStatus;
}

export interface ChannelEvidenceFile {
  schemaVersion: typeof CHANNEL_EVIDENCE_SCHEMA_VERSION;
  designEra: typeof CHANNEL_EVIDENCE_DESIGN_ERA;
  contractVersion: typeof CHANNEL_EVIDENCE_CONTRACT_VERSION;
  harnessVersion: typeof CHANNEL_EVIDENCE_HARNESS_VERSION;
  manifestBaselineSourceCommit: string;
  ownedInputFingerprint: string;
  records: ChannelEvidenceRecord[];
}

export interface ChannelEvidenceValidationIssue {
  code: string;
  recordId?: string;
  message: string;
}

const profileTargetProfiles: Record<ChannelEvidenceProfile, readonly string[]> = {
  email: ["email-constrained"],
  "parent-pdf": ["artifact-print"],
  "physical-print": ["artifact-print"],
  provider: ["constrained-projection", "provider-constrained"],
  "distribution-asset": ["native-distribution", "asset-derived", "metadata-constrained"],
};

function isProfileSurface(profile: ChannelEvidenceProfile, surface: BrandSurfaceRecord): boolean {
  if (profile === "parent-pdf") return surface.targetProfiles.includes("artifact-print") || surface.paths[0] === "durable:generated-family-reports";
  if (profile === "physical-print") return surface.targetProfiles.includes("artifact-print") || surface.paths[0] === "durable:generated-printables";
  if (profile === "provider") return surface.type === "provider" || surface.targetProfiles.includes("provider-constrained");
  if (profile === "distribution-asset") {
    return profileTargetProfiles[profile].some((target) => surface.targetProfiles.includes(target))
      || /(?:opengraph|twitter-image|apple-icon|homa\.vcf|manifest|robots|sitemap|public\/)/i.test(surface.paths[0] ?? "");
  }
  return profileTargetProfiles[profile].some((target) => surface.targetProfiles.includes(target));
}

export function expectedSurfaceCoverage(profile: ChannelEvidenceProfile, manifest: BrandSurfaceManifest): { surfaceCount: number; surfaceIdsFingerprint: string } {
  const ids = manifest.surfaces.filter((surface) => isProfileSurface(profile, surface)).map((surface) => surface.id).sort();
  return {
    surfaceCount: ids.length,
    surfaceIdsFingerprint: createHash("sha256").update(ids.join("\n")).digest("hex"),
  };
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return isNonEmpty(value) && !Number.isNaN(Date.parse(value));
}

function add(issues: ChannelEvidenceValidationIssue[], code: string, message: string, recordId?: string): void {
  issues.push(recordId ? { code, recordId, message } : { code, message });
}

export function validateChannelEvidence(input: {
  manifest: BrandSurfaceManifest;
  evidence: unknown;
  fixtureChecksums: ReadonlyMap<string, string>;
}): ChannelEvidenceValidationIssue[] {
  const { manifest, evidence, fixtureChecksums } = input;
  const issues: ChannelEvidenceValidationIssue[] = [];
  if (!evidence || typeof evidence !== "object") {
    return [{ code: "evidence-not-object", message: "Channel evidence must be an object." }];
  }
  const file = evidence as Partial<ChannelEvidenceFile>;
  if (file.schemaVersion !== CHANNEL_EVIDENCE_SCHEMA_VERSION) add(issues, "schema-version", "Channel evidence schema version is not supported.");
  if (file.designEra !== CHANNEL_EVIDENCE_DESIGN_ERA) add(issues, "design-era", "Channel evidence is not pinned to Quiet authority.");
  if (file.contractVersion !== CHANNEL_EVIDENCE_CONTRACT_VERSION) add(issues, "contract-version", "Channel evidence has a stale design-contract version.");
  if (file.harnessVersion !== CHANNEL_EVIDENCE_HARNESS_VERSION) add(issues, "harness-version", "Channel evidence has a stale harness version.");
  if (file.manifestBaselineSourceCommit !== manifest.baselineSourceCommit) add(issues, "manifest-source-stale", "Channel evidence source commit does not match the current surface manifest.");
  if (file.ownedInputFingerprint !== manifest.ownedInputFingerprint) add(issues, "manifest-fingerprint-stale", "Channel evidence owned-input fingerprint does not match the current surface manifest.");
  if (!Array.isArray(file.records)) return [...issues, { code: "records-not-array", message: "Channel evidence records must be an array." }];

  const byProfile = new Map<string, ChannelEvidenceRecord>();
  for (const raw of file.records) {
    if (!raw || typeof raw !== "object") {
      add(issues, "record-not-object", "Every channel evidence record must be an object.");
      continue;
    }
    const record = raw as ChannelEvidenceRecord;
    if (byProfile.has(record.profile)) add(issues, "duplicate-profile", `Duplicate channel evidence profile: ${record.profile}.`, record.id);
    byProfile.set(record.profile, record);
    if (!channelEvidenceProfiles.includes(record.profile)) {
      add(issues, "unknown-profile", `Unknown channel evidence profile: ${String(record.profile)}.`, record.id);
      continue;
    }
    if (!channelEvidenceStatuses.includes(record.status)) add(issues, "unknown-status", `Unknown channel evidence status: ${String(record.status)}.`, record.id);
    const expected = expectedSurfaceCoverage(record.profile, manifest);
    if (record.id !== `channel:${record.profile}`) add(issues, "record-id", "Record id must be derived from its profile.", record.id);
    if (record.ownerIssue !== "gh#728") add(issues, "owner-issue", "Channel evidence must remain owned by #728.", record.id);
    if (record.surfaceCoverage?.selector !== record.profile) add(issues, "coverage-selector", "Surface coverage selector must match the profile.", record.id);
    if (record.surfaceCoverage?.surfaceCount !== expected.surfaceCount) add(issues, "coverage-count-stale", `Expected ${expected.surfaceCount} surfaces for ${record.profile}.`, record.id);
    if (record.surfaceCoverage?.surfaceIdsFingerprint !== expected.surfaceIdsFingerprint) add(issues, "coverage-fingerprint-stale", "Surface coverage fingerprint is stale.", record.id);
    if (!isNonEmpty(record.fixturePath) || !record.fixturePath.startsWith("docs/homa-design/evidence/channel-inputs/")) add(issues, "fixture-path", "Fixture must be a committed synthetic channel input.", record.id);
    const actualFixtureChecksum = fixtureChecksums.get(record.fixturePath);
    if (!/^[0-9a-f]{64}$/.test(record.fixtureChecksum) || actualFixtureChecksum !== record.fixtureChecksum) add(issues, "fixture-stale", "Fixture checksum does not match the committed fixture bytes.", record.id);
    if (record.designEra !== CHANNEL_EVIDENCE_DESIGN_ERA || record.contractVersion !== CHANNEL_EVIDENCE_CONTRACT_VERSION || record.harnessVersion !== CHANNEL_EVIDENCE_HARNESS_VERSION) add(issues, "record-contract-stale", "Record contract metadata is stale.", record.id);
    if (record.manifestBaselineSourceCommit !== manifest.baselineSourceCommit || record.ownedInputFingerprint !== manifest.ownedInputFingerprint) add(issues, "record-fingerprint-stale", "Record fingerprints do not match the current surface manifest.", record.id);
    if (record.providerCapabilitySimulated !== false) add(issues, "simulated-provider", "Simulated provider capability cannot be accepted as evidence.", record.id);
    const requiredChecks = channelEvidenceChecks[record.profile];
    const checks = record.hardGates;
    if (!checks || typeof checks !== "object") {
      add(issues, "hard-gates-missing", "Every profile must declare its hard gates.", record.id);
    } else {
      const keys = Object.keys(checks).sort();
      const expectedKeys = [...requiredChecks].sort();
      if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) add(issues, "hard-gates-shape", "Hard-gate keys do not match the profile contract.", record.id);
      for (const key of requiredChecks) {
        const check = checks[key];
        if (!check || typeof check !== "object" || typeof check.passed !== "boolean") {
          add(issues, "hard-gate-invalid", `Hard gate ${key} must declare a boolean result.`, record.id);
          continue;
        }
        if (check.passed && !isNonEmpty(check.evidencePath)) add(issues, "hard-gate-proof-missing", `Passing hard gate ${key} needs an evidence path.`, record.id);
        if (!check.passed && isNonEmpty(check.evidencePath)) add(issues, "hard-gate-claim-mismatch", `A failed hard gate ${key} cannot point at a passing evidence path.`, record.id);
      }
      const passed = requiredChecks.every((key) => checks[key]?.passed === true);
      if (record.status === "pass" && !passed) add(issues, "pass-with-failed-gate", "A passing record must pass every profile hard gate.", record.id);
      if (record.status === "pending" && passed) add(issues, "pending-with-passed-gates", "A pending record cannot claim every hard gate passed.", record.id);
      if (record.status !== "pending" && !isIsoDate(record.observedAt)) add(issues, "observed-at-missing", "Non-pending evidence needs an observed timestamp.", record.id);
      if (record.status === "pass") {
        for (const [field, value] of Object.entries(record)) {
          if (["hardGates", "surfaceCoverage", "status", "providerCapabilitySimulated"].includes(field)) continue;
          if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) add(issues, "pass-field-missing", `Passing evidence is missing ${field}.`, record.id);
        }
      }
    }
  }
  for (const profile of channelEvidenceProfiles) if (!byProfile.has(profile)) add(issues, "profile-missing", `Missing channel evidence profile: ${profile}.`);
  if (byProfile.size !== channelEvidenceProfiles.length) add(issues, "profile-count", `Expected exactly ${channelEvidenceProfiles.length} channel evidence profiles.`);
  return issues;
}
