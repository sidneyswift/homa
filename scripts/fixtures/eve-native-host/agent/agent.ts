import { defineAgent } from "eve";
import { mockModel } from "eve/evals";
export default defineAgent({
  modelContextWindowTokens: 32000,
  model: mockModel(({ toolResults }) => {
    const answers = toolResults.filter(result => result.name === "ask_question");
    if (answers.length >= 2) return { text: "Finished both questions: " + JSON.stringify(answers.map(answer => answer.output)) };
    const number = answers.length + 1;
    return { toolCalls: [{ id: `question-${number}`, name: "ask_question", input: {
      prompt: `Question ${number}`, options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }], allowFreeform: false
    } }] };
  })
});
