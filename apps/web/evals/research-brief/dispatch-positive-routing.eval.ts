import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A weekday morning dispatch loads the research-brief fleet skill.",
  async test(t) {
    await t.send(
      "It is this family's weekday morning research brief moment. Load the relevant skill first. This is a routing check, so stop after loading it.",
    );
    t.succeeded();
    t.loadedSkill("research-brief");
    t.notCalledTool("web_search");
    t.notCalledTool("save_knowledge");
  },
});
