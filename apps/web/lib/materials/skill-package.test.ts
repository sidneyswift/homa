import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { parseSkillPackage } from "./skill-package";
import {
  STUDIO_FEEDBACK_TAGS,
  studioFeedbackProblem,
} from "./studio-feedback";

/**
 * The studio skill X-ray's parser and the feedback vocabulary
 * (/admin/studio iteration loop, founder ask 2026-07-18 evening).
 * The last suite runs the parser against the REAL materials-studio
 * package so a reference gap (cited but not shipped) is caught by
 * check:materials, not discovered by the founder in the console.
 */

const SAMPLE = `---
name: sample
description: Use when testing.
---

Preamble cites references/pre-amble-art.png here, and create_printable early.

## Foldable

Reference image: references/homa-foldable-reference.png
This example shows tri-fold layout and glue tabs.
Study it for fold geometry.

More prose. references/homa-foldable-reference.png again in a snippet.
Use generate_image for the art, then create_printable.

## Outline

No reference here. Always create_printable via the html path.

## Maze

Reference image: references/homa-maze-reference.png
Answer paths and dead ends.
`;

describe("parseSkillPackage", () => {
  const parsed = parseSkillPackage(
    SAMPLE,
    ["homa-foldable-reference.png", "orphaned-extra.png"],
    ["create_printable", "generate_image", "find_materials"],
  );

  it("reads the routing description and sections", () => {
    assert.equal(parsed.description, "Use when testing.");
    assert.deepEqual(parsed.sections, ["Foldable", "Outline", "Maze"]);
  });

  it("cites each reference once, under its section, with the excerpt", () => {
    assert.deepEqual(
      parsed.citations.map((citation) => [citation.file, citation.section, citation.present]),
      [
        ["pre-amble-art.png", null, false],
        ["homa-foldable-reference.png", "Foldable", true],
        ["homa-maze-reference.png", "Maze", false],
      ],
    );
    const foldable = parsed.citations[1];
    assert.ok(foldable.excerpt.includes("tri-fold layout"));
    assert.ok(foldable.excerpt.includes("Study it for fold geometry"));
    // The file name is the view's heading; the excerpt never repeats it.
    assert.ok(!foldable.excerpt.includes("Reference image"));
    assert.ok(!foldable.excerpt.includes("references/"));
  });

  it("flags files on disk that nothing cites", () => {
    assert.deepEqual(parsed.uncitedFiles, ["orphaned-extra.png"]);
  });

  it("maps each named tool to the sections that drive it, in first-mention order", () => {
    assert.deepEqual(parsed.toolMentions, [
      { tool: "create_printable", sections: ["(preamble)", "Foldable", "Outline"] },
      { tool: "generate_image", sections: ["Foldable"] },
    ]);
  });
});

describe("studioFeedbackProblem", () => {
  it("needs at least a tag or a sentence, refuses unknown tags", () => {
    assert.notEqual(studioFeedbackProblem("", []), null);
    assert.equal(studioFeedbackProblem("", ["too-easy"]), null);
    assert.equal(studioFeedbackProblem("The dinos were great.", []), null);
    assert.notEqual(studioFeedbackProblem("x", ["not-a-tag"]), null);
    assert.notEqual(studioFeedbackProblem("x", ["too-easy", "too-easy"]), null);
    assert.equal(studioFeedbackProblem("x", [...STUDIO_FEEDBACK_TAGS]), null);
  });
});

