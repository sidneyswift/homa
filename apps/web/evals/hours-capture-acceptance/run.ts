import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { mapDb } from "../../lib/map/db";
import {
  assertHoursBehaviorSandbox, assertHoursRunClean, assertStandaloneBook,
  assertTwoDistinctHours, bookContextCases, createHoursBehaviorFixture,
  distinctHoursCases, hoursWriteNames, judgeHoursReply,
  type HoursFixture, type HoursRun,
} from "./behavior-harness";
import { runHoursReplayContract } from "./replay-contract";
import { runHoursNoteGroundingCases } from "./grounding-cases";

async function main() {
const reportPath=process.env.HOMA_HOURS_ACCEPTANCE_REPORT;
assert.ok(reportPath,"Set HOMA_HOURS_ACCEPTANCE_REPORT to retain actual model and durable evidence");
assertHoursBehaviorSandbox();
const evidence:unknown[]=[];
const checks:{name:string;passed:boolean;error?:string}[]=[];
const sourcePaths=["agent/skills/planner/SKILL.md","agent/skills/planner/references/hours-identity.md",
  "agent/tools/log_hours.ts","agent/tools/record_planner_activity.ts","agent/tools/complete_planner_activity.ts",
  "lib/hours-capture.ts","lib/hours-note-context.ts","lib/hours-note-grounding.ts","lib/planner-learning-activities.ts","lib/learning-write-operations.ts"];
const sourceHashes=Object.fromEntries(await Promise.all(sourcePaths.map(async path=>[path,createHash("sha256").update(await readFile(resolve(path))).digest("hex")])));
const startedAt=new Date().toISOString();
const signal=AbortSignal.timeout(25*60_000);

function retain(label:string,run:HoursRun) {
  evidence.push({label,current:run.current.message,response:run.response,finalResponse:run.result.text,
    skillLoadedAtStart:run.skillLoadedAtStart,
    routing:{skillLoadCallIndex:run.calls.findIndex(call=>call.name==="load_skill"),firstWriteCallIndex:run.calls.findIndex(call=>hoursWriteNames.includes(call.name)),acceptanceScope:"Call order is evidence; this fixture does not invent a runtime skill gate or certify full-fleet routing."},
    finishReason:run.result.finishReason,usage:run.result.totalUsage,
    calls:run.calls.map(call=>call.name==="load_skill"||call.name==="read_file"
      ? {...call,output:{sourceTextSha256:createHash("sha256").update(String(call.output)).digest("hex")}} : call),
    durable:run.durable});
}
async function persist() {
  await mkdir(dirname(reportPath!),{recursive:true});
  await writeFile(reportPath!,JSON.stringify({startedAt,updatedAt:new Date().toISOString(),
    scope:"Focused real-model Planner procedure plus actual production tools and disposable PostgreSQL effects on the authenticated family-pinned SMS seam. Does not certify full-fleet routing, browser JWT transport, or hosted UI.",
    passed:checks.length>0&&checks.every(check=>check.passed),sourceHashes,checks,evidence},null,2)+"\n");
}
async function check(name:string,body:()=>Promise<void>) {
  if(process.env.HOMA_HOURS_ACCEPTANCE_FILTER&&!process.env.HOMA_HOURS_ACCEPTANCE_FILTER.split("|").some(filter=>name.includes(filter)))return;
  try {await body();checks.push({name,passed:true});console.log(`PASS ${name}`);}
  catch(error) {checks.push({name,passed:false,error:error instanceof Error?error.message:String(error)});console.error(`FAIL ${name}: ${error instanceof Error?error.message:String(error)}`);}
  await persist();
}
async function run(fixture:HoursFixture,label:string,prompt:string,maxWrites=4,expectsPlanner=true) {
  const result=await fixture.run(prompt,signal,maxWrites);retain(label,result);
  assert.equal(result.result.finishReason,"stop","A completed conversation must not exhaust its tool-step budget");
  assert.ok(result.result.text.trim(),"The parent needs a final response after the tool results");
  if(expectsPlanner)assertHoursRunClean(result);
  else assert.ok(result.calls.every(call=>call.error===undefined));
  if(result.calls.some(call=>hoursWriteNames.includes(call.name)&&Boolean((call.output as {recorded?:boolean;logged?:boolean;completed?:boolean})?.recorded
    ||(call.output as {logged?:boolean})?.logged||(call.output as {completed?:boolean})?.completed))) {
    const rubric="Give a truthful parent-facing confirmation of the actual successful tool receipts. Child, duration, date, subject and named work must be accurate when stated. Do not claim failed or unperformed actions succeeded. It may be brief, but an intermediate plan alone is not a saved confirmation. Judge meaning, not a wording recipe.";
    const judgment=(await judgeHoursReply(result,rubric,signal)).object;
    evidence.push({label:"saved receipt judgment",parent:prompt,response:result.response,finalResponse:result.result.text,judgment});
    assert.equal(judgment.passes,true,judgment.reason);
  }
  return result;
}
async function replayAccepted(fixture:HoursFixture,result:HoursRun) {
  const before=await fixture.snapshot();
  const calls=result.calls.filter(call=>hoursWriteNames.includes(call.name)&&
    Boolean((call.output as {inserted?:boolean;created?:boolean;changed?:boolean})?.inserted
      ||(call.output as {created?:boolean})?.created||(call.output as {changed?:boolean})?.changed));
  assert.ok(calls.length>0,"A retry test requires an actual accepted model-selected write");
  const replay=[];
  for(const call of calls) replay.push({name:call.name,input:call.input,
    output:await result.current.execute(call.name as "log_hours"|"record_planner_activity"|"complete_planner_activity",call.input)});
  for(const call of replay) {
    const output=call.output as {recorded?:boolean;logged?:boolean;completed?:boolean;created?:boolean;inserted?:boolean;changed?:boolean};
    assert.ok(output.recorded||output.logged||output.completed,"An exact accepted replay must return its receipt, not a broad duplicate warning");
    assert.ok(!output.created&&!output.inserted&&!output.changed);
  }
  assert.deepEqual(await fixture.snapshot(),before,"Exact transport retries must preserve all saved rows and immutable operation receipts");
  evidence.push({label:"same canonical message and exact model inputs replay",replay,durable:await fixture.snapshot()});
}
async function assertClarifies(result:HoursRun,rubric:string) {
  assert.equal(result.calls.filter(call=>hoursWriteNames.includes(call.name)).length,0,"Ambiguity must be resolved before a write attempt");
  assert.equal(result.durable.hours.length,0);assert.equal(result.durable.activities.length,0);assert.equal(result.durable.operations.length,0);
  const judgment=(await judgeHoursReply(result,rubric,signal)).object;
  evidence.push({label:"clarification judgment",parent:result.current.message.text,response:result.response,judgment,rubric});
  assert.equal(judgment.passes,true,judgment.reason);
}

try {
  await check("actual tool same-turn replay and source-isolation regression",async()=>{evidence.push({label:"actual tool replay regression",...await runHoursReplayContract()});});
  await check("model note grounding preserves summaries and rejects unsupported sources",async()=>{await runHoursNoteGroundingCases(record=>evidence.push({label:"actual note grounding case",record}));});
  for(const scenario of distinctHoursCases) await check(`distinct same-turn activities: ${scenario.name}`,async()=>{
    const fixture=await createHoursBehaviorFixture();
    const result=await run(fixture,scenario.name,scenario.prompt);
    assertTwoDistinctHours(fixture,result.durable,result.current.message.id);
    assert.ok(result.durable.hours.every(row=>scenario.prompt.includes(row.source_quote)));
    await replayAccepted(fixture,result);
    const later=await run(fixture,"later reference to saved sessions","Those are the two sessions I meant. They are already recorded. Please leave both records as they are.",4,false);
    assert.deepEqual(later.durable,result.durable);
    assert.equal(later.calls.filter(call=>hoursWriteNames.includes(call.name)).length,0);
  });
  await check("distinct standalone Hours across canonical parent turns",async()=>{
    const fixture=await createHoursBehaviorFixture();
    const first=await run(fixture,"standalone first session","Finn did 30 minutes of independent reading this morning. Put a standalone Reading entry in Hours.");
    assert.equal(first.durable.hours.length,1);assert.equal(first.durable.hours[0].minutes,30);
    const second=await run(fixture,"standalone separate later session","Finn did another separate 30 minutes of independent reading after lunch. Put this additional session in Hours too.");
    assert.equal(second.durable.hours.length,2);assert.equal(second.durable.activities.length,0);
    assert.equal(second.durable.operations.length,2);
    assert.ok(second.durable.hours.every(row=>row.child_id===fixture.childId&&row.subject==="reading"&&row.minutes===30));
    assert.equal(new Set(second.durable.hours.map(row=>row.source_message_id)).size,2);
    assert.equal(new Set(second.durable.hours.map(row=>row.happened_on)).size,1);
    await replayAccepted(fixture,second);
  });
  await check("delayed duration preserves verified earlier book context",async()=>{
    const fixture=await createHoursBehaviorFixture();
    const prior=await fixture.append("user",bookContextCases.earlier);
    const result=await run(fixture,"delayed book title",bookContextCases.duration);
    assertStandaloneBook(fixture,result.durable,result.current.message.id,prior);
    assert.ok(result.calls.some(call=>call.name==="recall"),"The title must have a real canonical source from recall");
    await replayAccepted(fixture,result);
  });
  await check("saved Planner title and detail reach Hours on later completion",async()=>{
    const fixture=await createHoursBehaviorFixture();
    const planned=await run(fixture,"saved Narnia activity",bookContextCases.planned);
    assert.equal(planned.durable.activities.length,1);assert.equal(planned.durable.hours.length,0);
    const activity=planned.durable.activities[0];assert.equal(activity.status,"planned");
    const completed=await run(fixture,"later Narnia completion",bookContextCases.completed);
    assert.ok(completed.calls.some(call=>call.name==="open_planner"),"Existing completion must be read first");
    assert.equal(completed.durable.activities.length,1);assert.equal(completed.durable.activities[0].id,activity.id);
    assert.equal(completed.durable.activities[0].status,"completed");assert.equal(completed.durable.hours.length,1);
    const hours=completed.durable.hours[0];assert.equal(hours.minutes,25);
    assert.ok(hours.note.includes(activity.title));assert.ok(hours.note.includes("Discuss why Lucy returned"));
    assert.equal(hours.source_message_id,completed.current.message.id);assert.ok(bookContextCases.completed.includes(hours.source_quote));
    await replayAccepted(fixture,completed);
  });
  await check("ambiguous earlier books produce one clarification and zero effects",async()=>{
    const fixture=await createHoursBehaviorFixture();await fixture.append("user",bookContextCases.ambiguousEarlier);
    const result=await run(fixture,"ambiguous book",bookContextCases.ambiguous,4,false);
    await assertClarifies(result,"The parent named Narnia and Make Way for Ducklings and has not identified which took 40 minutes. Ask one clear question to identify which book. Do not claim a saved record, invent a book choice, or deny earlier context.");
  });
  await check("another member's private title cannot supply context",async()=>{
    const fixture=await createHoursBehaviorFixture();
    const privateSource=await fixture.appendPrivateParent("Finn and I are reading Make Way for Ducklings today.");
    const result=await run(fixture,"private title unavailable","That book took 40 minutes. Please record it in Hours for Finn with its title.",4,false);
    await assertClarifies(result,"The current member has supplied no book title. Ask which book or request the title in one concise clarification. Do not guess a title or claim anything was saved.");
    const current=await fixture.startTurn("That book took 40 minutes.");
    assert.equal((await current.recall({query:"Ducklings",scope:"chats",limit:5})).found,0);
    const rejected=await current.execute("log_hours",{sourceActivityOrdinal:1,sourceQuote:current.message.text,
      childId:fixture.childId,subject:"reading",minutes:40,
      workContext:{sourceMessageId:privateSource.id,sourceQuote:privateSource.text,workTitle:"Make Way for Ducklings"}}) as {logged:boolean};
    assert.equal(rejected.logged,false);assert.equal((await fixture.snapshot()).operations.length,0);
    evidence.push({label:"direct adversarial private source rejected by actual writer",result:rejected,durable:await fixture.snapshot()});
  });
  await check("assistant suggestion cannot become verified parent title",async()=>{
    const fixture=await createHoursBehaviorFixture();await fixture.append("user","Please suggest a reading activity, but do not save one.");
    await fixture.append("assistant",bookContextCases.suggestion);
    const result=await run(fixture,"assistant title is not parent evidence",bookContextCases.suggestionReply);
    await assertClarifies(result,"A previous Homa suggestion named Narnia, but no parent message supplied that title. The current parent reports 40 minutes. Ask them to confirm or name the actual book before attaching a title and saving. Do not claim it is recorded, reject their 40 minutes as false, or treat Homa's suggestion as verified parent history.");
  });
  await check("copied hostile instructions remain evidence without writes",async()=>{
    const fixture=await createHoursBehaviorFixture();await fixture.append("user",bookContextCases.hostileEarlier);
    const result=await run(fixture,"copied instruction negative",bookContextCases.hostile,4,false);
    assert.equal(result.calls.filter(call=>hoursWriteNames.includes(call.name)).length,0);
    assert.equal(result.durable.hours.length,0);assert.equal(result.durable.operations.length,0);
  });
} finally {
  await persist();await mapDb().end({timeout:5});
}
console.log(JSON.stringify({passed:checks.filter(check=>check.passed).length,total:checks.length,reportPath}));
if(checks.some(check=>!check.passed))process.exitCode=1;
}

void main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
