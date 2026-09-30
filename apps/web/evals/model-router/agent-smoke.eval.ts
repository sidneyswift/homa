import { defineEval } from "eve/evals";

export default defineEval({
  description: "The real Homa agent answers a simple routed request without unnecessary tools.",
  timeoutMs: 120_000,
  async test(t) {
    const turn = await t.send("What is a number bond? Give one simple example. No worksheet or saved information needed.");
    t.eventsSatisfy("simple question needs no external action", () => turn.toolCalls.length === 0);
  },
});
