import { z } from "zod";

import { requestAuthTransport } from "./api-auth";
import { toChatHistoryMaterial, type ChatHistoryMaterial, type ChatHistoryMaterialRow, type ChatHistoryMessage } from "./chat-history-model";
import { conversationQuestionCardSchema, type ConversationQuestionCard } from "./conversation-question-card";
import { normalizeQuestionAnswer, type ConversationQuestionAnswer } from "./conversation-question-answer";
import { resolveConversationRequestPrincipal } from "./conversation-request-auth";
import { ConversationRequestError, readConversationAccess, type ConversationRequestPrincipal, type ConversationRequestState } from "./conversation-requests";
import type { RecordingPrincipal } from "./conversation-recording";
import { mapDb } from "./map/db";
import { rateLimited } from "./map/ratelimit";
import { selectParentVisibleMaterialRevisions } from "./materials/parent-visible";
import { isHiddenDirective } from "./onboarding/directives";
import { parseNativePendingInput, type NativeInputRequest, type NativeInputResponse } from "./conversation-native-input";

export interface ConversationFeedRequest {
  requestId: string; intentId: string; state: ConversationRequestState;
}
export interface ConversationFeedQuestion {
  id: string; state: "recorded" | "ready" | "continued" | "answered";
  card: ConversationQuestionCard; answers: ConversationQuestionAnswer["answers"] | null;
}
export interface ConversationFeedMessage extends ChatHistoryMessage {
  nativeInput?: { batchId: string; createdAt: string; state: "pending" | "answered"; answerRequestId?: string | null;
    responses: NativeInputResponse[] | null; requests: Omit<NativeInputRequest,"action">[] };
  nativeUnavailable?: boolean;
  work?: { jobId: string; status: string };
  createdAt: string;
  historyCursor: string;
  recordingPosition: string | null;
  responseComplete: boolean;
  request: ConversationFeedRequest | null;
  question: ConversationFeedQuestion | null;
  questionUnavailable?: boolean;
  attachments?: { id: string; url: string; mediaType: string; kind: string; name: string | null; caption: string | null }[];
}
export interface ConversationFeedPage {
  account: string; conversationId: string; accessEpoch: string; mode: "snapshot";
  messages: ConversationFeedMessage[];
  materials: ChatHistoryMaterial[]; materialsUnavailable?: boolean; materialsTruncated?: boolean;
  requests: ConversationFeedRequest[]; requestsTruncated: boolean;
  nextCursor: string | null; hasOlder: boolean; changeCursor: string;
}
export interface ConversationFeedChanges {
  account: string; conversationId: string; accessEpoch: string; mode: "changes";
  changes: ({ kind: "upsert"; message: ConversationFeedMessage } | { kind: "delete"; messageId: string })[];
  nextChangeCursor: string; hasMore: boolean;
  requests: ConversationFeedRequest[]; requestsTruncated: boolean;
  materials: ChatHistoryMaterial[]; materialSessions: string[];
  materialsUnavailable?: boolean; materialsTruncated?: boolean;
}
export interface ConversationFeedMaterials {
  account: string; conversationId: string; accessEpoch: string; mode: "materials";
  materials: ChatHistoryMaterial[]; materialSessions: string[]; requestedMessageIds: string[];
  materialsUnavailable?: boolean; materialsTruncated?: boolean;
}
export interface ConversationFeedOptions { before?: string; limit?: number }

const uuid = z.uuid();
const cursorSchema = z.object({
  version: z.literal(1), account: z.string(), accessEpoch: uuid,
  // Keep PostgreSQL microseconds. A Date round trip loses keyset precision.
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u)
    .refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19)), id: uuid,
}).strict();
type FeedCursor = z.infer<typeof cursorSchema>;
const changeCursorSchema = z.object({ version: z.literal(1), kind: z.literal("changes"), account: z.string(),
  accessEpoch: uuid, position: z.string().regex(/^(0|[1-9]\d{0,18})$/u)
    .refine(value => BigInt(value) <= BigInt("9223372036854775807")),
}).strict();
type ChangeCursor = z.infer<typeof changeCursorSchema>;

