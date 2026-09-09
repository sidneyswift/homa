import { defineEval } from "eve/evals";

export default defineEval({
  description: "Quoting a complete lesson advertisement does not request a packet.",
  async test(t) {
    const turn = await t.send('A catalog says "complete lesson with teaching, practice, test, and answer key." What does an answer key mean? Please just explain that term; do not make anything.');
    t.succeeded();
    t.notCalledTool("create_printable");
    t.eventsSatisfy("quoted packet language does not load lesson-studio", () => turn.toolCalls.every(
      (call) => call.name !== "load_skill" || call.input.skill !== "lesson-studio",
    ));
  },
});
