import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { getShelfBooksPinned } from "../../lib/agent-pinned";

/**
 * The family's bookshelf (Shelf feature, 2026-07-19): lets the agent see
 * which physical reference books the family owns so lessons, unit studies,
 * and materials can cite specific books and page ranges instead of generic
 * "find a book about X" suggestions. Cover and table-of-contents photos
 * are URLs the agent can pass to generate_image as visual references or
 * describe to the parent ("open the green book with the frog on the cover").
 */

export interface ShelfBookResult {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string;
  tocUrl: string | null;
  notes: string | null;
}

const MAX_RESULTS = 50;

export default defineBoundedTool({
  description:
    "List the physical books and reference texts this family uploaded to their Shelf. Use before building a lesson or unit study to ground recommendations in books the family actually owns. Each book has a title, optional author, cover photo URL, optional table-of-contents photo URL, and optional notes the parent added. When you find a match, tell the parent to open their copy by title and describe what to look for (chapter, section, page range) based on the TOC or your curriculum knowledge.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z.object({
    search: z
      .string()
      .trim()
      .max(120)
      .optional()
      .describe(
        "Optional text filter: substring match against title, author, or notes. Omit to list all books.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_RESULTS)
      .optional()
      .describe("Max results (default 20)."),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { books: [], note: error.message };
      }
      throw error;
    }

    const limit = input.limit ?? 20;

    if (access.mode === "pinned") {
      const books = await getShelfBooksPinned(access.familyId, {
        search: input.search,
        limit,
      });
      return { books };
    }

    const { db, familyId } = access;

    let query = db
      .from("shelf_books")
      .select("id, title, author, cover_url, toc_url, notes")
      .eq("family_id", familyId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (input.search) {
      // ilike across title, author, and notes — same pattern as recall's
      // full-text search fallback. Supabase PostgREST `or` filter.
      const pattern = `%${input.search}%`;
      query = query.or(
        `title.ilike.${pattern},author.ilike.${pattern},notes.ilike.${pattern}`,
      );
    }

    const { data, error } = await query;

    if (error) {
      return {
        books: [],
        note: `Could not read shelf books: ${error.message}`,
      };
    }

    const books: ShelfBookResult[] = (data ?? []).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      author: (row.author as string | null) ?? null,
      coverUrl: row.cover_url as string,
      tocUrl: (row.toc_url as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
    }));

    return {
      books,
      note:
        books.length === 0
          ? input.search
            ? "No shelf books match that search. The family may not own a book on this topic — suggest one instead."
            : "This family hasn't added any books to their Shelf yet."
          : undefined,
    };
  },
});