export function encodeConversationChangeCursor(cursor: ChangeCursor): string {
  return Buffer.from(JSON.stringify(changeCursorSchema.parse(cursor))).toString("base64url");
}
export function decodeConversationChangeCursor(value: string, account: string, accessEpoch: string): ChangeCursor {
  try {
    if (value.length > 1024 || !/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error();
    const cursor = changeCursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (cursor.account !== account || cursor.accessEpoch !== accessEpoch) throw new Error();
    return cursor;
  } catch { throw new ConversationRequestError("invalid"); }
}

export function decodeConversationFeedCursor(value: string, account: string, accessEpoch: string): FeedCursor {
  try {
    if (value.length > 1024 || !/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error();
    const cursor = cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (cursor.account !== account || cursor.accessEpoch !== accessEpoch) throw new Error();
    return cursor;
  } catch { throw new ConversationRequestError("invalid"); }
}

export function encodeConversationFeedCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify(cursorSchema.parse(cursor))).toString("base64url");
}

interface FeedRow {
  id: string; session_id: string; turn_id: string | null;
  role: "user" | "assistant"; channel: ChatHistoryMessage["channel"];
  modality: "text" | "voice" | null; content: string; created_at: string; recording_position: string | null;
  request_id: string | null; intent_id: string | null; request_state: ConversationRequestState | null;
  response_complete: boolean;
  work: { jobId: string; status: string } | null;
  native_message: boolean;
  question_id: string | null; question_state: ConversationFeedQuestion["state"] | null;
  question_payload: unknown; answer_payload: unknown;
}

/** Each page and its change head share one database snapshot. Poll changes from
 * the newest-page head while paging older history separately. Never advance the
 * active change cursor from an older-page response. Other-owned deliveries require
 * a prospective immutable snapshot; legacy unsnapshotted receipts are omitted. */
