import { randomUUID } from "node:crypto";
import type { HandleMessageStreamEvent } from "eve/client";

import { recordNativeBatchInTransaction } from "./conversation-native-batches";
import { projectRecordedConversationText, type RecordedTextRevision } from "./conversation-source-projection";
import { loadConversationRuntimeInputInTransaction } from "./conversation-attachments";
import { mapDb } from "./map/db";
import { parseConversationQuestionResult } from "./conversation-question-card";
import { recordConversationContentInTransaction, type ConversationContentEvent } from "./conversation-recording";
import { recordConversationQuestionInTransaction, requestTransaction } from "./conversation-requests";

export interface ConversationSourceLease {
  sessionId: string; requestId: string; conversationId: string;
  familyId: string; memberUserId: string; accessEpoch: string;
  leaseToken: string; nextIndex: number;
}

/** Discovery is server-owned and repairs a missing source registration after an
 * older claim. Neither a browser nor a model selects a runtime to consume. */
export async function leaseConversationSources(limit = 4): Promise<ConversationSourceLease[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 16) throw new Error("Invalid source limit");
  return requestTransaction(async tx => {
    await tx`insert into public.conversation_sources(session_id,conversation_id,request_id,access_epoch)
      select r.execution_session_id,r.conversation_id,r.id,r.access_epoch from public.conversation_requests r
      join public.conversation_records c on c.id=r.conversation_id
      join public.family_members fm on fm.family_id=c.family_id and fm.user_id=c.member_user_id
      join public.families f on f.id=c.family_id
      where r.execution_session_id is not null and r.access_epoch=c.access_epoch and f.status <> 'deleted'
        and r.state <> 'deleted' and r.native_batch_id is null on conflict do nothing`;
    const rows = await tx<{ session_id: string; request_id: string; conversation_id: string; access_epoch: string;
      family_id: string; member_user_id: string; next_source_index: string }[]>`
      select s.*,c.family_id,c.member_user_id from public.conversation_sources s
      join public.conversation_requests r on r.id=s.request_id
      join public.conversation_records c on c.id=s.conversation_id
      join public.family_members fm on fm.family_id=c.family_id and fm.user_id=c.member_user_id
      join public.families f on f.id=c.family_id
      where s.state='active' and r.state <> 'deleted' and s.access_epoch=c.access_epoch and f.status <> 'deleted'
        and (s.lease_until is null or s.lease_until <= clock_timestamp())
      order by s.updated_at,s.session_id limit ${limit} for update of s skip locked`;
    const leased: ConversationSourceLease[] = [];
    for (const row of rows) {
      const token = randomUUID(), nextIndex = Number(row.next_source_index);
      if (!Number.isSafeInteger(nextIndex)) throw new Error("Source cursor out of range");
      await tx`update public.conversation_sources set lease_token=${token},lease_until=clock_timestamp()+interval '45 seconds',
        updated_at=clock_timestamp() where session_id=${row.session_id}`;
      leased.push({ sessionId: row.session_id, requestId: row.request_id, conversationId: row.conversation_id,
        accessEpoch: row.access_epoch, familyId: row.family_id, memberUserId: row.member_user_id, leaseToken: token, nextIndex });
    }
    return leased;
  });
}

/** Content, readable projection, observed ending and source bookmark commit as
 * one unit. Filtered private events still advance the source bookmark. */
