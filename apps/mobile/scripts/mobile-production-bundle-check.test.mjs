import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { inspectProductionBundle } from "./mobile-production-bundle-check.mjs";

const SOURCE = "a".repeat(40);

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), "homa-mobile-bundle-"));
  mkdirSync(resolve(root, "_expo/static/js/ios"), { recursive: true });
  writeFileSync(resolve(root, "metadata.json"), "{}\n");
  writeFileSync(resolve(root, "_expo/static/js/ios/app.js"), "console.log('Homa');\n");
  writeFileSync(resolve(root, "_expo/static/js/ios/app.js.map"), JSON.stringify({
    version: 3,
    sources: ["src/app.tsx"],
    sourcesContent: ["export const app = 'Homa';"],
    names: [],
    mappings: "",
  }));
  return root;
}

test("a complete iOS export produces a deterministic portable manifest", () => {
  const root = fixture();
  try {
    const first = inspectProductionBundle({ exportDir: root, sourceSha: SOURCE });
    const second = inspectProductionBundle({ exportDir: root, sourceSha: SOURCE });
    assert.equal(first.status, "pass");
    assert.equal(first.bundleCount, 1);
    assert.equal(first.sourceMapCount, 1);
    assert.equal(first.bundleFingerprint, second.bundleFingerprint);
    assert.match(first.bundleFingerprint, /^[0-9a-f]{64}$/u);
    assert.deepEqual(first.files.map(({ path }) => path), [
      "_expo/static/js/ios/app.js",
      "_expo/static/js/ios/app.js.map",
      "metadata.json",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing metadata, bundle, or source map fails closed", () => {
  const root = fixture();
  try {
    rmSync(resolve(root, "metadata.json"));
    assert.throws(() => inspectProductionBundle({ exportDir: root, sourceSha: SOURCE }), /missing metadata/u);
    writeFileSync(resolve(root, "metadata.json"), "{}\n");
    rmSync(resolve(root, "_expo/static/js/ios/app.js.map"));
    assert.throws(() => inspectProductionBundle({ exportDir: root, sourceSha: SOURCE }), /source map/u);
    rmSync(resolve(root, "_expo/static/js/ios/app.js"));
    assert.throws(() => inspectProductionBundle({ exportDir: root, sourceSha: SOURCE }), /no iOS/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("malformed or incomplete source maps fail closed", () => {
  const root = fixture();
  try {
    const map = resolve(root, "_expo/static/js/ios/app.js.map");
    writeFileSync(map, "not-json");
    assert.throws(() => inspectProductionBundle({ exportDir: root, sourceSha: SOURCE }), /valid JSON/u);
    writeFileSync(map, JSON.stringify({ version: 3, sources: ["src/app.tsx"] }));
    assert.throws(() => inspectProductionBundle({ exportDir: root, sourceSha: SOURCE }), /sourcesContent/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("lab, fixture, and prototype product sources cannot enter release bytes", () => {
  const root = fixture();
  try {
    const map = resolve(root, "_expo/static/js/ios/app.js.map");
    for (const source of [
      "../../../src/features/voice/labs/voice-shell.tsx",
      "apps/mobile/src/features/prototypes/new-shell.tsx",
      "src/features/fixtures/family.ts",
      "src/features/voice/voice-shell-547-lab.tsx",
    ]) {
      writeFileSync(map, JSON.stringify({
        version: 3,
        sources: [source],
        sourcesContent: ["export const hidden = true;"],
        names: [],
        mappings: "",
      }));
      assert.throws(() => inspectProductionBundle({ exportDir: root, sourceSha: SOURCE }), /forbidden|retired/iu);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("secret names and values cannot enter release bytes", () => {
  const root = fixture();
  try {
    const bundle = resolve(root, "_expo/static/js/ios/app.js");
    writeFileSync(bundle, "const key = 'SUPABASE_DB_PASSWORD';\n");
    assert.throws(() => inspectProductionBundle({ exportDir: root, sourceSha: SOURCE }), /forbidden secret name/u);
    writeFileSync(bundle, "const key = 'private-value-123';\n");
    assert.throws(() => inspectProductionBundle({
      exportDir: root,
      sourceSha: SOURCE,
      environment: { EXPO_TOKEN: "private-value-123" },
    }), /value of EXPO_TOKEN/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
