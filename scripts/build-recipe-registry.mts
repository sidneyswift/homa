/**
 * Regenerates apps/web/lib/materials/recipes.generated.ts from every recipe
 * file under apps/web/agent/skills/<any package>/references/recipes/.
 *
 * Why a generated mirror instead of reading the recipes at runtime: the
 * deployed eve function is a nitro bundle that carries no source tree
 * (issue #246, the same reason build-onboarding-skill.mts exists), so
 * create_printable cannot discover recipe slugs or their reviewer
 * checklists from agent/skills/ in production. The slugs become the
 * closed enum for create_printable's `recipe` input and the checklists
 * become the reviewer's structural spec, both resolved in code from the
 * slug the model passes. Nothing here is model-supplied.
 *
 * Recipes are a fleet-wide concept create_printable consumes, not one
 * skill's private property (2026-09-07, generalized off materials-studio
 * alone when lesson-studio needed its own recipe directory): any skill
 * package may carry a references/recipes/ directory, discovered here by
 * scanning every skill package under apps/web/agent/skills/ for one,
 * never a hand-maintained list of packages. A slug must stay unique across
 * every discovered directory, since create_printable's `recipe` enum is
 * one flat namespace regardless of which skill's folder a recipe lives in.
 *
 * The recipe markdown stays the only place anyone edits a checklist or
 * an anchor mention (filesystem-first fleet skills, founder ruling
 * 2026-07-15). This script is the only writer of the generated module.
 * Re-run after any recipe edit:  pnpm build:recipe-registry
 *
 * A stale registry would advertise a deleted recipe or review against an
 * outdated checklist silently, so `--check` compares the generated text
 * with the file on disk without writing (wired into check:fleet-skills),
 * and recipe-registry.test.ts asserts the same plus anchor resolution.
 * Any grammar problem in any recipe fails the build loudly.
 *
 * Usage:
 *   node --experimental-strip-types scripts/build-recipe-registry.mts
 *   node --experimental-strip-types scripts/build-recipe-registry.mts --check
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseRecipeAnchorId,
  parseRecipeChecklist,
  type RecipeChecklistItem,
} from "../apps/web/lib/materials/recipe-checklist.ts";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const SKILLS_ROOT = "apps/web/agent/skills";
export const OUT = "apps/web/lib/materials/recipes.generated.ts";

export interface RecipeSourceEntry {
  slug: string;
  /** The skill package whose references/recipes/ directory this recipe
   * file was discovered in, for duplicate-slug and drift error messages. */
  packageName: string;
  anchorId: string | null;
  checklist: RecipeChecklistItem[];
}

/** Every skill package directory that currently ships a
 * references/recipes/ subdirectory, sorted by package name so discovery
 * order never depends on the filesystem's own directory-listing order. */
function discoverRecipeDirs(root: string): { packageName: string; relDir: string }[] {
  const skillsRoot = path.join(root, SKILLS_ROOT);
  const packages = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const dirs: { packageName: string; relDir: string }[] = [];
  for (const packageName of packages) {
    const relDir = path.join(SKILLS_ROOT, packageName, "references", "recipes");
    if (existsSync(path.join(root, relDir))) dirs.push({ packageName, relDir });
  }
  return dirs;
}

/** Every recipe on disk across every skill package, sorted by slug, with
 * its parsed declarations. Throws on the first grammar problem or the
 * first cross-package slug collision, naming every line. */
