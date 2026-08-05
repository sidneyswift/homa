import type {
  BrandCriticality,
  BrandDeliveryState,
  BrandDisposition,
  BrandSurfaceManifest,
  BrandSurfaceRecord,
} from "./surfaces.ts";
import { brandCriticalities, brandDeliveryStates } from "./surfaces.ts";
import { DESIGN_CONTRACT_VERSION } from "./contract/version.ts";
import {
  validateEvidenceReceiptReference,
  type EvidenceReceiptCatalog,
  type EvidenceReceiptProofKind,
  type EvidenceReceiptReference,
} from "./evidence-receipts.ts";

export const LEGACY_REMOVAL_SCHEMA_VERSION = 2 as const;
export const LEGACY_REMOVAL_HARNESS_VERSION = "legacy-removal-v2" as const;
export const LEGACY_REMOVAL_DESIGN_ERA = "quiet-authority-v1" as const;
export const LEGACY_REMOVAL_CONTRACT_VERSION = `@homa/design:${DESIGN_CONTRACT_VERSION}` as const;

export const legacyRemovalStatuses = [
  "open",
  "replacement-verified",
  "stop-generation-verified",
  "deleted",
  "immutable-residual",
] as const;
export type LegacyRemovalStatus = (typeof legacyRemovalStatuses)[number];

export type LegacyRemovalSourceState = "present-signaled" | "present-clear" | "absent";

export interface LegacyRemovalEvidence {
  replacement: EvidenceReceiptReference | null;
  deletion: EvidenceReceiptReference | null;
  immutableResidual: EvidenceReceiptReference | null;
  productionReadback: EvidenceReceiptReference | null;
  cacheReadback: EvidenceReceiptReference | null;
  installedClientReadback: EvidenceReceiptReference | null;
  historicalDeliveryReadback: EvidenceReceiptReference | null;
  privateProvenanceReadback: EvidenceReceiptReference | null;
  observedAt: string | null;
}

export interface LegacyRemovalRollback {
  boundary: string;
  rehearsalEvidence: EvidenceReceiptReference | null;
}

export interface LegacyRemovalStopGeneration {
  observedAt: string | null;
  evidencePath: EvidenceReceiptReference | null;
}

export interface LegacyRemovalRecord {
  surfaceId: string;
  path: string;
  /** Hash of the current tracked source. Null means the source is absent. */
  sourceHash: string | null;
  /** Signatures still present in the current source. */
  legacySignatures: string[];
  /** Immutable detection provenance retained after replacement or deletion. */
  detectedSourceHash: string;
  detectedLegacySignatures: string[];
  ownerIssue: `gh#${number}`;
  disposition: BrandDisposition;
  reachability: BrandSurfaceRecord["reachability"];
  criticality: BrandCriticality;
  deliveryState: BrandDeliveryState;
  /** Source-independent snapshot retained after the current source disappears. */
  preservedBinding: LegacyRemovalPreservedBinding;
  sourceState: LegacyRemovalSourceState;
  status: LegacyRemovalStatus;
  evidence: LegacyRemovalEvidence;
  rollback: LegacyRemovalRollback;
  deletionCommit: string | null;
  stopGeneration: LegacyRemovalStopGeneration;
}

export interface LegacyRemovalPreservedBinding {
  surfaceId: string;
  path: string;
  detectedSourceHash: string;
  detectedLegacySignatures: string[];
  ownerIssue: `gh#${number}`;
  disposition: BrandDisposition;
  reachability: BrandSurfaceRecord["reachability"];
  criticality: BrandCriticality;
  deliveryState: BrandDeliveryState;
  rollbackBoundary: string;
}

export interface LegacyRemovalHistoryAnchor {
  sourceCommit: string;
  record: LegacyRemovalRecord;
}

export type LegacyRemovalHistoryAnchorCatalog = ReadonlyMap<string, LegacyRemovalHistoryAnchor>;

