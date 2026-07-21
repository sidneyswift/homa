#!/usr/bin/env node
// Validates Marble taxonomy data integrity.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");

function loadJson(name) {
  return JSON.parse(readFileSync(join(dataDir, name), "utf-8"));
}

let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error(`  FAIL: ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  WARN: ${msg}`);
  warnings++;
}

function pass(msg) {
  console.log(`  PASS: ${msg}`);
}

// Load data
const topics = loadJson("topics.json");
const deps = loadJson("dependencies.json");
const standards = loadJson("curriculum-standards.json");
const clusters = loadJson("clusters.json");
const manifest = loadJson("manifest.json");

const topicIds = new Set(topics.topics.map((t) => t.id));

// 1. Referential integrity for dependencies
console.log("1. Checking dependency referential integrity...");
let depErrors = 0;
for (const dep of deps.dependencies) {
  if (!topicIds.has(dep.topicId)) {
    fail(`Dependency references unknown topicId: ${dep.topicId}`);
    depErrors++;
  }
  if (!topicIds.has(dep.prerequisiteId)) {
    fail(`Dependency references unknown prerequisiteId: ${dep.prerequisiteId}`);
    depErrors++;
  }
  if (depErrors > 10) {
    fail("Too many referential integrity errors, stopping early.");
    break;
  }
}
if (depErrors === 0) pass(`All ${deps.dependencies.length} dependencies reference valid topics.`);

// 2. Standards references
console.log("2. Checking standards references...");
const allStandardKeys = new Set();
for (const curriculum of standards.curricula) {
  for (const s of curriculum.topics) {
    allStandardKeys.add(s.key);
  }
}
let standardErrors = 0;
for (const topic of topics.topics) {
  for (const code of topic.standards) {
    if (!allStandardKeys.has(code)) {
      fail(`Topic ${topic.id} references unknown standard: ${code}`);
      standardErrors++;
      if (standardErrors > 10) break;
    }
  }
  if (standardErrors > 10) {
    fail("Too many standard reference errors, stopping early.");
    break;
  }
}
if (standardErrors === 0) pass("All topic standard references are valid.");

// 3. DAG acyclicity check (DFS)
console.log("3. Checking for cycles in prerequisite graph...");
const forward = new Map();
for (const dep of deps.dependencies) {
  if (!forward.has(dep.topicId)) forward.set(dep.topicId, []);
  forward.get(dep.topicId).push(dep.prerequisiteId);
}

const WHITE = 0, GRAY = 1, BLACK = 2;
const color = new Map();
let hasCycle = false;

function dfs(node) {
  color.set(node, GRAY);
  for (const prereq of forward.get(node) ?? []) {
    const c = color.get(prereq) ?? WHITE;
    if (c === GRAY) {
      fail(`Cycle detected involving: ${node} -> ${prereq}`);
      hasCycle = true;
      return;
    }
    if (c === WHITE) {
      dfs(prereq);
      if (hasCycle) return;
    }
  }
  color.set(node, BLACK);
}

for (const id of topicIds) {
  if ((color.get(id) ?? WHITE) === WHITE) {
    dfs(id);
    if (hasCycle) break;
  }
}
if (!hasCycle) pass("Prerequisite graph is acyclic (DAG).");

// 4. Mapping completeness
console.log("4. Checking mapping completeness...");
const MARBLE_TO_HOMA = {
  "Mathematics": "math",
  "English": null, // has sub-domain mapping
  "Science": "science",
  "History": "social_studies",
  "Personal & Social Development": "social_emotional",
  "Life Skills": "self_care",
  "Learning to Learn": "executive_function",
  "Computing": "computer_science",
  // Inspo-flywheel addition (2026-07-20): Blossom & Root Level 0 introduced
  // Marble-style Art and Music enrichment topics; Homa's bank subjects are
  // "art" and "music" (see packages/core/src/map/content.ts).
  "Art": "art",
  "Music": "music",
};

let unmapped = 0;
for (const topic of topics.topics) {
  const subjectMapped = MARBLE_TO_HOMA[topic.subject];
  if (subjectMapped === undefined) {
    fail(`Topic ${topic.id} has unmapped subject: ${topic.subject}`);
    unmapped++;
  }
}
if (unmapped === 0) pass("All topics have mapped subjects.");

// 5. Manifest checksums
console.log("5. Checking manifest checksums...");
let checksumErrors = 0;
for (const [filename, entry] of Object.entries(manifest.files)) {
  const filePath = join(dataDir, filename);
  try {
    const content = readFileSync(filePath);
    const hash = createHash("sha256").update(content).digest("hex");
    if (hash !== entry.sha256) {
      fail(`Checksum mismatch for ${filename}: expected ${entry.sha256}, got ${hash}`);
      checksumErrors++;
    }
  } catch {
    fail(`Cannot read file for checksum: ${filename}`);
    checksumErrors++;
  }
}
if (checksumErrors === 0) pass("All manifest checksums match.");

// Summary
console.log("");
console.log(`Validation complete: ${errors} errors, ${warnings} warnings.`);
process.exit(errors > 0 ? 1 : 0);