export async function applyConversationSourceBatch(source: ConversationSourceLease, startIndex: number,
  events: readonly HandleMessageStreamEvent[]) {
  if (!Number.isSafeInteger(startIndex) || startIndex < 0 || events.length > 64) throw new Error("Invalid source batch");
  return requestTransaction(async tx => {
    const members = await tx`select fm.user_id from public.family_members fm join public.families f on f.id=fm.family_id
      where fm.family_id=${source.familyId} and fm.user_id=${source.memberUserId} and f.status <> 'deleted' for key share of fm,f`;
    if (!members.length) throw new Error("Source access revoked");
    const [record] = await tx<{ id: string; access_epoch: string; next_position: string }[]>`select id,access_epoch,next_position
      from public.conversation_records where id=${source.conversationId} and family_id=${source.familyId}
      and member_user_id=${source.memberUserId} for update`;
    if (!record || record.access_epoch !== source.accessEpoch) throw new Error("Source access changed");
    const [lease] = await tx<{ next_source_index: string; pending_input: boolean }[]>`select next_source_index,pending_input
      from public.conversation_sources where session_id=${source.sessionId} and request_id=${source.requestId}
      and conversation_id=${record.id} and state='active' and lease_token=${source.leaseToken}
      and lease_until > clock_timestamp() for update`;
    if (!lease || Number(lease.next_source_index) !== startIndex) throw new Error("Source lease or cursor changed");
    const requests = await tx<{ id: string; state: string; execution_turn_id: string; execution_sequence: number;
      lease_token: string | null; episode_id: string; canonical_message_id: string | null; ancestry_live:boolean }[]>`
      select id,state,execution_turn_id,execution_sequence,lease_token,episode_id,canonical_message_id,
        public.conversation_native_ancestry_live(id,conversation_id,access_epoch) as ancestry_live from public.conversation_requests
      where conversation_id=${record.id} and execution_session_id=${source.sessionId} and access_epoch=${source.accessEpoch} for update`;
    if (!requests.some(request=>request.id===source.requestId)) throw new Error("Source execution missing");
    const endings=new Map<string,{completed:boolean;failed:boolean}>();
    const touched=new Set<string>();
    let sourceDone=false;
    let messageId:string|null=null;
    for (const [offset, event] of events.entries()) {
      const data=("data" in event ? event.data : {}) as {turnId?:string;sequence?:number};
      const proxiedInput=event.type==='input.requested' && (event.data as {nativeInputSource?:unknown}).nativeInputSource==='proxy';
      if(proxiedInput) {
        // Only parent emission coordinates identify the owning root turn.
        // Older proxy events have child coordinates alone and are ignored. A
        // delayed event must never regress a completed or continued request.
        const parent=(event.data as {nativeInputParent?:unknown}).nativeInputParent;
        if(parent && typeof parent==='object' && !Array.isArray(parent)) {
          const coordinates=parent as {turnId?:unknown;sequence?:unknown};
          const origin=typeof coordinates.turnId==='string' && coordinates.turnId.length>0 &&
            Number.isSafeInteger(coordinates.sequence) && Number(coordinates.sequence)>=0
            ? requests.find(value=>value.execution_turn_id===coordinates.turnId && value.execution_sequence===coordinates.sequence) : undefined;
          if(origin && ['executing','recovery_required'].includes(origin.state) && origin.ancestry_live) {
            await tx`update public.conversation_requests set state='failed',updated_at=clock_timestamp()
              where id=${origin.id} and state in('executing','recovery_required')`;
            origin.state='failed';
          }
        }
        continue;
      }
      const request=data.turnId===undefined ? undefined : requests.find(value=>value.execution_turn_id===data.turnId &&
        (data.sequence===undefined || value.execution_sequence===data.sequence));
      if (data.turnId!==undefined && !request) throw new Error("Unclaimed source continuation");
      if (!request) {
        if (event.type==="session.completed") sourceDone=true;
        else if(event.type==="session.failed") {
          sourceDone=true;
          for(const value of requests) endings.set(value.id,{completed:false,failed:true});
        }
        continue;
      }
      if(!request.ancestry_live)continue;
      touched.add(request.id);
      const ending=endings.get(request.id)??{completed:false,failed:false};
      endings.set(request.id,ending);
      if (event.type === "message.received" || event.type === "message.appended" || event.type === "message.completed") {
        if (event.data.turnId !== request.execution_turn_id || event.data.sequence !== request.execution_sequence) throw new Error("Unexpected source turn");
        // An erased accepted input erases the request's subsequent content too.
        if (event.type === "message.received" && request.state !== "deleted") {
          // The raw runtime summary can contain extracted file contents. Its
          // deletion must not make replay restore those contents or stall the cursor.
          const erasedFiles = await tx`select 1 from public.conversation_request_attachments
            where request_id=${request.id} and attachment_id is null limit 1`;
          if (erasedFiles.length) continue;
          const [accepted] = await tx<{ content: string }[]>`select content from public.conversation_messages
            where id=${request.canonical_message_id} and family_id=${source.familyId} and member_user_id=${source.memberUserId}`;
          if (!accepted) throw new Error("Source accepted message missing");
          const runtime = await loadConversationRuntimeInputInTransaction(tx, source, request.id, accepted.content);
          if (runtime.summary !== event.data.message) throw new Error("Source input differs from accepted message");
        }
        if (request.state !== "deleted") await recordConversationContentInTransaction(tx, source, source.sessionId,
          event as ConversationContentEvent, startIndex + offset, true);
      } else if (event.type === "action.result" && request.state !== "deleted") {
        const card = parseConversationQuestionResult(event);
        if (card) {
          const tombstone = await tx`select id from public.conversation_question_cards where request_id=${request.id}
            and call_id=${card.callId} and source_sequence=${card.sourceSequence} and state='deleted'`;
          if (!tombstone.length) await recordConversationQuestionInTransaction(tx, source, {
            requestId: request.id, leaseToken: request.lease_token!, sessionId: source.sessionId,
            turnId: event.data.turnId,
          }, card);
        }
      } else if (event.type === "input.requested" && !["deleted","failed","revoked"].includes(request.state)) {
        await recordNativeBatchInTransaction(tx,source,request.id,source.sessionId,startIndex+offset,event);
      } else if(event.type==="authorization.required" && request.state!=="deleted") {
        await tx`insert into public.conversation_native_authorizations(request_id,name,turn_id,sequence,step_index,state)
          values(${request.id},${event.data.name},${event.data.turnId},${event.data.sequence},${event.data.stepIndex},'pending') on conflict do nothing`;
      } else if(event.type==="authorization.completed") {
        await tx`update public.conversation_native_authorizations set state=${event.data.outcome==='authorized'?'callback_received':'resolved'}
          where request_id=${request.id} and name=${event.data.name} and turn_id=${event.data.turnId}
            and sequence=${event.data.sequence} and step_index=${event.data.stepIndex} and state='pending'`;
      } else if(event.type==="step.started") {
        await tx`update public.conversation_native_authorizations set state='resolved'
          where request_id=${request.id} and turn_id=${event.data.turnId} and sequence=${event.data.sequence} and state='callback_received'`;
      }
      else if (event.type === "turn.completed") {
        if (event.data.turnId !== request.execution_turn_id) throw new Error("Unexpected completed turn");
        ending.completed = true;
      } else if (event.type === "turn.failed") {
        if (event.data.turnId !== request.execution_turn_id) throw new Error("Unexpected failed turn");
        ending.failed = true;
      }

    }
    for(const request of requests) {
    if(!request.ancestry_live || (!touched.has(request.id) && !endings.has(request.id))) continue;
    const {completed,failed}=endings.get(request.id)??{completed:false,failed:false};
    const unresolved=await tx`select 1 from public.conversation_native_batches where origin_request_id=${request.id} and state='pending'
      union all select 1 from public.conversation_native_authorizations where request_id=${request.id} and state<>'resolved'`;
    const pending=unresolved.length>0;
    const nativeBatches=await tx<{state:string}[]>`select state from public.conversation_native_batches where origin_request_id=${request.id} and state<>'deleted'`;
    const revisions = await tx<(RecordedTextRevision & { position: string })[]>`
      select event_kind,content,content_offset,snapshot_present,content_snapshot_hash,position from public.conversation_record_events
      where conversation_id=${record.id} and source_session_id=${source.sessionId}
        and turn_id=${request.execution_turn_id} and message_sequence=${request.execution_sequence} and role='assistant'
      order by position`;
    const text = projectRecordedConversationText(revisions);
    let currentMessageId: string | null = null;
    if (revisions.length && request.state !== "deleted") {
      const [message] = await tx<{ id: string; member_user_id: string | null }[]>`insert into public.conversation_messages
        (family_id,member_user_id,session_id,turn_id,sequence,channel,role,content,episode_id,visibility,modality,recording_position)
        values (${source.familyId},${source.memberUserId},${source.sessionId},${request.execution_turn_id},${request.execution_sequence},
          'web','assistant',${text},${request.episode_id},'family','text',${revisions.at(-1)!.position})
        on conflict (session_id,(coalesce(turn_id,'')),role,sequence) do update
          set content=excluded.content,recording_position=excluded.recording_position
        returning id,member_user_id`;
      if (message.member_user_id !== source.memberUserId) throw new Error("Source projection lost ownership");
      currentMessageId = message.id;
      messageId=message.id;
      await tx`update public.conversation_record_events set canonical_message_id=${currentMessageId}
        where conversation_id=${record.id} and source_session_id=${source.sessionId}
          and turn_id=${request.execution_turn_id} and message_sequence=${request.execution_sequence} and role='assistant'`;
    }
    if (!['completed','failed','deleted','awaiting_parent','continued'].includes(request.state)) {
      if(completed && nativeBatches.length) {
        await tx`update public.conversation_requests set state=${nativeBatches.some(value=>value.state==='pending')?'awaiting_parent':'continued'},updated_at=clock_timestamp() where id=${request.id}`;
      } else if(completed && pending) {
        await tx`update public.conversation_requests set state='awaiting_parent',updated_at=clock_timestamp() where id=${request.id}`;
      } else if (completed && !pending) {
        const cards = await tx<{ state: string }[]>`select state from public.conversation_question_cards where request_id=${request.id}`;
        const queued = await tx`select id from public.conversation_requests where conversation_id=${record.id}
          and access_epoch=${source.accessEpoch} and state in ('queued','leased') limit 1`;
        const continued = queued.length > 0 || cards.every(card => card.state === 'deleted');
        const erased = await tx`select 1 from public.conversation_record_deletions where conversation_id=${record.id}
          and source_session_id=${source.sessionId} and turn_id=${request.execution_turn_id}
          and message_sequence=${request.execution_sequence} and role='assistant'`;
        const state = cards.length ? (continued ? 'continued' : 'awaiting_parent') : (currentMessageId ? 'completed' : erased.length ? 'continued' : 'recovery_required');
        await tx`update public.conversation_requests set state=${state},updated_at=clock_timestamp() where id=${request.id}`;
        await tx`update public.conversation_question_cards set state=${continued ? 'continued' : 'ready'}
          where request_id=${request.id} and state='recorded'`;
      } else if (failed) await tx`update public.conversation_requests set state='recovery_required',updated_at=clock_timestamp()
        where id=${request.id}`;
    }
    }
    const pendingRows=await tx`select 1 from public.conversation_native_batches where conversation_id=${record.id} and session_id=${source.sessionId} and state='pending'
      union all select 1 from public.conversation_native_authorizations a join public.conversation_requests r on r.id=a.request_id
        where r.conversation_id=${record.id} and r.execution_session_id=${source.sessionId} and a.state<>'resolved'`;
    const pending=pendingRows.length>0;
    const nextIndex = startIndex + events.length;
    await tx`update public.conversation_sources set next_source_index=${nextIndex},pending_input=${pending},
      state=${sourceDone ? 'complete' : 'active'},updated_at=clock_timestamp() where session_id=${source.sessionId}`;
    return { nextIndex, complete: sourceDone, messageId };
  });
}

export async function releaseConversationSource(source: ConversationSourceLease) {
  await mapDb()`update public.conversation_sources set lease_token=null,lease_until=null,updated_at=clock_timestamp()
    where session_id=${source.sessionId} and lease_token=${source.leaseToken} and conversation_id=${source.conversationId}`;
}
