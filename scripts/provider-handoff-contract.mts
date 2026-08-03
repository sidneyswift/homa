import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BrandSurfaceManifest } from "../packages/design/src/surfaces.ts";

export const PROVIDER_HANDOFF_SCHEMA_VERSION = 1 as const;
export const PROVIDER_HANDOFF_HARNESS_VERSION = "provider-handoff-v1" as const;
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
    evidencePath: string | null;
    observedAt: string | null;
    externalStateSimulated: false;
  };
  rollback: {
    owner: string;
    restoreAction: string;
    restoreTarget: string;
  };
  contracts: string[];
}

export interface ProviderHandoffFile {
  schemaVersion: typeof PROVIDER_HANDOFF_SCHEMA_VERSION;
  designEra: typeof PROVIDER_HANDOFF_DESIGN_ERA;
  harnessVersion: typeof PROVIDER_HANDOFF_HARNESS_VERSION;
  ownerIssue: typeof PROVIDER_HANDOFF_OWNER_ISSUE;
  manifestBaselineSourceCommit: string;
  ownedInputFingerprint: string;
  surfaceCoverage: {
    selector: "ownerIssue:gh#732";
    surfaceCount: number;
    surfaceIds: string[];
    surfaceIdsFingerprint: string;
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

function pathExists(path: string): boolean {
  return existsSync(resolve(ROOT, path));
}

function validatePathList(
  issues: ProviderHandoffValidationIssue[],
  paths: unknown,
  code: string,
  recordId: string,
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
    if (!pathExists(path)) add(issues, `${code}-missing`, `Repository path does not exist: ${path}.`, recordId);
  }
}

function expectedSurfaceCoverage(manifest: BrandSurfaceManifest): {
  surfaceCount: number;
  surfaceIds: string[];
  surfaceIdsFingerprint: string;
} {
  const surfaceIds = manifest.surfaces
    .filter((surface) => surface.ownerIssue === PROVIDER_HANDOFF_OWNER_ISSUE && surface.type === "provider")
    .map((surface) => surface.id)
    .sort();
  return {
    surfaceCount: surfaceIds.length,
    surfaceIds,
    surfaceIdsFingerprint: sha256(surfaceIds.join("\n")),
  };
}

export function validateProviderHandoffs(input: {
  manifest: BrandSurfaceManifest;
  handoffs: unknown;
}): ProviderHandoffValidationIssue[] {
  const issues: ProviderHandoffValidationIssue[] = [];
  const { manifest, handoffs } = input;
  if (!handoffs || typeof handoffs !== "object") {
    return [{ code: "manifest-not-object", message: "Provider handoff manifest must be an object." }];
  }
  const file = handoffs as Partial<ProviderHandoffFile>;
  if (file.schemaVersion !== PROVIDER_HANDOFF_SCHEMA_VERSION) add(issues, "schema-version", "Provider handoff schema version is unsupported.");
  if (file.designEra !== PROVIDER_HANDOFF_DESIGN_ERA) add(issues, "design-era", "Provider handoffs must be pinned to Quiet authority.");
  if (file.harnessVersion !== PROVIDER_HANDOFF_HARNESS_VERSION) add(issues, "harness-version", "Provider handoff harness version is stale.");
  if (file.ownerIssue !== PROVIDER_HANDOFF_OWNER_ISSUE) add(issues, "owner-issue", "Provider handoffs must remain owned by #732.");
  if (file.manifestBaselineSourceCommit !== manifest.baselineSourceCommit) add(issues, "manifest-source-stale", "Provider handoff manifest source commit is stale.");
  if (file.ownedInputFingerprint !== manifest.ownedInputFingerprint) add(issues, "manifest-fingerprint-stale", "Provider handoff manifest fingerprint is stale.");

  const expectedCoverage = expectedSurfaceCoverage(manifest);
  const coverage = file.surfaceCoverage;
  if (coverage?.selector !== "ownerIssue:gh#732") add(issues, "coverage-selector", "Provider surface coverage must select ownerIssue gh#732.");
  if (coverage?.surfaceCount !== expectedCoverage.surfaceCount) add(issues, "coverage-count-stale", `Expected ${expectedCoverage.surfaceCount} provider surfaces owned by #732.`);
  if (JSON.stringify(coverage?.surfaceIds ?? []) !== JSON.stringify(expectedCoverage.surfaceIds)) add(issues, "coverage-ids-stale", "Provider surface IDs are stale or incomplete.");
  if (coverage?.surfaceIdsFingerprint !== expectedCoverage.surfaceIdsFingerprint) add(issues, "coverage-fingerprint-stale", "Provider surface coverage fingerprint is stale.");

  if (!Array.isArray(file.records)) return [...issues, { code: "records-not-array", message: "Provider handoff records must be an array." }];
  const expectedIds = new Set<string>(providerHandoffIds);
  const seen = new Set<string>();
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
    validatePathList(issues, record.sourcePaths, "source-paths", recordId);
    if (!Array.isArray(record.surfaceIds)) add(issues, "record-surfaces", "Provider handoff surface IDs must be an array.", recordId);
    else for (const surfaceId of record.surfaceIds) {
      const surface = manifest.surfaces.find((candidate) => candidate.id === surfaceId);
      if (!surface) add(issues, "record-surface-missing", `Surface ID is not in the current manifest: ${surfaceId}.`, recordId);
      else if (surface.ownerIssue !== PROVIDER_HANDOFF_OWNER_ISSUE || surface.type !== "provider") add(issues, "record-surface-owner", `Surface ${surfaceId} is not a #732 provider surface.`, recordId);
    }
    if (!isNonEmpty(record.accountOwner)) add(issues, "account-owner", "Provider handoff needs a named account owner.", recordId);
    if (!record.presentation || !isNonEmpty(record.presentation.asset) || !isNonEmpty(record.presentation.logo) || !isNonEmpty(record.presentation.typography)) add(issues, "presentation-missing", "Provider handoff needs asset, Logo, and typography constraints.", recordId);
    if (!Array.isArray(record.presentation?.color) || record.presentation.color.length === 0) add(issues, "color-missing", "Provider handoff needs explicit color tokens or constrained fallback colors.", recordId);
    validatePathList(issues, record.presentation?.copy, "copy-paths", recordId);
    if (!Array.isArray(record.configurableFields) || record.configurableFields.length === 0) {
      add(issues, "configurable-fields", "Provider handoff needs at least one configurable field.", recordId);
    } else {
      for (const field of record.configurableFields) {
        if (!field || !isNonEmpty(field.key)) add(issues, "field-key", "Every configurable provider field needs a key.", recordId);
        validatePathList(issues, field?.sourcePaths, "field-source-paths", recordId);
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
      if (!isNonEmpty(readback.evidencePath) || !isIsoDate(readback.observedAt)) add(issues, "readback-proof", "A passing provider read-back needs a path and timestamp.", recordId);
      if (record.status !== "verified") add(issues, "verified-status", "A passing provider read-back requires verified handoff status.", recordId);
    } else if (record.status === "verified") {
      add(issues, "verified-without-readback", "A verified provider handoff requires a passing external read-back.", recordId);
    }
    if (!Array.isArray(record.contracts) || record.contracts.length === 0 || record.contracts.some((contract) => !isNonEmpty(contract))) add(issues, "contracts-missing", "Provider handoff must name preserved auth, billing, consent, or error contracts.", recordId);
  }
  for (const id of providerHandoffIds) if (!seen.has(id)) add(issues, "record-missing", `Missing provider handoff: ${id}.`);
  if (seen.size !== providerHandoffIds.length) add(issues, "record-count", `Expected exactly ${providerHandoffIds.length} provider handoffs.`);
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
