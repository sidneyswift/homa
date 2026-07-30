import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { EVAL_FIXTURE_FAMILY_ID } from "../../lib/family-context-eval-fixture";
import { getMaterialPinned } from "../../lib/materials/library";
import { splitPageBodies } from "../../lib/materials/page-shell";

/**
 * A real revision saga, paraphrased onto Maya: a set of recall-fact
 * flashcards that needed round after round of correction on card size,
 * cards-per-page density, and ink-heavy shading before it was print-ready.
 * The real family generated a religious-education flashcard deck for four
 * children and needed 8-12 revision rounds per child across six separate
 * chains before any of them landed. Real wording and the family this is
 * drawn from live only in
 * docs/homa-planning/plans/2026-07-29-materials-fill-convergence-evals.md,
 * never here.
 *
 * This is a DIFFERENT defect class from the other fill-convergence evals
 * in this set. Those measure gh#349's fill/overflow signal (does content
 * reach the bottom of the page). This family's cards were never
 * underfilled or overflowing; the defect is print economy: no stated
 * default card size, no cards-per-page density target, and no ink-economy
 * default for a format that gets printed and cut in volume. geometryToolNotes
 * has nothing to say about any of that, so this eval reads the produced
 * material's own HTML (getMaterialPinned + splitPageBodies, the
 * packet-page-revision.eval.ts pattern) instead of reusing
 * fill-convergence-support.ts's geometry-only usability check.
 *
 * The footer half of the real complaint sequence ("take the watermark
 * off", "move the flashcard with the footer to another page") is
 * deliberately NOT scripted here: the platform's D7 footer is a binding,
 * permanent constraint (page-shell.ts), not a defect, and the parent's
 * own workaround (isolating that card to its own page) was already the
 * correct handling. Scripting a turn asking to remove the footer would
 * make "converge" mean "made the footer removable", which is not a result
 * this eval should ever reward.
 *
 * Turn 1 is the plain opening ask (12 sight words, a number that divides
 * evenly by the four-per-page target so page count is unambiguous). Turns
 * 2-5 are the real parent's own revision-round wording, in order,
 * paraphrased onto this family: shading, size, four-per-page, then
 * maximum density at that size.
 *
 * Needs the sandbox for family-scoped tools:
 * `pnpm eval:sandbox materials-studio/fill-convergence-flashcard-density`.
 */

/** 2.5in x 3.5in ("baseball card" size) is the largest whole grid the
 * 7.3in x 9.5in html content box holds: 3 columns need 7.5in, 3 rows need
 * 10.5in, both past the box, so 2x2 is the ceiling. */
const MAX_CARDS_PER_PAGE = 4;
const SIGHT_WORD_COUNT = 12;
const EXPECTED_PAGE_COUNT = SIGHT_WORD_COUNT / MAX_CARDS_PER_PAGE;

/**
 * Counts card-shaped cells: elements styled with a dashed cut-line border,
 * the convention every card-style recipe in this skill uses (tracing
 * guides, nomenclature cards, the flash-card recipe itself).
 *
 * A page's html defines the card style ONCE, in a CSS class inside
 * <style>, and applies that class many times in the body; naively
 * counting "border...dashed" text occurrences across the whole page only
 * ever finds the one class definition (the first version of this check
 * did exactly that, and silently reported 1 "card" per page no matter how
 * many the page actually held). So this finds which class name(s) carry a
 * dashed border in <style>, then counts how many elements in the BODY
 * apply that class. Falls back to counting inline "border...dashed"
 * occurrences outside <style> for a page that styles each card inline
 * instead of via a shared class.
 */
