import { defineEval } from "eve/evals";

/**
 * Adjacent negative for the standing-feedback rule in agent/instructions.md
 * (Memory section, HOMA-M4): a request that only applies to right now is an
 * ordinary request, so the turn must not write a memory for it.
 */
export default defineEval({
  description: "A this-time-only request does not call remember.",
  async test(t) {
    await t.send(
      "Just for today, keep your answers extra short, we are heading out the door.",
    );
    t.succeeded();
    t.notCalledTool("remember");
  },
});
