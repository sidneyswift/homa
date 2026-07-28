import { defineEval } from "eve/evals";

/**
 * The ask the whole calendar exists for, in a co-founder's own words:
 * an appointment lands, and school work moves around it. This is now a
 * BEHAVIOR eval, not routing alone (issue #257, arc PR B0): the Walker
 * fixture seeds real dated work and real family events, so the skill's
 * "read before you move anything" law is finally executable and can be
 * asserted instead of assumed.
 *
 * Why the prompt got specific, and why that is not a weakened gate.
 *
 * The old prompt asked about a vague "Tuesday afternoon" with no child
 * named, against a fixture the docstring described as having no
 * scheduled plan rows. Homa answered it the way the skill's own stop
 * conditions tell her to: by asking which child and what time. Whether
 * that ask left an unanswered input request decided the verdict, so
 * `succeeded()` was grading the shape of an honest question rather than
 * the behavior the eval is named for.
 *
 * Measured 2026-07-27, four sandbox runs on this branch: all four
 * passed, and the work behind the pass ranged from a full read plus a
 * real schedule_plan_activity move down to one run that called nothing
 * but load_skill and asked a question. A gate that passes when nothing
 * happened is not measuring the behavior it names. The parked variant
 * also predates this arc rather than arriving with the fixture rows:
 * main's own CI hit the identical "run parked on 1 unanswered input
 * request(s)" failure on this eval (run 30316330053) and passed it on
 * the next run (30317912660).
 *
 * So the fix is to remove the ambiguity rather than the assertion, and
 * the ambiguity took two rounds of measurement to remove. What parks a
 * run is eve's built-in `ask_question` tool, observed firing as the
 * turn's FIRST move with no skill load and no reads at all, which is
 * why a parked run fails every gate rather than only `succeeded()`.
 * Two earlier drafts each left something real to ask about:
 *
 *   "tomorrow afternoon"   the fixture already seeds a dentist
 *                          appointment two days out, so Homa asked,
 *                          correctly, whether this was that appointment
 *                          or a second one
 *   no day at all          nothing said when, so Homa asked when
 *
 * This prompt names the child, points at the one dentist appointment
 * the fixture seeds and says it is already on the calendar (so the day
 * is knowable, by reading), says the afternoon is gone (the skill's own
 * trigger for treating a day as blocked), and asks for the school work
 * on that day to be checked and moved. The seeded appointment and one
 * of Finn's dated activities share a day, so the collision is real.
 * Deliberately no weekday: the fixture is relative to current_date, so
 * any weekday written here would be wrong on most days of the week.
 *
 * What is deliberately NOT asserted: the move itself. Whether that
 * day's counting work actually collides with a gone afternoon is a
 * judgment call the skill leaves open (a morning activity survives an
 * afternoon appointment, and plan activities carry no time of day until
 * arc E's scheduled_time), so "nothing needs to move" is a legitimate
 * answer here. Gating schedule_plan_activity would be gating a coin
 * flip again, in the other direction.
 *
 * Needs the sandbox for its seeded plan, schedule rows, and events:
 * `pnpm eval:sandbox planner/reshuffle-routing`.
 */
export default defineEval({
  description:
    "Pushing school work around an appointment loads the planner skill and reads the real calendar and plan first.",
  async test(t) {
    await t.send(
      "Finn's dentist appointment that's already on our calendar is across town, so that whole afternoon is gone. Can you check what school work he has that day and move whatever needs moving?",
    );
    t.succeeded();
    t.loadedSkill("planner");
    // Read before you move anything: the two reads the skill mandates.
    // list_family_events is the calendar side, and B0's from/to window
    // with look-back is what makes reading the whole week possible at
    // all; open_planner is the plan side, and B0's schedule read is
    // what finally puts real scheduledDate values in its payload.
    t.calledTool("list_family_events");
    t.calledTool("open_planner");
  },
});
