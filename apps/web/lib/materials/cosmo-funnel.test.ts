import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import {
  GAP_ALIASES,
  computeGapCoverage,
  extractGapSlugs,
  normalizeFormatSlug,
  parseCatalogStatuses,
  parseCosmoCurriculum,
  parseCosmoReference,
  parseRegistrySlugs,
  summarizeIntake,
} from "./cosmo-funnel";

/**
 * The inspo funnel's pure layer (/admin/studio funnel, founder ask
 * 2026-07-19). The last suite runs against the REAL .cosmo corpus and
 * the REAL skill package, so a graduation that renames a recipe out
 * from under an alias, or an analysis batch the parser cannot read,
 * fails check:materials instead of blanking the founder console.
 */

describe("normalizeFormatSlug", () => {
  it("slugifies headings into gap-name space", () => {
    assert.equal(normalizeFormatSlug("Maze / puzzle practice"), "maze-puzzle-practice");
    assert.equal(normalizeFormatSlug("3-part nomenclature cards"), "3-part-nomenclature-cards");
    assert.equal(normalizeFormatSlug("Cut-and-paste word work"), "cut-and-paste-word-work");
  });
});

describe("extractGapSlugs", () => {
  it("keeps slug-shaped names from strings and objects", () => {
    const slugs = extractGapSlugs({
      gaps: [
        "hive-puzzle",
        { name: "clip-card-activity", description: "clothespin cards" },
        { format: "file-folder-game" },
      ],
    });
    assert.deepEqual(slugs, ["hive-puzzle", "clip-card-activity", "file-folder-game"]);
  });

  it("drops prose observations, curriculum-sample, and junk", () => {
    const slugs = extractGapSlugs({
      gaps: [
        "no maze",
        "curriculum-sample",
        "no existing 'checklist' recipe; closest is themed-worksheet",
        42,
        null,
        {},
      ],
    });
    assert.deepEqual(slugs, []);
  });

  it("returns empty for missing recipeMatch", () => {
    assert.deepEqual(extractGapSlugs(undefined), []);
    assert.deepEqual(extractGapSlugs({ matchedRecipes: [] }), []);
  });
});

describe("parseCosmoReference", () => {
  it("summarizes a reference analysis", () => {
    const parsed = parseCosmoReference({
      id: "ref-2026-07-18-worm-unit-study",
      title: "Earthworm Unit Study",
      droppedBy: "carolyng",
      droppedAt: "2026-07-18T01:16:00-04:00",
      skillTargeting: { subject: "multidisciplinary" },
      format: "unit-study",
      recipeMatch: { matchedRecipes: ["themed-worksheet"], gaps: ["cross-curricular-unit-study"] },
    });
    assert.ok(parsed);
    assert.equal(parsed.droppedBy, "carolyng");
    assert.equal(parsed.subject, "multidisciplinary");
    assert.deepEqual(parsed.matchedRecipes, ["themed-worksheet"]);
    assert.deepEqual(parsed.gapSlugs, ["cross-curricular-unit-study"]);
  });

  it("rejects rows without id or droppedAt", () => {
    assert.equal(parseCosmoReference({ id: "x" }), null);
    assert.equal(parseCosmoReference("not an object"), null);
  });
});

describe("parseRegistrySlugs and parseCatalogStatuses", () => {
  it("reads slugs from registry entries", () => {
    const slugs = parseRegistrySlugs(
      "### clip-cards\n- **Slug:** `[clip-cards]`\n- **Name:** Clip cards\n\n### foldable\n- **Slug:** `[foldable]`\n",
    );
    assert.deepEqual(slugs, ["clip-cards", "foldable"]);
  });

  it("counts catalog statuses", () => {
    const counts = parseCatalogStatuses(
      "**Status:** noted\nbody\n**Status:** applied-to-full-flywheel\n**Status:** noted\n",
    );
    assert.equal(counts.get("noted"), 2);
    assert.equal(counts.get("applied-to-full-flywheel"), 1);
  });
});

