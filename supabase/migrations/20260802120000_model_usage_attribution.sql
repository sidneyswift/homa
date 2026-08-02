-- Add exact ownership to direct model calls. Chat turns already carry an
-- Eve session and turn. Background calls instead name the durable resource
-- they operate on, so NULL session_id no longer means unknown spend.
--
-- Additive only: existing rows remain valid, deny-all RLS is unchanged, and
-- current code can keep writing while the matching deploy rolls out.

alter table public.model_usage
  add column if not exists resource_kind text,
  add column if not exists resource_id text;

alter table public.model_usage
  drop constraint if exists model_usage_resource_pair_check,
  add constraint model_usage_resource_pair_check
  check ((resource_kind is null) = (resource_id is null)) not valid;

alter table public.model_usage
  drop constraint if exists model_usage_turn_session_check,
  add constraint model_usage_turn_session_check
  check (turn_id is null or session_id is not null) not valid;

alter table public.model_usage
  validate constraint model_usage_resource_pair_check;

alter table public.model_usage
  validate constraint model_usage_turn_session_check;

create index if not exists model_usage_resource_created_idx
  on public.model_usage (resource_kind, resource_id, created_at desc)
  where resource_kind is not null;

comment on column public.model_usage.resource_kind is
  'Typed durable owner for model work that has no Eve session.';
comment on column public.model_usage.resource_id is
  'Owner identifier paired with resource_kind; text supports UUID and composite keys.';
