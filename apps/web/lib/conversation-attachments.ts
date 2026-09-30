import type { UserContent } from "ai";
import type { TransactionSql } from "postgres";
import { z } from "zod";

import { isFamilyChatAttachmentUrl } from "./attachments/markers";
import type { NormalizedChatAttachment } from "./attachments/normalize-chat-attachments";
import { signedFamilyBlobReadUrl } from "./family-blob";
import { mapDb } from "./map/db";
import type { ConversationRequestPrincipal } from "./conversation-requests";

const ids = z.array(z.string().uuid()).max(6).refine(values => new Set(values).size === values.length);
const text = z.string().refine(value => !value.includes("\0") && value.isWellFormed());
const preparation = z.object({ version: z.literal(1), mediaType: text.max(160),
  filename: text.max(120).nullable(), block: text.nullable(), marker: text,
  native: z.boolean(), outcome: text.max(40), kind: z.enum(["image","audio","video","document","text","other"]),
}).strict();
export type ConversationAttachmentPreparation = z.infer<typeof preparation>;

export function normalizeConversationAttachmentIds(value: unknown): string[] {
  const normalized = ids.parse(value ?? []).map(id => id.toLowerCase());
  if (new Set(normalized).size !== normalized.length) throw new Error("Duplicate attachment");
  return normalized;
}

/** Signed links never enter durable payloads. The private blob identity does. */
export function conversationAttachmentPreparation(item: NormalizedChatAttachment): ConversationAttachmentPreparation {
  return preparation.parse({ version: 1, mediaType: item.part?.mediaType ?? item.input.mediaType,
    filename: item.input.name, block: item.block, marker: item.marker,
    native: item.part !== null, outcome: item.outcome, kind: item.kind });
}

export interface AdmittedConversationAttachment {
  id: string; url: string; payload: ConversationAttachmentPreparation;
}

/** The caller holds the current adult record lock in the acceptance transaction.
 * A receipt from a different adult, even in the same family, is not admission. */
export async function verifyConversationAttachments(tx: TransactionSql, principal: ConversationRequestPrincipal,
  attachmentIds: readonly string[]): Promise<AdmittedConversationAttachment[]> {
  if (!attachmentIds.length) return [];
  const rows = await tx<{ id: string; url: string; payload: unknown }[]>`
    select a.id,a.url,p.payload from public.chat_attachments a
    join public.conversation_attachment_preparations p on p.attachment_id=a.id
      and p.family_id=a.family_id and p.member_user_id=a.member_user_id and p.blob_url=a.url
    join public.conversation_records c on c.family_id=a.family_id and c.member_user_id=a.member_user_id
    join public.family_members fm on fm.family_id=c.family_id and fm.user_id=c.member_user_id
    join public.families f on f.id=c.family_id
    where a.id in ${tx(attachmentIds)} and a.family_id=${principal.familyId} and a.member_user_id=${principal.memberUserId}
      and c.access_epoch=${principal.accessEpoch} and f.status <> 'deleted'
    for key share of a,p,fm,f`;
  return attachmentIds.map(id => {
    const row = rows.find(item => item.id === id);
    if (!row || !isFamilyChatAttachmentUrl(row.url,principal.familyId)) throw new Error("Conversation attachment unavailable");
    return { id, url: row.url, payload: preparation.parse(row.payload) };
  });
}

export async function linkConversationAttachments(tx: TransactionSql, requestId: string, attachments: readonly AdmittedConversationAttachment[]) {
  for (const [ordinal,item] of attachments.entries()) await tx`
    insert into public.conversation_request_attachments(request_id,ordinal,original_attachment_id,attachment_id)
    values (${requestId},${ordinal},${item.id},${item.id})`;
}

export async function requestConversationAttachmentIds(tx: TransactionSql, requestId: string): Promise<string[]> {
  const rows = await tx<{ original_attachment_id: string; attachment_id: string | null }[]>`
    select original_attachment_id,attachment_id from public.conversation_request_attachments
    where request_id=${requestId} order by ordinal`;
  if (rows.some(row => !row.attachment_id)) throw new Error("Conversation attachment erased");
  return rows.map(row => row.original_attachment_id);
}

/** Mirrors installed Eve's message.received summary without accepting a client
 * summary. Original user text stays a separate unchanged canonical value. */
