import assert from "node:assert/strict";
import { test } from "node:test";

import { recipeTableSlugs, unreachableSkillReferences } from "./skill-reference-graph.ts";

test("a recipe remains reachable through a format index and a variant", () => {
  const documents = new Map([
    ["SKILL.md", "Read references/format-library.md"],
    ["references/format-library.md", "| Recipe file |\n| --- |\n| counting |"],
    ["references/recipes/counting.md", "Read counting.variants.md"],
    ["references/recipes/counting.variants.md", "Exact geometry."],
  ]);
  assert.deepEqual(unreachableSkillReferences(documents), []);
  assert.deepEqual(recipeTableSlugs(documents.get("references/format-library.md")!), ["counting"]);
});

test("an unlinked cycle remains orphaned", () => {
  assert.deepEqual(unreachableSkillReferences(new Map([
    ["SKILL.md", "No references."],
    ["references/a.md", "Read references/b.md"],
    ["references/b.md", "Read references/a.md"],
  ])), ["references/a.md", "references/b.md"]);
});

test("a longer name does not accidentally link a shorter recipe", () => {
  assert.deepEqual(unreachableSkillReferences(new Map([
    ["SKILL.md", "Read references/recipes/counting-mat.md"],
    ["references/recipes/counting-mat.md", "Mat only."],
    ["references/recipes/counting.md", "Other recipe."],
  ])), ["references/recipes/counting.md"]);
});

test("recipe tables outside the root still expose nonexistent targets", () => {
  assert.deepEqual(recipeTableSlugs("| Format | Recipe file |\n| --- | --- |\n| Mat | missing-recipe |\n\nOther text"), ["missing-recipe"]);
});
