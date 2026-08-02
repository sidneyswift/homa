import { defineEval } from "eve/evals";

export default defineEval({
  description: "Starting a Progress check-in does not route to instructional advice.",
  async test(t) {
    const turn = await t.send("Start a Progress check-in for Maya.");
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
