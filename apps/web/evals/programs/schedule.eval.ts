import { defineEval } from "eve/evals";
export default defineEval({
  description:"A reviewed co-op timetable saves distinct subjects and children without inventing attendance.",
  async test(t) {
    const turn=await t.send("I reviewed this weekly schedule and want you to save it as a reusable program named Monday nature co-op. Every Monday Maya attends Nature lab (science), 09:00 to 09:45. Story attends Literature circle (language arts), 09:00 to 09:30. These are future classes, nobody has attended yet. Save the weekly schedule only, without adding dates or recording any hours.");
    t.succeeded();t.loadedSkill("planner");t.calledTool("save_learning_program");
    t.notCalledTool("log_hours");t.notCalledTool("complete_planner_activity");t.notCalledTool("schedule_learning_program");
    t.eventsSatisfy("saved program preserves the two subjects and different children",()=>turn.toolCalls.some(call=>{
      if(call.name!=="save_learning_program"||(call.output as {status?:string})?.status!=="saved")return false;
      const rows=(call.input as {classes?:Array<{subject:string;childIds:string[];startTime:string;endTime:string}>}).classes??[];
      return rows.length===2 && rows.some(r=>r.subject==="science"&&r.childIds.length===1&&r.childIds[0]==="00000000-0000-4000-8000-000000000002"&&r.startTime==="09:00"&&r.endTime==="09:45")
        && rows.some(r=>r.subject==="reading"&&r.childIds.length===1&&r.childIds[0]==="00000000-0000-4000-8000-000000000003"&&r.endTime==="09:30");
    }));
  },
});
