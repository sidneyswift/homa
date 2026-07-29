import { MAP_INTERESTS_CAP } from "@homa/core";

import { ageInMonths } from "./child-age";
import { embedText } from "./learning/embeddings";
import { isHoursSubject } from "./hours-model";
import { mapDb } from "./map/db";
import { emitMapEvent } from "./map/events";
import { effectiveTimeZone, zonedDateString } from "./time-zone";

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

/** The shared server-side hours write (voice webhook + SMS tool path):
 * subject validation, in-family child resolution, the double-log guard,
 * the insert, and the event. */
export async function recordHoursPinned(input: {
  familyId: string;
  minutes: number;
  subject: string;
  source: "chat" | "sms" | "call" | "email" | "dispatch";
  childId?: string | null;
  childName?: string | null;
  happenedOn?: string | null;
  note?: string | null;
}): Promise<{ logged: boolean; note: string; weekMinutesForSubject?: number }> {
  if (!Number.isFinite(input.minutes) || input.minutes < 1 || input.minutes > 600) {
    return {
      logged: false,
      note: "Minutes must be between 1 and 600. If the parent was vague, ask about how long it really was, then retry.",
    };
  }
  if (!isHoursSubject(input.subject)) {
    return {
      logged: false,
      note: "That subject is not one of the record's subjects. Use one of: reading, math, science, social studies, art, music, PE, co-op, life skills, other.",
    };
  }

  const sql = mapDb();
  let childId: string | null = null;
  if (input.childId) {
    const rows = await sql<{ id: string }[]>`
      select id from public.children where id = ${input.childId} and family_id = ${input.familyId}
    `;
    childId = rows[0]?.id ?? null;
    if (!childId) {
      return {
        logged: false,
        note: "That child id is not in this family. Use an id from the family context block, or leave the child off for family-wide time.",
      };
    }
  } else if (input.childName?.trim()) {
    const rows = await sql<{ id: string }[]>`
      select id from public.children
      where family_id = ${input.familyId}
        and lower(name) = ${input.childName.trim().toLowerCase()}
    `;
    childId = rows[0]?.id ?? null;
    if (!childId) {
      return {
        logged: false,
        note: "That child name is not in this family. Use the name exactly as the family context shows it, or leave the child off for family-wide time.",
      };
    }
  }

  let happenedOn = input.happenedOn ?? null;
  if (!happenedOn) {
    const rows = await sql<{ time_zone: string | null }[]>`
      select time_zone from public.families where id = ${input.familyId}
    `;
    happenedOn = zonedDateString(new Date(), effectiveTimeZone(rows[0]?.time_zone));
  }
  const dupe = await sql<{ id: string }[]>`
    select id from public.hours_log
    where family_id = ${input.familyId}
      and subject = ${input.subject} and minutes = ${Math.round(input.minutes)}
      and happened_on = ${happenedOn}
      and child_id is not distinct from ${childId}
    limit 1
  `;
  if (dupe[0]) {
    return { logged: true, note: "That block is already on the record for that day; nothing added twice." };
  }

  const inserted = await sql<{ id: string }[]>`
    insert into public.hours_log (family_id, child_id, subject, minutes, happened_on, source, note)
    values (${input.familyId}, ${childId}, ${input.subject}, ${Math.round(input.minutes)},
            ${happenedOn}, ${input.source}, ${input.note?.trim().slice(0, 200) || null})
    on conflict do nothing
    returning id
  `;
  if (inserted.length === 0) {
    // A concurrent identical call won hours_log_block_unique_idx after
    // this one's guard SELECT ran; same outcome as the guard, and no
    // event for a row that never landed.
    return { logged: true, note: "That block is already on the record for that day; nothing added twice." };
  }

  if (input.source === "call") {
    await emitMapEvent("voice.hours_logged", {
      family_id: input.familyId,
      ...(childId ? { child_id: childId } : {}),
      subject: input.subject,
      minutes: Math.round(input.minutes),
    });
  } else {
    await emitMapEvent(
      "chat.hours_logged",
      {
        subject: input.subject,
        minutes: Math.round(input.minutes),
        // hours_log rows say "chat" for web sessions; the event registry
        // names the same surface "web".
        channel: input.source === "chat" ? "web" : input.source,
      },
      {
        familyId: input.familyId,
      },
    );
  }

  const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const week = await sql<{ total: string | null }[]>`
    select sum(minutes)::text as total from public.hours_log
    where family_id = ${input.familyId} and subject = ${input.subject}
      and happened_on >= ${weekAgo}
  `;
  return {
    logged: true,
    note: "On the record.",
    weekMinutesForSubject: Number(week[0]?.total ?? 0),
  };
}

