import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  openLegacyRemovalRecords,
  isLegacyRemovalCandidate,
  legacyRemovalScopedInput,
  legacyRemovalScopedInputFingerprint,
  reconcileLegacyRemovalLedger,
  validateLegacyRemovalLedger,
  type LegacyRemovalHistoryAnchorCatalog,
  type LegacyRemovalLedger,
  type LegacyRemovalRecord,
} from "../packages/design/src/legacy-removal.ts";
import { loadLegacyRemovalHistoryAnchors } from "./brand-legacy-removal-ledger.mts";
import type {
  EvidenceReceiptCatalog,
  EvidenceReceiptCatalogEntry,
  EvidenceReceiptProofKind,
  EvidenceReceiptReference,
  EvidenceArtifactReference,
} from "../packages/design/src/evidence-receipts.ts";
import type { BrandSurfaceManifest } from "../packages/design/src/surfaces.ts";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "docs/homa-design/evidence/surfaces.json"), "utf8")) as BrandSurfaceManifest;
const ledger = JSON.parse(readFileSync(resolve(root, "docs/homa-design/evidence/legacy-removal.json"), "utf8")) as LegacyRemovalLedger;

function recordFor(candidate: LegacyRemovalLedger, surfaceId: string): LegacyRemovalRecord {
  const record = candidate.records.find((entry) => entry.surfaceId === surfaceId);
  assert.ok(record, `missing removal record ${surfaceId}`);
  return record;
}

function historyAnchorFor(record: LegacyRemovalRecord): LegacyRemovalHistoryAnchorCatalog {
  return new Map([[record.surfaceId, {
    sourceCommit: "1234567890abcdef",
    record: structuredClone(record),
  }]]);
}

function receipt(
  record: LegacyRemovalRecord,
  proofKind: EvidenceReceiptProofKind,
  catalog: Map<string, EvidenceReceiptCatalogEntry>,
): EvidenceReceiptReference {
  const suffix = `${record.surfaceId.replace("surface:", "")}:${proofKind}`;
  const reference: EvidenceReceiptReference = {
    id: `receipt:legacy-removal:${suffix}`,
    path: `docs/homa-design/evidence/receipts/${suffix.replaceAll(":", "-")}.json`,
    sha256: "a".repeat(64),
  };
  const underlyingProof: EvidenceArtifactReference = {
    kind: "artifact",
    path: `docs/homa-design/evidence/artifacts/${suffix.replaceAll(":", "-")}.json`,
    sha256: "b".repeat(64),
  };
  catalog.set(reference.id, {
    reference,
    actualSha256: reference.sha256,
    envelope: {
      schemaVersion: 2,
      id: reference.id,
      domain: "legacy-removal",
      subjectId: record.surfaceId,
      proofKind,
      scopedInputFingerprint: legacyRemovalScopedInputFingerprint(record),
      underlyingProof,
      observedAt: "2026-08-04T12:00:00.000Z",
      environment: "test-production-readback",
      observer: "independent critic",
      notes: "Synthetic contract fixture for validator behavior.",
    },
    committed: true,
    underlyingProof: {
      reference: underlyingProof,
      actualSha256: underlyingProof.sha256,
      committed: true,
      attestation: null,
      authenticated: true,
    },
  });
  return reference;
}

function addDeliveryStateProof(record: LegacyRemovalRecord, catalog: Map<string, EvidenceReceiptCatalogEntry>): void {
  if (record.deliveryState === "controlled-current") record.evidence.productionReadback = receipt(record, "production-readback", catalog);
  if (record.deliveryState === "revocable-public") {
    record.evidence.productionReadback = receipt(record, "production-readback", catalog);
    record.evidence.cacheReadback = receipt(record, "cache-readback", catalog);
  }
  if (record.deliveryState === "installed-client") record.evidence.installedClientReadback = receipt(record, "installed-client-readback", catalog);
  if (record.deliveryState === "delivered-historical") record.evidence.historicalDeliveryReadback = receipt(record, "historical-delivery-readback", catalog);
  if (record.deliveryState === "private-provenance") record.evidence.privateProvenanceReadback = receipt(record, "private-provenance-readback", catalog);
}

function markReplacementVerified(record: LegacyRemovalRecord, catalog: Map<string, EvidenceReceiptCatalogEntry>): void {
  record.status = "replacement-verified";
  record.evidence.replacement = receipt(record, "replacement", catalog);
  record.evidence.observedAt = "2026-08-04T12:00:00.000Z";
  record.rollback.rehearsalEvidence = receipt(record, "rollback-rehearsal", catalog);
  addDeliveryStateProof(record, catalog);
  record.deletionCommit = "abcdef1234567890";
}

