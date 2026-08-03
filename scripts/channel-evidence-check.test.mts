import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import {
  validateChannelEvidence,
  type ChannelEvidenceFile,
} from "./channel-evidence-contract.mts";
import type { BrandSurfaceManifest } from "../packages/design/src/surfaces.ts";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "docs/homa-design/evidence/surfaces.json"), "utf8")) as BrandSurfaceManifest;
const evidence = JSON.parse(readFileSync(resolve(root, "docs/homa-design/evidence/channel-evidence.json"), "utf8")) as ChannelEvidenceFile;
const fixtureChecksums = new Map(evidence.records.map((record) => [
  record.fixturePath,
  createHash("sha256").update(readFileSync(resolve(root, record.fixturePath))).digest("hex"),
]));

const validate = (candidate: unknown) => validateChannelEvidence({ manifest, evidence: candidate, fixtureChecksums });

test("committed channel evidence covers each channel profile and stays pending until real proof exists", () => {
  assert.deepEqual(validate(evidence), []);
  assert.ok(evidence.records.every((record) => record.status === "pending"));
  assert.ok(evidence.records.every((record) => Object.values(record.hardGates).every((gate) => gate.passed === false)));
});

test("owned-input or surface coverage drift invalidates the evidence bundle", () => {
  const stale = structuredClone(evidence) as ChannelEvidenceFile;
  stale.ownedInputFingerprint = "f".repeat(64);
  stale.records[0]!.ownedInputFingerprint = "f".repeat(64);
  stale.records[0]!.surfaceCoverage.surfaceCount += 1;
  const codes = validate(stale).map((issue) => issue.code);
  assert.ok(codes.includes("manifest-fingerprint-stale"));
  assert.ok(codes.includes("coverage-count-stale"));
  assert.ok(codes.includes("record-fingerprint-stale"));
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
