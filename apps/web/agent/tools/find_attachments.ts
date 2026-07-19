import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { mapDb } from "../../lib/map/db";

/**
 * The chat attachment recall path: files a parent shared in web chat
 * persist in public.chat_attachments (migration #80) with a caption,
 * but a new session cannot see the original message, so without this
 * read tool the studio would ask her to re-upload something she
 * already sent. familyId always comes from session auth, never from
 * the model; the childId filter only narrows within that family. The
 * blob URLs live under families/{familyId}/chat/, so they pass
 * isFamilyArtifactUrl and work directly as generate_image references
 * and in create_printable html.
 *
 * Results are metadata plus URL only. eve tool results reach the model
 * as text or json exclusively (ToolModelOutput in eve's
 * shared/tool-definition), so there is no way to return viewable image
 * bytes; the caption is the model's eyes here.
 */

export const ATTACHMENT_KINDS = [
  "image",
  "audio",
  "video",
  "document",
  "text",
  "other",
] as const;

export interface ChatAttachmentDbRow {
  url: string;
  caption: string | null;
  kind: string;
  media_type: string;
  child_id: string | null;
  created_at: string;
}

export interface ChatAttachmentSummary {
  url: string;
  caption: string | null;
  kind: string;
  mediaType: string;
  childId: string | null;
  createdAt: string;
}

export function toAttachmentSummary(
  row: ChatAttachmentDbRow,
): ChatAttachmentSummary {
  return {
    url: row.url,
    caption: row.caption,
    kind: row.kind,
    mediaType: row.media_type,
    childId: row.child_id,
    createdAt: row.created_at,
  };
}

export function subjectLessonAttachmentRestriction(
  attributes: unknown,
): string | null {
  const channel = (
    attributes as { channel?: unknown } | null | undefined
  )?.channel;
  return channel === "subject_lesson"
    ? "Automatic lesson builds cannot use chat attachments. Use an HTML-only subject lesson worksheet."
    : null;
}

interface AttachmentFilters {
  kind?: (typeof ATTACHMENT_KINDS)[number];
  childId?: string;
  limit: number;
}

async function findAttachmentsPinned(
  familyId: string,
  filters: AttachmentFilters,
): Promise<ChatAttachmentDbRow[]> {
  const sql = mapDb();
  return await sql<ChatAttachmentDbRow[]>`
    select url, caption, kind, media_type, child_id,
           created_at::text as created_at
    from public.chat_attachments
    where family_id = ${familyId}
      and (${!filters.kind} or kind = ${filters.kind ?? null})
      and (${!filters.childId} or child_id = ${filters.childId ?? null})
    order by created_at desc
    limit ${filters.limit}
  `;
}

export default defineTool({
  description:
    "List files the parent has shared in chat (photos, PDFs, documents), newest first, each with its url, caption, kind, and date. Use it when she refers to something she already sent ('the photo I sent you', 'that page from last week'), especially in a later session where the original message is out of reach; never ask her to re-send a file this can find. An image url here is inside this family's own space: pass it to generate_image as a referenceImageUrls entry, or embed it with <img src=\"...\"> in create_printable html.",
  inputSchema: z.object({
    kind: z
      .enum(ATTACHMENT_KINDS)
      .optional()
      .describe("Only attachments of this kind, e.g. image for shared photos."),
    childId: z
      .uuid()
      .optional()
      .describe(
        "Only attachments filed under this child. Files sent without a child selected are family-wide and excluded by this filter, so leave it off unless the filing matters.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(12)
      .optional()
      .describe("Defaults to 8."),
  }),
  async execute(input, ctx) {
    const restriction = subjectLessonAttachmentRestriction(
      ctx.session.auth.current?.attributes,
    );
    if (restriction) {
      return { attachments: [], note: restriction };
    }

    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { attachments: [], note: error.message };
      }
      throw error;
    }

    const filters: AttachmentFilters = {
      kind: input.kind,
      childId: input.childId,
      limit: input.limit ?? 8,
    };

    let rows: ChatAttachmentDbRow[];
    if (access.mode === "pinned") {
      rows = await findAttachmentsPinned(access.familyId, filters);
    } else {
      let query = access.db
        .from("chat_attachments")
        .select("url, caption, kind, media_type, child_id, created_at")
        .eq("family_id", access.familyId)
        .order("created_at", { ascending: false })
        .limit(filters.limit);
      if (filters.kind) query = query.eq("kind", filters.kind);
      if (filters.childId) query = query.eq("child_id", filters.childId);
      const { data, error } = await query;
      if (error) {
        console.error("chat attachment search failed:", error.message);
        throw new Error("Could not search this family's chat attachments.");
      }
      rows = (data ?? []) as unknown as ChatAttachmentDbRow[];
    }

    return {
      attachments: rows.map(toAttachmentSummary),
      note:
        rows.length > 0
          ? "Pick by caption and date. An image url here is from this family's own space: pass it to generate_image as a referenceImageUrls entry, or embed it with <img src=\"...\"> in create_printable html. Never ask the parent to re-send a file listed here."
          : "No chat attachments recorded for this family (or none match these filters). It is fine to ask the parent to share the file in chat.",
    };
  },
});