test("committed ledger binds every removal candidate and keeps unresolved history open", () => {
  const signaled = manifest.surfaces.filter(isLegacyRemovalCandidate);
  assert.ok(signaled.length > 0);
  assert.ok(ledger.records.length >= signaled.length);
  assert.equal(openLegacyRemovalRecords(ledger).length, ledger.records.length);
  assert.deepEqual(validateLegacyRemovalLedger(manifest, ledger, new Map()), []);
  for (const surface of signaled) {
    const record = recordFor(ledger, surface.id);
    assert.equal(record.path, surface.paths[0]);
    assert.equal(record.sourceHash, surface.currentAssetHashes[0]);
    assert.deepEqual(record.legacySignatures, [...surface.legacySignatures].sort());
    assert.equal(record.ownerIssue, surface.ownerIssue);
    assert.equal(record.disposition, surface.disposition);
  }
  assert.ok(manifest.surfaces
    .filter((surface) => surface.legacySignatures.length > 0 && !isLegacyRemovalCandidate(surface))
    .every((surface) => !ledger.records.some((record) => record.surfaceId === surface.id)));
  assert.ok(ledger.records
    .filter((record) => !signaled.some((surface) => surface.id === record.surfaceId))
    .every((record) => record.sourceState !== "present-signaled" && record.detectedLegacySignatures.length > 0));
});

test("reconciliation is byte-stable and never promotes an unchanged open row", () => {
  const first = reconcileLegacyRemovalLedger(manifest, ledger);
  const second = reconcileLegacyRemovalLedger(manifest, first);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.ok(second.records.every((record) => record.status === "open"));
});

test("the portable removal fingerprint matches the Node SHA-256 reference", () => {
  const record = ledger.records[0]!;
  const expected = createHash("sha256").update(legacyRemovalScopedInput(record)).digest("hex");
  assert.equal(legacyRemovalScopedInputFingerprint(record), expected);
});

test("a cleared source resets open before an explicit replacement decision can survive", () => {
  const changedManifest = structuredClone(manifest) as BrandSurfaceManifest;
  const surface = changedManifest.surfaces.find((candidate) => candidate.legacySignatures.length > 0)!;
  surface.currentAssetHashes = ["f".repeat(64)];
  surface.legacySignatures = [];
  changedManifest.ownedInputFingerprint = "e".repeat(64);

  const reset = reconcileLegacyRemovalLedger(changedManifest, ledger);
  const resetRecord = recordFor(reset, surface.id);
  assert.equal(resetRecord.status, "open");
  assert.equal(resetRecord.sourceState, "present-clear");
  assert.deepEqual(resetRecord.legacySignatures, []);
  assert.ok(resetRecord.detectedLegacySignatures.length > 0);

  const catalog = new Map<string, EvidenceReceiptCatalogEntry>();
  markReplacementVerified(resetRecord, catalog);
  const preserved = reconcileLegacyRemovalLedger(changedManifest, reset);
  assert.equal(recordFor(preserved, surface.id).status, "replacement-verified");
  assert.deepEqual(validateLegacyRemovalLedger(changedManifest, preserved, catalog), []);
});

test("each exact binding field independently invalidates prior proof", () => {
  const clearManifest = structuredClone(manifest) as BrandSurfaceManifest;
  const surface = clearManifest.surfaces.find(isLegacyRemovalCandidate)!;
  surface.currentAssetHashes = ["a".repeat(64)];
  surface.legacySignatures = [];
  clearManifest.ownedInputFingerprint = "b".repeat(64);
  const prepared = reconcileLegacyRemovalLedger(clearManifest, ledger);
  markReplacementVerified(recordFor(prepared, surface.id), new Map());

  const mutations: Array<[string, (candidate: BrandSurfaceManifest["surfaces"][number]) => void]> = [
    ["path", (candidate) => { candidate.paths = [`${candidate.paths[0]}.moved`]; }],
    ["source hash", (candidate) => { candidate.currentAssetHashes = ["d".repeat(64)]; }],
    ["signature", (candidate) => { candidate.legacySignatures = ["legacy-new-signal"]; }],
    ["owner", (candidate) => { candidate.ownerIssue = "gh#999"; }],
    ["disposition", (candidate) => { candidate.disposition = "regenerate-derived"; }],
    ["reachability", (candidate) => { candidate.reachability = "external"; }],
    ["criticality", (candidate) => { candidate.criticality = candidate.criticality === "utility" ? "supporting" : "utility"; }],
    ["delivery state", (candidate) => { candidate.deliveryState = candidate.deliveryState === "controlled-current" ? "installed-client" : "controlled-current"; }],
    ["rollback", (candidate) => { candidate.rollbackBoundary = "new-release-boundary"; }],
  ];
  for (const [label, mutate] of mutations) {
    const drifted = structuredClone(clearManifest) as BrandSurfaceManifest;
    const driftedSurface = drifted.surfaces.find((candidate) => candidate.id === surface.id)!;
    mutate(driftedSurface);
    const reset = reconcileLegacyRemovalLedger(drifted, prepared);
    const record = recordFor(reset, surface.id);
    assert.equal(record.status, "open", `${label} drift did not reset status`);
    assert.equal(record.evidence.replacement, null, `${label} drift retained evidence`);
    assert.equal(record.deletionCommit, null, `${label} drift retained deletion commit`);
  }
});

