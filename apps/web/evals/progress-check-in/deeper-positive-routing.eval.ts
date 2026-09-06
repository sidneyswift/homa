import { defineEval } from "eve/evals";

export default defineEval({
  description: "The founder's request for extra fine motor questions routes to the shared check-in procedure.",
  async test(t) {
    await t.send("I want to update Maya's fine motor report. Do you have extra questions I can answer about what she can do?");
    t.succeeded();
    t.loadedSkill("progress-check-in");
  },
});
