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
});
