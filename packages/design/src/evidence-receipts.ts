export const EVIDENCE_RECEIPT_SCHEMA_VERSION = 2 as const;
export const EVIDENCE_TRUSTED_ATTESTATION_SCHEMA_VERSION = 1 as const;

export const evidenceReceiptDomains = [
  "channel",
  "provider",
  "legacy-removal",
] as const;
export type EvidenceReceiptDomain = (typeof evidenceReceiptDomains)[number];

export const evidenceReceiptProofKinds = [
  "hard-gate",
  "baseline-render",
  "candidate-render",
  "interaction-recording",
  "automated-output",
  "timings",
  "production-readback",
  "deletion",
  "provider-readback",
  "replacement",
  "immutable-residual",
  "rollback-rehearsal",
  "stop-generation",
  "cache-readback",
  "installed-client-readback",
  "historical-delivery-readback",
  "private-provenance-readback",
] as const;
export type EvidenceReceiptProofKind = (typeof evidenceReceiptProofKinds)[number];

export type EvidenceReceiptId = `receipt:${EvidenceReceiptDomain}:${string}`;

export const evidenceTrustedAttestationKinds = [
  "ci-run",
  "production-probe",
  "provider-api-readback",
  "client-observation",
  "physical-output-observation",
] as const;
export type EvidenceTrustedAttestationKind = (typeof evidenceTrustedAttestationKinds)[number];

export const evidenceTrustedIssuerKinds = [
  "github-actions-oidc",
  "provider-signed",
  "approved-observer-signing-key",
] as const;
export type EvidenceTrustedIssuerKind = (typeof evidenceTrustedIssuerKinds)[number];

export interface EvidenceArtifactReference {
  kind: "artifact";
  path: `docs/homa-design/evidence/artifacts/${string}`;
  sha256: string;
}

export interface EvidenceTrustedAttestationReference {
  kind: "trusted-attestation";
  path: `docs/homa-design/evidence/attestations/${string}.json`;
  sha256: string;
}

export type EvidenceUnderlyingProofReference = EvidenceArtifactReference | EvidenceTrustedAttestationReference;

export interface EvidenceTrustedAttestation {
  schemaVersion: typeof EVIDENCE_TRUSTED_ATTESTATION_SCHEMA_VERSION;
  attestationKind: EvidenceTrustedAttestationKind;
  subjectId: string;
  scopedInputFingerprint: string;
  observedAt: string;
  externalArtifactSha256: string;
  issuer: {
    kind: EvidenceTrustedIssuerKind;
    id: string;
  };
  authentication: {
    kind: "detached-ed25519";
    trustAnchorId: string;
    signature: string;
  };
  externalReference: string;
  claim: string;
}

/**
 * A claim stored by an evidence bundle. The reference is accepted only when
 * it resolves to an exact committed receipt envelope with matching bytes.
 */
export interface EvidenceReceiptReference {
  id: EvidenceReceiptId;
  path: `docs/homa-design/evidence/receipts/${string}.json`;
  sha256: string;
}

/**
 * A receipt is an envelope around distinct proof. The proof can be a redacted
 * artifact or a typed attestation, but it must be content-addressed and must
 * exist as identical committed HEAD bytes. The envelope alone is never proof.
 */
export interface EvidenceReceiptEnvelope {
  schemaVersion: typeof EVIDENCE_RECEIPT_SCHEMA_VERSION;
  id: EvidenceReceiptId;
  domain: EvidenceReceiptDomain;
  subjectId: string;
  proofKind: EvidenceReceiptProofKind;
  scopedInputFingerprint: string;
  underlyingProof: EvidenceUnderlyingProofReference;
  observedAt: string;
  environment: string;
  observer: string;
  notes: string;
}

export interface EvidenceUnderlyingProofCatalogEntry {
  reference: EvidenceUnderlyingProofReference;
  actualSha256: string | null;
  committed: boolean;
  attestation: EvidenceTrustedAttestation | null;
  authenticated: boolean;
}

export interface EvidenceReceiptCatalogEntry {
  reference: EvidenceReceiptReference;
  actualSha256: string | null;
  envelope: EvidenceReceiptEnvelope;
  committed: boolean;
  underlyingProof: EvidenceUnderlyingProofCatalogEntry | null;
}

export type EvidenceReceiptCatalog = ReadonlyMap<string, EvidenceReceiptCatalogEntry>;

