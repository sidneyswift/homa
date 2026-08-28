-- Hours: let a parent relabel an "other" entry (Carolyng feedback,
-- 2026-08-27): "portuguese comes up as other and I would like to rewrite
-- it as portuguese or foreign language."
--
-- hours_log.subject stays the fixed ten-value enum (a real family
-- taxonomy is bigger, separately ticketed: reconciling this with the
-- planner/MAP subject vocabulary was already flagged as deferred out of
-- CG-02, apps/web/lib/hours-view.ts). This is the narrow, additive fix:
-- one nullable free-text label that only ever applies to an "other" row,
-- so the parent's own word for the block ("Portuguese", "Foreign
-- language") is what she sees and exports, not the generic bucket name.

alter table public.hours_log
  add column if not exists custom_label text
    check (custom_label is null or char_length(btrim(custom_label)) between 1 and 40);

alter table public.hours_log
  add constraint hours_log_custom_label_requires_other
    check (custom_label is null or subject = 'other');
