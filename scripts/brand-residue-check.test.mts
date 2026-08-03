import assert from "node:assert/strict";
import { test } from "node:test";
import { collectBrandResidueFindings, collectLegacyFontPathResidue } from "./brand-residue-check.mts";

test("brand residue guard has no active findings", () => {
  assert.deepEqual(collectLegacyFontPathResidue(), []);
  assert.deepEqual(collectBrandResidueFindings(), []);
});

test("full-tree audit keeps quarantined evidence out of the active scan", () => {
  const findings = collectBrandResidueFindings("full");
  const paths = collectLegacyFontPathResidue("full");
  assert.ok(findings.every(({ path }) => !path.startsWith("docs/homa-design/evidence/")));
  assert.ok(paths.every((path) => !path.startsWith("docs/homa-design/evidence/")));
});