export interface LegacyRemovalLedger {
  schemaVersion: typeof LEGACY_REMOVAL_SCHEMA_VERSION;
  designEra: typeof LEGACY_REMOVAL_DESIGN_ERA;
  contractVersion: typeof LEGACY_REMOVAL_CONTRACT_VERSION;
  harnessVersion: typeof LEGACY_REMOVAL_HARNESS_VERSION;
  manifestBaselineSourceCommit: string;
  ownedInputFingerprint: string;
  ownerIssue: "gh#729";
  records: LegacyRemovalRecord[];
}

export interface LegacyRemovalValidationIssue {
  code: string;
  surfaceId?: string;
  message: string;
}

const sha256Pattern = /^[0-9a-f]{64}$/;
const commitPattern = /^[0-9a-f]{7,40}$/;
const stableCompare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const sha256RoundConstants = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(stableCompare);
}

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count));
}

function sha256(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const prior15 = words[index - 15] ?? 0;
      const prior2 = words[index - 2] ?? 0;
      const sigma0 = rotateRight(prior15, 7) ^ rotateRight(prior15, 18) ^ (prior15 >>> 3);
      const sigma1 = rotateRight(prior2, 17) ^ rotateRight(prior2, 19) ^ (prior2 >>> 10);
      words[index] = ((words[index - 16] ?? 0) + sigma0 + (words[index - 7] ?? 0) + sigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e ?? 0, 6) ^ rotateRight(e ?? 0, 11) ^ rotateRight(e ?? 0, 25);
      const choice = ((e ?? 0) & (f ?? 0)) ^ (~(e ?? 0) & (g ?? 0));
      const temporary1 = ((h ?? 0) + sum1 + choice + (sha256RoundConstants[index] ?? 0) + (words[index] ?? 0)) >>> 0;
      const sum0 = rotateRight(a ?? 0, 2) ^ rotateRight(a ?? 0, 13) ^ rotateRight(a ?? 0, 22);
      const majority = ((a ?? 0) & (b ?? 0)) ^ ((a ?? 0) & (c ?? 0)) ^ ((b ?? 0) & (c ?? 0));
      const temporary2 = (sum0 + majority) >>> 0;
      h = g; g = f; f = e; e = ((d ?? 0) + temporary1) >>> 0;
      d = c; c = b; b = a; a = (temporary1 + temporary2) >>> 0;
    }
    const block = [a, b, c, d, e, f, g, h];
    for (let index = 0; index < state.length; index += 1) state[index] = ((state[index] ?? 0) + (block[index] ?? 0)) >>> 0;
  }
  return [...state].map((part) => part.toString(16).padStart(8, "0")).join("");
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return isNonEmpty(value) && !Number.isNaN(Date.parse(value));
}

function emptyEvidence(): LegacyRemovalEvidence {
  return {
    replacement: null,
    deletion: null,
    immutableResidual: null,
    productionReadback: null,
    cacheReadback: null,
    installedClientReadback: null,
    historicalDeliveryReadback: null,
    privateProvenanceReadback: null,
    observedAt: null,
  };
}

function emptyStopGeneration(): LegacyRemovalStopGeneration {
  return { observedAt: null, evidencePath: null };
}

function currentHash(surface: BrandSurfaceRecord): string | null {
  return surface.currentAssetHashes[0] ?? null;
}

function currentState(surface: BrandSurfaceRecord): LegacyRemovalSourceState {
  return surface.legacySignatures.length > 0 ? "present-signaled" : "present-clear";
}

export function isLegacyRemovalCandidate(surface: BrandSurfaceRecord): boolean {
  return surface.legacySignatures.length > 0
    && surface.disposition !== "approved-profile-rule"
    && surface.disposition !== "immutable-external-content";
}

function bindingSnapshot(record: LegacyRemovalRecord): LegacyRemovalPreservedBinding {
  return {
    surfaceId: record.surfaceId,
    path: record.path,
    detectedSourceHash: record.detectedSourceHash,
    detectedLegacySignatures: sortedUnique(record.detectedLegacySignatures),
    ownerIssue: record.ownerIssue,
    disposition: record.disposition,
    reachability: record.reachability,
    criticality: record.criticality,
    deliveryState: record.deliveryState,
    rollbackBoundary: record.rollback?.boundary ?? "",
  };
}

