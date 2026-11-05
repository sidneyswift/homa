import { storeConversationAttachmentPreparation } from "../../../../lib/conversation-attachments";
import { conversationRecordingEnabled } from "../../../../lib/conversation-recording";
import { resolveApiFamily } from "../../../../lib/api-auth";
import { isFamilyChatAttachmentUrl } from "../../../../lib/attachments/markers";
import {
  normalizeChatAttachments,
  type ChatAttachmentInput,
} from "../../../../lib/attachments/normalize-chat-attachments";
import { deleteFamilyBlob } from "../../../../lib/family-blob";
import { mapDb } from "../../../../lib/map/db";
import { emitMapEvent } from "../../../../lib/map/events";

/**
 * The chat attach flow's step 2 (after /api/chat/upload): the composer
 * trades its uploaded blob URLs for everything the send needs.
 *
 * POST { items: [{url, mediaType, name}], childId? } ->
 *   { ok, parts, textBlocks, receipts }
 *
 * The route (never the client, never the model) is where tenancy holds:
 * every URL must sit inside THIS family's own chat blob space, and the
 * optional childId (the context switcher's selection, "About Maya")
 * must be one of THIS family's children, verified under the caller's
 * own RLS. Rows land in chat_attachments through the server-only
 * connection, which is the only writer (migration #80).
 *
 * DELETE ?id= : the receipt chip's Undo. Removes the row and deletes
 * the blob, scoped to the caller's family.
 */

const MAX_ITEMS_PER_MESSAGE = 6;

interface PrepareBody {
  items?: Array<{ url?: unknown; mediaType?: unknown; name?: unknown }>;
  childId?: unknown;
}

export interface ChatAttachmentReceipt {
  id: string;
  kind: string;
  outcome: string;
  caption: string | null;
  childId: string | null;
}

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let body: PrepareBody;
  try {
    body = (await request.json()) as PrepareBody;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0 || rawItems.length > MAX_ITEMS_PER_MESSAGE) {
    return Response.json({ ok: false, reason: "bad-items" }, { status: 400 });
  }
  const items: ChatAttachmentInput[] = [];
  for (const raw of rawItems) {
    const url = typeof raw.url === "string" ? raw.url : "";
    if (!isFamilyChatAttachmentUrl(url, auth.familyId)) {
      return Response.json({ ok: false, reason: "bad-url" }, { status: 400 });
    }
    items.push({
      url,
      mediaType: typeof raw.mediaType === "string" ? raw.mediaType : "application/octet-stream",
      name: typeof raw.name === "string" && raw.name.trim().length > 0
        ? raw.name.trim().slice(0, 120)
        : null,
    });
  }

  // The child this files under: a UI hint until verified against the
  // family's own roster, under the caller's token (tenancy law).
  let childId: string | null = null;
  if (typeof body.childId === "string" && body.childId.length > 0) {
    const { data: child } = await auth.supabase
      .from("children")
      .select("id")
      .eq("id", body.childId)
      .eq("family_id", auth.familyId)
      .maybeSingle();
    childId = (child?.id as string | undefined) ?? null;
  }

  const normalized = await normalizeChatAttachments(items, auth.familyId);

  const receipts: ChatAttachmentReceipt[] = [];
  // Durable recording keeps one retry-safe receipt per adult and blob. With
  // recording off (and before its migrations exist) the original insert stays.
  const recording = conversationRecordingEnabled();
  const sql = mapDb();
  for (const item of normalized) {
    if (recording) {
      receipts.push(await storeConversationAttachmentPreparation({ familyId: auth.familyId,
        memberUserId: auth.userId, childId, item }));
    } else {
      const [row] = await sql`
        insert into public.chat_attachments (
          family_id, child_id, member_user_id, url, media_type, kind, caption
        )
        values (
          ${auth.familyId},
          ${childId},
          ${auth.userId},
          ${item.input.url},
          ${item.input.mediaType},
          ${item.kind},
          ${item.caption}
        )
        returning id
      `;
      receipts.push({
        id: row?.id as string,
        kind: item.kind,
        outcome: item.outcome,
        caption: item.caption,
        childId,
      });
    }
    await emitMapEvent(
      "chat.attachment_processed",
      {
        kind: item.kind,
        media_type: item.input.mediaType,
        outcome: item.outcome,
        filed_to_child: childId !== null,
      },
      { familyId: auth.familyId },
    );
  }

  return Response.json({
    ok: true,
    receipts,
    // Model-facing content, in attachment order: conversion blocks
    // (transcripts, extractions, failure notes) then marker lines.
    textBlocks: [
      ...normalized.map((item) => item.block).filter((block): block is string => block !== null),
      ...normalized.map((item) => item.marker),
    ],
    parts: normalized
      .map((item) => item.part)
      .filter((part): part is NonNullable<typeof part> => part !== null),
  });
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/iu.test(id)) {
    return Response.json({ ok: false, reason: "bad-id" }, { status: 400 });
  }

  const sql = mapDb();
  // The family_id predicate is the wall: a foreign id deletes nothing.
  const rows = await sql`
    delete from public.chat_attachments
    where id = ${id} and family_id = ${auth.familyId}
    returning url
  `;
  const url = rows[0]?.url as string | undefined;
  if (!url) {
    return Response.json({ ok: false, reason: "not-found" }, { status: 404 });
  }
  try {
    await deleteFamilyBlob(url, auth.familyId, "chat");
  } catch (error) {
    // The record is gone either way; a stray blob is unreachable
    // (random suffix) and harmless.
    console.error(
      "chat attachment blob delete failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }
  return Response.json({ ok: true });
}
