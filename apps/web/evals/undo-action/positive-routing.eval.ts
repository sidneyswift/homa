import { defineEval } from "eve/evals";

export default defineEval({
  description: "A parent asking to undo the action Homa just took loads the undo procedure.",
  async test(t) {
    await t.send("Wait, undo that last thing you just did.");
    t.succeeded();
    t.loadedSkill("undo-action");
  },
});
