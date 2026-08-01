import { defineEval } from "eve/evals";

/**
 * Positive routing and workflow guard for gh#539. The model owns the month
 * planning judgment, but must ground it in the real Planner, commitments,
 * progress context, and reusable materials before it can show a preview.
 *
 * Run with: pnpm eval:sandbox planner/month-plan-preview
 */
export default defineEval({
  description:
    "A new family month request loads planner, reads family reality, and produces a non-persisted preview.",
  async test(t) {
    await t.send(
      "Build our September plan around co-op Thursdays and keep Fridays light. Draft it for both kids, show it to me, and do not save anything yet.",
    );
    t.succeeded();
    t.loadedSkill("planner");
    t.calledTool("open_planner");
    t.calledTool("list_family_events");
    t.calledTool("find_materials");
    t.calledTool("preview_month_plan");
    t.notCalledTool("approve_month_plan");
  },
});
