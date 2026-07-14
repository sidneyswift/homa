import { mapDb } from "../map/db";
import type { KnowledgeLens, KnowledgeTopicType } from "./gate";

/**
 * The fleet research demand queue (HT-3, made age-aware by the corpus
 * plan KC-3). Which CELLS the corpus owes the fleet tonight, where a cell
 * is (lens, topic_key, stage): the research purpose, the taxonomy domain
 * or style or curriculum, and the developmental band it serves.
 *
 * Demand is computed FROM family data (styles and curriculums in use,
 * and the frontier DOMAIN each scored child is actually working, bucketed
 * into a stage band) but the queue itself carries only the cell keys and
 * counts. No child or family identifier survives into the research
 * session, which is what keeps child data out of web searches by
 * construction (D-ht-1). The stage band is coarse (one of five) and never
 * a birthday.
 *
 * A cell is due when no active bank row exists for it, or the newest
 * active row has outlived its own freshness_ttl_days. Rotation falls out
 * of TTLs: a freshly researched cell leaves the queue until it ages.
 *
 * Subject cells fan across the two subject lenses (develops_when, the
 * near-static "what is typical here" reference, and how_to_teach, the
 * actionable current-practice lens). Studies are a per-stage rolling
 * scan. Methods and curriculums are stage-agnostic (stage null).
 *
 * Dual-read: a child's frontier domain comes from scores->frontierDomain,
 * which reports carry only after the KC-1 scorer change. Older reports
 * fall back to the bare subject id, so the grain sharpens to domain level
 * as reports regenerate, with no break in between.
 */

export interface DemandCell {
  lens: KnowledgeLens;
  topicKey: string;
  /** The developmental band this cell serves, or null for stage-agnostic
   * lenses (methods, curriculums). */
  stage: string | null;
  /** The legacy topic_type, derived from the lens, still written for
   * dual-read and the gate's supersede scope. */
  topicType: KnowledgeTopicType;
  demand: number;
  hasRows: boolean;
}

export async function fetchDemandQueue(limit: number): Promise<DemandCell[]> {
  const sql = mapDb();
  const rows = await sql<
    {
      lens: KnowledgeLens;
      topic_key: string;
      stage: string | null;
      topic_type: KnowledgeTopicType;
      demand: number;
      has_rows: boolean;
    }[]
  >`
    with ages as (
      select
        r.child_id,
        r.scores,
        coalesce(
          r.scored_age_months,
          (extract(year from age(now(), c.birth_month)) * 12
           + extract(month from age(now(), c.birth_month)))::int
        ) as age_m
      from public.child_reports r
      join public.children c on c.id = r.child_id
      where c.birth_month is not null or r.scored_age_months is not null
    ),
    staged as (
      select
        child_id,
        scores,
        case
          when age_m < 60 then 'early_years'
          when age_m < 96 then 'early_elem'
          when age_m < 132 then 'upper_elem'
          when age_m < 168 then 'middle'
          else 'high'
        end as stage
      from ages
      where age_m is not null
    ),
    -- Subject frontier cells, fanned across the two subject lenses. The
    -- topic key is the child's frontier DOMAIN when the report carries it,
    -- else the subject id (dual-read).
    subject_cells as (
      select
        lens.value as lens,
        coalesce(subj->>'frontierDomain', subj->>'subjectId') as topic_key,
        s.stage,
        'subject'::text as topic_type,
        count(distinct s.child_id)::int as demand
      from staged s,
        lateral jsonb_array_elements(coalesce(s.scores->'subjects', '[]'::jsonb)) as subj,
        lateral (values ('develops_when'), ('how_to_teach')) as lens(value)
      where subj->>'position' is not null
        and subj->>'position' <> 'not_mapped'
      group by 1, 2, 3
    ),
    -- The standing new-research scan, one cell per stage the fleet has.
    study_cells as (
      select
        'current_study'::text as lens,
        'early-childhood-recent-studies'::text as topic_key,
        s.stage,
        'study'::text as topic_type,
        count(distinct s.child_id)::int as demand
      from staged s
      group by s.stage
    ),
    -- Methods and curriculums are stage-agnostic (a philosophy is not a
    -- band). topic_type keeps the historical values for dual-read.
    method_cells as (
      select
        'method'::text as lens,
        style.value as topic_key,
        null::text as stage,
        'method_philosophy'::text as topic_type,
        count(*)::int as demand
      from public.families f,
        lateral jsonb_array_elements_text(coalesce(f.context->'styles', '[]'::jsonb)) as style(value)
      group by 2
    ),
    curriculum_cells as (
      select
        'curriculum'::text as lens,
        btrim(lower(regexp_replace(cur.value, '[^a-zA-Z0-9]+', '-', 'g')), '-') as topic_key,
        null::text as stage,
        'other'::text as topic_type,
        count(*)::int as demand
      from public.families f,
        lateral jsonb_array_elements_text(coalesce(f.context->'curriculums', '[]'::jsonb)) as cur(value)
      group by 2
    ),
    cells as (
      select * from subject_cells
      union all select * from study_cells
      union all select * from method_cells
      union all select * from curriculum_cells
    ),
    freshest as (
      select lens, topic_key, stage,
             max(last_verified_at + (freshness_ttl_days || ' days')::interval) as fresh_until,
             count(*)::int as row_count
      from public.knowledge_bank
      where status = 'active'
      group by lens, topic_key, stage
    )
    select c.lens, c.topic_key, c.stage, c.topic_type,
           sum(c.demand)::int as demand,
           coalesce(max(f.row_count), 0) > 0 as has_rows
    from cells c
    left join freshest f
      on f.lens = c.lens
      and f.topic_key = c.topic_key
      and f.stage is not distinct from c.stage
    where c.topic_key is not null
      and c.topic_key ~ '^[a-z0-9_-]{2,60}$'
      and (f.fresh_until is null or f.fresh_until < now())
    group by c.lens, c.topic_key, c.stage, c.topic_type
    order by demand desc, c.lens, c.topic_key
    limit ${limit}
  `;
  return rows.map((row) => ({
    lens: row.lens,
    topicKey: row.topic_key,
    stage: row.stage,
    topicType: row.topic_type,
    demand: row.demand,
    hasRows: row.has_rows,
  }));
}
