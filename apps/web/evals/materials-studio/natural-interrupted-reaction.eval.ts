import { defineEval } from "eve/evals";

import { sendEvalMessage } from "../../lib/eval-send-message";
import { EVAL_FIXTURE_MATERIAL_INTERRUPTED_ID } from "../../lib/family-context-eval-fixture";
import { activeMaterialContext } from "../../lib/voice/active-material";

export default defineEval({
  description: "A parent who interrupts her approval with a correction gets a revision, not approval.",
  timeoutMs: 300_000,
  async test(t) {
    const reaction = await sendEvalMessage(t, {
      message: "I love it. Wait, no, make the directions shorter.",
      clientContext: activeMaterialContext({
        id: EVAL_FIXTURE_MATERIAL_INTERRUPTED_ID,
        title: "Maya's Practice Letter Page",
        status: "final",
        revisesId: null,
        pageCount: 1,
        pageRoles: ["child"],
      }),
    });
    t.loadedSkill("materials-studio");
    t.calledTool("create_printable");
    if (reaction.toolCalls.some((call) => call.name === "mark_material_final")) {
      throw new Error("an interrupted approval finalized the old revision");
    }
  },
});
