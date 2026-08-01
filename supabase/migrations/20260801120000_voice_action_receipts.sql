-- Server-owned receipts for reversible actions started from Voice (gh#544).
-- The receipt is not a generic mutation log. `effect` is a closed allowlist,
-- and each value has one exact compensator in lib/voice/action-receipts.ts.
-- External sends, printing, purchases, filings, and account actions are absent
-- on purpose, so they can never be advertised as undoable.

create table if not exists public.voice_action_receipts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  actor_user_id uuid not null,
  runtime_session_id text not null check (char_length(runtime_session_id) between 1 and 200),
  turn_id text not null check (char_length(turn_id) between 1 and 200),
  object_kind text not null check (object_kind in ('hours_entry', 'family_event')),
  object_id uuid not null,
  effect text not null check (
    effect in (
      'hours.logged',
      'family_event.added',
      'family_event.updated',
      'family_event.removed'
    )
  ),
  named_effect text not null check (char_length(named_effect) between 1 and 240),
  undo_capability text not null check (
    undo_capability in ('exact_delete', 'exact_restore', 'append_only_restore')
  ),
  compensator_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'committed', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  undone_at timestamptz,
  undo_turn_id text check (undo_turn_id is null or char_length(undo_turn_id) between 1 and 200),
  constraint voice_action_receipts_expiry_order check (expires_at > created_at),
  constraint voice_action_receipts_undo_pair check (
    (undone_at is null and undo_turn_id is null)
    or (undone_at is not null and undo_turn_id is not null)
  ),
  unique (family_id, runtime_session_id, turn_id, effect, object_id)
);

create index if not exists voice_action_receipts_recent_idx
  on public.voice_action_receipts (family_id, runtime_session_id, created_at desc);

alter table public.voice_action_receipts enable row level security;

-- Receipts contain compensator snapshots and are server-only. Native Voice
-- receives the bounded public receipt returned by the tool, never this row.
revoke all on public.voice_action_receipts from anon, authenticated;
