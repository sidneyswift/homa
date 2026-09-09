import { defineEval } from "eve/evals";

export default defineEval({
  description: "A requested complete lesson uses its recipe and separates the answer key from child pages.",
  timeoutMs: 600_000,
  async test(t) {
    const turn = await t.send("Make Maya one complete printable lesson on adding two numbers with totals up to 10. She already counts objects to 10 and adds with counters, and has practiced addition before. Include teaching with worked examples, different practice and quick-check questions, and a separate answer key. Four pages, no parent guide. Use simple HTML, no generated pictures. Do not finalize or print it yet.");
    t.loadedSkill("lesson-studio");
    t.calledTool("create_printable");
    t.eventsSatisfy("packet proposal carries the recipe and exact page roles", () => {
      const calls = turn.toolCalls.filter((call) => call.name === "create_printable" && !call.input.revisesId);
      return calls.length > 0 && calls.every((call) => call.input.recipe === "full-lesson-packet"
        && Array.isArray(call.input.pages) && call.input.pages.length === 4
        && JSON.stringify(call.input.pageRoles) === JSON.stringify(["child", "child", "child", "answer_key"]));
    });
    t.notCalledTool("mark_material_final");
  },
});
