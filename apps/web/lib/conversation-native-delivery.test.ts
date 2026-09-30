import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { defineChannel, type SendPayload } from "eve/channels";

import { deliverNativeConversationInput, type NativeDeliveryState, type validateStoredNativeDelivery } from "./conversation-native-delivery";
import { ConversationRequestError } from "./conversation-requests";

function fixture(){
  const requestId=randomUUID(),familyId=randomUUID(),memberUserId=randomUUID(),accessEpoch=randomUUID(),leaseToken=randomUUID();
  const auth={authenticator:"conversation-request-dispatcher",principalId:memberUserId,attributes:{channel:"conversation-request",
    familyId,memberUserId,conversationRequestId:requestId,conversationRequestAccessEpoch:accessEpoch,conversationRequestLease:leaseToken}};
  const payload={idempotencyKey:requestId,inputResponses:[{requestId:"question-1",optionId:"approve"}]};
  const context={state:{nativeAnswers:{}} as NativeDeliveryState,sessionId:"runtime",auth};
  const validation:typeof validateStoredNativeDelivery=async(identity,sessionId,key,responses)=>{
    assert.equal(identity.memberUserId,memberUserId);assert.equal(identity.accessEpoch,accessEpoch);assert.equal(sessionId,"runtime");
    assert.equal(key,requestId);assert.deepEqual(responses,payload.inputResponses);
    return {digest:"stored-approved-answer",responses:payload.inputResponses,canConsume:true};
  };
  return {requestId,payload,context,validation};
}

test("installed channel invokes the production boundary and drops a checkpointed duplicate",async()=>{
  const f=fixture();let validations=0;
  const channel=defineChannel({state:f.context.state,routes:[],async deliver(payload,ctx){
    return deliverNativeConversationInput(payload,{...f.context,state:ctx.state},async(...args)=>{validations++;return f.validation(...args);});
  }});
  const adapter=(channel as unknown as {adapter:{state:NativeDeliveryState;deliver(payload:SendPayload,context:unknown):Promise<SendPayload|undefined>}}).adapter;
  // The same authored state is restored by Eve's codec, exercised separately in
  // the installed checkpoint regression. No model or resolver sees this key.
  const first=await adapter.deliver!(f.payload,{state:adapter.state} as never);
  assert.deepEqual(first,{inputResponses:f.payload.inputResponses});
  const restored=structuredClone(adapter.state) as NativeDeliveryState;
  assert.equal(await adapter.deliver!(f.payload,{state:restored} as never),undefined);
  assert.equal(validations,2);assert.equal(Object.keys(restored.nativeAnswers).length,1);
});

test("failed access validation cannot mutate state or drop a cached answer",async()=>{
  const f=fixture();
  await assert.rejects(deliverNativeConversationInput(f.payload,f.context,async()=>{throw new ConversationRequestError("access_changed");}),/access_changed/);
  assert.deepEqual(f.context.state.nativeAnswers,{});
  await deliverNativeConversationInput(f.payload,f.context,f.validation);
  await assert.rejects(deliverNativeConversationInput(f.payload,f.context,async()=>{throw new ConversationRequestError("deleted");}),/deleted/);
  assert.equal(f.context.state.nativeAnswers[f.requestId],"stored-approved-answer");
});

test("a changed digest under a seen key is rejected before any state change",async()=>{
  const f=fixture();await deliverNativeConversationInput(f.payload,f.context,f.validation);
  await assert.rejects(deliverNativeConversationInput(f.payload,f.context,async()=>({digest:"changed",responses:f.payload.inputResponses,canConsume:true})),/conflict/);
  assert.equal(f.context.state.nativeAnswers[f.requestId],"stored-approved-answer");
});

test("seen old answer can be dropped with a newer envelope but unseen foreign identity cannot consume",async()=>{
  const f=fixture();await deliverNativeConversationInput(f.payload,f.context,f.validation);
  f.context.auth.attributes.conversationRequestId=randomUUID();
  const oldValidation:typeof validateStoredNativeDelivery=async()=>({digest:"stored-approved-answer",responses:f.payload.inputResponses,canConsume:false});
  assert.equal(await deliverNativeConversationInput(f.payload,f.context,oldValidation),undefined);
  f.context.state.nativeAnswers={};
  await assert.rejects(deliverNativeConversationInput(f.payload,f.context,oldValidation),/execution/);
  assert.deepEqual(f.context.state.nativeAnswers,{});
});

test("missing keys, empty responses, mixed text, extra context and forged auth fail closed",async()=>{
  const f=fixture();let calls=0;
  for(const value of [{inputResponses:f.payload.inputResponses},{...f.payload,idempotencyKey:"not-a-uuid"},{...f.payload,inputResponses:[]},
    {...f.payload,message:"approve"},{...f.payload,context:{fake:true}}]){
    await assert.rejects(deliverNativeConversationInput(value as SendPayload,f.context,async()=>{calls++;return f.validation({} as never,"","",[]);}),/invalid/);
  }
  await assert.rejects(deliverNativeConversationInput(f.payload,{...f.context,auth:null},f.validation),/execution/);
  assert.equal(calls,0);
});

test("ordinary input remains unchanged and completed answer keys are never pruned",async()=>{
  const f=fixture(),ordinary={message:"A normal typed request"};
  assert.equal(await deliverNativeConversationInput(ordinary,f.context,async()=>assert.fail()),ordinary);
  const old=Object.fromEntries(Array.from({length:1000},()=>[randomUUID(),"historical-digest"]));
  f.context.state.nativeAnswers={...old};
  await deliverNativeConversationInput(f.payload,f.context,f.validation);
  for(const [key,value] of Object.entries(old))assert.equal(f.context.state.nativeAnswers[key],value);
  assert.equal(Object.keys(f.context.state.nativeAnswers).length,1001);
});

test("an older session without a seen map upgrades only after successful validation",async()=>{
  const f=fixture();f.context.state={} as NativeDeliveryState;
  await assert.rejects(deliverNativeConversationInput(f.payload,f.context,async()=>{throw new ConversationRequestError('execution');}));
  assert.deepEqual(f.context.state,{});
  await deliverNativeConversationInput(f.payload,f.context,f.validation);
  assert.equal(f.context.state.nativeAnswers[f.requestId],'stored-approved-answer');
});
