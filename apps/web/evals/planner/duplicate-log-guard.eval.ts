import { defineEval } from "eve/evals";

/**
 * gh#1015: Carolyng (co-founder), verbatim: "math was put in twice, once
 * through chat and once as my schedule." The Walker fixture now seeds a
 * real week-2 math activity scheduled for TODAY
 * (EVAL_FIXTURE_SCHEDULED_TODAY_ACTIVITY_INDEX, lib/family-context-eval-fixture.ts),
 * so this is a behavior eval, not routing alone: a bare mention of Finn's
 * math today is his OWN already-scheduled counting activity, and Homa
 * must not leave a second, independent Planner row sitting next to it.
 *
 * The prompt paraphrases the seeded activity text ("One real counting
 * moment at the store or kitchen, week 2.") closely enough that any
 * competent read of open_planner's returned week makes the match obvious;
 * this eval is not trying to test hard cross-phrasing judgment, only that
 * record_planner_activity's new duplicate guard (gh#1015) actually gets
 * exercised and obeyed rather than routed around.
 *
 * Needs the sandbox for its seeded plan and schedule rows:
 * `pnpm eval:sandbox planner/duplicate-log-guard`.
 */
export default defineEval({
  description:
    "A parent recap that matches Finn's already-scheduled math activity for today completes the existing item instead of logging a duplicate row.",
  async test(t) {
    const turn = await t.send(
      "We had a real counting moment with Finn at the grocery store today, that was his math for today. Please log it.",
    );
    t.succeeded();
    t.loadedSkill("planner");

    const recordCalls = turn.toolCalls.filter(
      (call) => call.name === "record_planner_activity",
    );
    const leftADuplicateRow = recordCalls.some(
      (call) => (call.output as { recorded?: unknown } | null)?.recorded === true,
    );
    t.eventsSatisfy(
      "no independent Planner row was created for math already scheduled today",
      () => !leftADuplicateRow,
    );

    // The honest complement to "no duplicate": the already-scheduled item
    // actually got marked done, so the parent's recap was not silently
    // dropped by the guard either.
    t.calledTool("complete_planner_activity");
  },
});
