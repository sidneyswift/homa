import { emitEvent } from "@homa/core";
import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { logGap } from "../../lib/knowledge/gaps";
import { recallPinned } from "../../lib/agent-pinned";
import { embedText } from "../../lib/learning/embeddings";
import { effectiveTimeZone } from "../../lib/time-zone";

/**
 * The agent's grep over its own past (agentic ladder item 4, M2-15):
 * full-text search across this family's phone-call transcripts, chat
 * history, and saved memories. Every query runs under the caller's own
 * token, so RLS is the tenancy wall (the same posture as every other
 * tool), and the family_id filter inside each query is belt on top of
 * that brace. Results are compact snippets, not whole transcripts:
 * enough to answer from, small enough to keep the turn cheap.
 */

const SNIPPET_RADIUS = 220;
const MAX_SNIPPET = 480;

interface RecallHit {
  when: string;
  where: string;
  snippet: string;
}

function snippetAround(text: string, query: string): string {
  const haystack = text.toLowerCase();
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);
  let at = -1;
  for (const word of words) {
    at = haystack.indexOf(word);
    if (at >= 0) break;
  }
  if (at < 0) return text.slice(0, MAX_SNIPPET);
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(text.length, at + SNIPPET_RADIUS);
  return `${start > 0 ? "..." : ""}${text.slice(start, end).trim()}${end < text.length ? "..." : ""}`;
}

function dayOf(iso: string | null, timeZone: string): string {
  if (!iso) return "unknown date";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
}

