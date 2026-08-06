-- Two different migrations were accidentally assigned version
-- 20260804090000. Supabase records only the version, so a database could
-- receive either effect while treating both filenames as applied. Repeat both
-- idempotent effects under one unique version to converge every environment.

do $$
begin
  if to_regprocedure(
    'public.toggle_plan_activity_check(uuid,text,smallint,smallint,boolean)'
  ) is not null then
    execute 'revoke all on function public.toggle_plan_activity_check(uuid, text, smallint, smallint, boolean) from public, anon, authenticated';
  end if;
end
$$;

-- A Stripe card fingerprint is a provider-owned, opaque equality signal. It
-- prevents two active Homa trial families from scheduling future charges on
-- the same exact card, without inferring identity from family-entered data.
-- Server-only: a family must never learn whether any other family shares it.

create table if not exists public.stripe_trial_card_claims (
  card_fingerprint text primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_trial_card_claims_family_idx
  on public.stripe_trial_card_claims (family_id);

alter table public.stripe_trial_card_claims enable row level security;
revoke all on table public.stripe_trial_card_claims from anon, authenticated;
