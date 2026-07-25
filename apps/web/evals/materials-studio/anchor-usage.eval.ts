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
