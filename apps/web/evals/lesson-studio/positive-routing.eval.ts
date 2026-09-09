import { defineEval } from "eve/evals";

export default defineEval({
  description: "A complete one-skill lesson request loads lesson-studio before building.",
  async test(t) {
    await t.send("I want a complete lesson for Maya on adding two numbers with totals up to 10. She can count objects to 10 already. Before making any pages, explain how you would organize the teaching, practice, quick check, and answer key.");
    t.succeeded();
    t.loadedSkill("lesson-studio");
    t.notCalledTool("create_printable");
    t.notCalledTool("open_planner");
  },
});