export function legacyRemovalScopedInput(record: LegacyRemovalRecord): string {
  const canonicalInput = {
    surfaceId: record.surfaceId,
    path: record.path,
    sourceHash: record.sourceHash,
    legacySignatures: sortedUnique(record.legacySignatures),
    detectedSourceHash: record.detectedSourceHash,
    detectedLegacySignatures: sortedUnique(record.detectedLegacySignatures),
    ownerIssue: record.ownerIssue,
    disposition: record.disposition,
    reachability: record.reachability,
    criticality: record.criticality,
    deliveryState: record.deliveryState,
    sourceState: record.sourceState,
    rollbackBoundary: record.rollback?.boundary ?? "",
  };
  return JSON.stringify(canonicalInput);
}

export function legacyRemovalScopedInputFingerprint(record: LegacyRemovalRecord): string {
  return sha256(legacyRemovalScopedInput(record));
}

function historyAnchorMatches(
  record: LegacyRemovalRecord,
  anchor: LegacyRemovalHistoryAnchor | undefined,
): boolean | null {
  if (!anchor) return null;
  if (!commitPattern.test(anchor.sourceCommit)
    || anchor.record.surfaceId !== record.surfaceId
    || anchor.record.sourceState === "absent"
    || !sha256Pattern.test(anchor.record.sourceHash ?? "")) return false;
  return JSON.stringify(bindingSnapshot(record)) === JSON.stringify(bindingSnapshot(anchor.record));
}

function bindingMatches(record: LegacyRemovalRecord, surface: BrandSurfaceRecord | undefined): boolean {
  if (!Array.isArray(record.legacySignatures) || !Array.isArray(record.detectedLegacySignatures)) return false;
  if (JSON.stringify(record.preservedBinding) !== JSON.stringify(bindingSnapshot(record))) return false;
  if (!surface) {
    return record.sourceState === "absent"
      && record.sourceHash === null
      && record.legacySignatures.length === 0
      && isNonEmpty(record.path)
      && isNonEmpty(record.ownerIssue)
      && isNonEmpty(record.rollback?.boundary);
  }
  return record.path === surface.paths[0]
    && record.sourceHash === currentHash(surface)
    && JSON.stringify(record.legacySignatures) === JSON.stringify(sortedUnique(surface.legacySignatures))
    && record.ownerIssue === surface.ownerIssue
    && record.disposition === surface.disposition
    && record.reachability === surface.reachability
    && record.criticality === surface.criticality
    && record.deliveryState === surface.deliveryState
    && record.sourceState === currentState(surface)
    && record.rollback?.boundary === surface.rollbackBoundary;
}

function resetRecord(
  surfaceId: string,
  existing: LegacyRemovalRecord | undefined,
  surface: BrandSurfaceRecord | undefined,
): LegacyRemovalRecord {
  const currentSignatures = surface ? sortedUnique(surface.legacySignatures) : [];
  const detectedLegacySignatures = sortedUnique([
    ...(existing?.detectedLegacySignatures ?? []),
    ...(existing?.legacySignatures ?? []),
    ...currentSignatures,
  ]);
  const detectedSourceHash = existing?.detectedSourceHash
    ?? existing?.sourceHash
    ?? (surface ? currentHash(surface) : null)
    ?? "";
  const record = {
    surfaceId,
    path: surface?.paths[0] ?? existing?.path ?? "",
    sourceHash: surface ? currentHash(surface) : null,
    legacySignatures: currentSignatures,
    detectedSourceHash,
    detectedLegacySignatures,
    ownerIssue: surface?.ownerIssue ?? existing?.ownerIssue ?? "gh#729",
    disposition: surface?.disposition ?? existing?.disposition ?? "replace-active",
    reachability: surface?.reachability ?? existing?.reachability ?? "internal",
    criticality: surface?.criticality ?? existing?.criticality ?? "utility",
    deliveryState: surface?.deliveryState ?? existing?.deliveryState ?? "private-provenance",
    preservedBinding: {} as LegacyRemovalPreservedBinding,
    sourceState: surface ? currentState(surface) : "absent",
    status: "open",
    evidence: emptyEvidence(),
    rollback: {
      boundary: surface?.rollbackBoundary ?? existing?.rollback?.boundary ?? "git-revert",
      rehearsalEvidence: null,
    },
    deletionCommit: null,
    stopGeneration: emptyStopGeneration(),
  } satisfies LegacyRemovalRecord;
  record.preservedBinding = bindingSnapshot(record);
  return record;
}

