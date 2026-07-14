-- Lesson listen consent (plan 2026-07-13-lesson-listen.md, LL-0).
-- Founder ruling 2026-07-13 (lesson-listen-child-audio): a parent may
-- record a lesson that includes their child's voice, behind a
-- dedicated family-level consent screen. This supersedes the personas
-- line "no child voice ingestion in v1" for lesson recordings only.
-- The commitments the consent screen makes are enforced elsewhere in
-- the same plan: raw audio deletes after 30 days (cron TTL), no model
-- training (vendor terms), no voice identification (nothing anywhere
-- does speaker identity), delete anytime.
--
-- Mirrors the D4 child-photo stamp (migration #75): once per family,
-- first agree wins, families stays deny-all for writes so the stamp
-- goes through the server-only connection with familyId derived from
-- the caller's own membership. Additive only, safe to lead the deploy.

alter table public.families
  add column if not exists lesson_audio_consent_at timestamptz,
  add column if not exists lesson_audio_consent_by uuid;
