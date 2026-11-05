import { createHash } from "node:crypto";
import type { TransactionSql } from "postgres";

import { mapDb } from "./map/db";

export type ConversationContentEvent =
  | { type: "message.received"; data: { message: string; sequence: number; turnId: string } }
  | { type: "message.appended"; data: { messageDelta: string; messageSoFar: string; sequence: number; stepIndex: number; turnId: string } }
  | { type: "message.completed"; data: { message: string | null; sequence: number; stepIndex: number; turnId: string; finishReason: string } };

export interface RecordingPrincipal { familyId: string; memberUserId: string }

/** A deployment gate for the additive schema. Never a family/model preference. */
export function conversationRecordingEnabled() {
  return process.env.HOMA_CONVERSATION_RECORDING === "1";
}

/** sourceIndex is the event's absolute position in Eve's durable stream, counted
 * across ALL event types. A hook-local counter, timestamp or text offset cannot
 * supply this identity: Eve can reset text offsets within the same model step.
 * Store only conversation text, not the runtime envelope or hidden reasoning. */
export function recordingContent(event: ConversationContentEvent, sourceIndex: number) {
  if (!Number.isSafeInteger(sourceIndex) || sourceIndex < 0) throw new Error("Invalid recording source index");
  const { sequence, turnId } = event.data;
  if (!Number.isSafeInteger(sequence) || sequence < 0 || !turnId) throw new Error("Invalid recording identity");
  const stepIndex = event.type === "message.received" ? -1 : event.data.stepIndex;
  if (!Number.isSafeInteger(stepIndex) || (event.type !== "message.received" && stepIndex < 0)) throw new Error("Invalid recording step");
  let content: string;
  let offset = 0;
  if (event.type === "message.appended") {
    content = event.data.messageDelta;
    if (!event.data.messageSoFar.endsWith(content)) throw new Error("Invalid recording delta");
    offset = event.data.messageSoFar.length - content.length;
  } else {
    content = event.data.message ?? "";
  }
  return {
    key: String(sourceIndex),
    kind: event.type,
    role: event.type === "message.received" ? "user" as const : "assistant" as const,
    turnId, sequence, stepIndex, offset, content,
    snapshotPresent: event.type !== "message.completed" || event.data.message !== null,
    snapshotHash: event.type === "message.appended" ? createHash("sha256").update(event.data.messageSoFar).digest("hex") : null,
    finishReason: event.type === "message.completed" ? event.data.finishReason : null,
  };
}

/** Eve has already committed the source event to its replayable server stream.
 * This transaction records its permanent content copy. Failure propagates to the
 * consumer; recovery must replay the durable source, not regenerate.
 * Lock the adult record before assigning a position: readers never advance past
 * an earlier uncommitted transaction, as they could with a bare SQL sequence. */
export async function recordConversationContent(
  principal: RecordingPrincipal,
  sessionId: string,
  event: ConversationContentEvent,
  sourceIndex: number,
) {
  return mapDb().begin(tx => recordConversationContentInTransaction(tx, principal, sessionId, event, sourceIndex, false));
}

/** Internal server transaction primitive, also used by the atomic source cursor. */
export async function recordConversationContentInTransaction(tx: TransactionSql, principal: RecordingPrincipal,
  sessionId: string, event: ConversationContentEvent, sourceIndex: number, skipDeleted: boolean) {
  if (!sessionId) throw new Error("Recording requires a source session");
  const value = recordingContent(event, sourceIndex);

    const member = await tx`
      select fm.user_id from public.family_members fm
      join public.families f on f.id = fm.family_id
      where fm.family_id = ${principal.familyId} and fm.user_id = ${principal.memberUserId}
        and f.status <> 'deleted'
      for key share of fm, f
    `;
    if (!member.length) throw new Error("Conversation membership unavailable");
    await tx`
      insert into public.conversation_records(family_id, member_user_id)
      values (${principal.familyId}, ${principal.memberUserId})
      on conflict (family_id, member_user_id) do nothing
    `;
    const [record] = await tx<{ id: string }[]>`
      select id from public.conversation_records
      where family_id = ${principal.familyId} and member_user_id = ${principal.memberUserId}
      for update
    `;
    const deleted = await tx`
      select 1 from public.conversation_record_deletions
      where conversation_id = ${record.id} and source_session_id = ${sessionId}
        and turn_id = ${value.turnId} and message_sequence = ${value.sequence}
        and role = ${value.role}
    `;
    if (deleted.length) {
      if (!skipDeleted) throw new Error("Conversation source was deleted");
      return { conversationId: record.id, position: "0", replayed: true, deleted: true };
    }
    const [existing] = await tx<{ position: string; content: string; finish_reason: string | null;
      snapshot_present: boolean; content_snapshot_hash: string | null; event_kind: string; turn_id: string; message_sequence: number; step_index: number; content_offset: number }[]>`
      select position, content, finish_reason, snapshot_present, content_snapshot_hash, event_kind, turn_id, message_sequence, step_index, content_offset
      from public.conversation_record_events
      where conversation_id = ${record.id} and source_session_id = ${sessionId}
        and source_event_key = ${value.key}
    `;
    if (existing) {
      if (existing.content !== value.content || existing.finish_reason !== value.finishReason ||
          existing.event_kind !== value.kind || existing.turn_id !== value.turnId ||
          existing.message_sequence !== value.sequence || existing.step_index !== value.stepIndex ||
          existing.content_offset !== value.offset || existing.snapshot_present !== value.snapshotPresent ||
          existing.content_snapshot_hash !== value.snapshotHash) {
        throw new Error("Conflicting conversation event replay");
      }
      return { conversationId: record.id, position: existing.position, replayed: true };
    }
    const [position] = await tx<{ next_position: string }[]>`
      update public.conversation_records set next_position = next_position + 1
      where id = ${record.id} and family_id = ${principal.familyId}
        and member_user_id = ${principal.memberUserId}
      returning next_position
    `;
    await tx`
      insert into public.conversation_record_events
        (conversation_id, position, source_session_id, source_event_key, event_kind,
         role, turn_id, message_sequence, step_index, content_offset, content, finish_reason,
         canonical_message_id, snapshot_present, content_snapshot_hash)
      values (${record.id}, ${position.next_position}, ${sessionId}, ${value.key}, ${value.kind},
        ${value.role}, ${value.turnId}, ${value.sequence}, ${value.stepIndex}, ${value.offset},
        ${value.content}, ${value.finishReason}, (
          select id from public.conversation_messages
          where family_id = ${principal.familyId} and member_user_id = ${principal.memberUserId}
            and session_id = ${sessionId} and turn_id = ${value.turnId}
            and sequence = ${value.sequence} and role = ${value.role}
        ), ${value.snapshotPresent}, ${value.snapshotHash})
    `;
    return { conversationId: record.id, position: position.next_position, replayed: false };
}

/** Attach revisions to the existing canonical UUID, including for deletion cascade.
 * Called after canonical persistence too, so hook order cannot leave orphaned copies. */
export async function linkConversationRecording(principal: RecordingPrincipal, messageId: string) {
  const sql = mapDb();
  await sql`
    update public.conversation_record_events e set canonical_message_id = m.id
    from public.conversation_records r, public.conversation_messages m
    where e.conversation_id = r.id and r.family_id = ${principal.familyId}
      and r.member_user_id = ${principal.memberUserId}
      and m.id = ${messageId} and m.family_id = r.family_id and m.member_user_id = r.member_user_id
      and e.source_session_id = m.session_id and e.turn_id = m.turn_id
      and e.message_sequence = m.sequence and e.role = m.role
  `;
}
