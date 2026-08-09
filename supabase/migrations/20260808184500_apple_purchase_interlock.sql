-- StoreKit charges before the mobile client can submit Apple's signed
-- transaction to Homa. This family-locked marker closes that gap: account
-- deletion blocks while a purchase may be in flight, then verified provider
-- evidence or an exact client cancellation removes the marker.

alter table public.families
  add column apple_provider_observed_at timestamptz;

update public.families
set apple_provider_observed_at = coalesce(billing_updated_at, updated_at)
where apple_original_transaction_id is not null;

create table public.apple_purchase_interlocks (
  attempt_id uuid primary key,
  family_id uuid not null
    references public.families (id) on delete cascade,
  product_id text not null check (char_length(product_id) between 1 and 200),
  state text not null default 'prepared'
    check (state in (
      'prepared',
      'store_started',
      'cancel_pending',
      'canceled',
      'resolved'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  canceled_at timestamptz,
  check ((state = 'resolved') = (resolved_at is not null)),
  check ((state = 'canceled') = (canceled_at is not null))
);

create index apple_purchase_interlocks_family_idx
  on public.apple_purchase_interlocks (family_id, state, created_at, attempt_id);

create unique index apple_purchase_interlocks_one_active_family_idx
  on public.apple_purchase_interlocks (family_id)
  where state in ('prepared', 'store_started', 'cancel_pending');

create index apple_purchase_interlocks_updated_idx
  on public.apple_purchase_interlocks (updated_at);

alter table public.apple_purchase_interlocks enable row level security;
revoke all on table public.apple_purchase_interlocks
  from public, anon, authenticated;

-- The general hard-delete protocol is installed before this table exists.
-- This second guard makes every present and future delete path fail closed if
-- application code ever forgets to check an active StoreKit handoff.
create or replace function public.guard_family_apple_purchase_interlock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.apple_purchase_interlocks interlock
    where interlock.family_id = old.id
      and interlock.state in ('prepared', 'store_started', 'cancel_pending')
  ) then
    raise exception using
      errcode = '55000',
      message = 'family hard delete is blocked by an active App Store purchase';
  end if;
  return old;
end;
$$;

revoke all on function public.guard_family_apple_purchase_interlock()
  from public, anon, authenticated;

create trigger families_apple_purchase_interlock_guard
before delete on public.families
for each row execute function public.guard_family_apple_purchase_interlock();
