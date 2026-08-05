import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  reconcileChannelEvidenceBindings,
  validateChannelEvidence,
  type ChannelEvidenceFile,
} from "./channel-evidence-contract.mts";
import type {
  EvidenceReceiptCatalog,
  EvidenceReceiptCatalogEntry,
  EvidenceReceiptReference,
} from "../packages/design/src/evidence-receipts.ts";
import { validateEvidenceReceiptReference } from "../packages/design/src/evidence-receipts.ts";
import { loadEvidenceReceiptCatalog } from "./evidence-receipt-loader.mts";
import type { BrandSurfaceManifest } from "../packages/design/src/surfaces.ts";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "docs/homa-design/evidence/surfaces.json"), "utf8")) as BrandSurfaceManifest;
const evidence = JSON.parse(readFileSync(resolve(root, "docs/homa-design/evidence/channel-evidence.json"), "utf8")) as ChannelEvidenceFile;
const fixtureChecksums = new Map(evidence.records.map((record) => [
  record.fixturePath,
  createHash("sha256").update(readFileSync(resolve(root, record.fixturePath))).digest("hex"),
]));

const emptyReceiptCatalog: EvidenceReceiptCatalog = new Map();
const validate = (
  candidate: unknown,
  candidateManifest: BrandSurfaceManifest = manifest,
  receiptCatalog: EvidenceReceiptCatalog = emptyReceiptCatalog,
) => validateChannelEvidence({ manifest: candidateManifest, evidence: candidate, fixtureChecksums, receiptCatalog });

function artifactCatalogEntry(
  reference: EvidenceReceiptReference,
  subjectId: string,
  scopedInputFingerprint: string,
  committed = true,
): EvidenceReceiptCatalogEntry {
  const underlyingProof = {
    kind: "artifact" as const,
    path: "docs/homa-design/evidence/artifacts/channel-proof.png" as const,
    sha256: "e".repeat(64),
  };
  return {
    reference,
    actualSha256: reference.sha256,
    envelope: {
      schemaVersion: 2,
      id: reference.id,
      domain: "channel",
      subjectId,
      proofKind: "hard-gate",
      scopedInputFingerprint,
      underlyingProof,
      observedAt: "2026-08-04T12:00:00.000Z",
      environment: "real-client",
      observer: "independent critic",
      notes: "Observed a delivered message.",
    },
    committed,
    underlyingProof: {
      reference: underlyingProof,
      actualSha256: underlyingProof.sha256,
      committed,
      attestation: null,
      authenticated: true,
    },
  };
}

function writeTestFile(rootPath: string, path: string, value: string): void {
  const absolutePath = resolve(rootPath, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, value);
}

function commitTestRepository(rootPath: string): void {
  execFileSync("git", ["init", "-q"], { cwd: rootPath });
  execFileSync("git", ["add", "."], { cwd: rootPath });
  execFileSync("git", ["-c", "user.name=Evidence Test", "-c", "user.email=evidence@example.invalid", "-c", "commit.gpgsign=false", "commit", "-qm", "evidence fixture"], { cwd: rootPath });
}

test("committed channel evidence covers each channel profile and stays pending until real proof exists", () => {
  assert.deepEqual(validate(evidence), []);
  assert.ok(evidence.records.every((record) => record.status === "pending"));
  assert.ok(evidence.records.every((record) => Object.values(record.hardGates).every((gate) => gate.passed === false)));
});

test("profile source or surface coverage drift invalidates only the scoped evidence row", () => {
  const stale = structuredClone(evidence) as ChannelEvidenceFile;
  stale.records[0]!.surfaceCoverage.scopedInputFingerprint = "f".repeat(64);
  stale.records[0]!.surfaceCoverage.surfaceCount += 1;
  const codes = validate(stale).map((issue) => issue.code);
  assert.ok(codes.includes("coverage-count-stale"));
  assert.ok(codes.includes("scoped-input-stale"));
});

