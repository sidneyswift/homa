import { defineEval } from "eve/evals";

export default defineEval({
  description: "Explaining existing Progress evidence does not start a new question sitting.",
  async test(t) {
    const turn = await t.send("What does getting there mean on Maya's math Progress? I only want to understand the label.");
    t.succeeded();
    t.eventsSatisfy("does not load the check-in skill", () => turn.toolCalls.every(call => call.name !== "load_skill" || call.input.skill !== "progress-check-in"));
    t.notCalledTool("manage_child_progress");
  },
});
