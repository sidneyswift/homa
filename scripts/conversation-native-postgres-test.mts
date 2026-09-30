import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import path from "node:path";

import type { HandleMessageStreamEvent } from "eve/client";
import { applyConversationSourceBatch,leaseConversationSources } from "../apps/web/lib/conversation-source";
import { acceptNativeConversationAnswer,prepareNativeContinuation,claimNativeContinuation,readNativeConversationBatches } from "../apps/web/lib/conversation-native-batches";
import { validateStoredNativeDelivery,deliverNativeConversationInput } from "../apps/web/lib/conversation-native-delivery";
import { readConversationFeed,readConversationFeedChanges } from "../apps/web/lib/conversation-feed";
import { mapDb } from "../apps/web/lib/map/db";
import { EVAL_FIXTURE_FAMILY_ID, EVAL_FIXTURE_PARENT_USER_ID } from "../apps/web/lib/family-context-eval-fixture";
import { acceptConversationRequest,readConversationAccess,leaseConversationRequest,claimConversationExecution,
  authorizeConversationRequest } from "../apps/web/lib/conversation-requests";


assert(process.env.HOMA_EVAL_DATABASE_URL && process.env.HOMA_EVAL_BLOB_DIR);
process.env.HOMA_CONVERSATION_NATIVE_INPUT="1";
assert(!process.env.VERCEL && process.env.HOMA_EVAL_ALLOW_PROD_WRITES !== "1");
const sql=mapDb();
try {
  const [target]=await sql`select current_setting('data_directory') as directory,host(inet_server_addr()) as address,current_database() as database,current_user as owner`;
  const root=path.dirname(realpathSync(process.env.HOMA_EVAL_BLOB_DIR!));
  assert.equal(target.database,"homa_eval");assert.equal(target.owner,"homa_eval");
  assert.match(path.basename(root),/^homa-eval-sandbox-/u);assert.equal(realpathSync(target.directory),path.join(root,"data"));
  assert([null,"127.0.0.1","::1"].includes(target.address));
  const base={familyId:EVAL_FIXTURE_FAMILY_ID,memberUserId:EVAL_FIXTURE_PARENT_USER_ID};
  const principal={...base,...await readConversationAccess(base)};

  const accepted=await acceptConversationRequest(principal,{intentId:randomUUID(),text:"Help me choose"});
  const lease=await leaseConversationRequest(principal);if(lease.kind!=="leased")throw new Error("Missing lease");
  const execution={requestId:accepted.requestId,leaseToken:lease.leaseToken,sessionId:`native-${randomUUID()}`,turnId:"turn_0",sequence:0};
  await claimConversationExecution(principal,execution,"Help me choose");
  const source=(await leaseConversationSources()).find(value=>value.sessionId===execution.sessionId)!;assert(source);
  const native={type:"input.requested",data:{turnId:"turn_0",sequence:0,stepIndex:0,requests:[{
    requestId:"choice-1",prompt:"Which activity?",options:[{id:"apple",label:"Apple activity"},{id:"pear",label:"Pear activity"}],
    action:{kind:"tool-call",callId:"call-1",toolName:"ask_question",input:{privateArgument:"not saved"}}
  }]}};
  let result=await applyConversationSourceBatch(source,0,[{type:"message.received",data:{message:"Help me choose",turnId:"turn_0",sequence:0}},
    native,{type:"turn.completed",data:{turnId:"turn_0",sequence:0}}] as HandleMessageStreamEvent[]);
  assert.equal((await sql`select state from public.conversation_requests where id=${accepted.requestId}`)[0].state,"awaiting_parent");
  const [card]=await readNativeConversationBatches(principal);assert(card);
  assert(!JSON.stringify(card).includes("privateArgument"));
  const [nativeMessage]=await sql`select * from public.conversation_messages where id=${card.canonicalMessageId}`;
  assert.equal(nativeMessage.content,"Which activity?");assert.equal(nativeMessage.member_user_id,principal.memberUserId);
  assert.equal(nativeMessage.session_id,execution.sessionId);assert.equal(nativeMessage.turn_id,`native-question:${card.batchId}`);
  assert(!JSON.stringify((await sql`select payload from public.conversation_native_batches where id=${card.batchId}`)[0]).includes("not saved"));
  const nativeFeed=await readConversationFeed(principal);
  const nativeEntry=nativeFeed.messages.find(value=>value.id===card.canonicalMessageId)!;assert(nativeEntry?.nativeInput);
  assert.equal(nativeEntry.nativeInput.batchId,card.batchId);assert.equal(nativeEntry.nativeInput.state,"pending");
  assert.equal(nativeEntry.content,"Which activity?");assert(!JSON.stringify(nativeEntry.nativeInput).includes('"action"'));
  assert(!JSON.stringify(nativeEntry.nativeInput).includes('call-1'));assert(!JSON.stringify(nativeEntry.nativeInput).includes('privateArgument'));
  const otherUser=randomUUID();await sql`insert into auth.users(id,email) values(${otherUser},${`${otherUser}@example.test`})`;
  await sql`insert into public.family_members(family_id,user_id) values(${base.familyId},${otherUser})`;
  const other={familyId:base.familyId,memberUserId:otherUser,...await readConversationAccess({familyId:base.familyId,memberUserId:otherUser})};
  await assert.rejects(acceptNativeConversationAnswer(other,{intentId:randomUUID(),batchId:card.batchId,responses:[{requestId:"choice-1",optionId:"apple"}]}),/missing/);
  await assert.rejects(acceptNativeConversationAnswer(principal,{intentId:randomUUID(),batchId:card.batchId,responses:[]}),/invalid/);
  const answerIntent=randomUUID();
  const answers=await Promise.all(Array.from({length:6},()=>acceptNativeConversationAnswer(principal,{intentId:answerIntent,batchId:card.batchId,
    responses:[{requestId:"choice-1",optionId:"apple"}]})));
  assert.equal(new Set(answers.map(value=>value.requestId)).size,1);
  const answer=answers[0];
  const delta=await readConversationFeedChanges(principal,{after:nativeFeed.changeCursor});
  const updated=delta.changes.find(value=>value.kind==='upsert'&&value.message.id===card.canonicalMessageId);
  assert(updated?.kind==='upsert');assert.equal(updated.message.nativeInput?.state,'answered');
  assert.deepEqual(updated.message.nativeInput?.responses,[{requestId:'choice-1',optionId:'apple'}]);
  const newest=await readConversationFeed(principal,{limit:1});assert(newest.nextCursor);
  const older=await readConversationFeed(principal,{limit:1,before:newest.nextCursor});
  assert.equal(older.messages[0]?.id,card.canonicalMessageId);assert.equal(older.messages[0]?.nativeInput?.state,'answered');
  await assert.rejects(acceptNativeConversationAnswer(principal,{intentId:randomUUID(),batchId:card.batchId,responses:[{requestId:"choice-1",optionId:"pear"}]}),/conflict/);
  const next=await leaseConversationRequest(principal);if(next.kind!=="leased")throw new Error("Missing native lease");assert.equal(next.requestId,answer.requestId);
  const dispatch=await prepareNativeContinuation(principal,next.requestId,next.leaseToken);assert(dispatch);
  assert.equal(dispatch.originRequestId,accepted.requestId);assert.equal(dispatch.originLease,lease.leaseToken);
  assert.deepEqual(await prepareNativeContinuation(principal,next.requestId,next.leaseToken),dispatch);
  await sql`update public.conversation_requests set lease_until=clock_timestamp()-interval '1 second' where id=${next.requestId}`;
  const retried=await leaseConversationRequest(principal);assert.equal(retried.kind,"leased");
  if(retried.kind!=="leased")throw new Error("Native retry missing");
  assert.equal(retried.leaseToken,next.leaseToken);assert.equal(retried.requestId,next.requestId);
  assert.deepEqual(await prepareNativeContinuation(principal,retried.requestId,retried.leaseToken),dispatch);
  const replayIdentity={...principal,requestId:next.requestId,leaseToken:next.leaseToken};
  const replayAuth={authenticator:'conversation-request-dispatcher',principalId:principal.memberUserId,attributes:{
    channel:'conversation-request',familyId:principal.familyId,memberUserId:principal.memberUserId,
    conversationRequestAccessEpoch:principal.accessEpoch,conversationRequestId:next.requestId,conversationRequestLease:next.leaseToken}};
  const replayContext={state:{nativeAnswers:{}},sessionId:execution.sessionId,auth:replayAuth};
  const replayPayload={idempotencyKey:next.requestId,inputResponses:dispatch.inputResponses};
  const validated=await validateStoredNativeDelivery(replayIdentity,execution.sessionId,next.requestId,dispatch.inputResponses);
  assert.equal(validated.canConsume,true);
  await assert.rejects(validateStoredNativeDelivery({...replayIdentity,memberUserId:otherUser,accessEpoch:other.accessEpoch},execution.sessionId,next.requestId,dispatch.inputResponses));
  await assert.rejects(validateStoredNativeDelivery(replayIdentity,'new-or-wrong-runtime',next.requestId,dispatch.inputResponses));
  await assert.rejects(validateStoredNativeDelivery({...replayIdentity,leaseToken:randomUUID()},execution.sessionId,next.requestId,dispatch.inputResponses));
  await assert.rejects(validateStoredNativeDelivery({...replayIdentity,accessEpoch:randomUUID()},execution.sessionId,next.requestId,dispatch.inputResponses));
  await assert.rejects(validateStoredNativeDelivery(replayIdentity,execution.sessionId,next.requestId,[{requestId:'choice-1',optionId:'pear'}]),/conflict/);
  await assert.rejects(validateStoredNativeDelivery(replayIdentity,execution.sessionId,next.requestId,[...dispatch.inputResponses,...dispatch.inputResponses]),/invalid/);
  assert.deepEqual(await deliverNativeConversationInput(replayPayload,replayContext),{inputResponses:dispatch.inputResponses});
  assert.equal(await deliverNativeConversationInput(replayPayload,replayContext),undefined);
  assert.equal((await sql`select lease_token from public.conversation_requests where id=${next.requestId}`)[0].lease_token,next.leaseToken);
  const continuation={requestId:answer.requestId,leaseToken:next.leaseToken,sessionId:execution.sessionId,turnId:"turn_1",sequence:1};
  await assert.rejects(claimNativeContinuation(principal,{...continuation,sessionId:"wrong"}),/execution/);
  await assert.rejects(claimConversationExecution(principal,continuation,"Apple activity"),/execution/);
  await sql`update public.conversation_messages set content='forged' where id=${answer.messageId}`;
  await assert.rejects(claimNativeContinuation(principal,continuation),/execution/);
  await sql`update public.conversation_messages set content='Apple activity' where id=${answer.messageId}`;
  assert.equal((await claimNativeContinuation(principal,continuation))?.text,"Apple activity");
  await authorizeConversationRequest(principal,{...continuation,phase:"execute"});
  result=await applyConversationSourceBatch(source,result.nextIndex,[{type:"turn.started",data:{turnId:"turn_1",sequence:1}},
    {type:"message.completed",data:{turnId:"turn_1",sequence:1,stepIndex:0,message:"Here is your apple activity.",finishReason:"stop"}},
    {...native,data:{...native.data,turnId:"turn_1",sequence:1}},
    {type:"turn.completed",data:{turnId:"turn_1",sequence:1}}] as HandleMessageStreamEvent[]);
  assert.equal((await sql`select state from public.conversation_requests where id=${answer.requestId}`)[0].state,"awaiting_parent");
  assert.equal((await sql`select execution_turn_id from public.conversation_requests where id=${accepted.requestId}`)[0].execution_turn_id,"turn_0");
  assert.equal((await sql`select content from public.conversation_messages where session_id=${execution.sessionId} and role='assistant' and turn_id='turn_1'`)[0].content,"Here is your apple activity.");
  const secondCard=(await readNativeConversationBatches(principal)).find(value=>value.state==="pending")!;assert(secondCard);
  const secondAnswer=await acceptNativeConversationAnswer(principal,{intentId:randomUUID(),batchId:secondCard.batchId,responses:[{requestId:"choice-1",optionId:"pear"}]});
  const secondLease=await leaseConversationRequest(principal);if(secondLease.kind!=="leased")throw new Error("Missing second lease");
  const secondDispatch=await prepareNativeContinuation(principal,secondLease.requestId,secondLease.leaseToken);assert(secondDispatch);
  assert.equal(secondDispatch.originRequestId,accepted.requestId);assert.equal(secondDispatch.originLease,lease.leaseToken);
  const secondExecution={requestId:secondAnswer.requestId,leaseToken:secondLease.leaseToken,sessionId:execution.sessionId,turnId:"turn_2",sequence:2};
  await claimNativeContinuation(principal,secondExecution);
  await authorizeConversationRequest(principal,{...secondExecution,phase:"execute"});
  const newerContext={...replayContext,auth:{...replayAuth,attributes:{...replayAuth.attributes,
    conversationRequestId:secondAnswer.requestId,conversationRequestLease:secondLease.leaseToken}}};
  assert.equal(await deliverNativeConversationInput(replayPayload,newerContext),undefined);
  await assert.rejects(deliverNativeConversationInput(replayPayload,{...newerContext,state:{nativeAnswers:{}}}),/execution/);
  const beforeProxy=await sql`select id,state from public.conversation_requests where execution_session_id=${execution.sessionId} order by id`;
  result=await applyConversationSourceBatch(source,result.nextIndex,[{...native,data:{...native.data,nativeInputSource:'proxy',turnId:'turn_2',sequence:2}}] as unknown as HandleMessageStreamEvent[]);
  assert.deepEqual(await sql`select id,state from public.conversation_requests where execution_session_id=${execution.sessionId} order by id`,beforeProxy);
  result=await applyConversationSourceBatch(source,result.nextIndex,[{...native,data:{...native.data,nativeInputSource:'proxy',nativeInputParent:{turnId:'turn_0',sequence:0},turnId:'turn_2',sequence:2}}] as unknown as HandleMessageStreamEvent[]);
  assert.deepEqual(await sql`select id,state from public.conversation_requests where execution_session_id=${execution.sessionId} order by id`,beforeProxy);
  result=await applyConversationSourceBatch(source,result.nextIndex,[{type:"turn.started",data:{turnId:"turn_2",sequence:2}},
    {type:"message.completed",data:{turnId:"turn_2",sequence:2,stepIndex:0,message:"Done.",finishReason:"stop"}},
    {type:"turn.completed",data:{turnId:"turn_2",sequence:2}}] as HandleMessageStreamEvent[]);
  assert.equal((await sql`select state from public.conversation_requests where id=${secondAnswer.requestId}`)[0].state,"completed");
  result=await applyConversationSourceBatch(source,result.nextIndex,[{...native,data:{...native.data,nativeInputSource:'proxy',nativeInputParent:{turnId:'turn_2',sequence:2},turnId:'turn_2',sequence:2}}] as unknown as HandleMessageStreamEvent[]);
  assert.equal((await sql`select state from public.conversation_requests where id=${secondAnswer.requestId}`)[0].state,'completed');
  assert.equal((await sql`select id from public.conversation_native_batches where origin_request_id=${secondAnswer.requestId}`).length,0);
  await sql`delete from public.conversation_messages where id=${secondCard.canonicalMessageId}`;
  assert.equal((await sql`select state,payload from public.conversation_native_batches where id=${secondCard.batchId}`)[0].state,"deleted");
  await assert.rejects(acceptNativeConversationAnswer(principal,{intentId:randomUUID(),batchId:secondCard.batchId,responses:[{requestId:"choice-1",optionId:"pear"}]}));
  const late=await applyConversationSourceBatch(source,result.nextIndex,[{type:"message.completed",data:{turnId:"turn_2",sequence:2,stepIndex:1,
    message:"Private content after erasure",finishReason:"stop"}}] as HandleMessageStreamEvent[]);
  assert.equal(late.nextIndex,result.nextIndex+1);
  assert.equal((await sql`select content from public.conversation_messages where session_id=${execution.sessionId} and turn_id='turn_2' and role='assistant'`)[0].content,"Done.");
  await sql`delete from public.conversation_messages where id=${accepted.messageId}`;
  assert.equal((await sql`select id from public.conversation_messages where id=${card.canonicalMessageId}`).length,0);
  await assert.rejects(deliverNativeConversationInput(replayPayload,replayContext));
  assert.equal((await sql`select public.conversation_native_ancestry_live(${secondAnswer.requestId},${principal.conversationId},${principal.accessEpoch}) as allowed`)[0].allowed,false);
  assert.equal((await sql`select state from public.conversation_native_batches where id=${secondCard.batchId}`)[0].state,"deleted");

  const oauth=await acceptConversationRequest(principal,{intentId:randomUUID(),text:"Connect my calendar"});
  const oauthLease=await leaseConversationRequest(principal);if(oauthLease.kind!=="leased")throw new Error("Missing OAuth lease");
  const oauthExecution={requestId:oauth.requestId,leaseToken:oauthLease.leaseToken,sessionId:`oauth-${randomUUID()}`,turnId:"turn_0",sequence:0};
  await claimConversationExecution(principal,oauthExecution,"Connect my calendar");
  const oauthSource=(await leaseConversationSources()).find(value=>value.sessionId===oauthExecution.sessionId)!;assert(oauthSource);
  let oauthResult=await applyConversationSourceBatch(oauthSource,0,[{type:"authorization.required",data:{name:"google",description:"Connect",turnId:"turn_0",sequence:0,stepIndex:0}}] as HandleMessageStreamEvent[]);
  oauthResult=await applyConversationSourceBatch(oauthSource,oauthResult.nextIndex,[{type:"authorization.completed",data:{name:"google",outcome:"authorized",turnId:"turn_0",sequence:0,stepIndex:0}}] as HandleMessageStreamEvent[]);
  assert.equal((await sql`select pending_input from public.conversation_sources where session_id=${oauthExecution.sessionId}`)[0].pending_input,true);
  assert.equal((await sql`select state from public.conversation_requests where id=${oauth.requestId}`)[0].state,"executing");
  await applyConversationSourceBatch(oauthSource,oauthResult.nextIndex,[{type:"step.started",data:{turnId:"turn_0",sequence:0,stepIndex:1}},
    {type:"message.completed",data:{turnId:"turn_0",sequence:0,stepIndex:1,message:"Calendar connection checked.",finishReason:"stop"}},
    {type:"turn.completed",data:{turnId:"turn_0",sequence:0}}] as HandleMessageStreamEvent[]);
  assert.equal((await sql`select pending_input from public.conversation_sources where session_id=${oauthExecution.sessionId}`)[0].pending_input,false);
  assert.equal((await sql`select state from public.conversation_requests where id=${oauth.requestId}`)[0].state,"completed");
  assert.equal((await sql`select state from public.conversation_native_batches where id=${card.batchId}`)[0].state,"deleted");
  const child=await acceptConversationRequest(principal,{intentId:randomUUID(),text:"Ask a helper"});
  const childLease=await leaseConversationRequest(principal);if(childLease.kind!=="leased")throw new Error("Missing proxy fixture lease");
  const childExecution={requestId:child.requestId,leaseToken:childLease.leaseToken,sessionId:`proxy-${randomUUID()}`,turnId:'turn_0',sequence:0};
  await claimConversationExecution(principal,childExecution,"Ask a helper");
  const childSource=(await leaseConversationSources()).find(value=>value.sessionId===childExecution.sessionId)!;assert(childSource);
  const proxyResult=await applyConversationSourceBatch(childSource,0,[{...native,data:{...native.data,nativeInputSource:'proxy',nativeInputParent:{turnId:'turn_0',sequence:0},turnId:'child_turn_9',sequence:9}},
    {type:'turn.completed',data:{turnId:'turn_0',sequence:0}}] as unknown as HandleMessageStreamEvent[]);
  assert.equal(proxyResult.nextIndex,2);
  assert.equal((await sql`select state from public.conversation_requests where id=${child.requestId}`)[0].state,'failed');
  assert.equal((await sql`select id from public.conversation_native_batches where origin_request_id=${child.requestId}`).length,0);
  assert.equal((await readConversationFeed(principal)).messages.some(value=>value.sessionId===childExecution.sessionId&&value.nativeInput),false);
  const laterRoot=await acceptConversationRequest(principal,{intentId:randomUUID(),text:"Choose first, then ask a helper"});
  const laterRootLease=await leaseConversationRequest(principal);if(laterRootLease.kind!=="leased")throw new Error("Missing later proxy root lease");
  const laterSession=`later-proxy-${randomUUID()}`;
  await claimConversationExecution(principal,{requestId:laterRoot.requestId,leaseToken:laterRootLease.leaseToken,sessionId:laterSession,turnId:'turn_0',sequence:0},"Choose first, then ask a helper");
  const laterSource=(await leaseConversationSources()).find(value=>value.sessionId===laterSession)!;assert(laterSource);
  let laterResult=await applyConversationSourceBatch(laterSource,0,[native,{type:'turn.completed',data:{turnId:'turn_0',sequence:0}}] as unknown as HandleMessageStreamEvent[]);
  const [laterBatch]=await sql`select id from public.conversation_native_batches where origin_request_id=${laterRoot.requestId}`;
  const laterAnswer=await acceptNativeConversationAnswer(principal,{intentId:randomUUID(),batchId:laterBatch.id,responses:[{requestId:'choice-1',optionId:'apple'}]});
  const laterLease=await leaseConversationRequest(principal);if(laterLease.kind!=="leased")throw new Error("Missing later proxy answer lease");
  await prepareNativeContinuation(principal,laterAnswer.requestId,laterLease.leaseToken);
  await claimNativeContinuation(principal,{requestId:laterAnswer.requestId,leaseToken:laterLease.leaseToken,sessionId:laterSession,turnId:'turn_1',sequence:1});
  const [rootBefore]=await sql`select state from public.conversation_requests where id=${laterRoot.requestId}`;
  laterResult=await applyConversationSourceBatch(laterSource,laterResult.nextIndex,[{...native,data:{...native.data,nativeInputSource:'proxy',
    nativeInputParent:{turnId:'turn_1',sequence:1},turnId:'child_turn_9',sequence:9}}] as unknown as HandleMessageStreamEvent[]);
  assert.equal(laterResult.nextIndex,3);
  assert.equal((await sql`select state from public.conversation_requests where id=${laterAnswer.requestId}`)[0].state,'failed');
  assert.equal((await sql`select state from public.conversation_requests where id=${laterRoot.requestId}`)[0].state,rootBefore.state);
  assert.equal((await sql`select id from public.conversation_native_batches where origin_request_id=${laterAnswer.requestId}`).length,0);
  for(const table of ["conversation_native_batches","conversation_native_authorizations"]){
    await assert.rejects(sql.begin(async tx=>{await tx`set local role authenticated`;await tx.unsafe(`select * from public.${table}`);}),/permission denied/);
  }
  console.log("PASS native batch durable source, sanitized choices, adult isolation, atomic answer retry, immutable per-turn continuation, ambiguous dispatch fence, source projection and erasure");
}finally{await sql.end({timeout:5});}