describe("computeGapCoverage", () => {
  const sections = ["Maze / puzzle practice", "Clip cards", "Manipulatives: think past the page (early math especially)"];
  const registry = ["cut-and-paste", "clip-cards"];

  function reference(gaps: string[]) {
    const parsed = parseCosmoReference({
      id: "ref-x",
      droppedAt: "2026-07-18T00:00:00-04:00",
      recipeMatch: { gaps },
    });
    assert.ok(parsed);
    return parsed;
  }

  it("covers exact, aliased, and containment matches; leaves the rest open", () => {
    const coverage = computeGapCoverage(
      [
        reference(["clip-card-activity"]),
        reference(["maze-activity", "hive-puzzle"]),
        reference(["pattern-cut-and-paste", "printable-manipulative-set", "hive-puzzle"]),
      ],
      sections,
      registry,
    );
    const bySlug = new Map(coverage.rows.map((row) => [row.slug, row]));
    assert.equal(bySlug.get("clip-card-activity")?.covered, true, "alias to clip-cards");
    assert.equal(bySlug.get("maze-activity")?.covered, true, "alias to maze section");
    assert.equal(bySlug.get("pattern-cut-and-paste")?.covered, true, "contains registry slug");
    assert.equal(bySlug.get("printable-manipulative-set")?.covered, true, "alias into manipulatives section");
    assert.equal(bySlug.get("hive-puzzle")?.covered, false, "genuinely open");
    assert.equal(coverage.openCount, 1);
    assert.equal(coverage.coveredCount, 4);
  });

  it("sorts open rows first, then by demand", () => {
    const coverage = computeGapCoverage(
      [reference(["hive-puzzle", "averatile-puzzle"]), reference(["hive-puzzle", "clip-card-activity"])],
      sections,
      registry,
    );
    assert.deepEqual(
      coverage.rows.map((row) => row.slug),
      ["hive-puzzle", "averatile-puzzle", "clip-card-activity"],
    );
  });
});

describe("Stairway phonics recipe graduation", () => {
  it("aliases source-specific activity names to their broader recipe owners", () => {
    assert.equal(
      GAP_ALIASES["reading-placement-screen"],
      "phonics-spelling-diagnostic-assessment",
    );
    assert.equal(
      GAP_ALIASES["phonics-mastery-check"],
      "phonics-spelling-diagnostic-assessment",
    );
    assert.equal(GAP_ALIASES["phonics-word-bingo"], "picture-bingo-board");
    assert.equal(GAP_ALIASES["phonics-flash-card-deck"], "flash-cards");
  });
});

describe("Blossom and Root Year 3 recipe graduation", () => {
  it("aliases its broad word-play name to the existing reusable mechanic", () => {
    assert.equal(GAP_ALIASES["word-play-cut-and-sort"], "cut-and-paste-word-work");
  });
});

describe("Benchmark Grade 3 recipe graduation", () => {
  it("aliases source-specific fluency and card names to reusable recipe owners", () => {
    assert.equal(
      GAP_ALIASES["word-fluency-speed-drill"],
      "word-fluency-repeated-reading",
    );
    assert.equal(GAP_ALIASES["high-frequency-word-card-deck"], "flash-cards");
  });
});

describe("summarizeIntake", () => {
  it("counts droppers across both corpora and orders latest drops", () => {
    const ref = parseCosmoReference({
      id: "ref-a",
      droppedBy: "sid",
      droppedAt: "2026-07-17T10:00:00-04:00",
      recipeMatch: { matchedRecipes: ["foldable"] },
    });
    const cur = parseCosmoCurriculum({
      id: "cur-b",
      name: "Playing Preschool",
      droppedBy: "aless",
      droppedAt: "2026-07-19T10:00:00-04:00",
    });
    assert.ok(ref && cur);
    const intake = summarizeIntake([ref], [cur], 8);
    assert.equal(intake.referenceCount, 1);
    assert.equal(intake.curriculumCount, 1);
    assert.equal(intake.latestDrops[0]?.entry.id, "cur-b");
    assert.equal(intake.latestDropAt, "2026-07-19T10:00:00-04:00");
    assert.equal(intake.matchedReferenceCount, 1);
    assert.deepEqual(intake.byDropper.map((entry) => entry.dropper).sort(), ["aless", "sid"]);
  });
});

