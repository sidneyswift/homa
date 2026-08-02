import { defineEval } from "eve/evals";

/** A calendar-shaped request is not automatically a homeschool month. */
export default defineEval({
  description:
    "A household meal calendar does not invoke the homeschool month-plan writer.",
  async test(t) {
    await t.send(
      "Make me a September dinner calendar with tacos on Tuesdays and leftovers on Fridays.",
    );
    t.succeeded();
    t.notCalledTool("preview_month_plan");
    t.notCalledTool("approve_month_plan");
  },
});