function asExistingRecords(value: unknown): LegacyRemovalRecord[] {
  if (!value || typeof value !== "object") return [];
  const records = (value as { records?: unknown }).records;
  return Array.isArray(records) ? records.filter((record): record is LegacyRemovalRecord => Boolean(record && typeof record === "object")) : [];
}

/**
 * Reconciles generated source bindings while preserving only decisions whose
 * exact source, signal, owner, disposition, and rollback boundary remain
 * current. A source change always returns to open; it never implies success.
 */
export function reconcileLegacyRemovalLedger(
  manifest: BrandSurfaceManifest,
  existingValue: unknown,
): LegacyRemovalLedger {
  const existingLedger = existingValue && typeof existingValue === "object"
    ? existingValue as Partial<LegacyRemovalLedger>
    : null;
  const mayPreserveDecisions = existingLedger?.schemaVersion === LEGACY_REMOVAL_SCHEMA_VERSION
    && existingLedger.designEra === LEGACY_REMOVAL_DESIGN_ERA
    && existingLedger.contractVersion === LEGACY_REMOVAL_CONTRACT_VERSION
    && existingLedger.harnessVersion === LEGACY_REMOVAL_HARNESS_VERSION;
  const existingRecords = asExistingRecords(existingValue);
  const existingById = new Map(existingRecords.map((record) => [record.surfaceId, record]));
  const surfaceById = new Map(manifest.surfaces.map((surface) => [surface.id, surface]));
  const ids = new Set(existingRecords
    .filter((record) => {
      const surface = surfaceById.get(record.surfaceId);
      return !surface || surface.legacySignatures.length === 0 || isLegacyRemovalCandidate(surface);
    })
    .map((record) => record.surfaceId));
  for (const surface of manifest.surfaces) {
    if (isLegacyRemovalCandidate(surface)) ids.add(surface.id);
  }

  const records = [...ids].map((surfaceId) => {
    const existing = existingById.get(surfaceId);
    const surface = surfaceById.get(surfaceId);
    if (mayPreserveDecisions && existing && bindingMatches(existing, surface)) {
      return structuredClone(existing);
    }
    return resetRecord(surfaceId, existing, surface);
  }).sort((left, right) => stableCompare(`${left.path}:${left.surfaceId}`, `${right.path}:${right.surfaceId}`));

  return {
    schemaVersion: LEGACY_REMOVAL_SCHEMA_VERSION,
    designEra: LEGACY_REMOVAL_DESIGN_ERA,
    contractVersion: LEGACY_REMOVAL_CONTRACT_VERSION,
    harnessVersion: LEGACY_REMOVAL_HARNESS_VERSION,
    manifestBaselineSourceCommit: manifest.baselineSourceCommit,
    ownedInputFingerprint: manifest.ownedInputFingerprint,
    ownerIssue: "gh#729",
    records,
  };
}

function add(
  issues: LegacyRemovalValidationIssue[],
  code: string,
  message: string,
  surfaceId?: string,
): void {
  issues.push(surfaceId ? { code, surfaceId, message } : { code, message });
}

function hasOnlyNullEvidence(record: LegacyRemovalRecord): boolean {
  return Object.values(record.evidence).every((value) => value === null)
    && record.rollback.rehearsalEvidence === null
    && record.deletionCommit === null
    && record.stopGeneration.observedAt === null
    && record.stopGeneration.evidencePath === null;
}

