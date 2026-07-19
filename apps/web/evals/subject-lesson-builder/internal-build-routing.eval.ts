import { defineEval } from "eve/evals";

/**
 * Positive routing fixture for the dispatch-only lesson package. The wording
 * is intentionally not copied from the skill description.
 */
export default defineEval({
  description:
    "A trusted internal subject lesson build loads subject-lesson-builder.",
  async test(t) {
    await t.send(
      "This is a trusted internal subject lesson build. Save one next-skill lesson for Maya's exact literacy target, then make and attach its reviewed worksheet.",
    );
    t.succeeded();
    t.loadedSkill("subject-lesson-builder");
  },
});
