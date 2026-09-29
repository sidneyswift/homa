import { defineEval } from "eve/evals";
export default defineEval({description:"An uncertain co-op idea is neither an approved schedule nor evidence of attendance.",async test(t){
  await t.send("I'm thinking about a Monday co-op with science and literature but don't know which child will attend or the class times. Can you help me figure out what to ask the organizer? Please don't put anything in our planner yet.");
  t.succeeded();t.notCalledTool("save_learning_program");t.notCalledTool("schedule_learning_program");t.notCalledTool("record_planner_activity");t.notCalledTool("log_hours");t.notCalledTool("correct_hours_entry");
}});
