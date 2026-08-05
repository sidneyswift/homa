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
  for (const rule of ["authoring", "artifacts", "providers", "admin", "marketing", "published-content", "public-web", "native", "external-channels"]) {
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

test("published blog content cannot disappear behind the classifier", () => {
  const mutated = structuredClone(manifest) as BrandSurfaceManifest;
  mutated.surfaces = mutated.surfaces.filter((surface) => {
    const path = surface.paths[0] ?? "";
    return !path.startsWith("apps/web/app/blog/")
      && !path.startsWith("apps/web/content/blog/")
      && path !== "apps/web/lib/blog.ts"
      && path !== "apps/web/lib/blog-clusters.ts";
  });
  const report = buildBrandInventoryCoverageReport(mutated);
  assert.equal(report.status, "fail");
  assert.ok(report.issues.some((issue) => issue.code === "coverage-minimum" && issue.message.startsWith("published-content requires")));
  assert.ok(report.issues.some((issue) => issue.code === "coverage-type" && issue.message.includes("published-content is missing a route")));
});

test("public and authenticated web route boundaries fail closed", () => {
  const mutated = structuredClone(manifest) as BrandSurfaceManifest;
  const landing = mutated.surfaces.find((surface) => surface.paths[0] === "apps/web/app/page.tsx");
  const app = mutated.surfaces.find((surface) => surface.paths[0] === "apps/web/app/app/page.tsx");
  assert.ok(landing && app);
  landing.reachability = "authenticated";
  landing.audiences = ["family"];
  landing.deliveryState = "controlled-current";
  app.reachability = "public";
  app.audiences = ["public"];
  app.deliveryState = "revocable-public";
  const report = buildBrandInventoryCoverageReport(mutated);
  const boundaryIssues = report.issues.filter((issue) => issue.code === "route-boundary");
  assert.ok(boundaryIssues.some((issue) => issue.surfacePath === "apps/web/app/page.tsx"));
  assert.ok(boundaryIssues.some((issue) => issue.surfacePath === "apps/web/app/app/page.tsx"));
});

test("an intercepting route cannot enter the manifest as public", () => {
  const mutated = structuredClone(manifest) as BrandSurfaceManifest;
  const landing = mutated.surfaces.find((surface) => surface.paths[0] === "apps/web/app/page.tsx");
  assert.ok(landing);
  landing.paths = ["apps/web/app/@modal/(.)app/page.tsx"];
  landing.reachability = "public";
  landing.audiences = ["public"];
  landing.deliveryState = "revocable-public";
  const report = buildBrandInventoryCoverageReport(mutated);
  assert.ok(report.issues.some((issue) =>
    issue.code === "route-intercept-unresolved"
    && issue.surfacePath === "apps/web/app/@modal/(.)app/page.tsx"));
});

test("catch-all inventory rows are rejected", () => {
  const mutated = structuredClone(manifest) as BrandSurfaceManifest;
  mutated.surfaces[0]!.paths = ["apps/web/**/miscellaneous.tsx"];
  const report = buildBrandInventoryCoverageReport(mutated);
  assert.ok(report.issues.some((issue) => issue.code === "catch-all-row"));
});

test("semantic catch-alls fail even when they contain no wildcard syntax", () => {
  const mutated = structuredClone(manifest) as BrandSurfaceManifest;
  mutated.surfaces[0]!.paths = ["provider:social-accounts"];
  const report = buildBrandInventoryCoverageReport(mutated);
  assert.ok(report.issues.some((issue) => issue.code === "semantic-catch-all-row"));
});

test("source provenance cannot borrow commit data across row states", () => {
  const mutated = structuredClone(manifest) as BrandSurfaceManifest;
  const committed = mutated.surfaces.find((surface) => surface.evidenceMetadata.environment === "git-source-commit");
  const synthetic = mutated.surfaces.find((surface) => surface.evidenceMetadata.environment === "inventory-only-no-external-observation");
  assert.ok(committed && synthetic);
  committed.evidenceMetadata.sourceCommitTimestamp = null;
  synthetic.evidenceMetadata.sourceCommitSha = "0".repeat(40);
  const report = buildBrandInventoryCoverageReport(mutated);
  assert.ok(report.issues.some((issue) => issue.code === "invalid-source-provenance"));
  assert.ok(report.issues.some((issue) => issue.code === "unexpected-source-provenance"));
});

test("Git timestamps cannot impersonate a real surface observation", () => {
  const mutated = structuredClone(manifest) as BrandSurfaceManifest;
  const surface = mutated.surfaces[0];
  assert.ok(surface);
  surface.evidenceMetadata.observedAt = "2026-08-04T12:00:00Z";
  const report = buildBrandInventoryCoverageReport(mutated);
  assert.ok(report.issues.some((issue) => issue.code === "unreceipted-observation"));
});

test("manifest shape changes require the current schema version", () => {
  const mutated = structuredClone(manifest) as BrandSurfaceManifest;
  mutated.schemaVersion = 1 as never;
  const report = buildBrandInventoryCoverageReport(mutated);
  assert.ok(report.issues.some((issue) => issue.code === "schema-version"));
});
