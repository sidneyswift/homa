import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

import type { BrandSurfaceManifest } from "../packages/design/src/surfaces.ts";
import { buildBrandInventoryCoverageReport } from "./brand-inventory-completeness-check.mts";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "docs/homa-design/evidence/surfaces.json"), "utf8")) as BrandSurfaceManifest;

test("inventory completeness covers every cross-surface domain", () => {
  const report = buildBrandInventoryCoverageReport(manifest);
  assert.equal(report.status, "pass", JSON.stringify(report.issues, null, 2));
  assert.ok(report.surfaceCount > 1_000);
  for (const rule of ["authoring", "artifacts", "providers", "admin", "marketing", "native", "external-channels"]) {
    assert.ok((report.rowsByRule[rule] ?? 0) > 0, `missing inventory domain: ${rule}`);
  }
});

test("criticality and delivery floors reject silent under-classification", () => {
  const mutated = structuredClone(manifest) as BrandSurfaceManifest;
  const signin = mutated.surfaces.find((surface) => surface.paths[0] === "apps/web/app/signin/page.tsx");
  assert.ok(signin);
  signin.criticality = "supporting";
  const external = mutated.surfaces.find((surface) => surface.paths[0] === "provider:stripe-checkout-and-portal");
  assert.ok(external);
  external.deliveryState = "controlled-current";
  const report = buildBrandInventoryCoverageReport(mutated);
  assert.ok(report.issues.some((issue) => issue.code === "criticality-underassigned"));
  assert.ok(report.issues.some((issue) => issue.code === "external-delivery-state"));
});

test("a disappearing domain fails closed instead of passing on manifest shape", () => {
  const mutated = structuredClone(manifest) as BrandSurfaceManifest;
  mutated.surfaces = mutated.surfaces.filter((surface) => !surface.paths[0]?.startsWith("apps/mobile/"));
  const report = buildBrandInventoryCoverageReport(mutated);
  assert.equal(report.status, "fail");
  assert.ok(report.issues.some((issue) => issue.code === "coverage-minimum" && issue.message.startsWith("native requires")));
  assert.ok(report.issues.some((issue) => issue.code === "coverage-type" && issue.message.includes("native is missing a screen")));
});

test("catch-all inventory rows are rejected", () => {
  const mutated = structuredClone(manifest) as BrandSurfaceManifest;
  mutated.surfaces[0]!.paths = ["apps/web/**/miscellaneous.tsx"];
  const report = buildBrandInventoryCoverageReport(mutated);
  assert.ok(report.issues.some((issue) => issue.code === "catch-all-row"));
});
