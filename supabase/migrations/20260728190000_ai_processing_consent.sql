-- App Review 5.1.2(i) (November 13, 2025 guideline update): apps must
-- disclose where personal data is shared with third parties, including
-- third-party AI, and get explicit affirmative permission before doing
-- so. A privacy-policy sentence does not satisfy this; it needs a real
-- consent moment and a durable record. See docs/homa-planning/plans/
-- 2026-07-28-ios-app-store-launch.md ARC B.
--
-- Per-member, not per-family: each parent who ever talks to Homa gives
-- their own consent, mirroring how `role` is already per-member on this
-- table. Nullable until given; never auto-set.

alter table public.family_members
  add column if not exists ai_processing_consented_at timestamptz;

-- No broad UPDATE policy exists on family_members (writes are
-- server-side only, the standing tenancy pattern), so this narrow
-- SECURITY DEFINER function is the only way a member can set their own
-- consent timestamp; it cannot touch anyone else's row or any other
-- column, unlike a general "members update their own row" policy would.
create or replace function public.record_ai_processing_consent()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'record_ai_processing_consent requires an authenticated caller';
  end if;

  if not exists (select 1 from public.family_members where user_id = uid) then
    raise exception 'no family membership found for this caller';
  end if;

  -- Idempotent: coalesce keeps the first timestamp on a retried or
  -- double-tapped call, the same pattern startFamilyTrial uses for
  -- trial_started_at (apps/web/lib/billing/wall.ts). A caller with
  -- membership in more than one family consents for all of them at once,
  -- since it is the same person giving the same permission.
  update public.family_members
  set ai_processing_consented_at = coalesce(ai_processing_consented_at, now())
  where user_id = uid;
end;
$$;

revoke all on function public.record_ai_processing_consent() from public, anon;
grant execute on function public.record_ai_processing_consent() to authenticated;