export async function readConversationFeed(principal: ConversationRequestPrincipal,
  options: ConversationFeedOptions = {}): Promise<ConversationFeedPage> {
  return await readFeed(principal, options) as ConversationFeedPage;
}
export async function readConversationFeedChanges(principal: ConversationRequestPrincipal,
  options: { after: string; limit?: number }): Promise<ConversationFeedChanges> {
  return await readFeed(principal, options) as ConversationFeedChanges;
}
export async function readConversationFeedMaterials(principal: ConversationRequestPrincipal,
  options: { messageIds: string[] }): Promise<ConversationFeedMaterials> {
  if (!options.messageIds.length || options.messageIds.length > 100 ||
      options.messageIds.some(id => !uuid.safeParse(id).success)) throw new ConversationRequestError("invalid");
  return await readFeed(principal, { materialIds: [...new Set(options.messageIds)], limit: 100 }) as ConversationFeedMaterials;
}
async function readFeed(principal: ConversationRequestPrincipal,
  options: ConversationFeedOptions & { after?: string; materialIds?: string[] }): Promise<ConversationFeedPage | ConversationFeedChanges | ConversationFeedMaterials> {
  if (![principal.familyId, principal.memberUserId, principal.accessEpoch].every(value => uuid.safeParse(value).success)) {
    throw new ConversationRequestError("invalid");
  }
  const limit = options.limit ?? 40;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ConversationRequestError("invalid");
  const account = `${principal.familyId}:${principal.memberUserId}`;
  const before = options.before ? decodeConversationFeedCursor(options.before, account, principal.accessEpoch) : null;
  const after = options.after ? decodeConversationChangeCursor(options.after, account, principal.accessEpoch) : null;
  return await mapDb().begin("isolation level repeatable read read only", async tx => {
    await tx`set local statement_timeout = '5s'`;
    const [record] = await tx<{ id: string; access_epoch: string; feed_position: string }[]>`
      select c.id,c.access_epoch,c.feed_position from public.conversation_records c
      join public.family_members fm on fm.family_id=c.family_id and fm.user_id=c.member_user_id
      join public.families f on f.id=c.family_id
      where c.family_id=${principal.familyId} and c.member_user_id=${principal.memberUserId} and f.status <> 'deleted'`;
    if (!record) throw new ConversationRequestError("membership");
    if (record.access_epoch !== principal.accessEpoch) throw new ConversationRequestError("access_changed");
    if (after && BigInt(after.position) > BigInt(record.feed_position)) throw new ConversationRequestError("invalid");
    const invalidations = after ? await tx<{ position: string; message_id: string; source_session_id: string }[]>`
      select position,message_id,source_session_id from public.conversation_feed_changes
      where conversation_id=${record.id} and position > ${after.position}::bigint
      order by position limit ${limit + 1}` : [];
    const changeRows = invalidations.slice(0, limit);
    const changedIds = [...new Set(changeRows.map(row => row.message_id))];
    const rows = await tx<FeedRow[]>`
      with visible as (select m.id,m.session_id,m.turn_id,m.role,m.channel,m.modality,m.content,m.recording_position,
        to_char(m.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at,
        request.id as request_id,request.client_intent_id as intent_id,request.state as request_state,
        (m.role <> 'assistant' or request.id is null or request.state in ('completed','awaiting_parent','continued')) as response_complete,
        q.id as question_id,q.state as question_state,q.payload as question_payload,q.answer_payload,null::jsonb as work,
        exists(select 1 from public.conversation_native_batches b where b.canonical_message_id=m.id) as native_message
      from public.conversation_messages m
      left join public.conversation_question_cards q on q.canonical_message_id=m.id and q.conversation_id=${record.id}
        and q.state in ('recorded','ready','continued','answered')
        and exists (select 1 from public.conversation_requests qr where qr.id=q.request_id
          and qr.conversation_id=${record.id} and qr.access_epoch=${principal.accessEpoch})
      left join lateral (
        select r.id,r.client_intent_id,r.state from public.conversation_requests r
        where r.conversation_id=${record.id} and r.access_epoch=${principal.accessEpoch}
          and (r.canonical_message_id=m.id or r.id=q.request_id or
            (m.role='assistant' and r.execution_session_id=m.session_id and r.execution_turn_id=m.turn_id and r.execution_sequence=m.sequence))
        order by r.acceptance_order desc limit 1
      ) request on true
      where m.family_id=${principal.familyId} and m.member_user_id=${principal.memberUserId} and m.visibility='family'
        and (m.role='user' or m.channel='web' or exists (
          select 1 from public.conversation_deliveries d where d.family_id=${principal.familyId}
            and d.message_id=m.id and d.recipient_member_user_id=${principal.memberUserId} and d.status='sent'))
        and (m.role='user' or m.recording_position is not null or q.id is not null or exists(
          select 1 from public.conversation_native_batches b where b.canonical_message_id=m.id and b.conversation_id=${record.id}
            and b.access_epoch=${principal.accessEpoch} and b.state in ('pending','answered')) or not exists (
          select 1 from public.conversation_requests owned where owned.conversation_id=${record.id}
            and owned.execution_session_id=m.session_id))
      union all
      select s.id,'delivery:'||s.id::text,null,'assistant',s.channel,'text',s.content,null,
        to_char(s.published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        null,null,null,true,null,null,null,null,null,false
      from public.conversation_delivery_snapshots s
      join public.conversation_deliveries d on d.id=s.delivery_id and d.family_id=s.family_id
        and d.message_id=s.source_message_id and d.recipient_member_user_id=s.recipient_member_user_id and d.status='sent'
      join public.conversation_messages source on source.id=s.source_message_id and source.family_id=s.family_id
      where s.conversation_id=${record.id} and s.family_id=${principal.familyId} and s.recipient_member_user_id=${principal.memberUserId}
        and s.access_epoch=${principal.accessEpoch} and s.published_at is not null and source.role='assistant'
        and source.member_user_id is distinct from ${principal.memberUserId}::uuid
      union all
      select l.message_id,'job:'||l.job_id::text,null,'assistant','web','text',
        case when j.status='completed' then l.title||' is ready.'
          when j.status='cancelled' then l.title||' was cancelled.'
          when j.status in ('paused','failed') then l.title||' needs a recovery check.'
          else 'Making '||l.title||'. You can keep talking.' end,null,
        to_char(l.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        null,null,null,j.status in ('completed','cancelled','paused','failed'),null,null,null,null,
        jsonb_build_object('jobId',j.id,'status',j.status),false
      from public.conversation_jobs l join public.agent_jobs j on j.id=l.job_id
      join public.conversation_requests r on r.id=l.request_id
      where l.conversation_id=${record.id} and l.access_epoch=${principal.accessEpoch}
        and j.family_id=${principal.familyId} and r.canonical_message_id is not null and l.state<>'revoked')
      select * from visible
      where (${after === null} or id=any(${changedIds}::uuid[]))
        and (${options.materialIds === undefined} or id=any(${options.materialIds ?? []}::uuid[]))
        -- Bind timestamp as text first: postgres.js otherwise serializes it as a
        -- JavaScript Date and silently drops the cursor's last three digits.
        and (${before === null} or (created_at::timestamptz,id) < (${before?.at ?? null}::text::timestamptz,${before?.id ?? null}::uuid))
      order by created_at desc,id desc limit ${limit + 1}`;
    const pageRows = rows.slice(0, limit);
    const messages: ConversationFeedMessage[] = pageRows.filter(row => !isHiddenDirective(row.content)).reverse().map(row => {
      let question: ConversationFeedQuestion | null = null, questionUnavailable = false;
      if (row.question_id && row.question_state) {
        try {
          question = { id: row.question_id, state: row.question_state,
            card: conversationQuestionCardSchema.parse(row.question_payload),
            answers: row.answer_payload === null ? null : normalizeQuestionAnswer({ questionId: row.question_id, answers: row.answer_payload }).answers };
        } catch { questionUnavailable = true; }
      }
      return { id: row.id, sessionId: row.session_id, turnId: row.turn_id, role: row.role, channel: row.channel,
        modality: row.modality === "voice" ? "voice" as const : "text" as const, content: row.content,
        atMs: Date.parse(row.created_at), createdAt: row.created_at, recordingPosition: row.recording_position,
        responseComplete: row.response_complete,
        historyCursor: encodeConversationFeedCursor({ version: 1, account, accessEpoch: record.access_epoch, at: row.created_at, id: row.id }),
        request: row.request_id ? { requestId: row.request_id, intentId: row.intent_id!, state: row.request_state! } : null,
        question, ...(row.work ? { work: row.work } : {}), ...(row.native_message ? { nativeUnavailable: true } : {}),
        ...(questionUnavailable ? { questionUnavailable: true } : {}) };
    });
    const nativeIds = messages.filter(message=>message.nativeUnavailable).map(message=>message.id);
    if (nativeIds.length) {
      try {
        const nativeRows = await tx.savepoint(st=>st<{id:string;canonical_message_id:string;state:"pending"|"answered";answer_request_id:string|null;
          responses:NativeInputResponse[]|null;payload:unknown;created_at:Date;session_id:string;source_index:string}[]>`
          select b.* from public.conversation_native_batches b join public.conversation_requests r on r.id=b.origin_request_id
          where b.canonical_message_id=any(${nativeIds}::uuid[]) and b.conversation_id=${record.id}
            and b.access_epoch=${principal.accessEpoch} and b.state in ('pending','answered') and r.canonical_message_id is not null
            and public.conversation_native_ancestry_live(r.id,b.conversation_id,${principal.accessEpoch})`);
        for (const row of nativeRows) {
          try {
            const payload=row.payload as {turnId:string;sequence:number;stepIndex:number;requests:unknown[]};
            const parsed=parseNativePendingInput({type:"input.requested",data:payload},row.id,row.session_id,Number(row.source_index));
            const message=messages.find(value=>value.id===row.canonical_message_id);
            if (!parsed || !message) continue;
            message.nativeInput={batchId:row.id,createdAt:row.created_at.toISOString(),state:row.state,answerRequestId:row.answer_request_id,
              responses:row.responses,requests:parsed.requests.map(({requestId,prompt,display,allowFreeform,options})=>({requestId,prompt,display,allowFreeform,options}))};
            delete message.nativeUnavailable;
            message.responseComplete=true;
          } catch { /* Preserve visible recovery state without raw tool arguments. */ }
        }
      } catch { /* Healthy transcript remains readable while this card is unavailable. */ }
    }
    if (messages.length && !options.materialIds) {
      const attached = await tx<{ message_id: string; id: string; url: string; media_type: string; kind: string; name: string | null; caption: string | null }[]>`
        select r.canonical_message_id as message_id,file.id,file.url,file.media_type,file.kind,file.caption,p.payload->>'filename' as name
        from public.conversation_requests r
        join public.conversation_request_attachments a on a.request_id=r.id
        join public.conversation_attachment_preparations p on p.attachment_id=a.attachment_id
          and p.family_id=${principal.familyId} and p.member_user_id=${principal.memberUserId}
        join public.chat_attachments file on file.id=p.attachment_id and file.family_id=${principal.familyId}
          and file.member_user_id=${principal.memberUserId}
        where r.conversation_id=${record.id} and r.canonical_message_id=any(${messages.map(message => message.id)}::uuid[])
        order by a.ordinal`;
      for (const message of messages) message.attachments = attached.filter(file => file.message_id === message.id).map(file => ({
        id: file.id, url: file.url, mediaType: file.media_type, kind: file.kind, name: file.name, caption: file.caption,
      }));
    }
    const pending = await tx<{ request_id: string; intent_id: string; state: ConversationRequestState }[]>`
      select id as request_id,client_intent_id as intent_id,state from public.conversation_requests
      where conversation_id=${record.id} and access_epoch=${principal.accessEpoch}
        and state in ('queued','leased','executing','recovery_required','awaiting_parent')
      order by acceptance_order limit 101`;
    let materials: ChatHistoryMaterial[] = [], materialsUnavailable = false, materialsTruncated = false;
    const sessions = [...new Set(after ? changeRows.map(row => row.source_session_id) : messages.map(message => message.sessionId))];
    if (sessions.length) {
      try {
        // Savepoint keeps an unavailable artifact table/row from erasing healthy
        // text. Every selected session already has proven adult-owned content.
        const materialRows = await tx.savepoint(st => st<ChatHistoryMaterialRow[]>`
          select m.id,m.title,m.kind,m.skill,m.preview_url,m.pdf_url,m.created_at::text,m.status,m.revises,
            coalesce(linked.session_id,m.generation->>'sessionId') as session_id,m.generation->'input'->>'childName' as child_name,
            m.generation->'review'->>'pass' as review_pass,m.generation->>'pageCount' as page_count,
            m.generation->'pagePreviewUrls' as page_preview_urls,m.generation->'familySources' as family_sources
          from public.materials m
          left join lateral (
            select 'job:'||l.job_id::text as session_id from public.conversation_jobs l
            join public.conversation_requests r on r.id=l.request_id
            join public.agent_job_stage_artifacts a on a.job_id=l.job_id and a.family_id=m.family_id and a.material_id=m.id
            where l.conversation_id=${record.id} and l.access_epoch=${principal.accessEpoch} and l.state<>'revoked'
              and r.canonical_message_id is not null and ('job:'||l.job_id::text)=any(${sessions}::text[]) limit 1
          ) linked on true
          where m.family_id=${principal.familyId} and m.deleted_at is null
            and (linked.session_id is not null or (
              m.generation->>'sessionId'=any(${sessions}::text[])
              and exists (select 1 from public.conversation_messages visible
                where visible.family_id=${principal.familyId} and visible.member_user_id=${principal.memberUserId}
                  and visible.visibility='family' and visible.session_id=m.generation->>'sessionId'
                  and (visible.role='user' or visible.channel='web' or exists (
                    select 1 from public.conversation_deliveries d where d.family_id=${principal.familyId}
                      and d.message_id=visible.id and d.recipient_member_user_id=${principal.memberUserId} and d.status='sent')))))
          order by created_at desc,id desc limit 101`);
        materialsTruncated = materialRows.length > 100;
        materials = selectParentVisibleMaterialRevisions(materialRows.slice(0, 100).map(toChatHistoryMaterial)
          .filter((material): material is ChatHistoryMaterial => material !== null));
      } catch { materialsUnavailable = true; }
    }
    const common = { account, conversationId: record.id, accessEpoch: record.access_epoch,
      materials, ...(materialsUnavailable ? { materialsUnavailable: true } : {}),
      ...(materialsTruncated ? { materialsTruncated: true } : {}),
      requests: pending.slice(0, 100).map(row => ({ requestId: row.request_id, intentId: row.intent_id, state: row.state })),
      requestsTruncated: pending.length > 100 };
    if (options.materialIds) return { account, conversationId: record.id, accessEpoch: record.access_epoch,
      mode: "materials" as const, materials, materialSessions: sessions, requestedMessageIds: options.materialIds,
      ...(materialsUnavailable ? { materialsUnavailable: true } : {}), ...(materialsTruncated ? { materialsTruncated: true } : {}) };
    const changeCursor = (position: string) => encodeConversationChangeCursor({ version: 1, kind: "changes", account,
      accessEpoch: record.access_epoch, position });
    if (after) {
      const byId = new Map(messages.map(message => [message.id, message]));
      return { ...common, mode: "changes" as const, changes: changedIds.map(messageId => {
        const message = byId.get(messageId);
        return message ? { kind: "upsert" as const, message } : { kind: "delete" as const, messageId };
      }), nextChangeCursor: changeCursor(changeRows.at(-1)?.position ?? after.position),
      hasMore: invalidations.length > limit, materialSessions: sessions };
    }
    const oldest = pageRows.at(-1);
    return { ...common, mode: "snapshot" as const, messages, changeCursor: changeCursor(record.feed_position), hasOlder: rows.length > limit,
      nextCursor: rows.length > limit && oldest ? encodeConversationFeedCursor({ version: 1, account,
        accessEpoch: record.access_epoch, at: oldest.created_at, id: oldest.id }) : null };
  }) as ConversationFeedPage | ConversationFeedChanges | ConversationFeedMaterials;
}

