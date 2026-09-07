import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import { chatNextMoveEvalBlocker, chatNextMoveFindings, runChatNextMoveEval } from "./chat-harness";

export default defineEval({
  description: "#1100: actual base instructions and fleet skill, real canonical read and verifier, synthetic in-memory effects only.",
  tags: ["model-backed", "progress-next-move", "progress-next-move-chat"], timeoutMs: 900_000,
  async test(t) {
    const blocker = chatNextMoveEvalBlocker();
    if (blocker) { t.skip(blocker); return; }
    for (const scenario of ["all_easy", "conflict", "conflict_with_easy", "ambiguous_child", "post_save_offer", "read_unavailable", "incomplete_easy", "decline"] as const) {
      const result = await runChatNextMoveEval(scenario, event => t.log(JSON.stringify(event)));
      const findings = chatNextMoveFindings(result);
      t.log(JSON.stringify(result));
      t.check(findings, equals([]));
    }
  },
});
