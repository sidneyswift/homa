#!/usr/bin/env node
// Syncs upstream Marble taxonomy data into packages/taxonomy/data/.

import { execSync } from "node:child_process";
import { readFileSync, copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");

console.log("Cloning upstream Marble taxonomy...");
const tmpDir = mkdtempSync(join(tmpdir(), "marble-taxonomy-"));
try {
  execSync(`git clone --depth 1 https://github.com/withmarbleapp/os-taxonomy.git ${tmpDir}`, {
    stdio: "pipe",
  });

  const files = ["topics.json", "dependencies.json", "curriculum-standards.json", "clusters.json", "manifest.json"];
  const changes = [];

  for (const file of files) {
    const src = join(tmpDir, "data", file);
    const dest = join(dataDir, file);

    const srcContent = readFileSync(src);
    let destContent;
    try {
      destContent = readFileSync(dest);
    } catch {
      destContent = Buffer.alloc(0);
    }

    const srcHash = createHash("sha256").update(srcContent).digest("hex");
    const destHash = createHash("sha256").update(destContent).digest("hex");

    if (srcHash !== destHash) {
      copyFileSync(src, dest);
      changes.push(`  UPDATED: ${file} (${srcHash.slice(0, 8)}...)`);
    } else {
      changes.push(`  UNCHANGED: ${file}`);
    }
  }

  console.log("\nSync results:");
  for (const c of changes) console.log(c);

  // Verify checksums against manifest
  const manifest = JSON.parse(readFileSync(join(dataDir, "manifest.json"), "utf-8"));
  let ok = true;
  for (const [filename, entry] of Object.entries(manifest.files)) {
    const content = readFileSync(join(dataDir, filename));
    const hash = createHash("sha256").update(content).digest("hex");
    if (hash !== entry.sha256) {
      console.error(`  CHECKSUM MISMATCH: ${filename}`);
      ok = false;
    }
  }
  if (ok) console.log("\nAll checksums verified.");
  else {
    console.error("\nChecksum verification failed!");
    process.exit(1);
  }
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