describe("the real materials-studio package", () => {
  it("makes saved what-works evidence binding at every planning layer", async () => {
    const [materials, planner, curriculum] = await Promise.all([
      readFile(new URL("../../agent/skills/materials-studio/SKILL.md", import.meta.url), "utf8"),
      readFile(new URL("../../agent/skills/planner/SKILL.md", import.meta.url), "utf8"),
      readFile(new URL("../../agent/skills/curriculum-studio/SKILL.md", import.meta.url), "utf8"),
    ]);

    for (const [name, skill] of [
      ["materials-studio", materials],
      ["planner", planner],
      ["curriculum-studio", curriculum],
    ] as const) {
      assert.match(skill, /\[what works · Child\]/u, `${name} must name the rendered memory label`);
      assert.match(skill, /map snapshot/u, `${name} must consult the map beside what works`);
    }
    assert.match(materials, /what works shapes HOW you teach/u);
  });

  it("has no reference gap the console would flag", async () => {
    const dir = new URL("../../agent/skills/materials-studio/", import.meta.url);
    const raw = await readFile(new URL("SKILL.md", dir), "utf8");
    const files = (await readdir(new URL("references/", dir))).filter((name) =>
      /\.(png|jpg|jpeg)$/i.test(name),
    );
    const parsed = parseSkillPackage(raw, files);
    const missing = parsed.citations.filter((citation) => !citation.present);
    assert.deepEqual(
      missing.map((citation) => citation.file),
      [],
      `SKILL.md cites reference images the package does not ship: ${missing
        .map((citation) => citation.file)
        .join(", ")}. Add the file under references/ or drop the citation.`,
    );
    assert.deepEqual(parsed.uncitedFiles, [], "references/ holds files SKILL.md never cites");
  });

  it("routes every image build through the page-level call strategy", async () => {
    const dir = new URL("../../agent/skills/materials-studio/", import.meta.url);
    const skill = await readFile(new URL("SKILL.md", dir), "utf8");
    const strategy = await readFile(
      new URL("references/image-call-strategy.md", dir),
      "utf8",
    );

    assert.match(skill, /read\s+`references\/image-call-strategy\.md`/u);
    assert.match(strategy, /zero or one generated image by\s+default/u);
    assert.match(strategy, /A layout complaint never[\s\S]*generate_image/u);
    assert.match(strategy, /Pixel defects: regeneration may be appropriate/u);
    assert.match(strategy, /wrong subject/u);
  });

  it("routes routine charts to one composed visual-schedule sheet, not per-card art", async () => {
    const dir = new URL("../../agent/skills/materials-studio/", import.meta.url);
    const [skill, recipe, dailyRhythm] = await Promise.all([
      readFile(new URL("SKILL.md", dir), "utf8"),
      readFile(new URL("references/recipes/visual-schedule-cards.md", dir), "utf8"),
      readFile(new URL("references/recipes/daily-rhythm-cards.md", dir), "utf8"),
    ]);

    assert.match(
      skill,
      /Routine and chore charts are visual schedules[\s\S]*read_file[\s\S]*visual-schedule-cards/u,
    );
    assert.doesNotMatch(
      skill,
      /Load\s+`visual-schedule-cards`/u,
      "a recipe is read from materials-studio, not loaded as a standalone skill",
    );
    assert.match(
      skill,
      /never one image per chore, card, or child/u,
    );
    assert.match(recipe, /Never generate one\s+image per card/u);
    assert.match(recipe, /each distinct page still gets at most one composed sheet/u);
    assert.match(
      dailyRhythm,
      /Html path preferred/u,
      "a text-and-symbol daily rhythm card set remains the non-image alternative",
    );
  });

  it("keeps the phonics and spelling check exact and source-independent", async () => {
    const dir = new URL("../../agent/skills/materials-studio/", import.meta.url);
    const [recipe, skill, registry] = await Promise.all([
      readFile(
        new URL("references/recipes/phonics-spelling-diagnostic-assessment.md", dir),
        "utf8",
      ),
      readFile(new URL("SKILL.md", dir), "utf8"),
      readFile(new URL("../../agent/activity-formats.md", import.meta.url), "utf8"),
    ]);

    assert.match(recipe, /^# Phonics and spelling diagnostic assessment$/mu);
    assert.match(recipe, /The model chooses the exact skill/u);
    assert.match(recipe, /Deterministic rules own validation and scoring/u);
    assert.match(recipe, /literal equality or membership in[\s\S]*closed set/u);
    assert.match(
      recipe,
      /pageRoles: \["child", "child", "parent_guide", "answer_key"\]/u,
    );
    assert.match(recipe, /not a standardized, clinical, or grade-placement instrument/u);
    assert.doesNotMatch(
      recipe,
      /Quick Phonics|Quick Spelling|Jan Hasbrouck|Benchmark Education/u,
      "The Homa recipe may preserve a workflow but never source identity or copy cues",
    );
    assert.match(
      skill,
      /\| Phonics and spelling diagnostic assessment \|[^\n]+\| phonics-spelling-diagnostic-assessment \|/u,
    );
    assert.match(
      registry,
      /- \*\*Slug:\*\* `\[phonics-spelling-diagnostic-assessment\]`/u,
    );
  });

  it("ships every Stairway phonics mechanic through a reusable recipe", async () => {
    const dir = new URL("../../agent/skills/materials-studio/", import.meta.url);
    const recipeSlugs = [
      "flash-cards",
      "phoneme-letter-building-mat",
      "grapheme-marking-practice",
      "phonics-sound-card-game",
      "decodable-story-page",
    ] as const;
    const [recipes, diagnostic, bingo, skill, registry] = await Promise.all([
      Promise.all(
        recipeSlugs.map(async (slug) => ({
          slug,
          body: await readFile(new URL(`references/recipes/${slug}.md`, dir), "utf8"),
        })),
      ),
      readFile(
        new URL("references/recipes/phonics-spelling-diagnostic-assessment.md", dir),
        "utf8",
      ),
      readFile(new URL("references/recipes/picture-bingo-board.md", dir), "utf8"),
      readFile(new URL("SKILL.md", dir), "utf8"),
      readFile(new URL("../../agent/activity-formats.md", import.meta.url), "utf8"),
    ]);

    for (const { slug, body } of recipes) {
      assert.match(body, /^# .+$/mu, `${slug} needs a title`);
      assert.match(body, /^Great for:/mu, `${slug} needs routing guidance`);
      assert.match(body, /^## Design patterns/mu, `${slug} needs binding design patterns`);
      assert.match(body, /```html/u, `${slug} needs worked HTML`);
      assert.doesNotMatch(
        body,
        /Stairway to Reading|Crazy Letters|Quick Phonics|Quick Spelling/u,
        `${slug} must preserve the mechanic without source identity`,
      );
      assert.match(
        skill,
        new RegExp(`\\| [^\\n]+ \\|[^\\n]+\\| ${slug} \\|`, "u"),
        `${slug} needs a Format library row`,
      );
      assert.ok(
        registry.includes("- **Slug:** `[" + slug + "]`"),
        `${slug} needs an exact activity-format slug line`,
      );
    }

    assert.match(diagnostic, /code-issued progression policy/u);
    assert.match(diagnostic, /Never write a threshold[\s\S]*placement rule in generated prose/u);
    assert.match(bingo, /Use html only for text boards/u);
    assert.match(bingo, /no image, emoji, rebus, or color-family cue/u);
    const flashCards = recipes.find(({ slug }) => slug === "flash-cards")?.body ?? "";
    assert.match(flashCards, /use 2 by 2 cards on letter paper by default/u);
    assert.match(flashCards, /grid-template-rows: repeat\(2, 1fr\)/u);
    assert.doesNotMatch(flashCards, /use 2 by 3 cards on letter paper by default/u);
  });

  it("ships the Benchmark Grade 3 practice mechanics without source policy", async () => {
    const dir = new URL("../../agent/skills/materials-studio/", import.meta.url);
    const recipeSlugs = [
      "word-fluency-repeated-reading",
      "phonics-pattern-reference-chart",
      "dictation-writing-practice",
    ] as const;
    const [recipes, skill, registry] = await Promise.all([
      Promise.all(
        recipeSlugs.map(async (slug) => ({
          slug,
          body: await readFile(new URL(`references/recipes/${slug}.md`, dir), "utf8"),
        })),
      ),
      readFile(new URL("SKILL.md", dir), "utf8"),
      readFile(new URL("../../agent/activity-formats.md", import.meta.url), "utf8"),
    ]);

    for (const { slug, body } of recipes) {
      assert.match(body, /^# .+$/mu, `${slug} needs a title`);
      assert.match(body, /^Great for:/mu, `${slug} needs routing guidance`);
      assert.match(body, /^## Design patterns/mu, `${slug} needs binding design patterns`);
      assert.match(body, /```html/u, `${slug} needs worked HTML`);
      assert.doesNotMatch(
        body,
        /Benchmark|Accountable Text|Interactive Text|Taller del Lector/u,
        `${slug} must preserve the mechanic without source identity or wording`,
      );
      assert.match(
        skill,
        new RegExp(`\\| [^\\n]+ \\|[^\\n]+\\| ${slug} \\|`, "u"),
        `${slug} needs a Format library row`,
      );
      assert.ok(
        registry.includes("- **Slug:** `[" + slug + "]`"),
        `${slug} needs an exact activity-format slug line`,
      );
    }

    const bySlug = new Map(recipes.map(({ slug, body }) => [slug, body]));
    assert.match(
      bySlug.get("word-fluency-repeated-reading") ?? "",
      /Never author a seconds target, words-per-minute goal,[\s\S]*threshold in prose/u,
    );
    assert.match(
      bySlug.get("phonics-pattern-reference-chart") ?? "",
      /Deterministic validation owns catalog membership,[\s\S]*target-span positions/u,
    );
    assert.match(
      bySlug.get("dictation-writing-practice") ?? "",
      /pageRoles: \["child", "parent_guide", "answer_key"\]/u,
    );
    assert.match(
      bySlug.get("dictation-writing-practice") ?? "",
      /Never invent a\s+pass threshold, mastery result, grade level, or timer/u,
    );
  });
});
