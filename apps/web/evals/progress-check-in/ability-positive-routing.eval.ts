import { defineEval } from "eve/evals";

export default defineEval({
  description: "Finding a child's present ability routes to questions without requiring UI wording.",
  async test(t) {
    await t.send("Those music warm-up questions are too easy for Finn. Can you ask me a few that help work out what he can do now?");
    t.succeeded();
    t.loadedSkill("progress-check-in");
  },
});
