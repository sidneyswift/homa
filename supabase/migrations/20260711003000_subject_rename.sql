-- Migration: the subject rename (skill-graph taxonomy plan, sequencing #3).
--
-- Founder ruling 2026-07-10: the top level of the skill graph is called
-- SUBJECT everywhere (code, DB, events); the word "domain" is reused for
-- the new level-2 skill lines (Counting & cardinality, ...) imported from
-- the Marble corpus. Executed while user count is ~zero, so stored jsonb
-- is rewritten in place instead of dual-reading forever.
--
-- What changes:
--   1. child_plans.domain_id  -> subject_id (column rename; the unique
--      (child_id, domain_id) constraint follows the column).
--   2. child_reports.scores   -> jsonb keys: domains -> subjects,
--      domainId -> subjectId per entry, totalDomains -> totalSubjects.
--   3. child_reports.history  -> same rewrite inside every entry's scores.
--   4. child_plans.plan       -> jsonb key: domainId -> subjectId.
--
-- What deliberately does NOT change:
--   - Subject id VALUES ("math", "month", ...) and bank item ids: stored
--     answers and URLs keep working unchanged.
--   - events.props on already-stored analytics rows (append-only log; the
--     registry and emitters write the new "subject" key going forward).
--   - children.context.whatsWorking keys: already subject-slug keyed.
--   - child_answers.source gains no constraint; it never had one, and the
--     agent's new conversation provenance value needs none.

alter table public.child_plans rename column domain_id to subject_id;

update public.child_reports
set scores = (scores - 'domains' - 'totalDomains')
  || jsonb_build_object(
    'subjects',
    coalesce(
      (
        select jsonb_agg((entry - 'domainId') || jsonb_build_object('subjectId', entry -> 'domainId'))
        from jsonb_array_elements(scores -> 'domains') entry
      ),
      '[]'::jsonb
    ),
    'totalSubjects',
    scores -> 'totalDomains'
  )
where scores ? 'domains';

update public.child_reports
set history = coalesce(
  (
    select jsonb_agg(
      case
        when entry -> 'scores' ? 'domains' then jsonb_set(
          entry,
          '{scores}',
          ((entry -> 'scores') - 'domains'::text - 'totalDomains'::text)
            || jsonb_build_object(
              'subjects',
              coalesce(
                (
                  select jsonb_agg((score - 'domainId') || jsonb_build_object('subjectId', score -> 'domainId'))
                  from jsonb_array_elements(entry -> 'scores' -> 'domains') score
                ),
                '[]'::jsonb
              ),
              'totalSubjects',
              entry -> 'scores' -> 'totalDomains'
            )
        )
        else entry
      end
    )
    from jsonb_array_elements(history) entry
  ),
  '[]'::jsonb
)
where history <> '[]'::jsonb;

update public.child_plans
set plan = (plan - 'domainId') || jsonb_build_object('subjectId', plan -> 'domainId')
where plan ? 'domainId';