export function readRecipeSources(root: string = repoRoot): RecipeSourceEntry[] {
  const recipeDirs = discoverRecipeDirs(root);
  if (recipeDirs.length === 0) {
    throw new Error(`No recipe directories found under ${SKILLS_ROOT}/*/references/recipes`);
  }
  const problems: string[] = [];
  const bySlug = new Map<string, RecipeSourceEntry>();
  for (const { packageName, relDir } of recipeDirs) {
    const dir = path.join(root, relDir);
    // A recipe is `<slug>.md` with a plain kebab-case slug. Sibling files
    // such as `<slug>.variants.md` hold a recipe's long worked material and
    // are loaded by the recipe itself; they are not formats Homa can pick,
    // so they never become RECIPE_SLUGS (which feeds create_printable's
    // `recipe` enum).
    const files = readdirSync(dir)
      .filter((name) => /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(name))
      .sort();
    for (const file of files) {
      const slug = file.slice(0, -3);
      const markdown = readFileSync(path.join(dir, file), "utf8");
      const parsed = parseRecipeChecklist(markdown);
      for (const problem of parsed.problems) {
        problems.push(`${relDir}/${file}: ${problem}`);
      }
      const existing = bySlug.get(slug);
      if (existing) {
        problems.push(
          `Recipe slug "${slug}" is defined in both ${existing.packageName} and ${packageName}; recipe slugs must be unique across the fleet.`,
        );
        continue;
      }
      bySlug.set(slug, {
        slug,
        packageName,
        anchorId: parseRecipeAnchorId(markdown),
        checklist: parsed.items,
      });
    }
  }
  if (problems.length > 0) {
    throw new Error(`Recipe registry problems:\n${problems.map((line) => `  ${line}`).join("\n")}`);
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * One line per slug and one line per checklist item, so a recipe edit
 * shows up as a small readable diff rather than one rewritten literal.
 */
export function renderRegistryModule(entries: readonly RecipeSourceEntry[]): string {
  const lines: string[] = [
    "// GENERATED by scripts/build-recipe-registry.mts. Do not edit by hand.",
    "// Mirrors every recipe file found under",
    `//   ${SKILLS_ROOT}/*/references/recipes/`,
    "// by slug: the anchor each one tells Homa to pass to generate_image, and",
    "// the reviewer checklist each declares in its homa-checklist block.",
    "// Inlined as source because the deployed eve function bundle carries no",
    "// source tree to read recipes from (issue #246).",
    "// Regenerate with: pnpm build:recipe-registry",
    'import type { RecipeChecklistItem } from "./recipe-checklist";',
    "",
    "export const RECIPE_SLUGS = [",
    ...entries.map((entry) => `  ${JSON.stringify(entry.slug)},`),
    "] as const;",
    "",
    "export type RecipeSlug = (typeof RECIPE_SLUGS)[number];",
    "",
    "export interface RecipeRegistryEntry {",
    "  /** The fleet anchor the recipe names in its anchorIds mention, or null. */",
    "  anchorId: string | null;",
    "  /** The recipe's closed reviewer checklist; empty when it declares none. */",
    "  checklist: readonly RecipeChecklistItem[];",
    "}",
    "",
    "export const RECIPE_REGISTRY: Readonly<Record<RecipeSlug, RecipeRegistryEntry>> = {",
  ];
  for (const entry of entries) {
    const anchor = entry.anchorId === null ? "null" : JSON.stringify(entry.anchorId);
    if (entry.checklist.length === 0) {
      lines.push(
        `  ${JSON.stringify(entry.slug)}: { anchorId: ${anchor}, checklist: [] },`,
      );
      continue;
    }
    lines.push(`  ${JSON.stringify(entry.slug)}: {`);
    lines.push(`    anchorId: ${anchor},`);
    lines.push("    checklist: [");
    for (const item of entry.checklist) {
      lines.push(
        `      { id: ${JSON.stringify(item.id)}, severity: ${JSON.stringify(item.severity)}, check: ${JSON.stringify(item.check)} },`,
      );
    }
    lines.push("    ],");
    lines.push("  },");
  }
  lines.push("};", "");
  return lines.join("\n");
}

function main(): void {
  const entries = readRecipeSources();
  const generated = renderRegistryModule(entries);
  const outPath = path.join(repoRoot, OUT);
  const withChecklists = entries.filter((entry) => entry.checklist.length > 0).length;
  const packageCount = new Set(entries.map((entry) => entry.packageName)).size;
  const summary = `${entries.length} recipe(s) across ${packageCount} skill(s), ${withChecklists} with a checklist`;

  if (process.argv.includes("--check")) {
    let onDisk = "";
    try {
      onDisk = readFileSync(outPath, "utf8");
    } catch {
      onDisk = "";
    }
    if (onDisk !== generated) {
      console.error(
        `${OUT} is stale: it no longer matches ${SKILLS_ROOT}/*/references/recipes.\n` +
          "create_printable would advertise outdated recipe slugs or review against an outdated checklist.\n" +
          "Run: pnpm build:recipe-registry",
      );
      process.exit(1);
    }
    console.log(`${OUT} matches ${SKILLS_ROOT}/*/references/recipes (${summary}).`);
    return;
  }

  writeFileSync(outPath, generated, "utf8");
  console.log(`Wrote ${OUT} from ${SKILLS_ROOT}/*/references/recipes (${summary}).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
