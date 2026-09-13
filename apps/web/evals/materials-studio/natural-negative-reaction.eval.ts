import { defineEval } from "eve/evals";

import { sendEvalMessage } from "../../lib/eval-send-message";
import { EVAL_FIXTURE_MATERIAL_NEGATIVE_ID } from "../../lib/family-context-eval-fixture";
import { activeMaterialContext } from "../../lib/voice/active-material";

export default defineEval({
  description: "A concrete negative reaction revises the visible material without approving it first.",
  timeoutMs: 300_000,
  async test(t) {
    const reaction = await sendEvalMessage(t, {
      message: "This is too crowded. Give the directions more breathing room.",
      clientContext: activeMaterialContext({
        id: EVAL_FIXTURE_MATERIAL_NEGATIVE_ID,
        title: "Maya's Crowded Letter Page",
        status: "final",
        revisesId: null,
        pageCount: 1,
        pageRoles: ["child"],
      }),
    });
    t.loadedSkill("materials-studio");
    t.calledTool("create_printable");
    if (reaction.toolCalls.some((call) => call.name === "mark_material_final")) {
      throw new Error("the rejected revision was finalized before Homa changed it");
    }
  },
});
