import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { TransactionSql } from "postgres";

import { normalizeQuestionAnswer, renderQuestionAnswer, type ConversationQuestionAnswer } from "./conversation-question-answer";
import { normalizeConversationAttachmentIds, verifyConversationAttachments, linkConversationAttachments, requestConversationAttachmentIds, loadConversationRuntimeInputInTransaction } from "./conversation-attachments";
import { mapDb } from "./map/db";
import { conversationQuestionCardSchema, conversationQuestionText, type ConversationQuestionCard } from "./conversation-question-card";
import type { RecordingPrincipal } from "./conversation-recording";

export type ConversationRequestState = "queued" | "leased" | "executing" |
  "recovery_required" | "completed" | "failed" | "deleted" | "revoked" | "awaiting_parent" | "continued";

export interface ConversationRequestPrincipal extends RecordingPrincipal { accessEpoch: string }

export class ConversationRequestError extends Error {
  constructor(public readonly code: "invalid" | "membership" | "missing" | "conflict" | "deleted" | "lease" | "execution" | "access_changed") {
    super(`Conversation request ${code}`);
  }
}

interface RequestRow {
  id: string;
  client_intent_id: string;
  access_epoch: string;
  canonical_message_id: string | null;
  episode_id: string | null;
  state: ConversationRequestState;
  payload_hash: string | null;
  submission_hash: string | null;
  reply_question_id: string | null;
  native_batch_id: string | null;
  lease_token: string | null;
  execution_session_id: string | null;
  execution_turn_id: string | null;
  execution_sequence: number | null;
  accepted_at: Date;
}

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;

export async function requestTransaction<T>(work: (tx: TransactionSql) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await mapDb().begin(work) as T; }
    catch (error) {
      const code = (error as { code?: string })?.code;
      // Canonical deletion locks its message before its trigger locks the adult
      // record. Admission locks in the reverse order. PostgreSQL can resolve that
      // race by aborting either transaction; retry the WHOLE transaction, never
      // a statement or any external effect. No runtime work happens in this block.
      if (attempt >= 2 || (code !== "40P01" && code !== "40001")) throw error;
      await delay(20 * (attempt + 1));
    }
  }
}
export function validateConversationIntent(intentId: string, text: string, attachmentIds: readonly string[] = []) {
  // Exact content is retained. Reject NUL/unpaired surrogates, which cannot
  // round-trip through Postgres UTF-8, rather than silently replacing them.
  if (!uuid.test(intentId) || (!text.trim() && !attachmentIds.length) || text.includes("\0") || !text.isWellFormed()) {
    throw new ConversationRequestError("invalid");
  }
  return createHash("sha256").update(JSON.stringify(attachmentIds.length ? { version: 2, text, attachmentIds } : { version: 1, text })).digest("hex");
}

async function lockRecord(tx: TransactionSql, principal: RecordingPrincipal) {
  const members = await tx`
    select fm.user_id from public.family_members fm
    join public.families f on f.id = fm.family_id
    where fm.family_id = ${principal.familyId} and fm.user_id = ${principal.memberUserId}
      and f.status <> 'deleted' for key share of fm, f
  `;
  if (!members.length) throw new ConversationRequestError("membership");
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
  return record.id;
}

function receipt(row: RequestRow) {
  return {
    requestId: row.id, intentId: row.client_intent_id,
    messageId: row.canonical_message_id, state: row.state,
    acceptedAt: row.accepted_at.toISOString(),
  };
}

export async function readConversationAccess(principal: RecordingPrincipal) {
  return requestTransaction(async tx => {
    const id = await lockRecord(tx, principal);
    const [record] = await tx<{ access_epoch: string }[]>`select access_epoch from public.conversation_records where id=${id}`;
    return { conversationId: id, accessEpoch: record.access_epoch };
  });
}

export async function lockRequestRecord(tx: TransactionSql, principal: ConversationRequestPrincipal) {
  const id = await lockRecord(tx, principal);
  const [record] = await tx<{ access_epoch: string }[]>`select access_epoch from public.conversation_records where id=${id}`;
  if (record.access_epoch !== principal.accessEpoch) throw new ConversationRequestError("access_changed");
  return id;
}

