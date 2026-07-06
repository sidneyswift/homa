-- Migration #13: the memory floor (M2-02 slice) + parent display name (M2-01).
-- Homa's durable memory lives in Postgres rows, never in conversation history
-- or sandbox files (01-architecture.md state model): a fresh session with the
-- same rows behaves identically, which is what makes session rotation safe.
-- Every read and write is scoped by RLS through the caller's own token.

-- 1. What Homa calls the parent. journeys/02 keeps this field on the intake
--    form ("the first voice moment"); the dynamic context loader injects it.
alter table public.families add column parent_display_name text;

-- create_my_family v2: same body, plus the display name. The old 2-arg
-- signature is dropped first so PostgREST sees exactly one function and
-- named-param calls stay unambiguous.
drop function if exists public.create_my_family(text, text);

create or replace function public.create_my_family(
  family_name text default 'My family',
  family_us_state text default null,
  parent_name text default null
)
returns table (family_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to create a family';
  end if;

  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'You already belong to a family';
  end if;

  insert into public.families (name, us_state, parent_display_name)
  values (family_name, family_us_state, nullif(trim(parent_name), ''))
  returning id into new_family_id;

  insert into public.family_members (family_id, user_id, role)
  values (new_family_id, auth.uid(), 'parent');

  return query select new_family_id;
end;
$$;

revoke all on function public.create_my_family(text, text, text) from public;
revoke execute on function public.create_my_family(text, text, text) from anon;
grant execute on function public.create_my_family(text, text, text) to authenticated;

-- 2. family_memories: the layered memory model ported from the template's
--    MEMORY.md / what-works files. kind='fact' is curated long-term memory,
--    'what_works' is per-child teaching signal, 'daily_note' is reserved for
--    the journal loop (M2-07). Content budgets are enforced app-side (the
--    consolidate-on-full pattern); the check here is the hard backstop.
create table public.family_memories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid references public.children (id) on delete cascade,
  kind text not null default 'fact'
    check (kind in ('fact', 'what_works', 'daily_note')),
  content text not null
    check (char_length(content) between 1 and 500),
  source text not null default 'homa'
    check (source in ('homa', 'parent', 'onboarding')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index family_memories_family_idx
  on public.family_memories (family_id, created_at);

alter table public.family_memories enable row level security;

-- The child-coherence subqueries run under the caller's own RLS on children,
-- so a child id from another family resolves to no row and the write fails.
create policy "members read their memories"
  on public.family_memories
  for select
  to authenticated
  using (public.is_family_member(family_id));

create policy "members add memories"
  on public.family_memories
  for insert
  to authenticated
  with check (
    public.is_family_member(family_id)
    and (
      child_id is null
      or exists (
        select 1 from public.children c
        where c.id = child_id and c.family_id = family_memories.family_id
      )
    )
  );

create policy "members update their memories"
  on public.family_memories
  for update
  to authenticated
  using (public.is_family_member(family_id))
  with check (
    public.is_family_member(family_id)
    and (
      child_id is null
      or exists (
        select 1 from public.children c
        where c.id = child_id and c.family_id = family_memories.family_id
      )
    )
  );

create policy "members delete their memories"
  on public.family_memories
  for delete
  to authenticated
  using (public.is_family_member(family_id));

-- 3. Chat events (MJ-08 law: no feature merges without its events). Signed-in
--    members may emit chat.* events stamped with their own family; the anon
--    waitlist-only policy from migration #1 is untouched.
create policy "members emit chat events for their family"
  on public.events
  for insert
  to authenticated
  with check (
    name like 'chat.%'
    and family_id is not null
    and public.is_family_member(family_id)
  );
