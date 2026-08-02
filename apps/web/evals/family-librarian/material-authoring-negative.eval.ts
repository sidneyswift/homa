import { defineEval } from "eve/evals";

/**
 * Adjacent negative: a fresh worksheet belongs directly to materials-studio
 * when the parent does not name an owned or uploaded source.
 */
export default defineEval({
  description:
    "A fresh worksheet request routes to materials-studio without searching Family Library.",
  async test(t) {
    const turn = await t.send(
      "Make Maya a fresh counting worksheet with twelve friendly forest animals.",
    );

    t.loadedSkill("materials-studio");
    t.eventsSatisfy(
      "family-librarian was not loaded and Library retrieval did not run",
      () =>
        turn.toolCalls.every(
          (call) =>
            (call.name !== "load_skill" ||
              call.input.skill !== "family-librarian") &&
            call.name !== "find_family_assets" &&
            call.name !== "get_family_asset",
        ),
    );
  },
});
