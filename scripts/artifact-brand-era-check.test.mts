import assert from "node:assert/strict";
import test from "node:test";

import { inspectArtifactBrandEra } from "./artifact-brand-era-check.mts";

test("durable artifacts have an explicit era, delivery state, and source marker", () => {
  const report = inspectArtifactBrandEra();
  assert.deepEqual(report.findings, []);
  assert.ok(report.durableRows >= 4);
  assert.equal(report.renderedSources, 4);
});