/** Server-authenticated principal only. Exact text and ordered verified receipt
 * identities commit with the execution request before acceptance is returned. */
export async function acceptConversationRequest(principal: ConversationRequestPrincipal, input: {
  intentId: string; text: string; attachmentIds?: string[]; replyToQuestionId?: string;
}) {
  let attachmentIds: string[];
  try { attachmentIds = normalizeConversationAttachmentIds(input.attachmentIds); } catch { throw new ConversationRequestError("invalid"); }
  input = { ...input, attachmentIds };
  const hash = validateConversationIntent(input.intentId, input.text, attachmentIds);
  if (input.replyToQuestionId !== undefined && !uuid.test(input.replyToQuestionId)) throw new ConversationRequestError("invalid");
  return requestTransaction(async tx => {
    const recordId = await lockRequestRecord(tx, principal);
    const value = { ...input, replyQuestionId: input.replyToQuestionId };
    if (!input.replyToQuestionId) return acceptRequestInTransaction(tx, principal, value, recordId, hash);
    const [existing] = await tx`select id from public.conversation_requests where conversation_id=${recordId} and client_intent_id=${input.intentId}`;
    if (existing) return acceptRequestInTransaction(tx, principal, value, recordId, hash);
    const [question] = await tx<{ state: string; answer_request_id: string | null }[]>`select q.state,q.answer_request_id
      from public.conversation_question_cards q join public.conversation_requests source on source.id=q.request_id
      where q.id=${input.replyToQuestionId} and q.conversation_id=${recordId} and source.access_epoch=${principal.accessEpoch} for update of q`;
    if (!question) throw new ConversationRequestError("missing");
    if (question.state === "deleted") throw new ConversationRequestError("deleted");
    if (question.answer_request_id || !["ready","continued"].includes(question.state)) throw new ConversationRequestError("conflict");
    const accepted = await acceptRequestInTransaction(tx, principal, value, recordId, hash);
    await tx`update public.conversation_question_cards set state='answered',answer_request_id=${accepted.requestId},answer_payload=null
      where id=${input.replyToQuestionId} and conversation_id=${recordId}`;
    return accepted;
  });
}

export async function acceptRequestInTransaction(tx: TransactionSql, principal: ConversationRequestPrincipal,
  input: { intentId: string; text: string; attachmentIds?: string[]; replyQuestionId?: string; submissionHash?: string }, recordId: string, hash: string) {
    const [existing] = await tx<RequestRow[]>`
      select * from public.conversation_requests
      where conversation_id = ${recordId} and client_intent_id = ${input.intentId}
    `;
    if (existing) {
      if (existing.state === "deleted") throw new ConversationRequestError("deleted");
      if (existing.access_epoch !== principal.accessEpoch) throw new ConversationRequestError("access_changed");
      if (existing.payload_hash !== hash || existing.reply_question_id !== (input.replyQuestionId ?? null) || existing.submission_hash !== (input.submissionHash ?? null)) throw new ConversationRequestError("conflict");
      return { ...receipt(existing), replayed: true };
    }
    let attachments;
    try { attachments = await verifyConversationAttachments(tx,principal,input.attachmentIds ?? []); }
    catch { throw new ConversationRequestError("missing"); }
    const requestId = randomUUID();
    const [episode] = await tx<{ id: string }[]>`
      insert into public.conversation_episodes(family_id, scope, member_user_id)
      values (${principal.familyId}, 'member', ${principal.memberUserId}) returning id
    `;
    const [message] = await tx<{ id: string }[]>`
      insert into public.conversation_messages
        (family_id, member_user_id, session_id, turn_id, sequence, channel,
         role, content, episode_id, visibility, modality)
      values (${principal.familyId}, ${principal.memberUserId}, ${`request:${requestId}`},
        'accepted', 0, 'web', 'user', ${input.text}, ${episode.id}, 'family', 'text')
      returning id
    `;
    // The existing provenance trigger can now prove this episode's adult owner.
    await tx`update public.conversation_episodes set member_user_id = ${principal.memberUserId}
      where id = ${episode.id} and family_id = ${principal.familyId}`;
    const [row] = await tx<RequestRow[]>`
      insert into public.conversation_requests
        (id, conversation_id, client_intent_id, payload_hash, canonical_message_id, episode_id, access_epoch, reply_question_id, submission_hash)
      values (${requestId}, ${recordId}, ${input.intentId}, ${hash}, ${message.id}, ${episode.id}, ${principal.accessEpoch}, ${input.replyQuestionId ?? null}, ${input.submissionHash ?? null})
      returning *
    `;
    await linkConversationAttachments(tx,requestId,attachments);
    // A new message continues the conversation, without claiming it answered
    // the old question. Interpretation remains the model's responsibility.
    const continued = await tx<{ id: string }[]>`update public.conversation_requests set state='continued', updated_at=clock_timestamp()
      where conversation_id=${recordId} and access_epoch=${principal.accessEpoch} and state='awaiting_parent' returning id`;
    for (const prior of continued) await tx`update public.conversation_question_cards set state='continued'
      where conversation_id=${recordId} and request_id=${prior.id} and state='ready'`;
    return { ...receipt(row), replayed: false };
}

