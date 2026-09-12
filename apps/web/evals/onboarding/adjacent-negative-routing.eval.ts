import { defineEval } from "eve/evals";

/**
 * The adversarial negative for the onboarding skill. Its description
 * mentions first days, families, and getting set up, which is close
 * enough to ordinary parent language that a settled family asking a
 * normal question could pull it in by accident.
 *
 * That failure is loud rather than subtle: the skill opens by telling
 * Homa this parent is in her first days and to run the arc, so a family
 * six weeks in would get greeted like a stranger and walked back through
 * setup she finished. Nothing else in the flow would look wrong.
 */
export default defineEval({
  description:
    "A settled family's ordinary question does not load the onboarding skill.",
  async test(t) {
    const turn = await t.send("We had a rough morning with reading. What should I try tomorrow?");
    t.succeeded();
    t.eventsSatisfy("does not restart onboarding for a settled family", () =>
      turn.toolCalls.every((call) => !(call.name === "load_skill" && call.input.skill === "onboarding")));
    t.notCalledTool("ask_for_details");
  },
});
