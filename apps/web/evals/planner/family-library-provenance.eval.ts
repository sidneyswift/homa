import { defineEval } from "eve/evals";

import { EVAL_FIXTURE_LIBRARY_ASSET_ID } from "../../lib/family-context-eval-fixture";

/**
 * Planner provenance is established at the write boundary. This catches the
 * failure where Eve reads the family source but drops its id on edit_plan.
 */
export default defineEval({
  description:
    "A planner activity grounded in an uploaded curriculum preserves its exact Family Library source.",
  async test(t) {
    const turn = await t.send(
      "Use my uploaded Blossom and Root Early Years Science, Volume 1 as the source. On Finn's existing math plan, add a Week 2 activity where he counts seeds into groups. Find and open my copy first.",
    );

    t.loadedSkill("family-librarian");
    t.loadedSkill("planner");
    t.calledTool("open_planner");
    t.calledTool("edit_plan");
    t.eventsSatisfy(
      "the plan edit carries the exact retrieved Family Library asset id",
      () =>
        turn.toolCalls
          .filter((call) => call.name === "edit_plan")
          .every((call) => {
            const edits = Array.isArray(call.input.edits)
              ? call.input.edits
              : [];
            return edits.some(
              (edit) =>
                edit
                && typeof edit === "object"
                && Array.isArray(edit.sourceFamilyAssetIds)
                && edit.sourceFamilyAssetIds.includes(
                  EVAL_FIXTURE_LIBRARY_ASSET_ID,
                ),
            );
          }),
    );
  },
});
