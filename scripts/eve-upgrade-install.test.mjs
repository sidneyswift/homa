import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { assertDependenciesRestored, assertInstalledProfile, dependencyFiles, existingStoreArguments,
  restoreDependencies, selectDependencies, snapshotDependencies, upgradeProfile, workspaceWithPatch } from "./eve-upgrade-install.mjs";

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "eve-upgrade-install-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const manifest = { dependencies: { eve: "0.19.0", ai: "^7.0.14", unrelated: "1.2.3" },
    devDependencies: { "eve-legacy-protocol": "npm:eve@0.19.0" } };
  const initial = {
    "apps/web/package.json": JSON.stringify(manifest, null, 4) + "\n\n",
    "pnpm-workspace.yaml": 'packages:\n  - "apps/*"\n\npatchedDependencies:\n  eve@0.19.0: patches/eve@0.19.0.patch\n  other@1.0.0: patches/other.patch\n',
    "pnpm-lock.yaml": "original exact lock bytes\n",
  };
  for (const [relative, text] of Object.entries(initial)) {
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    writeFileSync(path.join(root, relative), text);
  }
  mkdirSync(path.join(root, "patches"));
  for (const version of ["0.19.0", "0.54.3"]) writeFileSync(path.join(root, `patches/eve@${version}.patch`), "synthetic reviewed patch\n");
  const backup = path.join(root, "backup");
  return { root, initial, snapshot: snapshotDependencies(root, backup), backup };
}

test("candidate changes Eve and AI together and retains the legacy alias and patch", t => {
  const f = fixture(t);
  selectDependencies(f.root, f.snapshot, "0.54.3");
  const manifest = JSON.parse(readFileSync(path.join(f.root, "apps/web/package.json")));
  assert.deepEqual(manifest.dependencies, { eve: "0.54.3", ai: "7.0.93", unrelated: "1.2.3" });
  assert.equal(manifest.devDependencies["eve-legacy-protocol"], "npm:eve@0.19.0");
  const workspace = readFileSync(path.join(f.root, "pnpm-workspace.yaml"), "utf8");
  for (const key of ["eve@0.54.3", "eve@0.19.0", "other@1.0.0"]) assert.ok(workspace.includes(key));
  assert.equal(workspaceWithPatch(workspace, upgradeProfile("0.54.3")), workspace);
});

test("restoration recovers exact manifest, workspace, and lock bytes after a failed install", t => {
  const f = fixture(t);
  try {
    selectDependencies(f.root, f.snapshot, "0.54.3");
    writeFileSync(path.join(f.root, "pnpm-lock.yaml"), "partial candidate lock");
    throw new Error("synthetic install failure");
  } catch {
    restoreDependencies(f.root, f.snapshot);
  }
  assertDependenciesRestored(f.root, f.snapshot);
  for (const relative of dependencyFiles) assert.equal(readFileSync(path.join(f.backup, relative), "utf8"), f.initial[relative]);
  writeFileSync(path.join(f.root, "pnpm-lock.yaml"), "unexpected reinstall change");
  assert.throws(() => assertDependenciesRestored(f.root, f.snapshot), /restoration changed/);
});

test("unsupported versions and missing patches fail before mutation", t => {
  const f = fixture(t);
  for (const version of ["latest", "constructor", "__proto__"]) {
    assert.throws(() => selectDependencies(f.root, f.snapshot, version), /No reviewed/);
  }
  rmSync(path.join(f.root, "patches/eve@0.54.3.patch"));
  assert.throws(() => selectDependencies(f.root, f.snapshot, "0.54.3"), /Missing reviewed patch/);
  assertDependenciesRestored(f.root, f.snapshot);
});

test("ambiguous workspace mappings are rejected instead of overwritten", () => {
  const profile = upgradeProfile("0.54.3");
  for (const raw of ["packages: []\n", "patchedDependencies:\n  eve@0.54.3: unexpected.patch\n",
    "patchedDependencies:\nother:\n  eve@0.54.3: patches/eve@0.54.3.patch\n",
    "patchedDependencies:\n  eve@0.54.3: patches/eve@0.54.3.patch\n  eve@0.54.3: patches/eve@0.54.3.patch\n"]) {
    assert.throws(() => workspaceWithPatch(raw, profile));
  }
});

test("installed profile verifies both packages and the existing cache avoids a store switch", t => {
  const f = fixture(t);
  for (const [name, version] of [["eve", "0.54.3"], ["ai", "7.0.93"]]) {
    const directory = path.join(f.root, "apps/web/node_modules", name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, "package.json"), JSON.stringify({ name, version }));
  }
  assertInstalledProfile(f.root, upgradeProfile("0.54.3"));
  assert.throws(() => assertInstalledProfile(f.root, upgradeProfile("0.19.0")));
  mkdirSync(path.join(f.root, "node_modules"));
  writeFileSync(path.join(f.root, "node_modules/.modules.yaml"), "storeDir: /synthetic/cache/v10\n");
  assert.deepEqual(existingStoreArguments(f.root), ["--store-dir", "/synthetic/cache"]);
});
