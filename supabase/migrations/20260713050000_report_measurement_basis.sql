-- Measurement-basis stamps for report scorings (trajectory chart
-- investigation, plans/2026-07-12-trajectory-chart-mixed-scales-
-- investigation.md, fix 1).
--
-- A stored score is only meaningful relative to the ruler that produced
-- it: the bank version (content), the scorer rules version, and the
-- birth date + age used at scoring time. bank_version was already
-- stored; the July 8-12 archaeology showed the other three changing
-- under the chart (scorer rule change, answer re-entry, recorded
-- birthday correction) with no way to tell from the archive. These
-- columns stamp the full basis on the live row; createReport copies
-- them into each history snapshot when it archives the row.
--
-- Additive only and nullable: pre-existing rows and history entries
-- simply lack the stamps, and render paths treat a missing stamp as
-- "basis unknown". Safe to apply ahead of the code deploy.

alter table public.child_reports
  add column scorer_version text,
  add column scored_birth_date date,
  add column scored_age_months integer
    check (scored_age_months is null or scored_age_months >= 0);

comment on column public.child_reports.scorer_version is
  'MAP_SCORER_VERSION in effect when scores was computed. Null on rows written before 2026-07-13.';
comment on column public.child_reports.scored_birth_date is
  'children.birth_month as read at scoring time, so a later birthday correction cannot silently re-age archived numbers.';
comment on column public.child_reports.scored_age_months is
  'Whole months of age the scorer used for this scoring.';
