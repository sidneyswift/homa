import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { EVAL_FIXTURE_FAMILY_ID } from "../../lib/family-context-eval-fixture";
import { RECIPE_REGISTRY } from "../../lib/materials/recipes.generated";
import { readMaterialGeneration } from "./material-generation-support";

/**
 * The letter-formation scar, end to end (2026-09-02). A co-founder asked
 * for a capital-D tracing page five times in one afternoon; the letters
 * came out too small to trace, got fixed, then an overflow fix silently
 * shrank them again. The reviewer had no spec for the format, no memory
 * of the accepted size, and no idea which recipe the page followed.
 *
 * What this guards is the wiring that fix added, read from the row the
 * tool actually wrote, never from what the model said it did:
 *
 *   - the build named its recipe (generation.input.recipe), which is the
 *     column every per-format measurement keys on;
 *   - the reviewer answered that recipe's closed checklist item by item
 *     (generation.review.checklist), so "is the trace row as big as the
 *     model letter" is a question the studio asked itself, not a hope;
 *   - the reviewer saw the format's golden anchor beside the page
 *     (generation.review.anchorShown), so "too small" has a reference.
 *
 * The prompt names the child's working edge, not just a topic: a prompt
 * that only names "letter D" has parked on a calibration question before
 * (memory: eval-scripted-turn-needs-working-edge).
 *
 * Needs the sandbox for a real database and blob store:
 * `pnpm eval:sandbox materials-studio/formation-page-provenance`.
 */
const RECIPE = "letter-number-formation-practice";

export default defineEval({
  description:
    "A letter-formation page records its recipe, a checklist verdict per item, and an anchor-backed review.",
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "Finn is working on capital D right now and keeps starting the curve at the bottom. Can you make him a letter D formation practice page, just the one letter, big enough for a four year old to trace?",
    );
    t.loadedSkill("materials-studio");

    const printableCalls = turn.toolCalls.filter((call) => call.name === "create_printable");
    const created = printableCalls
      .map((call) => ({
        input: call.input as { recipe?: unknown },
        output: call.output as { created?: boolean; material?: { id?: string } } | null,
      }))
      .filter((call) => call.output?.created === true);

    t.check(
      created.length,
      satisfies((count) => (count as number) >= 1, "at least one version of the page was built"),
    );

    // The recipe rode along on the call itself. A model that read the
    // recipe and dropped the slug leaves the row unmeasurable.
    t.check(
      created.map((call) => call.input.recipe),
      satisfies(
        (recipes) => (recipes as unknown[]).length > 0 && (recipes as unknown[]).every((recipe) => recipe === RECIPE),
        `every built version passed recipe: "${RECIPE}"`,
      ),
    );

    // The recipe is image-direct: every generate_image call carries the
    // format's anchor (anchor-usage.eval.ts guards the same for foldables).
    const imageCalls = turn.toolCalls.filter((call) => call.name === "generate_image");
    t.check(
      imageCalls.map((call) => call.input.anchorIds),
      satisfies(
        (lists) =>
          (lists as unknown[]).length > 0
          && (lists as unknown[]).every((list) => Array.isArray(list) && list.includes(RECIPE)),
        "every generate_image call carried the formation anchor",
      ),
    );

    // Now the row. The last built version is what she would see.
    const lastId = created[created.length - 1]?.output?.material?.id;
    const generation = lastId
      ? await readMaterialGeneration(EVAL_FIXTURE_FAMILY_ID, lastId)
      : null;

    t.check(
      generation?.input?.recipe ?? null,
      satisfies((recipe) => recipe === RECIPE, "generation.input.recipe names the recipe on the stored row"),
    );

    const review = generation?.review ?? null;
    t.check(
      review !== null,
      satisfies((ran) => ran === true, "the quality check ran on the built page (review is not null)"),
    );

    const expectedItems = RECIPE_REGISTRY[RECIPE].checklist.map((item) => item.id).sort();
    const answeredItems = (review?.checklist?.answers ?? [])
      .map((answer) => answer.id)
      .sort();
    t.check(
      { recipe: review?.checklist?.recipe ?? null, answeredItems },
      satisfies((value) => {
        const { recipe, answeredItems: ids } = value as { recipe: string | null; answeredItems: string[] };
        return recipe === RECIPE && JSON.stringify(ids) === JSON.stringify(expectedItems);
      }, `the reviewer answered every checklist item of ${RECIPE}: ${expectedItems.join(", ")}`),
    );

    t.check(
      { anchorShown: review?.anchorShown ?? false, anchorSkipped: review?.anchorSkipped ?? null },
      satisfies(
        (value) => (value as { anchorShown: boolean }).anchorShown === true,
        "the reviewer was shown the golden anchor beside the page (anchorSkipped names the reason when not)",
      ),
    );

    // What the reviewer actually said, in the run log: a failing verdict
    // is the guard working, and the reasons are the next thing to read.
    console.log(
      `[formation-page-provenance] versions built: ${created.length}; image calls: ${imageCalls.length}; review: ${JSON.stringify(
        {
          pass: review?.pass ?? null,
          issues: review?.issues ?? [],
          checklist: review?.checklist?.answers.map((answer) => `${answer.id}=${answer.answer}`) ?? null,
          blockingFailures: review?.checklist?.blockingFailures ?? [],
          anchorShown: review?.anchorShown ?? null,
          anchorSkipped: review?.anchorSkipped ?? null,
        },
      )}`,
    );

    // Quality, reported but not gating: this eval proves the guard is
    // wired, not that every generation clears the bar on the first try.
    t.check(
      review?.pass ?? null,
      satisfies((pass) => pass === true, "the last built version passed the quality check"),
    ).soft();
  },
});
