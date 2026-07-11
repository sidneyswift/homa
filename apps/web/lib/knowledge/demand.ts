import { mapDb } from "../map/db";

/**
 * The fleet research demand queue (HT-3): which topics the corpus owes
 * the fleet tonight. Demand is computed FROM family data (styles and
 * curriculums in use, subjects children actually work on) but the queue
 * itself carries only topic keys and counts; no child or family
 * identifier survives into the research session, which is what keeps
 * child data out of web searches by construction (D-ht-1).
 *
 * A topic is due when no active bank row exists for it, or the newest
 * active row has outlived its own freshness_ttl_days. Rotation falls out
 * of TTLs: freshly researched topics leave the queue until they age.
 */

export interface DemandTopic {
  topicType: "method_philosophy" | "method_format" | "subject" | "study" | "other";
  topicKey: string;
  demand: number;
  hasRows: boolean;
}

export async function fetchDemandQueue(limit: number): Promise<DemandTopic[]> {
  const sql = mapDb();
  const rows = await sql<
    {
      topic_type: DemandTopic["topicType"];
      topic_key: string;
      demand: number;
      has_rows: boolean;
    }[]
  >`
    with demand as (
      select 'method_philosophy'::text as topic_type,
             style.value as topic_key,
             count(*)::int as demand
      from public.families f,
           lateral jsonb_array_elements_text(coalesce(f.context->'styles', '[]'::jsonb))
             as style(value)
      group by style.value

      union all

      select 'other'::text,
             btrim(lower(regexp_replace(cur.value, '[^a-zA-Z0-9]+', '-', 'g')), '-'),
             count(*)::int
      from public.families f,
           lateral jsonb_array_elements_text(coalesce(f.context->'curriculums', '[]'::jsonb))
             as cur(value)
      group by 2

      union all

      select 'subject'::text,
             subj->>'subjectId',
             count(distinct r.child_id)::int
      from public.child_reports r,
           lateral jsonb_array_elements(coalesce(r.scores->'subjects', '[]'::jsonb)) as subj
      where subj->>'position' is not null and subj->>'position' != 'not_mapped'
      group by 2

      union all

      -- The standing general scan: recent early-childhood studies. Low
      -- weight; its short TTL (set at merge time) brings it back weekly.
      select 'study'::text, 'early-childhood-recent-studies', 1
    ),
    freshest as (
      select topic_type, topic_key,
             max(last_verified_at + (freshness_ttl_days || ' days')::interval) as fresh_until,
             count(*)::int as row_count
      from public.knowledge_bank
      where status = 'active'
      group by topic_type, topic_key
    )
    select d.topic_type, d.topic_key, sum(d.demand)::int as demand,
           coalesce(max(f.row_count), 0) > 0 as has_rows
    from demand d
    left join freshest f
      on f.topic_type = d.topic_type and f.topic_key = d.topic_key
    where d.topic_key is not null
      and d.topic_key ~ '^[a-z0-9_-]{2,60}$'
      and (f.fresh_until is null or f.fresh_until < now())
    group by d.topic_type, d.topic_key
    order by demand desc, d.topic_key
    limit ${limit}
  `;
  return rows.map((row) => ({
    topicType: row.topic_type,
    topicKey: row.topic_key,
    demand: row.demand,
    hasRows: row.has_rows,
  }));
}