/** Complete validated choices and the new canonical input commit together.
 * An ambiguous HTTP outcome repeats the intent, never creates a second answer. */
export async function acceptConversationQuestionAnswer(principal: ConversationRequestPrincipal,
  input: { intentId: string; questionAnswer: unknown }) {
  let answer: ConversationQuestionAnswer;
  try { answer = normalizeQuestionAnswer(input.questionAnswer); }
  catch { throw new ConversationRequestError("invalid"); }
  if (!uuid.test(input.intentId)) throw new ConversationRequestError("invalid");
  const submissionHash = createHash("sha256").update(JSON.stringify({ version: 1, ...answer })).digest("hex");
  return requestTransaction(async tx => {
    const recordId = await lockRequestRecord(tx, principal);
    const [existing] = await tx<RequestRow[]>`select * from public.conversation_requests
      where conversation_id=${recordId} and client_intent_id=${input.intentId}`;
    if (existing) {
      if (existing.state === "deleted") throw new ConversationRequestError("deleted");
      if (existing.access_epoch !== principal.accessEpoch) throw new ConversationRequestError("access_changed");
      if (existing.submission_hash !== submissionHash || existing.reply_question_id !== answer.questionId) throw new ConversationRequestError("conflict");
      return { ...receipt(existing), replayed: true };
    }
    const [question] = await tx<{ state: string; payload: ConversationQuestionCard | null; answer_request_id: string | null }[]>`
      select q.state,q.payload,q.answer_request_id from public.conversation_question_cards q
      join public.conversation_requests source on source.id=q.request_id and source.conversation_id=q.conversation_id
      where q.id=${answer.questionId} and q.conversation_id=${recordId} and source.access_epoch=${principal.accessEpoch}
      for update of q`;
    if (!question) throw new ConversationRequestError("missing");
    if (question.state === "deleted") throw new ConversationRequestError("deleted");
    if (question.answer_request_id || !["ready","continued"].includes(question.state)) throw new ConversationRequestError("conflict");
    let text: string;
    try { text = renderQuestionAnswer(conversationQuestionCardSchema.parse(question.payload), answer); }
    catch { throw new ConversationRequestError("invalid"); }
    const accepted = await acceptRequestInTransaction(tx, principal, { intentId: input.intentId, text,
      replyQuestionId: answer.questionId, submissionHash }, recordId, validateConversationIntent(input.intentId, text));
    await tx`update public.conversation_question_cards set state='answered',answer_request_id=${accepted.requestId},
      answer_payload=${tx.json(answer.answers)} where id=${answer.questionId} and conversation_id=${recordId}`;
    return accepted;
  });
}

export async function readConversationRequest(principal: ConversationRequestPrincipal, intentId: string) {
  if (!uuid.test(intentId)) throw new ConversationRequestError("invalid");
  return requestTransaction(async tx => {
    const recordId = await lockRequestRecord(tx, principal);
    const [row] = await tx<RequestRow[]>`select * from public.conversation_requests
      where conversation_id = ${recordId} and client_intent_id = ${intentId}`;
    return row ? receipt(row) : null;
  });
}

