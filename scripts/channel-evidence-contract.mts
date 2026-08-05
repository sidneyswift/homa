import { createHash } from "node:crypto";
import {
  validateEvidenceReceiptReference,
  type EvidenceReceiptCatalog,
  type EvidenceReceiptProofKind,
  type EvidenceReceiptReference,
} from "../packages/design/src/evidence-receipts.ts";
import type { BrandSurfaceManifest, BrandSurfaceRecord } from "../packages/design/src/surfaces.ts";
import { DESIGN_CONTRACT_VERSION } from "../packages/design/src/contract/version.ts";

export const CHANNEL_EVIDENCE_SCHEMA_VERSION = 2 as const;
export const CHANNEL_EVIDENCE_HARNESS_VERSION = "channel-evidence-v3" as const;
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

export const channelFixturePaths = {
  email: "docs/homa-design/evidence/channel-inputs/email.json",
  "parent-pdf": "docs/homa-design/evidence/channel-inputs/parent-pdf.json",
  "physical-print": "docs/homa-design/evidence/channel-inputs/physical-print.json",
  provider: "docs/homa-design/evidence/channel-inputs/provider.json",
  "distribution-asset": "docs/homa-design/evidence/channel-inputs/distribution-asset.json",
} as const satisfies Record<ChannelEvidenceProfile, string>;

export type ChannelEvidenceCheck = (typeof channelEvidenceChecks)[ChannelEvidenceProfile][number];

export interface ChannelEvidenceCheckResult {
  passed: boolean;
  evidencePath: EvidenceReceiptReference | null;
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
    scopedInputFingerprint: string;
  };
  fixturePath: string;
  fixtureChecksum: string;
  designEra: typeof CHANNEL_EVIDENCE_DESIGN_ERA;
  contractVersion: typeof CHANNEL_EVIDENCE_CONTRACT_VERSION;
  harnessVersion: typeof CHANNEL_EVIDENCE_HARNESS_VERSION;
  manifestBaselineSourceCommit: string;
  observedAt: string | null;
  environment: string | null;
  browserOrOperatingSystem: string | null;
  deviceModel: string | null;
  installedBuildFingerprint: string | null;
  clientOrProviderVersion: string | null;
  printerOutputSettings: string | null;
  state: string;
  baselineRender: EvidenceReceiptReference | null;
  candidateRender: EvidenceReceiptReference | null;
  interactionRecording: EvidenceReceiptReference | null;
  automatedOutput: EvidenceReceiptReference | null;
  timings: EvidenceReceiptReference | null;
  hardGates: Record<string, ChannelEvidenceCheckResult>;
  builderIdentity: string | null;
  criticIdentity: string | null;
  largestGap: string | null;
  remediation: string | null;
  retainedRisk: string | null;
  productionReadback: EvidenceReceiptReference | null;
  deletionProof: EvidenceReceiptReference | null;
  providerCapabilitySimulated: false;
  status: ChannelEvidenceStatus;
}

export interface ChannelEvidenceFile {
  schemaVersion: typeof CHANNEL_EVIDENCE_SCHEMA_VERSION;
  designEra: typeof CHANNEL_EVIDENCE_DESIGN_ERA;
  contractVersion: typeof CHANNEL_EVIDENCE_CONTRACT_VERSION;
  harnessVersion: typeof CHANNEL_EVIDENCE_HARNESS_VERSION;
  manifestSchemaVersion: BrandSurfaceManifest["schemaVersion"];
  manifestBaselineSourceCommit: string;
  records: ChannelEvidenceRecord[];
}

export interface ChannelEvidenceValidationIssue {
  code: string;
  recordId?: string;
  message: string;
}

