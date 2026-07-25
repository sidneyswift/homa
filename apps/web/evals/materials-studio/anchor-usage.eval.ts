import { defineEval } from "eve/evals";

/**
 * Anchor selection survives without the deleted SKILL.md anchor table:
 * generate_image's anchorIds describe (rendered from the registry) is
 * the only menu, and an anchored-format request must still pass the
 * matching id. Asserts on the call input, never on generation success,
 * so a slow or failed image render cannot flake the routing question.
 */
export default defineEval({
  description:
    "An anchored-format build passes the matching anchor id to generate_image.",
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send(
      "Can you make Finn a foldable about the water cycle?",
    );
    t.loadedSkill("materials-studio");
    t.eventsSatisfy(
      "generate_image was called with the foldable anchor",
      () =>
        turn.toolCalls.some(
          (call) =>
            call.name === "generate_image"
            && Array.isArray(call.input.anchorIds)
            && call.input.anchorIds.includes("foldable"),
        ),
    );
  },
});
