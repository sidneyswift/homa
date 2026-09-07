import { MAP_INTERESTS_CAP } from "@homa/core";

import { ageInMonths } from "./child-age";
import { captureHoursPinned, hoursCaptureDisplayFields, type HoursCaptureInput } from "./hours-capture";
import { embedText } from "./learning/embeddings";
import { mapDb } from "./map/db";
import { emitMapEvent } from "./map/events";
import { effectiveTimeZone } from "./time-zone";

/**
 * Family-pinned tool operations for sessions with no caller JWT (the SMS
 * channel; agentic SMS loop, founder direction 2026-07-09 evening). The
 * trust basis is the parent-written family_phones mapping the channel
 * already authenticated on, the SAME basis the voice webhook tools write
 * with. Every function takes familyId from session auth (never model
 * input), re-verifies any model-supplied child inside THAT family, and
 * funnels writes through the shared guards. Interim until M1-02's SET
 * LOCAL role; the swap point is lib/agent-db.ts resolveAgentAccess.
 */

export interface PinnedChild {
  id: string;
  name: string;
  ageYears: number;
  ageMonths: number;
  interests: string[];
  focus: string | null;
  /** The D4-consented profile photo (migration #75), a generate_image
   * reference for materials that show this child; null when unset. */
  photoUrl: string | null;
}

export async function getChildrenPinned(familyId: string): Promise<PinnedChild[]> {
  const sql = mapDb();
  const rows = await sql<
    {
      id: string;
      name: string;
      birth_month: string;
      profile: Record<string, unknown> | null;
      avatar_url: string | null;
    }[]
  >`
    select id, name, to_char(birth_month, 'YYYY-MM-DD') as birth_month, profile, avatar_url
    from public.children where family_id = ${familyId}
    order by created_at
  `;
  const now = new Date();
  return rows.map((child) => {
    const months = ageInMonths(child.birth_month, now);
    const profile = (child.profile ?? {}) as { interests?: string[]; focus?: string };
    return {
      id: child.id,
      name: child.name,
      ageYears: Math.floor(months / 12),
      ageMonths: months,
      interests: profile.interests ?? [],
      focus: profile.focus ?? null,
      photoUrl: child.avatar_url,
    };
  });
}

export async function updateChildProfilePinned(input: {
  familyId: string;
  childId: string;
  interests?: string[];
  focus?: string;
}): Promise<{ updated: boolean; note: string; childName?: string }> {
  const sql = mapDb();
  const rows = await sql<{ id: string; name: string; profile: Record<string, unknown> | null }[]>`
    select id, name, profile from public.children
    where id = ${input.childId} and family_id = ${input.familyId}
  `;
  const child = rows[0];
  if (!child) {
    return {
      updated: false,
      note: "That child id is not in this family. Use an id from the family context block.",
    };
  }
  const nextProfile = {
    ...(child.profile ?? {}),
    ...(input.interests !== undefined
      ? { interests: input.interests.slice(0, MAP_INTERESTS_CAP) }
      : {}),
    ...(input.focus !== undefined ? { focus: input.focus } : {}),
  };
  await sql`
    update public.children
    set profile = ${sql.json(nextProfile as never)}, updated_at = now()
    where id = ${child.id} and family_id = ${input.familyId}
  `;
  return {
    updated: true,
    childName: child.name,
    note: "Profile updated; the fresh values load automatically next turn.",
  };
}

/** Supersedes one active memory by content match (the forget tool's
 * pinned path). Mirrors the RLS tool's semantics exactly. */
export async function forgetMemoryPinned(
  familyId: string,
  match: string,
): Promise<
  | { deleted: true; forgot: string }
  | { deleted: false; note: string; matches?: string[]; current_memories?: string[] }
