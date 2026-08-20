-- Allow 'mobile' as a families.source (mobile onboarding v1).
--
-- Mobile-born families are created by the native onboarding bootstrap
-- (apps/web/app/api/mobile/onboarding/route.ts) and carry source
-- 'mobile'; the D6 ruling (2026-08-18) keys the native-versus-web walk
-- decision on exactly this value. The original closed set predates a
-- native door existing (20260707120000_one_world_families.sql). Found
-- live on the first simulator walk: the bootstrap's insert violated
-- families_source_check.

alter table public.families
  drop constraint if exists families_source_check;

alter table public.families
  add constraint families_source_check
  check (source in ('conference', 'referral', 'organic', 'social', 'other', 'mobile'));