test("unrelated manifest changes do not invalidate authentic profile-scoped evidence", () => {
  const unrelated = structuredClone(manifest) as BrandSurfaceManifest;
  unrelated.ownedInputFingerprint = "f".repeat(64);
  unrelated.baselineSourceCommit = "a".repeat(40);
  assert.deepEqual(validate(evidence, unrelated), []);
});

test("a passing row cannot bypass a failed hard gate or omit its proof", () => {
  const invalid = structuredClone(evidence) as ChannelEvidenceFile;
  const row = invalid.records[0]!;
  row.status = "pass";
  row.observedAt = "2026-08-03T12:00:00.000Z";
  row.hardGates["delivery-readback"] = { passed: true, evidencePath: null, note: null };
  const codes = validate(invalid).map((issue) => issue.code);
  assert.ok(codes.includes("hard-gate-proof-missing"));
  assert.ok(codes.includes("pass-with-failed-gate"));
  assert.ok(codes.includes("pass-field-missing"));
});

test("fabricated receipt paths and checksums cannot turn a hard gate green", () => {
  const invalid = structuredClone(evidence) as ChannelEvidenceFile;
  const reference: EvidenceReceiptReference = {
    id: "receipt:channel:email-delivery-readback",
    path: "docs/homa-design/evidence/receipts/fabricated.json",
    sha256: "a".repeat(64),
  };
  invalid.records[0]!.hardGates["delivery-readback"] = { passed: true, evidencePath: reference, note: "claimed" };
  const entry = artifactCatalogEntry(reference, "channel:email:delivery-readback", invalid.records[0]!.surfaceCoverage.scopedInputFingerprint);
  entry.reference = {
    ...reference,
    path: "docs/homa-design/evidence/receipts/actual.json",
    sha256: "b".repeat(64),
  };
  const codes = validate(invalid, manifest, new Map([[reference.id, entry]])).map((issue) => issue.code);
  assert.ok(codes.includes("receipt-path-mismatch"));
  assert.ok(codes.includes("receipt-checksum-mismatch"));
});

test("an uncommitted receipt cannot turn a hard gate green", () => {
  const invalid = structuredClone(evidence) as ChannelEvidenceFile;
  const reference: EvidenceReceiptReference = {
    id: "receipt:channel:email-uncommitted",
    path: "docs/homa-design/evidence/receipts/email-uncommitted.json",
    sha256: "a".repeat(64),
  };
  invalid.records[0]!.hardGates["delivery-readback"] = { passed: true, evidencePath: reference, note: "claimed" };
  const entry = artifactCatalogEntry(reference, "channel:email:delivery-readback", invalid.records[0]!.surfaceCoverage.scopedInputFingerprint, false);
  assert.ok(validate(invalid, manifest, new Map([[reference.id, entry]])).some((issue) => issue.code === "receipt-not-committed"));
});

test("a valid-looking but nonexistent receipt path is rejected", () => {
  const invalid = structuredClone(evidence) as ChannelEvidenceFile;
  invalid.records[0]!.hardGates["delivery-readback"] = {
    passed: true,
    evidencePath: {
      id: "receipt:channel:email-missing",
      path: "docs/homa-design/evidence/receipts/missing.json",
      sha256: "c".repeat(64),
    },
    note: "claimed",
  };
  assert.ok(validate(invalid).some((issue) => issue.code === "receipt-unregistered"));
});

test("receipt paths cannot escape the committed evidence directory", () => {
  const invalid = structuredClone(evidence) as ChannelEvidenceFile;
  invalid.records[0]!.hardGates["delivery-readback"] = {
    passed: true,
    evidencePath: {
      id: "receipt:channel:email-traversal",
      path: "docs/homa-design/evidence/receipts/../../surfaces.json",
      sha256: "d".repeat(64),
    },
    note: "claimed",
  };
  assert.ok(validate(invalid).some((issue) => issue.code === "receipt-reference-invalid"));
});

