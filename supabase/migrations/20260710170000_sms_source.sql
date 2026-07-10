-- Migration #45: 'sms' becomes a legal acquisition source
-- (sms-onboarding-plan SO-4). Homa now performs signup over text, so
-- families born on the channel carry source='sms', and the claim-time
-- waitlist mirror must accept the same value.

alter table public.families
  drop constraint if exists families_source_check;
alter table public.families
  add constraint families_source_check
  check (source in ('conference', 'referral', 'organic', 'social', 'other', 'sms'));

alter table public.waitlist
  drop constraint if exists waitlist_source_check;
alter table public.waitlist
  add constraint waitlist_source_check
  check (source in ('conference', 'referral', 'organic', 'social', 'other', 'sms'));