/** Take only the oldest unresolved request for this adult. A runtime already
 * executing, or needing reconciliation, blocks later requests rather than
 * letting them run with incomplete conversation context. */
export async function leaseConversationRequest(principal: ConversationRequestPrincipal) {
  return requestTransaction(async tx => {
    const recordId = await lockRequestRecord(tx, principal);
    const [row] = await tx<(RequestRow & { lease_available: boolean; content: string | null })[]>`
      select r.*, m.content,
        (r.lease_until is null or r.lease_until <= clock_timestamp()) as lease_available
      from public.conversation_requests r
      left join public.conversation_messages m on m.id = r.canonical_message_id
        and m.family_id = ${principal.familyId} and m.member_user_id = ${principal.memberUserId}
      where r.conversation_id = ${recordId}
        and r.access_epoch = ${principal.accessEpoch}
        and r.state in ('queued', 'leased', 'executing', 'recovery_required')
      order by r.acceptance_order limit 1 for update of r
    `;
    if (!row) return { kind: "empty" as const };
    if (row.content === null || !row.episode_id) return { kind: "blocked" as const,
      requestId: row.id, reason: "missing_input" as const };
    if (row.state !== "queued" && !(row.state === "leased" && row.lease_available)) {
      return { kind: "blocked" as const, requestId: row.id, reason: row.state };
    }
    // Native retries retain the same authenticated identity and route. The
    // channel's durable seen map drops duplicates before pending input resolves.
    // Already-claimed work remains blocked above and is reconciled from its source.
    const token = row.native_batch_id && row.lease_token ? row.lease_token : randomUUID();
    await tx`update public.conversation_requests
      set state = 'leased', lease_token = ${token}, lease_until = clock_timestamp() + interval '60 seconds',
          updated_at = clock_timestamp()
      where id = ${row.id} and conversation_id = ${recordId}`;
    return { kind: "leased" as const, requestId: row.id, leaseToken: token, text: row.content,
      messageId: row.canonical_message_id!, episodeId: row.episode_id };
  });
}

export interface RequestExecution {
  requestId: string; leaseToken: string; sessionId: string; turnId: string; sequence: number;
}

/** Must run before model/tools. Only the lease holder can bind the canonical
 * UUID to its runtime input. The winning identity never expires. This protects
 * dispatch duplication; individual tool effects still need their own receipts. */