> {
  const sql = mapDb();
  const rows = await sql<{ id: string; content: string }[]>`
    select id, content from public.family_memories
    where family_id = ${familyId} and superseded_at is null
      and kind in ('fact', 'what_works')
  `;
  const needle = match.toLowerCase();
  const matches = rows.filter((row) => row.content.toLowerCase().includes(needle));
  if (matches.length === 0) {
    return {
      deleted: false,
      note: "No saved memory matches that phrase.",
      current_memories: rows.map((row) => row.content),
    };
  }
  if (matches.length > 1) {
    return {
      deleted: false,
      note: "That phrase matches more than one memory. Retry with a longer, unique phrase.",
      matches: matches.map((row) => row.content),
    };
  }
  await sql`
    update public.family_memories set superseded_at = now()
    where id = ${matches[0].id} and family_id = ${familyId}
  `;
  return { deleted: true, forgot: matches[0].content };
}

/** Canonical source-backed Hours capture for authenticated family-pinned channels. */
export async function recordHoursPinned(input: HoursCaptureInput) {
  const result = await captureHoursPinned(input);
  if (result.inserted && result.entry) {
    if (input.source === "call") {
      await emitMapEvent("voice.hours_logged", { family_id: input.familyId,
        ...(result.entry.childId ? { child_id: result.entry.childId } : {}),
        subject: result.entry.subject, minutes: result.entry.minutes });
    } else {
      await emitMapEvent("chat.hours_logged", { subject: result.entry.subject, minutes: result.entry.minutes,
        channel: input.source === "chat" ? "web" : input.source }, { familyId: input.familyId });
    }
  }
  return { ...result, ...hoursCaptureDisplayFields(result),
    note: result.logged ? "On the record." : "That entry was removed. Nothing was recreated." };
}

export interface PinnedRecallHit {
  when: string;
  where: string;
  snippet: string;
  source?: { kind: "parent_message"; id: string };
}

function dayLabel(iso: string | null, timeZone: string): string {
  if (!iso) return "unknown date";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
}

/**
 * The recall tool's pinned path. IMPORTANT: this runs on the server
 * connection where RLS does not apply, so unlike the RLS path (where the
 * family filter is belt on top of the database's own wall), here the
 * explicit family_id predicate in every query IS the wall; familyId
 * arrives from channel auth only. The semantic arm queries the tables
 * directly for the same reason: the recall_semantic RPC leans on RLS,
 * which this connection does not have. Message visibility is part of the
 * same wall: internal conversation rows (scheduler dispatch prompts,
 * undelivered drafts) are server-only under the continuity RLS policy,
 * so every conversation_messages read here repeats visibility = 'family'
 * explicitly (found leaking on this path 2026-07-19).
 */
