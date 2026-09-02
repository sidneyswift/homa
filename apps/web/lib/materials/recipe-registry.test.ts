import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { studioAnchorIds } from "./anchors";
import { RECIPE_REGISTRY, RECIPE_SLUGS } from "./recipes.generated";

/**
 * The generated recipe registry stays true to the recipe files it mirrors.
 * create_printable's `recipe` enum and the reviewer's checklist both come
 * from recipes.generated.ts, and the deployed function cannot read the
 * recipes themselves (issue #246), so a stale mirror would advertise a
 * deleted recipe or review a page against last month's checklist with no
 * error anywhere. Each test here is one way that drift could hide.
 */

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const RECIPES_DIR = "apps/web/agent/skills/materials-studio/references/recipes";
const BUILDER = "scripts/build-recipe-registry.mts";
const recipesDir = path.join(repoRoot, RECIPES_DIR);
const skillMd = readFileSync(
  path.join(repoRoot, "apps/web/agent/skills/materials-studio/SKILL.md"),
  "utf8",
);

describe("recipe registry", () => {
  it("lists exactly the recipe files on disk, sorted", () => {
    const onDisk = readdirSync(recipesDir)
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.slice(0, -3))
      .sort();
    assert.deepEqual([...RECIPE_SLUGS], onDisk);
  });

  it("has a registry entry for every slug and no extras", () => {
    assert.deepEqual(Object.keys(RECIPE_REGISTRY).sort(), [...RECIPE_SLUGS].sort());
  });

  it("names only anchors the anchor registry actually has", () => {
    const known = new Set(studioAnchorIds());
    for (const slug of RECIPE_SLUGS) {
      const anchorId = RECIPE_REGISTRY[slug].anchorId;
      if (anchorId === null) continue;
      assert.ok(known.has(anchorId), `${slug} names anchor "${anchorId}", which is not registered`);
    }
  });

  it("covers every slug in SKILL.md's recipe-file table", () => {
    const slugs = new Set<string>(RECIPE_SLUGS);
    let inTable = false;
    let seen = 0;
    for (const line of skillMd.split("\n")) {
      if (/^\|.*\|\s*$/.test(line) && /\|\s*Recipe file\s*\|/i.test(line)) {
        inTable = true;
        continue;
      }
      if (!inTable) continue;
      if (!/^\|.*\|\s*$/.test(line)) break;
      const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
      const slug = cells[cells.length - 1];
      if (!slug || /^[-\s]+$/.test(slug)) continue;
      seen += 1;
      assert.ok(slugs.has(slug), `SKILL.md recipe table names "${slug}", which the registry lacks`);
    }
    assert.ok(seen > 0, "the SKILL.md recipe table was not found; update this guard");
  });

  it("is byte-identical to what the builder produces from the recipes now", () => {
    // The builder is an ESM .mts script this CJS test cannot import, so
    // run its own --check: the same comparison check:fleet-skills makes.
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", BUILDER, "--check"],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.equal(
      result.status,
      0,
      `${BUILDER} --check failed (run pnpm build:recipe-registry):\n${result.stderr}${result.stdout}`,
    );
  });

  it("keeps every checklist item well formed, whichever recipe declares it", () => {
    for (const slug of RECIPE_SLUGS) {
      const ids = new Set<string>();
      for (const item of RECIPE_REGISTRY[slug].checklist) {
        assert.ok(!ids.has(item.id), `${slug}: duplicate checklist id ${item.id}`);
        ids.add(item.id);
        assert.ok(item.severity === "blocking" || item.severity === "advisory");
        assert.ok(item.check.length >= 12 && item.check.length <= 200);
      }
      assert.ok(RECIPE_REGISTRY[slug].checklist.length <= 8, `${slug}: more than 8 items`);
    }
  });
});
