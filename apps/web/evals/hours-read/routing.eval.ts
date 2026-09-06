import { defineEval } from "eve/evals";

import { HOURS_ROUTING_CASES } from "./routing-fixtures";

/** Full Eve routing fixtures. Run through the ordinary isolated eval config;
 * use eval:sandbox if exercising downstream real database tools. */
export default HOURS_ROUTING_CASES.map((testCase) => defineEval({
  description: `Hours skill routing: ${testCase.id}.`,
  tags: ["hours-read", "routing"],
  async test(t) {
    const turn = await t.send(testCase.prompt);
    t.succeeded();
    if (testCase.skill === "hours-records") t.loadedSkill("hours-records");
    else t.notCalledTool("find_hours");
    t.eventsSatisfy("Hours and paperwork scopes stay distinct", () => turn.toolCalls.every((call) =>
      call.name !== "load_skill" || (testCase.skill === "hours-records"
        ? call.input.skill !== "state-records"
        : call.input.skill !== "hours-records"),
    ));
    if (testCase.skill === "hours-records") {
      t.calledTool("find_hours");
      t.notCalledTool("open_state_records");
    }
  },
}));