test("simulated provider capabilities are rejected even when the row is otherwise shaped", () => {
  const invalid = structuredClone(evidence) as ChannelEvidenceFile;
  (invalid.records.find((record) => record.profile === "provider") as { providerCapabilitySimulated: boolean }).providerCapabilitySimulated = true;
  assert.ok(validate(invalid).some((issue) => issue.code === "simulated-provider"));
});

test("missing profiles fail closed instead of silently shrinking channel scope", () => {
  const invalid = structuredClone(evidence) as ChannelEvidenceFile;
  invalid.records = invalid.records.filter((record) => record.profile !== "physical-print");
  const codes = validate(invalid).map((issue) => issue.code);
  assert.ok(codes.includes("profile-missing"));
  assert.ok(codes.includes("profile-count"));
});

test("unknown statuses cannot create an unreviewed green state", () => {
  const invalid = structuredClone(evidence) as ChannelEvidenceFile;
  (invalid.records[0] as { status: string }).status = "green";
  assert.ok(validate(invalid).some((issue) => issue.code === "unknown-status"));
});

test("a committed receipt envelope without distinct underlying proof cannot pass", () => {
  const invalid = structuredClone(evidence) as ChannelEvidenceFile;
  const row = invalid.records[0]!;
  const reference: EvidenceReceiptReference = {
    id: "receipt:channel:email-envelope-only",
    path: "docs/homa-design/evidence/receipts/email-envelope-only.json",
    sha256: "a".repeat(64),
  };
  row.hardGates["delivery-readback"] = { passed: true, evidencePath: reference, note: "Envelope only." };
  const entry = artifactCatalogEntry(reference, `${row.id}:delivery-readback`, row.surfaceCoverage.scopedInputFingerprint);
  entry.underlyingProof = null;
  assert.ok(validate(invalid, manifest, new Map([[reference.id, entry]])).some((issue) => issue.code === "receipt-underlying-proof-missing"));
});

test("the loader rejects envelope-only proof and changed underlying HEAD bytes", () => {
  const fixtureRoot = mkdtempSync(resolve(tmpdir(), "homa-evidence-receipt-"));
  const scopedInputFingerprint = "c".repeat(64);
  const envelopeOnlyPath = "docs/homa-design/evidence/receipts/envelope-only.json";
  const envelopeOnlyId = "receipt:channel:loader-envelope-only" as const;
  const envelopeOnlyBytes = `${JSON.stringify({
    schemaVersion: 2,
    id: envelopeOnlyId,
    domain: "channel",
    subjectId: "channel:email:delivery-readback",
    proofKind: "hard-gate",
    scopedInputFingerprint,
    observedAt: "2026-08-04T12:00:00.000Z",
    environment: "real-client",
    observer: "independent critic",
    notes: "Envelope with no proof.",
  })}\n`;
  writeTestFile(fixtureRoot, envelopeOnlyPath, envelopeOnlyBytes);

  const artifactPath = "docs/homa-design/evidence/artifacts/changed-proof.txt";
  const artifactBytes = "original committed proof\n";
  writeTestFile(fixtureRoot, artifactPath, artifactBytes);
  const artifactSha = createHash("sha256").update(artifactBytes).digest("hex");
  const changedProofPath = "docs/homa-design/evidence/receipts/changed-proof.json";
  const changedProofId = "receipt:channel:loader-changed-proof" as const;
  const changedProofBytes = `${JSON.stringify({
    schemaVersion: 2,
    id: changedProofId,
    domain: "channel",
    subjectId: "channel:email:delivery-readback",
    proofKind: "hard-gate",
    scopedInputFingerprint,
    underlyingProof: { kind: "artifact", path: artifactPath, sha256: artifactSha },
    observedAt: "2026-08-04T12:00:00.000Z",
    environment: "real-client",
    observer: "independent critic",
    notes: "Artifact changed after commit.",
  })}\n`;
  writeTestFile(fixtureRoot, changedProofPath, changedProofBytes);
  commitTestRepository(fixtureRoot);
  writeTestFile(fixtureRoot, artifactPath, "changed working tree proof\n");

  const references: EvidenceReceiptReference[] = [
    {
      id: envelopeOnlyId,
      path: envelopeOnlyPath,
      sha256: createHash("sha256").update(envelopeOnlyBytes).digest("hex"),
    },
    {
      id: changedProofId,
      path: changedProofPath,
      sha256: createHash("sha256").update(changedProofBytes).digest("hex"),
    },
  ];
  const catalog = loadEvidenceReceiptCatalog(fixtureRoot, references);
  const expectation = {
    domain: "channel" as const,
    subjectId: "channel:email:delivery-readback",
    proofKinds: ["hard-gate"] as const,
    scopedInputFingerprint,
  };
  const envelopeOnlyIssues = validateEvidenceReceiptReference(references[0], expectation, catalog).map((issue) => issue.code);
  assert.ok(envelopeOnlyIssues.includes("receipt-underlying-proof-invalid"));
  const changedProofIssues = validateEvidenceReceiptReference(references[1], expectation, catalog).map((issue) => issue.code);
  assert.ok(changedProofIssues.includes("receipt-underlying-proof-checksum-mismatch"));
  assert.ok(changedProofIssues.includes("receipt-underlying-proof-not-committed"));

  const wrongEnvelopeClaim = { ...references[1], sha256: "f".repeat(64) };
  const wrongClaimCatalog = loadEvidenceReceiptCatalog(fixtureRoot, [wrongEnvelopeClaim]);
  const wrongClaimEntry = wrongClaimCatalog.get(wrongEnvelopeClaim.id);
  assert.equal(wrongClaimEntry?.reference.sha256, wrongEnvelopeClaim.sha256);
  assert.notEqual(wrongClaimEntry?.actualSha256, wrongEnvelopeClaim.sha256);
  assert.ok(validateEvidenceReceiptReference(wrongEnvelopeClaim, expectation, wrongClaimCatalog).some((issue) => issue.code === "receipt-checksum-mismatch"));
});

