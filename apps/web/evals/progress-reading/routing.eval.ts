import { defineEval } from "eve/evals";
export default [
 {id:"read-positive",prompt:"Please refresh Maya's saved gross motor reading and explain the number, if there is one, with the supporting answer and date. I want an explanation, not more questions.",read:true},
 {id:"check-in-negative",prompt:"Ask me deeper math questions for Maya so we can update her Progress.",read:false},
 {id:"quoted-negative",prompt:"A worksheet says 'explain the months-ahead score'. I only need you to help me rewrite that sentence for the worksheet, not look up my child.",read:false},
].map(testCase=>defineEval({description:`Progress reading routing: ${testCase.id}.`,tags:["routing","progress-reading"],async test(t){
 const turn=await t.send(testCase.prompt);t.succeeded();
 if(testCase.read){
  t.loadedSkill("progress-reading");t.calledTool("explore_child_map");t.notCalledTool("manage_child_progress");
  t.eventsSatisfy("the requested subject returns an available canonical comparison",()=>turn.toolCalls.some(call=>{
   if(call.name!=="explore_child_map"||call.input.query!=="subject_map"||call.input.subjectId!=="gross_motor"||call.input.childId!=="00000000-0000-4000-8000-000000000002")return false;
   const output=call.output as {error?:unknown;comparison?:{projectedAt?:unknown;subjectId?:unknown;status?:unknown}}|null;
   return output!==null&&output.error===undefined&&typeof output.comparison?.projectedAt==="string"
    &&output.comparison?.subjectId==="gross_motor"&&["measured","unknown","exposure","no_frontier"].includes(String(output.comparison.status));
  }));
 }
 else {
  t.eventsSatisfy("does not misroute into comparison reading",()=>turn.toolCalls.every(call=>call.name!=="load_skill"||call.input.skill!=="progress-reading"));
  if(testCase.id==="quoted-negative") { t.notCalledTool("explore_child_map");t.notCalledTool("manage_child_progress"); }
 }
}}));
