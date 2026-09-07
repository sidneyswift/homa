import { adminDb } from "../admin/db";

/**
 * Layer 5: Knowledge Gap Tracking.
 * Records gaps discovered when recall misses or signals indicate topics
 * the system cannot answer well. Feeds into the fleet-research demand
 * queue so gaps get filled nightly.
 */

export interface KnowledgeGap {
  id: string;
  topic: string;
  queryText: string;
  familyId: string | null;
  source: string;
  status: string;
  filledByKnowledgeId: string | null;
  researchPriority: number;
  createdAt: string;
  filledAt: string | null;
}

export interface GapReport {
  totalGaps: number;
  openGaps: number;
  filledGaps: number;
  fillRate: number;
  topTopics: { topic: string; count: number }[];
}

/**
 * Record a knowledge gap. Deduplicates open topics within the same family to avoid
 * flooding the table with identical misses.
 */
export async function logGap(
  topic: string,
  queryText: string,
  familyId: string | null,
  source: "recall_miss" | "signal" | "manual",
): Promise<string | null> {
  const db = adminDb();

  // Keep recall provenance within its family. Null denotes fleet-owned gaps.
  const existing = await db<{ id: string }[]>`
    select id::text
    from public.knowledge_gaps
    where topic = ${topic}
      and family_id is not distinct from ${familyId}::uuid
      and status = 'open'
    limit 1
  `;

  if (existing.length > 0) {
    // Bump priority on repeated asks
    const [updated] = await db<{ id: string }[]>`
      update public.knowledge_gaps
      set research_priority = research_priority + 1
      where id = ${existing[0]!.id}::uuid
        and family_id is not distinct from ${familyId}::uuid
        and status = 'open'
      returning id::text
    `;
    return updated?.id ?? null;
  }

  const [row] = await db<{ id: string }[]>`
    insert into public.knowledge_gaps
      (topic, query_text, family_id, source)
    values (
      ${topic},
      ${queryText},
      ${familyId}::uuid,
      ${source}
    )
    returning id::text
  `;

  return row?.id ?? null;
}

/**
 * Get highest-priority unfilled gaps.
 */
export async function getOpenGaps(limit = 20): Promise<KnowledgeGap[]> {
  const db = adminDb();

  const rows = await db<
    {
      id: string;
      topic: string;
      query_text: string;
      family_id: string | null;
      source: string;
      status: string;
      filled_by_knowledge_id: string | null;
      research_priority: number;
      created_at: string;
      filled_at: string | null;
    }[]
  >`
    select
      id::text,
      topic,
      query_text,
      family_id::text,
      source,
      status,
      filled_by_knowledge_id::text,
      research_priority::int,
      created_at::text,
      filled_at::text
    from public.knowledge_gaps
    where status = 'open'
    order by research_priority desc, created_at
    limit ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    topic: r.topic,
    queryText: r.query_text,
    familyId: r.family_id,
    source: r.source,
    status: r.status,
    filledByKnowledgeId: r.filled_by_knowledge_id,
    researchPriority: r.research_priority,
    createdAt: r.created_at,
    filledAt: r.filled_at,
  }));
}

/**
 * Mark a gap as filled by a knowledge_bank entry.
 */
export async function markFilled(
  gapId: string,
  knowledgeId: string,
): Promise<void> {
  const db = adminDb();

  await db`
    update public.knowledge_gaps
    set status = 'filled',
        filled_by_knowledge_id = ${knowledgeId}::uuid,
        filled_at = now()
    where id = ${gapId}::uuid
  `;
}

/**
 * Summary of gap fill rate and coverage.
 */
export async function getGapReport(): Promise<GapReport> {
  const db = adminDb();

  const [counts] = await db<
    { total: number; open: number; filled: number }[]
  >`
    select
      count(*)::int as total,
      count(*) filter (where status = 'open')::int as open,
      count(*) filter (where status = 'filled')::int as filled
    from public.knowledge_gaps
  `;

  const total = counts?.total ?? 0;
  const open = counts?.open ?? 0;
  const filled = counts?.filled ?? 0;

  const topTopics = await db<{ topic: string; cnt: number }[]>`
    select topic, count(*)::int as cnt
    from public.knowledge_gaps
    where status = 'open'
    group by topic
    order by count(*) desc
    limit 10
  `;

  return {
    totalGaps: total,
    openGaps: open,
    filledGaps: filled,
    fillRate: total > 0 ? filled / total : 0,
    topTopics: topTopics.map((r) => ({ topic: r.topic, count: r.cnt })),
  };
}
