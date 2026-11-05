import { createHash, randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";

import { parseNativePendingInput, validateNativeInputResponses, type NativePendingInput, type NativeInputResponse } from "./conversation-native-input";
import { acceptRequestInTransaction, ConversationRequestError, lockRequestRecord, requestTransaction, validateConversationIntent,
  type ConversationRequestPrincipal, type RequestExecution } from "./conversation-requests";

interface BatchRow { id: string; state: string; payload: NativePendingInput | null; responses: NativeInputResponse[] | null;
  origin_request_id: string; answer_request_id: string | null; session_id: string; access_epoch: string; dispatch_started_at: Date | null; created_at:Date; canonical_message_id:string|null }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;

/** Called only from the authenticated source consumer's transaction. All origin
 * coordinates come from its durable stream, never the answer route. */
export async function recordNativeBatchInTransaction(tx: TransactionSql, principal: ConversationRequestPrincipal,
  requestId: string, sessionId: string, sourceIndex: number, event: unknown) {
  const parsed = parseNativePendingInput(event, randomUUID(), sessionId, sourceIndex);
  if (!parsed) return null;
  const [request] = await tx<{ conversation_id: string; episode_id:string }[]>`select r.conversation_id,r.episode_id from public.conversation_requests r
    join public.conversation_records c on c.id=r.conversation_id
    where r.id=${requestId} and c.family_id=${principal.familyId} and c.member_user_id=${principal.memberUserId}
      and c.access_epoch=${principal.accessEpoch} and r.access_epoch=c.access_epoch and r.canonical_message_id is not null
      and r.execution_session_id=${sessionId} and r.execution_turn_id=${parsed.turnId} and r.execution_sequence=${parsed.sequence}`;
  if (!request) throw new ConversationRequestError("execution");
  parsed.requests = parsed.requests.map(value => ({ ...value, action: { ...value.action, input: {} } }));
  const [existing] = await tx<{ id: string; state: string; payload: NativePendingInput | null }[]>`select id,state,payload from public.conversation_native_batches
    where session_id=${sessionId} and source_index=${sourceIndex} and conversation_id=${request.conversation_id}`;
  if (existing) {
    if (existing.state !== 'deleted' && JSON.stringify({ ...parsed,id:existing.id }) !== JSON.stringify(existing.payload)) throw new ConversationRequestError("conflict");
    return existing.id;
  }
  await tx`insert into public.conversation_native_batches
    (id,conversation_id,origin_request_id,access_epoch,session_id,source_index,turn_id,sequence,step_index,payload)
    values (${parsed.id},${request.conversation_id},${requestId},${principal.accessEpoch},${sessionId},${sourceIndex},
      ${parsed.turnId},${parsed.sequence},${parsed.stepIndex},${tx.json(parsed as unknown as Record<string, never>)})`;
  const [message]=await tx<{id:string;member_user_id:string|null}[]>`insert into public.conversation_messages
    (family_id,member_user_id,session_id,turn_id,sequence,channel,role,content,episode_id,visibility,modality)
    values (${principal.familyId},${principal.memberUserId},${sessionId},${`native-question:${parsed.id}`},${parsed.sequence},
      'web','assistant',${parsed.requests.map(value=>value.prompt).join("\n")},${request.episode_id},'family','text')
    returning id,member_user_id`;
  if(message.member_user_id!==principal.memberUserId)throw new ConversationRequestError("execution");
  await tx`update public.conversation_native_batches set canonical_message_id=${message.id} where id=${parsed.id}`;
  return parsed.id;
}

export async function acceptNativeConversationAnswer(principal: ConversationRequestPrincipal,
  input: { intentId: string; batchId: string; responses: unknown }) {
  if (!uuid.test(input.intentId) || !uuid.test(input.batchId)) throw new ConversationRequestError("invalid");
  return requestTransaction(async tx => {
    const recordId = await lockRequestRecord(tx, principal);
    const [batch] = await tx<BatchRow[]>`select b.* from public.conversation_native_batches b
      join public.conversation_requests origin on origin.id=b.origin_request_id
      where b.id=${input.batchId} and b.conversation_id=${recordId} and b.access_epoch=${principal.accessEpoch}
        and origin.canonical_message_id is not null and origin.access_epoch=${principal.accessEpoch}
        and public.conversation_native_ancestry_live(origin.id,b.conversation_id,${principal.accessEpoch}) for update of b`;
    if (!batch) throw new ConversationRequestError("missing");
    if (batch.state === "deleted" || !batch.payload) throw new ConversationRequestError("deleted");
    let responses: NativeInputResponse[];
    try { responses = validateNativeInputResponses(batch.payload, { batchId: input.batchId, responses: input.responses }); }
    catch { throw new ConversationRequestError("invalid"); }
    const hash = createHash("sha256").update(JSON.stringify({ batchId: input.batchId,responses })).digest("hex");
    const [existing] = await tx<{ id: string; native_batch_id: string | null; submission_hash: string | null; state: string;
      canonical_message_id: string | null; accepted_at: Date }[]>`select * from public.conversation_requests
      where conversation_id=${recordId} and client_intent_id=${input.intentId}`;
    if (existing) {
      if (existing.native_batch_id !== input.batchId || existing.submission_hash !== hash) throw new ConversationRequestError("conflict");
      if (!existing.canonical_message_id || existing.state === "deleted") throw new ConversationRequestError("deleted");
      return { requestId:existing.id,intentId:input.intentId,messageId:existing.canonical_message_id,state:existing.state,
        acceptedAt:existing.accepted_at.toISOString(),replayed:true };
    }
    if (batch.state !== "pending" || batch.answer_request_id) throw new ConversationRequestError("conflict");
    const content = responses.map(response => response.text ?? batch.payload!.requests.find(r=>r.requestId===response.requestId)!
      .options!.find(option=>option.id===response.optionId)!.label).join("\n");
    const accepted = await acceptRequestInTransaction(tx,principal,{intentId:input.intentId,text:content,submissionHash:hash},recordId,
      validateConversationIntent(input.intentId,content));
    await tx`update public.conversation_requests set native_batch_id=${batch.id} where id=${accepted.requestId}`;
    await tx`update public.conversation_native_batches set state='answered',answer_request_id=${accepted.requestId},responses=${tx.json(responses.map(value=>({...value})))}
      where id=${batch.id}`;
    return accepted;
  });
}

/** Dispatch retries reuse the same accepted answer key and original route.
 * Eve checkpoints channel deduplication before a later batch can consume it. */
export async function prepareNativeContinuation(principal: ConversationRequestPrincipal, requestId: string, leaseToken: string) {
  return requestTransaction(async tx => {
    const recordId = await lockRequestRecord(tx,principal);
    const [request] = await tx<{ native_batch_id: string | null; state: string; lease_token: string | null;
      lease_valid: boolean; execution_session_id: string | null }[]>`select *,lease_until > clock_timestamp() as lease_valid
      from public.conversation_requests where id=${requestId} and conversation_id=${recordId} for update`;
    if (!request) throw new ConversationRequestError("missing");
    if (!request.native_batch_id) return null;
    if(process.env.HOMA_CONVERSATION_NATIVE_INPUT!=="1") throw new ConversationRequestError("execution");
    if (request.state !== "leased" || request.lease_token !== leaseToken || !request.lease_valid || request.execution_session_id) throw new ConversationRequestError("lease");
    const [batch] = await tx<(BatchRow & { origin_lease: string; origin_turn: string; dispatch_root_id: string })[]>`select b.*,root.lease_token as origin_lease,
      root.id as dispatch_root_id,origin.execution_turn_id as origin_turn from public.conversation_native_batches b
      join public.conversation_requests origin on origin.id=b.origin_request_id
      join public.conversation_sources source on source.session_id=b.session_id
      join public.conversation_requests root on root.id=source.request_id and root.conversation_id=b.conversation_id
      where b.id=${request.native_batch_id} and b.conversation_id=${recordId} and b.access_epoch=${principal.accessEpoch}
        and origin.canonical_message_id is not null and origin.access_epoch=${principal.accessEpoch}
        and public.conversation_native_ancestry_live(origin.id,b.conversation_id,${principal.accessEpoch})
        and not exists(select 1 from public.conversation_request_attachments a where a.request_id=origin.id and a.attachment_id is null)
      for update of b`;
    if (!batch || batch.state !== "answered" || batch.answer_request_id !== requestId || !batch.payload || !batch.responses) throw new ConversationRequestError("deleted");
    const responses = validateNativeInputResponses(batch.payload,{batchId:batch.id,responses:batch.responses});
    await tx`update public.conversation_native_batches set dispatch_started_at=coalesce(dispatch_started_at,clock_timestamp()) where id=${batch.id}`;
    return { inputResponses:responses,sessionId:batch.session_id,originRequestId:batch.dispatch_root_id,originLease:batch.origin_lease };
  });
}

/** Response-only deliveries have no message.received event. Claim their NEW
 * immutable request identity at turn.started, before hydration or effects. */
export async function claimNativeContinuation(principal: ConversationRequestPrincipal, execution: RequestExecution) {
  if(!uuid.test(execution.requestId)||!uuid.test(execution.leaseToken)||!execution.sessionId||!execution.turnId||
    !Number.isSafeInteger(execution.sequence)||execution.sequence<0)throw new ConversationRequestError("invalid");
  return requestTransaction(async tx => {
    const recordId = await lockRequestRecord(tx,principal);
    const [request] = await tx<{ native_batch_id: string | null; state: string; lease_token: string | null;
      execution_session_id: string | null; execution_turn_id: string | null; execution_sequence: number | null;
      canonical_message_id: string | null; episode_id: string; content: string; submission_hash:string|null }[]>`select r.*,m.content from public.conversation_requests r
      left join public.conversation_messages m on m.id=r.canonical_message_id
      where r.id=${execution.requestId} and r.conversation_id=${recordId} for update of r`;
    if (!request?.native_batch_id) return null;
    if (!request.canonical_message_id || request.lease_token!==execution.leaseToken || !['leased','executing','recovery_required'].includes(request.state)) throw new ConversationRequestError("execution");
    const [batch] = await tx<BatchRow[]>`select b.* from public.conversation_native_batches b
      join public.conversation_requests origin on origin.id=b.origin_request_id
      where b.id=${request.native_batch_id} and b.conversation_id=${recordId} and b.access_epoch=${principal.accessEpoch}
        and origin.canonical_message_id is not null and origin.access_epoch=${principal.accessEpoch}
        and public.conversation_native_ancestry_live(origin.id,b.conversation_id,${principal.accessEpoch})`;
    if (!batch || batch.state!=="answered" || batch.answer_request_id!==execution.requestId || !batch.dispatch_started_at ||
        batch.session_id!==execution.sessionId || !batch.payload || execution.sequence!==batch.payload.sequence+1) throw new ConversationRequestError("execution");
    if(!batch.responses)throw new ConversationRequestError("execution");
    const responses=validateNativeInputResponses(batch.payload,{batchId:batch.id,responses:batch.responses});
    const expectedText=responses.map(response=>response.text??batch.payload!.requests.find(value=>value.requestId===response.requestId)!
      .options!.find(value=>value.id===response.optionId)!.label).join("\n");
    const expectedHash=createHash("sha256").update(JSON.stringify({batchId:batch.id,responses})).digest("hex");
    if(request.content!==expectedText||request.submission_hash!==expectedHash)throw new ConversationRequestError("execution");
    if (request.execution_session_id && (request.execution_session_id!==execution.sessionId || request.execution_turn_id!==execution.turnId ||
        request.execution_sequence!==execution.sequence)) throw new ConversationRequestError("execution");
    await tx`update public.conversation_requests set state='executing',execution_session_id=${execution.sessionId},
      execution_turn_id=${execution.turnId},execution_sequence=${execution.sequence},lease_until=null,updated_at=clock_timestamp()
      where id=${execution.requestId}`;
    await tx`update public.conversation_messages set session_id=${execution.sessionId},turn_id=${execution.turnId},sequence=${execution.sequence}
      where id=${request.canonical_message_id} and family_id=${principal.familyId} and member_user_id=${principal.memberUserId}`;
    return {messageId:request.canonical_message_id,episodeId:request.episode_id,text:request.content};
  });
}

export function nativeBatchCursor(value:string|undefined):{createdAt:string;id:string}|null {
  if(value===undefined)return null;
  try{
    const decoded:unknown=JSON.parse(Buffer.from(value,"base64url").toString("utf8"));
    if(!decoded||typeof decoded!=="object"||Array.isArray(decoded))throw new Error();
    const cursor=decoded as Record<string,unknown>;
    if(Object.keys(cursor).some(key=>!['createdAt','id'].includes(key))||typeof cursor.id!=="string"||!uuid.test(cursor.id)||
      typeof cursor.createdAt!=="string"||new Date(cursor.createdAt).toISOString()!==cursor.createdAt)throw new Error();
    return {id:cursor.id,createdAt:cursor.createdAt};
  }catch{throw new ConversationRequestError("invalid");}
}
export async function readNativeConversationBatchPage(principal: ConversationRequestPrincipal,cursor?:string) {
  const before=nativeBatchCursor(cursor);
  return requestTransaction(async tx=>{
    const recordId=await lockRequestRecord(tx,principal);
    const rows=await tx<BatchRow[]>`select b.* from public.conversation_native_batches b
      join public.conversation_requests origin on origin.id=b.origin_request_id
      where b.conversation_id=${recordId} and b.access_epoch=${principal.accessEpoch} and b.state<>'deleted'
        and origin.canonical_message_id is not null and origin.access_epoch=${principal.accessEpoch}
        and public.conversation_native_ancestry_live(origin.id,b.conversation_id,${principal.accessEpoch})
        and (${before?.createdAt??null}::timestamptz is null or (b.created_at,b.id)<(${before?.createdAt??null}::timestamptz,${before?.id??null}::uuid))
      order by b.created_at desc,b.id desc limit 101`;
    const page=rows.slice(0,100);
    const batches=page.flatMap(batch=>batch.payload?[{batchId:batch.id,state:batch.state as "pending"|"answered",
      canonicalMessageId:batch.canonical_message_id,answerRequestId:batch.answer_request_id,responses:batch.responses,createdAt:batch.created_at.toISOString(),
      requests:batch.payload.requests.map(({requestId,prompt,display,allowFreeform,options})=>({requestId,prompt,display,allowFreeform,options}))}]:[]);
    const last=page.at(-1);
    const nextCursor=rows.length>100&&last?Buffer.from(JSON.stringify({createdAt:last.created_at.toISOString(),id:last.id})).toString("base64url"):null;
    return {batches,nextCursor};
  });
}
export async function readNativeConversationBatches(principal: ConversationRequestPrincipal) {
  return (await readNativeConversationBatchPage(principal)).batches;
}
