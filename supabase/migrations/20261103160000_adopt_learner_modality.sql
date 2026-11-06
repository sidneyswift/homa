-- Adopt the learner modality schema production already carries, gh#1250.
--
-- 20260718150000_learner_modality.sql from PR #41 (learner modality profile
-- system) was run against production by hand in July, and the PR then
-- closed without merging. Production kept the objects while no migration on
-- main created them. Founder ruling 2026-11-03: keep them and record them
-- here rather than drop them.
--
-- Every statement reproduces production's catalog as read on 2026-11-03,
-- which matches the PR's final (Phase 4) file. Production therefore changes
-- nothing when this runs, and a fresh database (the local stack, CI) builds
-- the same shape. The two hot tables, family_memories and events, are
-- touched only behind catalog checks so production takes no lock on them.
-- Grants stay at the Supabase defaults production has, as on
-- family_memories. No code on main reads or writes these objects yet.

-- family_memories.modality: the learning modality a what_works memory is
-- about. Null for facts and unclassified entries.
do $adopt_family_memories_modality$
begin
  if not exists (
    select 1
    from pg_catalog.pg_attribute
    where attrelid = 'public.family_memories'::regclass
      and attname = 'modality'
      and not attisdropped
  ) then
    alter table public.family_memories
      add column modality text
      constraint family_memories_modality_check
      check (modality is null or modality in ('visual', 'auditory', 'kinesthetic', 'reading_writing'));
    comment on column public.family_memories.modality is
      'Learning modality this what_works memory is about. Null for facts and unclassified entries.';
  end if;

  if to_regclass('public.idx_family_memories_modality') is null then
    create index idx_family_memories_modality
      on public.family_memories (family_id, child_id, modality)
      where modality is not null and superseded_at is null;
  end if;
end
$adopt_family_memories_modality$;

-- learner_modality_signals: append-only evidence behind a per-child,
-- per-subject learning tendency profile. Family-scoped like family_memories.
create table if not exists public.learner_modality_signals (
  id uuid default gen_random_uuid() primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  modality text not null
    check (modality in ('visual', 'auditory', 'kinesthetic', 'reading_writing')),
  subject_id text
    check (subject_id is null or subject_id ~ '^[a-z][a-z0-9_-]*$'),
  signal_type text not null
    check (signal_type in (
      'parent_stated',
      'lesson_what_worked',
      'memory_classified',
      'material_finalized',
      'reteach_signal',
      'agent_observed'
    )),
  valence smallint not null default 1
    check (valence in (-1, 1)),
  content text
    check (content is null or length(content) <= 300),
  source_session_id text,
  source_memory_id uuid references public.family_memories(id) on delete set null,
  source_material_id uuid,
  source_lesson_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_modality_signals_child
  on public.learner_modality_signals (child_id, created_at desc);
create index if not exists idx_modality_signals_family
  on public.learner_modality_signals (family_id);
create index if not exists idx_modality_signals_child_subject
  on public.learner_modality_signals (child_id, subject_id, modality);

alter table public.learner_modality_signals enable row level security;

-- Policies have no "if not exists", so each is created only when missing.
do $adopt_learner_modality_policies$
begin
  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'learner_modality_signals'
      and policyname = 'members read their modality signals'
  ) then
    create policy "members read their modality signals"
      on public.learner_modality_signals
      for select
      to authenticated
      using (public.is_family_member(family_id));
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'learner_modality_signals'
      and policyname = 'members insert modality signals'
  ) then
    create policy "members insert modality signals"
      on public.learner_modality_signals
      for insert
      to authenticated
      with check (
        public.is_family_member(family_id)
        and exists (
          select 1
          from public.children c
          where c.id = learner_modality_signals.child_id
            and c.family_id = learner_modality_signals.family_id
        )
      );
  end if;

  -- A member may emit learner.* events for their own family only, the same
  -- shape as the chat.* policy in 20260706061222_family_memory.sql.
  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'events'
      and policyname = 'members emit learner events for their family'
  ) then
    create policy "members emit learner events for their family"
      on public.events
      for insert
      to authenticated
      with check (
        name like 'learner.%'
        and family_id is not null
        and public.is_family_member(family_id)
      );
  end if;
end
$adopt_learner_modality_policies$;
