import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { brandCriticalities, brandDeliveryStates, brandDispositions, brandManifestTypes, type BrandSurfaceManifest } from "../packages/design/src/surfaces.ts";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "docs/homa-design/evidence/surfaces.json"), "utf8")) as BrandSurfaceManifest;
const legacyBaseline = JSON.parse(readFileSync(resolve(root, "docs/homa-design/evidence/legacy-baseline.json"), "utf8")) as { designEra: string; sourceCommit: string; records: Array<{ path: string; sourceHash: string | null; legacySignatures: string[] }> };

test("manifest IDs, paths, and ordering are unique and deterministic", () => {
  const paths = manifest.surfaces.map((surface) => surface.paths[0]!);
  const ids = manifest.surfaces.map((surface) => surface.id);
  assert.equal(new Set(paths).size, paths.length);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(paths, [...paths].sort((a, b) => a.localeCompare(b)));
});

test("manifest includes every required surface family", () => {
  const present = new Set(manifest.surfaces.map((surface) => surface.type));
  for (const type of brandManifestTypes) assert.ok(present.has(type), `missing surface type: ${type}`);
});

test("easy-to-miss raw HTML, metadata, and contact surfaces stay classified", () => {
  const paths = new Set(manifest.surfaces.flatMap((surface) => surface.paths));
  for (const path of [
    "apps/web/app/api/link-phone/route.ts",
    "apps/web/app/api/email/unsubscribe/route.ts",
    "apps/web/public/ai.txt",
    "apps/web/public/llms.txt",
    "apps/web/public/llms-full.txt",
    "apps/web/app/homa.vcf/route.ts",
    "supabase/templates/recovery.html",
  ]) assert.ok(paths.has(path), `unclassified hidden surface: ${path}`);
});

test("critical externally owned surfaces require a provider rollback rail", () => {
  const external = manifest.surfaces.filter((surface) => surface.reachability === "external");
  assert.ok(external.length > 0);
  for (const surface of external) {
    assert.ok(brandCriticalities.includes(surface.criticality));
    assert.ok(surface.rollbackBoundary.includes("provider") || surface.rollbackBoundary.includes("artifact"));
  }
});

test("manifest uses only the approved contract enums and records owned-input freshness", () => {
  assert.match(manifest.baselineSourceCommit, /^[0-9a-f]{40}$/);
  assert.match(manifest.ownedInputFingerprint, /^[0-9a-f]{64}$/);
  for (const surface of manifest.surfaces) {
    assert.ok(brandCriticalities.includes(surface.criticality));
    assert.ok(brandDispositions.includes(surface.disposition));
    assert.ok(brandDeliveryStates.includes(surface.deliveryState));
    assert.ok(surface.requiredStates.includes("default"));
    assert.equal(surface.ownerIssue.startsWith("gh#"), true);
  }
});

test("legacy signals are named and never silently discarded", () => {
  const signaled = manifest.surfaces.filter((surface) => surface.legacySignatures.length > 0);
  assert.ok(signaled.length > 0, "expected the baseline to find legacy identity signals");
  for (const surface of signaled) {
    for (const signal of surface.legacySignatures) assert.match(signal, /^legacy-/);
  }
});

test("legacy baseline is hash-specific and quarantined by design era", () => {
  assert.equal(legacyBaseline.designEra, "warm-playful-baseline");
  assert.equal(legacyBaseline.sourceCommit, manifest.baselineSourceCommit);
  assert.ok(legacyBaseline.records.length > 0);
  for (const record of legacyBaseline.records) {
    assert.match(record.path, /\S/);
    assert.match(record.sourceHash ?? "", /^[0-9a-f]{64}$/);
    assert.ok(record.legacySignatures.length > 0);
  }
});
