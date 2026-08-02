import { defineEval } from "eve/evals";

/**
 * Adjacent negative: authoring a new curriculum from the child's context does
 * not imply that the family has an uploaded source to retrieve.
 */
export default defineEval({
  description:
    "A from-scratch curriculum request routes to curriculum-studio without searching Family Library.",
  async test(t) {
    const turn = await t.send(
      "Build Maya a new twelve-week phonics curriculum from scratch, based on where she is now.",
    );

    t.succeeded();
    t.loadedSkill("curriculum-studio");
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
