import { defineEval } from "eve/evals";

export default defineEval({
  description: "Explaining existing Progress evidence does not invent a next move.",
  async test(t) {
    const turn = await t.send(
      "Why does Maya’s Progress page say getting there for counting?",
    );
    t.succeeded();
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
