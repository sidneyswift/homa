import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * The pronoun law reaches every prompt that writes about a child.
 *
 * Homa's instructions have said since launch: "You are never told
 * whether a child is a boy or a girl, and a name is not an answer...
 * Never guess from a name." That law lived in instructions.md and
 * report-writer.md only, so the three model prompts with their OWN
 * system text never inherited it. On 2026-07-21 the lesson synthesis
 * wrote "Story said she could color five boxes" into a review his
 * mother reads, having guessed from the name; her own recording calls
 * him "buddy".
 *
 * A prompt that describes a child is a place the law has to appear, so
 * this test names them. Adding a fourth such prompt without the law
 * fails here rather than in a family's review.
 */

const PROMPTS_ABOUT_A_CHILD = [
  "lib/lessons/synthesis.ts",
  "lib/lessons/tone.ts",
  "lib/voice/caption-image.ts",
];

const appsWeb = path.resolve(import.meta.dirname, "../..");

describe("prompts that write about a child carry the pronoun law", () => {
  for (const relativePath of PROMPTS_ABOUT_A_CHILD) {
    it(`${relativePath} says not to guess`, () => {
      const source = readFileSync(path.join(appsWeb, relativePath), "utf8");
      assert.match(
        source,
        /they\/them\/their/u,
        "must name the neutral default",
      );
      // Substance, not punctuation: these are prose prompts that wrap
      // across lines and word the rule differently, so the guard looks
      // for the prohibition itself rather than one exact sentence.
      assert.match(
        source,
        /never\s+guess/iu,
        "must forbid guessing (from a name, or at all)",
      );
    });
  }
});
