import { defineEval } from "eve/evals";

import { sendEvalMessage } from "../../lib/eval-send-message";
import { EVAL_FIXTURE_MATERIAL_DRAFT_ID } from "../../lib/family-context-eval-fixture";
import { activeMaterialContext } from "../../lib/voice/active-material";

export default defineEval({
  description: "A plain positive reaction keeps the verified draft currently visible.",
  async test(t) {
    const reaction = await sendEvalMessage(t, {
      message: "I love it.",
      clientContext: activeMaterialContext({
        id: EVAL_FIXTURE_MATERIAL_DRAFT_ID,
        title: "Maya's Fresh Letter Sounds Page",
        status: "draft",
        revisesId: null,
        pageCount: 1,
        pageRoles: ["child"],
      }),
    });
    if (!reaction.toolCalls.some((call) => call.name === "mark_material_final")) {
      throw new Error(
        `the plain positive reaction did not finalize the visible draft; tools=${JSON.stringify(reaction.toolCalls.map((call) => call.name))}; reply=${JSON.stringify(reaction.message)}`,
      );
    }
    if (reaction.toolCalls.some((call) => call.name === "create_printable")) {
      throw new Error("the plain positive reaction needlessly revised the visible draft");
    }
  },
});
