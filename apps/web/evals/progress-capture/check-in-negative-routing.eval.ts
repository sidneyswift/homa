import { defineEval } from "eve/evals";

export default defineEval({
  description: "A request to discover abilities by check-in uses the existing check-in workflow, not journal capture.",
  async test(t) {
    const turn = await t.send("Ask me some questions to see where Maya is with fine motor skills.");
    t.log(JSON.stringify({phase: "settled-turn-before-assertions", response: t.reply, tools: turn.toolCalls}));
    t.succeeded();
    t.loadedSkill("progress-check-in");
    t.eventsSatisfy("does not save the assessment request as a capability report", () => turn.toolCalls.every(call =>
      !(call.name === "load_skill" && call.input.skill === "progress-capture") &&
      !(call.name === "manage_child_progress" && call.input.action === "record_journal_evidence")));
  },
});
