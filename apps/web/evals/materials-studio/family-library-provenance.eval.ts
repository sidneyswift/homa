import { defineEval } from "eve/evals";

import { EVAL_FIXTURE_LIBRARY_ASSET_ID } from "../../lib/family-context-eval-fixture";

/**
 * A Library-grounded printable must carry the exact retrieved asset id into
 * create_printable. Naming the source in prose is not durable provenance.
 */
export default defineEval({
  description:
    "A printable grounded in an uploaded curriculum preserves its exact Family Library source.",
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Use my uploaded Blossom and Root Early Years Science, Volume 1 to make Maya a one-page seeds and plants observation sheet. Find and open my copy first, then make the printable.",
    );

    t.loadedSkill("family-librarian");
    t.loadedSkill("materials-studio");
    t.calledTool("create_printable");
    t.eventsSatisfy(
      "the printable carries the exact retrieved Family Library asset id",
      () =>
        turn.toolCalls
          .filter((call) => call.name === "create_printable")
          .every(
            (call) =>
              Array.isArray(call.input.sourceFamilyAssetIds)
              && call.input.sourceFamilyAssetIds.includes(
                EVAL_FIXTURE_LIBRARY_ASSET_ID,
              ),
          ),
    );
  },
});
