import { defineEval } from "eve/evals";

/**
 * Natural parent language, not the internal feature name. A request for the
 * packet she keeps and prints belongs to state-records even when she calls it
 * an attendance packet.
 */
export default defineEval({
  description:
    "A parent asking for a printable state attendance packet loads state-records.",
  async test(t) {
    await t.send(
      "Can you make a fresh attendance packet for my state that I can review and print?",
    );
    t.succeeded();
    t.loadedSkill("state-records");
    t.calledTool("open_state_records");
  },
});
