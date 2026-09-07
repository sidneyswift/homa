import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";

import { readCanonicalChildMap } from "../map/canonical-explore";
import { renderChildProgressAgentContext } from "./agent-context";
import * as nextMove from "./next-move";
import * as fixture from "../../evals/progress-next-move/chat-fixture";
import { focusedSkillContext } from "../../evals/helpers/skill-context";

const require = createRequire(import.meta.url);
function transpile(source: string) { return ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText; }

test("actual correction routing refuses the actual assessment action names", async () => {
  const source = readFileSync(new URL("../../evals/progress-next-move/correction-routing.eval.ts", import.meta.url), "utf8");
  const toolModule = {exports: {} as {default: {test(t: unknown): Promise<void>}}};
  runInNewContext(transpile(source), {module:toolModule, exports:toolModule.exports, require:()=>({defineEval:(value:unknown)=>value})});
  for (const action of ["start_check_in", "resume_check_in", "respond_check_in"]) {
    const results: boolean[] = [];
    await toolModule.exports.default.test({send:async()=>({toolCalls:[{name:"manage_child_progress", input:{action}}]}), succeeded(){}, loadedSkill(){}, eventsSatisfy(_label:string, predicate:()=>boolean){results.push(predicate());}});
    assert.ok(results.includes(false), `${action} must fail the no-assessment gate`);
  }
});

test("actual model harness retains a partial tool trace before generation or judge failure", async () => {
  const source = readFileSync(new URL("../../evals/progress-next-move/chat-harness.ts", import.meta.url), "utf8");
  for (const phase of ["generation", "judge"] as const) {
    const events: Record<string, unknown>[] = [];
    let judges = 0;
    const toolModule = {exports: {} as {runChatNextMoveEval(name: string, log: (event: Record<string, unknown>)=>void): Promise<unknown>}};
    runInNewContext(transpile(source), {module:toolModule, exports:toolModule.exports, process:{env:{VERCEL_OIDC_TOKEN:"offline synthetic marker"}, cwd:()=>"/synthetic/apps/web"}, require:(name:string)=>{
      if(name==="node:fs/promises")return {readFile:async()=>"---\ndescription: Synthetic procedure\n---\nSynthetic skill body"};
      if(name==="node:path")return require(name);
      if(name==="zod")return {z};
      if(name==="ai")return {tool:(value:unknown)=>value, stepCountIs:()=>()=>false,
        generateText:async(options:{tools:{load_skill:{execute(input:unknown):Promise<unknown>}}})=>{
          await options.tools.load_skill.execute({skill:"progress-next-move"});
          if(phase==="generation")throw new Error("Synthetic generation failure");
          return {text:"Synthetic response",steps:[{text:"Earlier streamed response",toolCalls:[]},{text:"Synthetic response",toolCalls:[]}],usage:{inputTokens:10,outputTokens:2,totalTokens:12}};
        }, generateObject:async()=>{judges++;throw new Error("Synthetic judge failure");}};
      if(name==="../../agent/model")return {HOMA_MODEL:"offline-unused"};
      if(name==="../../agent/tools/verify_progress_next_move")return {progressNextMoveVerifyInputSchema:z.object({})};
      if(name==="../../lib/child-progress/agent-context")return {renderChildProgressAgentContext};
      if(name==="../../lib/child-progress/next-move")return nextMove;
      if(name==="../../lib/eval-isolation")return {isEvalIsolationActive:()=>true};
      if(name==="../../lib/map/canonical-explore")return {readCanonicalChildMap};
      if(name==="./chat-fixture")return fixture;
      if(name==="../helpers/skill-context")return {focusedSkillContext};
      throw new Error(`Unexpected offline dependency ${name}`);
    }});
    await assert.rejects(toolModule.exports.runChatNextMoveEval("fresh_motor", event=>events.push(event)), /Synthetic/);
    assert.ok(events.some(event=>Array.isArray(event.calls) && event.calls.some((call:{name?:string})=>call.name==="load_skill")), "retain real attempted calls before rejecting");
    assert.ok(events.some(event=>event.stage===`${phase}_failed`), "record the failing stage");
    if(phase==="judge")assert.ok(events.some(event=>event.stage==="generated" && event.text==="Earlier streamed response\n\nSynthetic response" && event.usage));
    assert.equal(judges,phase==="judge"?1:0);
  }
});

test("a selected-subject conflict is excluded from savedAnswers even beside a complete easy slice", async () => {
  const scenario=fixture.nextMoveChatScenario("conflict");
  scenario.ledger.evidence.push(fixture.nextMoveEvidence(fixture.CUT_LINE,{answer:"easily"}));
  const state=fixture.nextMoveState(scenario.ledger);
  const result=await readCanonicalChildMap({familyId:fixture.NEXT_MOVE_FAMILY,childId:fixture.NEXT_MOVE_CHILD,query:{query:"subject_map",subjectId:"fine_motor"}},{getView:async()=>state.view});
  assert.ok("savedAnswers" in result && result.savedAnswers);
  assert.equal(result.savedAnswers.omitted,0);
  assert.equal(result.savedAnswers.answers.length,1);
  assert.ok(result.savedAnswers.answers.every(answer=>answer.answer==="easily"));
  assert.ok("comparison" in result && result.comparison?.openConflicts===1);
});