export interface EvidenceReceiptExpectation {
  domain: EvidenceReceiptDomain;
  subjectId: string;
  proofKinds: readonly EvidenceReceiptProofKind[];
  scopedInputFingerprint: string;
}

export interface EvidenceReceiptIssue {
  code: string;
  message: string;
}

const sha256Pattern = /^[0-9a-f]{64}$/;
const receiptIdPattern = /^receipt:(channel|provider|legacy-removal):[a-z0-9][a-z0-9:-]*$/;
const receiptPathPattern = /^docs\/homa-design\/evidence\/receipts\/[a-z0-9][a-z0-9/_.-]*\.json$/;
const artifactPathPattern = /^docs\/homa-design\/evidence\/artifacts\/[a-z0-9][a-z0-9/_.-]*$/;
const attestationPathPattern = /^docs\/homa-design\/evidence\/attestations\/[a-z0-9][a-z0-9/_.-]*\.json$/;

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return isNonEmpty(value) && !Number.isNaN(Date.parse(value));
}

export function isEvidenceReceiptReference(value: unknown): value is EvidenceReceiptReference {
  if (!value || typeof value !== "object") return false;
  const reference = value as Partial<EvidenceReceiptReference>;
  return typeof reference.id === "string"
    && receiptIdPattern.test(reference.id)
    && typeof reference.path === "string"
    && receiptPathPattern.test(reference.path)
    && !reference.path.split("/").includes("..")
    && !reference.path.includes("//")
    && typeof reference.sha256 === "string"
    && sha256Pattern.test(reference.sha256);
}

export function isEvidenceUnderlyingProofReference(value: unknown): value is EvidenceUnderlyingProofReference {
  if (!value || typeof value !== "object") return false;
  const reference = value as Partial<EvidenceUnderlyingProofReference>;
  const pathIsSafe = typeof reference.path === "string"
    && !reference.path.split("/").includes("..")
    && !reference.path.includes("//");
  if (!pathIsSafe || typeof reference.sha256 !== "string" || !sha256Pattern.test(reference.sha256)) return false;
  const path = reference.path as string;
  if (reference.kind === "artifact") return artifactPathPattern.test(path);
  if (reference.kind === "trusted-attestation") return attestationPathPattern.test(path);
  return false;
}

