import { defineEval } from "eve/evals";

export default defineEval({
  description: "The compiled progress tool accepts the selected action without provider-filled unrelated fields.",
  async test(t) {
    const turn = await t.send("Maya can cut along a straight line with child scissors on her own now. Please update her record.");
    t.succeeded();
    t.loadedSkill("progress-capture");
    t.eventsSatisfy("capture crosses strict action validation without a tool error", () => {
      const calls = turn.toolCalls.filter((call) => call.name === "manage_child_progress");
      return calls.length > 0 && calls.every((call) =>
        call.input.action === "record_journal_evidence" && call.status === "completed");
    });
    // This full-fleet fixture has no trusted web provenance. The separate
    // saved-behavior eval certifies writes; this case certifies the boundary.
  },
});
