import { createHash } from "node:crypto";

import type { SendPayload } from "eve/channels";

import { conversationRequestEnvelope } from "./conversation-request-admission";
import { validateNativeInputResponses, type NativePendingInput } from "./conversation-native-input";
import { ConversationRequestError, lockRequestRecord, requestTransaction, type ConversationRequestPrincipal } from "./conversation-requests";

export interface NativeDeliveryState { nativeAnswers: Record<string,string> }
interface DeliveryIdentity extends ConversationRequestPrincipal { requestId:string;leaseToken:string }
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;

/** Read-only admission precedes even a duplicate drop. Losing access or deleting
 * a card must not leave a cached channel key as an alternative authority. */
export async function validateStoredNativeDelivery(identity:DeliveryIdentity,sessionId:string,key:string,responses:unknown) {
  if(!uuid.test(key)||!uuid.test(identity.requestId)||!uuid.test(identity.leaseToken)||!sessionId)throw new ConversationRequestError("invalid");
  return requestTransaction(async tx=>{
    const recordId=await lockRequestRecord(tx,identity);
    const [auth]=await tx`select r.id from public.conversation_requests r
      join public.conversation_native_batches b on b.id=r.native_batch_id
      where r.id=${identity.requestId} and r.conversation_id=${recordId} and r.access_epoch=${identity.accessEpoch}
        and r.lease_token=${identity.leaseToken} and r.canonical_message_id is not null
        and r.state not in('deleted','revoked') and b.session_id=${sessionId}
        and public.conversation_native_ancestry_live(r.id,r.conversation_id,${identity.accessEpoch})`;
    if(!auth)throw new ConversationRequestError("execution");
    const [row]=await tx<{id:string;payload:NativePendingInput;responses:unknown;submission_hash:string;content:string;
      lease_token:string|null;execution_session_id:string|null;lease_valid:boolean;state:string}[]>`
      select b.id,b.payload,b.responses,r.submission_hash,m.content,r.lease_token,r.execution_session_id,r.state,
        r.lease_until>clock_timestamp() as lease_valid
      from public.conversation_requests r join public.conversation_native_batches b on b.id=r.native_batch_id
      join public.conversation_messages m on m.id=r.canonical_message_id
      where r.id=${key} and r.conversation_id=${recordId} and r.access_epoch=${identity.accessEpoch}
        and b.conversation_id=${recordId} and b.access_epoch=${identity.accessEpoch} and b.answer_request_id=r.id
        and b.state='answered' and b.payload is not null and b.responses is not null and b.canonical_message_id is not null
        and b.session_id=${sessionId} and b.dispatch_started_at is not null and r.state not in('deleted','revoked')
        and public.conversation_native_ancestry_live(r.id,r.conversation_id,${identity.accessEpoch})`;
    if(!row)throw new ConversationRequestError("execution");
    let normalized,stored;
    try {normalized=validateNativeInputResponses(row.payload,{batchId:row.id,responses});
      stored=validateNativeInputResponses(row.payload,{batchId:row.id,responses:row.responses});}
    catch {throw new ConversationRequestError("invalid");}
    const submissionHash=createHash("sha256").update(JSON.stringify({batchId:row.id,responses:normalized})).digest("hex");
    const expectedText=normalized.map(response=>response.text??row.payload.requests.find(value=>value.requestId===response.requestId)!
      .options!.find(value=>value.id===response.optionId)!.label).join("\n");
    if(submissionHash!==row.submission_hash||JSON.stringify(normalized)!==JSON.stringify(stored)||expectedText!==row.content)
      throw new ConversationRequestError("conflict");
    const canConsume=key===identity.requestId && row.lease_token===identity.leaseToken &&
      ((row.state==='leased'&&!row.execution_session_id&&row.lease_valid)||
        (['executing','recovery_required'].includes(row.state)&&row.execution_session_id===sessionId));
    return {digest:createHash("sha256").update(JSON.stringify({conversationId:recordId,accessEpoch:identity.accessEpoch,
      sessionId,key,batchId:row.id,submissionHash})).digest("hex"),responses:normalized,canConsume};
  });
}

/** The runtime checkpoints this map together with its consumed pending batch.
 * Keep every key for the session lifetime, including answered historical cards.
 * This runs before Eve's pending-input resolver, not as an event callback. */
export async function deliverNativeConversationInput(payload:SendPayload,context:{state:NativeDeliveryState;sessionId:string;
  auth:Parameters<typeof conversationRequestEnvelope>[0]},validate:typeof validateStoredNativeDelivery=validateStoredNativeDelivery) {
  if(payload.idempotencyKey===undefined&&payload.inputResponses===undefined)return payload;
  if(typeof payload.idempotencyKey!=="string"||!uuid.test(payload.idempotencyKey)||!Array.isArray(payload.inputResponses)||
    !payload.inputResponses.length||Object.keys(payload).some(key=>!['idempotencyKey','inputResponses'].includes(key)&&payload[key as keyof SendPayload]!==undefined))
    throw new ConversationRequestError("invalid");
  const identity=conversationRequestEnvelope(context.auth);
  if(!identity)throw new ConversationRequestError("execution");
  const admitted=await validate(identity,context.sessionId,payload.idempotencyKey,payload.inputResponses);
  const seen=context.state.nativeAnswers??{};
  const prior=seen[payload.idempotencyKey];
  if(prior!==undefined){if(prior!==admitted.digest)throw new ConversationRequestError("conflict");return undefined;}
  if(!admitted.canConsume)throw new ConversationRequestError("execution");
  seen[payload.idempotencyKey]=admitted.digest;
  context.state.nativeAnswers=seen;
  return {inputResponses:admitted.responses};
}