describe("the real corpus and the real skill package", () => {
  const repoRoot = existsSync(path.join(process.cwd(), ".cosmo"))
    ? process.cwd()
    : path.join(process.cwd(), "..", "..");
  const cosmoRoot = path.join(repoRoot, ".cosmo");
  const skillPath = path.join(
    repoRoot,
    "apps",
    "web",
    "agent",
    "skills",
    "materials-studio",
    "SKILL.md",
  );
  const registryPath = path.join(repoRoot, "apps", "web", "agent", "activity-formats.md");

  it("parses the shipped analysis corpus", async () => {
    const names = await readdir(path.join(cosmoRoot, "references"));
    const refNames = names.filter((name) => name.startsWith("ref-") && name.endsWith(".json"));
    let parsed = 0;
    for (const name of refNames) {
      const raw = JSON.parse(
        await readFile(path.join(cosmoRoot, "references", name), "utf8"),
      ) as unknown;
      if (parseCosmoReference(raw)) parsed += 1;
    }
    assert.ok(refNames.length >= 100, `expected a real corpus, saw ${refNames.length}`);
    assert.equal(parsed, refNames.length, "every shipped analysis must parse");
  });

  it("every alias target resolves to a shipped recipe or registry entry", async () => {
    const skill = await readFile(skillPath, "utf8");
    const registry = parseRegistrySlugs(await readFile(registryPath, "utf8"));
    const sections = [...skill.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    // Recipes ship as sibling files now, not SKILL.md sections.
    const recipeFiles = await readdir(
      path.join(path.dirname(skillPath), "references", "recipes"),
    );
    const recipeSlugs = recipeFiles
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.slice(0, -3));
    const shippedSlugs = [...sections, ...recipeSlugs].map(normalizeFormatSlug);
    const registrySet = new Set(registry.map(normalizeFormatSlug));
    for (const target of new Set(Object.values(GAP_ALIASES))) {
      const hit =
        registrySet.has(target) ||
        shippedSlugs.some((slug) => slug === target || slug.includes(target));
      assert.ok(
        hit,
        `alias target "${target}" matches no shipped recipe, SKILL.md section, or registry slug`,
      );
    }
  });

  it("closes all eight Stairway Layer 4 recipe gaps", async () => {
    const curriculum = JSON.parse(
      await readFile(
        path.join(
          cosmoRoot,
          "curriculums",
          "cur-2026-07-31-stairway-to-reading.json",
        ),
        "utf8",
      ),
    ) as {
      layer4_activities?: {
        activityTypes?: Array<{
          recipe?: string | null;
          status?: string;
          suggestedRecipe?: { name?: string };
        }>;
        stats?: { haveRecipe?: number; noRecipe?: number };
      };
    };
    const suggested = (curriculum.layer4_activities?.activityTypes ?? []).filter(
      (row) => row.suggestedRecipe?.name,
    );
    const recipeFiles = new Set(
      (await readdir(path.join(path.dirname(skillPath), "references", "recipes")))
        .filter((name) => name.endsWith(".md"))
        .map((name) => name.slice(0, -3)),
    );
    const registry = new Set(
      parseRegistrySlugs(await readFile(registryPath, "utf8")),
    );

    assert.equal(suggested.length, 8, "the historical Layer 4 gap census must stay complete");
    for (const row of suggested) {
      const gap = row.suggestedRecipe?.name;
      assert.ok(gap);
      const canonical = GAP_ALIASES[gap] ?? gap;
      assert.equal(row.status, "have_recipe", `${gap} must be marked covered`);
      assert.equal(row.recipe, canonical, `${gap} must name its canonical recipe`);
      assert.ok(
        recipeFiles.has(canonical) || registry.has(canonical),
        `${gap} resolves to unshipped recipe ${canonical}`,
      );
    }
    assert.deepEqual(curriculum.layer4_activities?.stats, {
      totalActivityTypes: 12,
      haveRecipe: 12,
      noRecipe: 0,
    });
  });

  it("closes all four Benchmark Grade 3 Layer 4 recipe gaps", async () => {
    const curriculum = JSON.parse(
      await readFile(
        path.join(
          cosmoRoot,
          "curriculums",
          "cur-2026-07-31-benchmark-grade-3-reading-workshop.json",
        ),
        "utf8",
      ),
    ) as {
      layer4_activities?: {
        activityTypes?: Array<{
          recipe?: string | null;
          status?: string;
          suggestedRecipe?: { name?: string };
        }>;
        stats?: { totalActivityTypes?: number; haveRecipe?: number; noRecipe?: number };
      };
    };
    const suggested = (curriculum.layer4_activities?.activityTypes ?? []).filter(
      (row) => row.suggestedRecipe?.name,
    );
    const recipeFiles = new Set(
      (await readdir(path.join(path.dirname(skillPath), "references", "recipes")))
        .filter((name) => name.endsWith(".md"))
        .map((name) => name.slice(0, -3)),
    );
    const registry = new Set(
      parseRegistrySlugs(await readFile(registryPath, "utf8")),
    );

    assert.equal(suggested.length, 4, "the historical Layer 4 gap census must stay complete");
    for (const row of suggested) {
      const gap = row.suggestedRecipe?.name;
      assert.ok(gap);
      const canonical = GAP_ALIASES[gap] ?? gap;
      assert.equal(row.status, "have_recipe", `${gap} must be marked covered`);
      assert.equal(row.recipe, canonical, `${gap} must name its canonical recipe`);
      assert.ok(
        recipeFiles.has(canonical) || registry.has(canonical),
        `${gap} resolves to unshipped recipe ${canonical}`,
      );
    }
    assert.deepEqual(curriculum.layer4_activities?.stats, {
      totalActivityTypes: 8,
      haveRecipe: 8,
      noRecipe: 0,
    });
  });
});
