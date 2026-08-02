create table public.child_progress_next_moves (
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null,
  context_fingerprint text not null,
  source_revision bigint not null,
  prompt_version text not null,
  status text not null default 'pending',
  result jsonb,
  runtime_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dismissed_at timestamptz,
  dismissed_until timestamptz,
  superseded_at timestamptz,
  primary key (family_id, child_id, context_fingerprint),
  constraint child_progress_next_moves_child_family_fk
    foreign key (child_id, family_id)
    references public.children (id, family_id)
    on delete cascade,
  constraint child_progress_next_moves_fingerprint_check
    check (context_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint child_progress_next_moves_prompt_version_check
    check (char_length(prompt_version) between 1 and 80),
  constraint child_progress_next_moves_status_check
    check (status in (
      'pending', 'ready', 'clarify', 'none', 'failed', 'dismissed', 'superseded'
    )),
  constraint child_progress_next_moves_result_check
    check (
      (status = 'pending' and result is null)
      or (status = 'failed' and result is null)
      or (status = 'superseded')
      or (
        status in ('ready', 'clarify', 'none', 'dismissed')
        and result is not null
      )
    ),
  constraint child_progress_next_moves_dismissal_check
    check (
      status <> 'dismissed'
      or (dismissed_at is not null and dismissed_until is not null)
    )
);

create index child_progress_next_moves_active_idx
  on public.child_progress_next_moves (family_id, child_id, updated_at desc)
  where status <> 'superseded';

create unique index child_progress_next_moves_one_live_idx
  on public.child_progress_next_moves (family_id, child_id)
  where status in ('pending', 'ready', 'clarify', 'none', 'failed');

alter table public.child_progress_next_moves enable row level security;

revoke all on table public.child_progress_next_moves from anon, authenticated;
