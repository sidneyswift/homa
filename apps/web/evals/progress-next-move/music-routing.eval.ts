import { defineEval } from "eve/evals";

export default defineEval({
  description: "A request for one music activity grounded in Progress reaches the next-move procedure even when subject details are omitted from context.",
  tags: ["progress-next-move", "routing"],
  async test(t) {
    await t.send("Based on her Progress, what is one music activity Maya could try next?");
    t.succeeded();
    t.loadedSkill("progress-next-move");
  },
});
