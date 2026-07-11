-- Migration #29: the create-your-family step (founder call 2026-07-08:
-- one onboarding for every door). Right after S1's account moment the
-- flow now asks for the family name, the parent's name, an address, a
-- cell number, and an optional profile photo, so the family row grows
-- the columns that hold them. profile_completed_at is the step's
-- one-shot stamp: null routes /onboarding through the family card once,
-- and /home redirects unfinished setups back into /onboarding.
--
-- Existing families deliberately keep profile_completed_at null so they
-- see the new card exactly once on their next visit (there is no
-- launched cohort to protect yet; the founder's own family doubles as
-- the test family).
--
-- Isolation posture is unchanged: families already has deny-by-default
-- RLS (members-only SELECT), and these are plain nullable columns on it.

alter table public.families
  add column address_line text,
  add column address_city text,
  add column address_zip text,
  add column parent_avatar_url text,
  add column profile_completed_at timestamptz;

-- The parent's profile photo lives in a public avatars bucket (public
-- read is the standard avatar posture; the D4 consent floor gates photos
-- of KIDS, and this is the parent's own photo of themselves, uploaded by
-- them). Writes are owner-scoped: each user may only touch objects under
-- their own auth.uid() folder.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar owners upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "avatar owners update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "avatar owners delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
