import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  collectEvidenceReceiptReferences,
  isEvidenceUnderlyingProofReference,
  type EvidenceReceiptCatalog,
  type EvidenceReceiptCatalogEntry,
  type EvidenceReceiptEnvelope,
  type EvidenceTrustedAttestation,
  type EvidenceUnderlyingProofCatalogEntry,
} from "../packages/design/src/evidence-receipts.ts";

const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");

function trackedPaths(root: string): ReadonlySet<string> {
  const output = execFileSync("git", ["ls-files", "-z"], { cwd: root });
  return new Set(output.toString("utf8").split("\0").filter(Boolean));
}

function committedReceiptMatches(root: string, path: string, bytes: Buffer): boolean {
  try {
    const committedBytes = execFileSync("git", ["show", `HEAD:${path}`], {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return sha256(committedBytes) === sha256(bytes);
  } catch {
    return false;
  }
}

function loadUnderlyingProof(
  root: string,
  tracked: ReadonlySet<string>,
  receiptPath: string,
  envelope: EvidenceReceiptEnvelope,
): EvidenceUnderlyingProofCatalogEntry | null {
  const reference = envelope.underlyingProof;
  if (!isEvidenceUnderlyingProofReference(reference) || reference.path === receiptPath) return null;
  const absolutePath = resolve(root, reference.path);
  if (!existsSync(absolutePath)) return null;
  const bytes = readFileSync(absolutePath);
  let attestation: EvidenceTrustedAttestation | null = null;
  if (reference.kind === "trusted-attestation") {
    try {
      attestation = JSON.parse(bytes.toString("utf8")) as EvidenceTrustedAttestation;
    } catch {
      attestation = null;
    }
  }
  return {
    reference,
    actualSha256: sha256(bytes),
    committed: tracked.has(reference.path) && committedReceiptMatches(root, reference.path, bytes),
    attestation,
    // A private attestation cannot authenticate itself. Keep this false until
    // the loader has an approved trust anchor and verifies the detached proof.
    authenticated: reference.kind === "artifact",
  };
}

export function loadEvidenceReceiptCatalog(root: string, evidence: unknown): EvidenceReceiptCatalog {
  const tracked = trackedPaths(root);
  const entries = new Map<string, EvidenceReceiptCatalogEntry>();
  for (const reference of collectEvidenceReceiptReferences(evidence)) {
    if (entries.has(reference.id)) continue;
    const absolutePath = resolve(root, reference.path);
    if (!existsSync(absolutePath)) continue;
    const bytes = readFileSync(absolutePath);
    let envelope: EvidenceReceiptEnvelope;
    try {
      envelope = JSON.parse(bytes.toString("utf8")) as EvidenceReceiptEnvelope;
    } catch {
      continue;
    }
    entries.set(reference.id, {
      reference,
      actualSha256: sha256(bytes),
      envelope,
      committed: tracked.has(reference.path) && committedReceiptMatches(root, reference.path, bytes),
      underlyingProof: loadUnderlyingProof(root, tracked, reference.path, envelope),
    });
  }
  return entries;
}

export function loadTrackedPathChecksums(root: string, paths: readonly string[]): {
  checksums: ReadonlyMap<string, string>;
  trackedPaths: ReadonlySet<string>;
} {
  const tracked = trackedPaths(root);
  const checksums = new Map<string, string>();
  for (const path of paths) {
    const absolutePath = resolve(root, path);
    if (tracked.has(path) && existsSync(absolutePath)) checksums.set(path, sha256(readFileSync(absolutePath)));
  }
  return { checksums, trackedPaths: tracked };
}
