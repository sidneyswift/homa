import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalProgressUnavailable, readCanonicalChildMap } from "./canonical-explore";
import { comparisonFixture, COMPARISON_CHILD, COMPARISON_FAMILY } from "../child-progress/comparison-fixture";
import { buildProgressComparison } from "../child-progress/comparison";
import { NEXT_MOVE_CHILD, NEXT_MOVE_FAMILY, nextMoveChatScenario, nextMoveState } from "../../evals/progress-next-move/chat-fixture";

test("saved evidence projection retains exact incomplete counts and excludes unassessed curriculum",async()=>{
 const state=nextMoveState(nextMoveChatScenario("incomplete_easy").ledger);
 const result=await readCanonicalChildMap({familyId:NEXT_MOVE_FAMILY,childId:NEXT_MOVE_CHILD,query:{query:"saved_answers",subjectId:"math"}},{getView:async()=>state.view});
 assert.ok("coverage" in result && result.coverage);
 assert.equal(result.coverage,"partial");assert.deepEqual(result.answerCounts,{easily:24,getting_there:0,not_yet:1});
 assert.equal(result.savedAnswers.total,25);assert.equal(result.savedAnswers.omitted,1);
 assert.equal(result.savedAnswers.answers.length,24);assert.ok(result.savedAnswers.answers.every(answer=>answer.answer==="easily"));
 assert.equal(result.childId,NEXT_MOVE_CHILD);assert.equal(result.subjectId,"math");
 assert.equal("ladder" in result,false);assert.equal("domains" in result,false);assert.equal("comparison" in result,false);
});
test("saved evidence keeps selected-subject conflicting dates and derivation without quoting private text",async()=>{
 const state=nextMoveState(nextMoveChatScenario("conflict_with_easy").ledger);
 const result=await readCanonicalChildMap({familyId:NEXT_MOVE_FAMILY,childId:NEXT_MOVE_CHILD,query:{query:"saved_answers",subjectId:"fine_motor"}},{getView:async()=>state.view});
 assert.ok("coverage" in result && result.coverage);
 assert.equal(result.conflicts.total,1);assert.equal(result.conflicts.items.length,1);assert.equal(result.conflicts.omitted,0);
 assert.equal(result.conflicts.items[0]!.itemId,"fine_motor.cuts-curves");
 assert.deepEqual(result.conflicts.items[0]!.answers.map(answer=>({answer:answer.answer,derivation:answer.derivation,observedAt:answer.observedAt})),[
  {answer:"easily",derivation:"direct",observedAt:"2026-09-04T16:00:00.000Z"},
  {answer:"not_yet",derivation:"direct",observedAt:"2026-09-04T16:00:00.000Z"},
 ]);
 assert.equal(result.savedAnswers.total,1);assert.deepEqual(result.answerCounts,{easily:1,getting_there:0,not_yet:0});
 assert.ok(!JSON.stringify(result).includes('"quote"'));
 const other=await readCanonicalChildMap({familyId:NEXT_MOVE_FAMILY,childId:NEXT_MOVE_CHILD,query:{query:"saved_answers",subjectId:"math"}},{getView:async()=>state.view});
 assert.ok("coverage" in other && other.coverage);assert.equal(other.conflicts.total,0);
});
test("evidence-only reads preserve unavailable, unknown and exact subject failures",async()=>{
 const input={familyId:NEXT_MOVE_FAMILY,childId:NEXT_MOVE_CHILD,query:{query:"saved_answers",subjectId:"fine_motor"} as const};
 assert.equal((await readCanonicalChildMap(input,{getView:async()=>null})).error,"unknown_child");
 assert.equal((await readCanonicalChildMap(input,{getView:async()=>{throw new Error("offline");}})).error,"progress_unavailable");
 const state=nextMoveState(nextMoveChatScenario("fresh_motor").ledger);
 assert.equal((await readCanonicalChildMap({...input,query:{query:"saved_answers",subjectId:"invented"}},{getView:async()=>state.view})).error,"unknown_subject");
});
test("scoped canonical read and exact subject comparison match web receipt", async()=>{
 const view=comparisonFixture([{itemId:"math.comparing-groups-more-or-fewer"}],{ageMonths:24});
 const result=await readCanonicalChildMap({familyId:COMPARISON_FAMILY,childId:COMPARISON_CHILD,query:{query:"subject_map",subjectId:"math"}},{getView:async(f,c)=>{assert.equal(f,COMPARISON_FAMILY);assert.equal(c,COMPARISON_CHILD);return view;}});
 assert.ok("comparison" in result);assert.deepEqual(result.comparison,buildProgressComparison(view,"math"));assert.ok(!("chartReads" in result));
});
test("null, failed, and mismatched child reads stay unavailable without fallback",async()=>{
 const input={familyId:COMPARISON_FAMILY,childId:COMPARISON_CHILD,query:{query:"subject_map",subjectId:"math"} as const};
 assert.equal((await readCanonicalChildMap(input,{getView:async()=>null})).error,"unknown_child");
 assert.equal((await readCanonicalChildMap(input,{getView:async()=>{throw new Error("offline");}})).error,"progress_unavailable");
 assert.equal((await readCanonicalChildMap(input,{getView:async()=>({...comparisonFixture(),childId:"foreign"})})).error,"progress_unavailable");
});
test("subject read separates credited support from a not-yet boundary and retains other saved answers",async()=>{
 const view=comparisonFixture([{itemId:"gross_motor.catches-ball",derivation:"inferred",observedAt:"2025-09-06T12:00:00Z"},{itemId:"gross_motor.gallops"},{itemId:"gross_motor.skips",answer:"not_yet"}],{ageMonths:72});
 const result=await readCanonicalChildMap({familyId:COMPARISON_FAMILY,childId:COMPARISON_CHILD,query:{query:"subject_map",subjectId:"gross_motor"}},{getView:async()=>view});
 assert.ok("ladder" in result && result.ladder);
 assert.ok("comparison" in result && result.comparison);
 assert.deepEqual(result.comparison.basis.map(item=>item.itemId),["gross_motor.catches-ball"]);
 assert.equal(result.comparison.monthsAhead,null);
 assert.equal(result.ladder.find(item=>item.itemId==="gross_motor.skips")?.childStatus,"not_yet");
 assert.equal(result.ladder.find(item=>item.itemId==="gross_motor.gallops")?.childStatus,"confirmed_easily");
 assert.ok("savedAnswers" in result && result.savedAnswers);
 assert.equal(result.savedAnswers.total,3);assert.equal(result.savedAnswers.omitted,0);
 assert.deepEqual(result.savedAnswers.answers.find(item=>item.itemId==="gross_motor.gallops"),{
  itemId:"gross_motor.gallops",statement:"Gallops, one foot leading the other",answer:"easily",observedAt:view.projectedAt,
  source:"Check-in",derivation:"direct",derivationLabel:"Shared directly",creditedAgeMonths:48,
 });
 assert.equal(result.savedAnswers.answers.find(item=>item.itemId==="gross_motor.skips")?.creditedAgeMonths,null);
 assert.ok(result.ladder.every(item=>!("frontier" in item)));
 assert.ok(!("position" in result));
 assert.ok(!("frontierDeltaMonths" in result));
});