export async function claimConversationExecution(principal: ConversationRequestPrincipal, execution: RequestExecution, text: string) {
  if (!uuid.test(execution.requestId) || !uuid.test(execution.leaseToken) ||
      !execution.sessionId || !execution.turnId || !Number.isSafeInteger(execution.sequence) || execution.sequence < 0) {
    throw new ConversationRequestError("invalid");
  }
  return requestTransaction(async tx => {
    const recordId = await lockRequestRecord(tx, principal);
    const [row] = await tx<(RequestRow & { lease_valid: boolean })[]>`
      select *, lease_until > clock_timestamp() as lease_valid from public.conversation_requests
      where id = ${execution.requestId} and conversation_id = ${recordId} for update
    `;
    if (!row) throw new ConversationRequestError("missing");
    if (row.native_batch_id) throw new ConversationRequestError("execution");
    if (row.state === "deleted") throw new ConversationRequestError("deleted");
    if (row.access_epoch !== principal.accessEpoch) throw new ConversationRequestError("access_changed");
    const [canonical] = await tx<{ content: string }[]>`select content from public.conversation_messages
      where id=${row.canonical_message_id} and family_id=${principal.familyId} and member_user_id=${principal.memberUserId}`;
    if (!canonical) throw new ConversationRequestError("missing");
    let runtimeInput;
    let attachmentIds: string[];
    try {
      attachmentIds = await requestConversationAttachmentIds(tx,row.id);
      runtimeInput = await loadConversationRuntimeInputInTransaction(tx,principal,row.id,canonical.content);
    } catch { throw new ConversationRequestError("deleted"); }
    if (text !== runtimeInput.summary || row.payload_hash !== validateConversationIntent(row.client_intent_id,canonical.content,attachmentIds)) {
      throw new ConversationRequestError("conflict");
    }
    if (row.reply_question_id) {
      const question = await tx`select id from public.conversation_question_cards where id=${row.reply_question_id}
        and conversation_id=${recordId} and state='answered' and answer_request_id=${row.id} and canonical_message_id is not null`;
      if (!question.length) throw new ConversationRequestError("deleted");
    }
    if (row.execution_session_id) {
      if (row.execution_session_id !== execution.sessionId || row.execution_turn_id !== execution.turnId ||
          row.execution_sequence !== execution.sequence || row.lease_token !== execution.leaseToken ||
          (row.state !== "executing" && row.state !== "recovery_required")) {
        throw new ConversationRequestError("execution");
      }
      return { messageId: row.canonical_message_id!, episodeId: row.episode_id!, text: canonical.content, replayed: true };
    }
    if (row.state !== "leased" || row.lease_token !== execution.leaseToken || !row.lease_valid) {
      throw new ConversationRequestError("lease");
    }
    const messages = await tx`
      update public.conversation_messages
      set session_id = ${execution.sessionId}, turn_id = ${execution.turnId}, sequence = ${execution.sequence}
      where id = ${row.canonical_message_id} and family_id = ${principal.familyId}
        and member_user_id = ${principal.memberUserId} and role = 'user'
      returning id
    `;
    if (!messages.length || !row.episode_id) throw new ConversationRequestError("missing");
    await tx`update public.conversation_requests
      set state = 'executing', execution_session_id = ${execution.sessionId},
          execution_turn_id = ${execution.turnId}, execution_sequence = ${execution.sequence},
          lease_until = null, updated_at = clock_timestamp()
      where id = ${row.id} and conversation_id = ${recordId}`;
    await tx`insert into public.conversation_sources(session_id,conversation_id,request_id,access_epoch)
      values (${execution.sessionId},${recordId},${row.id},${principal.accessEpoch}) on conflict (session_id) do nothing`;
    return { messageId: row.canonical_message_id!, episodeId: row.episode_id, text: canonical.content, replayed: false };
  });
}

/** A trusted runtime/reconciler reports an observed outcome. A timeout means
 * recovery_required, never failed-and-requeued. Terminal receipts are monotonic. */
export async function finishConversationRequest(principal: RecordingPrincipal,
  execution: RequestExecution, outcome: "completed" | "failed" | "recovery_required") {
  return requestTransaction(async tx => {
    // A trusted runtime may record what ALREADY happened after access revocation.
    // It cannot create a record, read content, claim work or restart execution.
    // The original secret lease and full runtime identity remain mandatory.
    const [record] = await tx<{ id: string }[]>`select id from public.conversation_records
      where family_id = ${principal.familyId} and member_user_id = ${principal.memberUserId} for update`;
    if (!record) throw new ConversationRequestError("missing");
    const recordId = record.id;
    const [row] = await tx<RequestRow[]>`select * from public.conversation_requests
      where id = ${execution.requestId} and conversation_id = ${recordId} for update`;
    if (!row) throw new ConversationRequestError("missing");
    if (row.state === "deleted") throw new ConversationRequestError("deleted");
    if (row.execution_session_id !== execution.sessionId || row.execution_turn_id !== execution.turnId ||
        row.execution_sequence !== execution.sequence || row.lease_token !== execution.leaseToken) {
      throw new ConversationRequestError("execution");
    }
    if (row.state === "awaiting_parent" || row.state === "continued") return receipt(row);
    if (row.state === "completed" || row.state === "failed") {
      if (row.state !== outcome) throw new ConversationRequestError("conflict");
      return receipt(row);
    }
    const [updated] = await tx<RequestRow[]>`update public.conversation_requests
      set state = ${outcome}, updated_at = clock_timestamp()
      where id = ${row.id} and conversation_id = ${recordId} returning *`;
    return receipt(updated);
  });
}

/** Validate a server-stamped lease before family hydration, or the permanently
 * claimed runtime before a tool. No content is returned and no access is cached.
 * Preparing may inspect family context while leased; only a claimed execution
 * may perform tools. A revoked epoch or erased input always denies new access. */
