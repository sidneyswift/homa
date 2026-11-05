import { defineEval } from "eve/evals";

export default defineEval({
  description: "Available time in a Binder reopening request does not trigger a new activity plan.",
  async test(t) {
    const turn = await t.send("I have 20 minutes to look through Maya's Letter Sounds Workbook. Just reopen the saved workbook from the Binder; don't make anything new.");
    t.succeeded();
    t.eventsSatisfy("reopens saved material instead of generating a plan", () => turn.toolCalls.some(call => call.name === "show_material") && turn.toolCalls.every(call => call.name !== "create_printable"));
  },
});
