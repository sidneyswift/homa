import { defineEval } from "eve/evals";

/**
 * Adjacent negative for the two subject-decision-rule sections folded into
 * materials-studio: a nearby but non-material request must not trigger
 * materials-studio (docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md
 * §8.2 "adjacent negative prompts that must not load it").
 */
export default defineEval({
  description: "Asking what to teach next (no material request) does not load materials-studio.",
  async test(t) {
    const turn = await t.send("What should we work on with letters this month?");
    t.succeeded();
    t.eventsSatisfy("does not load material creation for a next-step question", () =>
      turn.toolCalls.every((call) => !(call.name === "load_skill" && call.input.skill === "materials-studio")));
    t.notCalledTool("create_printable");
    t.notCalledTool("generate_image");
  },
});
