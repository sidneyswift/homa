import { defineEval } from "eve/evals";

import { sendEvalMessage } from "../../lib/eval-send-message";
import { EVAL_FIXTURE_MATERIAL_MIXED_ID } from "../../lib/family-context-eval-fixture";
import { activeMaterialContext } from "../../lib/voice/active-material";

export default defineEval({
  description: "A positive clause followed by a change request revises rather than finalizes.",
  timeoutMs: 300_000,
  async test(t) {
    const reaction = await sendEvalMessage(t, {
      message: "I like it, but shorten the directions.",
      clientContext: activeMaterialContext({
        id: EVAL_FIXTURE_MATERIAL_MIXED_ID,
        title: "Maya's Directions Letter Page",
        status: "final",
        revisesId: null,
        pageCount: 1,
        pageRoles: ["child"],
      }),
    });
    t.loadedSkill("materials-studio");
    t.calledTool("create_printable");
    if (reaction.toolCalls.some((call) => call.name === "mark_material_final")) {
      throw new Error("mixed feedback finalized the old revision before changing it");
    }
  },
});