export function validateEvidenceReceiptReference(
  value: unknown,
  expectation: EvidenceReceiptExpectation,
  catalog: EvidenceReceiptCatalog,
): EvidenceReceiptIssue[] {
  if (!isEvidenceReceiptReference(value)) {
    return [{ code: "receipt-reference-invalid", message: "Evidence must use a typed receipt id, committed receipt path, and SHA-256." }];
  }
  const entry = catalog.get(value.id);
  if (!entry) return [{ code: "receipt-unregistered", message: `Receipt ${value.id} is not in the committed receipt catalog.` }];
  const issues: EvidenceReceiptIssue[] = [];
  if (!entry.committed) issues.push({ code: "receipt-not-committed", message: `Receipt ${value.id} is not tracked by Git.` });
  if (entry.reference.path !== value.path) issues.push({ code: "receipt-path-mismatch", message: `Receipt ${value.id} does not match its committed path.` });
  if (entry.reference.sha256 !== value.sha256 || entry.actualSha256 !== value.sha256) issues.push({ code: "receipt-checksum-mismatch", message: `Receipt ${value.id} claimed checksum does not match its actual envelope bytes.` });
  const envelope = entry.envelope;
  if (envelope.schemaVersion !== EVIDENCE_RECEIPT_SCHEMA_VERSION) issues.push({ code: "receipt-schema-version", message: `Receipt ${value.id} has an unsupported schema version.` });
  if (envelope.id !== value.id) issues.push({ code: "receipt-id-mismatch", message: `Receipt ${value.id} does not match its envelope id.` });
  if (envelope.domain !== expectation.domain) issues.push({ code: "receipt-domain-mismatch", message: `Receipt ${value.id} belongs to ${envelope.domain}, not ${expectation.domain}.` });
  if (envelope.subjectId !== expectation.subjectId) issues.push({ code: "receipt-subject-mismatch", message: `Receipt ${value.id} belongs to a different evidence subject.` });
  if (!expectation.proofKinds.includes(envelope.proofKind)) issues.push({ code: "receipt-proof-kind-mismatch", message: `Receipt ${value.id} has the wrong proof kind.` });
  if (!sha256Pattern.test(expectation.scopedInputFingerprint)) issues.push({ code: "receipt-expectation-fingerprint-invalid", message: `Receipt ${value.id} was checked without a valid scoped input fingerprint.` });
  if (envelope.scopedInputFingerprint !== expectation.scopedInputFingerprint) issues.push({ code: "receipt-scoped-input-mismatch", message: `Receipt ${value.id} certifies stale scoped inputs.` });
  if (!isIsoDate(envelope.observedAt)) issues.push({ code: "receipt-observed-at", message: `Receipt ${value.id} needs an ISO observation timestamp.` });
  if (!isNonEmpty(envelope.environment) || !isNonEmpty(envelope.observer) || !isNonEmpty(envelope.notes)) issues.push({ code: "receipt-details-missing", message: `Receipt ${value.id} is missing environment, observer, or notes.` });
  if (!isEvidenceUnderlyingProofReference(envelope.underlyingProof)) {
    issues.push({ code: "receipt-underlying-proof-invalid", message: `Receipt ${value.id} needs a distinct content-addressed artifact or typed attestation.` });
    return issues;
  }
  const proof = entry.underlyingProof;
  if (!proof) {
    issues.push({ code: "receipt-underlying-proof-missing", message: `Receipt ${value.id} is only an envelope and has no underlying proof.` });
    return issues;
  }
  if (proof.reference.kind !== envelope.underlyingProof.kind || proof.reference.path !== envelope.underlyingProof.path) {
    issues.push({ code: "receipt-underlying-proof-path-mismatch", message: `Receipt ${value.id} does not match its underlying proof path.` });
  }
  if (proof.reference.sha256 !== envelope.underlyingProof.sha256 || proof.actualSha256 !== envelope.underlyingProof.sha256) {
    issues.push({ code: "receipt-underlying-proof-checksum-mismatch", message: `Receipt ${value.id} does not match its underlying proof bytes.` });
  }
  if (!proof.committed) issues.push({ code: "receipt-underlying-proof-not-committed", message: `Receipt ${value.id} underlying proof is not identical to committed HEAD bytes.` });
  if (envelope.underlyingProof.kind === "trusted-attestation") {
    const attestation = proof.attestation;
    if (!attestation
      || attestation.schemaVersion !== EVIDENCE_TRUSTED_ATTESTATION_SCHEMA_VERSION
      || !evidenceTrustedAttestationKinds.includes(attestation.attestationKind)
      || !sha256Pattern.test(attestation.externalArtifactSha256)
      || !evidenceTrustedIssuerKinds.includes(attestation.issuer?.kind)
      || !isNonEmpty(attestation.issuer?.id)
      || attestation.authentication?.kind !== "detached-ed25519"
      || !isNonEmpty(attestation.authentication?.trustAnchorId)
      || !isNonEmpty(attestation.authentication?.signature)
      || !isNonEmpty(attestation.externalReference)
      || !isNonEmpty(attestation.claim)
      || !isIsoDate(attestation.observedAt)) {
      issues.push({ code: "receipt-attestation-invalid", message: `Receipt ${value.id} trusted attestation is malformed.` });
    } else {
      if (attestation.subjectId !== envelope.subjectId) issues.push({ code: "receipt-attestation-subject-mismatch", message: `Receipt ${value.id} attestation belongs to a different subject.` });
      if (attestation.scopedInputFingerprint !== envelope.scopedInputFingerprint) issues.push({ code: "receipt-attestation-input-mismatch", message: `Receipt ${value.id} attestation certifies different scoped inputs.` });
      if (attestation.observedAt !== envelope.observedAt) issues.push({ code: "receipt-attestation-observation-mismatch", message: `Receipt ${value.id} attestation and envelope observation times differ.` });
      if (!proof.authenticated) issues.push({ code: "receipt-attestation-unauthenticated", message: `Receipt ${value.id} attestation has no verifiable trusted issuer or signing anchor.` });
    }
  } else if (proof.attestation !== null) {
    issues.push({ code: "receipt-artifact-attestation-mismatch", message: `Receipt ${value.id} artifact proof cannot be treated as an attestation.` });
  }
  return issues;
}

export function collectEvidenceReceiptReferences(value: unknown): EvidenceReceiptReference[] {
  const found: EvidenceReceiptReference[] = [];
  const visit = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== "object") return;
    if (isEvidenceReceiptReference(candidate)) {
      found.push(candidate);
      return;
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item);
      return;
    }
    for (const item of Object.values(candidate)) visit(item);
  };
  visit(value);
  return found;
}
