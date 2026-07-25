import { defineEval } from "eve/evals";

/**
 * Anchor selection survives without the deleted SKILL.md anchor table:
 * generate_image's anchorIds describe (rendered from the registry) is
 * the only menu. The invariant guarded here is conditional on purpose:
 * when an anchored-format build reaches generate_image, the matching
 * anchor id rides along. Creation-path choice (own HTML versus image)
 * stays the skill's judgment, so a pure-HTML foldable passes as long
 * as the build actually happened. Measured 2026-07-25: the strict
 * always-uses-the-image-path version failed 5/6 across BOTH the
 * table-present and table-deleted trees, so path choice, not menu
 * placement, is the variable; that pre-existing weakness is tracked in
 * the plan doc, not asserted here.
 *
 * Greened 2026-07-25, same-day follow-up. Diagnosis from 6-repeat
 * transcripts: Homa read the foldable recipe in 6/6 runs and still
 * dropped the anchor in 3, always on the first call, so the weak link
 * was the moment of call composition, not recipe routing. Three
 * changes: the anchor rule now opens SKILL.md's "Working with
 * generate_image" checklist (the section every failing prompt was
 * visibly following), the anchorIds describe matches the MATERIAL
 * rather than the single image (hybrid spot art used to read as "not a
 * foldable" and omit), and generate_image's failure notes remind a
 * retry to keep anchorIds (post-failure retries shed the anchor while
 * hunting for the failing input). First-call carriage went 3/6 to
 * 18/18 across three repeat batches; on the final tree every
 * generate_image call in every run carried the anchor (19/19,
 * retry chains included). Residual flake is environmental: eval
 * sessions resolve no family, so every tool fails closed and Homa
 * sometimes honestly aborts before create_printable.
 */
export default defineEval({
  description:
    "An anchored-format build that reaches generate_image passes the matching anchor id.",
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send(
      "Can you make Finn a foldable about the water cycle?",
    );
    t.loadedSkill("materials-studio");
    t.calledTool("create_printable");
    t.eventsSatisfy(
      "every generate_image call carried the foldable anchor",
      () =>
        turn.toolCalls
          .filter((call) => call.name === "generate_image")
          .every(
            (call) =>
              Array.isArray(call.input.anchorIds)
              && call.input.anchorIds.includes("foldable"),
          ),
    );
  },
});
