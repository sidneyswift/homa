import { defineEval } from "eve/evals";

export default defineEval({
  description: "Full-fleet routing selects capture and requests its evidence operation; saved effects are certified by saved-behavior.",
  async test(t) {
    const turn = await t.send("Maya can cut along a straight line with her child scissors on her own now. Please update her record.");
    t.log(JSON.stringify({phase: "settled-turn-before-assertions", response: t.reply, tools: turn.toolCalls}));
    // The canonical full-fleet eval stamp intentionally has no web provenance.
    // This case certifies selection only; saved-behavior requires a real receipt.
    t.succeeded();
    t.loadedSkill("progress-capture");
    t.eventsSatisfy("requests capture without starting a check-in or manufacturing an activity", () =>
      turn.toolCalls.some(call => call.name === "manage_child_progress" && call.input.action === "record_journal_evidence") &&
      turn.toolCalls.every(call => call.name !== "record_planner_activity" && !(call.name === "manage_child_progress" && ["start_check_in", "resume_check_in", "respond_check_in", "takeover_check_in"].includes(String(call.input.action)))));
  },
});
