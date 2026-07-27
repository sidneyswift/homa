-- hours_log block uniqueness (issue #215, 2026-07-25).
--
-- Both hours writers (the log_hours agent tool and recordHoursPinned in
-- lib/agent-pinned.ts) guarded double-logging with SELECT-then-INSERT,
-- which two identical concurrent tool calls both pass under read
-- committed. This index makes the database the arbiter: the raced
-- insert loses with a unique violation the writers treat as "already
-- on the record". The key matches the guards exactly, including their
-- child_id IS NOT DISTINCT FROM semantics: family-wide rows (null
-- child_id) share one bucket via coalesce to the zero uuid.
--
-- Investigated fleet-wide before landing (issue #215): the flagged
-- "duplicate pairs" were one row per child, not race artifacts, and
-- zero true duplicates existed on 2026-07-25. The delete below is
-- therefore expected to remove nothing today; it exists so the index
-- still builds if a real race pair lands between this file's authoring
-- and its apply. It only removes rows matching the artifact shape
-- exactly: identical block AND identical note, written within one
-- second of the kept (earliest) row.
--
-- Additive, so it may lead the code deploy (AGENTS.md migration law):
-- the pre-index writers keep working; a raced identical insert fails
-- closed instead of double-writing.

delete from public.hours_log dupe
using public.hours_log keeper
where keeper.family_id = dupe.family_id
  and keeper.subject = dupe.subject
  and keeper.minutes = dupe.minutes
  and keeper.happened_on = dupe.happened_on
  and keeper.child_id is not distinct from dupe.child_id
  and keeper.note is not distinct from dupe.note
  and (keeper.created_at, keeper.id) < (dupe.created_at, dupe.id)
  and dupe.created_at - keeper.created_at <= interval '1 second';

create unique index if not exists hours_log_block_unique_idx
  on public.hours_log (
    family_id,
    subject,
    minutes,
    happened_on,
    coalesce(child_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
