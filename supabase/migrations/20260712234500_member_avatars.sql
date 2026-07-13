-- Migration #74: per-member avatars (settings redesign 2026-07-12).
-- families.parent_avatar_url holds ONE photo for the whole family, so a
-- co-parent saw the uploader's photo beside their own name. Each adult's
-- photo now lives on their membership row. Additive only, safe to lead
-- the deploy; parent_avatar_url stays as the legacy fallback and the
-- /api/map/family onboarding write is unchanged.
--
-- Isolation posture unchanged: family_members keeps deny-by-default
-- writes (no INSERT/UPDATE/DELETE policies), so this column is written
-- only by the server-only connection (lib/family-profile.ts), with
-- familyId derived from the caller's own membership. The roster SELECT
-- policy (migration #51) already lets members read each other's rows.
alter table public.family_members
  add column if not exists avatar_url text;

-- Backfill: the avatars bucket is owner-scoped by path (migration #29:
-- avatars/{auth.uid()}/...), so the public URL names its uploader. Copy
-- the family photo onto exactly that member's row.
update public.family_members m
set avatar_url = f.parent_avatar_url
from public.families f
where f.id = m.family_id
  and f.parent_avatar_url is not null
  and m.avatar_url is null
  and f.parent_avatar_url like '%/avatars/' || m.user_id::text || '/%';
