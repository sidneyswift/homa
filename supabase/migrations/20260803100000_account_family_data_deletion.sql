-- A deletion request is an audited workflow, not a soft-delete flag.  The
-- job retains the family id only until the records are actually erased; the
-- completion row is deliberately de-identified so the audit trail does not
-- become a new copy of a family's data.
create table if not exists public.account_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid,
  requested_by_user_id uuid,
  status text not null default 'preparing'
    check (status in ('preparing', 'waiting_for_artifacts', 'running', 'retryable_failed', 'blocked', 'complete')),
  attempts integer not null default 0 check (attempts >= 0),
  provider_summary jsonb not null default '{}'::jsonb,
  artifact_count integer,
  last_error text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists account_deletion_jobs_pending_idx
  on public.account_deletion_jobs (requested_at)
  where status in ('waiting_for_artifacts', 'retryable_failed');

create unique index if not exists account_deletion_jobs_one_active_family_idx
  on public.account_deletion_jobs (family_id)
  where family_id is not null and status <> 'complete';

alter table public.account_deletion_jobs enable row level security;
revoke all on table public.account_deletion_jobs from public, anon, authenticated;

-- #659 found that analytics events lacked this cascade.  A deleted family's
-- event rows are still family-scoped data even when their payload is benign.
delete from public.events event
where event.family_id is not null
  and not exists (select 1 from public.families family where family.id = event.family_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_family_id_fkey'
      and conrelid = 'public.events'::regclass
      and confdeltype = 'c'
  ) then
    alter table public.events drop constraint if exists events_family_id_fkey;
    alter table public.events
      add constraint events_family_id_fkey
      foreign key (family_id) references public.families (id) on delete cascade;
  end if;
end;
$$;

-- The original mobile-only delete RPC predates Blob cleanup and provider
-- cancellation.  Leave it available for a parent removing only their own
-- login from a shared family, but make its final family delete complete the
-- remaining historical no-action foreign keys too.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sole_family_id uuid;
begin
  if uid is null then
    raise exception 'delete_own_account requires an authenticated caller';
  end if;

  for sole_family_id in
    select m.family_id
    from public.family_members m
    where m.user_id = uid
      and not exists (
        select 1 from public.family_members other
        where other.family_id = m.family_id
          and other.user_id <> uid
      )
  loop
    delete from public.conversation_signals where family_id = sole_family_id;
    delete from public.knowledge_gaps where family_id = sole_family_id;
    delete from public.response_engagement where family_id = sole_family_id;
    delete from public.families where id = sole_family_id;
  end loop;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
