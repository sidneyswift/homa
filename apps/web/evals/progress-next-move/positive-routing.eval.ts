import { defineEval } from "eve/evals";

export default defineEval({
  description: "A parent asking for one next move from Progress loads progress-next-move.",
  async test(t) {
    await t.send("What should Maya try next based on her Progress page?");
    t.succeeded();
    t.loadedSkill("progress-next-move");
  },
});
