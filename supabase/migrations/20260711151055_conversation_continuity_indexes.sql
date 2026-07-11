-- Cover every foreign key added by the conversation continuity spine.

create index if not exists conversation_deliveries_family_idx
  on public.conversation_deliveries (family_id, created_at desc);
create index if not exists conversation_deliveries_episode_idx
  on public.conversation_deliveries (episode_id);
create index if not exists conversation_deliveries_reply_message_idx
  on public.conversation_deliveries (reply_message_id)
  where reply_message_id is not null;

create index if not exists conversation_messages_reply_to_idx
  on public.conversation_messages (reply_to_message_id)
  where reply_to_message_id is not null;

create index if not exists conversation_open_loops_episode_idx
  on public.conversation_open_loops (episode_id);
create index if not exists conversation_open_loops_message_idx
  on public.conversation_open_loops (message_id);
create index if not exists conversation_open_loops_resolved_message_idx
  on public.conversation_open_loops (resolved_by_message_id)
  where resolved_by_message_id is not null;

create index if not exists conversation_thread_bindings_episode_idx
  on public.conversation_thread_bindings (episode_id);
create index if not exists conversation_thread_bindings_member_idx
  on public.conversation_thread_bindings (member_user_id, last_seen_at desc)
  where member_user_id is not null;