export interface ConversationFeedDependencies {
  enabled(): boolean;
  principal(request: Request): Promise<RecordingPrincipal | null>;
  access: typeof readConversationAccess;
  read: typeof readConversationFeed;
  changes: typeof readConversationFeedChanges;
  materials: typeof readConversationFeedMaterials;
  limited(account: string): boolean;
}
const production: ConversationFeedDependencies = {
  enabled: () => process.env.HOMA_CONVERSATION_REQUESTS === "1" && process.env.HOMA_CONVERSATION_RECORDING === "1",
  principal: resolveConversationRequestPrincipal, access: readConversationAccess, read: readConversationFeed, changes: readConversationFeedChanges,
  materials: readConversationFeedMaterials,
  limited: account => rateLimited(`conversation-feed:${account}`, 300),
};

function response(body: object, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store", vary: "Authorization",
    ...(status === 429 || status === 503 ? { "retry-after": "5" } : {}) } });
}

export async function conversationFeedResponse(request: Request, dependencies: ConversationFeedDependencies = production) {
  if (!dependencies.enabled()) return response({ reason: "unavailable" }, 503);
  if (request.method !== "GET") return response({ reason: "method" }, 405);
  if (requestAuthTransport(request).kind !== "bearer") return response({ reason: "sign_in" }, 401);
  try {
    const principal = await dependencies.principal(request);
    if (!principal) return response({ reason: "sign_in" }, 401);
    const account = `${principal.familyId}:${principal.memberUserId}`;
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some(key => !["account", "accessEpoch", "limit", "before", "after", "materialsFor"].includes(key)) ||
        [...new Set(params.keys())].some(key => params.getAll(key).length !== 1)) return response({ reason: "invalid" }, 400);
    if (params.get("account") !== account) return response({ reason: "account_changed" }, 409);
    const suppliedEpoch = params.get("accessEpoch"), rawLimit = params.get("limit"), before = params.get("before");
    const after = params.get("after");
    const materialsFor = params.get("materialsFor");
    const limit = rawLimit === null ? 40 : /^\d{1,3}$/u.test(rawLimit) ? Number(rawLimit) : NaN;
    if ((suppliedEpoch !== null && !uuid.safeParse(suppliedEpoch).success) || ((before !== null || after !== null || materialsFor !== null) && !suppliedEpoch) ||
        !Number.isInteger(limit) || limit < 1 || limit > 100 || before === "" || after === "" || materialsFor === "" ||
        [before, after, materialsFor].filter(value => value !== null).length > 1) {
      return response({ reason: "invalid" }, 400);
    }
    if (dependencies.limited(account)) return response({ reason: "retry" }, 429);
    // Newest-page polling discovers membership generation changes. Once paging
    // starts, every older request must keep the first response's exact epoch.
    const accessEpoch = suppliedEpoch ?? (await dependencies.access(principal)).accessEpoch;
    if (materialsFor) {
      const messageIds = materialsFor.split(",");
      if (messageIds.length > 100 || messageIds.some(id => !uuid.safeParse(id).success)) return response({ reason: "invalid" }, 400);
      return response(await dependencies.materials({ ...principal, accessEpoch }, { messageIds }));
    }
    if (after) {
      decodeConversationChangeCursor(after, account, accessEpoch);
      return response(await dependencies.changes({ ...principal, accessEpoch }, { limit, after }));
    }
    if (before) decodeConversationFeedCursor(before, account, accessEpoch);
    return response(await dependencies.read({ ...principal, accessEpoch }, { limit, ...(before ? { before } : {}) }));
  } catch (error) {
    if (error instanceof ConversationRequestError) return response({ reason: error.code },
      error.code === "invalid" ? 400 : error.code === "membership" ? 403 : 409);
    return response({ reason: "retry" }, 503);
  }
}
