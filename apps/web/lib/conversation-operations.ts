import { createHash } from "node:crypto";
import type { ToolContext } from "eve/tools";

import { conversationRequestEnvelope } from "./conversation-request-admission";
import { conversationJobEnvelope } from "./conversation-jobs";
import { ConversationRequestError, requestTransaction } from "./conversation-requests";
import { mapDb, type DbJson } from "./map/db";

export class ConversationOperationUnknown extends Error {
  constructor() {
    super("An earlier action has an unconfirmed outcome. Do not repeat it or claim it failed. Read its existing domain receipt to reconcile it first.");
    this.name = "ConversationOperationUnknown";
  }
}

/** Same JSON domain as authored tool outputs. Reject lossy serialization before
 * writing a replay receipt, including nonfinite numbers and hidden toJSON work. */
export function operationJson(value: unknown): DbJson {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index)) throw new Error("Action result is not lossless JSON");
    }
    return value.map(operationJson);
  }
  if (typeof value === "object" && value && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, operationJson((value as Record<string, unknown>)[key])]));
  }
  throw new Error("Action result is not lossless JSON");
}

export interface PreparedConversationOperation {
  id: string; requestId: string; conversationId: string; epoch: string;
  replayed: boolean; result: unknown;
}

/** Called inside the bounded authorization phase, before ANY effect body.
 * No late authorization promise can start work after its caller timed out. */
export async function prepareConversationOperation(ctx: ToolContext, input: unknown, deadlineMs: number): Promise<PreparedConversationOperation> {
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0) throw new ConversationRequestError("invalid");
  // Capture before acquiring a connection/lock. Extending this at INSERT time
  // would admit another effect after the outer tool wait had already expired.
  const deadlineAt = new Date(Date.now() + deadlineMs);
  if (!Number.isFinite(deadlineAt.getTime())) throw new ConversationRequestError("invalid");
  const job = conversationJobEnvelope(ctx.session.auth.current);
  const envelope = job ? { ...job, requestId: "", attributes: job.attributes } : conversationRequestEnvelope(ctx.session.auth.current);
  const execution = ctx.toolExecution;
  if (!envelope || !execution?.callId || !execution.name) throw new ConversationRequestError("execution");
  const rootSession = ctx.session.parent?.rootSessionId ?? ctx.session.id;
  const rootTurn = ctx.session.parent ? envelope.attributes.conversationExecutionTurnId : ctx.session.turn.id;
  const hash = createHash("sha256").update(JSON.stringify(operationJson(input))).digest("hex");
  return requestTransaction(async tx => {
    // Match request admission's lock order. The operations insert takes FK
    // locks on both rows, so starting with the request can deadlock a source
    // writer that already holds the adult record. Erasure has an unavoidable
    // inverse message lock; retry only this effect-free transaction in full.
    const members = await tx`select m.user_id from public.family_members m
      join public.families f on f.id=m.family_id
      where m.family_id=${envelope.familyId} and m.user_id=${envelope.memberUserId}
        and f.status<>'deleted' for key share of m,f`;
    if (!members.length) throw new ConversationRequestError("execution");
    const records = await tx`select id from public.conversation_records
      where family_id=${envelope.familyId} and member_user_id=${envelope.memberUserId}
        and access_epoch=${envelope.accessEpoch} for update`;
    if (!records.length) throw new ConversationRequestError("execution");
    const [request] = job ? await tx<{id:string;conversation_id:string}[]>`select r.id,r.conversation_id
      from public.conversation_jobs j join public.conversation_requests r on r.id=j.request_id
      join public.conversation_records c on c.id=j.conversation_id join public.agent_jobs domain on domain.id=j.job_id
      where j.job_id=${job.jobId} and c.family_id=${job.familyId} and c.member_user_id=${job.memberUserId}
        and j.access_epoch=${job.accessEpoch} and c.access_epoch=j.access_epoch and j.lease_token=${job.leaseToken}
        and j.state='executing' and domain.status in ('queued','running') and r.canonical_message_id is not null
        and j.execution_session_id=${ctx.session.id} and j.execution_turn_id=${ctx.session.turn.id}
        and j.execution_sequence=${ctx.session.turn.sequence} and ${!ctx.session.parent}
        and not exists(select 1 from public.conversation_request_attachments a where a.request_id=r.id and a.attachment_id is null)
      for update of r`
      : await tx<{ id: string; conversation_id: string }[]>`select r.id,r.conversation_id
      from public.conversation_requests r join public.conversation_records c on c.id=r.conversation_id
      join public.family_members m on m.family_id=c.family_id and m.user_id=c.member_user_id
      join public.families f on f.id=c.family_id
      where r.id=${envelope.requestId} and c.family_id=${envelope.familyId} and c.member_user_id=${envelope.memberUserId}
        and c.access_epoch=${envelope.accessEpoch} and r.access_epoch=c.access_epoch and f.status<>'deleted'
        and r.lease_token=${envelope.leaseToken} and r.state='executing' and r.canonical_message_id is not null
        and r.execution_session_id=${rootSession} and r.execution_turn_id=${String(rootTurn)}
        and not exists(select 1 from public.conversation_request_attachments a where a.request_id=r.id and a.attachment_id is null)
        and (r.reply_question_id is null or exists(select 1 from public.conversation_question_cards q where q.id=r.reply_question_id
          and q.conversation_id=r.conversation_id and q.state='answered' and q.answer_request_id=r.id and q.canonical_message_id is not null))
      for update of r`;
    if (!request) throw new ConversationRequestError("execution");
    const [existing] = await tx<{ id: string; request_id: string; conversation_id: string; access_epoch: string;
      tool_name: string; input_hash: string; state: string; result: unknown }[]>`select * from public.conversation_operations
      where session_id=${ctx.session.id} and turn_id=${ctx.session.turn.id} and call_id=${execution.callId}`;
    if (existing) {
      if (existing.request_id !== request.id || existing.conversation_id !== request.conversation_id || existing.access_epoch !== envelope.accessEpoch ||
        existing.tool_name !== execution.name || existing.input_hash !== hash) throw new ConversationRequestError("conflict");
      if (existing.state !== "completed") throw new ConversationOperationUnknown();
      return { id: existing.id, requestId: request.id, conversationId: request.conversation_id, epoch: envelope.accessEpoch, replayed: true, result: existing.result };
    }
    // A new model call ID is not permission to retry an ambiguous earlier write.
    const unresolved = await tx`select id from public.conversation_operations where request_id=${request.id} and (state='unknown' or (state='started' and deadline_at <= clock_timestamp())) limit 1`;
    if (unresolved.length) throw new ConversationOperationUnknown();
    const [created] = await tx<{ id: string }[]>`insert into public.conversation_operations
      (conversation_id,request_id,access_epoch,session_id,turn_id,call_id,tool_name,input_hash,state,deadline_at)
      select ${request.conversation_id},${request.id},${envelope.accessEpoch},${ctx.session.id},${ctx.session.turn.id},${execution.callId},${execution.name},${hash},'started',${deadlineAt.toISOString()}::timestamptz
      where clock_timestamp() < ${deadlineAt.toISOString()}::timestamptz returning id`;
    if (!created) throw new ConversationRequestError("execution");
    return { id: created.id, requestId: request.id, conversationId: request.conversation_id, epoch: envelope.accessEpoch, replayed: false, result: null };
  });
}

