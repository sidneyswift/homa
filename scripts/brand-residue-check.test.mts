import assert from "node:assert/strict";
import { test } from "node:test";
import { collectLegacySignatures } from "../packages/design/src/legacy-signatures.ts";
import { collectBrandResidueFindings, collectLegacyFontPathResidue, introducedBrandResidue } from "./brand-residue-check.mts";

test("shared vocabulary distinguishes design residue from ordinary prose and sentinels", () => {
  assert.deepEqual(collectLegacySignatures("docs/research.md", "Caveat: this sample is intentionally small."), []);
  assert.deepEqual(collectLegacySignatures("styles.css", ".quiet-onboarding__question-kicker--gold { color: currentColor; }"), []);
  assert.deepEqual(collectLegacySignatures("scripts/brand-residue-check.mts", "var(--sage-300) rounded-pill"), []);
  assert.deepEqual(collectLegacySignatures("component.test.ts", "var(--sage-300) rounded-pill"), []);

  assert.ok(collectLegacySignatures("legacy.css", "font-family: 'Caveat', cursive;").includes("legacy-font-caveat"));
  assert.ok(collectLegacySignatures("legacy.css", "color: var(--sage-300);").includes("legacy-token-namespace"));
  assert.ok(collectLegacySignatures("legacy.css", "background: #FBF7F0;").includes("legacy-color-canvas"));
  assert.ok(collectLegacySignatures("legacy.tsx", "className=\"rounded-pill\"").includes("legacy-rounded-pill"));
  assert.ok(collectLegacySignatures("legacy.md", "Use a doodle, squiggle, or wavy band.").includes("legacy-shape-language"));
  assert.ok(collectLegacySignatures("legacy.md", "See docs/homa-design/tokens/colors.md").includes("legacy-design-doc-path"));
});

test("brand residue guard has no active findings", () => {
  assert.deepEqual(collectLegacyFontPathResidue(), []);
  assert.deepEqual(collectBrandResidueFindings(), []);
});

test("delivery delta reports only legacy language introduced by the change", () => {
  const before = '<div className="rounded-pill">Plan</div>';
  const unchangedLegacy = '<div className="rounded-pill">Choose an event or activity</div>';
  const introducedLegacy = '<div className="rounded-pill bg-[var(--sage-500)]">Choose an event or activity</div>';

  assert.deepEqual(introducedBrandResidue("planner.tsx", before, unchangedLegacy), []);
  assert.deepEqual(
    introducedBrandResidue("planner.tsx", before, introducedLegacy).map(({ signature }) => signature),
    ["legacy-token-namespace"],
  );
});

test("full-tree audit keeps quarantined evidence out of the active scan", () => {
  const findings = collectBrandResidueFindings("full");
  const paths = collectLegacyFontPathResidue("full");
  assert.ok(findings.every(({ path }) => !path.startsWith("docs/homa-design/evidence/")));
  assert.ok(paths.every((path) => !path.startsWith("docs/homa-design/evidence/")));
  assert.ok(
    findings.some(({ path, signature }) => path === "apps/web/app/manifest.ts" && signature === "legacy-color-canvas"),
    "full-tree eradication audit must report unchanged baseline-era sources",
  );
});
