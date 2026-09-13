import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { sendEvalMessage } from "../../lib/eval-send-message";
import { EVAL_FIXTURE_MATERIAL_CROSS_OBJECT_ID } from "../../lib/family-context-eval-fixture";
import { activeMaterialContext } from "../../lib/voice/active-material";

export default defineEval({
  description: "An ambiguous reaction naming another object asks one short question and changes nothing.",
  async test(t) {
    await t.send("Show me Maya's Letter Sounds Workbook from the Binder.");
    t.calledTool("show_material");

    const reaction = await sendEvalMessage(t, {
      message: "I love Finn's one. Print it.",
      clientContext: activeMaterialContext({
        id: EVAL_FIXTURE_MATERIAL_CROSS_OBJECT_ID,
        title: "Maya's Cross-object Letter Page",
        status: "final",
        revisesId: null,
        pageCount: 1,
        pageRoles: ["child"],
      }),
    });
    const effectCalls = reaction.toolCalls.filter((call) =>
      ["mark_material_final", "create_printable", "prepare_material_print"].includes(call.name),
    );
    t.check(
      effectCalls.length,
      satisfies((count) => count === 0, "cross-object language caused no material effect"),
    );
    const message = reaction.message ?? "";
    const words = message.trim().split(/\s+/u);
    if (!message.includes("?") || words.length > 25) {
      throw new Error(
        `Homa did not ask one short clarifying question (${words.length} words): ${JSON.stringify(message)}`,
      );
    }
  },
});
