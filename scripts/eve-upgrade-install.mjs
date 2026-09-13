import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const dependencyFiles = ["apps/web/package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml"];
const profiles = {
  "0.19.0": { ai: "7.0.14", nodeMajor: 24 },
  "0.54.3": { ai: "7.0.93", nodeMajor: 24 },
};

export function upgradeProfile(version) {
  const profile = Object.hasOwn(profiles, version) ? profiles[version] : undefined;
  if (!profile) throw new Error(`No reviewed dependency profile for Eve ${version}. Review its peers and patches first.`);
  return { eve: version, ...profile, patch: `patches/eve@${version}.patch` };
}

export function snapshotDependencies(root, backupDirectory) {
  const files = new Map();
  for (const relative of dependencyFiles) {
    const bytes = readFileSync(path.join(root, relative));
    files.set(relative, bytes);
    const backup = path.join(backupDirectory, relative);
    mkdirSync(path.dirname(backup), { recursive: true });
    writeFileSync(backup, bytes);
  }
  return files;
}

export function restoreDependencies(root, snapshot) {
  for (const relative of dependencyFiles) {
    const bytes = snapshot.get(relative);
    assert.ok(Buffer.isBuffer(bytes), `Missing dependency backup: ${relative}`);
  }
  for (const relative of dependencyFiles) writeFileSync(path.join(root, relative), snapshot.get(relative));
}

export function assertDependenciesRestored(root, snapshot) {
  for (const relative of dependencyFiles) {
    assert.ok(readFileSync(path.join(root, relative)).equals(snapshot.get(relative)),
      `Dependency restoration changed ${relative}; original bytes are in the backup directory`);
  }
}

/** Add a candidate mapping while retaining the legacy test alias's patch. */
export function workspaceWithPatch(raw, profile) {
  const lines = raw.split("\n");
  const heading = lines.indexOf("patchedDependencies:");
  assert.ok(heading >= 0, "Expected the reviewed patchedDependencies mapping");
  const key = `eve@${profile.eve}`;
  const matches = lines.map((line, index) => ({ line, index }))
    .filter(({ line }) => line.includes(key));
  assert.ok(matches.length <= 1, `Duplicate or ambiguous patch mapping for ${key}`);
  if (matches.length) {
    const { line, index } = matches[0];
    const quoteForms = value => [value, `'${value}'`, `"${value}"`];
    const expected = new Set(quoteForms(key).flatMap(quotedKey =>
      quoteForms(profile.patch).map(quotedPath => `  ${quotedKey}: ${quotedPath}`)));
    assert.ok(index > heading && !lines.slice(heading + 1, index).some(value => /^\S/.test(value)),
      `Patch mapping for ${key} is outside patchedDependencies`);
    assert.ok(expected.has(line.trimEnd()), `Unexpected patch path for ${key}`);
    return raw;
  }
  lines.splice(heading + 1, 0, `  ${key}: ${profile.patch}`);
  return lines.join("\n");
}

/** Prepare all contents before either manifest is changed. The caller installs. */
export function selectDependencies(root, snapshot, version) {
  const profile = upgradeProfile(version);
  assert.ok(existsSync(path.join(root, profile.patch)), `Missing reviewed patch: ${profile.patch}`);
  const manifest = JSON.parse(snapshot.get("apps/web/package.json").toString("utf8"));
  assert.equal(typeof manifest.dependencies?.eve, "string");
  assert.equal(typeof manifest.dependencies?.ai, "string");
  manifest.dependencies.eve = profile.eve;
  manifest.dependencies.ai = profile.ai;
  const workspace = workspaceWithPatch(snapshot.get("pnpm-workspace.yaml").toString("utf8"), profile);
  writeFileSync(path.join(root, "apps/web/package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(path.join(root, "pnpm-workspace.yaml"), workspace);
  return profile;
}

export function installedVersions(root) {
  return Object.fromEntries(["eve", "ai"].map(name => {
    const metadata = JSON.parse(readFileSync(path.join(root, `apps/web/node_modules/${name}/package.json`), "utf8"));
    assert.equal(metadata.name, name);
    return [name, metadata.version];
  }));
}

export function assertInstalledProfile(root, profile) {
  assert.deepEqual(installedVersions(root), { eve: profile.eve, ai: profile.ai });
}

/** pnpm records a versioned store directory; its CLI expects the parent. */
export function existingStoreArguments(root) {
  const file = path.join(root, "node_modules/.modules.yaml");
  if (!existsSync(file)) return [];
  const match = /^storeDir: (.+)$/m.exec(readFileSync(file, "utf8"));
  assert.ok(match, "Cannot find the checkout's existing pnpm store");
  const stored = match[1].replace(/^['"]|['"]$/g, "");
  assert.ok(path.isAbsolute(stored) && /\/v\d+$/.test(stored), "Unrecognized pnpm store directory");
  return ["--store-dir", path.dirname(stored)];
}
