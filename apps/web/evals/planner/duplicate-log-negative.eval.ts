import { defineEval } from "eve/evals";

/**
 * Adversarial-negative pair to duplicate-log-guard.eval.ts: the gh#1015
 * guard must never turn into a second-activity blocker. Finn's Walker
 * fixture math is already scheduled for today (week 2,
 * EVAL_FIXTURE_SCHEDULED_TODAY_ACTIVITY_INDEX), but a genuinely separate
 * piece of math work, named specifically and distinctly from that seeded
 * activity, is real additional history and must still land as its own
 * Planner row. If this eval starts failing whenever the guard's matching
 * gets stricter, that is the guard over-firing, not this eval being
 * wrong.
 *
 * Needs the sandbox for its seeded plan and schedule rows:
 * `pnpm eval:sandbox planner/duplicate-log-negative`.
 */
export default defineEval({
  description:
    "A second, clearly distinct math activity for Finn on the same day as his scheduled counting work still gets logged, not blocked as a duplicate.",
  async test(t) {
    const turn = await t.send(
      "Separate from his usual counting practice, Finn also finished a whole page of multiplication flashcard drills today for math. Please log that too.",
    );
    t.succeeded();
    t.loadedSkill("planner");

    const recordCalls = turn.toolCalls.filter(
      (call) => call.name === "record_planner_activity",
    );
    const loggedTheFlashcards = recordCalls.some(
      (call) => (call.output as { recorded?: unknown } | null)?.recorded === true,
    );
    t.eventsSatisfy(
      "the genuinely separate flashcard-drill activity was still logged",
      () => loggedTheFlashcards,
    );
  },
});
