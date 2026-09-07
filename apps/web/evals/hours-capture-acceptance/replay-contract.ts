import assert from "node:assert/strict";

import { hasAcceptedLearningWriteOperation } from "../../lib/learning-write-operations";
import { loadHoursNoteSources } from "../../lib/hours-note-grounding";
import { canonicalInboundAuthAttributes } from "../../lib/conversation-continuity/canonical-inbound";
import { plannerLearningIdempotencyKey } from "../../lib/planner-learning-activities";
import { createHoursBehaviorFixture } from "./behavior-harness";

/** Deterministic regression at the actual tool boundary. Model cases separately
 * measure how the same inputs are selected from natural parent language. */
export async function runHoursReplayContract() {
  const fixture=await createHoursBehaviorFixture();
  const text="Finn did 30 minutes of Literature Journal lesson 3 and another separate 30 minutes of independent reading today.";
  const current=await fixture.startTurn(text);
  const first={title:"Literature Journal lesson 3",subject:"reading",activityDate:fixture.today,status:"completed",
    childIds:[fixture.childId],durationMinutes:30,sourceActivityOrdinal:1,sourceQuote:"30 minutes of Literature Journal lesson 3"};
  const second={...first,title:"Independent reading",sourceActivityOrdinal:2,sourceQuote:"another separate 30 minutes of independent reading today"};
  const {childIds:requiredChildren,...withoutChildren}=first;
  assert.equal(requiredChildren.length,1);
  await assert.rejects(()=>current.execute("record_planner_activity",withoutChildren),{name:"ZodError"});
  assert.equal((await fixture.snapshot()).operations.length,0,"An omitted participant decision must not become whole-family time");
  const result1=await current.execute("record_planner_activity",first) as {recorded:boolean;created:boolean;activity:{id:string}};
  assert.equal(result1.recorded,true);assert.equal(result1.created,true);
  const candidate=await current.execute("record_planner_activity",second) as {recorded:boolean;possibleDuplicate:boolean};
  assert.equal(candidate.recorded,false);assert.equal(candidate.possibleDuplicate,true,"New work still requires candidate review");
  const acceptedSecond={...second,confirmNotDuplicate:true};
  const result2=await current.execute("record_planner_activity",acceptedSecond) as typeof result1;
  assert.equal(result2.recorded,true);assert.equal(result2.created,true);assert.notEqual(result1.activity.id,result2.activity.id);
  const before=await fixture.snapshot();
  const replay1=await current.execute("record_planner_activity",first) as typeof result1;
  const replay2=await current.execute("record_planner_activity",acceptedSecond) as typeof result1;
  assert.equal(replay1.recorded,true);assert.equal(replay1.created,false);assert.equal(replay1.activity.id,result1.activity.id);
  assert.equal(replay2.recorded,true);assert.equal(replay2.created,false);assert.equal(replay2.activity.id,result2.activity.id);
  assert.deepEqual(await fixture.snapshot(),before);
  const changed=await current.execute("record_planner_activity",{...first,durationMinutes:31}) as {recorded:boolean;conflict:boolean};
  assert.equal(changed.recorded,false);assert.equal(changed.conflict,true,"Accepted-operation hint must still reach exact immutable-payload verification");
  assert.deepEqual(await fixture.snapshot(),before);
  const foreign=await createHoursBehaviorFixture();
  const key=plannerLearningIdempotencyKey({action:"record",sourceMessageId:current.message.id,identity:[1]});
  assert.equal(await hasAcceptedLearningWriteOperation({familyId:fixture.familyId,key,sourceMessageId:current.message.id}),true);
  assert.equal(await hasAcceptedLearningWriteOperation({familyId:foreign.familyId,key,sourceMessageId:current.message.id}),false);
  const other=await foreign.startTurn(text);
  const auth=other.context as unknown as {session:{auth:{current:{attributes:{canonicalInboundMessageId:string}}}}};
  auth.session.auth.current.attributes.canonicalInboundMessageId=current.message.id;
  const rejected=await other.execute("record_planner_activity",{...first,childIds:[foreign.childId],confirmNotDuplicate:true}) as {recorded:boolean};
  assert.equal(rejected.recorded,false,"A forged canonical source from another family must fail in the actual writer");
  assert.equal((await foreign.snapshot()).operations.length,0);assert.deepEqual(await fixture.snapshot(),before);
  const hoursFixture=await createHoursBehaviorFixture();
  const hoursTurn=await hoursFixture.startTurn("Finn did 20 minutes of reading today.");
  const hoursInput={sourceActivityOrdinal:1,sourceQuote:hoursTurn.message.text,childId:hoursFixture.childId,subject:"reading",minutes:20,note:hoursTurn.message.text};
  const invalidCurrentQuote=await hoursTurn.execute("log_hours",{...hoursInput,workContext:null,sourceQuote:"Earlier we read Narnia. "+hoursTurn.message.text}) as {logged:boolean;reason:string};
  assert.equal(invalidCurrentQuote.logged,false);assert.equal(invalidCurrentQuote.reason,"invalid_source_quote");
  assert.equal((await hoursFixture.snapshot()).operations.length,0,"An invalid current quote is a pre-effect refusal, never an uncertain write");
  await assert.rejects(()=>hoursTurn.execute("log_hours",hoursInput),{name:"ZodError"});
  assert.equal((await hoursFixture.snapshot()).operations.length,0);
  const literal=await hoursTurn.execute("log_hours",{...hoursInput,workContext:null}) as {logged:boolean};
  assert.equal(literal.logged,true,"Explicit no-earlier-context preserves current literal notes");
  const whitespace=await hoursFixture.startTurn("\n\tFinn read on his own\nfor 20 minutes.\u00a0\n");
  const canonical=canonicalInboundAuthAttributes({messageId:whitespace.message.id,text:whitespace.message.text});
  const sourceInput={familyId:hoursFixture.familyId,memberUserId:hoursFixture.memberUserId,sourceMessageId:whitespace.message.id,
    canonicalInboundText:canonical.canonicalInboundText,note:"Independent reading",workContext:null,channel:"sms" as const};
  assert.deepEqual(await loadHoursNoteSources(sourceInput),[{sourceMessageId:whitespace.message.id,text:canonical.canonicalInboundText}],"Source preflight must use the same canonical whitespace normalization as the channel");
  assert.equal(await loadHoursNoteSources({...sourceInput,canonicalInboundText:"Finn read Narnia for 20 minutes."}),null,"A different canonical text cannot borrow the source ID");
  return {checks:["omitted child choice refuses before mutation","omitted context choice refuses before mutation","invalid current quote returns truthful pre-effect refusal","explicit no-earlier-context preserves literal notes",
    "new same-subject work still receives candidate review","two distinct same-turn ordinals saved",
    "both exact replays return their original receipt","changed accepted payload still conflicts",
    "accepted-operation lookup remains family-scoped","foreign canonical source rejected without operation",
    "canonical whitespace source normalization matches channel","forged canonical text rejected"],
    original:[result1,result2],replay:[replay1,replay2],changed,foreignRejected:rejected,invalidCurrentQuote,durable:before};
}