export function reconcileChannelEvidenceBindings(
  manifest: BrandSurfaceManifest,
  value: unknown,
  fixtureChecksums: ReadonlyMap<string, string>,
): ChannelEvidenceFile {
  if (!value || typeof value !== "object" || !Array.isArray((value as Partial<ChannelEvidenceFile>).records)) {
    throw new Error("Channel evidence must contain records before bindings can be refreshed.");
  }
  const reconciled = structuredClone(value) as ChannelEvidenceFile & { ownedInputFingerprint?: string };
  reconciled.schemaVersion = CHANNEL_EVIDENCE_SCHEMA_VERSION;
  reconciled.designEra = CHANNEL_EVIDENCE_DESIGN_ERA;
  reconciled.contractVersion = CHANNEL_EVIDENCE_CONTRACT_VERSION;
  reconciled.harnessVersion = CHANNEL_EVIDENCE_HARNESS_VERSION;
  reconciled.manifestSchemaVersion = manifest.schemaVersion;
  reconciled.manifestBaselineSourceCommit = manifest.baselineSourceCommit;
  delete reconciled.ownedInputFingerprint;
  for (const record of reconciled.records) {
    const fixturePath = channelFixturePaths[record.profile];
    const fixtureChecksum = fixtureChecksums.get(fixturePath) ?? "";
    const expectedCoverage = expectedSurfaceCoverage(record.profile, manifest, fixturePath, fixtureChecksum);
    const oldCoverage = record.surfaceCoverage;
    const requiredChecks = channelEvidenceChecks[record.profile];
    const bindingChanged = record.fixturePath !== fixturePath
      || record.fixtureChecksum !== fixtureChecksum
      || record.designEra !== CHANNEL_EVIDENCE_DESIGN_ERA
      || record.contractVersion !== CHANNEL_EVIDENCE_CONTRACT_VERSION
      || record.harnessVersion !== CHANNEL_EVIDENCE_HARNESS_VERSION
      || oldCoverage?.selector !== record.profile
      || oldCoverage?.surfaceCount !== expectedCoverage.surfaceCount
      || oldCoverage?.surfaceIdsFingerprint !== expectedCoverage.surfaceIdsFingerprint
      || oldCoverage?.scopedInputFingerprint !== expectedCoverage.scopedInputFingerprint
      || JSON.stringify(Object.keys(record.hardGates ?? {}).sort()) !== JSON.stringify([...requiredChecks].sort());
    if (bindingChanged) resetChannelEvidenceProof(record, requiredChecks);
    record.designEra = CHANNEL_EVIDENCE_DESIGN_ERA;
    record.contractVersion = CHANNEL_EVIDENCE_CONTRACT_VERSION;
    record.harnessVersion = CHANNEL_EVIDENCE_HARNESS_VERSION;
    record.manifestBaselineSourceCommit = manifest.baselineSourceCommit;
    record.fixturePath = fixturePath;
    record.fixtureChecksum = fixtureChecksum;
    delete (record as ChannelEvidenceRecord & { ownedInputFingerprint?: string }).ownedInputFingerprint;
    record.surfaceCoverage = { selector: record.profile, ...expectedCoverage };
  }
  return reconciled;
}