export function conversationRuntimeInput(text: string, attachments: readonly AdmittedConversationAttachment[]) {
  if (!attachments.length) return { message: text as UserContent, summary: text };
  const message: Exclude<UserContent,string> = [{ type: "text",text }];
  for (const attachment of attachments) {
    const item = attachment.payload;
    if (item.block !== null) message.push({ type: "text",text: item.block });
    message.push({ type: "text",text: item.marker });
    if (item.native) message.push({ type: "file",data: attachment.url,mediaType: item.mediaType,
      ...(item.filename !== null ? { filename: item.filename } : {}) });
  }
  const summary = message.map(part => part.type === "text" ? part.text : part.type === "file"
    ? `[file: ${part.filename ?? part.mediaType} (${part.mediaType})]` : "").join("\n");
  return { message,summary };
}

export async function loadConversationRuntimeInputInTransaction(tx: TransactionSql, principal: ConversationRequestPrincipal,
  requestId: string, text: string) {
  const attachmentIds = await requestConversationAttachmentIds(tx,requestId);
  return conversationRuntimeInput(text,await verifyConversationAttachments(tx,principal,attachmentIds));
}

/** Refresh URLs at dispatch, never during admission and never from browser data.
 * Rechecking the lease and adult generation prevents a removed login from
 * obtaining another signed read URL for a queued request. */
export async function loadConversationDispatchInput(principal: ConversationRequestPrincipal, requestId: string,
  leaseToken: string, text: string, sign = signedFamilyBlobReadUrl): Promise<UserContent> {
  const input = await mapDb().begin(async tx => {
    const rows = await tx`select r.id from public.conversation_requests r
      join public.conversation_records c on c.id=r.conversation_id
      join public.family_members fm on fm.family_id=c.family_id and fm.user_id=c.member_user_id
      join public.families f on f.id=c.family_id
      where r.id=${requestId} and r.lease_token=${leaseToken} and r.state='leased' and r.lease_until > clock_timestamp()
        and c.family_id=${principal.familyId} and c.member_user_id=${principal.memberUserId}
        and c.access_epoch=${principal.accessEpoch} and r.access_epoch=c.access_epoch and f.status <> 'deleted'`;
    if (!rows.length) throw new Error("Conversation attachment access changed");
    return loadConversationRuntimeInputInTransaction(tx,principal,requestId,text);
  });
  if (typeof input.message === "string") return input.message;
  return Promise.all(input.message.map(async part => part.type === "file"
    ? { ...part,data: await sign(String(part.data),principal.familyId,"chat") } : part));
}

/** Upload preparation retries retain one server receipt for the same adult and
 * blob. Conversions may run twice after an uncertain response; no second receipt
 * or second accepted message is created. No network work occurs under this lock. */
export async function storeConversationAttachmentPreparation(input: {
  familyId: string; memberUserId: string; childId: string | null; item: NormalizedChatAttachment;
}) {
  const payload = conversationAttachmentPreparation(input.item);
  return mapDb().begin(async tx => {
    const members = await tx`select fm.user_id from public.family_members fm join public.families f on f.id=fm.family_id
      where fm.family_id=${input.familyId} and fm.user_id=${input.memberUserId} and f.status <> 'deleted' for key share of fm,f`;
    if (!members.length || !isFamilyChatAttachmentUrl(input.item.input.url,input.familyId)) throw new Error("Attachment access changed");
    await tx`select pg_advisory_xact_lock(hashtextextended(${`${input.familyId}:${input.memberUserId}:${input.item.input.url}`},0))`;
    const [existing] = await tx<{ id: string; kind: string; caption: string | null; child_id: string | null; payload: ConversationAttachmentPreparation }[]>`
      select a.id,a.kind,a.caption,a.child_id,p.payload from public.conversation_attachment_preparations p
      join public.chat_attachments a on a.id=p.attachment_id
      where p.family_id=${input.familyId} and p.member_user_id=${input.memberUserId} and p.blob_url=${input.item.input.url}`;
    if (existing) return { id: existing.id,kind: existing.kind,outcome: existing.payload.outcome,caption: existing.caption,childId: existing.child_id };
    const [row] = await tx<{ id: string }[]>`insert into public.chat_attachments
      (family_id,child_id,member_user_id,url,media_type,kind,caption)
      values (${input.familyId},${input.childId},${input.memberUserId},${input.item.input.url},${payload.mediaType},${payload.kind},${input.item.caption}) returning id`;
    await tx`insert into public.conversation_attachment_preparations(attachment_id,family_id,member_user_id,blob_url,payload)
      values (${row.id},${input.familyId},${input.memberUserId},${input.item.input.url},${tx.json(payload)})`;
    return { id: row.id,kind: payload.kind,outcome: payload.outcome,caption: input.item.caption,childId: input.childId };
  });
}
