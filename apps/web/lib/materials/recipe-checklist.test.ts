import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseRecipeAnchorId,
  parseRecipeChecklist,
  RECIPE_CHECKLIST_MAX_CHECK_CHARS,
  RECIPE_CHECKLIST_MAX_ITEMS,
} from "./recipe-checklist";

/**
 * The recipe checklist grammar. A letter-formation worksheet shipped too
 * small to trace after a revision fixing page overflow shrank the letters
 * (2026-09-02): the QC reviewer had no structural spec for the format, so
 * nothing asked "are the four trace boxes the size of the model box?".
 * Recipes now declare that spec in a fenced homa-checklist block, and
 * these tests pin the grammar the generated registry is built from. A
 * silently tolerated malformed line would ship as a missing check.
 */

const VALID_BLOCK = `# Some recipe

Prose above.

\`\`\`homa-checklist
- blocking trace-box-count: Exactly four trace boxes sit in one row under the model box.
- blocking model-size: The model letter is about a quarter of the page width tall or more.
- advisory fade-order: Support fades left to right across the trace row.
\`\`\`

Prose below.
`;

function blockOf(lines: string[]): string {
  return ["```homa-checklist", ...lines, "```", ""].join("\n");
}

describe("parseRecipeChecklist", () => {
  it("parses a well-formed block into items in order, with no problems", () => {
    const parsed = parseRecipeChecklist(VALID_BLOCK);
    assert.deepEqual(parsed.problems, []);
    assert.deepEqual(parsed.items, [
      {
        id: "trace-box-count",
        severity: "blocking",
        check: "Exactly four trace boxes sit in one row under the model box.",
      },
      {
        id: "model-size",
        severity: "blocking",
        check: "The model letter is about a quarter of the page width tall or more.",
      },
      {
        id: "fade-order",
        severity: "advisory",
        check: "Support fades left to right across the trace row.",
      },
    ]);
  });

  it("yields an empty checklist and no problems for a recipe with no block", () => {
    const parsed = parseRecipeChecklist("# Plain recipe\n\nNo checklist here.\n");
    assert.deepEqual(parsed, { items: [], problems: [] });
  });

  it("ignores checklist-shaped lines inside other fences (worked HTML, prompt templates)", () => {
    const parsed = parseRecipeChecklist(
      ["```html", "- blocking sneaky: This is a comment inside worked HTML, not a check.", "```", ""].join("\n"),
    );
    assert.deepEqual(parsed, { items: [], problems: [] });
  });

  it("names a bad severity and drops that item", () => {
    const parsed = parseRecipeChecklist(
      blockOf(["- required box-count: Exactly four boxes sit in a row on the page."]),
    );
    assert.equal(parsed.items.length, 0);
    assert.equal(parsed.problems.length, 1);
    assert.match(parsed.problems[0], /severity "required"/);
  });

  it("names a duplicate id and keeps only the first occurrence", () => {
    const parsed = parseRecipeChecklist(
      blockOf([
        "- blocking box-count: Exactly four boxes sit in a row on the page.",
        "- advisory box-count: Boxes are evenly spaced across the row on the page.",
      ]),
    );
    assert.deepEqual(parsed.items.map((item) => item.id), ["box-count"]);
    assert.equal(parsed.problems.length, 1);
    assert.match(parsed.problems[0], /duplicate id "box-count"/);
  });

  it("names a ninth item as past the cap and keeps the first eight", () => {
    const lines = Array.from(
      { length: RECIPE_CHECKLIST_MAX_ITEMS + 1 },
      (_, index) => `- advisory item-${index + 1}: Check number ${index + 1} reads as a full sentence here.`,
    );
    const parsed = parseRecipeChecklist(blockOf(lines));
    assert.equal(parsed.items.length, RECIPE_CHECKLIST_MAX_ITEMS);
    assert.equal(parsed.problems.length, 1);
    assert.match(parsed.problems[0], /past the 8-item cap/);
  });

  it("names a check past the character cap", () => {
    const longCheck = "x".repeat(RECIPE_CHECKLIST_MAX_CHECK_CHARS + 1);
    const parsed = parseRecipeChecklist(blockOf([`- blocking long-one: ${longCheck}`]));
    assert.equal(parsed.items.length, 0);
    assert.match(parsed.problems[0], /321 characters/);
  });

  it("names a check shorter than 12 characters", () => {
    const parsed = parseRecipeChecklist(blockOf(["- blocking short-one: Too short."]));
    assert.equal(parsed.items.length, 0);
    assert.match(parsed.problems[0], /must be 12 to 320/);
  });

  it("names a line with no colon as malformed", () => {
    const parsed = parseRecipeChecklist(
      blockOf(["- blocking box-count Exactly four boxes sit in a row on the page."]),
    );
    assert.equal(parsed.items.length, 0);
    assert.match(parsed.problems[0], /missing colon or malformed/);
  });

  it("names an id that is not a kebab slug", () => {
    const parsed = parseRecipeChecklist(
      blockOf(["- blocking Box_Count: Exactly four boxes sit in a row on the page."]),
    );
    assert.equal(parsed.items.length, 0);
    assert.match(parsed.problems[0], /id "Box_Count" must match/);
  });

  it("flags an empty block, an unclosed block, and a second block", () => {
    assert.match(parseRecipeChecklist(blockOf([])).problems[0], /has no items/);
    assert.match(
      parseRecipeChecklist("```homa-checklist\n- blocking a-b-c: A check that never closes its fence.\n")
        .problems[0],
      /never closed/,
    );
    const twice = parseRecipeChecklist(`${VALID_BLOCK}\n${VALID_BLOCK}`);
    assert.ok(twice.problems.some((problem) => /second homa-checklist block/.test(problem)));
  });

  it("reports the recipe line number so the fix is one jump away", () => {
    const parsed = parseRecipeChecklist(
      ["# Recipe", "", "```homa-checklist", "- maybe box-count: Exactly four boxes sit in a row on the page.", "```", ""].join("\n"),
    );
    assert.match(parsed.problems[0], /^line 4:/);
  });
});

describe("parseRecipeAnchorId", () => {
  it("reads the anchor id from the recipe's anchorIds mention", () => {
    assert.equal(
      parseRecipeAnchorId(
        'Golden anchor: pass `anchorIds: ["letter-number-formation-practice"]` to\nevery generate_image call.',
      ),
      "letter-number-formation-practice",
    );
  });

  it("returns null for a recipe that names no anchor", () => {
    assert.equal(parseRecipeAnchorId("# Flash cards\n\nAlways html."), null);
  });

  it("takes the first id when the mention is repeated", () => {
    assert.equal(
      parseRecipeAnchorId('`anchorIds: ["foldable"]` early, and `anchorIds: ["foldable"]` again later.'),
      "foldable",
    );
  });
});