export function validateLegacyRemovalLedger(
  manifest: BrandSurfaceManifest,
  value: unknown,
  receiptCatalog: EvidenceReceiptCatalog,
  historyAnchors: LegacyRemovalHistoryAnchorCatalog = new Map(),
): LegacyRemovalValidationIssue[] {
  const issues: LegacyRemovalValidationIssue[] = [];
  if (!value || typeof value !== "object") {
    return [{ code: "ledger-not-object", message: "Legacy removal ledger must be an object." }];
  }
  const ledger = value as Partial<LegacyRemovalLedger>;
  if (ledger.schemaVersion !== LEGACY_REMOVAL_SCHEMA_VERSION) add(issues, "schema-version", "Legacy removal schema version is not supported.");
  if (ledger.designEra !== LEGACY_REMOVAL_DESIGN_ERA) add(issues, "design-era", "Legacy removal ledger is not pinned to Quiet authority.");
  if (ledger.contractVersion !== LEGACY_REMOVAL_CONTRACT_VERSION) add(issues, "contract-version", "Legacy removal ledger has a stale design-contract version.");
  if (ledger.harnessVersion !== LEGACY_REMOVAL_HARNESS_VERSION) add(issues, "harness-version", "Legacy removal ledger has a stale harness version.");
  if (ledger.manifestBaselineSourceCommit !== manifest.baselineSourceCommit) add(issues, "manifest-source-stale", "Legacy removal ledger source commit does not match the surface manifest.");
  if (ledger.ownedInputFingerprint !== manifest.ownedInputFingerprint) add(issues, "manifest-fingerprint-stale", "Legacy removal ledger fingerprint does not match the surface manifest.");
  if (ledger.ownerIssue !== "gh#729") add(issues, "owner-issue", "Legacy removal ledger must remain owned by #729.");
  if (!Array.isArray(ledger.records)) return [...issues, { code: "records-not-array", message: "Legacy removal records must be an array." }];

  const surfaceById = new Map(manifest.surfaces.map((surface) => [surface.id, surface]));
  const recordsById = new Map<string, LegacyRemovalRecord>();
  for (const raw of ledger.records) {
    if (!raw || typeof raw !== "object") {
      add(issues, "record-not-object", "Every legacy removal record must be an object.");
      continue;
    }
    const record = raw as LegacyRemovalRecord;
    if (recordsById.has(record.surfaceId)) add(issues, "duplicate-surface", "A surface may appear only once in the removal ledger.", record.surfaceId);
    recordsById.set(record.surfaceId, record);
    const surface = surfaceById.get(record.surfaceId);
    if (surface && surface.legacySignatures.length > 0 && !isLegacyRemovalCandidate(surface)) add(issues, "approved-profile-in-ledger", "Approved profile rules and immutable external content do not belong in the removal ledger.", record.surfaceId);
    if (!bindingMatches(record, surface)) add(issues, "source-binding-stale", "Source hash, signatures, owner, disposition, state, path, or rollback boundary is stale. Rebuild to reset this row to open.", record.surfaceId);
    if (!isNonEmpty(record.path)) add(issues, "path-missing", "Removal record path is required.", record.surfaceId);
    if (record.sourceHash !== null && !sha256Pattern.test(record.sourceHash)) add(issues, "source-hash", "Current source hash must be SHA-256 or null for an absent source.", record.surfaceId);
    if (!sha256Pattern.test(record.detectedSourceHash)) add(issues, "detected-source-hash", "Detection source hash must be SHA-256.", record.surfaceId);
    if (!Array.isArray(record.legacySignatures) || !Array.isArray(record.detectedLegacySignatures) || record.detectedLegacySignatures.length === 0) add(issues, "signatures", "Every row must retain at least one detected legacy signature.", record.surfaceId);
    if (!record.ownerIssue?.startsWith("gh#")) add(issues, "record-owner", "Every row needs its exact manifest owner.", record.surfaceId);
    if (!["public", "authenticated", "internal", "generated", "external"].includes(record.reachability)) add(issues, "reachability", "Every row needs its bound manifest reachability.", record.surfaceId);
    if (!brandCriticalities.includes(record.criticality)) add(issues, "criticality", "Every row needs its bound manifest criticality.", record.surfaceId);
    if (!brandDeliveryStates.includes(record.deliveryState)) add(issues, "delivery-state", "Every row needs its bound manifest delivery state.", record.surfaceId);
    if (!record.preservedBinding || typeof record.preservedBinding !== "object") add(issues, "preserved-binding", "Every row needs its source-independent ownership and delivery snapshot.", record.surfaceId);
    if (!legacyRemovalStatuses.includes(record.status)) add(issues, "status", `Unknown legacy removal status: ${String(record.status)}.`, record.surfaceId);
    const evidenceShaped = Boolean(record.evidence && typeof record.evidence === "object");
    const rollbackShaped = Boolean(record.rollback && typeof record.rollback === "object" && isNonEmpty(record.rollback.boundary));
    const stopGenerationShaped = Boolean(record.stopGeneration && typeof record.stopGeneration === "object");
    if (!evidenceShaped) add(issues, "evidence-shape", "Every row needs the evidence object.", record.surfaceId);
    if (!rollbackShaped) add(issues, "rollback-shape", "Every row needs its exact rollback boundary.", record.surfaceId);
    if (!stopGenerationShaped) add(issues, "stop-generation-shape", "Every row needs the stop-generation object.", record.surfaceId);
    if (!evidenceShaped || !rollbackShaped || !stopGenerationShaped) continue;
    if (record.status === "open" && !hasOnlyNullEvidence(record)) add(issues, "open-with-proof", "An open row cannot retain proof from an invalidated decision.", record.surfaceId);

    if (record.sourceState === "absent" || record.status === "deleted") {
      const historyMatch = historyAnchorMatches(record, historyAnchors.get(record.surfaceId));
      if (historyMatch === false) {
        add(issues, "history-binding-stale", "The tombstone ownership, disposition, reachability, criticality, delivery state, provenance, path, or rollback boundary differs from its last committed source-present record.", record.surfaceId);
      }
      if (historyMatch === null && record.status !== "open") {
        add(issues, "history-anchor-missing", "A resolved tombstone needs an earlier committed source-present ledger record as its independent ownership anchor.", record.surfaceId);
      }
    }

    if (record.status !== "open") {
      if (!isIsoDate(record.evidence.observedAt)) add(issues, "observed-at", "A resolved row needs an ISO evidence timestamp.", record.surfaceId);
      if (record.rollback.rehearsalEvidence === null) add(issues, "rollback-proof", "A resolved row needs a committed rollback rehearsal receipt.", record.surfaceId);
      validateDeliveryStateProof(issues, record);
    }
    if (record.status === "replacement-verified") {
      if (record.sourceState !== "present-clear" || record.legacySignatures.length > 0) add(issues, "replacement-still-signaled", "Replacement verification requires a present source with no current legacy signals.", record.surfaceId);
      if (record.evidence.replacement === null) add(issues, "replacement-proof", "Replacement verification needs a committed replacement receipt.", record.surfaceId);
      if (!record.deletionCommit || !commitPattern.test(record.deletionCommit)) add(issues, "replacement-commit", "Replacement verification needs the removing commit SHA.", record.surfaceId);
    }
    if (record.status === "stop-generation-verified") {
      if (record.sourceState === "present-signaled") add(issues, "generation-still-signaled", "Stop-generation verification cannot leave an active signaled source.", record.surfaceId);
      if (!isIsoDate(record.stopGeneration.observedAt) || record.stopGeneration.evidencePath === null) add(issues, "stop-generation-proof", "Stop-generation verification needs a timestamp and committed receipt.", record.surfaceId);
      if (!record.deletionCommit || !commitPattern.test(record.deletionCommit)) add(issues, "stop-generation-commit", "Stop-generation verification needs the stopping commit SHA.", record.surfaceId);
    }
    if (record.status === "deleted") {
      if (record.sourceState !== "absent") add(issues, "deleted-source-present", "Deleted status requires the tracked source to be absent.", record.surfaceId);
      if (record.evidence.deletion === null) add(issues, "deletion-proof", "Deleted status needs a committed deletion receipt.", record.surfaceId);
      if (!record.deletionCommit || !commitPattern.test(record.deletionCommit)) add(issues, "deletion-commit", "Deleted status needs the deleting commit SHA.", record.surfaceId);
    }
    if (record.status === "immutable-residual") {
      if (record.disposition !== "immutable-external-content" && record.disposition !== "historical-git-only") add(issues, "residual-disposition", "Immutable residual is restricted to immutable external content or historical Git-only records.", record.surfaceId);
      if (record.evidence.immutableResidual === null) add(issues, "residual-proof", "Immutable residual needs a committed residual receipt.", record.surfaceId);
    }
    const receiptFields: Array<[EvidenceReceiptReference | null, EvidenceReceiptProofKind]> = [
      [record.evidence.replacement, "replacement"],
      [record.evidence.deletion, "deletion"],
      [record.evidence.immutableResidual, "immutable-residual"],
      [record.evidence.productionReadback, "production-readback"],
      [record.evidence.cacheReadback, "cache-readback"],
      [record.evidence.installedClientReadback, "installed-client-readback"],
      [record.evidence.historicalDeliveryReadback, "historical-delivery-readback"],
      [record.evidence.privateProvenanceReadback, "private-provenance-readback"],
      [record.rollback.rehearsalEvidence, "rollback-rehearsal"],
      [record.stopGeneration.evidencePath, "stop-generation"],
    ];
    for (const [reference, proofKind] of receiptFields) {
      if (reference !== null) addReceiptIssues(issues, reference, receiptCatalog, record, proofKind);
    }
  }

  for (const surface of manifest.surfaces) {
    if (isLegacyRemovalCandidate(surface) && !recordsById.has(surface.id)) add(issues, "signaled-surface-missing", `Signaled surface is missing from the ledger: ${surface.paths[0]}.`, surface.id);
  }
  const ordered = [...ledger.records].sort((left, right) => stableCompare(`${left.path}:${left.surfaceId}`, `${right.path}:${right.surfaceId}`));
  if (JSON.stringify(ordered) !== JSON.stringify(ledger.records)) add(issues, "record-order", "Removal records must use deterministic path and surface ID ordering.");
  return issues;
}

