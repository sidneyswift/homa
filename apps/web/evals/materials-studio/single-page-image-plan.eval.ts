import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

/**
 * Production-derived regression for the 2026-07-31 dollhouse worksheet
 * incident. One build generated a complete ten-object grid, then generated
 * the same ten objects separately. The page spent about seven minutes in
 * image calls even though one composed scene was already available.
 *
 * This eval measures the workflow, not a quota. A single page may choose HTML
 * only or one composed image. It must also finish with visual QA passing inside
 * the five-minute ordinary-material contract.
 *
 * Run with:
 * `pnpm eval:sandbox materials-studio/single-page-image-plan`
 */
export default defineEval({
  description:
    "A ten-object single-page dollhouse worksheet uses one coherent image plan and passes QA within five minutes.",
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Make Maya a one-page Spanish dollhouse picture-vocabulary worksheet. Include these ten distinct things: house, table, bed, sofa, ball, seal, teddy bear, flower, heart, and envelope. Put the exact Spanish labels in a word bank and make the page printable.",
    );

    t.loadedSkill("materials-studio");
    t.calledTool("create_printable", {
      output: (value) => {
        const output = value as {
          created?: unknown;
          review?: { pass?: unknown } | null;
        } | null;
        return output?.created === true && output.review?.pass === true;
      },
    });

    const imageCalls = turn.toolCalls.filter(
      (call) => call.name === "generate_image",
    ).length;
    t.check(
      imageCalls,
      satisfies(
        (count) => (count as number) <= 1,
        "the single page used HTML only or one composed image, never per-object generation",
      ),
    );
  },
});
