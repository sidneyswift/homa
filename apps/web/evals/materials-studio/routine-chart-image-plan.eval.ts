import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

/**
 * Production-derived regression for Carolyng's 2026-08-03 routine-chart
 * incident. A routine sheet spent separate image calls on its individual
 * chores, then a revision spent them again. Routine cards are one composed
 * visual-schedule page or HTML, never a per-card art job.
 *
 * Run with:
 * `pnpm eval:sandbox materials-studio/routine-chart-image-plan`
 */
export default defineEval({
  description:
    "A one-page evening routine chart uses HTML or one composed visual-schedule image, never per-card generations.",
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Make one printable evening routine chart for Maya: dinner, wipe the table, bath, brush teeth, pajamas, read aloud, and lights out. Use object-only pictures, not a child in the art. I want icon cards with exact Spanish labels and checkboxes.",
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
        "the routine chart used HTML or one composed schedule image, never one image per chore card",
      ),
    );
  },
});
