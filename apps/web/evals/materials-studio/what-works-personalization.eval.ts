import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { EVAL_FIXTURE_FAMILY_ID } from "../../lib/family-context-eval-fixture";
import { getMaterialPinned } from "../../lib/materials/library";

interface PrintableOutput {
  created?: boolean;
  material?: { id?: string };
}

/**
 * The Walker fixture says Finn works longer with a train-conductor mission,
 * a strategy the parent does not repeat in this request. Passing requires the
 * saved final material itself to carry that strategy, not merely a friendly
 * reply about personalization.
 *
 * Run with:
 * `pnpm eval:sandbox materials-studio/what-works-personalization`
 */
export default defineEval({
  description:
    "A material uses the child's saved what-works strategy even when the parent does not repeat it.",
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Make Finn a one-page worksheet to practice counting to 20. Please make it now.",
    );

    t.loadedSkill("materials-studio");
    const printableCalls = turn.toolCalls.filter(
      (call) => call.name === "create_printable",
    );
    const latest = printableCalls[printableCalls.length - 1]?.output as
      | PrintableOutput
      | undefined;
    const materialId = latest?.created ? latest.material?.id : undefined;

    t.check(
      materialId,
      satisfies(
        (value) => typeof value === "string" && value.length > 0,
        "create_printable saved a final material",
      ),
    );
    if (!materialId) return;

    const material = await getMaterialPinned(EVAL_FIXTURE_FAMILY_ID, materialId);
    const authored = `${material?.title ?? ""}\n${material?.html ?? ""}`;
    t.check(
      authored,
      satisfies(
        (value) => /train|conductor|station|railway/iu.test(String(value)),
        "the saved material reflects Finn's train-conductor what-works memory",
      ),
    );
  },
});
