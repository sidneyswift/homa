import { defineEval } from "eve/evals";

/**
 * Payload-shape guard for open_planner's schedule read (issue #257,
 * arc PR B0): the tool's whole point after B0 is that every plan week
 * it returns in full carries per-activity scheduledDate, read from
 * plan_activity_schedule. Before B0 no tool read that table at all, so
 * Homa wrote dates she could never read back and the skill's reshuffle
 * procedure was unexecutable as written.
 *
 * Asserts on the tool's OUTPUT, not on wording: whichever way the model
 * calls it (childId-narrowed full four weeks, or the family-wide
 * current-week-plus-summaries shape), every activity in a full week
 * must carry the scheduledDate key, and the seeded Walker rows (Finn's
 * math week 2, lib/family-context-eval-fixture.ts's planner seed, kept
 * inside the CURRENT week on purpose) must surface as real dates.
 *
 * Needs the sandbox for its seeded plan and schedule rows:
 * `pnpm eval:sandbox planner/week-view-payload`.
 */

interface PayloadActivity {
  scheduledDate?: unknown;
}

interface PayloadWeek {
  activities?: PayloadActivity[];
}

interface PayloadPlan {
  weeks?: PayloadWeek[];
}

interface PayloadChild {
  plans?: PayloadPlan[];
}

export default defineEval({
  description:
    "open_planner returns plan weeks whose activities carry real scheduledDate fields.",
  async test(t) {
    const turn = await t.send("What's on Finn's week?");
    t.succeeded();

    const opens = turn.toolCalls
      .filter((call) => call.name === "open_planner")
      .map((call) => call.output as { opened?: unknown; children?: PayloadChild[] } | null)
      .filter((output) => output?.opened === true);

    t.eventsSatisfy("open_planner ran and returned the board", () => opens.length > 0);

    const activities = opens.flatMap((output) =>
      (output?.children ?? []).flatMap((child) =>
        (child.plans ?? []).flatMap((plan) =>
          (plan.weeks ?? []).flatMap((week) => week.activities ?? []),
        ),
      ),
    );

    t.eventsSatisfy(
      "every returned activity carries the scheduledDate key",
      () =>
        activities.length > 0 &&
        activities.every((activity) => "scheduledDate" in activity),
    );

    t.eventsSatisfy(
      "the seeded schedule rows surface as real dates",
      () =>
        activities.some(
          (activity) =>
            typeof activity.scheduledDate === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(activity.scheduledDate),
        ),
    );
  },
});