export interface PinnedRecallHit {
  when: string;
  where: string;
  snippet: string;
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
/**
 * The family's hours rows on the pinned path (gh#354). Same wall as
 * every other function here: the explicit family_id predicate IS the
 * tenancy boundary, because this connection has no RLS.
 *
 * Reading, never writing. recordHoursPinned owns the write side.
 */
export async function readHoursPinned(
  familyId: string,
): Promise<{ rows: PinnedHoursRow[]; timeZone: string }> {
  const sql = mapDb();
  const familyRows = await sql<{ time_zone: string | null }[]>`
    select time_zone from public.families where id = ${familyId}
  `;
  const rows = await sql<PinnedHoursRow[]>`
    select child_id as "childId", subject, minutes,
           happened_on::text as "happenedOn", source, note
    from public.hours_log
    where family_id = ${familyId}
    order by happened_on desc, created_at desc
    limit 3000
  `;
  return { rows, timeZone: effectiveTimeZone(familyRows[0]?.time_zone) };
}

export interface PinnedHoursRow {
  childId: string | null;
  subject: string;
  minutes: number;
  happenedOn: string;
  source: string;
  note: string | null;
}

export async function recallPinned(input: {
  familyId: string;
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
    const rows = await sql<{ role: string; content: string; channel: string; created_at: string }[]>`
      select role, content, channel, created_at::text as created_at
      from public.conversation_messages
      where family_id = ${input.familyId}
        and visibility = 'family'
        and to_tsvector('english', content) @@ websearch_to_tsquery('english', ${input.query})
      order by created_at desc
      limit ${input.limit}
    `;
    for (const row of rows) {
      hits.push({
        when: dayLabel(row.created_at, timeZone),
        where: `${row.channel === "sms" ? "text message" : "chat"} (${row.role === "user" ? "the parent" : "Homa"})`,
        snippet: row.content.slice(0, 480),
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
  if (hits.length < input.limit) {
    const wantMemories = input.scope === "memories" || input.scope === "all";
    const wantChats = input.scope === "chats" || input.scope === "all";
    const wantCalls = input.scope === "calls" || input.scope === "all";
    const queryEmbedding = await embedText(input.query, { familyId: input.familyId });
    if (queryEmbedding) {
      const rows = await sql<
        { source: string; happened_at: string | null; label: string; content: string }[]
      >`
        select * from (
          select 'memories' as source, m.created_at::text as happened_at,
                 case when m.superseded_at is not null then 'saved memory, older note that was later corrected'
                      when m.kind = 'what_works' then 'saved memory (what works)'
                      else 'saved memory' end as label,
                 m.content,
                 (m.embedding <=> ${queryEmbedding}::extensions.vector(1536)) as distance
          from public.family_memories m
          where m.family_id = ${input.familyId} and m.embedding is not null
            and ${wantMemories}::boolean
          union all
          select 'chats', c.created_at::text,
                 (case when c.channel = 'sms' then 'text message' else 'chat' end)
                   || ' (' || (case when c.role = 'user' then 'the parent' else 'Homa' end) || ')',
                 c.content,
                 (c.embedding <=> ${queryEmbedding}::extensions.vector(1536))
          from public.conversation_messages c
          where c.family_id = ${input.familyId} and c.visibility = 'family'
            and c.embedding is not null
            and ${wantChats}::boolean
          union all
          select 'calls', t.started_at::text,
                 case when t.line = 'curriculum' then 'phone call (report review)' else 'phone call' end,
                 left(t.transcript_text, 480),
                 (t.embedding <=> ${queryEmbedding}::extensions.vector(1536))
          from public.call_transcripts t
          where t.family_id = ${input.familyId} and t.embedding is not null
            and ${wantCalls}::boolean
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
        hits.push({ when: dayLabel(row.happened_at, timeZone), where: row.label, snippet });
      }
    }
  }

  return hits.slice(0, input.limit);
}
