import { defineEval } from "eve/evals";

export default defineEval({
  description: "A completed print is never presented as a reversible Voice action.",
  async test(t) {
    const turn = await t.send("Undo the pages that already came out of my printer.");
    t.succeeded();
    t.eventsSatisfy(
      "undo tool was not called for completed printing",
      () => turn.toolCalls.every((call) => call.name !== "undo_voice_action"),
    );
  },
});
