/**
 * The recipe checklist grammar: how a materials-studio recipe declares
 * the closed, countable structural spec its pages must meet, and how the
 * anchor it rides on is read back out of the recipe text.
 *
 * Why a grammar in the recipe markdown and not a model-supplied list: a
 * letter-formation worksheet shipped too small to trace after a revision
 * fixing page overflow silently shrank the letters (2026-09-02). The
 * vision reviewer had no structural spec for the format, so "four trace
 * boxes the size of the model box" was never a question it was asked.
 * Carrying the checklist in code means the model passes only a recipe
 * slug; the tool resolves the items from the generated registry
 * (recipes.generated.ts, built by scripts/build-recipe-registry.mts) and
 * the reviewer answers each one with a closed enum. A model-carried list
 * would decay the way anchorIds did before its describe rewrite
 * (anchor-usage.eval.ts) and cost output tokens on every call.
 *
 * The block lives inline in the recipe, fenced as `homa-checklist`,
 * because scripts/fleet-skills-check.mts fails on any references/ file
 * SKILL.md never names, so a sibling file per recipe would need a
 * mention for every one of them.
 *
 * Pure module on purpose: no imports, so the strip-types build script
 * can load it as well as Next, eve build, and tsx.
 *
 * Grammar, one item per line inside the fence:
 *
 *     - <severity> <id>: <check>
 *
 * `severity` is `blocking` (a no holds the page back) or `advisory` (a no
 * rides beside the page as a named note). `id` is a short kebab slug,
 * unique within the recipe. `check` is one sentence written so that
 * "yes" is the good answer. One to eight items per recipe; a recipe with
 * no block has an empty checklist and still gets provenance.
 */

export type RecipeChecklistSeverity = "blocking" | "advisory";

export interface RecipeChecklistItem {
  readonly id: string;
  readonly check: string;
  readonly severity: RecipeChecklistSeverity;
}

export interface ParsedRecipeChecklist {
  items: RecipeChecklistItem[];
  /** Grammar violations, each naming the line. Empty when the block is
   * well formed (or absent). */
  problems: string[];
}

export const RECIPE_CHECKLIST_FENCE = "homa-checklist";
export const RECIPE_CHECKLIST_SEVERITIES: readonly RecipeChecklistSeverity[] = [
  "blocking",
  "advisory",
];
export const RECIPE_CHECKLIST_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,39}$/;
export const RECIPE_CHECKLIST_MIN_CHECK_CHARS = 12;
export const RECIPE_CHECKLIST_MAX_CHECK_CHARS = 320;
export const RECIPE_CHECKLIST_MAX_ITEMS = 8;

const FENCE_OPEN = /^```([A-Za-z0-9_-]*)\s*$/;
const FENCE_CLOSE = /^```\s*$/;
const ITEM_LINE = /^-\s+(\S+)\s+([^:]*?)\s*:\s*(.*)$/;

function isSeverity(value: string): value is RecipeChecklistSeverity {
  return (RECIPE_CHECKLIST_SEVERITIES as readonly string[]).includes(value);
}

/**
 * parseRecipeChecklist(markdown): the recipe's checklist items and every
 * grammar problem found. Problems never throw: the builder decides to
 * fail loud, and a test can name the exact violation.
 */
