import { defineEval } from "eve/evals";

/**
 * Adjacent negative for the two subject-decision-rule sections folded into
 * materials-studio: a nearby but non-material request should not trigger
 * load_skill at all (docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md
 * §8.2 "adjacent negative prompts that must not load it").
 */
export default defineEval({
  description: "Asking what to teach next (no material request) does not load materials-studio.",
  async test(t) {
    await t.send("What should we work on with letters this month?");
    t.succeeded();
    t.notCalledTool("load_skill");
  },
});
