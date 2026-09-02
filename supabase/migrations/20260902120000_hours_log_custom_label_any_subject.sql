-- Hours: let a parent name her own category under ANY subject, not only
-- "other" (Carolyng feedback, 2026-09-02 WhatsApp: "need to be able to add
-- my own categories to have it log appropriately"). custom_label
-- (20260827130000) already carries exactly this shape -- a nullable,
-- 1-40 character free-text name on one entry -- it was just fenced to
-- "other" because that was the only reported need at the time. This
-- widens the fence rather than building a second mechanism: a block can
-- now be subject "reading" with custom_label "Literature journal", so it
-- still rolls up into the family's real reading total (hours-view.ts's
-- fixed ten/eleven-subject vocabulary is unchanged) while reading as her
-- own words everywhere the entry is displayed.
--
-- This also fixes a live false-collision bug (same WhatsApp thread):
-- hours_log_block_unique_idx and the two writers' guard queries (log_hours
-- tool, recordHoursPinned) all matched on (family, subject, minutes,
-- happened_on, child) alone. A literature journal (reading, 20 min) and
-- an independent-reading block (reading, 20 min) on the same day for the
-- same child are genuinely different activities that collided on that
-- key, so the second one silently never saved -- reported live as "Lion
-- Dancers never added" and "Little Women never added." Folding
-- custom_label into the same key lets two distinct named blocks coexist;
-- two blocks that still share every field including the label (or lack
-- one) keep colliding on purpose, since that shape is indistinguishable
-- from the same block mentioned twice.

alter table public.hours_log
  drop constraint if exists hours_log_custom_label_requires_other;

drop index if exists public.hours_log_block_unique_idx;

create unique index if not exists hours_log_block_unique_idx
  on public.hours_log (
    family_id,
    subject,
    minutes,
    happened_on,
    coalesce(child_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(custom_label, '')
  );
