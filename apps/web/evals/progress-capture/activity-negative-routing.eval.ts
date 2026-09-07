import { defineEval } from "eve/evals";

export default defineEval({
  description: "A lesson number and elapsed time remain an activity report, not mastery evidence or compulsory probing.",
  async test(t) {
    const turn = await t.send("Maya spent 20 minutes on lesson 12 today. We moved on to the next page. Just log that; no questions, please.");
    t.log(JSON.stringify({phase: "settled-turn-before-assertions", response: t.reply, tools: turn.toolCalls}));
    t.succeeded();
    t.eventsSatisfy("does not load ability capture or record a capability", () => turn.toolCalls.every(call =>
      !(call.name === "load_skill" && call.input.skill === "progress-capture") &&
      !(call.name === "manage_child_progress" && ["record_journal_evidence", "start_check_in", "resume_check_in", "respond_check_in", "takeover_check_in"].includes(String(call.input.action)))));
  },
});