function countCardCells(pageHtml: string): number {
  const styleMatch = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(pageHtml);
  const styleBlock = styleMatch?.[1] ?? "";
  const bodyHtml = styleMatch
    ? pageHtml.slice(0, styleMatch.index) + pageHtml.slice(styleMatch.index + styleMatch[0].length)
    : pageHtml;

  const dashedClassNames = new Set<string>();
  for (const rule of styleBlock.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selectors, declarations] = rule;
    if (/border[^;]*dashed/i.test(declarations)) {
      for (const selector of selectors.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
        dashedClassNames.add(selector[1]);
      }
    }
  }

  if (dashedClassNames.size > 0) {
    let count = 0;
    for (const className of dashedClassNames) {
      const usages = [
        ...bodyHtml.matchAll(new RegExp(`class\\s*=\\s*["'][^"']*\\b${className}\\b[^"']*["']`, "gi")),
      ].length;
      count = Math.max(count, usages);
    }
    return count;
  }

  // No class carries a dashed border; the page may style each card inline.
  return [...bodyHtml.matchAll(/border[^;"'}]{0,60}dashed/gi)].length;
}

/** True when a page declares a non-white, non-transparent background
 * anywhere: the ink-economy defect the real parent named first
 * ("take out the shading"). */
function hasShadedFill(pageHtml: string): boolean {
  const declarations = [...pageHtml.matchAll(/background(?:-color)?\s*:\s*([^;"'}]+)/gi)];
  return declarations.some(([, rawValue]) => {
    const value = rawValue.trim().toLowerCase();
    return (
      value !== "none"
      && value !== "transparent"
      && value !== "white"
      && value !== "#fff"
      && value !== "#ffffff"
    );
  });
}

interface PrintableOutput {
  created?: boolean;
  material?: { id?: string };
}

export default defineEval({
  description:
    "A flashcard set for a young reader defaults to baseball-card size, the maximum cards-per-page that size allows, and no ink-heavy shading, instead of needing rounds of correction on all three.",
  timeoutMs: 1_200_000,
  async test(t) {
    const turns = [
      `Can you make Maya a set of flashcards for her ${SIGHT_WORD_COUNT} sight words this week: the, and, said, was, you, they, of, to, look, come, my, like?`,
      "Take out the shading on the flashcards.",
      "Resize each flashcard to baseball card size.",
      "Reformat it to four cards per page so I can print and cut them out.",
      "Can you fit the most flashcards possible on each page? Just keep the card size the same.",
    ];

    let convergedAtTurn: number | null = null;
    let lastMaterialId: string | undefined;
    const trace: string[] = [];

    for (const [index, parentText] of turns.entries()) {
      const turn = await t.send(parentText);
      const printableCalls = turn.toolCalls.filter((call) => call.name === "create_printable");
      const latest = printableCalls[printableCalls.length - 1]?.output as
        | PrintableOutput
        | undefined;

      // A turn can legitimately produce no new build: the parent's ask was
      // already satisfied by the last version, and the correct response is
      // to say so, not to rebuild for its own sake. Re-check the LAST
      // produced material rather than counting a confirming reply as a
      // regression back to "not usable".
      if (latest?.created && latest.material?.id) {
        lastMaterialId = latest.material.id;
      } else if (!lastMaterialId) {
        const toolNames = turn.toolCalls.map((call) => call.name).join(", ") || "none";
        trace.push(
          `turn ${index + 1}: no successful create_printable call yet (tools called: ${toolNames}; message: ${(turn.message ?? "").slice(0, 200)})`,
        );
        continue;
      }

      const produced = await getMaterialPinned(EVAL_FIXTURE_FAMILY_ID, lastMaterialId);
      const pages = produced?.html ? splitPageBodies(produced.html) : [];
      const cardsPerPage = pages.map(countCardCells);
      const anyShaded = pages.some(hasShadedFill);
      const densityOk =
        pages.length === EXPECTED_PAGE_COUNT
        && cardsPerPage.every((count) => count === MAX_CARDS_PER_PAGE);
      const usable = densityOk && !anyShaded;

      trace.push(
        `turn ${index + 1}: "${parentText.slice(0, 60)}" -> ${pages.length} page(s), cards/page ${JSON.stringify(cardsPerPage)}, shaded=${anyShaded} -> ${usable ? "USABLE" : "not usable"}`,
      );
      if (!usable) {
        trace.push(`  page 1 html (first 500 chars): ${(pages[0] ?? "").slice(0, 500)}`);
      }

      if (usable) {
        convergedAtTurn = index + 1;
        break;
      }
    }

    console.error(`\n── fill convergence: flashcard density (Maya) ─────────`);
    console.error(trace.join("\n"));
    console.error(
      convergedAtTurn !== null
        ? `  converged at turn ${convergedAtTurn}\n`
        : `  never converged in ${turns.length} turns\n`,
    );

    t.loadedSkill("materials-studio");

    t.check(
      convergedAtTurn,
      satisfies((value) => value !== null, "converged within the scripted transcript"),
    );
    t.check(
      convergedAtTurn,
      satisfies(
        (value) => value !== null && (value as number) <= 2,
        "converged within 2 turns",
      ),
    ).soft();
  },
});
