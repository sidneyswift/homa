-- Conversation continuity Data API hardening.
--
-- Direct server SQL is the only write path. Authenticated family members may
-- read family-visible history and delivery state; internal scheduler prompts
-- and transport bindings remain server-only.

drop policy if exists "members read their conversation messages"
  on public.conversation_messages;
create policy "members read their conversation messages"
  on public.conversation_messages
  for select
  to authenticated
  using (
    visibility = 'family'
    and public.is_family_member(family_id)
  );

revoke all on table public.conversation_messages from public, anon, authenticated;
grant select on table public.conversation_messages to authenticated;

revoke all on table public.conversation_episodes from public, anon, authenticated;
grant select on table public.conversation_episodes to authenticated;

revoke all on table public.conversation_deliveries from public, anon, authenticated;
grant select on table public.conversation_deliveries to authenticated;

revoke all on table public.conversation_open_loops from public, anon, authenticated;
grant select on table public.conversation_open_loops to authenticated;

revoke all on table public.conversation_thread_bindings
  from public, anon, authenticated;