export async function authorizeConversationRequest(
  principal: ConversationRequestPrincipal,
  input: { requestId: string; leaseToken: string; sessionId: string; turnId: string; phase: "prepare" | "execute" },
): Promise<void> {
  if (![principal.familyId, principal.memberUserId, principal.accessEpoch, input.requestId, input.leaseToken].every(value => uuid.test(value)) ||
      !input.sessionId || !input.turnId) throw new ConversationRequestError("invalid");
  const rows = await mapDb()`
    select r.id from public.conversation_requests r
    join public.conversation_records c on c.id = r.conversation_id
    join public.family_members fm on fm.family_id = c.family_id and fm.user_id = c.member_user_id
    join public.families f on f.id = c.family_id
    where c.family_id = ${principal.familyId} and c.member_user_id = ${principal.memberUserId}
      and f.status <> 'deleted' and c.access_epoch = ${principal.accessEpoch}
      and r.id = ${input.requestId} and r.access_epoch = c.access_epoch
      and r.lease_token = ${input.leaseToken} and r.canonical_message_id is not null
      and not exists (select 1 from public.conversation_request_attachments a where a.request_id=r.id and a.attachment_id is null)
      and (r.native_batch_id is null or public.conversation_native_ancestry_live(r.id,r.conversation_id,c.access_epoch))
      and (r.reply_question_id is null or exists (select 1 from public.conversation_question_cards q
        where q.id=r.reply_question_id and q.conversation_id=r.conversation_id and q.state='answered'
          and q.answer_request_id=r.id and q.canonical_message_id is not null))
      and ((r.state = 'executing' and r.execution_session_id = ${input.sessionId}
          and r.execution_turn_id = ${input.turnId})
        or (${input.phase === "prepare"} and r.state = 'leased' and r.execution_session_id is null
          and r.lease_until > clock_timestamp()))
  `;
  if (!rows.length) throw new ConversationRequestError("execution");
}

/** The worker discovers owners from durable rows, never from an HTTP family
 * selector. Skip blocked owners so one parked turn cannot starve other adults. */
export async function listConversationDispatchOwners(limit = 10): Promise<ConversationRequestPrincipal[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new ConversationRequestError("invalid");
  const rows = await mapDb()< { family_id: string; member_user_id: string; access_epoch: string }[]>`
    select c.family_id, c.member_user_id, c.access_epoch from public.conversation_records c
    join public.family_members fm on fm.family_id = c.family_id and fm.user_id = c.member_user_id
    join public.families f on f.id = c.family_id
    where f.status <> 'deleted' and exists (
      select 1 from public.conversation_requests r where r.conversation_id=c.id and r.access_epoch=c.access_epoch
        and (r.state='queued' or (r.state='leased' and r.lease_until <= clock_timestamp()))
    ) and not exists (
      select 1 from public.conversation_requests r where r.conversation_id=c.id and r.access_epoch=c.access_epoch
        and (r.state in ('executing','recovery_required') or (r.state='leased' and r.lease_until > clock_timestamp()))
    ) order by (select max(r.updated_at) from public.conversation_requests r
      where r.conversation_id=c.id and r.access_epoch=c.access_epoch and r.state in ('queued','leased'))
    limit ${limit}
  `;
  return rows.map(row => ({ familyId: row.family_id, memberUserId: row.member_user_id, accessEpoch: row.access_epoch }));
}

/** Observed runtime outcomes use the original secret and stored execution
 * identity, even after access revocation. Completion additionally requires an
 * actual persisted response from that same adult/runtime/turn. */
