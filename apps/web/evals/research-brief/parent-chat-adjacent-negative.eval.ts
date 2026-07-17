import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A parent's nearby phonics question does not load the dispatch-only research brief skill.",
  async test(t) {
    await t.send(
      "Can you explain why Story's word blending sounds choppy and what it might mean?",
    );
    t.succeeded();
    t.notCalledTool("load_skill");
  },
});
