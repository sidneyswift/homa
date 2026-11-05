-- One database switch for the conversation rebuild (gh#1158). It ships off.
-- While off, every trigger that would create rebuild data or change behavior
-- on an existing table (conversation_messages, materials, chat_attachments,
-- conversation_deliveries, agent_jobs) returns before doing any work, so the
-- live product behaves exactly as it did before these migrations.
--
-- Erasure and revocation triggers are deliberately NOT gated: they only touch
-- rebuild tables, which stay empty while off, and a deletion must still erase
-- anything recorded during an earlier period with the switch on.
--
-- Turn on only together with HOMA_CONVERSATION_RECORDING and
-- HOMA_CONVERSATION_REQUESTS (runbook: plans/2026-09-12-app2-live-voice.md):
--   update public.conversation_rebuild_settings set enabled = true;
-- Turning it off is the immediate rollback for trigger behavior.
create table public.conversation_rebuild_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.conversation_rebuild_settings (singleton, enabled) values (true, false);
alter table public.conversation_rebuild_settings enable row level security;
revoke all on public.conversation_rebuild_settings from public, anon, authenticated;

create function public.conversation_rebuild_enabled() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select enabled from public.conversation_rebuild_settings where singleton), false);
$$;
revoke all on function public.conversation_rebuild_enabled() from public, anon, authenticated;
