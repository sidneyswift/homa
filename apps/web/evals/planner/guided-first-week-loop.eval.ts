import { defineEval } from "eve/evals";

/**
 * The activation handoff is useful only when it closes one small loop: a
 * parent changes the real week, tries it, and Homa records what happened.
 * This uses the sandbox Walker family's current scheduled plan, so neither
 * the edit nor the learning receipt can pass on a prompt-only fixture.
 *
 * Run with: pnpm eval:sandbox planner/guided-first-week-loop
 */
export default defineEval({
  description:
    "A parent can change one real part of the current week, then save what happened with that week.",
  async test(t) {
    const adjustment = await t.send(
      "Finn's counting plan for this week needs to be shorter. Replace the ten-minute counting activity with five minutes of counting real coins, then tell me exactly what changed.",
    );
    adjustment.succeeded();
    adjustment.loadedSkill("planner");
    adjustment.calledTool("open_planner");
    adjustment.calledTool("edit_plan");

    const learning = await t.send(
      "We tried the coin counting with Finn today and counted 12 coins together. Please save that with the week.",
    );
    learning.succeeded();
    learning.eventsSatisfy(
      "the learning outcome is saved against the week, without duplicating it",
      () =>
        learning.toolCalls.some((call) =>
          ["record_planner_activity", "complete_planner_activity"].includes(call.name),
        ),
    );
  },
});
