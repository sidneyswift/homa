/**
 * Curriculum atlas validator and catalog builder.
 *
 * Usage:
 *   pnpm atlas:index          validate everything, then write catalog.json
 *   pnpm check:atlas          validate only (exit 1 on any problem)
 *
 * Validates every profile under docs/homa-curriculum-atlas/curricula/ and
 * marketplaces/ against the front matter schema in methodology.md and the
 * enums in taxonomy.md, checks relative-link integrity and the repo dash
 * law across the whole atlas, then emits docs/homa-curriculum-atlas/
 * catalog.json (a generated file, never hand-edited) for product-side
 * consumption.
 *
 * The front matter grammar here is deliberately narrow (scalars, inline
 * arrays, block lists of scalars). Profiles are written to this shape by
 * the atlas methodology; anything fancier should fail loudly rather than
 * parse loosely.
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ATLAS_ROOT = join(REPO_ROOT, "docs", "homa-curriculum-atlas");
const CATALOG_PATH = join(ATLAS_ROOT, "catalog.json");
// A runtime-readable copy bundled into the app, since docs/ is not on the
// deployed function. find_curriculum_profile reads this. Generated
// together with the docs catalog so the two never drift.
const APP_CATALOG_PATH = join(
  REPO_ROOT,
  "apps/web/lib/curriculum/atlas-catalog.json",
);

const REQUIRED_KEYS = [
  "id",
  "name",
  "publisher",
  "category",
  "subjects",
  "grade_range",
  "approach_tags",
  "religious_orientation",
  "religious_notes",
  "format",
  "parent_involvement",
  "mastery_or_spiral",
  "price_band",
  "price_notes",
  "homa_tier",
  "status",
  "last_reviewed",
  "official_site",
  "sources",
] as const;

const LIST_KEYS = new Set(["subjects", "approach_tags", "format", "sources"]);

const ENUMS: Record<string, ReadonlySet<string>> = {
  category: new Set([
    "math",
    "language-arts",
    "science",
    "history-geography",
    "all-in-one",
    "online-digital",
    "preschool",
    "electives",
    "marketplace",
  ]),
  religious_orientation: new Set([
    "secular",
    "neutral",
    "faith-based-christian",
    "faith-based-other",
    "varies",
  ]),
  parent_involvement: new Set(["high", "medium", "low"]),
  mastery_or_spiral: new Set(["mastery", "spiral", "mixed", "n/a"]),
  price_band: new Set(["free", "$", "$$", "$$$", "$$$$"]),
  homa_tier: new Set(["flagship", "deep", "standard", "stub"]),
  status: new Set(["active", "legacy", "discontinued"]),
};

type Profile = Record<string, string | string[]> & {
  path: string;
  lines: number;
};

function walkMarkdown(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkMarkdown(full));
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out.sort();
}

function stripQuotes(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
  return v;
}

function parseInlineList(value: string, where: string, problems: string[]): string[] {
  const inner = value.trim().replace(/^\[/, "").replace(/\]$/, "").trim();
  if (inner === "") return [];
  if (/[\[\]]/.test(inner)) {
    problems.push(`${where}: nested brackets in inline list`);
    return [];
  }
  return inner.split(",").map((s) => stripQuotes(s));
}

/** Parses the narrow front matter grammar the methodology defines. */
function parseFrontMatter(
  text: string,
  where: string,
  problems: string[],
): { fields: Record<string, string | string[]>; keyOrder: string[] } | null {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    problems.push(`${where}: missing front matter block`);
    return null;
  }
  const fields: Record<string, string | string[]> = {};
  const keyOrder: string[] = [];
  const lines = match[1].split("\n");
  let pendingListKey: string | null = null;

  for (const line of lines) {
    if (/^\s*#/.test(line) || line.trim() === "") continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item) {
      if (!pendingListKey) {
        problems.push(`${where}: list item without a list key: ${line.trim()}`);
        continue;
      }
      (fields[pendingListKey] as string[]).push(stripQuotes(item[1]));
      continue;
    }
    const kv = line.match(/^([a-z_]+):(.*)$/);
    if (!kv) {
      problems.push(`${where}: unparseable front matter line: ${line.trim()}`);
      continue;
    }
    const key = kv[1];
    const rawValue = kv[2].trim();
    keyOrder.push(key);
    pendingListKey = null;
    if (rawValue === "") {
      fields[key] = [];
      pendingListKey = key;
    } else if (rawValue.startsWith("[")) {
      fields[key] = parseInlineList(rawValue, `${where}:${key}`, problems);
    } else {
      fields[key] = stripQuotes(rawValue);
    }
  }
  return { fields, keyOrder };
}

