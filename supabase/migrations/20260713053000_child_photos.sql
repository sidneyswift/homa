-- Migration #75: child profile photos (founder direction 2026-07-13:
-- "upload a pfp of each kid, use it as the reference for picture books
-- and other personalized materials"). D4's floor ships WITH the
-- capability: the dedicated consent screen writes the stamp below
-- before any photo can be added, removal deletes the stored file, and
-- nothing anywhere does face recognition. Additive only, safe to lead
-- the deploy.
--
-- Where the bytes live: Vercel Blob under
-- families/{familyId}/children/{childId}/ (public access, random-suffix
-- URLs, the exact posture of every materials artifact), NOT the public
-- avatars bucket (migration #29 scoped that bucket to adults' own
-- self-photos on purpose). That prefix is what lets the studio's
-- reference-image wall (isFamilyArtifactUrl) accept the photo without
-- widening anything.
--
-- Raw photos are never stored: the browser downscales to a small JPEG
-- before upload (which also drops EXIF location data), so the stored
-- object is the parent-chosen reference image itself, kept until the
-- parent replaces or removes it.
--
-- Isolation posture unchanged: children writes ride the existing
-- "members update their children" RLS policy plus the family_id belt in
-- the action; families stays deny-all for writes, so the consent stamp
-- goes through the server-only connection (lib/family-profile.ts) with
-- familyId derived from the caller's own membership.

alter table public.children
  add column if not exists avatar_url text;

-- The D4 consent moment, once per family: when an adult agreed to child
-- photo personalization on the dedicated consent screen, and which
-- adult (their auth.users id; plain uuid like family_members.user_id).
alter table public.families
  add column if not exists child_photo_consent_at timestamptz,
  add column if not exists child_photo_consent_by uuid;
