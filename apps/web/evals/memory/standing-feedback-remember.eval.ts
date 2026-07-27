import { defineEval } from "eve/evals";

/**
 * HOMA-M4: a parent's going-forward process correction is durable. The
 * standing-feedback rule in agent/instructions.md (Memory section) requires
 * the same turn to persist it with remember, not just apologize. Cause: a
 * production exchange (2026-07-19) where the promise to double check lived
 * only in one session's conversation history and every later session was
 * ignorant of it.
 */
export default defineEval({
  description: "A going-forward process correction calls remember in the same turn.",
  async test(t) {
    await t.send(
      "This looks awful. The images are not even coming up. Going forward before you send me anything it needs to be double checked.",
    );
    t.succeeded();
    t.calledTool("remember");
  },
});
