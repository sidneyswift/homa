import { defineEval } from "eve/evals";
export default defineEval({description:"A child-only correction reads the existing record instead of adding another umbrella entry.",async test(t){
  await t.send("Maya's co-op record for September 21, 2026 says one minute. It should be 45 minutes of science. Correct only Maya's record, leave Story's time and our home learning alone. Find the existing record first; if it isn't there, don't add anything.");
  t.succeeded();t.loadedSkill("hours-records");t.calledTool("find_hours");t.notCalledTool("log_hours");t.notCalledTool("record_planner_activity");
}});
