import { defineEval } from "eve/evals";

export default defineEval({
  description: "Putting approved work on a date stays with planner.",
  async test(t) {
    const turn = await t.send(
      "Put Maya’s existing reading practice on Tuesday at 10am.",
    );
    t.succeeded();
    t.loadedSkill("planner");
    t.eventsSatisfy(
      "progress-next-move was not loaded",
      () =>
        turn.toolCalls.every(
          (call) =>
            call.name !== "load_skill" ||
            call.input.skill !== "progress-next-move",
        ),
    );
  },
});