test("source disappearance remains open until deletion is explicitly evidenced", () => {
  const changedManifest = structuredClone(manifest) as BrandSurfaceManifest;
  const removed = changedManifest.surfaces.find((candidate) => candidate.legacySignatures.length > 0)!;
  changedManifest.surfaces = changedManifest.surfaces.filter((surface) => surface.id !== removed.id);
  changedManifest.ownedInputFingerprint = "c".repeat(64);

  const reset = reconcileLegacyRemovalLedger(changedManifest, ledger);
  const record = recordFor(reset, removed.id);
  assert.equal(record.status, "open");
  assert.equal(record.sourceState, "absent");
  assert.equal(record.sourceHash, null);

  record.status = "deleted";
  const catalog = new Map<string, EvidenceReceiptCatalogEntry>();
  record.evidence.deletion = receipt(record, "deletion", catalog);
  record.evidence.observedAt = "2026-08-04T12:00:00.000Z";
  record.rollback.rehearsalEvidence = receipt(record, "rollback-rehearsal", catalog);
  addDeliveryStateProof(record, catalog);
  record.deletionCommit = "abcdef1234567890";
  const preserved = reconcileLegacyRemovalLedger(changedManifest, reset);
  assert.equal(recordFor(preserved, removed.id).status, "deleted");
  assert.deepEqual(validateLegacyRemovalLedger(changedManifest, preserved, catalog, historyAnchorFor(recordFor(ledger, removed.id))), []);
});

test("an absent source retains and authenticates its full source-present history binding", () => {
  const changedManifest = structuredClone(manifest) as BrandSurfaceManifest;
  const removed = changedManifest.surfaces.find(isLegacyRemovalCandidate)!;
  changedManifest.surfaces = changedManifest.surfaces.filter((surface) => surface.id !== removed.id);
  changedManifest.ownedInputFingerprint = "1".repeat(64);
  const absent = reconcileLegacyRemovalLedger(changedManifest, ledger);
  const anchor = historyAnchorFor(recordFor(ledger, removed.id));
  const fields: Array<keyof Pick<LegacyRemovalRecord, "path" | "ownerIssue" | "disposition" | "reachability" | "criticality" | "deliveryState">> = [
    "path",
    "ownerIssue",
    "disposition",
    "reachability",
    "criticality",
    "deliveryState",
  ];
  for (const field of fields) {
    const invalid = structuredClone(absent) as LegacyRemovalLedger;
    const record = recordFor(invalid, removed.id);
    (record as unknown as Record<string, string>)[field] = `tampered-${field}`;
    (record.preservedBinding as unknown as Record<string, string>)[field] = `tampered-${field}`;
    const codes = validateLegacyRemovalLedger(changedManifest, invalid, new Map(), anchor).map((issue) => issue.code);
    assert.ok(!codes.includes("source-binding-stale"), `${field} mutation did not reproduce the self-snapshot exploit`);
    assert.ok(codes.includes("history-binding-stale"), `${field} was not bound to committed history`);
  }
  const invalidRollback = structuredClone(absent) as LegacyRemovalLedger;
  const rollbackRecord = recordFor(invalidRollback, removed.id);
  rollbackRecord.rollback.boundary = "tampered-boundary";
  rollbackRecord.preservedBinding.rollbackBoundary = "tampered-boundary";
  const rollbackCodes = validateLegacyRemovalLedger(changedManifest, invalidRollback, new Map(), anchor).map((issue) => issue.code);
  assert.ok(!rollbackCodes.includes("source-binding-stale"));
  assert.ok(rollbackCodes.includes("history-binding-stale"));
});

