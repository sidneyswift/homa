-- Hours: add "Second language" as a real, first-class subject (founder
-- ruling 2026-08-28, following up on Carolyng's 2026-08-27 request and
-- the custom_label fix in 20260827130000). "spanish" is chosen as the
-- literal value on purpose: it is the exact id the real progress-report
-- taxonomy already uses (packages/core/src/map/content.ts, displayed
-- there as "Second language" too, covering Spanish, French, sign
-- language, or any other second language), so an Hours entry logged
-- under this subject lines up with that taxonomy with no separate
-- mapping table.
--
-- The other nine existing Hours subjects are deliberately left alone:
-- several (reading most of all) span multiple real taxonomy subjects
-- and have no single honest destination, so reconciling them is
-- separately scoped, not assumed here. This migration only widens the
-- two check constraints that share hours_log's subject vocabulary
-- (hours_log itself, and planner_learning_activities, whose chat-logged
-- items are validated against the same list per
-- 20260803043000_planner_learning_activities.sql).

alter table public.hours_log
  drop constraint hours_log_subject_check,
  add constraint hours_log_subject_check
    check (subject in
      ('reading','math','science','social studies','art','music','PE','co-op','life skills','other','spanish'));

alter table public.planner_learning_activities
  drop constraint planner_learning_activities_subject_check,
  add constraint planner_learning_activities_subject_check
    check (subject in
      ('reading','math','science','social studies','art','music','PE','co-op','life skills','other','spanish'));
