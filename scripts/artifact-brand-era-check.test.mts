import assert from "node:assert/strict";
import test from "node:test";

import { expectedDurableOwner, inspectArtifactBrandEra } from "./artifact-brand-era-check.mts";

test("durable artifacts have an explicit era, delivery state, and source marker", () => {
  const report = inspectArtifactBrandEra();
  assert.deepEqual(report.findings, []);
  assert.ok(report.durableRows >= 4);
  assert.equal(report.renderedSources, 4);
});

test("durable ownership is explicit for historical, public, provider, and family artifacts", () => {
  assert.equal(expectedDurableOwner({ targetProfiles: ["historical-private-provenance"] }, "docs/old-design.md"), "gh#729");
  assert.equal(expectedDurableOwner({}, "durable:vercel-blob-world-media"), "gh#741");
  assert.equal(expectedDurableOwner({}, "historical:handwrytten-template-349914-mailed-copies"), "gh#740");
  assert.equal(expectedDurableOwner({}, "durable:generated-printables"), "gh#731");
});
