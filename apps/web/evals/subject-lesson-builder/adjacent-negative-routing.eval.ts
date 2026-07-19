import { defineEval } from "eve/evals";

/**
 * Adjacent negative: ordinary parent material work belongs to the materials
 * studio and must not enter the internal lesson persistence workflow.
 */
export default defineEval({
  description:
    "An ordinary parent worksheet request does not load subject-lesson-builder.",
  async test(t) {
    const turn = await t.send(
      "Can you make Maya a short-vowel worksheet with three word-building activities?",
    );
    t.succeeded();
    t.loadedSkill("materials-studio");
    t.eventsSatisfy(
      "subject-lesson-builder was not loaded",
      () =>
        turn.toolCalls.every(
          (call) =>
            call.name !== "load_skill"
            || call.input.skill !== "subject-lesson-builder",
        ),
    );
  },
});