export async function recallPinned(input: {
  familyId: string;
  memberUserId: string | null;
  query: string;
  scope: "calls" | "chats" | "memories" | "all";
  limit: number;
}): Promise<PinnedRecallHit[]> {
  const sql = mapDb();
  const familyRows = await sql<{ time_zone: string | null }[]>`
    select time_zone from public.families where id = ${input.familyId}
  `;
  const timeZone = effectiveTimeZone(familyRows[0]?.time_zone);
  const hits: PinnedRecallHit[] = [];

  if (input.scope === "calls" || input.scope === "all") {
    const rows = await sql<{ line: string; transcript_text: string; started_at: string | null }[]>`
      select line, transcript_text, started_at::text as started_at
      from public.call_transcripts
      where family_id = ${input.familyId}
        and member_user_id = ${input.memberUserId}
        and exists (
          select 1
          from public.family_members current_member
          where current_member.family_id = call_transcripts.family_id
            and current_member.user_id = ${input.memberUserId}
        )
        and to_tsvector('english', transcript_text)
            @@ websearch_to_tsquery('english', ${input.query})
      order by started_at desc nulls last
      limit ${input.limit}
    `;
    for (const row of rows) {
      hits.push({
        when: dayLabel(row.started_at, timeZone),
        where: row.line === "curriculum" ? "phone call (report review)" : "phone call",
        snippet: row.transcript_text.slice(0, 480),
      });
    }
  }

  if (input.scope === "chats" || input.scope === "all") {
    const rows = await sql<{ id: string; role: string; content: string; channel: string; created_at: string }[]>`
      select id, role, content, channel, created_at::text as created_at
      from public.conversation_messages
      where family_id = ${input.familyId}
        and visibility = 'family'
        and ${input.memberUserId}::uuid is not null
        and exists (
          select 1
          from public.family_members current_member
          where current_member.family_id = conversation_messages.family_id
            and current_member.user_id = ${input.memberUserId}
        )
        and (
          (
            role = 'user'
            and member_user_id = ${input.memberUserId}
          )
          or (
            role = 'assistant'
            and member_user_id = ${input.memberUserId}
            and exists (
              select 1
              from public.conversation_messages user_message
              where user_message.family_id =
                    conversation_messages.family_id
                and user_message.session_id =
                    conversation_messages.session_id
                and user_message.role = 'user'
            )
            and not exists (
              select 1
              from public.conversation_messages user_message
              where user_message.family_id =
                    conversation_messages.family_id
                and user_message.session_id =
                    conversation_messages.session_id
                and user_message.role = 'user'
                and user_message.member_user_id
                  is distinct from ${input.memberUserId}
            )
          )
          or exists (
            select 1
            from public.conversation_deliveries delivery
            where delivery.family_id = conversation_messages.family_id
              and delivery.message_id = conversation_messages.id
              and delivery.recipient_member_user_id = ${input.memberUserId}
              and delivery.status = 'sent'
          )
        )
        and to_tsvector('english', content) @@ websearch_to_tsquery('english', ${input.query})
      order by created_at desc
      limit ${input.limit}
    `;
    for (const row of rows) {
      hits.push({
        when: dayLabel(row.created_at, timeZone),
        where: `${row.channel === "sms" ? "text message" : "chat"} (${row.role === "user" ? "the parent" : "Homa"})`,
        snippet: row.content.slice(0, 480),
        ...(row.role === "user" ? { source: { kind: "parent_message" as const, id: row.id } } : {}),
      });
    }
  }

  if (input.scope === "memories" || input.scope === "all") {
    const rows = await sql<
      { content: string; kind: string; created_at: string; superseded_at: string | null }[]
    >`
      select content, kind, created_at::text as created_at, superseded_at::text as superseded_at
      from public.family_memories
      where family_id = ${input.familyId}
        and to_tsvector('english', content) @@ websearch_to_tsquery('english', ${input.query})
      order by created_at desc
      limit ${input.limit}
    `;
    for (const row of rows) {
      const base = row.kind === "what_works" ? "saved memory (what works)" : "saved memory";
      hits.push({
        when: dayLabel(row.created_at, timeZone),
        where: row.superseded_at ? `${base}, older note that was later corrected` : base,
        snippet: row.content,
      });
    }
  }

  // Semantic fallback with the family predicate inline (see doc comment).
  //
  // The scope predicates below are load-bearing, not tidiness (gh#375).
  // Until 2026-07-29 this union searched memories, chats, and calls
  // regardless of the scope asked for, applied `limit` to that global
  // ranking, and only then filtered by scope in TypeScript. A
  // scope:"calls" search therefore spent its whole budget on memories
  // and chats and threw them away. That is how Homa told a parent her
  // phone call did not exist while the transcript sat in this table,
  // embedded, from 49 minutes earlier: the lexical arm above cannot
  // match a transcript that never says the parent's words, and the arm
  // meant to catch exactly that was looking somewhere else.
  const wantMemories = input.scope === "memories" || input.scope === "all";
  const wantChats = input.scope === "chats" || input.scope === "all";
  const wantCalls = input.scope === "calls" || input.scope === "all";
  if (
    hits.length < input.limit &&
    (input.memberUserId !== null || wantMemories)
  ) {
    const queryEmbedding = await embedText(input.query, { familyId: input.familyId });
    if (queryEmbedding) {
      const rows = await sql<
        { source: string; source_id: string; source_role: string | null; happened_at: string | null; label: string; content: string }[]
      >`
        select * from (
          select 'memories' as source, m.id as source_id, null::text as source_role, m.created_at::text as happened_at,
                 case when m.superseded_at is not null then 'saved memory, older note that was later corrected'
                      when m.kind = 'what_works' then 'saved memory (what works)'
                      else 'saved memory' end as label,
                 m.content,
                 (m.embedding <=> ${queryEmbedding}::extensions.vector(1536)) as distance
          from public.family_memories m
          where m.family_id = ${input.familyId} and m.embedding is not null
            and ${wantMemories}::boolean
          union all
          select 'chats', c.id, c.role, c.created_at::text,
                 (case when c.channel = 'sms' then 'text message' else 'chat' end)
                   || ' (' || (case when c.role = 'user' then 'the parent' else 'Homa' end) || ')',
                 c.content,
                 (c.embedding <=> ${queryEmbedding}::extensions.vector(1536))
          from public.conversation_messages c
          where c.family_id = ${input.familyId} and c.visibility = 'family'
            and c.embedding is not null
            and ${wantChats}::boolean
            and ${input.memberUserId}::uuid is not null
            and exists (
              select 1
              from public.family_members current_member
              where current_member.family_id = c.family_id
                and current_member.user_id = ${input.memberUserId}
            )
            and (
              (
                c.role = 'user'
                and c.member_user_id = ${input.memberUserId}
              )
              or (
                c.role = 'assistant'
                and c.member_user_id = ${input.memberUserId}
                and exists (
                  select 1
                  from public.conversation_messages user_message
                  where user_message.family_id = c.family_id
                    and user_message.session_id = c.session_id
                    and user_message.role = 'user'
                )
                and not exists (
                  select 1
                  from public.conversation_messages user_message
                  where user_message.family_id = c.family_id
                    and user_message.session_id = c.session_id
                    and user_message.role = 'user'
                    and user_message.member_user_id
                      is distinct from ${input.memberUserId}
                )
              )
              or exists (
                select 1
                from public.conversation_deliveries delivery
                where delivery.family_id = c.family_id
                  and delivery.message_id = c.id
                  and delivery.recipient_member_user_id = ${input.memberUserId}
                  and delivery.status = 'sent'
              )
            )
          union all
          select 'calls', t.id, null::text, t.started_at::text,
                 case when t.line = 'curriculum' then 'phone call (report review)' else 'phone call' end,
                 left(t.transcript_text, 480),
                 (t.embedding <=> ${queryEmbedding}::extensions.vector(1536))
          from public.call_transcripts t
          where t.family_id = ${input.familyId} and t.embedding is not null
            and ${wantCalls}::boolean
            and t.member_user_id = ${input.memberUserId}
            and exists (
              select 1
              from public.family_members current_member
              where current_member.family_id = t.family_id
                and current_member.user_id = ${input.memberUserId}
            )
        ) ranked
        order by distance asc
        limit ${input.limit}
      `;
      const seen = new Set(hits.map((hit) => hit.snippet.slice(0, 80)));
      for (const row of rows) {
        if (input.scope !== "all" && input.scope !== row.source) continue;
        const snippet = row.content.slice(0, 480);
        if (seen.has(snippet.slice(0, 80))) continue;
        seen.add(snippet.slice(0, 80));
        hits.push({ when: dayLabel(row.happened_at, timeZone), where: row.label, snippet,
          ...(row.source === "chats" && row.source_role === "user" ? { source: { kind: "parent_message" as const, id: row.source_id } } : {}) });
      }
    }
  }

  return hits.slice(0, input.limit);
}
