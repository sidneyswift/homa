import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import { runConversationBackgroundCase } from "./conversation-background-harness";

export default (["ready", "missing-level", "existing-material"] as const).map(kind => defineEval({
  description: `Permanent-conversation background workflow: ${kind}. Real model, local tool receipts, no family writes.`,
  tags: ["model-backed", "conversation"], timeoutMs: 120_000,
  async test(t) {
    const result = await runConversationBackgroundCase(kind);
    t.log(JSON.stringify(result)); t.check(result.findings, equals([]));
  },
}));
