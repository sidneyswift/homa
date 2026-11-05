-- A complete set of choices is one accepted request, never one turn per tap.
alter table public.conversation_question_cards add constraint conversation_question_owner_unique unique(id,conversation_id);
alter table public.conversation_requests
  add column reply_question_id uuid,
  add column submission_hash text check (submission_hash ~ '^[a-f0-9]{64}$'),
  add constraint conversation_reply_question_owner foreign key(reply_question_id,conversation_id)
    references public.conversation_question_cards(id,conversation_id);
alter table public.conversation_question_cards
  add column answer_request_id uuid,
  add column answer_payload jsonb check (jsonb_typeof(answer_payload) = 'array'),
  add constraint conversation_question_answer_owner foreign key(answer_request_id,conversation_id)
    references public.conversation_requests(id,conversation_id);
alter table public.conversation_question_cards drop constraint conversation_question_cards_state_check;
alter table public.conversation_question_cards add constraint conversation_question_cards_state_check
  check (state in ('recorded','ready','continued','answered','deleted'));
alter table public.conversation_question_cards add constraint conversation_question_answer_identity
  check (state <> 'answered' or answer_request_id is not null);

create or replace function public.erase_conversation_question_card() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Removing an answer keeps the spent identity, not its selected choices.
  update public.conversation_question_cards set answer_payload=null where answer_request_id in (
    select id from public.conversation_requests where canonical_message_id=old.id
  );
  with erased as (
    update public.conversation_question_cards q
      set state='deleted',payload=null,payload_hash=null,canonical_message_id=null,answer_payload=null
      where q.canonical_message_id=old.id or q.request_id in (
        select id from public.conversation_requests where canonical_message_id=old.id
      ) returning id
  ) update public.conversation_requests set state='revoked',lease_token=null,lease_until=null,updated_at=clock_timestamp()
    where reply_question_id in (select id from erased) and state in ('queued','leased');
  return old;
end;
$$;

create or replace function public.erase_conversation_request() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.conversation_requests
    set state='deleted',payload_hash=null,submission_hash=null,canonical_message_id=null,
      lease_token=null,lease_until=null,updated_at=clock_timestamp()
    where canonical_message_id=old.id;
  return old;
end;
$$;