test("actual tool keeps caller RLS child gate and authenticated family binding on both access paths", async()=>{
 let calls=0; let row: {data:unknown;error:unknown}={data:{id:COMPARISON_CHILD},error:null};
 const filters:unknown[][]=[];
 const query={select(field:string){assert.equal(field,"id");return this;},eq(field:string,value:string){filters.push([field,value]);return this;},async maybeSingle(){return row;}};
 let access:unknown={mode:"caller",familyId:COMPARISON_FAMILY,db:{from(table:string){assert.equal(table,"children");return query;}}};
 class MissingFamilyContextError extends Error {}
 const imports:Record<string,unknown>={
  "zod":{z},"../../lib/agent-tool-deadline":{defineBoundedTool:(definition:unknown)=>definition,TOOL_DEADLINE:{quick:5000}},
  "../../lib/agent-db":{MissingFamilyContextError,resolveAgentAccess:async()=>access},
  "../../lib/child-progress/runtime":{getChildProgressView:async(f:string,c:string)=>{calls++;assert.equal(f,COMPARISON_FAMILY);assert.equal(c,COMPARISON_CHILD);return comparisonFixture();}},
  "../../lib/map/canonical-explore":{readCanonicalChildMap, canonicalProgressUnavailable},
 };
 const source=readFileSync(new URL("../../agent/tools/explore_child_map.ts",import.meta.url),"utf8");
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};vm.runInNewContext(code,{module:mod,exports:mod.exports,require:(name:string)=>{assert.ok(name in imports,name);return imports[name];}},{filename:"actual explore_child_map.ts"});
 const definition=mod.exports as {default:{execute(input:unknown,ctx:unknown):Promise<Record<string,unknown>>}};
 const input={childId:COMPARISON_CHILD,query:"subject_map",subjectId:"gross_motor"};const ctx={session:{auth:{current:{attributes:{}}}}};
 const success=await definition.default.execute(input,ctx);assert.ok(success.comparison);assert.equal(calls,1);
 assert.deepEqual(filters,[["id",COMPARISON_CHILD],["family_id",COMPARISON_FAMILY]]);
 row={data:null,error:null};assert.equal((await definition.default.execute(input,ctx)).error,"unknown_child");assert.equal(calls,1);
 row={data:null,error:{message:"unavailable"}};assert.equal((await definition.default.execute(input,ctx)).error,"progress_unavailable");assert.equal(calls,1);
 access={mode:"pinned",familyId:COMPARISON_FAMILY};assert.ok((await definition.default.execute(input,ctx)).comparison);assert.equal(calls,2);
});
