/**
 * Generates data/homa-slug-map.json: the frozen Marble-id to Homa-id
 * assignment (founder ruling 2026-07-10: ids are Homa's own, bank
 * convention `<subject>.<slug>`; `mt_` keys never become identifiers).
 *
 * APPEND-ONLY: existing entries are never changed or removed, so Homa ids
 * survive upstream re-syncs and renames. New upstream topics get fresh
 * slugs, deduped within their subject and against the shipped bank's item
 * ids (child_answers rows key off those, collisions are forbidden).
 *
 * Usage: pnpm taxonomy:slugs   (tsx packages/taxonomy/scripts/generate-slug-map.mts)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MARBLE_DOMAIN_MAP, marbleDomainKey } from "../src/mapping.js";
import type { MarbleTopicsFile, SlugMapFile } from "../src/types.js";
import { MAP_SUBJECTS } from "../../core/src/map/content.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "data");
const mapPath = join(dataDir, "homa-slug-map.json");

const topicsFile = JSON.parse(
  readFileSync(join(dataDir, "topics.json"), "utf-8"),
) as MarbleTopicsFile;

const existing: SlugMapFile = existsSync(mapPath)
  ? (JSON.parse(readFileSync(mapPath, "utf-8")) as SlugMapFile)
  : {};

function kebab(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

// Ids already spoken for: shipped bank item ids + already-frozen slugs.
const taken = new Set<string>();
for (const subject of MAP_SUBJECTS) {
  for (const item of subject.items) taken.add(item.id);
}
for (const homaId of Object.values(existing)) taken.add(homaId);

const next: SlugMapFile = { ...existing };
let added = 0;
const skipped: string[] = [];

for (const topic of topicsFile.topics) {
  if (next[topic.id]) continue;
  const target = MARBLE_DOMAIN_MAP[marbleDomainKey(topic.subject, topic.domain)];
  if (!target) {
    skipped.push(`${topic.id} (${topic.subject} > ${topic.domain})`);
    continue;
  }
  const base = kebab(topic.name);
  let candidate = `${target.subject}.${base}`;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${target.subject}.${base}-${n}`;
    n += 1;
  }
  taken.add(candidate);
  next[topic.id] = candidate;
  added += 1;
}

const sorted = Object.fromEntries(
  Object.entries(next).sort(([a], [b]) => a.localeCompare(b)),
);
writeFileSync(mapPath, JSON.stringify(sorted, null, 2) + "\n");

console.log(
  `slug map: ${Object.keys(sorted).length} entries (${added} added, ${Object.keys(existing).length} kept)`,
);
if (skipped.length > 0) {
  console.error(`UNMAPPED (no MARBLE_DOMAIN_MAP entry): ${skipped.length}`);
  for (const line of skipped.slice(0, 10)) console.error(`  ${line}`);
  process.exit(1);
}
