import { defineEval } from "eve/evals";

/**
 * Positive guard for the reshuffle procedure (issue #176, CG-03): the
 * ask the whole calendar exists for, in a co-founder's own words, is a
 * planner moment and must load the planner skill, which owns the
 * read-before-you-move workflow and the stop conditions. Routing
 * assertions only: the eval family has no scheduled plan rows, so the
 * honest answer downstream is "there is nothing on real dates to move
 * yet", not a reshuffle, and asserting moves here would test the
 * fixture rather than the routing.
 */
export default defineEval({
  description:
    "Pushing school work around a new appointment loads the planner skill.",
  async test(t) {
    await t.send(
      "We have a doctor's appointment Tuesday afternoon, can you push things back?",
    );
    t.succeeded();
    t.loadedSkill("planner");
  },
});
