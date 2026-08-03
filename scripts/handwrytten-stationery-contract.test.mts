import assert from "node:assert/strict";
import test from "node:test";

import {
  loadHandwryttenStationeryInputs,
  validateHandwryttenStationery,
  type HandwryttenStationeryFile,
} from "./handwrytten-stationery-contract.mts";

const inputs = loadHandwryttenStationeryInputs();
const validate = (candidate: unknown) => validateHandwryttenStationery({
  manifest: inputs.manifest,
  stationery: candidate,
  sourceSpec: inputs.sourceSpec,
});

test("committed Quiet stationery contract is complete but remains evidence-pending", () => {
  assert.deepEqual(validate(inputs.stationery), []);
  assert.equal(inputs.stationery.status, "candidate");
  assert.equal(inputs.stationery.account.replacementConfiguration.cardId, null);
  assert.equal(inputs.stationery.account.replacementConfiguration.providerReadback.status, "pending");
  assert.equal(inputs.stationery.physicalProof.status, "pending");
  assert.equal(inputs.stationery.stopGeneration.status, "pending");
});

test("source inventory and fixture fingerprints fail closed when they drift", () => {
  const invalid = structuredClone(inputs.stationery) as HandwryttenStationeryFile;
  invalid.sourcePaths = invalid.sourcePaths.filter((path) => path !== "apps/web/lib/cards/message.ts");
  invalid.sourceSpec.sha256 = "f".repeat(64);
  const codes = validate(invalid).map((issue) => issue.code);
  assert.ok(codes.includes("source-paths-incomplete"));
  assert.ok(codes.includes("source-spec-fingerprint"));
});

test("old-template stop generation cannot be marked complete before both proofs", () => {
  const invalid = structuredClone(inputs.stationery) as HandwryttenStationeryFile;
  invalid.stopGeneration.status = "complete";
  invalid.stopGeneration.timestamp = "2026-08-03T12:00:00.000Z";
  const codes = validate(invalid).map((issue) => issue.code);
  assert.ok(codes.includes("stop-generation-before-proof"));
});

test("production acceptance requires provider read-back, physical proof, and stop timestamp", () => {
  const invalid = structuredClone(inputs.stationery) as HandwryttenStationeryFile;
  invalid.status = "production-accepted";
  const codes = validate(invalid).map((issue) => issue.code);
  assert.ok(codes.includes("production-acceptance"));
  assert.equal(invalid.stopGeneration.timestamp, null);
});

test("provider constraints preserve the real Handwrytten payload boundary", () => {
  const invalid = structuredClone(inputs.stationery) as HandwryttenStationeryFile;
  invalid.providerConstraints.maxMessageCharacters = 501;
  invalid.providerConstraints.webFontEmbedding = "allowed" as never;
  const codes = validate(invalid).map((issue) => issue.code);
  assert.ok(codes.includes("provider-message-limit"));
  assert.ok(codes.includes("provider-font-embedding"));
});

test("already mailed cards remain delivered historical copies and cannot be recalled", () => {
  const invalid = structuredClone(inputs.stationery) as HandwryttenStationeryFile;
  invalid.historicalDelivery.recallStatus = "recalled" as never;
  const codes = validate(invalid).map((issue) => issue.code);
  assert.ok(codes.includes("historical-delivery"));
});