function validateDeliveryStateProof(
  issues: LegacyRemovalValidationIssue[],
  record: LegacyRemovalRecord,
): void {
  if (record.deliveryState === "controlled-current" && record.evidence.productionReadback === null) {
    add(issues, "controlled-current-readback", "Controlled current removal needs a production readback receipt, including when source is deleted.", record.surfaceId);
  }
  if (record.deliveryState === "revocable-public") {
    if (record.evidence.productionReadback === null) add(issues, "revocable-public-readback", "Revocable public removal needs a production readback receipt.", record.surfaceId);
    if (record.evidence.cacheReadback === null) add(issues, "revocable-public-cache", "Revocable public removal needs a cache expiry or purge readback receipt.", record.surfaceId);
  }
  if (record.deliveryState === "installed-client" && record.evidence.installedClientReadback === null) {
    add(issues, "installed-client-readback", "Installed client removal needs an installed-build readback receipt.", record.surfaceId);
  }
  if (record.deliveryState === "delivered-historical" && record.evidence.historicalDeliveryReadback === null) {
    add(issues, "historical-delivery-readback", "Delivered historical removal needs a receipt describing the retained delivered copies.", record.surfaceId);
  }
  if (record.deliveryState === "private-provenance" && record.evidence.privateProvenanceReadback === null) {
    add(issues, "private-provenance-readback", "Private provenance removal needs a quarantine or access readback receipt.", record.surfaceId);
  }
}

function addReceiptIssues(
  issues: LegacyRemovalValidationIssue[],
  reference: EvidenceReceiptReference,
  receiptCatalog: EvidenceReceiptCatalog,
  record: LegacyRemovalRecord,
  proofKind: EvidenceReceiptProofKind,
): void {
  for (const issue of validateEvidenceReceiptReference(reference, {
    domain: "legacy-removal",
    subjectId: record.surfaceId,
    proofKinds: [proofKind],
    scopedInputFingerprint: legacyRemovalScopedInputFingerprint(record),
  }, receiptCatalog)) {
    add(issues, issue.code, issue.message, record.surfaceId);
  }
}

export function openLegacyRemovalRecords(ledger: LegacyRemovalLedger): LegacyRemovalRecord[] {
  return ledger.records.filter((record) => record.status === "open");
}
