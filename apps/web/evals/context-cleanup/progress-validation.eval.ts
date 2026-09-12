import { defineEval } from "eve/evals";
import { parseManageChildProgressCommand } from "../../lib/child-progress/tool-contract";

export default defineEval({
  description: "The compiled progress tool accepts the selected action without provider-filled unrelated fields.",
  async test(t) {
    const turn = await t.send("Maya can cut along a straight line with child scissors on her own now. Please update her record.");
    t.succeeded();
    t.loadedSkill("progress-capture");
    t.eventsSatisfy("provider arguments satisfy strict action validation", () => {
      const calls = turn.toolCalls.filter((call) => call.name === "manage_child_progress");
      return calls.length > 0 && calls.every((call) => {
        try { return parseManageChildProgressCommand(call.input).action === "record_journal_evidence"; }
        catch { return false; }
      });
    });
    // This full-fleet fixture has no trusted web provenance and can be refused by the channel gate. The separate
    // saved-behavior eval certifies writes; this case certifies the boundary.
  },
});