export default defineTool({
  description:
    "Search this family's own history with Homa: past phone calls, past chat messages, and saved memories. Use whenever the parent refers to something you do not see in the current context ('like we talked about', 'that plan from last week', 'what did I say about...') before ever saying you do not know or remember.",
  inputSchema: z.object({
    query: z
      .string()
      .min(2)
      .max(200)
      .describe("Plain words to search for, e.g. 'phonics plan' or 'co-op Fridays'."),
    scope: z
      .enum(["calls", "chats", "memories", "all"])
      .default("all")
      .describe("Where to look. Default 'all'."),
    limit: z.number().int().min(1).max(10).default(5),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { found: 0, note: error.message };
      }
      throw error;
    }

    if (access.mode === "pinned") {
      const results = await recallPinned({
        familyId: access.familyId,
        query: input.query,
        scope: input.scope,
        limit: input.limit,
      });
      if (results.length === 0) {
        // Best-effort knowledge gap logging on recall miss
        try {
          await logGap(input.query, input.query, access.familyId, "recall_miss");
        } catch {
          // Gap logging must never break recall.
        }
        return {
          found: 0,
          note: "Nothing in this family's history matches those words. A miss never proves the conversation did not happen: try different words once, then ask the parent for a detail instead of guessing or denying.",
        };
      }
      return { found: results.length, results };
    }

    const { db, familyId } = access;
    const { data: family } = await db
      .from("families")
      .select("time_zone")
      .eq("id", familyId)
      .maybeSingle();
    const timeZone = effectiveTimeZone(family?.time_zone);

    const hits: RecallHit[] = [];
    const searchText = { type: "websearch" as const, config: "english" };

    if (input.scope === "calls" || input.scope === "all") {
      const { data } = await db
        .from("call_transcripts")
        .select("line, transcript_text, started_at")
        .eq("family_id", familyId)
        .textSearch("transcript_text", input.query, searchText)
        .order("started_at", { ascending: false })
        .limit(input.limit);
      for (const row of data ?? []) {
        hits.push({
          when: dayOf(row.started_at, timeZone),
          where: row.line === "curriculum" ? "phone call (report review)" : "phone call",
          snippet: snippetAround(row.transcript_text ?? "", input.query),
        });
      }
    }

    if (input.scope === "chats" || input.scope === "all") {
      // chat-privacy-per-adult (2026-07-12): another adult's own words
      // never surface in this adult's recall. Their user rows carry
      // their member_user_id and are excluded here; unattributed rows
      // (Homa's replies, legacy history) stay searchable. Full
      // enforcement, including the semantic RPC, lands with the M1-02
      // policy tightening (build-log follow-up).
      const attrs = ctx.session.auth.current?.attributes as
        | { memberUserId?: string }
        | undefined;
      const callerFilter =
        typeof attrs?.memberUserId === "string" && attrs.memberUserId.length > 0
          ? `member_user_id.eq.${attrs.memberUserId},member_user_id.is.null`
          : null;
      let chatQuery = db
        .from("conversation_messages")
        .select("role, content, channel, created_at")
        .eq("family_id", familyId)
        .textSearch("content", input.query, searchText)
        .order("created_at", { ascending: false })
        .limit(input.limit);
      if (callerFilter) chatQuery = chatQuery.or(callerFilter);
      const { data } = await chatQuery;
      for (const row of data ?? []) {
        const speaker = row.role === "user" ? "the parent" : "Homa";
        hits.push({
          when: dayOf(row.created_at, timeZone),
          where: `${row.channel === "sms" ? "text message" : "chat"} (${speaker})`,
          snippet: snippetAround(row.content ?? "", input.query),
        });
      }
    }

    if (input.scope === "memories" || input.scope === "all") {
      const { data } = await db
        .from("family_memories")
        .select("content, kind, created_at, superseded_at")
        .eq("family_id", familyId)
        .textSearch("content", input.query, searchText)
        .order("created_at", { ascending: false })
        .limit(input.limit);
      for (const row of data ?? []) {
        const base = row.kind === "what_works" ? "saved memory (what works)" : "saved memory";
        hits.push({
          when: dayOf(row.created_at, timeZone),
          // Superseded rows stay searchable for point-in-time questions,
          // labeled so the model never presents an old fact as current.
          where: row.superseded_at ? `${base}, older note that was later corrected` : base,
          snippet: row.content ?? "",
        });
      }
    }

    // Semantic fallback (migration #38): when lexical search comes up
    // short, meaning-based search catches paraphrases ("her nut thing"
    // for the allergy) and word choices FTS's AND-semantics miss. The
    // RPC is SECURITY INVOKER, so the caller's own RLS decides which
    // rows exist for it; no family parameter can be gotten wrong.
    if (hits.length < input.limit) {
      const queryEmbedding = await embedText(input.query, { familyId });
      if (queryEmbedding) {
        const { data: semantic } = await db.rpc("recall_semantic", {
          query_embedding: queryEmbedding,
          match_limit: input.limit,
        });
        const scopeOf: Record<string, "calls" | "chats" | "memories"> = {
          call: "calls",
          chat: "chats",
          memory: "memories",
        };
        const seen = new Set(hits.map((hit) => hit.snippet.slice(0, 80)));
        for (const row of (semantic ?? []) as {
          source: string;
          happened_at: string | null;
          label: string;
          content: string;
        }[]) {
          const rowScope = scopeOf[row.source];
          if (!rowScope) continue;
          if (input.scope !== "all" && input.scope !== rowScope) continue;
          const snippet =
            rowScope === "calls"
              ? snippetAround(row.content ?? "", input.query)
              : (row.content ?? "").slice(0, MAX_SNIPPET);
          if (seen.has(snippet.slice(0, 80))) continue;
          seen.add(snippet.slice(0, 80));
          hits.push({ when: dayOf(row.happened_at, timeZone), where: row.label, snippet });
        }
      }
    }

    const results = hits.slice(0, input.limit);

    // Best-effort analytics under the caller's own token (chat.% policy).
    const attributes = ctx.session.auth.current?.attributes as
      | { supabaseAccessToken?: string; familyId?: string }
      | undefined;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (url && key && attributes?.supabaseAccessToken && attributes.familyId) {
      await emitEvent(
        {
          supabaseUrl: url,
          supabaseKey: key,
          accessToken: attributes.supabaseAccessToken,
          familyId: attributes.familyId,
        },
        "chat.recall_used",
        { scope: input.scope, results: results.length },
      );
    }

    if (results.length === 0) {
      // Best-effort knowledge gap logging on recall miss
      try {
        await logGap(input.query, input.query, familyId, "recall_miss");
      } catch {
        // Gap logging must never break recall.
      }
      return {
        found: 0,
        note: "Nothing in this family's history matches those words. A miss never proves the conversation did not happen: try different words once, then ask the parent for a detail instead of guessing or denying.",
      };
    }
    return { found: results.length, results };
  },
});