export async function observeConversationRequestOutcome(principal: RecordingPrincipal, input: {
  requestId: string; leaseToken: string; sessionId: string; turnId?: string;
  outcome: "completed" | "recovery_required"; responseMessageId?: string;
}) {
  const [row] = await mapDb()<RequestRow[]>`
    select r.* from public.conversation_requests r
    join public.conversation_records c on c.id=r.conversation_id
    where r.id=${input.requestId} and c.family_id=${principal.familyId} and c.member_user_id=${principal.memberUserId}
      and r.lease_token=${input.leaseToken} and r.execution_session_id=${input.sessionId}
  `;
  // A failure before admission has no permission to alter a different attempt.
  if (!row || (input.turnId && input.turnId !== row.execution_turn_id)) return null;
  if (["completed", "failed", "deleted", "awaiting_parent", "continued"].includes(row.state)) return receipt(row);
  if (input.outcome === "completed") {
    if (!input.responseMessageId || !uuid.test(input.responseMessageId)) throw new ConversationRequestError("execution");
    const proof = await mapDb()`select id from public.conversation_messages
      where id=${input.responseMessageId} and family_id=${principal.familyId} and member_user_id=${principal.memberUserId}
        and session_id=${input.sessionId} and turn_id=${row.execution_turn_id}
        and role='assistant' and visibility='family'`;
    if (!proof.length) throw new ConversationRequestError("execution");
  }
  return finishConversationRequest(principal, { requestId: row.id, leaseToken: input.leaseToken,
    sessionId: input.sessionId, turnId: row.execution_turn_id!, sequence: row.execution_sequence! }, input.outcome);
}


/** Record one confirmed question tool result and its readable history atomically.
 * A repeated call ID returns the same card; conflicting replay never rewrites it. */
export async function recordConversationQuestion(principal: ConversationRequestPrincipal,
  execution: Omit<RequestExecution, "sequence">, input: { callId: string; sourceSequence: number; stepIndex: number; card: ConversationQuestionCard }) {
  return requestTransaction(tx => recordConversationQuestionInTransaction(tx, principal, execution, input));
}

export async function recordConversationQuestionInTransaction(tx: TransactionSql, principal: ConversationRequestPrincipal,
  execution: Omit<RequestExecution, "sequence">, input: { callId: string; sourceSequence: number; stepIndex: number; card: ConversationQuestionCard }) {
  const card = conversationQuestionCardSchema.parse(input.card);
  if (!input.callId || input.callId.length > 512 || input.callId.includes("\0") || !input.callId.isWellFormed() ||
      !Number.isSafeInteger(input.sourceSequence) || input.sourceSequence < 0 ||
      !Number.isSafeInteger(input.stepIndex) || input.stepIndex < 0) throw new ConversationRequestError("invalid");
  const hash = createHash("sha256").update(JSON.stringify({ card, stepIndex: input.stepIndex })).digest("hex");
    const recordId = await lockRequestRecord(tx, principal);
    const [request] = await tx<RequestRow[]>`select * from public.conversation_requests
      where id=${execution.requestId} and conversation_id=${recordId} for update`;
    if (!request || request.access_epoch !== principal.accessEpoch || request.lease_token !== execution.leaseToken ||
        request.execution_session_id !== execution.sessionId || request.execution_turn_id !== execution.turnId ||
        request.execution_sequence !== input.sourceSequence) throw new ConversationRequestError("execution");
    const [existing] = await tx<{ id: string; canonical_message_id: string | null; payload_hash: string | null; state: string }[]>`
      select id,canonical_message_id,payload_hash,state from public.conversation_question_cards
      where conversation_id=${recordId} and request_id=${request.id} and source_sequence=${input.sourceSequence} and call_id=${input.callId}`;
    if (existing) {
      if (existing.state === "deleted") throw new ConversationRequestError("deleted");
      if (existing.payload_hash !== hash) throw new ConversationRequestError("conflict");
      return { id: existing.id, messageId: existing.canonical_message_id!, replayed: true };
    }
    if (!["executing", "recovery_required"].includes(request.state) || !request.episode_id || !request.canonical_message_id) throw new ConversationRequestError("execution");
    const id = randomUUID();
    // Preserve session provenance while giving the card its own canonical
    // segment. The real runtime turn lives on the request, never this segment.
    const [message] = await tx<{ id: string; member_user_id: string | null }[]>`insert into public.conversation_messages
      (family_id,member_user_id,session_id,turn_id,sequence,channel,role,content,episode_id,visibility,modality)
      values (${principal.familyId},${principal.memberUserId},${execution.sessionId},${`question-card:${id}`},${input.sourceSequence},'web','assistant',
        ${conversationQuestionText(card)},${request.episode_id},'family','text') returning id,member_user_id`;
    if (message.member_user_id !== principal.memberUserId) throw new ConversationRequestError("execution");
    await tx`insert into public.conversation_question_cards(id,conversation_id,request_id,source_sequence,step_index,call_id,canonical_message_id,payload,payload_hash)
      values (${id},${recordId},${request.id},${input.sourceSequence},${input.stepIndex},${input.callId},${message.id},${tx.json(card)}::jsonb,${hash})`;
    return { id, messageId: message.id, replayed: false };
}

