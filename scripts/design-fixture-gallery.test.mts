import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { brandChannels } from "../packages/design/src/contract/channels.ts";
import { fixtureGalleryAssets } from "../packages/design/src/fixtures.ts";
import type { FixtureGalleryManifest } from "./design-fixture-gallery.mts";
import {
  buildFixtureGalleryManifest,
  validateFixtureGallery,
} from "./design-fixture-gallery.mts";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(root, "docs/homa-design/evidence/fixture-gallery.json");
const committed = JSON.parse(readFileSync(manifestPath, "utf8")) as FixtureGalleryManifest;

test("fixture gallery covers every contract category and profile obligation", () => {
  const report = validateFixtureGallery(committed);
  assert.equal(report.status, "pass", JSON.stringify(report.issues, null, 2));
  assert.equal(committed.fixtureCount, Object.values(committed.categories).reduce((total, fixtures) => total + fixtures.length, 0));
  assert.ok(report.categoryCounts.atoms >= 100);
  assert.equal(report.categoryCounts.assets, fixtureGalleryAssets.length);
  assert.equal(report.categoryCounts.channels, brandChannels.length);
  assert.equal(report.categoryCounts.reductions, brandChannels.length);
  assert.equal(report.categoryCounts.profiles, committed.profileMatrix.length);
  assert.equal(committed.categories.profiles.length, committed.profileMatrix.length);
});

test("generated manifest is byte-stable from the typed contract", () => {
  assert.deepEqual(committed, buildFixtureGalleryManifest());
});

test("a missing state or profile fails closed", () => {
  const mutated = structuredClone(committed) as FixtureGalleryManifest;
  mutated.categories.states = mutated.categories.states.slice(1);
  mutated.categories.profiles = mutated.categories.profiles.filter((fixture) => fixture.id !== "profile-web-forced-colors");
  const report = validateFixtureGallery(mutated);
  assert.equal(report.status, "fail");
  assert.ok(report.issues.some((issue) => issue.code === "missing-fixture"));
  assert.ok(report.issues.some((issue) => issue.code === "profile-fixture-count"));
  assert.ok(report.issues.some((issue) => issue.code === "missing-required-profile"));
});

test("a changed source or checksum cannot masquerade as current evidence", () => {
  const mutated = structuredClone(committed) as FixtureGalleryManifest;
  const fixture = mutated.categories.primitives[0];
  assert.ok(fixture);
  fixture.source = "apps/web/components/design/InventedPrimitive.tsx";
  const report = validateFixtureGallery(mutated);
  assert.equal(report.status, "fail");
  assert.ok(report.issues.some((issue) => issue.code === "fixture-checksum" && issue.fixtureId === fixture.id));
  assert.ok(report.issues.some((issue) => issue.code === "manifest-checksum"));
});