test("a tombstone without source-present committed history may stay open but cannot resolve", () => {
  const changedManifest = structuredClone(manifest) as BrandSurfaceManifest;
  const removed = changedManifest.surfaces.find(isLegacyRemovalCandidate)!;
  changedManifest.surfaces = changedManifest.surfaces.filter((surface) => surface.id !== removed.id);
  changedManifest.ownedInputFingerprint = "2".repeat(64);
  const candidate = reconcileLegacyRemovalLedger(changedManifest, ledger);
  assert.ok(!validateLegacyRemovalLedger(changedManifest, candidate, new Map()).some((issue) => issue.code === "history-anchor-missing"));

  const record = recordFor(candidate, removed.id);
  const catalog = new Map<string, EvidenceReceiptCatalogEntry>();
  record.status = "deleted";
  record.evidence.deletion = receipt(record, "deletion", catalog);
  record.evidence.observedAt = "2026-08-04T12:00:00.000Z";
  record.rollback.rehearsalEvidence = receipt(record, "rollback-rehearsal", catalog);
  addDeliveryStateProof(record, catalog);
  record.deletionCommit = "abcdef1234567890";
  assert.ok(validateLegacyRemovalLedger(changedManifest, candidate, catalog).some((issue) => issue.code === "history-anchor-missing"));
});

test("history loading skips mutable absent snapshots and uses the last source-present commit", () => {
  const record = ledger.records.find(isRecordWithPresentSource)!;
  const absent = structuredClone(record);
  absent.sourceState = "absent";
  absent.sourceHash = null;
  absent.legacySignatures = [];
  const currentBytes = JSON.stringify({ records: [absent] });
  const calls: string[][] = [];
  const git = (args: readonly string[]): string | null => {
    calls.push([...args]);
    if (args[0] === "show" && args[1]?.startsWith("HEAD:")) return currentBytes;
    if (args[0] === "rev-list") return `${"b".repeat(40)}\n${"a".repeat(40)}\n`;
    if (args[0] === "show" && args[1]?.startsWith("b".repeat(40))) return JSON.stringify({ records: [absent] });
    if (args[0] === "show" && args[1]?.startsWith("a".repeat(40))) return JSON.stringify({ records: [record] });
    return null;
  };
  const anchors = loadLegacyRemovalHistoryAnchors(currentBytes, git);
  assert.deepEqual(calls[1]?.slice(0, 2), ["rev-list", "HEAD^"]);
  assert.equal(anchors.get(record.surfaceId)?.sourceCommit, "a".repeat(40));
  assert.equal(anchors.get(record.surfaceId)?.record.sourceState, "present-signaled");
});

test("history loading includes HEAD for an uncommitted local ledger change", () => {
  const record = ledger.records.find(isRecordWithPresentSource)!;
  const currentBytes = JSON.stringify({ records: [] });
  const headBytes = JSON.stringify({ records: [record] });
  const calls: string[][] = [];
  const git = (args: readonly string[]): string | null => {
    calls.push([...args]);
    if (args[0] === "show" && args[1]?.startsWith("HEAD:")) return headBytes;
    if (args[0] === "rev-list") return `${"c".repeat(40)}\n`;
    if (args[0] === "show" && args[1]?.startsWith("c".repeat(40))) return headBytes;
    return null;
  };
  const anchors = loadLegacyRemovalHistoryAnchors(currentBytes, git);
  assert.deepEqual(calls[1]?.slice(0, 2), ["rev-list", "HEAD"]);
  assert.equal(anchors.get(record.surfaceId)?.sourceCommit, "c".repeat(40));
});

function isRecordWithPresentSource(record: LegacyRemovalRecord): boolean {
  return record.sourceState !== "absent" && record.sourceHash !== null;
}

test("a resolved claim fails closed when its source still carries a legacy signature", () => {
  const invalid = structuredClone(ledger) as LegacyRemovalLedger;
  const record = invalid.records[0]!;
  markReplacementVerified(record, new Map());
  const codes = validateLegacyRemovalLedger(manifest, invalid, new Map()).map((issue) => issue.code);
  assert.ok(codes.includes("replacement-still-signaled"));
});