test("private attestations stay pending until a trusted signature is authenticated", () => {
  const invalid = structuredClone(evidence) as ChannelEvidenceFile;
  const row = invalid.records[0]!;
  const reference: EvidenceReceiptReference = {
    id: "receipt:channel:email-private-attestation",
    path: "docs/homa-design/evidence/receipts/email-private-attestation.json",
    sha256: "a".repeat(64),
  };
  const underlyingProof = {
    kind: "trusted-attestation" as const,
    path: "docs/homa-design/evidence/attestations/email-private-attestation.json" as const,
    sha256: "b".repeat(64),
  };
  row.hardGates["delivery-readback"] = { passed: true, evidencePath: reference, note: "Private evidence." };
  const entry: EvidenceReceiptCatalogEntry = {
    reference,
    actualSha256: reference.sha256,
    envelope: {
      schemaVersion: 2,
      id: reference.id,
      domain: "channel",
      subjectId: `${row.id}:delivery-readback`,
      proofKind: "hard-gate",
      scopedInputFingerprint: row.surfaceCoverage.scopedInputFingerprint,
      underlyingProof,
      observedAt: "2026-08-04T12:00:00.000Z",
      environment: "production",
      observer: "approved observer",
      notes: "Sensitive artifact retained privately.",
    },
    committed: true,
    underlyingProof: {
      reference: underlyingProof,
      actualSha256: underlyingProof.sha256,
      committed: true,
      attestation: {
        schemaVersion: 1,
        attestationKind: "client-observation",
        subjectId: `${row.id}:delivery-readback`,
        scopedInputFingerprint: row.surfaceCoverage.scopedInputFingerprint,
        observedAt: "2026-08-04T12:00:00.000Z",
        externalArtifactSha256: "c".repeat(64),
        issuer: { kind: "approved-observer-signing-key", id: "observer-key-1" },
        authentication: { kind: "detached-ed25519", trustAnchorId: "not-yet-configured", signature: "unverified-signature" },
        externalReference: "private:evidence/email-delivery/2026-08-04",
        claim: "Email delivered and rendered in the named client.",
      },
      authenticated: false,
    },
  };
  assert.ok(validate(invalid, manifest, new Map([[reference.id, entry]])).some((issue) => issue.code === "receipt-attestation-unauthenticated"));
});

