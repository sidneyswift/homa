import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateEvidenceReceiptReference,
  type EvidenceReceiptCatalog,
  type EvidenceReceiptReference,
} from "../packages/design/src/evidence-receipts.ts";
import type { BrandSurfaceManifest } from "../packages/design/src/surfaces.ts";

export const PROVIDER_HANDOFF_SCHEMA_VERSION = 2 as const;
export const PROVIDER_HANDOFF_HARNESS_VERSION = "provider-handoff-v3" as const;
export const PROVIDER_HANDOFF_DESIGN_ERA = "quiet-authority-v1" as const;
export const PROVIDER_HANDOFF_OWNER_ISSUE = "gh#732" as const;

export const providerHandoffStatuses = [
  "inventory",
  "pending",
  "verified",
  "blocked",
] as const;
export type ProviderHandoffStatus = (typeof providerHandoffStatuses)[number];

export const providerHandoffReadbackStatuses = [
  "pending",
  "pass",
  "blocked",
  "inconclusive",
] as const;
export type ProviderHandoffReadbackStatus =
  (typeof providerHandoffReadbackStatuses)[number];

export const providerHandoffIds = [
  "stripe-checkout-and-portal",
  "supabase-auth-email-and-callback",
  "google-identity",
  "apple-identity",
  "apple-subscription-management",
] as const;
export type ProviderHandoffId = (typeof providerHandoffIds)[number];

export type ProviderHandoffEnvironment =
  | "sandbox"
  | "production"
  | "both"
  | "not-configured";

export interface ProviderSourceBinding {
  path: string;
  sha256: string;
}

export interface ProviderHandoffField {
  key: string;
  sourcePaths: string[];
  environment: ProviderHandoffEnvironment;
  accountOwner: string;
  updatePath: string;
  fallback: string;
  cacheBehavior: string;
  rollback: string;
}

export interface ProviderHandoffRecord {
  id: ProviderHandoffId;
  provider: "stripe" | "supabase" | "google" | "apple";
  journey: "acquisition" | "authentication" | "billing";
  ownerIssue: typeof PROVIDER_HANDOFF_OWNER_ISSUE;
  status: ProviderHandoffStatus;
  providerProfile: "provider-constrained";
  sourcePaths: string[];
  surfaceIds: string[];
  scopedInputFingerprint: string;
  accountOwner: string;
  presentation: {
    asset: string;
    color: string[];
    logo: string;
    copy: string[];
    typography: string;
  };
  configurableFields: ProviderHandoffField[];
  environment: {
    supported: ProviderHandoffEnvironment[];
    notes: string;
  };
  fallback: string;
  cache: string;
  updatePath: string;
  readback: {
    status: ProviderHandoffReadbackStatus;
    apiAvailable: boolean;
    evidencePath: EvidenceReceiptReference | null;
    observedAt: string | null;
    externalStateSimulated: false;
  };
  rollback: {
    owner: string;
    restoreAction: string;
    restoreTarget: string;
    rehearsalEvidence: EvidenceReceiptReference | null;
  };
  contracts: string[];
}

export interface ProviderHandoffFile {
  schemaVersion: typeof PROVIDER_HANDOFF_SCHEMA_VERSION;
  designEra: typeof PROVIDER_HANDOFF_DESIGN_ERA;
  harnessVersion: typeof PROVIDER_HANDOFF_HARNESS_VERSION;
  ownerIssue: typeof PROVIDER_HANDOFF_OWNER_ISSUE;
  manifestSchemaVersion: BrandSurfaceManifest["schemaVersion"];
  manifestBaselineSourceCommit: string;
  surfaceCoverage: {
    selector: "ownerIssue:gh#732";
    surfaceCount: number;
    surfaceIds: string[];
    surfaceIdsFingerprint: string;
    scopedInputFingerprint: string;
  };
  sourceCoverage: {
    sourceCount: number;
    bindings: ProviderSourceBinding[];
    sourceFingerprint: string;
  };
  records: ProviderHandoffRecord[];
}

export interface ProviderHandoffValidationIssue {
  code: string;
  recordId?: string;
  message: string;
}

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MANIFEST_PATH = resolve(ROOT, "docs/homa-design/evidence/surfaces.json");