test("malformed evidence reports a contract issue instead of crashing the audit", () => {
  const invalid = structuredClone(ledger) as LegacyRemovalLedger;
  delete (invalid.records[0] as Partial<LegacyRemovalRecord>).evidence;
  assert.doesNotThrow(() => validateLegacyRemovalLedger(manifest, invalid, new Map()));
  assert.ok(validateLegacyRemovalLedger(manifest, invalid, new Map()).some((issue) => issue.code === "evidence-shape"));
});

test("fabricated legacy receipt paths and checksums cannot resolve a row", () => {
  const clearManifest = structuredClone(manifest) as BrandSurfaceManifest;
  const surface = clearManifest.surfaces.find(isLegacyRemovalCandidate)!;
  surface.currentAssetHashes = ["b".repeat(64)];
  surface.legacySignatures = [];
  clearManifest.ownedInputFingerprint = "c".repeat(64);
  const prepared = reconcileLegacyRemovalLedger(clearManifest, ledger);
  const record = recordFor(prepared, surface.id);
  const catalog = new Map<string, EvidenceReceiptCatalogEntry>();
  markReplacementVerified(record, catalog);
  const claimed = record.evidence.replacement!;
  const registered = catalog.get(claimed.id)!;
  record.evidence.replacement = {
    ...claimed,
    path: "docs/homa-design/evidence/receipts/fabricated.json",
    sha256: "f".repeat(64),
  };
  const codes = validateLegacyRemovalLedger(clearManifest, prepared, catalog).map((issue) => issue.code);
  assert.equal(registered.committed, true);
  assert.ok(codes.includes("receipt-path-mismatch"));
  assert.ok(codes.includes("receipt-checksum-mismatch"));
});

test("a committed receipt cannot certify removal inputs changed after observation", () => {
  const clearManifest = structuredClone(manifest) as BrandSurfaceManifest;
  const surface = clearManifest.surfaces.find(isLegacyRemovalCandidate)!;
  surface.currentAssetHashes = ["9".repeat(64)];
  surface.legacySignatures = [];
  clearManifest.ownedInputFingerprint = "8".repeat(64);
  const candidate = reconcileLegacyRemovalLedger(clearManifest, ledger);
  const record = recordFor(candidate, surface.id);
  const catalog = new Map<string, EvidenceReceiptCatalogEntry>();
  markReplacementVerified(record, catalog);

  record.detectedLegacySignatures.push("legacy-mutated-after-observation");
  record.detectedLegacySignatures.sort();
  record.preservedBinding.detectedLegacySignatures = [...record.detectedLegacySignatures];
  const codes = validateLegacyRemovalLedger(clearManifest, candidate, catalog).map((issue) => issue.code);
  assert.ok(!codes.includes("source-binding-stale"));
  assert.ok(codes.includes("receipt-scoped-input-mismatch"));
});

test("deleted rows still require delivery-state-specific readback evidence", () => {
  const changedManifest = structuredClone(manifest) as BrandSurfaceManifest;
  const removed = changedManifest.surfaces.find(isLegacyRemovalCandidate)!;
  changedManifest.surfaces = changedManifest.surfaces.filter((surface) => surface.id !== removed.id);
  changedManifest.ownedInputFingerprint = "d".repeat(64);
  const base = reconcileLegacyRemovalLedger(changedManifest, ledger);
  const cases = [
    ["controlled-current", ["controlled-current-readback"]],
    ["revocable-public", ["revocable-public-readback", "revocable-public-cache"]],
    ["installed-client", ["installed-client-readback"]],
    ["delivered-historical", ["historical-delivery-readback"]],
    ["private-provenance", ["private-provenance-readback"]],
  ] as const;
  for (const [deliveryState, expectedCodes] of cases) {
    const candidate = structuredClone(base) as LegacyRemovalLedger;
    const record = recordFor(candidate, removed.id);
    record.deliveryState = deliveryState;
    record.preservedBinding.deliveryState = deliveryState;
    const catalog = new Map<string, EvidenceReceiptCatalogEntry>();
    record.status = "deleted";
    record.evidence.deletion = receipt(record, "deletion", catalog);
    record.evidence.observedAt = "2026-08-04T12:00:00.000Z";
    record.rollback.rehearsalEvidence = receipt(record, "rollback-rehearsal", catalog);
    record.deletionCommit = "abcdef1234567890";
    const codes = validateLegacyRemovalLedger(changedManifest, candidate, catalog).map((issue) => issue.code);
    for (const expectedCode of expectedCodes) assert.ok(codes.includes(expectedCode), `${deliveryState} did not require ${expectedCode}`);
  }
});