test("a stale proof cannot be laundered through a fresh channel row", () => {
  const invalid = structuredClone(evidence) as ChannelEvidenceFile;
  const row = invalid.records[0]!;
  const reference: EvidenceReceiptReference = {
    id: "receipt:channel:email-stale-input",
    path: "docs/homa-design/evidence/receipts/email-stale-input.json",
    sha256: "a".repeat(64),
  };
  row.hardGates["delivery-readback"] = { passed: true, evidencePath: reference, note: "Old observation." };
  const entry = artifactCatalogEntry(reference, `${row.id}:delivery-readback`, "f".repeat(64));
  assert.ok(validate(invalid, manifest, new Map([[reference.id, entry]])).some((issue) => issue.code === "receipt-scoped-input-mismatch"));
});

test("reconciliation clears every channel claim when source or fixture inputs drift", () => {
  const withClaims = structuredClone(evidence) as ChannelEvidenceFile;
  const claimed = withClaims.records[0]!;
  const reference: EvidenceReceiptReference = {
    id: "receipt:channel:email-old-proof",
    path: "docs/homa-design/evidence/receipts/email-old-proof.json",
    sha256: "a".repeat(64),
  };
  claimed.status = "pass";
  claimed.observedAt = "2026-08-04T12:00:00.000Z";
  claimed.environment = "production";
  claimed.browserOrOperatingSystem = "Apple Mail";
  claimed.deviceModel = "iPhone";
  claimed.installedBuildFingerprint = "old-build";
  claimed.clientOrProviderVersion = "old-client";
  claimed.printerOutputSettings = "old-settings";
  claimed.state = "observed";
  claimed.builderIdentity = "builder";
  claimed.criticIdentity = "critic";
  claimed.largestGap = "old gap";
  claimed.remediation = "old remediation";
  claimed.retainedRisk = "old risk";
  claimed.baselineRender = reference;
  claimed.candidateRender = reference;
  claimed.interactionRecording = reference;
  claimed.automatedOutput = reference;
  claimed.timings = reference;
  claimed.productionReadback = reference;
  claimed.deletionProof = reference;
  for (const gate of Object.values(claimed.hardGates)) Object.assign(gate, { passed: true, evidencePath: reference, note: "old" });

  const driftedChecksums = new Map(fixtureChecksums);
  driftedChecksums.set(claimed.fixturePath, "f".repeat(64));
  const reconciled = reconcileChannelEvidenceBindings(manifest, withClaims, driftedChecksums);
  const reset = reconciled.records[0]!;
  assert.equal(reset.status, "pending");
  assert.equal(reset.observedAt, null);
  assert.equal(reset.environment, null);
  assert.equal(reset.builderIdentity, null);
  assert.equal(reset.criticIdentity, null);
  assert.equal(reset.productionReadback, null);
  assert.equal(reset.deletionProof, null);
  assert.equal(reset.retainedRisk, null);
  assert.ok(Object.values(reset.hardGates).every((gate) => gate.passed === false && gate.evidencePath === null && gate.note === null));

  const driftedManifest = structuredClone(manifest) as BrandSurfaceManifest;
  const scopedSurface = driftedManifest.surfaces.find((surface) => surface.targetProfiles.includes("email-constrained"));
  assert.ok(scopedSurface);
  scopedSurface.currentAssetHashes = ["e".repeat(64)];
  const sourceReset = reconcileChannelEvidenceBindings(driftedManifest, withClaims, fixtureChecksums).records[0]!;
  assert.equal(sourceReset.status, "pending");
  assert.equal(sourceReset.productionReadback, null);
  assert.equal(sourceReset.builderIdentity, null);
  assert.ok(Object.values(sourceReset.hardGates).every((gate) => gate.passed === false && gate.evidencePath === null));
});
