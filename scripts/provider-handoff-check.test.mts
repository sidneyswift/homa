import assert from "node:assert/strict";
import test from "node:test";

import {
  loadProviderHandoffInputs,
  validateProviderHandoffs,
  type ProviderHandoffFile,
} from "./provider-handoff-contract.mts";

const inputs = loadProviderHandoffInputs();
const validate = (candidate: unknown) =>
  validateProviderHandoffs({ manifest: inputs.manifest, handoffs: candidate });

test("committed provider handoffs cover every #732 record and stay pending without external read-back", () => {
  assert.deepEqual(validate(inputs.handoffs), []);
  assert.equal(inputs.handoffs.records.length, 5);
  assert.ok(inputs.handoffs.records.every((record) => record.status === "pending"));
  assert.ok(inputs.handoffs.records.every((record) => record.readback.status === "pending"));
  assert.ok(inputs.handoffs.records.every((record) => record.readback.externalStateSimulated === false));
});

test("provider surface coverage fails closed when a current provider surface is omitted", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  invalid.surfaceCoverage.surfaceIds = invalid.surfaceCoverage.surfaceIds.slice(1);
  invalid.surfaceCoverage.surfaceCount -= 1;
  const codes = validate(invalid).map((issue) => issue.code);
  assert.ok(codes.includes("coverage-count-stale"));
  assert.ok(codes.includes("coverage-ids-stale"));
});

test("a provider handoff cannot claim verified without external evidence", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  const row = invalid.records[0]!;
  row.status = "verified";
  row.readback.status = "pending";
  const codes = validate(invalid).map((issue) => issue.code);
  assert.ok(codes.includes("verified-without-readback"));
});

test("missing source paths and operational details fail closed", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  const row = invalid.records[0]!;
  row.sourcePaths = [...row.sourcePaths, "apps/web/does-not-exist.ts"];
  row.configurableFields[0]!.rollback = "";
  const codes = validate(invalid).map((issue) => issue.code);
  assert.ok(codes.includes("source-paths-missing"));
  assert.ok(codes.includes("field-detail"));
});

test("simulated provider capability cannot be accepted", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  const row = invalid.records[0]!;
  (row.readback as { externalStateSimulated: boolean }).externalStateSimulated = true;
  assert.ok(validate(invalid).some((issue) => issue.code === "simulated-provider-state"));
});
