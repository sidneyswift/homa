import { defineEval } from "eve/evals";

export default defineEval({
  description: "A printable request stays with materials-studio.",
  async test(t) {
    const turn = await t.send(
      "Make Maya a one-page US Letter printable with 10 count-the-object problems using groups of one to five plain circles. No theme and no answer key. I will print it for tomorrow morning.",
    );
    t.succeeded();
    t.loadedSkill("materials-studio");
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
