import assert from "node:assert/strict";
import { test } from "node:test";

import { conversationNativeResponse,type NativeRouteDependencies } from "./conversation-native-route";
import { ConversationRequestError } from "./conversation-requests";

const familyId="11111111-1111-4111-8111-111111111111",memberUserId="22222222-2222-4222-8222-222222222222";
const accessEpoch="33333333-3333-4333-8333-333333333333",intentId="44444444-4444-4444-8444-444444444444",batchId="55555555-5555-4555-8555-555555555555";
const account=`${familyId}:${memberUserId}`;
function fixture(){
  const calls:unknown[]=[];
  const deps:NativeRouteDependencies={enabled:()=>true,principal:async()=>({familyId,memberUserId}),limited:()=>false,read:async()=>({batches:[],nextCursor:null}),
    accept:async(principal,input)=>{calls.push({principal,input});return {requestId:intentId,intentId,messageId:intentId,state:"queued",acceptedAt:new Date(0).toISOString(),replayed:false};}};
  return {deps,calls};
}
const body=()=>({account,accessEpoch,intentId,batchId,responses:[{requestId:"choice",optionId:"apple"}]});
const post=(value:unknown,headers:Record<string,string>={authorization:"Bearer parent"})=>new Request("https://homa.test/api/conversation/native-input",{
  method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify(value)});

test("native answer route uses authenticated adult, exact structured response, committed receipt",async()=>{
  const {deps,calls}=fixture();const response=await conversationNativeResponse(post(body()),deps);
  assert.equal(response.status,202);assert.equal(response.headers.get("cache-control"),"private, no-store");
  assert.deepEqual(calls,[{principal:{familyId,memberUserId,accessEpoch},input:{intentId,batchId,responses:body().responses}}]);
});
test("native route refuses cookies, account mismatch, browser runtime selectors and unknown body fields",async()=>{
  const {deps,calls}=fixture();
  assert.equal((await conversationNativeResponse(post(body(),{cookie:"session=browser"}),deps)).status,401);
  assert.equal((await conversationNativeResponse(post({...body(),account:"other"}),deps)).status,409);
  for(const extra of [{familyId},{sessionId:"runtime"},{continuationToken:"runtime"},{text:"approve"}]){
    assert.equal((await conversationNativeResponse(post({...body(),...extra}),deps)).status,400);
  }
  assert.equal(calls.length,0);
});
test("native route is unavailable when fenced off, and never leaks commit errors",async()=>{
  const {deps}=fixture();deps.enabled=()=>false;
  assert.equal((await conversationNativeResponse(post(body()),deps)).status,503);
  deps.enabled=()=>true;deps.accept=async()=>{throw new Error("secret provider response");};
  const failed=await conversationNativeResponse(post(body()),deps);assert.deepEqual(await failed.json(),{reason:"retry"});
  deps.accept=async()=>{throw new ConversationRequestError("conflict");};
  assert.equal((await conversationNativeResponse(post(body()),deps)).status,409);
  deps.accept=async()=>{throw new ConversationRequestError("missing");};
  const missing=await conversationNativeResponse(post(body()),deps);
  assert.equal(missing.status,410);assert.deepEqual(await missing.json(),{reason:"deleted"});
});
test("native list requires the same account and epoch and returns only safe projection",async()=>{
  const {deps}=fixture();
  const request=new Request(`https://homa.test/api/conversation/native-input?account=${account}&accessEpoch=${accessEpoch}`,{headers:{authorization:"Bearer parent"}});
  const response=await conversationNativeResponse(request,deps);assert.equal(response.status,200);assert.deepEqual(await response.json(),{batches:[],nextCursor:null});
});
