import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A printable request loads materials-studio without preparing a morning brief.",
  async test(t) {
    await t.send(
      "Make Story a printable word strip for practicing smooth blending.",
    );
    t.succeeded();
    t.loadedSkill("materials-studio");
    t.calledTool("load_skill", { count: 1 });
    t.notCalledTool("prepare_research_brief");
  },
});
