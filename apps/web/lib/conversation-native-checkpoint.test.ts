import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const eveRoot=new URL("../node_modules/eve/",import.meta.url);
test("installed public channel runs delivery guard before pending input consumption",async()=>{
  const installed=await import(new URL("dist/src/public/definitions/defineChannel.js",eveRoot).href);
  let calls=0;
  const definition={state:{seen:{}},routes:[],deliver:()=>{calls++;return undefined;}};
  const payload={inputResponses:[{requestId:"q1",optionId:"approve"}]};
  assert.equal(installed.defineChannel(definition).adapter.deliver(payload,{}),undefined);
  assert.equal(calls,1);
});

test("installed key survives actual channel send without entering model context",async()=>{
  const installed=await import(new URL("dist/src/channel/send.js",eveRoot).href);
  let received:Record<string,unknown>|undefined;
  const runtime={deliver:async(value:Record<string,unknown>)=>{received=value;return {sessionId:"session"};}};
  await installed.createSendFn(runtime,{},"conversation-request")({idempotencyKey:"answer-1",inputResponses:[{requestId:"q1",optionId:"approve"}]},
    {auth:null,continuationToken:"existing"});
  assert.equal((received!.payload as Record<string,unknown>).idempotencyKey,"answer-1");
  assert.equal((received!.payload as Record<string,unknown>).context,undefined);
});

test("installed state codecs checkpoint seen answers with consumed input, then drop replay before a newer approval",async()=>{
  const input=await import(new URL("dist/src/harness/input-requests.js",eveRoot).href);
  const storage=await import(new URL("dist/src/execution/durable-session-store.js",eveRoot).href);
  const keys=await import(new URL("dist/src/runtime/sessions/runtime-context-keys.js",eveRoot).href);
  const registry=await import(new URL("dist/src/runtime/channels/registry.js",eveRoot).href);
  const request=(id:string)=>({requestId:id,prompt:"Approve?",options:[{id:"approve",label:"Yes"},{id:"deny",label:"No"}],
    action:{kind:"tool-call",callId:id,toolName:"send_email",input:{}}});
  const installed=await import(new URL("dist/src/public/definitions/defineChannel.js",eveRoot).href);
  const prototype=installed.defineChannel({state:{seen:{}},routes:[],
    deliver(payload:{idempotencyKey:string;inputResponses:unknown[]},ctx:{state:{seen:Record<string,string>}}){
      const digest=JSON.stringify(payload.inputResponses),prior=ctx.state.seen[payload.idempotencyKey];
      if(prior!==undefined){if(prior!==digest)throw new Error("Conflicting answer");return undefined;}
      ctx.state.seen[payload.idempotencyKey]=digest;
      return {inputResponses:payload.inputResponses};
    }}).adapter;
  const pending=input.setPendingInputBatch({session:{sessionId:"session",continuationToken:"token",agent:{system:""},compaction:{},history:[]},
    requests:[request("approval-1")],responseMessages:[],event:{turnId:"turn_0",sequence:0,stepIndex:0}});
  const initial=structuredClone({channel:keys.ChannelKey.codec.serialize(prototype),runtime:storage.createDurableSessionState({session:pending})});
  async function restore(checkpoint:typeof initial){
    const adapter=registry.deserializeRuntimeAdapter({adaptersByKind:new Map([[prototype.kind,prototype]])},structuredClone(checkpoint.channel));
    const session=await storage.readDurableSession(structuredClone(checkpoint.runtime));
    return {adapter,session:{...session,compaction:{}}};
  }
  const payload={idempotencyKey:"answer-1",inputResponses:[{requestId:"approval-1",optionId:"approve"}]};
  const first=await restore(initial);
  const firstStep=first.adapter.deliver(payload,{state:first.adapter.state});
  const consumed=input.resolvePendingInput({session:first.session,stepInput:firstStep});
  assert.equal(consumed.outcome,"resolved");
  // Crash before checkpoint: both the seen map and consumed batch are absent.
  const crashed=await restore(initial);
  assert(crashed.adapter.deliver(payload,{state:crashed.adapter.state}));
  assert.equal(input.hasPendingInputBatch(crashed.session.state),true);
  // One completed workflow step returns serialized channel context and runtime
  // snapshot together. Simulate the next model step asking another approval.
  const next=input.setPendingInputBatch({session:consumed.session,requests:[request("approval-2")],responseMessages:[],
    event:{turnId:"turn_1",sequence:1,stepIndex:0}});
  const checkpoint=structuredClone({channel:keys.ChannelKey.codec.serialize(first.adapter),runtime:storage.createDurableSessionState({session:next})});
  const restored=await restore(checkpoint);
  assert.equal(restored.adapter.deliver(payload,{state:restored.adapter.state}),undefined);
  assert.equal(input.hasPendingInputBatch(restored.session.state),true);
  assert.throws(()=>restored.adapter.deliver({...payload,inputResponses:[{requestId:"approval-1",optionId:"deny"}]},{state:restored.adapter.state}),/Conflicting/);
  const second=restored.adapter.deliver({idempotencyKey:"answer-2",inputResponses:[{requestId:"approval-2",optionId:"deny"}]},{state:restored.adapter.state});
  assert.equal(input.resolvePendingInput({session:restored.session,stepInput:second}).rejectedActions.results[0].callId,"approval-2");
  const workflow=await readFile(new URL("dist/src/execution/workflow-steps.js",eveRoot),"utf8");
  assert.ok(workflow.includes('v===void 0){let e=reconcileSessionContinuationToken') && workflow.includes('serializedContext:n,sessionState:r'));
  assert.ok(workflow.indexOf('f.deliver?await f.deliver')<workflow.indexOf('createExecutionNodeStep({'));
});
