-- Parent choice cards survive runtime replacement. Their answers are ordinary
-- new messages, not connection approvals or commands to resume an old effect.
alter table public.conversation_requests drop constraint conversation_requests_state_check;
alter table public.conversation_requests add constraint conversation_requests_state_check
  check (state in ('queued','leased','executing','recovery_required','completed','failed','deleted','revoked','awaiting_parent','continued'));
alter table public.conversation_requests add constraint conversation_request_question_execution
  check (state not in ('awaiting_parent','continued') or execution_session_id is not null);
alter table public.conversation_requests add constraint conversation_request_owner_unique unique(id,conversation_id);

create table public.conversation_question_cards (
  id uuid primary key,
  conversation_id uuid not null references public.conversation_records(id) on delete cascade,
  request_id uuid not null,
  source_sequence integer not null check (source_sequence >= 0),
  step_index integer not null check (step_index >= 0),
  call_id text not null check (length(call_id) between 1 and 512),
  canonical_message_id uuid unique references public.conversation_messages(id) on delete set null,
  payload jsonb check (jsonb_typeof(payload) = 'object'),
  payload_hash text check (payload_hash ~ '^[a-f0-9]{64}$'),
  state text not null default 'recorded' check (state in ('recorded','ready','continued','deleted')),
  created_at timestamptz not null default clock_timestamp(),
  unique(request_id,source_sequence,call_id),
  foreign key(request_id,conversation_id) references public.conversation_requests(id,conversation_id) on delete cascade,
  check (state='deleted' or (canonical_message_id is not null and payload is not null and payload_hash is not null))
);
alter table public.conversation_question_cards enable row level security;
revoke all on public.conversation_question_cards from public,anon,authenticated;

-- Keep content-free source identity after deletion so replay cannot recreate a
-- removed card. Erasing an input also removes its interactive payload; existing
-- assistant text retains the ordinary per-message deletion policy.
create function public.erase_conversation_question_card() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.conversation_question_cards q set state='deleted',payload=null,payload_hash=null,canonical_message_id=null
    where q.canonical_message_id=old.id or q.request_id in (
      select id from public.conversation_requests where canonical_message_id=old.id
    );
  return old;
end;
$$;
revoke all on function public.erase_conversation_question_card() from public,anon,authenticated;
-- Runs before conversation_request_erase clears the source message reference.
create trigger conversation_question_card_erase before delete on public.conversation_messages
  for each row execute function public.erase_conversation_question_card();