function add(
  issues: ProviderHandoffValidationIssue[],
  code: string,
  message: string,
  recordId?: string,
): void {
  issues.push(recordId ? { code, recordId, message } : { code, message });
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return isNonEmpty(value) && !Number.isNaN(Date.parse(value));
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validatePathList(
  issues: ProviderHandoffValidationIssue[],
  paths: unknown,
  code: string,
  recordId: string,
  sourceChecksums: ReadonlyMap<string, string>,
): void {
  if (!Array.isArray(paths) || paths.length === 0) {
    add(issues, code, "Provider handoff must name at least one repository path.", recordId);
    return;
  }
  for (const path of paths) {
    if (!isNonEmpty(path) || path.includes("..") || path.startsWith("/")) {
      add(issues, `${code}-unsafe`, `Unsafe repository path: ${String(path)}.`, recordId);
      continue;
    }
    if (!sourceChecksums.has(path)) add(issues, `${code}-missing`, `Repository path is missing or not tracked by Git: ${path}.`, recordId);
  }
}

export const providerSurfacePathsByHandoffId = {
  "stripe-checkout-and-portal": [
    "apps/web/lib/billing/portal.ts",
    "apps/web/lib/billing/wall.ts",
    "provider:stripe-checkout-and-portal",
  ],
  "supabase-auth-email-and-callback": [
    "apps/web/.env.example",
    "apps/web/lib/supabase/client.ts",
    "apps/web/lib/supabase/server.ts",
    "provider:supabase-auth-email",
  ],
  "google-identity": ["provider:google-identity"],
  "apple-identity": ["provider:apple-identity"],
  "apple-subscription-management": [
    "apps/web/lib/billing/apple-verify.ts",
    "provider:apple-subscription-management",
  ],
} as const satisfies Record<ProviderHandoffId, readonly string[]>;

export const providerSourcePathsByHandoffId = {
  "stripe-checkout-and-portal": [
    "apps/web/.env.example",
    "apps/web/app/api/billing/checkout/route.ts",
    "apps/web/app/api/billing/confirm/route.ts",
    "apps/web/app/api/billing/portal/route.ts",
    "apps/web/app/api/billing/webhook/route.ts",
    "apps/web/app/app/settings/plan-section.tsx",
    "apps/web/components/billing/wall-copy.ts",
    "apps/web/lib/account-deletion-billing.ts",
    "apps/web/lib/account-deletion.ts",
    "apps/web/lib/billing/checkout-intent.ts",
    "apps/web/lib/billing/entitlements.ts",
    "apps/web/lib/billing/portal.ts",
    "apps/web/lib/billing/server-checkout.ts",
    "apps/web/lib/billing/stripe-checkout-config.ts",
    "apps/web/lib/billing/stripe-server-checkout.ts",
    "apps/web/lib/billing/wall.ts",
  ],
  "supabase-auth-email-and-callback": [
    "apps/web/.env.example",
    "apps/web/app/auth/callback/route.ts",
    "apps/web/app/auth/confirm/route.ts",
    "apps/web/app/forgot-password/page.tsx",
    "apps/web/app/signin/signin-form.tsx",
    "apps/web/lib/supabase/client.ts",
    "apps/web/lib/supabase/server.ts",
    "supabase/templates/recovery.html",
  ],
  "google-identity": [
    "apps/mobile/app.json",
    "apps/mobile/src/features/auth/google-sign-in.ts",
    "apps/mobile/src/lib/supabase.ts",
    "apps/web/app/auth/callback/route.ts",
    "apps/web/app/onboarding/parent-step.tsx",
    "apps/web/app/signin/signin-form.tsx",
  ],
  "apple-identity": [
    "apps/mobile/app.json",
    "apps/mobile/src/app/(auth)/signin.tsx",
    "apps/mobile/src/features/auth/apple-sign-in.ts",
    "apps/mobile/src/lib/supabase.ts",
  ],
  "apple-subscription-management": [
    "apps/mobile/src/app/settings.tsx",
    "apps/mobile/src/components/billing-gate.tsx",
    "apps/mobile/src/features/billing/constants.ts",
    "apps/mobile/src/lib/billing.ts",
    "apps/mobile/src/lib/web-links.ts",
    "apps/web/.env.example",
    "apps/web/app/api/billing/apple/confirm/route.ts",
    "apps/web/app/api/billing/apple/purchase-interlock/route.ts",
    "apps/web/app/api/billing/apple/webhook/route.ts",
    "apps/web/lib/account-deletion.ts",
    "apps/web/lib/billing/apple-purchase-interlock.ts",
    "apps/web/lib/billing/apple-verify.ts",
    "apps/web/lib/billing/entitlements.ts",
    "apps/web/lib/billing/wall.ts",
    "packages/core/src/billing-catalog.ts",
    "supabase/migrations/20260808184500_apple_purchase_interlock.sql",
  ],
} as const satisfies Record<ProviderHandoffId, readonly string[]>;

function expectedSurfaceCoverage(manifest: BrandSurfaceManifest): {
  surfaceCount: number;
  surfaceIds: string[];
  surfaceIdsFingerprint: string;
  scopedInputFingerprint: string;
} {
  const surfaces = manifest.surfaces
    .filter((surface) => surface.ownerIssue === PROVIDER_HANDOFF_OWNER_ISSUE)
    .sort((left, right) => left.id.localeCompare(right.id));
  const surfaceIds = surfaces.map((surface) => surface.id);
  return {
    surfaceCount: surfaceIds.length,
    surfaceIds,
    surfaceIdsFingerprint: sha256(surfaceIds.join("\n")),
    scopedInputFingerprint: sha256(JSON.stringify(surfaces.map(providerSurfaceInput))),
  };
}

function providerSurfaceInput(surface: BrandSurfaceManifest["surfaces"][number]): unknown {
  return {
    id: surface.id,
    paths: [...surface.paths].sort(),
    reachability: surface.reachability,
    criticality: surface.criticality,
    ownerIssue: surface.ownerIssue,
    disposition: surface.disposition,
    deliveryState: surface.deliveryState,
    currentAssetHashes: [...surface.currentAssetHashes].sort(),
    requiredEvidence: [...surface.requiredEvidence].sort(),
    productionProbe: surface.productionProbe,
  };
}

function expectedSourceBindings(
  records: readonly ProviderHandoffRecord[],
  sourceChecksums: ReadonlyMap<string, string>,
): ProviderSourceBinding[] {
  const paths = [...new Set(records.flatMap((record) => Array.isArray(record.sourcePaths) ? record.sourcePaths : []))].sort();
  return paths.map((path) => ({ path, sha256: sourceChecksums.get(path) ?? "" }));
}

function sourceBindingsFingerprint(bindings: readonly ProviderSourceBinding[]): string {
  return sha256(bindings.map((binding) => `${binding.path}\0${binding.sha256}`).join("\n"));
}

function expectedRecordFingerprint(
  record: ProviderHandoffRecord,
  manifest: BrandSurfaceManifest,
  sourceChecksums: ReadonlyMap<string, string>,
): string {
  const sources = [...new Set(record.sourcePaths)].sort().map((path) => ({ path, sha256: sourceChecksums.get(path) ?? "" }));
  const surfaces = record.surfaceIds
    .map((id) => manifest.surfaces.find((surface) => surface.id === id))
    .filter((surface): surface is BrandSurfaceManifest["surfaces"][number] => Boolean(surface))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(providerSurfaceInput);
  return sha256(JSON.stringify({ sources, surfaces }));
}

export function collectProviderRepositoryPaths(handoffs: unknown): string[] {
  if (!handoffs || typeof handoffs !== "object" || !Array.isArray((handoffs as Partial<ProviderHandoffFile>).records)) return [];
  const paths = new Set<string>(Object.values(providerSourcePathsByHandoffId).flat());
  for (const record of (handoffs as Partial<ProviderHandoffFile>).records ?? []) {
    for (const path of record.sourcePaths ?? []) paths.add(path);
    for (const path of record.presentation?.copy ?? []) paths.add(path);
    if (record.presentation?.logo && !record.presentation.logo.includes("://")) paths.add(record.presentation.logo);
    for (const field of record.configurableFields ?? []) for (const path of field.sourcePaths ?? []) paths.add(path);
  }
  return [...paths].sort();
}

export function reconcileProviderHandoffBindings(
  manifest: BrandSurfaceManifest,
  value: unknown,
  sourceChecksums: ReadonlyMap<string, string>,
): ProviderHandoffFile {
  if (!value || typeof value !== "object" || !Array.isArray((value as Partial<ProviderHandoffFile>).records)) {
    throw new Error("Provider handoffs must contain records before bindings can be refreshed.");
  }
  const reconciled = structuredClone(value) as ProviderHandoffFile & { ownedInputFingerprint?: string };
  const fileContractChanged = reconciled.schemaVersion !== PROVIDER_HANDOFF_SCHEMA_VERSION
    || reconciled.designEra !== PROVIDER_HANDOFF_DESIGN_ERA
    || reconciled.harnessVersion !== PROVIDER_HANDOFF_HARNESS_VERSION
    || reconciled.ownerIssue !== PROVIDER_HANDOFF_OWNER_ISSUE;
  reconciled.schemaVersion = PROVIDER_HANDOFF_SCHEMA_VERSION;
  reconciled.designEra = PROVIDER_HANDOFF_DESIGN_ERA;
  reconciled.harnessVersion = PROVIDER_HANDOFF_HARNESS_VERSION;
  reconciled.ownerIssue = PROVIDER_HANDOFF_OWNER_ISSUE;
  reconciled.manifestSchemaVersion = manifest.schemaVersion;
  reconciled.manifestBaselineSourceCommit = manifest.baselineSourceCommit;
  delete reconciled.ownedInputFingerprint;
  for (const record of reconciled.records) {
    const expectedSourcePaths = [...providerSourcePathsByHandoffId[record.id]];
    const expectedSurfaceIds = providerSurfacePathsByHandoffId[record.id]
      .map((path) => manifest.surfaces.find((surface) => surface.paths[0] === path && surface.ownerIssue === PROVIDER_HANDOFF_OWNER_ISSUE)?.id)
      .filter((id): id is string => Boolean(id))
      .sort();
    const fingerprintCandidate = {
      ...record,
      sourcePaths: expectedSourcePaths,
      surfaceIds: expectedSurfaceIds,
    };
    const expectedFingerprint = expectedRecordFingerprint(fingerprintCandidate, manifest, sourceChecksums);
    const bindingChanged = fileContractChanged
      || JSON.stringify([...record.sourcePaths].sort()) !== JSON.stringify([...expectedSourcePaths].sort())
      || JSON.stringify([...record.surfaceIds].sort()) !== JSON.stringify(expectedSurfaceIds)
      || record.scopedInputFingerprint !== expectedFingerprint;
    if (bindingChanged) resetProviderHandoffProof(record);
    record.sourcePaths = expectedSourcePaths;
    record.surfaceIds = expectedSurfaceIds;
    record.rollback.rehearsalEvidence ??= null;
    record.scopedInputFingerprint = expectedFingerprint;
  }
  const surfaceCoverage = expectedSurfaceCoverage(manifest);
  reconciled.surfaceCoverage = {
    selector: "ownerIssue:gh#732",
    ...surfaceCoverage,
  };
  const bindings = expectedSourceBindings(reconciled.records, sourceChecksums);
  reconciled.sourceCoverage = {
    sourceCount: bindings.length,
    bindings,
    sourceFingerprint: sourceBindingsFingerprint(bindings),
  };
  return reconciled;
}

function resetProviderHandoffProof(record: ProviderHandoffRecord): void {
  record.status = record.status === "blocked" ? "blocked" : "pending";
  record.readback.status = "pending";
  record.readback.evidencePath = null;
  record.readback.observedAt = null;
  record.readback.externalStateSimulated = false;
  record.rollback.rehearsalEvidence = null;
}

export function validateProviderHandoffs(input: {
  manifest: BrandSurfaceManifest;
  handoffs: unknown;
  sourceChecksums: ReadonlyMap<string, string>;
  receiptCatalog: EvidenceReceiptCatalog;
}): ProviderHandoffValidationIssue[] {
  const issues: ProviderHandoffValidationIssue[] = [];
  const { manifest, handoffs, sourceChecksums, receiptCatalog } = input;
  if (!handoffs || typeof handoffs !== "object") {
    return [{ code: "manifest-not-object", message: "Provider handoff manifest must be an object." }];
  }
  const file = handoffs as Partial<ProviderHandoffFile>;
  if (file.schemaVersion !== PROVIDER_HANDOFF_SCHEMA_VERSION) add(issues, "schema-version", "Provider handoff schema version is unsupported.");
  if (file.designEra !== PROVIDER_HANDOFF_DESIGN_ERA) add(issues, "design-era", "Provider handoffs must be pinned to Quiet authority.");
  if (file.harnessVersion !== PROVIDER_HANDOFF_HARNESS_VERSION) add(issues, "harness-version", "Provider handoff harness version is stale.");
  if (file.ownerIssue !== PROVIDER_HANDOFF_OWNER_ISSUE) add(issues, "owner-issue", "Provider handoffs must remain owned by #732.");
  if (file.manifestSchemaVersion !== manifest.schemaVersion) add(issues, "manifest-schema-version", "Provider handoffs are incompatible with the current manifest schema.");
  if (!/^[0-9a-f]{7,40}$/.test(file.manifestBaselineSourceCommit ?? "")) add(issues, "manifest-source-invalid", "Provider handoffs need a valid manifest source commit for provenance.");

  const expectedCoverage = expectedSurfaceCoverage(manifest);
  const coverage = file.surfaceCoverage;
  if (coverage?.selector !== "ownerIssue:gh#732") add(issues, "coverage-selector", "Provider surface coverage must select ownerIssue gh#732.");
  if (coverage?.surfaceCount !== expectedCoverage.surfaceCount) add(issues, "coverage-count-stale", `Expected ${expectedCoverage.surfaceCount} provider surfaces owned by #732.`);
  if (JSON.stringify(coverage?.surfaceIds ?? []) !== JSON.stringify(expectedCoverage.surfaceIds)) add(issues, "coverage-ids-stale", "Provider surface IDs are stale or incomplete.");
  if (coverage?.surfaceIdsFingerprint !== expectedCoverage.surfaceIdsFingerprint) add(issues, "coverage-fingerprint-stale", "Provider surface coverage fingerprint is stale.");
  if (coverage?.scopedInputFingerprint !== expectedCoverage.scopedInputFingerprint) add(issues, "coverage-scoped-input-stale", "Provider surface source inputs are stale.");

  if (!Array.isArray(file.records)) return [...issues, { code: "records-not-array", message: "Provider handoff records must be an array." }];
  const expectedIds = new Set<string>(providerHandoffIds);
  const expectedBindings = expectedSourceBindings(file.records, sourceChecksums);
  if (file.sourceCoverage?.sourceCount !== expectedBindings.length) add(issues, "source-coverage-count", `Expected ${expectedBindings.length} exact provider source paths.`);
  if (JSON.stringify(file.sourceCoverage?.bindings ?? []) !== JSON.stringify(expectedBindings)) add(issues, "source-coverage-bindings", "Provider source path hashes are stale or incomplete.");
  if (file.sourceCoverage?.sourceFingerprint !== sourceBindingsFingerprint(expectedBindings)) add(issues, "source-coverage-fingerprint", "Provider source coverage fingerprint is stale.");
  const seen = new Set<string>();
  const seenSurfaceIds = new Map<string, string>();
  for (const raw of file.records) {
    if (!raw || typeof raw !== "object") {
      add(issues, "record-not-object", "Every provider handoff must be an object.");
      continue;
    }
    const record = raw as ProviderHandoffRecord;
    const recordId = String(record.id);
    if (seen.has(recordId)) add(issues, "duplicate-record", "Provider handoff IDs must be unique.", recordId);
    seen.add(recordId);
    if (!expectedIds.has(recordId)) add(issues, "unknown-record", `Unknown provider handoff: ${recordId}.`, recordId);
    if (record.ownerIssue !== PROVIDER_HANDOFF_OWNER_ISSUE) add(issues, "record-owner-issue", "Provider handoff owner must be #732.", recordId);
    if (!providerHandoffStatuses.includes(record.status)) add(issues, "record-status", `Unsupported handoff status: ${String(record.status)}.`, recordId);
    if (record.providerProfile !== "provider-constrained") add(issues, "provider-profile", "Provider-owned surfaces must use the constrained provider profile.", recordId);
    if (record.readback?.externalStateSimulated !== false) add(issues, "simulated-provider-state", "External provider state cannot be simulated.", recordId);
    validatePathList(issues, record.sourcePaths, "source-paths", recordId, sourceChecksums);
    if (JSON.stringify([...record.sourcePaths].sort()) !== JSON.stringify([...providerSourcePathsByHandoffId[record.id]].sort())) {
      add(issues, "record-source-mapping", "Provider handoff source paths must match the closed source contract exactly.", recordId);
    }
    if (!Array.isArray(record.surfaceIds) || record.surfaceIds.length === 0) add(issues, "record-surfaces", "Provider handoff must own at least one exact manifest surface.", recordId);
    else for (const surfaceId of record.surfaceIds) {
      const priorOwner = seenSurfaceIds.get(surfaceId);
      if (priorOwner) add(issues, "record-surface-duplicate", `Surface ${surfaceId} is already assigned to ${priorOwner}.`, recordId);
      else seenSurfaceIds.set(surfaceId, recordId);
      const surface = manifest.surfaces.find((candidate) => candidate.id === surfaceId);
      if (!surface) add(issues, "record-surface-missing", `Surface ID is not in the current manifest: ${surfaceId}.`, recordId);
      else if (surface.ownerIssue !== PROVIDER_HANDOFF_OWNER_ISSUE) add(issues, "record-surface-owner", `Surface ${surfaceId} is not owned by #732.`, recordId);
    }
    const expectedPaths = providerSurfacePathsByHandoffId[record.id];
    const expectedSurfaces = expectedPaths.map((path) => manifest.surfaces.find((surface) => surface.paths[0] === path && surface.ownerIssue === PROVIDER_HANDOFF_OWNER_ISSUE));
    const expectedRecordSurfaceIds = expectedSurfaces.filter((surface): surface is BrandSurfaceManifest["surfaces"][number] => Boolean(surface)).map((surface) => surface.id).sort();
    if (expectedSurfaces.some((surface) => !surface) || JSON.stringify([...record.surfaceIds].sort()) !== JSON.stringify(expectedRecordSurfaceIds)) add(issues, "record-surface-mapping", `Provider handoff must map exactly to ${expectedPaths.join(", ")}.`, recordId);
    if (record.scopedInputFingerprint !== expectedRecordFingerprint(record, manifest, sourceChecksums)) add(issues, "record-scoped-input-stale", "Provider handoff source or surface inputs are stale.", recordId);
    if (!isNonEmpty(record.accountOwner)) add(issues, "account-owner", "Provider handoff needs a named account owner.", recordId);
    if (!record.presentation || !isNonEmpty(record.presentation.asset) || !isNonEmpty(record.presentation.logo) || !isNonEmpty(record.presentation.typography)) add(issues, "presentation-missing", "Provider handoff needs asset, Logo, and typography constraints.", recordId);
    if (!Array.isArray(record.presentation?.color) || record.presentation.color.length === 0) add(issues, "color-missing", "Provider handoff needs explicit color tokens or constrained fallback colors.", recordId);
    validatePathList(issues, record.presentation?.copy, "copy-paths", recordId, sourceChecksums);
    if (!Array.isArray(record.configurableFields) || record.configurableFields.length === 0) {
      add(issues, "configurable-fields", "Provider handoff needs at least one configurable field.", recordId);
    } else {
      for (const field of record.configurableFields) {
        if (!field || !isNonEmpty(field.key)) add(issues, "field-key", "Every configurable provider field needs a key.", recordId);
        validatePathList(issues, field?.sourcePaths, "field-source-paths", recordId, sourceChecksums);
        if (Array.isArray(field?.sourcePaths)) {
          for (const path of field.sourcePaths) {
            if (isNonEmpty(path) && !record.sourcePaths.includes(path)) {
              add(
                issues,
                "field-source-outside-record",
                `Configurable field ${String(field.key)} names a source outside its record fingerprint: ${path}.`,
                recordId,
              );
            }
          }
        }
        for (const value of [field?.accountOwner, field?.updatePath, field?.fallback, field?.cacheBehavior, field?.rollback]) {
          if (!isNonEmpty(value)) add(issues, "field-detail", `Configurable field ${String(field?.key)} is missing an operational detail.`, recordId);
        }
      }
    }
    if (!Array.isArray(record.environment?.supported) || record.environment.supported.length === 0 || !isNonEmpty(record.environment.notes)) add(issues, "environment-missing", "Provider handoff needs environment coverage and notes.", recordId);
    for (const value of [record.fallback, record.cache, record.updatePath, record.rollback?.owner, record.rollback?.restoreAction, record.rollback?.restoreTarget]) {
      if (!isNonEmpty(value)) add(issues, "operational-detail", "Provider handoff is missing fallback, cache, update, or rollback detail.", recordId);
    }
    const readback = record.readback;
    if (!readback || !providerHandoffReadbackStatuses.includes(readback.status)) add(issues, "readback-status", "Provider handoff read-back status is invalid.", recordId);
    if (readback?.status === "pass") {
      if (readback.evidencePath === null || !isIsoDate(readback.observedAt)) add(issues, "readback-proof", "A passing provider read-back needs a committed receipt and timestamp.", recordId);
      if (record.status !== "verified") add(issues, "verified-status", "A passing provider read-back requires verified handoff status.", recordId);
      if (record.rollback?.rehearsalEvidence === null) add(issues, "rollback-rehearsal-proof", "A verified provider handoff needs a committed rollback rehearsal receipt.", recordId);
    } else if (record.status === "verified") {
      add(issues, "verified-without-readback", "A verified provider handoff requires a passing external read-back.", recordId);
    }
    if (readback?.evidencePath !== null && readback?.evidencePath !== undefined) {
      for (const issue of validateEvidenceReceiptReference(readback.evidencePath, { domain: "provider", subjectId: recordId, proofKinds: ["provider-readback"], scopedInputFingerprint: record.scopedInputFingerprint }, receiptCatalog)) add(issues, issue.code, issue.message, recordId);
    }
    if (record.rollback?.rehearsalEvidence !== null && record.rollback?.rehearsalEvidence !== undefined) {
      for (const issue of validateEvidenceReceiptReference(record.rollback.rehearsalEvidence, { domain: "provider", subjectId: recordId, proofKinds: ["rollback-rehearsal"], scopedInputFingerprint: record.scopedInputFingerprint }, receiptCatalog)) add(issues, issue.code, issue.message, recordId);
    }
    if (!Array.isArray(record.contracts) || record.contracts.length === 0 || record.contracts.some((contract) => !isNonEmpty(contract))) add(issues, "contracts-missing", "Provider handoff must name preserved auth, billing, consent, or error contracts.", recordId);
  }
  for (const id of providerHandoffIds) if (!seen.has(id)) add(issues, "record-missing", `Missing provider handoff: ${id}.`);
  if (seen.size !== providerHandoffIds.length) add(issues, "record-count", `Expected exactly ${providerHandoffIds.length} provider handoffs.`);
  if (JSON.stringify([...seenSurfaceIds.keys()].sort()) !== JSON.stringify(expectedCoverage.surfaceIds)) add(issues, "record-surface-union", "Provider record surface IDs must exactly cover the #732 provider surface union once.");
  return issues;
}

export function loadProviderHandoffInputs(): {
  manifest: BrandSurfaceManifest;
  handoffs: ProviderHandoffFile;
} {
  const handoffPath = resolve(ROOT, "docs/homa-design/evidence/provider-handoffs.json");
  return {
    manifest: JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as BrandSurfaceManifest,
    handoffs: JSON.parse(readFileSync(handoffPath, "utf8")) as ProviderHandoffFile,
  };
}
