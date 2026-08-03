import { defineEval } from "eve/evals";

/**
 * De-identified replay of the trial parent's exact correction. The default
 * four-week plan and a dated calendar month are different objects: this must
 * request August 1, show a preview, and leave the stored plan untouched until
 * the parent approves it.
 *
 * Run with: pnpm eval:sandbox planner/august-not-july-preview
 */
export default defineEval({
  description:
    "A named calendar-month correction produces an August preview and never saves before approval.",
  async test(t) {
    const turn = await t.send(
      "I actually want one for August 2026, not July. Make it for all three kids, show me the preview, and do not save it yet.",
    );
    turn.expectOk();
    turn.loadedSkill("planner");
    turn.calledTool("open_planner");
    turn.calledTool("list_family_events");
    turn.calledTool("find_materials");
    turn.calledTool("preview_month_plan");
    turn.notCalledTool("approve_month_plan");

    t.eventsSatisfy("the preview starts on August 1", () =>
      turn.toolCalls
        .filter((call) => call.name === "preview_month_plan")
        .every((call) => {
          const plan = call.input.plan as { monthStart?: unknown } | undefined;
          return plan?.monthStart === "2026-08-01";
        }),
    );
  },
});