export function parseRecipeChecklist(markdown: string): ParsedRecipeChecklist {
  const items: RecipeChecklistItem[] = [];
  const problems: string[] = [];
  const lines = markdown.split("\n");

  let blocksSeen = 0;
  let inChecklist = false;
  let inOtherFence = false;
  let blockStartLine = 0;
  let blockItemCount = 0;
  const seenIds = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\r$/, "");
    const lineNumber = index + 1;

    if (inOtherFence) {
      if (FENCE_CLOSE.test(line)) inOtherFence = false;
      continue;
    }

    if (!inChecklist) {
      const open = FENCE_OPEN.exec(line);
      if (!open) continue;
      if (open[1] !== RECIPE_CHECKLIST_FENCE) {
        // A worked-HTML or prompt fence: skip its body so a stray
        // "- blocking ..." inside it is never read as a checklist line.
        inOtherFence = true;
        continue;
      }
      blocksSeen += 1;
      if (blocksSeen > 1) {
        problems.push(
          `line ${lineNumber}: a second ${RECIPE_CHECKLIST_FENCE} block; a recipe carries exactly one`,
        );
      }
      inChecklist = true;
      blockStartLine = lineNumber;
      blockItemCount = 0;
      continue;
    }

    if (FENCE_CLOSE.test(line)) {
      inChecklist = false;
      if (blockItemCount === 0) {
        problems.push(
          `line ${blockStartLine}: the ${RECIPE_CHECKLIST_FENCE} block has no items`,
        );
      }
      continue;
    }

    if (line.trim() === "") continue;

    const match = ITEM_LINE.exec(line);
    if (!match) {
      problems.push(
        `line ${lineNumber}: expected "- <severity> <id>: <check>" (missing colon or malformed item)`,
      );
      continue;
    }
    const [, severity, id, check] = match;
    let valid = true;
    if (!isSeverity(severity)) {
      problems.push(
        `line ${lineNumber}: severity "${severity}" is not one of ${RECIPE_CHECKLIST_SEVERITIES.join(", ")}`,
      );
      valid = false;
    }
    if (!RECIPE_CHECKLIST_ID_PATTERN.test(id)) {
      problems.push(
        `line ${lineNumber}: id "${id}" must match ${RECIPE_CHECKLIST_ID_PATTERN.source}`,
      );
      valid = false;
    } else if (seenIds.has(id)) {
      problems.push(`line ${lineNumber}: duplicate id "${id}"`);
      valid = false;
    }
    const trimmedCheck = check.trim();
    if (
      trimmedCheck.length < RECIPE_CHECKLIST_MIN_CHECK_CHARS
      || trimmedCheck.length > RECIPE_CHECKLIST_MAX_CHECK_CHARS
    ) {
      problems.push(
        `line ${lineNumber}: check for "${id}" is ${trimmedCheck.length} characters; it must be ${RECIPE_CHECKLIST_MIN_CHECK_CHARS} to ${RECIPE_CHECKLIST_MAX_CHECK_CHARS}`,
      );
      valid = false;
    }
    blockItemCount += 1;
    if (blockItemCount > RECIPE_CHECKLIST_MAX_ITEMS) {
      problems.push(
        `line ${lineNumber}: item ${blockItemCount} is past the ${RECIPE_CHECKLIST_MAX_ITEMS}-item cap`,
      );
      valid = false;
    }
    if (!valid) continue;
    seenIds.add(id);
    items.push({
      id,
      check: trimmedCheck,
      severity: severity as RecipeChecklistSeverity,
    });
  }

  if (inChecklist) {
    problems.push(
      `line ${blockStartLine}: the ${RECIPE_CHECKLIST_FENCE} block is never closed`,
    );
  }

  return { items, problems };
}

/** Mirrors the mention scripts/fleet-skills-check.mts validates against
 * the anchor registry, so both readers agree on what a recipe declares. */
const ANCHOR_IDS_MENTION = /anchorIds:\s*\[([^\]]*)\]/;
const QUOTED_ID = /"([^"]+)"/;

/**
 * parseRecipeAnchorId(markdown): the first anchor id the recipe tells
 * Homa to pass to generate_image, or null for a recipe with no anchor.
 * The registry check (recipe-registry.test.ts) proves the id resolves.
 */
export function parseRecipeAnchorId(markdown: string): string | null {
  const mention = ANCHOR_IDS_MENTION.exec(markdown);
  if (!mention) return null;
  const quoted = QUOTED_ID.exec(mention[1]);
  return quoted ? quoted[1] : null;
}