/** Receipt commits before returning the result to the model. A late result may
 * settle an unknown operation, but erased content can never be restored. */
export async function executeConversationOperation<T>(operation: PreparedConversationOperation, execute: () => Promise<T> | T): Promise<T> {
  if (operation.replayed) return operation.result as T;
  try {
    const output = await execute();
    const result = operationJson(output === undefined ? null : output);
    const rows = await mapDb()`update public.conversation_operations o set state='completed',result=${mapDb().json(result)}::jsonb,finished_at=clock_timestamp()
      from public.conversation_requests r,public.conversation_records c
      where o.id=${operation.id} and o.request_id=${operation.requestId} and o.conversation_id=${operation.conversationId}
        and r.id=o.request_id and c.id=o.conversation_id and r.canonical_message_id is not null
        and c.access_epoch=${operation.epoch} and r.access_epoch=c.access_epoch and o.state in ('started','unknown')
        and not exists(select 1 from public.conversation_request_attachments a where a.request_id=r.id and a.attachment_id is null)
        and (r.reply_question_id is null or exists(select 1 from public.conversation_question_cards q where q.id=r.reply_question_id
          and q.conversation_id=r.conversation_id and q.state='answered' and q.answer_request_id=r.id and q.canonical_message_id is not null))
      returning o.id`;
    if (!rows.length) throw new ConversationRequestError("execution");
    return output;
  } catch (error) {
    // No error message or model input is stored in this content-free status.
    await mapDb()`update public.conversation_operations set state='unknown',finished_at=clock_timestamp()
      where id=${operation.id} and request_id=${operation.requestId} and state='started'`.catch(() => {});
    throw error;
  }
}