function resetChannelEvidenceProof(
  record: ChannelEvidenceRecord,
  requiredChecks: readonly string[],
): void {
  record.status = "pending";
  record.observedAt = null;
  record.environment = null;
  record.browserOrOperatingSystem = null;
  record.deviceModel = null;
  record.installedBuildFingerprint = null;
  record.clientOrProviderVersion = null;
  record.printerOutputSettings = null;
  record.state = "not-observed";
  record.baselineRender = null;
  record.candidateRender = null;
  record.interactionRecording = null;
  record.automatedOutput = null;
  record.timings = null;
  record.productionReadback = null;
  record.deletionProof = null;
  record.builderIdentity = null;
  record.criticIdentity = null;
  record.largestGap = null;
  record.remediation = null;
  record.retainedRisk = null;
  record.hardGates = Object.fromEntries(requiredChecks.map((key) => [key, {
    passed: false,
    evidencePath: null,
    note: null,
  }]));
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

function scopedSurfaceInput(surface: BrandSurfaceRecord): unknown {
  return {
    id: surface.id,
    paths: [...surface.paths].sort(),
    type: surface.type,
    reachability: surface.reachability,
    criticality: surface.criticality,
    ownerIssue: surface.ownerIssue,
    currentAssetHashes: [...surface.currentAssetHashes].sort(),
    disposition: surface.disposition,
    deliveryState: surface.deliveryState,
    targetProfiles: [...surface.targetProfiles].sort(),
    requiredEvidence: [...surface.requiredEvidence].sort(),
    productionProbe: surface.productionProbe,
  };
}

export function expectedSurfaceCoverage(
  profile: ChannelEvidenceProfile,
  manifest: BrandSurfaceManifest,
  fixturePath: string = channelFixturePaths[profile],
  fixtureChecksum = "",
): {
  surfaceCount: number;
  surfaceIdsFingerprint: string;
  scopedInputFingerprint: string;
} {
  const surfaces = manifest.surfaces.filter((surface) => isProfileSurface(profile, surface)).sort((left, right) => left.id.localeCompare(right.id));
  const ids = surfaces.map((surface) => surface.id);
  return {
    surfaceCount: ids.length,
    surfaceIdsFingerprint: createHash("sha256").update(ids.join("\n")).digest("hex"),
    scopedInputFingerprint: createHash("sha256").update(JSON.stringify({
      surfaces: surfaces.map(scopedSurfaceInput),
      fixture: { path: fixturePath, sha256: fixtureChecksum },
    })).digest("hex"),
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
  receiptCatalog: EvidenceReceiptCatalog;
}): ChannelEvidenceValidationIssue[] {
  const { manifest, evidence, fixtureChecksums, receiptCatalog } = input;
  const issues: ChannelEvidenceValidationIssue[] = [];
  if (!evidence || typeof evidence !== "object") {
    return [{ code: "evidence-not-object", message: "Channel evidence must be an object." }];
  }
  const file = evidence as Partial<ChannelEvidenceFile>;
  if (file.schemaVersion !== CHANNEL_EVIDENCE_SCHEMA_VERSION) add(issues, "schema-version", "Channel evidence schema version is not supported.");
  if (file.designEra !== CHANNEL_EVIDENCE_DESIGN_ERA) add(issues, "design-era", "Channel evidence is not pinned to Quiet authority.");
  if (file.contractVersion !== CHANNEL_EVIDENCE_CONTRACT_VERSION) add(issues, "contract-version", "Channel evidence has a stale design-contract version.");
  if (file.harnessVersion !== CHANNEL_EVIDENCE_HARNESS_VERSION) add(issues, "harness-version", "Channel evidence has a stale harness version.");
  if (file.manifestSchemaVersion !== manifest.schemaVersion) add(issues, "manifest-schema-version", "Channel evidence is incompatible with the current manifest schema.");
  if (!/^[0-9a-f]{7,40}$/.test(file.manifestBaselineSourceCommit ?? "")) add(issues, "manifest-source-invalid", "Channel evidence needs a valid manifest source commit for provenance.");
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
    const expectedFixturePath = channelFixturePaths[record.profile];
    const actualFixtureChecksum = fixtureChecksums.get(expectedFixturePath) ?? "";
    const expected = expectedSurfaceCoverage(record.profile, manifest, expectedFixturePath, actualFixtureChecksum);
    if (record.id !== `channel:${record.profile}`) add(issues, "record-id", "Record id must be derived from its profile.", record.id);
    if (record.ownerIssue !== "gh#728") add(issues, "owner-issue", "Channel evidence must remain owned by #728.", record.id);
    if (record.surfaceCoverage?.selector !== record.profile) add(issues, "coverage-selector", "Surface coverage selector must match the profile.", record.id);
    if (record.surfaceCoverage?.surfaceCount !== expected.surfaceCount) add(issues, "coverage-count-stale", `Expected ${expected.surfaceCount} surfaces for ${record.profile}.`, record.id);
    if (record.surfaceCoverage?.surfaceIdsFingerprint !== expected.surfaceIdsFingerprint) add(issues, "coverage-fingerprint-stale", "Surface coverage fingerprint is stale.", record.id);
    if (record.surfaceCoverage?.scopedInputFingerprint !== expected.scopedInputFingerprint) add(issues, "scoped-input-stale", "Profile-scoped source inputs are stale.", record.id);
    if (record.fixturePath !== expectedFixturePath) add(issues, "fixture-path", "Fixture must match the closed profile input contract.", record.id);
    if (!/^[0-9a-f]{64}$/.test(record.fixtureChecksum) || actualFixtureChecksum !== record.fixtureChecksum) add(issues, "fixture-stale", "Fixture checksum does not match the committed fixture bytes.", record.id);
    if (record.designEra !== CHANNEL_EVIDENCE_DESIGN_ERA || record.contractVersion !== CHANNEL_EVIDENCE_CONTRACT_VERSION || record.harnessVersion !== CHANNEL_EVIDENCE_HARNESS_VERSION) add(issues, "record-contract-stale", "Record contract metadata is stale.", record.id);
    if (record.manifestBaselineSourceCommit !== file.manifestBaselineSourceCommit) add(issues, "record-source-commit", "Record source provenance must match the evidence bundle.", record.id);
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
        if (check.passed && check.evidencePath === null) add(issues, "hard-gate-proof-missing", `Passing hard gate ${key} needs an evidence receipt.`, record.id);
        if (!check.passed && check.evidencePath !== null) add(issues, "hard-gate-claim-mismatch", `A failed hard gate ${key} cannot point at a passing evidence receipt.`, record.id);
        if (check.evidencePath !== null) addReceiptIssues(issues, check.evidencePath, receiptCatalog, record.id, `${record.id}:${key}`, ["hard-gate"], expected.scopedInputFingerprint);
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
    const receiptFields: Array<[keyof ChannelEvidenceRecord, EvidenceReceiptProofKind]> = [
      ["baselineRender", "baseline-render"],
      ["candidateRender", "candidate-render"],
      ["interactionRecording", "interaction-recording"],
      ["automatedOutput", "automated-output"],
      ["timings", "timings"],
      ["productionReadback", "production-readback"],
      ["deletionProof", "deletion"],
    ];
    for (const [field, proofKind] of receiptFields) {
      const reference = record[field];
      if (reference !== null && reference !== undefined) addReceiptIssues(issues, reference, receiptCatalog, record.id, record.id, [proofKind], expected.scopedInputFingerprint);
    }
  }
  for (const profile of channelEvidenceProfiles) if (!byProfile.has(profile)) add(issues, "profile-missing", `Missing channel evidence profile: ${profile}.`);
  if (byProfile.size !== channelEvidenceProfiles.length) add(issues, "profile-count", `Expected exactly ${channelEvidenceProfiles.length} channel evidence profiles.`);
  return issues;
}

function addReceiptIssues(
  issues: ChannelEvidenceValidationIssue[],
  value: unknown,
  catalog: EvidenceReceiptCatalog,
  recordId: string,
  subjectId: string,
  proofKinds: readonly EvidenceReceiptProofKind[],
  scopedInputFingerprint: string,
): void {
  for (const issue of validateEvidenceReceiptReference(value, { domain: "channel", subjectId, proofKinds, scopedInputFingerprint }, catalog)) {
    add(issues, issue.code, issue.message, recordId);
  }
}
