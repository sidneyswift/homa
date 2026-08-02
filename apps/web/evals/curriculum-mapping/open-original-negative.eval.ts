import { defineEval } from "eve/evals";

/** Base Library access is never a Homa Plus decomposition action. */
export default defineEval({
  description:
    "Opening an uploaded curriculum stays in family-librarian and does not load curriculum-mapping.",
  async test(t) {
    const turn = await t.send(
      "Open my uploaded Blossom and Root Early Years Science, Volume 1 and tell me which child I saved it for. Do not break it into units or add it to Planner.",
    );

    t.succeeded();
    t.loadedSkill("family-librarian");
    t.eventsSatisfy(
      "base Library access does not invoke the Plus workflow",
      () =>
        turn.toolCalls.every(
          (call) =>
            (call.name !== "load_skill" || call.input.skill !== "curriculum-mapping") &&
            call.name !== "read_family_curriculum" &&
            call.name !== "preview_curriculum_mapping" &&
            call.name !== "approve_curriculum_mapping",
        ),
    );
  },
});