/** A completed turn containing a durable card is waiting for the parent, not a
 * failed text response. Queued/new messages proceed in fresh claimed executions. */
export async function finishConversationQuestionTurn(principal: ConversationRequestPrincipal, execution: Omit<RequestExecution, "sequence">) {
  return requestTransaction(async tx => {
    // Recording an observed ending grants no new access. Do not provision a
    // record or require current membership after an already admitted execution.
    const [record] = await tx<{ id: string; access_epoch: string }[]>`select id,access_epoch from public.conversation_records
      where family_id=${principal.familyId} and member_user_id=${principal.memberUserId} for update`;
    if (!record) return null;
    const recordId = record.id;
    const [request] = await tx<(RequestRow & { acceptance_order: string })[]>`select * from public.conversation_requests
      where conversation_id=${recordId} and id=${execution.requestId} for update`;
    if (!request || request.access_epoch !== principal.accessEpoch || request.lease_token !== execution.leaseToken ||
        request.execution_session_id !== execution.sessionId || request.execution_turn_id !== execution.turnId) return null;
    if (request.state === "awaiting_parent" || request.state === "continued") return receipt(request);
    if (request.state !== "executing" && request.state !== "recovery_required") return null;
    const cards = await tx<{ state: string }[]>`select state from public.conversation_question_cards
      where conversation_id=${recordId} and request_id=${request.id} and state in ('recorded','deleted')`;
    if (!cards.length) return null;
    const next = await tx`select id from public.conversation_requests where conversation_id=${recordId}
      and access_epoch=${principal.accessEpoch} and acceptance_order > ${request.acceptance_order} and state in ('queued','leased') limit 1`;
    // An erased card remains content-free evidence of an observed result. It
    // cannot become interactive again or strand later messages in recovery.
    const continued = next.length > 0 || record.access_epoch !== principal.accessEpoch || cards.every(card => card.state === "deleted");
    const state = continued ? "continued" : "awaiting_parent";
    const [row] = await tx<RequestRow[]>`update public.conversation_requests set state=${state},updated_at=clock_timestamp()
      where id=${request.id} and conversation_id=${recordId} returning *`;
    await tx`update public.conversation_question_cards set state=${continued ? "continued" : "ready"}
      where conversation_id=${recordId} and request_id=${request.id} and state='recorded'`;
    return receipt(row);
  });
}

/** Authenticated owner-only enrichment. Deletion removes payload, and membership
 * changes cannot expose a previous access generation's interactive choices. */
export async function readConversationQuestions(principal: ConversationRequestPrincipal) {
  return requestTransaction(async tx => {
    const recordId = await lockRequestRecord(tx, principal);
    const rows = await tx<{ id: string; canonical_message_id: string; state: "ready" | "continued" | "answered"; payload: ConversationQuestionCard; answer_payload: unknown }[]>`
      select q.id,q.canonical_message_id,q.state,q.payload,q.answer_payload from public.conversation_question_cards q
      join public.conversation_requests r on r.id=q.request_id and r.conversation_id=q.conversation_id
      where q.conversation_id=${recordId} and r.access_epoch=${principal.accessEpoch}
        and q.state in ('ready','continued','answered') and q.canonical_message_id is not null
      order by q.created_at desc,q.id desc limit 24`;
    return rows.map(row => ({ id: row.id, messageId: row.canonical_message_id, state: row.state,
      card: conversationQuestionCardSchema.parse(row.payload),
      answers: row.answer_payload === null ? null : normalizeQuestionAnswer({ questionId: row.id, answers: row.answer_payload }).answers }));
  });
}
