-- Keep their voice (founder ruling `keep-their-voice`, 2026-07-22).
--
-- Raw lesson audio deletes 30 days after the lesson finishes. That TTL
-- is a deliberate privacy commitment, not an oversight, and it stays the
-- default for every lesson. This column is the one exception: when the
-- review found a breakthrough or a sweet moment, Homa keeps that
-- lesson's recording and tells the parent she did, with one tap to
-- delete it.
--
-- Scope note, because the ruling was narrowed the same day it was made:
-- the original ask was a trimmed twenty seconds of the child's own
-- voice. The transcriber returns text only, with no word timings and no
-- diarization, so there is nothing to cut on and no way to attribute an
-- utterance to a speaker. Homa keeps the whole lesson and claims
-- nothing about whose voice is in it. See lib/lessons/keep-audio.ts.
--
-- Additive only, so this may safely lead the deploy: the sweep's extra
-- predicate is a no-op while every row is null, and nothing reads the
-- column until the code that writes it ships.

alter table public.lesson_recordings
  add column if not exists audio_kept_at timestamptz;

comment on column public.lesson_recordings.audio_kept_at is
  'Set when the review found a breakthrough or sweet moment: this lesson''s raw audio is exempt from the 30-day TTL sweep. The parent is told and can delete the recording at any time, which stamps audio_deleted_at as usual. Null is the default and means the TTL applies.';

-- The TTL sweep skips kept lessons. Partial index matches the sweep's
-- own predicate so the exemption costs it nothing.
create index if not exists lesson_recordings_audio_ttl_idx
  on public.lesson_recordings (finished_at)
  where audio_deleted_at is null and audio_kept_at is null;
