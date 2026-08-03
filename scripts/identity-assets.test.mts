import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { identityAssetCatalog, identityConsumers, identitySafeAreas } from "../packages/design/src/contract/identity.ts";

const manifestPath = new URL("../docs/homa-design/evidence/identity-assets.json", import.meta.url);
const contractPath = new URL("../packages/design/src/contract/identity.ts", import.meta.url);

async function manifest() {
  return JSON.parse(await readFile(manifestPath, "utf8")) as {
    schemaVersion: number;
    designEra: string;
    sourceFingerprint: string;
    sourceOfTruth: Record<string, string>;
    safeAreas: Record<string, { viewBox: string; clearSpace: number; use: string }>;
    consumers: Array<{ path: string; authority: string; role: string }>;
    assets: Array<{
      id: string;
      path: string;
      dimensions: { width: number; height: number };
      expectedDimensions: { width: number; height: number };
      outputHash: string;
      perceptualHash: string;
      perceptualHashAlgorithm: string;
      lifecycle: string;
      destination: string;
      appearance: string;
      safeArea: string;
    }>;
    geometryAudit: { activeDuplicates: unknown[]; retiredDuplicates: unknown[]; obsoleteOutputs: unknown[] };
    cleanRegeneration: { status: string; generate: string; check: string };
  };
}

test("identity manifest covers every generated asset exactly once", async () => {
  const value = await manifest();
  assert.equal(value.schemaVersion, 1);
  assert.equal(value.designEra, "quiet-authority-v1");
  assert.equal(value.assets.length, identityAssetCatalog.length);
  assert.deepEqual(value.assets.map((asset) => asset.id), identityAssetCatalog.map((asset) => asset.id));
  assert.deepEqual(value.assets.map((asset) => asset.path), identityAssetCatalog.map((asset) => asset.path));
  assert.match(value.sourceFingerprint, /^[0-9a-f]{64}$/);
});

test("every output records physical dimensions, hashes, safe area, appearance, and lifecycle", async () => {
  const value = await manifest();
  for (const asset of value.assets) {
    assert.deepEqual(asset.dimensions, asset.expectedDimensions, asset.path);
    assert.match(asset.outputHash, /^[0-9a-f]{64}$/, asset.path);
    assert.match(asset.perceptualHash, /^[0-9a-f]{16}$/, asset.path);
    assert.equal(asset.perceptualHashAlgorithm, "dhash-9x8-gray-v1", asset.path);
    assert.equal(asset.lifecycle, "active-derived", asset.path);
    assert.ok(asset.destination, asset.path);
    assert.ok(asset.appearance, asset.path);
    assert.ok(asset.safeArea in identitySafeAreas, asset.path);
  }
});

test("identity consumers are listed and active geometry has no duplicate finding", async () => {
  const value = await manifest();
  assert.deepEqual(value.consumers, identityConsumers);
  assert.deepEqual(value.geometryAudit.activeDuplicates, []);
  assert.deepEqual(value.geometryAudit.obsoleteOutputs, []);
  assert.ok(value.geometryAudit.retiredDuplicates.length >= 1, "retired geometry must remain visible as quarantined evidence");
  assert.equal(value.sourceOfTruth.identityContract, "packages/design/src/contract/identity.ts");
  assert.equal(value.sourceOfTruth.logoGeometry, "packages/design/src/contract/brand.ts#logoGeometry");
});

test("the checked generator is byte-stable in a clean checkout", () => {
  execFileSync("node", ["--experimental-strip-types", "scripts/identity-assets.mts", "--check"], {
    cwd: new URL("..", import.meta.url),
    stdio: "pipe",
  });
});

test("contract declares safe area and canonical identity metadata", async () => {
  const source = await readFile(contractPath, "utf8");
  for (const name of ["standard", "tight", "avatar", "lockup", "adaptiveForeground", "monochrome", "fullBleed", "printInline"]) {
    assert.ok(source.includes(`${name}:`), `missing safe area ${name}`);
  }
  assert.ok(source.includes("master-homa-house"));
  assert.ok(source.includes("master-homa-lockup"));
  assert.ok(source.includes("master-homa-house-silhouette"));
});