function validateProfile(path: string, problems: string[], seenIds: Map<string, string>): Profile | null {
  const rel = relative(REPO_ROOT, path);
  const text = readFileSync(path, "utf8");
  const parsed = parseFrontMatter(text, rel, problems);
  if (!parsed) return null;
  const { fields, keyOrder } = parsed;

  for (const key of REQUIRED_KEYS) {
    if (!(key in fields)) problems.push(`${rel}: missing key ${key}`);
  }
  const requiredInOrder = keyOrder.filter((k) => (REQUIRED_KEYS as readonly string[]).includes(k));
  const expectedOrder = (REQUIRED_KEYS as readonly string[]).filter((k) => requiredInOrder.includes(k));
  if (requiredInOrder.join(",") !== expectedOrder.join(",")) {
    problems.push(`${rel}: front matter keys out of schema order`);
  }
  for (const key of LIST_KEYS) {
    if (key in fields && !Array.isArray(fields[key])) {
      problems.push(`${rel}: ${key} must be a list`);
    }
  }
  for (const [key, allowed] of Object.entries(ENUMS)) {
    const value = fields[key];
    if (typeof value === "string" && !allowed.has(value)) {
      problems.push(`${rel}: invalid ${key} "${value}"`);
    }
  }

  const id = fields.id;
  if (typeof id === "string") {
    const stem = path.split("/").pop()!.replace(/\.md$/, "");
    if (id !== stem) problems.push(`${rel}: id "${id}" does not match filename`);
    const prior = seenIds.get(id);
    if (prior) problems.push(`${rel}: duplicate id "${id}" (also in ${prior})`);
    seenIds.set(id, rel);
  }

  const folder = dirname(path).split("/").pop()!;
  const category = fields.category;
  if (folder === "marketplaces") {
    if (category !== "marketplace") problems.push(`${rel}: marketplaces/ requires category marketplace`);
  } else if (typeof category === "string" && category !== folder) {
    problems.push(`${rel}: category "${category}" does not match folder "${folder}"`);
  }

  const reviewed = fields.last_reviewed;
  if (typeof reviewed !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(reviewed)) {
    problems.push(`${rel}: last_reviewed must be an ISO date`);
  }
  const sources = fields.sources;
  if (Array.isArray(sources) && sources.length === 0) {
    problems.push(`${rel}: sources list is empty`);
  }

  return { ...fields, path: rel, lines: text.split("\n").length } as Profile;
}

function validateAtlasWide(problems: string[]): void {
  for (const path of walkMarkdown(ATLAS_ROOT)) {
    const rel = relative(REPO_ROOT, path);
    const text = readFileSync(path, "utf8");
    text.split("\n").forEach((line, i) => {
      if (line.includes("\u2014") || line.includes("\u2013")) {
        problems.push(`${rel}:${i + 1}: em/en dash (repo law)`);
      }
    });
    for (const m of text.matchAll(/\]\((\.\.?\/[^)#\s]+)\)/g)) {
      const target = normalize(join(dirname(path), m[1]));
      try {
        statSync(target);
      } catch {
        problems.push(`${rel}: broken relative link ${m[1]}`);
      }
    }
  }
}

function main(): void {
  const checkOnly = process.argv.includes("--check");
  const problems: string[] = [];
  const seenIds = new Map<string, string>();
  const profiles: Profile[] = [];

  const profileDirs = [join(ATLAS_ROOT, "curricula"), join(ATLAS_ROOT, "marketplaces")];
  for (const dir of profileDirs) {
    for (const path of walkMarkdown(dir)) {
      const profile = validateProfile(path, problems, seenIds);
      if (profile) profiles.push(profile);
    }
  }
  validateAtlasWide(problems);

  const byTier: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const p of profiles) {
    byTier[String(p.homa_tier)] = (byTier[String(p.homa_tier)] ?? 0) + 1;
    byCategory[String(p.category)] = (byCategory[String(p.category)] ?? 0) + 1;
  }

  console.log(`atlas profiles: ${profiles.length}`);
  console.log(`by category: ${JSON.stringify(byCategory)}`);
  console.log(`by tier: ${JSON.stringify(byTier)}`);

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log("validation: clean");

  if (checkOnly) return;

  profiles.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const catalog = {
    generated_by: "scripts/curriculum-atlas-index.mts (do not hand-edit)",
    generated_at: new Date().toISOString().slice(0, 10),
    profile_count: profiles.length,
    by_category: byCategory,
    by_tier: byTier,
    profiles,
  };
  const serialized = JSON.stringify(catalog, null, 2) + "\n";
  writeFileSync(CATALOG_PATH, serialized);
  console.log(`wrote ${relative(REPO_ROOT, CATALOG_PATH)}`);
  mkdirSync(dirname(APP_CATALOG_PATH), { recursive: true });
  writeFileSync(APP_CATALOG_PATH, serialized);
  console.log(`wrote ${relative(REPO_ROOT, APP_CATALOG_PATH)}`);
}

main();
